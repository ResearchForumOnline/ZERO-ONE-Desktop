"use strict";

// Native Quantum Zero: bounded classical simulation and user-owned IonQ jobs.
// Credentials are supplied by the main process vault, never returned to the UI.
const crypto = require("node:crypto");
const IONQ_BASE = "https://api.ionq.co/v0.4";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BACKEND = /^(simulator|qpu\.[a-z0-9][a-z0-9.-]{0,63})$/;
const ARTIFACT = (value) => UUID.test(value || "") || value === "probabilities";
const SUPPORTED_GATES = new Set(["h", "x", "y", "z", "s", "si", "t", "ti", "v", "vi", "rx", "ry", "rz", "cnot", "swap"]);
const approvals = new Map();
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const number = (value, min, max, label) => { if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer from ${min} to ${max}.`); return value; };
const text = (value, max = 200) => String(value ?? "").replace(/[\x00-\x1f\x7f]/g, " ").slice(0, max);

function normalizeCircuit(value) {
  if (typeof value === "string") { if (value.length > 100000) throw new Error("Circuit JSON is too large."); try { value = JSON.parse(value); } catch { throw new Error("Circuit must be valid JSON."); } }
  if (!object(value)) throw new Error("Circuit must be a JSON object.");
  const qubits = number(value.qubits, 1, 10, "Qubits");
  if (value.gateset !== undefined && value.gateset !== "qis") throw new Error("This workspace supports the QIS gateset.");
  if (!Array.isArray(value.circuit) || value.circuit.length > 256) throw new Error("Circuit must have at most 256 gates.");
  for (const key of Object.keys(value)) if (!["qubits", "gateset", "circuit"].includes(key)) throw new Error(`Unsupported circuit field: ${text(key, 40)}.`);
  const circuit = value.circuit.map((entry, index) => {
    if (!object(entry) || !SUPPORTED_GATES.has(entry.gate)) throw new Error(`Gate ${index + 1} is unsupported. Supported: ${[...SUPPORTED_GATES].join(", ")}.`);
    const gate = entry.gate;
    const allowed = gate === "swap" ? ["gate", "targets"] : gate === "cnot" ? ["gate", "target", "control"] : ["gate", "target", ...(["rx", "ry", "rz"].includes(gate) ? ["rotation"] : [])];
    for (const key of Object.keys(entry)) if (!allowed.includes(key)) throw new Error(`Unsupported field on gate ${index + 1}: ${text(key, 40)}.`);
    if (gate === "swap") {
      if (!Array.isArray(entry.targets) || entry.targets.length !== 2) throw new Error("Swap requires exactly two targets.");
      const targets = entry.targets.map((item) => number(item, 0, qubits - 1, "Gate target"));
      if (targets[0] === targets[1]) throw new Error("Swap targets must be different.");
      return { gate, targets };
    }
    const result = { gate, target: number(entry.target, 0, qubits - 1, "Gate target") };
    if (gate === "cnot") { result.control = number(entry.control, 0, qubits - 1, "Control"); if (result.control === result.target) throw new Error("Control and target must be different."); }
    if (["rx", "ry", "rz"].includes(gate)) { if (typeof entry.rotation !== "number" || !Number.isFinite(entry.rotation) || Math.abs(entry.rotation) > 100 * Math.PI) throw new Error("Rotation must be a finite angle in radians within ±100π."); result.rotation = entry.rotation; }
    return result;
  });
  return { qubits, gateset: "qis", circuit };
}

function matrix(gate, angle) {
  const z = [0, 0], one = [1, 0], half = Math.SQRT1_2;
  const phase = (a) => [Math.cos(a), Math.sin(a)];
  if (gate === "h") return [[half, 0], [half, 0], [half, 0], [-half, 0]];
  if (gate === "x") return [z, one, one, z];
  if (gate === "y") return [z, [0, -1], [0, 1], z];
  if (gate === "z") return [one, z, z, [-1, 0]];
  if (["s", "si", "t", "ti"].includes(gate)) return [one, z, z, phase({ s: Math.PI / 2, si: -Math.PI / 2, t: Math.PI / 4, ti: -Math.PI / 4 }[gate])];
  if (gate === "v" || gate === "vi") { const sign = gate === "v" ? 1 : -1; return [[0.5, 0.5 * sign], [0.5, -0.5 * sign], [0.5, -0.5 * sign], [0.5, 0.5 * sign]]; }
  const c = Math.cos(angle / 2), s = Math.sin(angle / 2);
  if (gate === "rx") return [[c, 0], [0, -s], [0, -s], [c, 0]];
  if (gate === "ry") return [[c, 0], [-s, 0], [s, 0], [c, 0]];
  if (gate === "rz") return [phase(-angle / 2), z, z, phase(angle / 2)];
  throw new Error("Unsupported simulation gate.");
}

function simulateCircuit(value, { shots = 1024, seed = 1 } = {}) {
  const input = normalizeCircuit(value);
  shots = number(shots, 1, 4096, "Shots"); seed = number(seed, 0, 0xffffffff, "Seed");
  const length = 2 ** input.qubits, real = new Float64Array(length), imaginary = new Float64Array(length); real[0] = 1;
  for (const gate of input.circuit) {
    if (gate.gate === "cnot" || gate.gate === "swap") {
      for (let i = 0; i < length; i++) {
        let other;
        if (gate.gate === "cnot") { if (!(i & (1 << gate.control))) continue; other = i ^ (1 << gate.target); }
        else { const [a, b] = gate.targets; if (!!(i & (1 << a)) === !!(i & (1 << b))) continue; other = i ^ (1 << a) ^ (1 << b); }
        if (i < other) { [real[i], real[other]] = [real[other], real[i]]; [imaginary[i], imaginary[other]] = [imaginary[other], imaginary[i]]; }
      }
    } else {
      const m = matrix(gate.gate, gate.rotation), bit = 1 << gate.target;
      for (let i = 0; i < length; i++) if (!(i & bit)) {
        const j = i | bit, ar = real[i], ai = imaginary[i], br = real[j], bi = imaginary[j];
        real[i] = m[0][0] * ar - m[0][1] * ai + m[1][0] * br - m[1][1] * bi;
        imaginary[i] = m[0][0] * ai + m[0][1] * ar + m[1][0] * bi + m[1][1] * br;
        real[j] = m[2][0] * ar - m[2][1] * ai + m[3][0] * br - m[3][1] * bi;
        imaginary[j] = m[2][0] * ai + m[2][1] * ar + m[3][0] * bi + m[3][1] * br;
      }
    }
  }
  const probabilities = {}, counts = {}, cumulative = []; let sum = 0;
  for (let i = 0; i < length; i++) { const p = real[i] ** 2 + imaginary[i] ** 2; sum += p; cumulative.push(sum); if (p > 1e-12) probabilities[i.toString(2).padStart(input.qubits, "0")] = p; }
  let random = seed || 0x9e3779b9;
  for (let shot = 0; shot < shots; shot++) {
    random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
    const sample = (random >>> 0) / 0x100000000 * sum; let state = 0;
    while (state < length - 1 && cumulative[state] <= sample) state++;
    const key = state.toString(2).padStart(input.qubits, "0"); counts[key] = (counts[key] || 0) + 1;
  }
  return { input, shots, seed, probabilities, counts, qubitOrder: "Qubit 0 is the least significant (rightmost) bit.", normalization: sum };
}

function fingerprint(input, backend, shots) { return crypto.createHash("sha256").update(JSON.stringify({ input, backend, shots })).digest("hex"); }
function keyFingerprint(key) { return crypto.createHash("sha256").update(key).digest("hex"); }
function cleanPayload(value, apiKey = "", depth = 0) {
  if (depth > 12) return null;
  if (typeof value === "string") return text(apiKey ? value.split(apiKey).join("[redacted]") : value, 4000);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 1024).map((item) => cleanPayload(item, apiKey, depth + 1));
  if (object(value)) { const result = {}; for (const [key, item] of Object.entries(value).slice(0, 1024)) if (!/token|secret|password|credential|authorization|api.?key/i.test(key) && key !== "__proto__" && key !== "constructor" && key !== "prototype") result[text(key)] = cleanPayload(item, apiKey, depth + 1); return result; }
  return null;
}

async function ionqRequest(path, method, body, options) {
  const key = String(options.apiKey || "").trim();
  if (path !== "/backends" && !key) throw new Error("Save your own IonQ API key in the private Vault first.");
  if (key.length > 8192 || /[\s\x00-\x1f]/.test(key)) throw new Error("The IonQ API key is not valid.");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await (options.fetchImpl || fetch)(IONQ_BASE + path, { method, redirect: "error", signal: controller.signal, headers: { Accept: "application/json", ...(key ? { Authorization: `apiKey ${key}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const size = Number(response.headers?.get("content-length") || 0);
    if (size > 1048576) throw new Error("IonQ response exceeds the 1 MiB limit.");
    let raw;
    if (response.body?.getReader) { const reader = response.body.getReader(); const chunks = []; let bytes = 0; try { while (true) { const piece = await reader.read(); if (piece.done) break; bytes += piece.value.byteLength; if (bytes > 1048576) { controller.abort(); throw new Error("IonQ response exceeds the 1 MiB limit."); } chunks.push(Buffer.from(piece.value)); } raw = Buffer.concat(chunks).toString("utf8"); } finally { reader.releaseLock(); } }
    else { raw = await response.text(); if (Buffer.byteLength(raw) > 1048576) throw new Error("IonQ response exceeds the 1 MiB limit."); }
    if (!response.ok) throw new Error(`IonQ request failed (HTTP ${response.status}). Check your key, access, quota, and the selected job.`);
    let json; try { json = JSON.parse(raw); } catch { throw new Error("IonQ returned an invalid JSON response."); }
    return cleanPayload(json, key);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("IonQ request timed out or exceeded its response limit. A submitted job may still exist; check your jobs before submitting again.");
    if (error instanceof Error && /^(IonQ |The IonQ |Save your own)/.test(error.message)) throw error;
    throw new Error("IonQ network request failed. A submitted job may still exist; check your jobs before submitting again.");
  } finally { clearTimeout(timer); }
}

