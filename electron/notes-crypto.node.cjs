"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomBytes, randomUUID, createCipheriv, createDecipheriv } = require("node:crypto");
const { createNotesStore } = require("./notes-store.cjs");
const { createNotesEncryption } = require("./notes-crypto.cjs");

function fakeOperatingSystemStorage() {
  const master = randomBytes(32);
  return {
    encryptString(value) { const nonce = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", master, nonce); const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]); },
    decryptString(value) { const decipher = createDecipheriv("aes-256-gcm", master, value.subarray(0, 12)); decipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8"); },
  };
}
async function fixture(action) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "znotes-dual-"));
  const filePath = path.join(directory, "notes.encrypted.json"); const storage = fakeOperatingSystemStorage();
  const store = createNotesStore({ filePath, storage, secure: () => true });
  try { await action({ directory, filePath, storage, store }); } finally { await fs.rm(directory, { recursive: true, force: true }); }
}
const sample = () => ({ id: randomUUID(), title: "Synthetic protected note", content: "Fixture private content" });
async function keysFor(filePath, envelope, storage) {
  const result = {};
  for (const layer of ["inner", "outer"]) {
    const filename = path.join(`${filePath}.keys`, `${envelope.notebookId}-${layer}.oskey`);
    const raw = await fs.readFile(filename, "utf8"); const record = JSON.parse(raw);
    result[layer] = { filename, raw, record, bytes: Buffer.from(storage.decryptString(Buffer.from(record.wrapped, "base64")), "base64") };
  }
  return result;
}

test("new notebooks automatically use two distinct keys and fresh authenticated nonces", async () => fixture(async ({ filePath, storage, store }) => {
  assert.equal((await store.encryptionStatus()).version, 0);
  const note = sample(); await store.save(note);
  const initial = JSON.parse(await fs.readFile(filePath, "utf8"));
  assert.equal(initial.version, 2); assert.equal(initial.generation, 1);
  const keys = await keysFor(filePath, initial, storage);
  assert.equal(keys.inner.bytes.length, 32); assert.equal(keys.outer.bytes.length, 32); assert.ok(!keys.inner.bytes.equals(keys.outer.bytes));
  const status = await store.encryptionStatus(); assert.equal(status.layers, 2); assert.equal(status.keys, 2); assert.equal(status.custody, "os-account"); assert.match(status.message, /not two-factor/);
  await store.save({ ...note, content: "Second fixture" });
  const next = JSON.parse(await fs.readFile(filePath, "utf8"));
  assert.equal(next.notebookId, initial.notebookId); assert.equal(next.generation, 2); assert.notEqual(next.nonce, initial.nonce); assert.notEqual(next.ciphertext, initial.ciphertext);
  assert.equal((await store.list())[0].content, "Second fixture");
  assert.ok(!(await fs.readFile(filePath, "utf8")).includes("Second fixture"));
}));

test("legacy encrypted notes remain unchanged on read and migrate with an exact encrypted backup on save", async () => fixture(async ({ filePath, storage, store }) => {
  const note = sample(); const legacy = JSON.stringify({ version: 1, encrypted: storage.encryptString(JSON.stringify([note])).toString("base64") });
  await fs.writeFile(filePath, legacy);
  assert.equal((await store.list())[0].content, note.content); assert.equal((await store.encryptionStatus()).version, 1);
  assert.equal(await fs.readFile(filePath, "utf8"), legacy);
  await store.save({ ...note, title: "Migrated fixture" });
  assert.equal(await fs.readFile(`${filePath}.legacy-v1.bak`, "utf8"), legacy);
  assert.equal(JSON.parse(await fs.readFile(filePath, "utf8")).version, 2);
  assert.equal((await store.encryptionStatus()).legacyBackup, true);
  const restarted = createNotesStore({ filePath, storage, secure: () => true });
  assert.equal((await restarted.list())[0].content, note.content); assert.equal((await restarted.list())[0].title, "Migrated fixture");
}));

