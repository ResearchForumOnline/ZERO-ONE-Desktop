const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function createNotesStore({ filePath, storage, secure }) {
  let queue = Promise.resolve();
  const checkStorage = () => { if (!secure()) throw new Error('Secure operating-system storage is unavailable; ZNotes was not changed.'); };
  function validate(note) {
    if (!note || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(note.id || '')) throw new Error('Invalid note identifier.');
    if (typeof note.title !== 'string' || typeof note.content !== 'string' || note.content.length > 500000) throw new Error('Invalid note content or note exceeds 500,000 characters.');
    return { id: note.id, title: note.title.slice(0, 160) || 'Untitled', content: note.content, updatedAt: note.updatedAt };
  }
  async function read() {
    checkStorage();
    try {
      const envelope = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (envelope.version !== 1 || typeof envelope.encrypted !== 'string') throw new Error('Invalid ZNotes notebook format.');
      const notes = JSON.parse(storage.decryptString(Buffer.from(envelope.encrypted, 'base64')));
      if (!Array.isArray(notes) || notes.length > 1000) throw new Error('Invalid ZNotes notebook.');
      return notes.map(validate);
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  async function write(notes) {
    checkStorage();
    const encrypted = storage.encryptString(JSON.stringify(notes)).toString('base64');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temporary, JSON.stringify({ version: 1, encrypted }), { encoding: 'utf8', mode: 0o600 }); await fs.rename(temporary, filePath); }
    finally { await fs.rm(temporary, { force: true }); }
  }
  function mutate(action) { const pending = queue.then(action); queue = pending.catch(() => {}); return pending; }
  return {
    list: async () => { await queue; return read(); },
    save: (input) => mutate(async () => {
      const note = validate({ ...input, updatedAt: new Date().toISOString() });
      const notes = await read();
      const index = notes.findIndex((item) => item.id === note.id);
      if (index >= 0) notes[index] = note; else { if (notes.length >= 1000) throw new Error('This notebook has reached the 1,000 note limit.'); notes.unshift(note); }
      await write(notes); return note;
    }),
    remove: (id) => mutate(async () => { await write((await read()).filter((note) => note.id !== id)); return true; }),
  };
}
module.exports = { createNotesStore };
