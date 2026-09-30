const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID, createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
const { createNotesStore } = require('./notes-store.cjs');
const { normalizeNote } = require('./notes-store.cjs');

test('legacy notebooks gain compatible metadata without losing text', () => {
  const id = randomUUID();
  const normalized = normalizeNote({ id, title: 'Legacy research', content: 'Original private text', updatedAt: '2026-09-01T12:00:00Z' });
  assert.equal(normalized.content, 'Original private text');
  assert.equal(normalized.id, id);
  assert.equal(normalized.pinned, false);
  assert.equal(normalized.state, 'active');
  assert.equal(normalized.color, 'midnight');
  assert.deepEqual(normalized.checklist, []);
  assert.deepEqual(normalized.labels, []);
});

test('note metadata validates exact booleans, unique checklist identifiers and bounded labels', () => {
  const base = { id: randomUUID(), title: 'Tasks', content: '' };
  assert.throws(() => normalizeNote({ ...base, pinned: 'true' }), /boolean/);
  const item = { id: randomUUID(), text: 'Task', done: false };
  assert.throws(() => normalizeNote({ ...base, checklist: [item, item] }), /checklist/);
  assert.throws(() => normalizeNote({ ...base, checklist: [{ ...item, done: 1 }] }), /checklist/);
  assert.throws(() => normalizeNote({ ...base, labels: ['a'.repeat(81)] }), /labels/);
  assert.throws(() => normalizeNote({ ...base, state: 'deleted' }), /state/);
  assert.throws(() => normalizeNote({ ...base, color: 'pink' }), /colour/);
});
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
    const enriched = await store.save({ ...input[1], pinned: true, color: 'teal', labels: ['Research'], state: 'archived', checklist: [{ id: randomUUID(), text: 'Review source', done: true }] });
    await store.save({ id: enriched.id, title: 'Edited legacy writer', content: 'Text edit' });
    const preserved = (await store.list()).find(note => note.id === enriched.id);
    assert.equal(preserved.pinned, true);
    assert.equal(preserved.color, 'teal');
    assert.equal(preserved.state, 'archived');
    assert.deepEqual(preserved.labels, ['Research']);
    assert.equal(preserved.checklist[0].done, true);
    const imported = await store.import({ notes: [{ id: enriched.id, title: 'Original hosted export', body: 'Imported text', pinned: true, color: 'violet', labels: ['Restored'], state: 'active', version: 4, createdAt: '2026-07-01T12:00:00Z', reminder: { start: '2026-10-01T12:00:00', timeZone: 'Europe/London', reminderMinutes: 15 }, checklist: [{ id: randomUUID(), text: 'Imported task', done: false }] }] });
    assert.equal(imported.imported, 1);
    const all = await store.list();
    assert.equal(all.length, 12);
    assert.equal(all[0].content, 'Imported text');
    assert.notEqual(all[0].id, enriched.id);
    assert.equal(all[0].labels[0], 'Restored');
    assert.equal(all[0].sourceVersion, 4);
    assert.equal(all[0].createdAt, '2026-07-01T12:00:00Z');
    assert.equal(all[0].reminder.timeZone, 'Europe/London');
    await store.save({ id: all[0].id, title: 'Edited import', content: 'Updated import' });
    assert.equal((await store.list()).find(note => note.id === all[0].id).reminder.start, '2026-10-01T12:00:00');
    assert.equal(all.filter(note => note.id === enriched.id).length, 1);
    const beforeBadImport = await fs.readFile(filePath, 'utf8');
    await assert.rejects(store.import({ notes: [{ title: 'valid', content: 'valid' }, { title: 'invalid', content: 123 }] }));
    assert.equal(await fs.readFile(filePath, 'utf8'), beforeBadImport);
    await assert.rejects(store.remove('bad-id'));
    await assert.rejects(store.save({ ...input[0], content: 'x'.repeat(500001) }));
    await assert.rejects(createNotesStore({ ...options, secure: () => false }).save(input[0]));
    await fs.writeFile(filePath, '{broken'); await assert.rejects(store.save(input[0]));
    assert.equal(await fs.readFile(filePath, 'utf8'), '{broken');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
