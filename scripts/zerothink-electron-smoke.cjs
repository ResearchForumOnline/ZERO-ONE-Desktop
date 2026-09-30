"use strict";
// Backend smoke in the real Electron runtime; no browser/UI automation or user profile.
const { app, safeStorage } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { runResearch } = require("../electron/zerothink/engine.cjs");
const { createNotesStore } = require("../electron/notes-store.cjs");
const { isSecureCredentialStorage } = require("../electron/workspace-logins.cjs");
let temporary;
app.whenReady().then(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), "zerothink-electron-smoke-"));
  assert.ok(isSecureCredentialStorage(safeStorage), "Operating-system secure storage is available");
  const report = await runResearch({ question: "How do we validate evidence retrieval?", documents: [{ title: "Synthetic fixture", text: "Evidence retrieval uses held-out tasks and reports unsupported source references." }], processId: "evidence-map" });
  assert.equal(report.status, "offline"); assert.ok(report.evidence.length);
  const notebook = path.join(temporary, "notes.encrypted.json");
  const notes = createNotesStore({ filePath: notebook, storage: safeStorage, secure: () => isSecureCredentialStorage(safeStorage) });
  const id = randomUUID();
  await notes.save({ id, title: "Synthetic ZeroThink report", content: report.markdown });
  const saved = await notes.list();
  assert.equal(saved[0].content, report.markdown);
  const envelope = await fs.readFile(notebook, "utf8");
  assert.ok(!envelope.includes("held-out tasks")); assert.ok(!envelope.includes("Synthetic ZeroThink report"));
  await notes.remove(id); assert.equal((await notes.list()).length, 0);
  console.log(JSON.stringify({ electron: process.versions.electron, engine: report.version, offlineRetrieval: true, reportEncryptedOnDisk: true, decryptedReportMatches: true, syntheticNoteDeletion: true }));
}).catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (temporary) await fs.rm(temporary, { recursive: true, force: true });
  app.exit(process.exitCode || 0);
});