function normalizeJob(value) {
  if (!object(value)) throw new Error("IonQ returned invalid job information.");
  const result = {};
  for (const key of ["id", "status", "backend", "name", "type", "dry_run", "shots", "submitted_at", "started_at", "completed_at", "execution_duration_ms", "stats", "results"]) if (value[key] !== undefined) result[key] = value[key];
  if (value.failure) result.failure = "IonQ reported job failure. View the job in your IonQ account for details.";
  return result;
}

function probabilitiesFromArtifact(artifact, format, qubits) {
  number(qubits, 1, 10, "Result qubits");
  const source = format.endsWith("v2") ? artifact?.probabilities?.registers?.output_all : artifact;
  if (!object(source) || Object.keys(source).length > 1024) throw new Error("Probability artifact must have one output_all register with at most 1024 states.");
  const probabilities = {};
  for (const [state, p] of Object.entries(source)) {
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1) throw new Error("IonQ returned an invalid probability.");
    let key = state;
    if (format.endsWith("v1")) { if (!/^\d+$/.test(state) || Number(state) >= 2 ** qubits) throw new Error("A probability state is outside the circuit's qubit range."); key = Number(state).toString(2).padStart(qubits, "0"); }
    if (!/^[01]{1,10}$/.test(key) || key.length !== qubits) throw new Error("A probability bitstring does not match the circuit's qubit count.");
    probabilities[key] = p;
  }
  const total = Object.values(probabilities).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > 0.01) throw new Error("IonQ probabilities did not sum to one within tolerance.");
  return probabilities;
}

