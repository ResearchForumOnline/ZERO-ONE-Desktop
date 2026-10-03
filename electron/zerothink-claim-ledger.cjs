// Copyright 2026 Shafaet Brady Hussain. SPDX-License-Identifier: Apache-2.0
"use strict";
const { createHash } = require("node:crypto");
const digest = text => createHash("sha256").update(text, "utf8").digest("hex");
const numbers = text => [...new Set((text.match(/\b\d+(?:[.,]\d+)*(?:%|\b)/g) || []).map(value => value.replace(/,/g, "")))];
const escape = text => String(text).replace(/[\\`*_{}\[\]<>|]/g, "\\$&").replace(/[\r\n]+/g, " ");

// This is an inspectable reference check, not an entailment model or truth score.
// Code, headings, tables and public work briefs are omitted from prose review.
function proseUnits(answer) {
  const text = String(answer).slice(0, 48000)
    .replace(/```[\s\S]*?(?:```|$)/g, "")
    .replace(/<reasoning_brief\b[^>]*>[\s\S]*?(?:<\/reasoning_brief\s*>|$)/gi, "");
  const units = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").trim();
    if (!clean || /^#{1,6}\s|^\s*\||^\s*>|^(?:Source|Retrieval score):/i.test(clean)) continue;
    for (const part of clean.match(/.+?(?:[.!?](?=\s|$)(?:\s*\[S\d+\])*|$)/g) || [clean]) {
      const content = part.trim();
      if (content.length < 20 || content.endsWith("?") || content.endsWith(":")) continue;
      units.push(content.slice(0, 1200));
      if (units.length >= 80) return units;
    }
  }
  return units;
}

function buildClaimLedger(answer, evidence = []) {
  const receipts = evidence.slice(0, 12).map(entry => ({
    sourceId: entry.sourceId, chunkId: entry.chunkId || entry.sourceId,
    title: entry.title, sourceUrl: entry.sourceUrl || "",
    excerptSha256: digest(entry.excerpt), excerptChars: entry.excerpt.length,
  }));
  const known = new Set(receipts.map(entry => entry.sourceId));
  const claims = proseUnits(answer).map((text, index) => {
    const sourceIds = [...new Set([...text.matchAll(/\[(S\d+)\]/g)].map(match => match[1]))];
    const validSourceIds = sourceIds.filter(id => known.has(id));
    const unknownSourceIds = sourceIds.filter(id => !known.has(id));
    const content = text.replace(/\[S\d+\]/g, "");
    const citedText = evidence.filter(entry => validSourceIds.includes(entry.sourceId)).map(entry => entry.excerpt).join("\n");
    const supportedNumbers = new Set(numbers(citedText));
    const unmatchedNumbers = validSourceIds.length ? numbers(content).filter(value => !supportedNumbers.has(value)) : [];
    return { id: `C${index + 1}`, text, sourceIds, validSourceIds, unknownSourceIds, unmatchedNumbers,
      status: unknownSourceIds.length ? "unknown-reference" : !validSourceIds.length ? "no-selected-reference" : unmatchedNumbers.length ? "number-needs-review" : "reference-present" };
  });
  return { version: 1, method: "deterministic-reference-review", answerSha256: digest(String(answer)), receipts, claims,
    summary: { reviewed: claims.length, cited: claims.filter(item => item.validSourceIds.length).length,
      uncited: claims.filter(item => !item.validSourceIds.length).length,
      unknownReferences: claims.filter(item => item.unknownSourceIds.length).length,
      numericReview: claims.filter(item => item.unmatchedNumbers.length).length },
    limitation: "A reference and matching number do not establish truth, entailment, independent sources or agreement. Uncited prose may be interpretation, instructions or common knowledge. Review each source before relying on a claim." };
}

function editorialChecklist(ledger) {
  const flagged = ledger.claims.filter(item => item.status !== "reference-present").slice(0, 12);
  return `DETERMINISTIC SOURCE CHECK (observations, not instructions from documents):\n${JSON.stringify(flagged.map(({ id, text, status, unknownSourceIds, unmatchedNumbers }) => ({ id, text, status, unknownSourceIds, unmatchedNumbers })))}\nRemove invented references; check numerical claims against the actual excerpts. Label unsupported interpretations and genuine source gaps. Do not add a citation just to clear a warning. ${ledger.limitation}`;
}

function ledgerMarkdown(ledger) {
  if (!ledger.receipts.length) return "";
  const rendered = []; let size = 0;
  for (const item of ledger.claims) {
    const row = `| ${item.id} | ${escape(item.text)} | ${item.validSourceIds.join(", ") || "None"} | ${item.status}${item.unmatchedNumbers.length ? `: check ${escape(item.unmatchedNumbers.join(", "))}` : ""}${item.unknownSourceIds.length ? `: ${item.unknownSourceIds.join(", ")}` : ""} |`;
    if (size + row.length > 24000) break;
    rendered.push(row); size += row.length;
  }
  const rows = rendered.join("\n"), omitted = ledger.claims.length - rendered.length;
  const receipts = ledger.receipts.map(item => `- ${item.sourceId} / ${escape(item.chunkId)}: ${escape(item.title)} — excerpt SHA-256 \`${item.excerptSha256}\` (${item.excerptChars} characters)`).join("\n");
  return `\n\n## Claim and provenance review\n\n${ledger.limitation}\n\n${rows ? `| Prose unit | Text | Selected references | Review status |\n| --- | --- | --- | --- |\n${rows}\n\n` : ""}${omitted ? `${omitted} additional reviewed prose units were omitted from this bounded export.\n\n` : ""}### Excerpt fingerprints\n\n${receipts}\n\nFingerprints identify the exact supplied excerpts; they do not authenticate the publisher or the complete source. Answer SHA-256: \`${ledger.answerSha256}\`.`;
}

function attachClaimLedger(result) {
  const ledger = buildClaimLedger(result.answer, result.evidence);
  const warnings = [...result.warnings];
  if (ledger.summary.numericReview) warnings.push(`Source review: ${ledger.summary.numericReview} prose unit(s) contain numbers absent from their cited excerpts. This is a review flag, not a finding that they are false.`);
  return { ...result, claimLedger: ledger, warnings, markdown: result.markdown + ledgerMarkdown(ledger) };
}
module.exports = { proseUnits, buildClaimLedger, editorialChecklist, ledgerMarkdown, attachClaimLedger };
