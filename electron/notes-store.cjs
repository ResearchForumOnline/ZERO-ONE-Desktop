const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createNotesEncryption } = require('./notes-crypto.cjs');

const COLORS = ['midnight', 'violet', 'blue', 'teal', 'green', 'amber', 'rose'];
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const NOTEBOOK_BYTES = 20 * 1024 * 1024;

function normalizeNote(note) {
  if (!note || !UUID.test(note.id || '')) throw new Error('Invalid note identifier.');
  if (typeof note.title !== 'string' || typeof note.content !== 'string' || note.content.length > 500000) throw new Error('Invalid note content or note exceeds 500,000 characters.');
  if (note.pinned !== undefined && typeof note.pinned !== 'boolean') throw new Error('The pinned value must be a boolean.');
  const state = note.state ?? 'active';
  if (!['active', 'archived', 'trash'].includes(state)) throw new Error('Invalid note state.');
  const color = note.color ?? 'midnight';
  if (!COLORS.includes(color)) throw new Error('Invalid note colour.');
  const labels = note.labels ?? [];
  if (!Array.isArray(labels) || labels.length > 20 || labels.some(label => typeof label !== 'string' || label.length > 80)) throw new Error('Use up to 20 labels, 80 characters each.');
  const checklist = note.checklist ?? [];
  if (!Array.isArray(checklist) || checklist.length > 100) throw new Error('A checklist accepts up to 100 items.');
  const ids = new Set();
  const items = checklist.map(item => {
    if (!item || !UUID.test(item.id || '') || ids.has(item.id) || typeof item.text !== 'string' || item.text.length > 4000 || typeof item.done !== 'boolean') throw new Error('Invalid checklist item.');
    ids.add(item.id);
    return { id: item.id, text: item.text, done: item.done };
  });
  let reminder = null;
  if (note.reminder != null) {
    const value = note.reminder;
    if (!value || typeof value.start !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value.start) || !Number.isFinite(Date.parse(`${value.start}Z`)) || new Date(`${value.start}Z`).toISOString().slice(0, 19) !== value.start || typeof value.timeZone !== 'string' || value.timeZone.length > 64 || ![5, 10, 15, 30, 60, 120, 1440].includes(value.reminderMinutes)) throw new Error('Invalid imported calendar reminder record.');
    try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); } catch { throw new Error('Invalid imported reminder time zone.'); }
    reminder = { start: value.start, timeZone: value.timeZone, reminderMinutes: value.reminderMinutes };
  }
  const result = { id: note.id, title: note.title.slice(0, 160) || 'Untitled', content: note.content, updatedAt: typeof note.updatedAt === 'string' && Number.isFinite(Date.parse(note.updatedAt)) ? note.updatedAt : new Date().toISOString(), pinned: note.pinned ?? false, state, color, labels: [...new Set(labels.map(label => label.trim()).filter(Boolean))], checklist: items, reminder };
  for (const field of ['createdAt', 'deletedAt']) if (typeof note[field] === 'string' && Number.isFinite(Date.parse(note[field]))) result[field] = note[field];
  if (Number.isInteger(note.sourceVersion) && note.sourceVersion > 0) result.sourceVersion = note.sourceVersion;
  return result;
}

