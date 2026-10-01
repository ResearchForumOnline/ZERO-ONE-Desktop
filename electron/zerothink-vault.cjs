"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { PROVIDERS, definition, endpointFor, normalizeProfile, credential } = require("./zerothink-providers.cjs");
const MAX_PROFILES = 64, MAX_STATE = 1024 * 1024;
const identifier = (value) => { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new Error("The vault profile identifier is invalid."); return value; };
function createVaultStore({ filePath, safeStorage }) {
  if (typeof filePath !== "string" || !filePath || !safeStorage) throw new Error("A native vault location and operating-system storage are required.");
  let queue = Promise.resolve();
  function secure() { try { return safeStorage.isEncryptionAvailable() === true && (typeof safeStorage.getSelectedStorageBackend !== "function" || safeStorage.getSelectedStorageBackend() !== "basic_text"); } catch { return false; } }
  function check() { if (!secure()) throw new Error("Secure operating-system key storage is unavailable. The vault was not changed."); }
  const empty = () => ({ version: 1, activeProfileId: null, profiles: [], legacyMigrated: false });
  function stateFor(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.profiles) || value.profiles.length > MAX_PROFILES || typeof value.legacyMigrated !== "boolean") throw new Error("The encrypted vault format is invalid. The existing file was preserved.");
    const seen = new Set();
    const profiles = value.profiles.map((entry) => {
      const id = identifier(entry?.id); if (seen.has(id)) throw new Error("The encrypted vault contains duplicate profiles."); seen.add(id);
      const clean = normalizeProfile(entry), key = credential(entry.key);
      if (typeof entry.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(entry.updatedAt)) throw new Error("The encrypted vault date is invalid.");
      return { id, ...clean, key, updatedAt: entry.updatedAt };
    });
    const activeProfileId = value.activeProfileId === null ? null : identifier(value.activeProfileId);
    if (activeProfileId && !profiles.some((profile) => profile.id === activeProfileId && profile.kind === "chat")) throw new Error("The encrypted vault selection is invalid.");
    return { version: 1, activeProfileId, profiles, legacyMigrated: value.legacyMigrated };
  }
  async function read() {
    check();
    try {
      const stat = await fs.lstat(filePath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * MAX_STATE) throw new Error("The encrypted vault file is invalid. The existing file was preserved.");
      const envelope = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (envelope?.version !== 1 || typeof envelope.encrypted !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.encrypted)) throw new Error("Invalid vault");
      const decoded = safeStorage.decryptString(Buffer.from(envelope.encrypted, "base64"));
      if (typeof decoded !== "string" || Buffer.byteLength(decoded, "utf8") > MAX_STATE) throw new Error("Invalid vault");
      return stateFor(JSON.parse(decoded));
    } catch (error) { if (error?.code === "ENOENT") return empty(); throw new Error("The encrypted vault could not be opened. Its existing contents were preserved."); }
  }
  async function write(value) {
    check(); const encoded = JSON.stringify(stateFor(value)); if (Buffer.byteLength(encoded, "utf8") > MAX_STATE) throw new Error("The native vault reached its storage limit.");
    let encrypted; try { encrypted = safeStorage.encryptString(encoded); if (!Buffer.isBuffer(encrypted) || !encrypted.length) throw new Error("Unavailable"); } catch { throw new Error("Operating-system encryption failed. The vault was not changed."); }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${randomUUID()}.tmp`; let handle;
    try { handle = await fs.open(temporary, "wx", 0o600); await handle.writeFile(JSON.stringify({ version: 1, encrypted: encrypted.toString("base64") }), "utf8"); await handle.sync(); await handle.close(); handle = null; await fs.rename(temporary, filePath); }
    catch { throw new Error("The encrypted vault could not be saved. Your previous vault was preserved."); }
    finally { if (handle) await handle.close().catch(() => {}); await fs.rm(temporary, { force: true }).catch(() => {}); }
  }
  function publicState(state, available = true) {
    return { version: 1, secure: available, activeProfileId: state.activeProfileId, profiles: state.profiles.map(({ id, name, provider, kind, model, endpoint, key, updatedAt }) => ({ id, name, provider, kind, model, endpoint, hasKey: !!key, updatedAt })), providers: PROVIDERS.map((item) => ({ ...item })), message: available ? "Keys are encrypted by your operating system and used only in the main process for the service you select." : "Secure operating-system key storage is unavailable. Enable a supported keyring to use the private vault." };
  }
  function mutate(action) { const operation = queue.then(action); queue = operation.catch(() => {}); return operation; }
  return {
    snapshot: async () => { await queue; if (!secure()) return publicState(empty(), false); return publicState(await read()); },
    saveProfile: (input) => mutate(async () => {
      const cleaned = normalizeProfile(input), state = await read();
      const id = input.id === undefined ? randomUUID() : identifier(input.id), index = state.profiles.findIndex((item) => item.id === id), previous = state.profiles[index];
      if (input.id !== undefined && !previous) throw new Error("This vault profile no longer exists. Refresh the vault before editing it.");
      if (input.clearKey !== undefined && typeof input.clearKey !== "boolean") throw new Error("The key-removal selection is invalid.");
      if (input.key !== undefined && input.clearKey === true) throw new Error("Choose either a replacement key or removal of the existing key.");
      if (previous && previous.provider !== cleaned.provider && input.key === undefined && input.clearKey !== true) throw new Error("Changing a provider requires a new key or explicit key removal.");
      if (previous && previous.endpoint !== cleaned.endpoint && previous.key && input.key === undefined && input.clearKey !== true) throw new Error("Changing a server endpoint requires a replacement key or explicit key removal.");
      const key = input.clearKey === true ? "" : input.key === undefined ? previous?.key || "" : credential(input.key);
      const profile = { id, ...cleaned, key, updatedAt: new Date().toISOString() };
      if (index >= 0) state.profiles[index] = profile; else { if (state.profiles.length >= MAX_PROFILES) throw new Error("The vault holds 64 profiles. Remove an old profile first."); state.profiles.push(profile); }
      await write(state); return publicState(state);
    }),
    deleteProfile: (id) => mutate(async () => { identifier(id); const state = await read(); state.profiles = state.profiles.filter((profile) => profile.id !== id); if (state.activeProfileId === id) state.activeProfileId = null; await write(state); return publicState(state); }),
    selectProfile: (id) => mutate(async () => { if (id !== null) identifier(id); const state = await read(); if (id !== null) { const selected = state.profiles.find((profile) => profile.id === id); if (!selected || selected.kind !== "chat") throw new Error("Select a saved chat profile."); if (definition(selected.provider).requiresKey && !selected.key) throw new Error("Save a key for this profile before making it active."); } state.activeProfileId = id; await write(state); return publicState(state); }),
    getActiveCompletion: async () => { await queue; const state = await read(); const selected = state.profiles.find((profile) => profile.id === state.activeProfileId); return selected ? { ...selected } : null; },
    getServiceKey: async (provider, expectedEndpoint) => {
      definition(provider); const endpoint = expectedEndpoint === undefined ? null : endpointFor(provider, expectedEndpoint);
      await queue; const state = await read();
      return state.profiles.slice().reverse().filter((profile) => profile.provider === provider && profile.key && (endpoint === null || profile.endpoint === endpoint)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.key || "";
    },
    migrateLegacy: (input) => mutate(async () => {
      if (!input || typeof input !== "object") throw new Error("Legacy settings are invalid.");
      const state = await read(); if (state.legacyMigrated) return publicState(state);
      const entries = [{ provider: "openai", key: input.openAiKey, model: input.assistantProvider === "openai" ? input.model : undefined }, { provider: "groq", key: input.groqKey, model: input.assistantProvider === "groq" ? input.model : undefined }, { provider: "serper", key: input.serperKey }];
      if ((input.openZeroAssistantMode === "server" || input.openZeroToken) && input.openZeroUrl) entries.push({ provider: "openzero", key: input.openZeroToken || "", model: input.openZeroServerModel || input.model, endpoint: input.openZeroUrl });
      for (const entry of entries) {
        if (!entry.key && entry.provider !== "openzero") continue;
        // Legacy profiles never overwrite a user-created profile or a selected
        // provider. Import is internal and never reveals decrypted settings.
        if (state.profiles.some((profile) => profile.id === `legacy-${entry.provider}`)) continue;
        if (state.profiles.length >= MAX_PROFILES) throw new Error("Remove an old vault profile before migrating settings.");
        const clean = normalizeProfile({ ...entry, name: `${definition(entry.provider).label} · migrated` });
        state.profiles.push({ id: `legacy-${entry.provider}`, ...clean, key: credential(entry.key), updatedAt: new Date().toISOString() });
      }
      const active = input.assistantProvider === "openzero" && input.openZeroAssistantMode !== "server" ? null : state.profiles.find((profile) => profile.id === `legacy-${input.assistantProvider}` && profile.kind === "chat");
      if (!state.activeProfileId && active) state.activeProfileId = active.id;
      state.legacyMigrated = true; await write(state); return publicState(state);
    }),
    clear: () => mutate(async () => { await read(); const state = empty(); state.legacyMigrated = true; await write(state); return publicState(state); }),
  };
}
module.exports = { createVaultStore, MAX_PROFILES };
