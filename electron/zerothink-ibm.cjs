"use strict";
// IBM Quantum Compute REST discovery. Only IAM authentication and read-only
// backend queries are exposed; this module cannot create jobs or instances.
const IAM_URL = "https://iam.cloud.ibm.com/identity/token";
const API_VERSION = "2026-04-15";
const REGIONS = { "us-east": "https://quantum.cloud.ibm.com/api/v1", "eu-de": "https://eu-de.quantum.cloud.ibm.com/api/v1" };
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const cleanText = (value, secrets = [], max = 500) => secrets.reduce((value, secret) => secret ? value.split(secret).join("[redacted]") : value, String(value ?? "")).replace(/[\x00-\x1f\x7f]/g, " ").slice(0, max);
const object = (value) => value && typeof value === "object" && !Array.isArray(value);

function normalizeIBMRequest(input) {
  if (!object(input) || !["backends", "status"].includes(input.action)) throw new Error("IBM Quantum exposes backend discovery and status only.");
  const region = input.region || "us-east";
  if (!Object.hasOwn(REGIONS, region)) throw new Error("Choose the IBM us-east or eu-de region.");
  const instanceCRN = String(input.instanceCRN || "").trim();
  if (instanceCRN.length > 512 || /[\s\x00-\x1f]/.test(instanceCRN)) throw new Error("Enter your IBM Quantum service instance CRN.");
  const parts = instanceCRN.split(":");
  if (parts.length !== 10 || parts[0] !== "crn" || parts[1] !== "v1" || parts[2] !== "bluemix" || parts[3] !== "public" || parts[4] !== "quantum-computing" || parts[5] !== region || !/^a\/[a-zA-Z0-9-]{1,128}$/.test(parts[6]) || !/^[a-zA-Z0-9-]{1,128}$/.test(parts[7]) || parts[8] !== "" || parts[9] !== "") throw new Error("The Quantum service CRN must match the selected IBM region.");
  if (input.action === "status" && !NAME.test(String(input.backend || ""))) throw new Error("Choose a valid IBM backend name.");
  return { action: input.action, region, instanceCRN, ...(input.action === "status" ? { backend: input.backend } : {}) };
}

async function requestJSON(url, init, fetchImpl) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetchImpl(url, { ...init, redirect: "error", signal: controller.signal });
    if (Number(response.headers?.get("content-length") || 0) > 1048576) throw new Error("IBM response exceeds its 1 MiB limit.");
    let raw;
    if (response.body?.getReader) { const reader = response.body.getReader(), pieces = []; let bytes = 0; try { while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.byteLength; if (bytes > 1048576) { controller.abort(); throw new Error("IBM response exceeds its 1 MiB limit."); } pieces.push(Buffer.from(item.value)); } raw = Buffer.concat(pieces).toString("utf8"); } finally { reader.releaseLock(); } }
    else { raw = await response.text(); if (Buffer.byteLength(raw) > 1048576) throw new Error("IBM response exceeds its 1 MiB limit."); }
    if (!response.ok) throw new Error(`IBM ${url === IAM_URL ? "authentication" : "backend query"} failed (HTTP ${response.status}). Check your key, Quantum instance CRN, region, and IAM access.`);
    let value; try { value = JSON.parse(raw); } catch { throw new Error("IBM returned invalid JSON."); }
    return value;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("IBM request timed out or exceeded its response limit.");
    if (error instanceof Error && /^IBM /.test(error.message)) throw error;
    throw new Error("IBM network request failed. No quantum jobs were submitted.");
  } finally { clearTimeout(timer); }
}

function normalizeDevice(device, secrets) {
  if (!object(device) || !NAME.test(device.name || "") || secrets.some((secret) => secret && device.name.includes(secret))) throw new Error("IBM returned an invalid backend name.");
  const result = { name: device.name, status: cleanText(object(device.status) ? device.status.name : device.status, secrets, 80) };
  if (device.status?.reason) result.reason = cleanText(device.status.reason, secrets);
  for (const key of ["qubits", "physical_qubits", "queue_length", "wait_time_seconds"]) if (Number.isSafeInteger(device[key]) && device[key] >= 0) result[key] = device[key];
  if (typeof device.is_simulator === "boolean") result.isSimulator = device.is_simulator;
  return result;
}

async function runIBMQuantumRequest(value, options = {}) {
  const input = normalizeIBMRequest(value), apiKey = String(options.apiKey || "").trim();
  if (!apiKey) throw new Error("Save your own IBM Quantum API key in the private Vault first.");
  if (apiKey.length > 8192 || /[\s\x00-\x1f]/.test(apiKey)) throw new Error("The IBM Quantum API key is invalid.");
  const fetchImpl = options.fetchImpl || fetch;
  const iam = await requestJSON(IAM_URL, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ibm:params:oauth:grant-type:apikey", apikey: apiKey }).toString() }, fetchImpl);
  if (!object(iam) || typeof iam.access_token !== "string" || !iam.access_token || iam.access_token.length > 8192 || /[\s\x00-\x1f]/.test(iam.access_token) || (iam.token_type && (typeof iam.token_type !== "string" || iam.token_type.toLowerCase() !== "bearer")) || (iam.expires_in !== undefined && (!Number.isFinite(iam.expires_in) || iam.expires_in <= 0))) throw new Error("IBM authentication returned no valid bearer token.");
  const bearer = iam.access_token;
  const path = input.action === "backends" ? "/backends?fields=wait_time_seconds" : `/backends/${encodeURIComponent(input.backend)}/status`;
  const payload = await requestJSON(REGIONS[input.region] + path, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${bearer}`, "Service-CRN": input.instanceCRN, "IBM-API-Version": API_VERSION } }, fetchImpl);
  const result = { provider: "ibm", action: input.action, apiVersion: API_VERSION, region: input.region, recordedAt: new Date().toISOString(), provenance: "ibm-quantum-compute-rest", warnings: ["Backend access and status are read-only observations. They do not prove a circuit has run or reserve quantum time.", "IBM hardware job submission is not included in this workspace."] };
  if (input.action === "backends") {
    if (!object(payload) || !Array.isArray(payload.devices) || payload.devices.length > 200) throw new Error("IBM returned an invalid device list.");
    result.backends = payload.devices.map((device) => normalizeDevice(device, [apiKey, bearer]));
  } else {
    if (!object(payload)) throw new Error("IBM returned invalid backend status.");
    result.backend = cleanText(input.backend, [apiKey, bearer], 128);
    result.status = { status: cleanText(payload.status, [apiKey, bearer], 80), message: cleanText(payload.message, [apiKey, bearer]), ...(typeof payload.state === "boolean" ? { available: payload.state } : {}), ...(Number.isSafeInteger(payload.length_queue) && payload.length_queue >= 0 ? { queueLength: payload.length_queue } : {}), backendVersion: cleanText(payload.backend_version, [apiKey, bearer], 80) };
  }
  return result;
}
module.exports = { IAM_URL, API_VERSION, REGIONS, normalizeIBMRequest, runIBMQuantumRequest };
