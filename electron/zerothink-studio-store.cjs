// Copyright 2026 Shafaet Brady Hussain. SPDX-License-Identifier: Apache-2.0
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const MAX_STATE = 16 * 1024 * 1024;
function profile(value = { persona: "", facts: [] }) {
  if (!value || typeof value.persona !== "string" || !Array.isArray(value.facts) || value.facts.length > 20) throw new Error("A profile accepts a persona and at most 20 remembered facts.");
  return { persona: text(value.persona, 8000, "persona"), facts: value.facts.map((fact) => text(fact, 1000, "remembered fact").trim()).filter(Boolean) };
}
function identifier(value) { if (typeof value !== "string" || !ID.test(value)) throw new Error("Invalid ZeroThink identifier."); return value; }
function text(value, maximum, label) { if (typeof value !== "string" || value.length > maximum || value.includes("\0")) throw new Error(`Invalid ${label}.`); return value; }
function result(value) {
  if (!value || !["completed", "offline"].includes(value.status) || !Array.isArray(value.evidence) || value.evidence.length > 12 || !Array.isArray(value.steps) || value.steps.length > 12 || !Array.isArray(value.warnings) || value.warnings.length > 50 || !value.citations || typeof value.citations.missing !== "boolean" || !value.metrics) throw new Error("Invalid saved research result. The existing workspace was preserved.");
  const sourceIds = (ids) => { if (!Array.isArray(ids) || ids.length > 512 || ids.some((id) => typeof id !== "string" || !/^S\d{1,8}$/.test(id))) throw new Error("Invalid saved source references."); return [...ids]; };
  const number = (count, maximum) => { if (!Number.isSafeInteger(count) || count < 0 || count > maximum) throw new Error("Invalid saved research metrics."); return count; };
  const evidence = value.evidence.map((entry) => {
    if (!entry || typeof entry.sourceId !== "string" || !/^S\d{1,8}$/.test(entry.sourceId) || typeof entry.score !== "number" || !Number.isFinite(entry.score) || entry.score < 0) throw new Error("Invalid saved evidence entry.");
    const clean = { sourceId: entry.sourceId, title: text(entry.title, 200, "source title"), excerpt: text(entry.excerpt, 1000, "source excerpt"), chunkId: text(entry.chunkId, 100, "source chunk"), score: entry.score };
    if (entry.documentId !== undefined) clean.documentId = text(entry.documentId, 100, "source document identifier");
    if (entry.sourceUrl) { const url = new URL(text(entry.sourceUrl, 2048, "source URL")); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid saved source URL."); clean.sourceUrl = url.toString(); }
    return clean;
  });
  const clean = { version: text(value.version, 80, "report version"), status: value.status, mode: text(value.mode, 30, "report mode"), question: text(value.question, 12000, "report question"), answer: text(value.answer, 48000, "report answer"), markdown: text(value.markdown, 140000, "report Markdown"), evidence,
    citations: { valid: sourceIds(value.citations.valid), unknown: sourceIds(value.citations.unknown), missing: value.citations.missing },
    steps: value.steps.map((step) => { if (!step || step.status !== "completed") throw new Error("Invalid saved report step."); return { id: text(step.id, 80, "step identifier"), label: text(step.label, 200, "step label"), status: "completed" }; }),
    metrics: { passes: number(value.metrics.passes, 4), requestedTokens: number(value.metrics.requestedTokens, 12000), sourceCount: number(value.metrics.sourceCount, 32), retrievedCount: number(value.metrics.retrievedCount, 12) },
    warnings: value.warnings.map((warning) => text(warning, 8000, "report warning")) };
  if (value.reasoningBrief) clean.reasoningBrief = text(value.reasoningBrief, 6000, "report public brief");
  if (JSON.stringify(clean).length > 160000) throw new Error("Saved research result exceeds its size limit.");
  return clean;
}
function library(value) {
  if (!Array.isArray(value) || value.length > 32) throw new Error("The library accepts at most 32 documents.");
  let size = 0; const seen = new Set();
  return value.map((item) => {
    const id = identifier(item?.id); if (seen.has(id)) throw new Error("Duplicate library document."); seen.add(id);
    const body = text(item.text, 1048576, "library text"); size += Buffer.byteLength(body, "utf8");
    if (size > 2 * 1024 * 1024) throw new Error("The library accepts up to 2 MB of selected text.");
    const result = { id, title: text(item.title, 160, "library title"), text: body };
    if (item.sourceUrl) { const url = new URL(item.sourceUrl); if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid library source URL."); url.search = ""; url.hash = ""; result.sourceUrl = url.toString().slice(0, 2048); }
    return result;
  });
}
function session(value) {
  const id = identifier(value?.id);
  if (!Array.isArray(value.messages) || value.messages.length > 100 || !Array.isArray(value.documentIds || []) || (value.documentIds || []).length > 32) throw new Error("A chat accepts at most 100 messages and 32 source references.");
  let chars = 0;
  const messages = value.messages.map((message) => {
    if (!["user", "assistant"].includes(message?.role)) throw new Error("Invalid chat message role.");
    const content = text(message.content, 48000, "chat message"); chars += content.length;
    if (chars > 500000) throw new Error("This conversation reached its 500,000-character limit. Start a new chat.");
    const clean = { id: identifier(message.id), role: message.role, content };
    if (message.reasoningBrief) clean.reasoningBrief = text(message.reasoningBrief, 6000, "public brief");
    // Saved reports retain export and evidence data; JSON size is independently bounded.
    if (message.result !== undefined) clean.result = result(message.result);
    return clean;
  });
  return { id, title: text(value.title || "New chat", 160, "chat title"), pinned: value.pinned === true, messages, documentIds: [...new Set((value.documentIds || []).map(identifier))], updatedAt: typeof value.updatedAt === "string" ? value.updatedAt.slice(0, 40) : "" };
}
function createStudioStore({ filePath, storage, secure }) {
  let queue = Promise.resolve();
  const check = () => { if (!secure()) throw new Error("Secure operating-system storage is unavailable. Your ZeroThink conversations were not changed."); };
  async function read() {
    check();
    try {
      const info = await fs.stat(filePath); if (!info.isFile() || info.size > 32 * 1024 * 1024) throw new Error("Invalid ZeroThink workspace size.");
      const envelope = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (envelope.version !== 1 || typeof envelope.encrypted !== "string") throw new Error("Invalid ZeroThink workspace format. The existing file was preserved.");
      const decoded = storage.decryptString(Buffer.from(envelope.encrypted, "base64"));
      if (Buffer.byteLength(decoded, "utf8") > MAX_STATE) throw new Error("The ZeroThink workspace exceeds its size limit.");
      const state = JSON.parse(decoded);
      if (!Array.isArray(state.sessions) || state.sessions.length > 100) throw new Error("Invalid ZeroThink conversation list.");
      const sessions = state.sessions.map(session); if (new Set(sessions.map((item) => item.id)).size !== sessions.length) throw new Error("Duplicate ZeroThink conversations.");
      return { sessions, library: library(state.library), profile: profile(state.profile) };
    } catch (error) { if (error.code === "ENOENT") return { sessions: [], library: [], profile: profile() }; throw error; }
  }
  async function write(state) {
    check(); const encoded = JSON.stringify(state);
    if (Buffer.byteLength(encoded, "utf8") > MAX_STATE) throw new Error("ZeroThink workspace storage is full. Export old chats before removing them.");
    const encrypted = storage.encryptString(encoded).toString("base64");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temporary, JSON.stringify({ version: 1, encrypted }), { encoding: "utf8", mode: 0o600 }); await fs.rename(temporary, filePath); }
    finally { await fs.rm(temporary, { force: true }); }
  }
  function mutate(action) { const pending = queue.then(action); queue = pending.catch(() => {}); return pending; }
  return {
    listSessions: async () => { await queue; return (await read()).sessions.map(({ id, title, updatedAt, pinned, messages }) => ({ id, title, updatedAt, pinned, messageCount: messages.length })).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)); },
    getSession: async (id) => { identifier(id); await queue; return (await read()).sessions.find((item) => item.id === id) || null; },
    saveSession: (input) => mutate(async () => { const clean = session({ ...input, updatedAt: new Date().toISOString() }); const state = await read(), index = state.sessions.findIndex((item) => item.id === clean.id); if (index >= 0) state.sessions[index] = clean; else { if (state.sessions.length >= 100) throw new Error("You have 100 chats. Export and remove an old chat first."); state.sessions.push(clean); } await write(state); return clean; }),
    deleteSession: (id) => mutate(async () => { identifier(id); const state = await read(); state.sessions = state.sessions.filter((item) => item.id !== id); await write(state); return true; }),
    listLibrary: async () => { await queue; return (await read()).library; },
    saveLibrary: (documents) => mutate(async () => { const cleaned = library(documents), state = await read(); state.library = cleaned; await write(state); return cleaned; }),
    getProfile: async () => { await queue; return (await read()).profile; },
    saveProfile: (input) => mutate(async () => { const cleaned = profile(input), state = await read(); state.profile = cleaned; await write(state); return cleaned; }),
  };
}
module.exports = { createStudioStore, session, library, profile, result };
