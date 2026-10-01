"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomBytes, createCipheriv, createDecipheriv } = require("node:crypto");
const { createVaultStore } = require("./zerothink-vault.cjs");
const { PROVIDERS, normalizeProfile, endpointFor, buildVaultCompletion } = require("./zerothink-providers.cjs");

// This synthetic test wrapper exercises the envelope with authenticated
// encryption. Platform safeStorage is separately verified in Electron QA.
function syntheticStorage() {
  const key = randomBytes(32);
  return {
    isEncryptionAvailable: () => true, getSelectedStorageBackend: () => "synthetic-test-keyring",
    encryptString: (value) => { const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, nonce), encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]); },
    decryptString: (bytes) => { const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28)); return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8"); },
  };
}
async function fixture(t, override = {}) { const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zero-vault-test-")), filePath = path.join(directory, "vault.encrypted.json"), safeStorage = { ...syntheticStorage(), ...override }; t.after(() => fs.rm(directory, { recursive: true, force: true })); return { directory, filePath, safeStorage, store: createVaultStore({ filePath, safeStorage }) }; }
const input = { provider: "groq", name: "Synthetic Groq", model: "synthetic-model", key: "synthetic-vault-key-ONLY" };
const messages = [{ role: "system", content: "Summarize the provided fixture." }, { role: "user", content: "Explain the test." }];
const result = (content = "Fixture answer") => new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 11, completion_tokens: 7 } }));

