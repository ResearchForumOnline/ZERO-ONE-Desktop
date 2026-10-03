"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID, randomBytes, createCipheriv, createDecipheriv } = require("node:crypto");
const { BUILTIN_TEMPLATES, createTemplateStore, normalizeTemplate, renderTemplate, MAX_CUSTOM } = require("./zerothink-templates.cjs");
function syntheticStorage() {
  const key = randomBytes(32);
  return { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => "test_encrypted_fixture", encryptString: (text) => { const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, nonce); const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]); return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]); }, decryptString: (data) => { const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"); } };
}
async function setup(t) { const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zt-templates-")); t.after(() => fs.rm(directory, { recursive: true, force: true })); const options = { filePath: path.join(directory, "templates.encrypted.json"), safeStorage: syntheticStorage() }; return { ...options, store: createTemplateStore(options), options }; }
const custom = (name = "SYNTHETIC_PRIVATE_WORKFLOW") => ({ name, description: "Synthetic workflow description", kind: "custom", processId: "custom", stages: ["Inspect selected sources", "Review missing evidence"], requiredSources: ["Selected notes"], validationChecks: ["Do not invent citations"] });

test("built-in paper, original review, scenario and custom workflows have public stages", () => {
  assert.equal(BUILTIN_TEMPLATES.length, 13); assert.ok(BUILTIN_TEMPLATES.some((item) => item.kind === "paper")); assert.ok(BUILTIN_TEMPLATES.some((item) => item.kind === "scenario"));
  assert.ok(BUILTIN_TEMPLATES.every((item) => item.builtIn && item.stages.length && item.validationChecks.length));
  assert.throws(() => normalizeTemplate({ ...custom(), id: "builtin-paper" }), /custom template identifiers/);
});
test("custom templates encrypt on disk and survive reopening", async (t) => {
  const { store, options, filePath } = await setup(t); const saved = await store.save(custom()); assert.equal(saved.builtIn, false);
  const onDisk = await fs.readFile(filePath, "utf8"); assert.doesNotMatch(onDisk, /SYNTHETIC_PRIVATE_WORKFLOW|Synthetic workflow description|Inspect selected sources/);
  const reopened = createTemplateStore(options); const list = await reopened.list(); assert.equal(list.length, 14); assert.deepEqual(list.find((item) => item.id === saved.id), saved);
});
test("editing and deleting custom workflows retain built-ins", async (t) => {
  const { store } = await setup(t); const saved = await store.save(custom()); const edited = await store.save({ ...saved, name: "Edited synthetic template" }); assert.equal(edited.id, saved.id);
  assert.equal((await store.list()).find((item) => item.id === saved.id).name, "Edited synthetic template"); assert.equal(await store.delete(saved.id), true); assert.equal(await store.delete(saved.id), false); assert.equal((await store.list()).length, 13);
  await assert.rejects(store.delete("builtin-paper"), /cannot be deleted/); await assert.rejects(store.save({ ...custom(), builtIn: true }), /cannot be overwritten/);
});
test("concurrent saves serialize and do not lose custom workflows", async (t) => { const { store } = await setup(t); await Promise.all(Array.from({ length: 8 }, (_, index) => store.save(custom(`Synthetic workflow ${index}`)))); const list = await store.list(); assert.equal(list.filter((item) => !item.builtIn).length, 8); });
test("unavailable or basic-text secure storage never creates plaintext", async (t) => {
  const { filePath, safeStorage } = await setup(t);
  for (const storage of [{ ...safeStorage, isEncryptionAvailable: () => false }, { ...safeStorage, getSelectedStorageBackend: () => "basic_text" }]) { const store = createTemplateStore({ filePath, safeStorage: storage }); await assert.rejects(store.save(custom()), /Secure operating-system storage/); await assert.rejects(store.list(), /Secure operating-system storage/); }
  await assert.rejects(fs.stat(filePath), { code: "ENOENT" });
});
test("corrupt ciphertext is preserved on read and save failure", async (t) => {
  const { filePath, store } = await setup(t); await store.save(custom()); const envelope = JSON.parse(await fs.readFile(filePath, "utf8")), binary = Buffer.from(envelope.encrypted, "base64"); binary[binary.length - 1] ^= 1;
  const corrupted = JSON.stringify({ ...envelope, encrypted: binary.toString("base64") }); await fs.writeFile(filePath, corrupted); await assert.rejects(store.list()); await assert.rejects(store.save(custom("Second synthetic"))); assert.equal(await fs.readFile(filePath, "utf8"), corrupted);
});
test("invalid encrypted template schema is preserved and not replaced", async (t) => {
  const { filePath, safeStorage, store } = await setup(t); const invalid = { version: 1, templates: [{ ...custom(), updatedAt: new Date().toISOString() }] };
  const original = JSON.stringify({ version: 1, encrypted: safeStorage.encryptString(JSON.stringify(invalid)).toString("base64") }); await fs.writeFile(filePath, original);
  await assert.rejects(store.list(), /identifiers/); await assert.rejects(store.save(custom())); assert.equal(await fs.readFile(filePath, "utf8"), original);
});
test("validation failures do not break the write queue", async (t) => {
  const { store } = await setup(t); await assert.rejects(store.save({ ...custom(), stages: [] }), /at least one/); await store.save(custom()); assert.equal((await store.list()).length, 14);
});
test("custom template counts and field sizes are bounded", async (t) => {
  const { store } = await setup(t); for (let index = 0; index < MAX_CUSTOM; index++) await store.save(custom(`Synthetic ${index}`)); await assert.rejects(store.save(custom("Extra")), /32 custom/);
  assert.throws(() => normalizeTemplate({ ...custom(), description: "x".repeat(601) }), /description/); assert.throws(() => normalizeTemplate({ ...custom(), stages: Array(13).fill("Inspect") }), /12 entries/); assert.throws(() => normalizeTemplate({ ...custom(), name: "\0" }), /template name/); assert.throws(() => normalizeTemplate({ ...custom(), processId: "unknown" }), /supported research/);
});
test("paper rendering creates source-labelled instructions without invented results", () => {
  const output = renderTemplate({ templateId: "builtin-paper", fields: { title: "Synthetic study", problem: "Compare supplied notes", method: "An experiment is proposed", evidence: "No experimental results supplied", limitations: "No full text", audience: "Researcher" } });
  assert.equal(output.processId, "paper-draft"); assert.equal(output.title, "Synthetic study"); assert.match(output.question, /supplied source IDs|source IDs assigned/); assert.match(output.question, /not independently verified/); assert.match(output.question, /Unperformed experiments remain proposed methods/); assert.match(output.question, /model-assisted drafting/); assert.match(output.question, /No experimental results supplied/);
});
test("scenario rendering separates observed outcomes and refuses fake probability assurances", () => {
  const output = renderTemplate({ templateId: "builtin-scenario", fields: { title: "Synthetic decision", baseline: "Option A or B", observations: "No measurements yet", horizon: "Thirty days" } });
  assert.match(output.question, /Do not invent a calibrated probability or confidence percentage/); assert.match(output.question, /No measurements yet/); assert.match(output.question, /disconfirming/); assert.equal(output.processId, "claim-ledger");
});
test("custom rendering rejects mismatched IDs and unsafe field sizes", () => {
  const template = normalizeTemplate(custom()); const output = renderTemplate({ templateId: template.id, template, fields: { problem: "Question", notes: "User notes" } }); assert.equal(output.processId, "custom"); assert.match(output.question, /Inspect selected sources/);
  assert.throws(() => renderTemplate({ templateId: randomUUID(), template, fields: { title: "Question" } }), /unavailable/); assert.throws(() => renderTemplate({ fields: { title: "x".repeat(181) } }), /180/); assert.throws(() => renderTemplate({ fields: {} }), /title or a research question/); assert.throws(() => renderTemplate({ kind: "unknown", fields: { title: "Q" } }), /supported template kind/);
});
test("assembled research question respects the executor's total limit", () => {
  const fields = { title: "Q", problem: "x".repeat(1800), method: "x".repeat(1800), evidence: "x".repeat(1800), limitations: "x".repeat(1200), notes: "x".repeat(1800), observations: "x".repeat(1800), outcome: "x".repeat(1000), baseline: "x".repeat(1000) };
  assert.throws(() => renderTemplate({ fields }), /12,000/);
});
test("mutating returned templates never changes built-in instructions", async (t) => { const { store } = await setup(t); const list = await store.list(); list[0].stages[0] = "Synthetic replacement"; list[0].name = "Synthetic replacement"; const next = await store.list(); assert.notEqual(next[0].stages[0], "Synthetic replacement"); assert.notEqual(next[0].name, "Synthetic replacement"); });
