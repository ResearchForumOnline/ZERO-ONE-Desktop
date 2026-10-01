// Copyright 2026 Shafaet Brady Hussain. SPDX-License-Identifier: Apache-2.0
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { library, result } = require("./zerothink-studio-store.cjs");
const MAX_IMPORT = 4 * 1024 * 1024, MAX_STATE = 24 * 1024 * 1024;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const PROCESSES = new Set(["literature-review", "evidence-map", "expert-discovery", "collaboration-plan", "study-plan", "gap-analysis", "claim-ledger", "paper-draft", "custom"]);
function text(value, max, label) { if (typeof value !== "string" || value.length > max || value.includes("\0")) throw new Error(`Invalid project ${label}.`); return value; }
function normalizeProject(input, { imported = false, persisted = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("A research project is required.");
  const id = imported || input.id === undefined ? randomUUID() : input.id;
  if (!UUID.test(id)) throw new Error("Invalid research project identifier.");
  if (!PROCESSES.has(input.processId) || ![1, 2, 3].includes(input.maxPasses) || !["draft", "running", "completed", "interrupted"].includes(input.status)) throw new Error("Invalid research project options.");
  for (const option of ["useModel", "zeroMode", "autoWeb"]) if (typeof input[option] !== "boolean") throw new Error("Invalid research project setting.");
  const clean = { id, title: text(input.title, 160, "title").trim() || "Untitled research", question: text(input.question, 12000, "question"), processId: input.processId, maxPasses: input.maxPasses, useModel: input.useModel, zeroMode: input.zeroMode, autoWeb: input.autoWeb, documents: library(input.documents), result: input.result == null ? null : result(input.result), status: input.status, lastError: text(input.lastError || "", 1000, "recovery message"), updatedAt: persisted ? text(input.updatedAt, 40, "date") : new Date().toISOString() };
  if (clean.documents.length > 8) throw new Error("A research project accepts at most 8 selected sources.");
  if (Buffer.byteLength(JSON.stringify(clean), "utf8") > MAX_IMPORT) throw new Error("The research project exceeds 4 MB.");
  if (persisted && !Number.isFinite(Date.parse(clean.updatedAt))) throw new Error("Invalid research project date.");
  return clean;
}
function portableProject(project) {
  const clean = normalizeProject(project);
  // Explicit data-only schema: credentials, server addresses, persona and file metadata are never copied.
  const { id, updatedAt, ...content } = clean;
  return JSON.stringify({ format: "zerothink-research-project", version: 1, project: { ...content, status: clean.status === "running" ? "interrupted" : clean.status } }, null, 2);
}
function parsePortableProject(json) {
  if (typeof json !== "string" || Buffer.byteLength(json, "utf8") > MAX_IMPORT) throw new Error("Import a ZeroThink project JSON file of at most 4 MB.");
  const data = JSON.parse(json);
  if (data?.format !== "zerothink-research-project" || data.version !== 1) throw new Error("This file is not a supported ZeroThink research project.");
  return normalizeProject(data.project, { imported: true });
}
function createResearchProjectStore({ filePath, storage, secure }) {
  if (!path.isAbsolute(filePath)) throw new Error("An absolute research project store path is required.");
  let queue = Promise.resolve();
  function check() { if (!secure() || storage.getSelectedStorageBackend?.() === "basic_text") throw new Error("Secure operating-system storage is unavailable. Research projects were preserved."); }
  async function read() {
    check();
    try {
      const stat = await fs.stat(filePath); if (!stat.isFile() || stat.size > MAX_STATE * 2) throw new Error("Invalid encrypted research project file size.");
      const envelope = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (envelope.version !== 1 || typeof envelope.encrypted !== "string" || !envelope.encrypted || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(envelope.encrypted)) throw new Error("Invalid research project encryption envelope. The file was preserved.");
      const json = storage.decryptString(Buffer.from(envelope.encrypted, "base64"));
      if (Buffer.byteLength(json, "utf8") > MAX_STATE) throw new Error("Research project storage exceeds its limit.");
      const data = JSON.parse(json); if (data.version !== 1 || !Array.isArray(data.projects) || data.projects.length > 32) throw new Error("Invalid research project list.");
      const projects = data.projects.map((p) => normalizeProject(p, { persisted: true }));
      if (new Set(projects.map((p) => p.id)).size !== projects.length) throw new Error("Duplicate research project identifier.");
      return projects;
    } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  }
  async function write(projects) {
    check(); const json = JSON.stringify({ version: 1, projects }); if (Buffer.byteLength(json, "utf8") > MAX_STATE) throw new Error("Research project storage is full. Export and remove old projects first.");
    const encrypted = storage.encryptString(json).toString("base64"); await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temporary, JSON.stringify({ version: 1, encrypted }), { mode: 0o600 }); await fs.rename(temporary, filePath); } finally { await fs.rm(temporary, { force: true }); }
  }
  function mutate(action) { const pending = queue.then(action); queue = pending.catch(() => {}); return pending; }
  function restore(p) { return p?.status === "running" ? { ...p, status: "interrupted", lastError: "This run was interrupted before its final result was saved. Review the project and start a fresh run; it has not automatically resumed." } : p; }
  function saveProject(input) { return mutate(async () => { const clean = normalizeProject(input), projects = await read(), index = projects.findIndex((p) => p.id === clean.id); if (index >= 0) projects[index] = clean; else { if (projects.length >= 32) throw new Error("You have 32 research projects. Export and remove one first."); projects.push(clean); } await write(projects); return clean; }); }
  return { listProjects: async () => { await queue; return (await read()).map(restore).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(({ id, title, updatedAt, status, documents }) => ({ id, title, updatedAt, status, sourceCount: documents.length })); }, getProject: async (id) => { if (!UUID.test(id)) throw new Error("Invalid project identifier."); await queue; return restore((await read()).find((p) => p.id === id)) || null; }, saveProject, deleteProject: (id) => mutate(async () => { if (!UUID.test(id)) throw new Error("Invalid project identifier."); await write((await read()).filter((p) => p.id !== id)); return true; }), exportProject: async (id) => { if (!UUID.test(id)) throw new Error("Invalid project identifier."); await queue; const project = (await read()).find((p) => p.id === id); if (!project) throw new Error("This research project no longer exists."); return portableProject(project); }, importProject: (json) => saveProject(parsePortableProject(json)) };
}
module.exports = { createResearchProjectStore, normalizeProject, portableProject, parsePortableProject, MAX_IMPORT };