function createNotesStore({ filePath, storage, secure }) {
  let queue = Promise.resolve();
  const encryption = createNotesEncryption({ filePath, storage });
  const checkStorage = () => { if (!secure()) throw new Error('Secure operating-system storage is unavailable; ZNotes was not changed.'); };
  async function readState() {
    checkStorage();
    let notebookLocated = false;
    try {
      const info = await fs.stat(filePath);
      notebookLocated = true;
      if (info.size > NOTEBOOK_BYTES * 2) throw new Error('The encrypted notebook exceeds the supported size; it was not changed.');
      const raw = await fs.readFile(filePath, 'utf8');
      const envelope = JSON.parse(raw);
      if (![1, 2].includes(envelope.version) || (envelope.version === 1 && typeof envelope.encrypted !== 'string')) throw new Error('Invalid ZNotes notebook format.');
      const plain = envelope.version === 2 ? await encryption.open(envelope) : storage.decryptString(Buffer.from(envelope.encrypted, 'base64'));
      const notes = JSON.parse(plain);
      if (!Array.isArray(notes) || notes.length > 1000) throw new Error('Invalid ZNotes notebook.');
      const normalized = notes.map(normalizeNote);
      if (new Set(normalized.map(note => note.id)).size !== normalized.length) throw new Error('The notebook contains duplicate note identifiers; it was not changed.');
      return { notes: normalized, envelope, raw };
    } catch (error) {
      // Missing key files must never be mistaken for a missing notebook.
      if (error.code === 'ENOENT' && !notebookLocated) return { notes: [], envelope: null, raw: null };
      throw error;
    }
  }
  async function write(notes, previous) {
    checkStorage();
    const plain = JSON.stringify(notes);
    if (Buffer.byteLength(plain, 'utf8') > NOTEBOOK_BYTES) throw new Error('This notebook has reached its 20 MB text limit. Export and remove notes before adding more.');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    if (previous.envelope?.version === 1) {
      const backup = `${filePath}.legacy-v1.bak`;
      try {
        const handle = await fs.open(backup, 'wx', 0o600);
        try { await handle.writeFile(previous.raw, 'utf8'); await handle.sync(); }
        finally { await handle.close(); }
      } catch (error) {
        if (error.code !== 'EEXIST' || await fs.readFile(backup, 'utf8') !== previous.raw) throw new Error('The legacy encrypted backup could not be retained. The notebook was not changed.');
      }
    }
    const sealed = await encryption.seal(plain, previous.envelope);
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    let committed = false;
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(sealed.envelope), 'utf8'); await handle.sync(); }
      finally { await handle.close(); }
      await fs.rename(temporary, filePath);
      committed = true;
    }
    finally { await fs.rm(temporary, { force: true }); if (!committed) await encryption.removeCreatedKeys(sealed.createdKeys); }
  }
  function mutate(action) { const pending = queue.then(action); queue = pending.catch(() => {}); return pending; }
  return {
    list: async () => { await queue; return (await readState()).notes; },
    encryptionStatus: async () => {
      await queue;
      const current = await readState();
      const version = current.envelope?.version ?? 0;
      const backup = await fs.lstat(`${filePath}.legacy-v1.bak`).catch(() => null);
      const legacyBackup = Boolean(backup?.isFile() && !backup.isSymbolicLink());
      return { version, layers: version === 2 ? 2 : version === 1 ? 1 : 0, keys: version === 2 ? 2 : version === 1 ? 1 : 0, custody: 'os-account', legacyBackup, message: version === 2 ? 'Two AES-256-GCM layers use independent random keys in separate OS-protected key files. Your OS account unlocks both keys; this is not two-factor authentication.' : version === 1 ? 'This existing notebook uses OS encryption. Its next successful save upgrades it to two independent AES-256-GCM keys and preserves an encrypted legacy backup.' : 'No notebook saved yet. New notes automatically use two independent AES-256-GCM keys, both protected by your OS account.' };
    },
    save: (input) => mutate(async () => {
      const previous = await readState();
      const notes = previous.notes;
      const index = notes.findIndex((item) => item.id === input?.id);
      // Older writers omit metadata; text updates must preserve labels and pins.
      const note = normalizeNote({ ...(index >= 0 ? notes[index] : {}), ...input, updatedAt: new Date().toISOString() });
      if (index >= 0) notes[index] = note; else { if (notes.length >= 1000) throw new Error('This notebook has reached the 1,000 note limit.'); notes.unshift(note); }
      await write(notes, previous); return note;
    }),
    import: (input) => mutate(async () => {
      const entries = Array.isArray(input) ? input : input?.notes;
      if (!Array.isArray(entries) || !entries.length || entries.length > 1000) throw new Error('Choose a ZNotes export with 1 to 1,000 notes.');
      const previous = await readState();
      const notes = previous.notes;
      if (notes.length + entries.length > 1000) throw new Error('Import would exceed the 1,000 note limit. Your existing notes were not changed.');
      const imported = entries.map(entry => {
        if (!entry || typeof entry !== 'object') throw new Error('Invalid imported note.');
        if (entry.checklist !== undefined && !Array.isArray(entry.checklist)) throw new Error('Invalid imported checklist.');
        return normalizeNote({ ...entry, id: randomUUID(), title: typeof entry.title === 'string' ? entry.title : 'Untitled', content: entry.content ?? entry.body ?? '', sourceVersion: entry.sourceVersion ?? entry.version, checklist: (entry.checklist ?? []).map(item => ({ ...item, id: randomUUID() })) });
      });
      await write([...imported, ...notes], previous);
      return { imported: imported.length };
    }),
    remove: (id) => mutate(async () => { if (!UUID.test(id || '')) throw new Error('Invalid note identifier.'); const previous = await readState(); await write(previous.notes.filter((note) => note.id !== id), previous); return true; }),
  };
}
module.exports = { createNotesStore, normalizeNote, NOTEBOOK_BYTES };
