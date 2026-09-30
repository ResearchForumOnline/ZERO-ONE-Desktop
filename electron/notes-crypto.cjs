// Copyright 2026 Shafaet Brady Hussain. SPDX-License-Identifier: Apache-2.0
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes, randomUUID, createCipheriv, createDecipheriv, timingSafeEqual } = require("node:crypto");
const ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const MARKER = Buffer.from("ZNOTE2\0");

function decode(value, length) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error("Invalid encrypted notebook encoding.");
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || (length !== undefined && bytes.length !== length)) throw new Error("Invalid encrypted notebook encoding.");
  return bytes;
}
function header(value) {
  if (!value || value.version !== 2 || !ID.test(value.notebookId || "") || !Number.isSafeInteger(value.generation) || value.generation < 1 || typeof value.ciphertext !== "string" || value.ciphertext.length > 40 * 1024 * 1024) throw new Error("Invalid dual-key notebook format.");
  decode(value.nonce, 12); decode(value.tag, 16);
  return value;
}
function aad(envelope, layer) { return Buffer.from(`ZNotes:v2:${envelope.notebookId}:${envelope.generation}:${layer}`, "utf8"); }
function encrypt(bytes, key, associated) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(associated);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { nonce, tag: cipher.getAuthTag(), ciphertext };
}
function decrypt(ciphertext, key, nonce, tag, associated) {
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(associated); decipher.setAuthTag(tag);
  try { return Buffer.concat([decipher.update(ciphertext), decipher.final()]); }
  catch { throw new Error("ZNotes authentication failed. The encrypted notebook was not changed."); }
}

function createNotesEncryption({ filePath, storage }) {
  const keysDirectory = `${filePath}.keys`;
  const keyPath = (id, layer) => { if (!ID.test(id)) throw new Error("Invalid notebook identifier."); return path.join(keysDirectory, `${id}-${layer}.oskey`); };
  async function loadKey(id, layer) {
    const target = keyPath(id, layer);
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw new Error("A protected notebook key file is invalid.");
    const value = JSON.parse(await fs.readFile(target, "utf8"));
    if (value.version !== 1 || value.notebookId !== id || value.layer !== layer) throw new Error("A protected notebook key does not match this notebook.");
    return decode(storage.decryptString(decode(value.wrapped)), 32);
  }
  async function loadKeys(id) {
    const directory = await fs.lstat(keysDirectory);
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error("The notebook key directory is invalid.");
    const inner = await loadKey(id, "inner");
    let outer;
    try {
      outer = await loadKey(id, "outer");
      if (timingSafeEqual(inner, outer)) throw new Error("Notebook encryption keys must be independent.");
      return { inner, outer };
    } catch (error) { inner.fill(0); outer?.fill(0); throw error; }
  }
  async function writeKey(id, layer, key) {
    const target = keyPath(id, layer);
    const wrapped = storage.encryptString(key.toString("base64")).toString("base64");
    const handle = await fs.open(target, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify({ version: 1, notebookId: id, layer, wrapped }), "utf8"); await handle.sync(); }
    finally { await handle.close(); }
  }
  async function initialize() {
    await fs.mkdir(keysDirectory, { recursive: true, mode: 0o700 });
    const directory = await fs.lstat(keysDirectory);
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error("The notebook key directory is invalid.");
    const id = randomUUID(); const inner = randomBytes(32); const outer = randomBytes(32);
    try {
      if (timingSafeEqual(inner, outer)) throw new Error("Notebook encryption keys must be independent.");
      await writeKey(id, "inner", inner); await writeKey(id, "outer", outer);
      return id;
    } catch (error) { await Promise.all(["inner", "outer"].map(layer => fs.rm(keyPath(id, layer), { force: true }))); throw error; }
    finally { inner.fill(0); outer.fill(0); }
  }
  return {
    async seal(plain, previous) {
      const isNew = previous?.version !== 2;
      const id = isNew ? await initialize() : header(previous).notebookId;
      let keys;
      try {
        keys = await loadKeys(id);
        const envelope = { version: 2, notebookId: id, generation: isNew ? 1 : previous.generation + 1 };
        if (!Number.isSafeInteger(envelope.generation)) throw new Error("The notebook generation limit was reached.");
        const inner = encrypt(Buffer.from(plain, "utf8"), keys.inner, aad(envelope, "inner"));
        const innerEnvelope = Buffer.concat([MARKER, inner.nonce, inner.tag, inner.ciphertext]);
        const outer = encrypt(innerEnvelope, keys.outer, aad(envelope, "outer"));
        return { envelope: { ...envelope, nonce: outer.nonce.toString("base64"), tag: outer.tag.toString("base64"), ciphertext: outer.ciphertext.toString("base64") }, createdKeys: isNew ? id : null };
      } catch (error) {
        if (isNew) await Promise.all(["inner", "outer"].map(layer => fs.rm(keyPath(id, layer), { force: true })));
        throw error;
      } finally { keys?.inner.fill(0); keys?.outer.fill(0); }
    },
    async open(value) {
      const envelope = header(value);
      const keys = await loadKeys(envelope.notebookId);
      try {
        const packed = decrypt(decode(envelope.ciphertext), keys.outer, decode(envelope.nonce, 12), decode(envelope.tag, 16), aad(envelope, "outer"));
        if (packed.length < MARKER.length + 28 || !packed.subarray(0, MARKER.length).equals(MARKER)) throw new Error("Invalid inner notebook format.");
        const offset = MARKER.length;
        const plain = decrypt(packed.subarray(offset + 28), keys.inner, packed.subarray(offset, offset + 12), packed.subarray(offset + 12, offset + 28), aad(envelope, "inner"));
        try { return new TextDecoder("utf-8", { fatal: true }).decode(plain); }
        finally { plain.fill(0); packed.fill(0); }
      } finally { keys.inner.fill(0); keys.outer.fill(0); }
    },
    async removeCreatedKeys(id) { if (id) await Promise.all(["inner", "outer"].map(layer => fs.rm(keyPath(id, layer), { force: true }))); },
  };
}
module.exports = { createNotesEncryption };