test("vault has eleven original providers with explicit chat and service kinds", () => {
  assert.equal(PROVIDERS.length, 11); assert.equal(new Set(PROVIDERS.map((item) => item.id)).size, 11);
  assert.equal(PROVIDERS.filter((item) => item.kind === "chat").length, 8);
  assert.equal(PROVIDERS.find((item) => item.id === "serper").kind, "search");
  assert.equal(PROVIDERS.find((item) => item.id === "ionq").kind, "quantum");
  for (const provider of PROVIDERS) assert.ok(Object.isFrozen(provider));
});
test("vault encrypts all data atomically and snapshot never includes credential fields", async (t) => {
  const { store, filePath, directory } = await fixture(t);
  const saved = await store.saveProfile({ ...input, publisherConfiguration: "discard me" });
  const profile = saved.profiles[0]; assert.equal(profile.hasKey, true); assert.equal(profile.provider, "groq"); assert.equal(saved.activeProfileId, null);
  assert.equal(JSON.stringify(saved).includes(input.key), false); assert.equal(Object.hasOwn(profile, "key"), false); assert.equal(Object.hasOwn(profile, "publisherConfiguration"), false);
  const encoded = await fs.readFile(filePath, "utf8"); assert.equal(encoded.includes(input.key), false); assert.equal(encoded.includes(input.model), false); assert.equal(encoded.includes(input.name), false);
  assert.deepEqual((await fs.readdir(directory)), ["vault.encrypted.json"]);
  await store.selectProfile(profile.id); assert.equal((await store.getActiveCompletion()).key, input.key);
});
test("vault profiles reopen with the same OS wrapper and selected provider", async (t) => {
  const { store, filePath, safeStorage } = await fixture(t), saved = await store.saveProfile(input); await store.selectProfile(saved.profiles[0].id);
  const reopened = createVaultStore({ filePath, safeStorage }); assert.equal((await reopened.snapshot()).profiles[0].name, input.name); assert.equal((await reopened.getActiveCompletion()).model, input.model);
});
test("unavailable encryption and Linux basic_text fail closed without writing", async (t) => {
  for (const override of [{ isEncryptionAvailable: () => false }, { getSelectedStorageBackend: () => "basic_text" }, { isEncryptionAvailable: () => { throw new Error("synthetic-key-echo"); } }]) {
    const { store, directory } = await fixture(t, override); assert.equal((await store.snapshot()).secure, false);
    await assert.rejects(store.saveProfile(input), /Secure operating-system/); await assert.rejects(store.getServiceKey("groq"), /Secure operating-system/); assert.deepEqual(await fs.readdir(directory), []);
  }
});
test("corrupt cipher, incompatible OS wrapper and invalid envelope preserve file bytes", async (t) => {
  const { store, filePath } = await fixture(t); await store.saveProfile(input);
  const original = await fs.readFile(filePath);
  const incompatible = createVaultStore({ filePath, safeStorage: syntheticStorage() }); await assert.rejects(incompatible.snapshot(), /preserved/); assert.deepEqual(await fs.readFile(filePath), original);
  for (const bad of ["not JSON", JSON.stringify({ version: 2, encrypted: "AAAA" }), JSON.stringify({ version: 1, encrypted: "not+valid!" })]) {
    await fs.writeFile(filePath, bad); await assert.rejects(store.saveProfile(input), /preserved/); assert.equal(await fs.readFile(filePath, "utf8"), bad);
  }
});
test("failed OS encryption leaves previous file unchanged and redacts unknown errors", async (t) => {
  const { store, filePath, safeStorage } = await fixture(t); await store.saveProfile(input); const original = await fs.readFile(filePath); safeStorage.encryptString = () => { throw new Error(input.key); };
  await assert.rejects(store.saveProfile(input), (error) => /encryption failed/.test(error.message) && !error.message.includes(input.key)); assert.deepEqual(await fs.readFile(filePath), original);
});
test("concurrent mutations serialize and preserve all saved profiles", async (t) => {
  const { store } = await fixture(t); await Promise.all(Array.from({ length: 12 }, (_, index) => store.saveProfile({ ...input, name: `Fixture ${index}` }))); assert.equal((await store.snapshot()).profiles.length, 12);
});
test("edit keeps existing key, explicit removal deletes key, and provider transfer requires consent", async (t) => {
  const { store } = await fixture(t); const id = (await store.saveProfile(input)).profiles[0].id;
  await store.saveProfile({ id, provider: "groq", name: "Renamed", model: "changed-model" }); assert.equal(await store.getServiceKey("groq"), input.key);
  await assert.rejects(store.saveProfile({ id, provider: "openai", name: "Moved" }), /new key|key removal/);
  await store.saveProfile({ id, provider: "openai", name: "Moved", clearKey: true }); assert.equal(await store.getServiceKey("groq"), ""); assert.equal(await store.getServiceKey("openai"), "");
  await assert.rejects(store.selectProfile(id), /Save a key/);
  await assert.rejects(store.saveProfile({ id, ...input, clearKey: true }), /either/);
});
test("changing a custom endpoint cannot silently transfer an existing key", async (t) => {
  const { store } = await fixture(t); const id = (await store.saveProfile({ provider: "openzero", name: "Test server", endpoint: "https://server.example", model: "model", key: input.key })).profiles[0].id;
  await assert.rejects(store.saveProfile({ id, provider: "openzero", name: "Test server", endpoint: "https://different.example", model: "model" }), /replacement key|key removal/);
  await store.saveProfile({ id, provider: "openzero", name: "Test server", endpoint: "https://different.example", model: "model", clearKey: true }); assert.equal(await store.getServiceKey("openzero"), "");
});
test("legacy server key lookup is bound to its exact expected endpoint", async (t) => {
  const { store } = await fixture(t);
  await store.saveProfile({ provider: "openzero", name: "Server A", endpoint: "https://a.example/v1", model: "model", key: "synthetic-key-a" });
  await store.saveProfile({ provider: "openzero", name: "Server B", endpoint: "https://b.example/prefix/v1", model: "model", key: "synthetic-key-b" });
  assert.equal(await store.getServiceKey("openzero", "https://a.example/v1/chat/completions"), "synthetic-key-a");
  assert.equal(await store.getServiceKey("openzero", "https://b.example/prefix/v1"), "synthetic-key-b");
  assert.equal(await store.getServiceKey("openzero", "https://unmatched.example/v1"), "");
  assert.equal(await store.getServiceKey("openzero", "https://b.example/v1"), "");
  await assert.rejects(store.getServiceKey("openzero", "https://a.example/v1?key=wrong"));
});
test("deleting active profile removes credential and clears selection", async (t) => {
  const { store } = await fixture(t); const id = (await store.saveProfile(input)).profiles[0].id; await store.selectProfile(id);
  await store.deleteProfile(id); assert.equal((await store.snapshot()).activeProfileId, null); assert.equal(await store.getActiveCompletion(), null); assert.equal(await store.getServiceKey("groq"), "");
});
test("non-chat service profiles cannot become the active language model", async (t) => {
  const { store } = await fixture(t); for (const provider of ["ionq", "ibm", "serper"]) { const saved = await store.saveProfile({ provider, key: `synthetic-${provider}-key` }); const id = saved.profiles.at(-1).id; await assert.rejects(store.selectProfile(id), /saved chat profile/); assert.equal(await store.getServiceKey(provider), `synthetic-${provider}-key`); }
});
test("legacy migration is idempotent, encrypted and preserves selected provider", async (t) => {
  const { store, filePath } = await fixture(t); const migrated = await store.migrateLegacy({ assistantProvider: "groq", model: "legacy-model", groqKey: input.key, openAiKey: "synthetic-openai", serperKey: "synthetic-search", openZeroAssistantMode: "local", unrelatedSecret: "discard" });
  assert.equal(migrated.profiles.length, 3); assert.equal(migrated.activeProfileId, "legacy-groq"); assert.equal((await store.getActiveCompletion()).model, "legacy-model"); assert.equal((await store.migrateLegacy({ groqKey: "changed" })).profiles.length, 3); assert.equal(await store.getServiceKey("groq"), input.key);
  await store.deleteProfile("legacy-groq"); await store.migrateLegacy({ groqKey: input.key }); assert.equal(await store.getServiceKey("groq"), ""); assert.equal((await fs.readFile(filePath, "utf8")).includes(input.key), false);
});
test("clear removes keys but prevents legacy resurrection", async (t) => {
  const { store } = await fixture(t); await store.migrateLegacy({ groqKey: input.key }); await store.clear(); await store.migrateLegacy({ groqKey: input.key }); assert.equal((await store.snapshot()).profiles.length, 0);
});
test("local OpenZero legacy route retains its optional server token without activating the server", async (t) => {
  const { store } = await fixture(t);
  const state = await store.migrateLegacy({ assistantProvider: "openzero", openZeroAssistantMode: "local", openZeroUrl: "https://self-hosted.example", model: "local-model", openZeroServerModel: "server-model", openZeroToken: input.key });
  assert.equal(state.profiles.length, 1); assert.equal(state.activeProfileId, null); assert.equal(state.profiles[0].provider, "openzero"); assert.equal(await store.getServiceKey("openzero"), input.key); assert.equal(await store.getActiveCompletion(), null);
});
test("invalid profile inputs never write keys or alter the vault", async (t) => {
  const { store, directory } = await fixture(t);
  for (const bad of [null, {}, { provider: "invented" }, { ...input, key: "key\nheader" }, { ...input, name: "x".repeat(81) }, { ...input, model: "../model?key=oops" }, { ...input, endpoint: "https://evil.example" }, { ...input, id: "../path" }, { ...input, id: "missing" }]) await assert.rejects(store.saveProfile(bad));
  assert.deepEqual(await fs.readdir(directory), []);
});
test("custom endpoints reject credential URLs, remote HTTP, metadata and unsupported paths", () => {
  for (const endpoint of ["https://key@server.example", "https://server.example?key=abc", "https://server.example#key", "http://remote.example", "http://localhost.evil.example", "https://169.254.169.254", "https://[fe80::1]", "https://0.0.0.0", "https://[::]", "https://server.example/admin", "file:///path"]) assert.throws(() => endpointFor("openzero", endpoint));
  assert.equal(endpointFor("openzero", "http://127.0.0.1:1234"), "http://127.0.0.1:1234/v1/chat/completions"); assert.equal(endpointFor("openzero", "https://server.example/prefix/v1"), "https://server.example/prefix/v1/chat/completions");
  assert.throws(() => normalizeProfile({ provider: "gemini", model: "https://evil.example" }));
});
test("compatible providers send their own key only to fixed endpoint headers", async () => {
  for (const provider of PROVIDERS.filter((entry) => entry.kind === "chat" && !["gemini", "anthropic"].includes(entry.id))) {
    const profile = { provider: provider.id, model: "test-model", key: input.key, endpoint: provider.id === "openzero" ? "https://user.example" : provider.endpoint };
    let recorded;
    const adapter = buildVaultCompletion(profile, { storeManaged: true, fetchImpl: async (url, options) => { recorded = { url, options }; return result(); } });
    assert.deepEqual(await adapter.complete({ messages, maxTokens: 1024 }), { content: "Fixture answer", model: "test-model", usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 } });
    assert.equal(recorded.options.redirect, "error"); assert.equal(recorded.options.headers.Authorization, `Bearer ${input.key}`); assert.equal(recorded.options.body.includes(input.key), false); assert.equal(recorded.url, provider.id === "openzero" ? "https://user.example/v1/chat/completions" : provider.endpoint);
    assert.equal(JSON.parse(recorded.options.body)[provider.id === "openai" ? "max_completion_tokens" : "max_tokens"], 1024);
  }
});
test("native Gemini separates system instructions, uses header key and excludes thought parts", async () => {
  let recorded;
  const adapter = buildVaultCompletion({ provider: "gemini", model: "models/gemini-2.5-flash", key: input.key }, { fetchImpl: async (url, options) => { recorded = { url, options }; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "private synthetic thought", thought: true }, { text: "Visible answer" }] } }], usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 6, thoughtsTokenCount: 3 } })); } });
  const value = await adapter.complete({ messages: [...messages, { role: "assistant", content: "Previous answer" }], maxTokens: 900 });
  assert.equal(value.content, "Visible answer"); assert.equal(value.usage.outputTokens, 9); assert.equal(recorded.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"); assert.equal(recorded.url.includes(input.key), false); assert.equal(recorded.options.headers["x-goog-api-key"], input.key);
  const body = JSON.parse(recorded.options.body); assert.equal(body.systemInstruction.parts[0].text, messages[0].content); assert.deepEqual(body.contents.map((entry) => entry.role), ["user", "model"]); assert.equal(body.generationConfig.maxOutputTokens, 900);
});
test("native Anthropic separates system, sends correct headers and reads text only", async () => {
  let recorded;
  const adapter = buildVaultCompletion({ provider: "anthropic", model: "claude-test-model", key: input.key }, { fetchImpl: async (url, options) => { recorded = { url, options }; return new Response(JSON.stringify({ content: [{ type: "thinking", thinking: "private thought" }, { type: "text", text: "Visible answer" }], usage: { input_tokens: 10, output_tokens: 5 } })); } });
  const value = await adapter.complete({ messages }); assert.equal(value.content, "Visible answer"); assert.equal(recorded.url, "https://api.anthropic.com/v1/messages"); assert.equal(recorded.options.headers["x-api-key"], input.key); assert.equal(recorded.options.headers["anthropic-version"], "2023-06-01"); assert.equal(JSON.parse(recorded.options.body).system, messages[0].content);
});
test("service and missing-key profiles are rejected before fetching", () => {
  for (const provider of ["ionq", "ibm", "serper"]) assert.throws(() => buildVaultCompletion({ provider, key: input.key }), /service/);
  for (const provider of PROVIDERS.filter((entry) => entry.kind === "chat" && entry.requiresKey)) assert.throws(() => buildVaultCompletion({ provider: provider.id }), /Save an API key/);
});
test("status errors and transport errors cannot reflect provider bodies, URLs or keys", async () => {
  for (const status of [301, 401, 403, 429, 500]) {
    const adapter = buildVaultCompletion({ ...input }, { fetchImpl: async () => new Response(JSON.stringify({ error: input.key }), { status }) });
    await assert.rejects(adapter.complete({ messages }), (error) => !error.message.includes(input.key) && !error.message.includes("api.groq"));
  }
  const adapter = buildVaultCompletion(input, { fetchImpl: async () => { throw new Error(`https://user:${input.key}@evil.example`); } }); await assert.rejects(adapter.complete({ messages }), (error) => /could not be reached/.test(error.message) && !error.message.includes(input.key));
});
test("limits, invalid message content and non-JSON replies fail safely", async () => {
  let calls = 0; const adapter = buildVaultCompletion(input, { fetchImpl: async () => { calls++; return result(); } });
  for (const request of [{}, { messages: [] }, { messages, maxTokens: 2049 }, { messages, signal: {} }, { messages: [{ role: "tool", content: "x" }] }, { messages: [{ role: "system", content: "only system" }] }, { messages: [{ role: "user", content: "a\0b" }] }]) await assert.rejects(adapter.complete(request));
  assert.equal(calls, 0);
  for (const response of [new Response("bad-json"), new Response(JSON.stringify({ choices: [{ message: { content: "<think>only hidden</think>" } }] })), new Response("x", { headers: { "content-length": "1048577" } }), new Response("x".repeat(1048577))]) { const engine = buildVaultCompletion(input, { fetchImpl: async () => response }); await assert.rejects(engine.complete({ messages })); }
});
test("pre-cancelled calls make no network request and in-flight cancellation rejects promptly", async () => {
  let calls = 0; const controller = new AbortController(); controller.abort(); const adapter = buildVaultCompletion(input, { signal: controller.signal, fetchImpl: async () => { calls++; return result(); } }); await assert.rejects(adapter.complete({ messages }), { name: "AbortError" }); assert.equal(calls, 0);
  const running = new AbortController(), slow = buildVaultCompletion(input, { fetchImpl: async () => new Promise(() => {}) }); const pending = slow.complete({ messages, signal: running.signal }); running.abort(); await assert.rejects(pending, { name: "AbortError" });
});
test("stage timeout rejects even when transport ignores cancellation", async () => {
  const adapter = buildVaultCompletion(input, { timeoutMs: 10, fetchImpl: async () => new Promise(() => {}) }); await assert.rejects(adapter.complete({ messages }), { name: "TimeoutError" });
});