test("wrong or equal keys fail closed and do not overwrite the notebook", async () => fixture(async ({ filePath, storage, store }) => {
  await store.save(sample()); const raw = await fs.readFile(filePath, "utf8"); const envelope = JSON.parse(raw); const keys = await keysFor(filePath, envelope, storage);
  for (const layer of ["inner", "outer"]) {
    const changed = { ...keys[layer].record, wrapped: storage.encryptString(randomBytes(32).toString("base64")).toString("base64") };
    await fs.writeFile(keys[layer].filename, JSON.stringify(changed));
    await assert.rejects(store.list(), /authentication/);
    await assert.rejects(store.save(sample()));
    assert.equal(await fs.readFile(filePath, "utf8"), raw);
    await fs.writeFile(keys[layer].filename, keys[layer].raw);
  }
  const same = { ...keys.inner.record, wrapped: storage.encryptString(keys.outer.bytes.toString("base64")).toString("base64") };
  await fs.writeFile(keys.inner.filename, JSON.stringify(same));
  await assert.rejects(store.list(), /independent/);
}));

test("authenticated headers, tags and ciphertext reject tampering", async () => fixture(async ({ filePath, storage, store }) => {
  await store.save(sample()); const envelope = JSON.parse(await fs.readFile(filePath, "utf8"));
  const encryption = createNotesEncryption({ filePath, storage });
  for (const altered of [{ ...envelope, generation: envelope.generation + 1 }, { ...envelope, notebookId: randomUUID() }, { ...envelope, tag: randomBytes(16).toString("base64") }, { ...envelope, ciphertext: randomBytes(100).toString("base64") }, { ...envelope, nonce: "bad" }]) await assert.rejects(encryption.open(altered));
}));

test("a valid outer layer cannot hide tampering with the inner layer", async () => fixture(async ({ filePath, storage, store }) => {
  await store.save(sample()); const envelope = JSON.parse(await fs.readFile(filePath, "utf8")); const keys = await keysFor(filePath, envelope, storage);
  const aad = Buffer.from(`ZNotes:v2:${envelope.notebookId}:${envelope.generation}:outer`);
  const decipher = createDecipheriv("aes-256-gcm", keys.outer.bytes, Buffer.from(envelope.nonce, "base64")); decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const inner = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  inner[7 + 12] ^= 1;
  const nonce = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", keys.outer.bytes, nonce); cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(inner), cipher.final()]);
  const altered = { ...envelope, nonce: nonce.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
  await assert.rejects(createNotesEncryption({ filePath, storage }).open(altered), /authentication/);
}));

test("missing key files cannot turn an existing encrypted notebook into an empty new notebook", async () => fixture(async ({ filePath, storage, store }) => {
  await store.save(sample()); const raw = await fs.readFile(filePath, "utf8"); const keys = await keysFor(filePath, JSON.parse(raw), storage);
  await fs.rm(keys.inner.filename);
  await assert.rejects(store.list()); await assert.rejects(store.save(sample())); await assert.rejects(store.encryptionStatus());
  assert.equal(await fs.readFile(filePath, "utf8"), raw);
}));

test("failed atomic migration keeps the legacy source and encrypted backup intact", async () => fixture(async ({ filePath, storage, store }) => {
  const note = sample(); const legacy = JSON.stringify({ version: 1, encrypted: storage.encryptString(JSON.stringify([note])).toString("base64") }); await fs.writeFile(filePath, legacy);
  const rename = fs.rename;
  fs.rename = async () => { const error = new Error("Synthetic atomic commit error"); error.code = "EACCES"; throw error; };
  try { await assert.rejects(store.save({ ...note, content: "Changed fixture" }), /Synthetic/); }
  finally { fs.rename = rename; }
  assert.equal(await fs.readFile(filePath, "utf8"), legacy); assert.equal(await fs.readFile(`${filePath}.legacy-v1.bak`, "utf8"), legacy);
  assert.deepEqual(await fs.readdir(`${filePath}.keys`), []);
  assert.equal((await store.list())[0].content, note.content);
}));

test("invalid legacy contents are retained and never receive a migration backup or keys", async () => fixture(async ({ directory, filePath, storage, store }) => {
  const legacy = JSON.stringify({ version: 1, encrypted: storage.encryptString(JSON.stringify([{ id: "invalid" }])).toString("base64") }); await fs.writeFile(filePath, legacy);
  await assert.rejects(store.save(sample())); assert.equal(await fs.readFile(filePath, "utf8"), legacy);
  assert.deepEqual(await fs.readdir(directory), ["notes.encrypted.json"]);
}));
