const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID, createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
const { createNotesStore } = require('./notes-store.cjs');
test('notes persist encrypted, serialize concurrent saves and preserve unrelated notes on delete', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'zero-one-notes-'));
  const key = randomBytes(32);
  const storage = {
    encryptString(value) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), encrypted]); },
    decryptString(buffer) { const decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12)); decipher.setAuthTag(buffer.subarray(12, 28)); return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8'); },
  };
  const filePath = path.join(directory, 'notes.json');
  const options = { filePath, storage, secure: () => true };
  try {
    const store = createNotesStore(options);
    const input = Array.from({ length: 12 }, (_, index) => ({ id: randomUUID(), title: `Note ${index}`, content: `private sentence ${index}` }));
    await Promise.all(input.map((note) => store.save(note)));
    assert.equal((await createNotesStore(options).list()).length, 12);
    assert.ok(!(await fs.readFile(filePath, 'utf8')).includes('private sentence'));
    await store.remove(input[0].id); assert.equal((await store.list()).length, 11);
    await assert.rejects(store.save({ ...input[0], content: 'x'.repeat(500001) }));
    await assert.rejects(createNotesStore({ ...options, secure: () => false }).save(input[0]));
    await fs.writeFile(filePath, '{broken'); await assert.rejects(store.save(input[0]));
    assert.equal(await fs.readFile(filePath, 'utf8'), '{broken');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
