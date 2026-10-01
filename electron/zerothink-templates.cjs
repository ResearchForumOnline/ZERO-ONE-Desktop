// Copyright 2026 Shafaet Brady Hussain. SPDX-License-Identifier: Apache-2.0
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const PROCESS_IDS = new Set(["literature-review", "evidence-map", "expert-discovery", "collaboration-plan", "study-plan", "gap-analysis", "claim-ledger", "paper-draft", "custom"]);
const KINDS = new Set(["paper", "scenario", "custom"]);
const MAX_CUSTOM = 32, MAX_STATE = 1024 * 1024, MAX_FILE = 2 * MAX_STATE, MAX_QUESTION = 12000;
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function text(value, maximum, label, required = false) {
  if (typeof value !== "string" || value.length > maximum || value.includes("\0")) throw new Error(`Invalid ${label}: enter text within ${maximum.toLocaleString()} characters.`);
  const clean = value.trim(); if (required && !clean) throw new Error(`${label} is required.`); return clean;
}
function list(value, label) {
  if (!Array.isArray(value) || value.length > 12) throw new Error(`${label} accepts up to 12 entries.`);
  return value.map((item) => text(item, 240, label, true));
}
function builtin(id, name, description, processId, stages, checks, kind = "custom") {
  return Object.freeze({ id: `builtin-${id}`, name, description, kind, processId, stages: Object.freeze(stages), requiredSources: Object.freeze(["Selected library sources", "Explicit researcher notes or observations"]), validationChecks: Object.freeze(checks), builtIn: true, updatedAt: "" });
}
const BUILTIN_TEMPLATES = Object.freeze([
  builtin("systematic-review", "Systematic review extension", "Extend an existing review while retaining source provenance and screening criteria.", "literature-review", ["Define question and screening criteria", "Inspect supplied source access", "Compare agreements and contradictions", "Map claims to source IDs", "Draft findings and limitations", "Researcher review"], ["Do not invent papers or screening counts", "Distinguish snippets from full text", "Record excluded or missing evidence"]),
  builtin("evidence-map", "Evidence and source map", "Map what supplied sources support and what remains uncertain.", "evidence-map", ["State the question", "List supplied sources", "Group evidence", "Map disagreements", "Identify missing comparisons"], ["Use only supplied source IDs", "A citation is not independent verification"]),
  builtin("expert-finder", "Topic expert discovery", "Find candidates only from supplied public authorship and affiliation evidence.", "expert-discovery", ["Define expertise", "Extract named candidates from sources", "Compare relevant work", "List verification steps"], ["No invented biographies or affiliations", "No outreach is sent", "Candidate relevance is a suggestion"]),
  builtin("collaboration", "Collaboration and reviewer planning", "Prepare an evidence-backed shortlist with conflict notes and possible roles.", "collaboration-plan", ["Define research needs", "Compare candidate evidence", "Record conflicts and uncertainty", "Draft roles and next steps"], ["A recommendation is not agreement", "Verify current affiliations before contact"]),
  builtin("study-plan", "Research study plan", "Turn the user's constraints and materials into a reviewable study plan.", "study-plan", ["Define constraints", "Identify prerequisites", "Sequence work", "Set review checkpoints"], ["Expose assumptions", "Make each next action concrete"]),
  builtin("gap-analysis", "Gap and contradiction analysis", "Identify unsupported claims and missing comparisons in supplied research.", "gap-analysis", ["State the research question", "Compare supplied claims", "Map contradictions", "Prioritize missing tests"], ["Absence from the supplied corpus is not proof of absence everywhere", "Do not fabricate completed experiments"]),
  builtin("claim-ledger", "Claim and provenance ledger", "Separate observations, sourced claims, interpretations and proposals.", "claim-ledger", ["Extract claims", "Link source IDs", "Classify evidence status", "Record uncertainty", "Plan verification"], ["Retain source IDs", "Model agreement does not establish truth"]),
  builtin("paper", "Research paper creator", "Prepare a paper draft from actual selected evidence, methods and observations.", "paper-draft", ["Refine question", "Inventory source access", "Build paper structure", "Draft article prose", "Review methods and claims", "Revise for researcher review"], ["No invented results, citations, DOI or author credentials", "Unperformed experiments remain proposed methods", "Describe missing evidence and limitations", "Retain model-assisted drafting disclosure for researcher review"], "paper"),
  builtin("scenario", "Scenario and decision workspace", "Compare hypotheses and outcomes with observed evidence and explicit assumptions.", "claim-ledger", ["Define alternatives and outcome", "Separate observations from assumptions", "Compare plausible explanations", "List risks and disconfirming tests", "Recommend an observable next step"], ["Do not invent a calibrated probability or confidence percentage", "User observations are not independently verified", "No guarantees or fabricated live data"], "scenario"),
  builtin("custom", "Custom research workflow", "Define your own visible research stages and checks.", "custom", ["Define purpose", "Select evidence", "Draft", "Review", "Export"], ["Make assumptions explicit", "Preserve uncertainty and source provenance"]),
]);
function normalizeTemplate(input, { persisted = false } = {}) {
  if (!object(input)) throw new Error("A research template is required.");
  const id = input.id === undefined && !persisted ? randomUUID() : input.id;
  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Only custom template identifiers can be saved or changed.");
  if (input.builtIn === true) throw new Error("Built-in templates cannot be overwritten. Save a custom copy.");
  const kind = input.kind === undefined && !persisted ? "custom" : input.kind;
  if (!KINDS.has(kind)) throw new Error("Choose a paper, scenario or custom template.");
  const processId = input.processId === undefined && !persisted ? "custom" : input.processId;
  if (!PROCESS_IDS.has(processId)) throw new Error("Choose a supported research process.");
  let updatedAt = new Date().toISOString();
  if (persisted) { updatedAt = text(input.updatedAt, 40, "template date", true); if (!Number.isFinite(Date.parse(updatedAt))) throw new Error("Invalid saved template date. The existing file was preserved."); }
  const clean = { id, name: text(input.name, 100, "template name", true), description: text(input.description === undefined && !persisted ? "" : input.description, 600, "description"), kind, processId,
    stages: list(input.stages === undefined && !persisted ? [] : input.stages, "Stages"), requiredSources: list(input.requiredSources === undefined && !persisted ? [] : input.requiredSources, "Required sources"), validationChecks: list(input.validationChecks === undefined && !persisted ? [] : input.validationChecks, "Validation checks"), builtIn: false, updatedAt };
  if (!clean.stages.length) throw new Error("Add at least one workflow stage.");
  return clean;
}
function publicTemplates(custom) { return [...BUILTIN_TEMPLATES, ...custom].map((item) => ({ ...item, stages: [...item.stages], requiredSources: [...item.requiredSources], validationChecks: [...item.validationChecks] })); }
function createTemplateStore({ filePath, safeStorage }) {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) throw new Error("An absolute template storage path is required.");
  let queue = Promise.resolve();
  function secure() {
    if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== "function" || !safeStorage.isEncryptionAvailable() || (typeof safeStorage.getSelectedStorageBackend === "function" && safeStorage.getSelectedStorageBackend() === "basic_text")) throw new Error("Secure operating-system storage is unavailable. Research templates were not changed.");
  }
  async function read() {
    secure();
    try {
      const info = await fs.stat(filePath); if (!info.isFile() || info.size > MAX_FILE) throw new Error("Invalid encrypted research template file size. The existing file was preserved.");
      const envelope = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (!object(envelope) || envelope.version !== 1 || typeof envelope.encrypted !== "string" || !envelope.encrypted || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(envelope.encrypted)) throw new Error("Invalid encrypted research template format. The existing file was preserved.");
      const decoded = safeStorage.decryptString(Buffer.from(envelope.encrypted, "base64"));
      if (typeof decoded !== "string" || Buffer.byteLength(decoded, "utf8") > MAX_STATE) throw new Error("The research template store exceeds its size limit.");
      const state = JSON.parse(decoded);
      if (!object(state) || state.version !== 1 || !Array.isArray(state.templates) || state.templates.length > MAX_CUSTOM) throw new Error("Invalid saved research template list. The existing file was preserved.");
      const templates = state.templates.map((item) => normalizeTemplate(item, { persisted: true }));
      if (new Set(templates.map((item) => item.id)).size !== templates.length) throw new Error("Duplicate saved research templates. The existing file was preserved.");
      return templates;
    } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  }
  async function write(templates) {
    secure(); const json = JSON.stringify({ version: 1, templates });
    if (Buffer.byteLength(json, "utf8") > MAX_STATE) throw new Error("Research template storage reached its size limit.");
    const encrypted = safeStorage.encryptString(json); if (!(encrypted instanceof Uint8Array) || !encrypted.length) throw new Error("Operating-system encryption did not return encrypted data.");
    const envelope = JSON.stringify({ version: 1, encrypted: Buffer.from(encrypted).toString("base64") });
    if (Buffer.byteLength(envelope, "utf8") > MAX_FILE) throw new Error("Encrypted research templates exceed their size limit.");
    await fs.mkdir(path.dirname(filePath), { recursive: true }); const temporary = `${filePath}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temporary, envelope, { encoding: "utf8", mode: 0o600, flag: "wx" }); await fs.rename(temporary, filePath); }
    finally { await fs.rm(temporary, { force: true }); }
  }
  function mutate(action) { const pending = queue.then(action); queue = pending.catch(() => {}); return pending; }
  return {
    list: async () => { await queue; return publicTemplates(await read()); },
    save: (input) => mutate(async () => { const clean = normalizeTemplate(input), templates = await read(), index = templates.findIndex((item) => item.id === clean.id); if (index >= 0) templates[index] = clean; else { if (templates.length >= MAX_CUSTOM) throw new Error("You have 32 custom templates. Remove an old template before adding another."); templates.push(clean); } await write(templates); return clean; }),
    delete: (id) => mutate(async () => { if (typeof id !== "string" || !UUID.test(id)) throw new Error("Built-in templates cannot be deleted."); const templates = await read(), filtered = templates.filter((item) => item.id !== id); if (filtered.length === templates.length) return false; await write(filtered); return true; }),
  };
}
const FIELDS = Object.freeze({ title: [180, "Title / scenario"], problem: [1800, "Research question / problem"], method: [1800, "Methods / proposed approach"], evidence: [1800, "Researcher-supplied evidence notes"], limitations: [1200, "Known limitations and missing evidence"], notes: [1800, "Additional researcher notes"], audience: [200, "Audience"], citationStyle: [100, "Citation style"], length: [100, "Requested length"], horizon: [100, "Observation horizon"], outcome: [1000, "Outcome to observe"], baseline: [1000, "Baseline / alternatives"], observations: [1800, "Supplied observations"], constraints: [1000, "Constraints"], inclusion: [800, "Inclusion criteria"], exclusion: [800, "Exclusion criteria"] });
function renderTemplate(input) {
  if (!object(input) || !object(input.fields)) throw new Error("Template fields are required.");
  const found = BUILTIN_TEMPLATES.find((item) => item.id === input.templateId);
  const template = found || (input.template ? normalizeTemplate(input.template) : BUILTIN_TEMPLATES.find((item) => item.id === "builtin-paper"));
  if (input.templateId && !found && (!input.template || input.template.id !== input.templateId)) throw new Error("The selected custom template is unavailable.");
  const kind = input.kind === undefined ? template.kind : input.kind;
  if (!KINDS.has(kind)) throw new Error("Choose a supported template kind.");
  const fields = {};
  for (const [name, [maximum, label]] of Object.entries(FIELDS)) fields[name] = input.fields[name] === undefined ? "" : text(input.fields[name], maximum, label);
  if (!fields.title && !fields.problem) throw new Error("Enter a title or a research question first.");
  const title = fields.title || fields.problem.slice(0, 180);
  const task = kind === "paper" ? "Create article prose for a research paper draft using the selected library sources and explicitly supplied notes. Include title, abstract, introduction, methods or proposed methods, findings supported by supplied evidence, discussion, limitations and source ledger. If no experimental results were supplied, write an evidence review or proposed study and say so." : kind === "scenario" ? "Compare this scenario's alternatives using supplied observations, source evidence and explicit assumptions. Explain plausible outcomes, risks, disconfirming observations and the next measurable action. Do not invent a calibrated probability or confidence percentage." : "Run this visible custom research workflow using the selected library sources and explicit researcher notes.";
  const lines = [`# ${template.name}: ${title}`, "", task, "", "## Researcher-supplied context", "The following form fields are user-provided statements, not independently verified evidence:"];
  for (const [name, [, label]] of Object.entries(FIELDS)) if (fields[name]) lines.push(`\n### ${label}\n${fields[name]}`);
  lines.push("", "## Visible workflow", ...template.stages.map((stage, i) => `${i + 1}. ${stage}`), "", "## Source requirements", ...template.requiredSources.map((item) => `- ${item}`), "", "## Validation checks", ...template.validationChecks.map((item) => `- ${item}`), "", "## Evidence and honesty rules", "- Use the source IDs assigned to selected library excerpts, such as [S1]. Never invent a reference, DOI, author, source ID, experiment, dataset or numerical result.", "- Distinguish supplied observations, cited source claims, interpretation, candidate leads and proposed future work.", "- Search snippets are discovery evidence, not full-text papers. Missing or inaccessible evidence must remain visible.", "- This is model-assisted drafting for researcher review, not validated science or a publication-ready assurance. Do not invent authorship, affiliations, peer review or endorsements.");
  const question = lines.join("\n"); if (question.length > MAX_QUESTION) throw new Error("The assembled workflow exceeds 12,000 characters. Shorten the form or template before starting research.");
  return { question, processId: kind === "paper" ? "paper-draft" : template.processId, title };
}
module.exports = { BUILTIN_TEMPLATES, createTemplateStore, normalizeTemplate, renderTemplate, MAX_CUSTOM, MAX_QUESTION };
