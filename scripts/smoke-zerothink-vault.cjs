"use strict";
// Backend acceptance only: a disposable synthetic Electron profile, no windows,
// publisher credentials, account discovery, or real provider requests.
const { app, safeStorage } = require("electron");
const fsSync = require("node:fs"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createVaultStore } = require("../electron/zerothink-vault.cjs");
const { buildVaultCompletion } = require("../electron/zerothink-providers.cjs");
const { createTemplateStore } = require("../electron/zerothink-templates.cjs");
const temporaryRoot = path.resolve(os.tmpdir()), repositoryRoot = path.resolve(__dirname, "..");
const profileDirectory = fsSync.mkdtempSync(path.join(temporaryRoot, "zeroone-vault-smoke-"));
app.setName("ZeroOneVaultSyntheticSmoke"); app.setPath("userData", profileDirectory);
const receiptArg = process.argv.find((arg) => arg.startsWith("--receipt="))?.slice(10);
const receiptPath = receiptArg ? path.resolve(receiptArg) : path.join(repositoryRoot, "release-audit", "vault-native-smoke-20261001.json");
if (!receiptPath.startsWith(repositoryRoot + path.sep)) throw new Error("Smoke receipt must remain inside this checkout.");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
async function cleanup() {
  const resolved = path.resolve(profileDirectory);
  if (!resolved.startsWith(temporaryRoot + path.sep) || !path.basename(resolved).startsWith("zeroone-vault-smoke-")) throw new Error("Synthetic cleanup target escaped its temporary directory.");
  await fs.rm(resolved, { recursive: true, force: true });
}
app.whenReady().then(async () => {
  assert.equal(safeStorage.isEncryptionAvailable(), true, "Operating-system encryption is available");
  assert.notEqual(typeof safeStorage.getSelectedStorageBackend === "function" ? safeStorage.getSelectedStorageBackend() : "native-platform", "basic_text", "Plaintext fallback must not be used");
  const fixtureKey = "SYNTHETIC_FIXTURE_KEY", fixtureName = "SYNTHETIC_VAULT_PROFILE_MARKER", vaultPath = path.join(profileDirectory, "synthetic-vault.encrypted.json");
  const store = createVaultStore({ filePath: vaultPath, safeStorage });
  const saved = await store.saveProfile({ name: fixtureName, provider: "groq", model: "synthetic-model", key: fixtureKey });
  const id = saved.profiles[0].id;
  assert.equal(saved.secure, true); assert.equal(saved.profiles[0].hasKey, true); assert.equal(saved.activeProfileId, null); assert.equal(Object.hasOwn(saved.profiles[0], "key"), false); assert.equal(JSON.stringify(saved).includes(fixtureKey), false);
  const encryptedBytes = await fs.readFile(vaultPath), envelope = encryptedBytes.toString("utf8");
  assert.equal(envelope.includes(fixtureKey), false); assert.equal(envelope.includes(fixtureName), false); assert.equal(envelope.includes("synthetic-model"), false);
  await store.selectProfile(id);
  const restarted = createVaultStore({ filePath: vaultPath, safeStorage }), active = await restarted.getActiveCompletion();
  assert.equal((await restarted.snapshot()).activeProfileId, id); assert.equal(active.key, fixtureKey); assert.equal(active.name, fixtureName);
  let mockCalls = 0;
  const completion = buildVaultCompletion(active, { storeManaged: true, fetchImpl: async (url, options) => {
    mockCalls++; assert.equal(url, "https://api.groq.com/openai/v1/chat/completions"); assert.equal(options.headers.Authorization, `Bearer ${fixtureKey}`); assert.equal(options.redirect, "error"); assert.equal(options.body.includes(fixtureKey), false);
    return new Response(JSON.stringify({ choices: [{ message: { content: "Synthetic adapter answer" } }], usage: { prompt_tokens: 4, completion_tokens: 3 } }));
  } });
  assert.equal((await completion.complete({ messages: [{ role: "user", content: "Synthetic backend fixture only" }] })).content, "Synthetic adapter answer"); assert.equal(mockCalls, 1);
  const migrated = await restarted.migrateLegacy({ assistantProvider: "openzero", openZeroAssistantMode: "local", openZeroUrl: "https://synthetic-server.example", openZeroServerModel: "synthetic-server-model", openZeroToken: fixtureKey, serperKey: fixtureKey });
  assert.equal(migrated.activeProfileId, id); assert.equal(await restarted.getServiceKey("openzero"), fixtureKey); assert.equal(await restarted.getServiceKey("serper"), fixtureKey);
  await restarted.saveProfile({ name: "Synthetic second server", provider: "openzero", endpoint: "https://different-synthetic-server.example", model: "synthetic-model", key: "SYNTHETIC_ALT_FIXTURE_KEY" });
  assert.equal(await restarted.getServiceKey("openzero", "https://synthetic-server.example/v1/chat/completions"), fixtureKey);
  assert.equal(await restarted.getServiceKey("openzero", "https://different-synthetic-server.example/v1/chat/completions"), "SYNTHETIC_ALT_FIXTURE_KEY");
  assert.equal(await restarted.getServiceKey("openzero", "https://unmatched-synthetic-server.example/v1/chat/completions"), "");
  await restarted.deleteProfile("legacy-serper"); await restarted.migrateLegacy({ serperKey: fixtureKey }); assert.equal(await restarted.getServiceKey("serper"), "");
  await restarted.deleteProfile(id); assert.equal((await restarted.snapshot()).activeProfileId, null); assert.equal(await restarted.getActiveCompletion(), null);
  await restarted.clear(); assert.equal((await createVaultStore({ filePath: vaultPath, safeStorage }).snapshot()).profiles.length, 0);
  const templatePath = path.join(profileDirectory, "synthetic-templates.encrypted.json"), templateStore = createTemplateStore({ filePath: templatePath, safeStorage });
  const template = await templateStore.save({ name: "SYNTHETIC_TEMPLATE_MARKER", description: "Synthetic acceptance fixture", kind: "custom", processId: "custom", stages: ["Inspect synthetic source", "Report verified fixture"], requiredSources: ["Synthetic source only"], validationChecks: ["No external requests"] });
  const templateEnvelope = await fs.readFile(templatePath, "utf8"); assert.equal(templateEnvelope.includes("SYNTHETIC_TEMPLATE_MARKER"), false); assert.equal(templateEnvelope.includes("Inspect synthetic source"), false);
  const templateReload = createTemplateStore({ filePath: templatePath, safeStorage }); assert.deepEqual((await templateReload.list()).find((item) => item.id === template.id), template);
  assert.equal(await templateReload.delete(template.id), true); assert.equal((await templateReload.list()).some((item) => item.id === template.id), false);
  const receipt = {
    electron: process.versions.electron, node: process.versions.node, platform: process.platform, fixtures: "synthetic disposable profile only", visibleWindowsOpened: 0, actualProviderRequests: 0, mockAdapterRequests: mockCalls,
    operatingSystemStorageSecure: true, vaultEncryptedAtRest: true, publicSnapshotContainsNoCredential: true, savedProfileReloadMatches: true, activeProfileReloadMatches: true, selectedProfileAdapterMockVerified: true,
    legacyMigrationRetainsLocalServerToken: true, serviceCredentialBoundToExpectedEndpoint: true, deletedLegacyCredentialNotResurrected: true, deletionClearsActiveSelection: true, clearedVaultReloadVerified: true,
    customTemplateEncryptedAtRest: true, customTemplateReloadMatches: true, customTemplateDeletionVerified: true,
    initialEncryptedVaultSha256: hash(encryptedBytes), vaultSourceSha256: hash(await fs.readFile(path.join(repositoryRoot, "electron", "zerothink-vault.cjs"))), providerSourceSha256: hash(await fs.readFile(path.join(repositoryRoot, "electron", "zerothink-providers.cjs"))),
  };
  await cleanup(); receipt.syntheticProfileRemoved = true;
  await fs.mkdir(path.dirname(receiptPath), { recursive: true }); await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(receipt));
}).catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await cleanup().catch((error) => { console.error(error.message); process.exitCode = 1; }); app.exit(process.exitCode || 0); });
