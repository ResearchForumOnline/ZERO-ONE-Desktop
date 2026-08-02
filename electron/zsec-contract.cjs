"use strict";

const SCAN_OUTCOMES = new Set([
  "no_configured_rule_matches",
  "configured_rule_matches_detected",
  "incomplete",
]);

function nonNegativeSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${label}`);
  return value;
}

function boundedString(value, fallback, maximum = 80) {
  return String(value || fallback).slice(0, maximum);
}

function parseLastScan(value) {
  if (value == null) return undefined;
  if (typeof value !== "string" || value.length > 80 || Number.isNaN(Date.parse(value))) {
    throw new Error("Invalid ZSEC scan timestamp");
  }
  return value;
}

function parseStatusBase(payload, fallbackPlatform) {
  const findings = nonNegativeSafeInteger(payload.findings, "ZSEC status findings");
  const quarantine = nonNegativeSafeInteger(payload.quarantine_count, "ZSEC quarantine count");
  const lastScan = parseLastScan(payload.last_scan);
  const diagnostic = payload.last_scan_diagnostic;
  if (
    !diagnostic
    || typeof diagnostic !== "object"
    || typeof diagnostic.available !== "boolean"
    || !(diagnostic.error === null || typeof diagnostic.error === "string")
  ) {
    throw new Error("Invalid ZSEC status diagnostic");
  }
  return {
    installed: true,
    version: boundedString(payload.version, "unknown", 40),
    platform: boundedString(payload.platform, fallbackPlatform),
    definitions: boundedString(payload.definitions, "not reported"),
    lastScan,
    findings,
    quarantine,
    diagnostic,
  };
}

function parseZsecStatusPayload(input, fallbackPlatform = "unknown") {
  const payload = typeof input === "string" ? JSON.parse(input) : input;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Malformed ZSEC status payload");
  }
  const base = parseStatusBase(payload, fallbackPlatform);

  if (payload.schema === "zsec.shield.status.v1" && payload.contract_version === 1) {
    if (!base.lastScan && !base.diagnostic.available && base.diagnostic.error === null) {
      return {
        ...base,
        state: "idle",
        message: "ZSEC Shield is installed. Run an on-demand scan to create local evidence.",
      };
    }
    return {
      ...base,
      state: "unavailable",
      message: "The stored ZSEC scan uses a legacy status contract. Run a new scan before relying on its result.",
    };
  }

  if (payload.schema !== "zsec.shield.status.v2" || payload.contract_version !== 2) {
    throw new Error("Unsupported ZSEC status contract");
  }

  const outcome = payload.last_scan_outcome;
  const errors = nonNegativeSafeInteger(payload.last_scan_errors, "ZSEC status errors");
  const filesHashed = payload.last_scan_files_hashed;
  const bytesHashed = payload.last_scan_bytes_hashed;

  if (!base.lastScan) {
    if (
      outcome !== null
      || errors !== 0
      || base.findings !== 0
      || filesHashed !== null
      || bytesHashed !== null
      || base.diagnostic.available
      || base.diagnostic.error !== null
    ) {
      return {
        ...base,
        outcome,
        errors,
        state: "unavailable",
        message: "ZSEC Shield has no validated last-scan evidence.",
      };
    }
    return {
      ...base,
      outcome: undefined,
      errors,
      state: "idle",
      message: "ZSEC Shield is installed. Run an on-demand scan to create local evidence.",
    };
  }

  if (!base.diagnostic.available || base.diagnostic.error !== null) {
    throw new Error("Unavailable ZSEC last-scan evidence");
  }
  const parsedFiles = nonNegativeSafeInteger(filesHashed, "ZSEC files hashed");
  const parsedBytes = nonNegativeSafeInteger(bytesHashed, "ZSEC bytes hashed");
  if (!SCAN_OUTCOMES.has(outcome)) throw new Error("Invalid ZSEC last-scan outcome");

  if (outcome === "no_configured_rule_matches") {
    if (errors !== 0 || base.findings !== 0) throw new Error("Inconsistent clean ZSEC status");
    return {
      ...base,
      outcome,
      errors,
      filesHashed: parsedFiles,
      bytesHashed: parsedBytes,
      state: "ready",
      message: "The last on-demand scan reported no configured-rule matches.",
    };
  }

  if (outcome === "configured_rule_matches_detected") {
    if (errors !== 0 || base.findings === 0) throw new Error("Inconsistent finding ZSEC status");
    return {
      ...base,
      outcome,
      errors,
      filesHashed: parsedFiles,
      bytesHashed: parsedBytes,
      state: "attention",
      message: "Review the configured-rule matches from the last local scan.",
    };
  }

  return {
    ...base,
    outcome,
    errors,
    filesHashed: parsedFiles,
    bytesHashed: parsedBytes,
    state: "attention",
    message: "The last local scan was incomplete. Review its errors and run it again.",
  };
}

function parseZsecScanReport(stdout) {
  const report = JSON.parse(String(stdout || "{}"));
  if (report.schema !== "zsec.shield.report.v1") throw new Error("Unsupported ZSEC scan contract");
  const stats = report.scan?.stats;
  const outcome = String(report.outcome || "");
  if (!stats || !SCAN_OUTCOMES.has(outcome)) throw new Error("Malformed ZSEC scan report");
  const result = {
    cancelled: false,
    outcome,
    filesHashed: nonNegativeSafeInteger(stats.files_hashed, "files_hashed"),
    bytesHashed: nonNegativeSafeInteger(stats.bytes_hashed, "bytes_hashed"),
    findings: nonNegativeSafeInteger(stats.findings, "findings"),
    errors: nonNegativeSafeInteger(stats.errors, "errors"),
  };
  if (outcome === "no_configured_rule_matches" && (result.findings !== 0 || result.errors !== 0)) {
    throw new Error("Inconsistent clean ZSEC scan report");
  }
  if (outcome === "configured_rule_matches_detected" && (result.findings === 0 || result.errors !== 0)) {
    throw new Error("Inconsistent finding ZSEC scan report");
  }
  if (outcome === "incomplete" && result.errors === 0) {
    throw new Error("Inconsistent incomplete ZSEC scan report");
  }
  return result;
}

module.exports = { parseZsecScanReport, parseZsecStatusPayload };