async function runQuantumRequest(request, options = {}) {
  if (!object(request)) throw new Error("Quantum request must be an object.");
  const now = typeof options.now === "function" ? options.now() : Date.now();
  for (const [id, approval] of approvals) if (approval.expiresAt < now) approvals.delete(id);
  const base = { version: "1.0", action: request.action, recordedAt: new Date(now).toISOString(), provenance: "ionq-api-v0.4", warnings: ["A simulator computes a circuit classically. A cloud job does not make the language model run on a quantum processor.", "Public or provider-generated probabilities must not be used as private cryptographic keys."] };
  if (request.action === "local") return { ...base, provenance: "local-ideal-statevector", backend: "local-simulator", status: "completed", ...simulateCircuit(request.circuit, { shots: request.shots ?? 1024, seed: request.seed ?? 1 }), warnings: ["Ideal classical statevector simulation: no noise, physical hardware, or quantum advantage is demonstrated.", "Sample counts are generated by a seeded pseudorandom generator and are reproducible."] };
  if (request.action === "backends") { const data = await ionqRequest("/backends", "GET", null, options); if (!Array.isArray(data)) throw new Error("IonQ returned an invalid backend list."); return { ...base, backends: data.slice(0, 100).map((entry) => { const result = {}; for (const key of ["backend", "qubits", "status", "average_queue_time", "last_updated", "degraded", "supported_gates"]) if (entry[key] !== undefined) result[key] = entry[key]; return result; }) }; }
  if (request.action === "jobs") { const data = await ionqRequest("/jobs?limit=20", "GET", null, options); const jobs = Array.isArray(data) ? data : data.jobs; if (!Array.isArray(jobs)) throw new Error("IonQ returned an invalid job list."); return { ...base, jobs: jobs.slice(0, 20).map(normalizeJob) }; }
  if (["job", "probabilities", "cost", "cancel"].includes(request.action)) {
    if (!UUID.test(String(request.jobId || ""))) throw new Error("Job ID must be an IonQ UUID.");
    const path = `/jobs/${request.jobId}`;
    if (request.action === "cost") return { ...base, jobId: request.jobId, cost: await ionqRequest(path + "/cost", "GET", null, options) };
    if (request.action === "cancel") { if (request.confirmation !== "CANCEL JOB") throw new Error("Confirm cancellation of this specific IonQ job."); return { ...base, jobId: request.jobId, cancellation: await ionqRequest(path + "/status/cancel", "PUT", null, options), warnings: [...base.warnings, "A cancellation request does not guarantee a job was stopped or charges were avoided. Refresh job status."] }; }
    const job = normalizeJob(await ionqRequest(path, "GET", null, options));
    if (request.action === "job") return { ...base, job, backend: job.backend, status: job.status };
    if (job.status !== "completed") throw new Error("This job is not completed. Refresh its status before fetching probabilities.");
    if (job.dry_run) throw new Error("A dry run has no physical measurement results.");
    if (!Number.isInteger(job.stats?.qubits) || job.stats.qubits < 1 || job.stats.qubits > 10) throw new Error("This probability viewer needs a job with a reported count of 1–10 qubits.");
    const format = ["ionq.result.probabilities.json.v2", "ionq.result.probabilities.json.v1"].find((item) => ARTIFACT(job.results?.[item]?.id));
    if (!format) throw new Error("This job has no supported probability artifact yet.");
    const artifactId = job.results[format].id;
    const artifact = await ionqRequest(path + "/artifacts/" + artifactId, "GET", null, options);
    return { ...base, job, backend: job.backend, status: job.status, artifactId, artifactFormat: format, probabilities: probabilitiesFromArtifact(artifact, format, job.stats.qubits), qubitOrder: "Qubit 0 is the least significant (rightmost) bit." };
  }
  if (!["estimate", "submit"].includes(request.action)) throw new Error("Unknown Quantum Zero operation.");
  const input = normalizeCircuit(request.circuit), shots = number(request.shots ?? 1024, 1, 4096, "Shots"), backend = String(request.backend || "simulator");
  if (!BACKEND.test(backend)) throw new Error("Select simulator or an IonQ qpu backend name.");
  const digest = fingerprint(input, backend, shots);
  if (request.action === "estimate") {
    const one = input.circuit.filter((gate) => !["cnot", "swap"].includes(gate.gate)).length;
    const two = input.circuit.reduce((count, gate) => count + (gate.gate === "cnot" ? 1 : gate.gate === "swap" ? 3 : 0), 0);
    const query = new URLSearchParams({ backend, type: "ionq.circuit.v1", qubits: String(input.qubits), shots: String(shots), "1q_gates": String(one), "2q_gates": String(two), error_mitigation: "false" });
    const estimate = await ionqRequest("/jobs/estimate?" + query.toString(), "GET", null, options);
    if (!object(estimate) || typeof estimate.estimated_total_cost !== "number" || !Number.isFinite(estimate.estimated_total_cost) || estimate.estimated_total_cost < 0 || !estimate.estimated_unit) throw new Error("IonQ did not return a usable cost estimate. Hardware submission stays disabled.");
    const approvalToken = crypto.randomUUID();
    if (approvals.size >= 32) approvals.delete(approvals.keys().next().value);
    approvals.set(approvalToken, { digest, key: keyFingerprint(String(options.apiKey || "").trim()), cost: estimate.estimated_total_cost, unit: String(estimate.estimated_unit), expiresAt: now + 10 * 60 * 1000 });
    return { ...base, input, backend, shots, estimate, approvalToken, estimateExpiresAt: new Date(now + 10 * 60 * 1000).toISOString(), warnings: [...base.warnings, "Gate-count estimates are approximate. Actual charges can exceed the estimate; the review ceiling is not a provider-enforced spending limit."] };
  }
  if (backend === "simulator") { if (request.confirmation !== "SUBMIT SIMULATOR") throw new Error("Confirm sending this circuit to the IonQ simulator."); }
  else {
    const approval = approvals.get(request.approvalToken);
    if (!approval || approval.expiresAt <= now || approval.digest !== digest || approval.key !== keyFingerprint(String(options.apiKey || "").trim())) throw new Error("Fetch a fresh cost estimate for this exact circuit, backend, and shot count before submitting hardware.");
    if (request.confirmation !== "SUBMIT HARDWARE" || request.acknowledgeCostMayExceedEstimate !== true) throw new Error("Explicit hardware and possible additional cost approval is required.");
    if (typeof request.maxEstimatedCost !== "number" || !Number.isFinite(request.maxEstimatedCost) || request.maxEstimatedCost < approval.cost || request.costUnit !== approval.unit) throw new Error("The estimate exceeds your review ceiling or uses a different billing unit.");
    approvals.delete(request.approvalToken);
  }
  const job = normalizeJob(await ionqRequest("/jobs", "POST", { type: "ionq.circuit.v1", name: text(request.name || "ZeroThink circuit", 100), backend, shots, input, settings: { error_mitigation: { debiasing: false } } }, options));
  if (!UUID.test(job.id || "")) throw new Error("IonQ returned no usable job ID. Check your jobs before submitting again.");
  return { ...base, input, backend, shots, job, status: job.status, circuitFingerprint: digest, warnings: [...base.warnings, "The job has been submitted once. Check its status manually; no repeated submission or automatic polling is performed."] };
}

module.exports = { IONQ_BASE, SUPPORTED_GATES, normalizeCircuit, simulateCircuit, probabilitiesFromArtifact, runQuantumRequest };
