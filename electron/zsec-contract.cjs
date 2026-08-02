"use strict";

const SCAN_OUTCOMES = new Set([
  "no_configured_rule_matches",
  "configured_rule_matches_detected",
  "incomplete",
]);

function nonNegativeSafeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${label}`);
  return parsed;
}

function parseZsecScanReport(stdout) {
  const report = JSON.parse(String(stdout || "{}"));
  if (report.schema !== "zsec.shield.report.v1") throw new Error("Unsupported ZSEC scan contract");
  const stats = report.scan?.stats;
  const outcome = String(report.outcome || "");
  if (!stats || !SCAN_OUTCOMES.has(outcome)) throw new Error("Malformed ZSEC scan report");
  return {
    cancelled: false,
    outcome,
    filesHashed: nonNegativeSafeInteger(stats.files_hashed, "files_hashed"),
    bytesHashed: nonNegativeSafeInteger(stats.bytes_hashed, "bytes_hashed"),
    findings: nonNegativeSafeInteger(stats.findings, "findings"),
    errors: nonNegativeSafeInteger(stats.errors, "errors"),
  };
}

module.exports = { parseZsecScanReport };