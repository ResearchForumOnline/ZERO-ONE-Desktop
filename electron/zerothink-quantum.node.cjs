"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCircuit, simulateCircuit, probabilitiesFromArtifact, runQuantumRequest, IONQ_BASE } = require("./zerothink-quantum.cjs");
const BELL = { qubits: 2, gateset: "qis", circuit: [{ gate: "h", target: 0 }, { gate: "cnot", control: 0, target: 1 }] };
const JOB = "617a1f8b-59d4-435d-aa33-695433d7155e";
const ARTIFACT = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const KEY = "synthetic-key-only-for-test";
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const fixture = (entries) => { const calls = []; let index = 0; return { calls, fetchImpl: async (url, options) => { calls.push({ url, options }); if (index >= entries.length) throw new Error("Unexpected request"); const entry = entries[index++]; if (entry instanceof Error) throw entry; return response(entry); } }; };

test("local Bell simulation computes entanglement probabilities and seeded samples", async () => {
  const result = await runQuantumRequest({ action: "local", circuit: BELL, shots: 4096, seed: 123 }, { fetchImpl: () => assert.fail("Local simulation must not fetch") });
  assert.equal(result.provenance, "local-ideal-statevector"); close(result.probabilities["00"], 0.5); close(result.probabilities["11"], 0.5);
  assert.equal(Object.keys(result.probabilities).length, 2); assert.equal(Object.values(result.counts).reduce((a, b) => a + b, 0), 4096);
  assert.deepEqual(result.counts, simulateCircuit(BELL, { shots: 4096, seed: 123 }).counts); close(result.normalization, 1);
});

test("GHZ and complex interference use a real statevector", () => {
  const ghz = { qubits: 4, circuit: [{ gate: "h", target: 0 }, { gate: "cnot", control: 0, target: 1 }, { gate: "cnot", control: 1, target: 2 }, { gate: "cnot", control: 2, target: 3 }] };
  const probabilities = simulateCircuit(ghz).probabilities;
  close(probabilities["0000"], 0.5); close(probabilities["1111"], 0.5); assert.equal(Object.keys(probabilities).length, 2);
  for (const angle of [0, Math.PI / 2, Math.PI]) {
    const p = simulateCircuit({ qubits: 1, circuit: [{ gate: "h", target: 0 }, { gate: "rz", target: 0, rotation: angle }, { gate: "h", target: 0 }] }).probabilities;
    close(p["0"] || 0, Math.cos(angle / 2) ** 2); close(p["1"] || 0, Math.sin(angle / 2) ** 2);
  }
});

test("single gates and inverses preserve complex amplitudes and bit order", () => {
  for (const [gate, inverse] of [["y", "y"], ["z", "z"], ["s", "si"], ["t", "ti"], ["v", "vi"]]) {
    const p = simulateCircuit({ qubits: 1, circuit: [{ gate: "h", target: 0 }, { gate, target: 0 }, { gate: inverse, target: 0 }, { gate: "h", target: 0 }] }).probabilities;
    close(p["0"], 1); assert.equal(Object.keys(p).length, 1);
  }
  for (const gate of ["rx", "ry"]) close(simulateCircuit({ qubits: 1, circuit: [{ gate, target: 0, rotation: Math.PI }] }).probabilities["1"], 1);
  const swap = simulateCircuit({ qubits: 3, circuit: [{ gate: "x", target: 0 }, { gate: "swap", targets: [0, 2] }] });
  close(swap.probabilities["100"], 1);
  const noControl = simulateCircuit({ qubits: 2, circuit: [{ gate: "cnot", control: 1, target: 0 }] }); close(noControl.probabilities["00"], 1);
});

test("circuit validation fails closed on bounds, unsupported fields and invalid rotations", () => {
  for (const value of ["{bad", { qubits: 0, circuit: [] }, { qubits: 11, circuit: [] }, { qubits: 2, gateset: "native", circuit: [] }, { qubits: 1, circuit: Array.from({ length: 257 }, () => ({ gate: "h", target: 0 })) }, { qubits: 1, circuit: [{ gate: "h", target: 1 }] }, { qubits: 2, circuit: [{ gate: "h", target: 0, control: 1 }] }, { qubits: 2, circuit: [{ gate: "cnot", control: 0, target: 0 }] }, { qubits: 1, circuit: [{ gate: "rx", target: 0, rotation: Infinity }] }, { qubits: 2, circuit: [{ gate: "swap", targets: [1, 1] }] }, { qubits: 1, circuit: [], metadata: "ignored" }]) assert.throws(() => normalizeCircuit(value));
  assert.throws(() => simulateCircuit(BELL, { shots: 4097 })); assert.throws(() => simulateCircuit(BELL, { seed: -1 }));
});

test("IonQ backends require no key, request fixed origin and expose relevant data only", async () => {
  const mock = fixture([[{ backend: "simulator", status: "available", qubits: 29, token: "must-not-return", organization: "omit" }]]);
  const result = await runQuantumRequest({ action: "backends" }, mock);
  assert.deepEqual(result.backends, [{ backend: "simulator", qubits: 29, status: "available" }]);
  assert.equal(mock.calls[0].url, IONQ_BASE + "/backends"); assert.equal(mock.calls[0].options.redirect, "error"); assert.equal(mock.calls[0].options.headers.Authorization, undefined);
});

test("missing keys and unconfirmed simulator submission never contact IonQ", async () => {
  await assert.rejects(() => runQuantumRequest({ action: "jobs" }, { fetchImpl: () => assert.fail("No request") }), /own IonQ/);
  await assert.rejects(() => runQuantumRequest({ action: "submit", circuit: BELL }, { apiKey: KEY, fetchImpl: () => assert.fail("No request") }), /Confirm/);
  await assert.rejects(() => runQuantumRequest({ action: "job", jobId: "../secret" }, { apiKey: KEY, fetchImpl: () => assert.fail("No request") }), /UUID/);
});

test("explicit simulator submission sends one bounded payload and no automatic retry", async () => {
  const mock = fixture([{ id: JOB, status: "submitted", api_key: KEY, name: KEY }]);
  const result = await runQuantumRequest({ action: "submit", circuit: BELL, backend: "simulator", shots: 100, confirmation: "SUBMIT SIMULATOR" }, { ...mock, apiKey: KEY });
  assert.equal(result.job.id, JOB); assert.equal(mock.calls.length, 1); assert.equal(mock.calls[0].options.headers.Authorization, "apiKey " + KEY);
  const payload = JSON.parse(mock.calls[0].options.body); assert.equal(payload.type, "ionq.circuit.v1"); assert.equal(payload.backend, "simulator"); assert.equal(payload.shots, 100); assert.deepEqual(payload.input, BELL); assert.equal(payload.settings.error_mitigation.debiasing, false);
  assert.ok(!JSON.stringify(result).includes(KEY));
  const failure = fixture([new Error("A network error echoing " + KEY)]);
  await assert.rejects(() => runQuantumRequest({ action: "submit", circuit: BELL, confirmation: "SUBMIT SIMULATOR" }, { ...failure, apiKey: KEY }), (error) => !error.message.includes(KEY));
  assert.equal(failure.calls.length, 1);
});

test("hardware requires real estimate, exact circuit binding, explicit review and matching budget unit", async () => {
  const mock = fixture([{ estimated_total_cost: 12.5, estimated_unit: "usd", estimated_at: "2026-10-01T00:00:00Z" }, { id: JOB, status: "submitted" }]);
  const options = { ...mock, apiKey: KEY, now: () => 1000 };
  const request = { circuit: BELL, backend: "qpu.forte-1", shots: 100 };
  const estimate = await runQuantumRequest({ action: "estimate", ...request }, options);
  const url = new URL(mock.calls[0].url); assert.equal(url.pathname, "/v0.4/jobs/estimate"); assert.equal(url.searchParams.get("1q_gates"), "1"); assert.equal(url.searchParams.get("2q_gates"), "1"); assert.equal(mock.calls[0].options.method, "GET");
  const approval = { action: "submit", ...request, approvalToken: estimate.approvalToken, confirmation: "SUBMIT HARDWARE", maxEstimatedCost: 15, costUnit: "usd", acknowledgeCostMayExceedEstimate: true };
  await assert.rejects(() => runQuantumRequest({ ...approval, shots: 101 }, options), /exact circuit/);
  await assert.rejects(() => runQuantumRequest({ ...approval, costUnit: "credits" }, options), /different billing/);
  await assert.rejects(() => runQuantumRequest({ ...approval, maxEstimatedCost: 10 }, options), /ceiling/);
  await assert.rejects(() => runQuantumRequest({ ...approval, acknowledgeCostMayExceedEstimate: false }, options), /approval/);
  await assert.rejects(() => runQuantumRequest(approval, { ...options, apiKey: "different-synthetic-key" }), /exact circuit/);
  const submitted = await runQuantumRequest(approval, options); assert.equal(submitted.job.id, JOB); assert.equal(mock.calls.length, 2);
  await assert.rejects(() => runQuantumRequest(approval, options), /fresh cost/); assert.equal(mock.calls.length, 2);
});

test("hardware approval expires and is consumed on ambiguous POST failure", async () => {
  const request = { circuit: BELL, backend: "qpu.forte-1", shots: 100 };
  const mock = fixture([{ estimated_total_cost: 1, estimated_unit: "credits" }, new Error("Network failed")]);
  const estimate = await runQuantumRequest({ action: "estimate", ...request }, { ...mock, apiKey: KEY, now: () => 1000 });
  const approval = { action: "submit", ...request, approvalToken: estimate.approvalToken, confirmation: "SUBMIT HARDWARE", maxEstimatedCost: 1, costUnit: "credits", acknowledgeCostMayExceedEstimate: true };
  await assert.rejects(() => runQuantumRequest(approval, { ...mock, apiKey: KEY, now: () => 601000 }), /fresh cost/);
  assert.equal(mock.calls.length, 1);
  const second = fixture([{ estimated_total_cost: 1, estimated_unit: "credits" }, new Error("Network failed")]);
  const other = await runQuantumRequest({ action: "estimate", ...request }, { ...second, apiKey: KEY, now: () => 1000 });
  await assert.rejects(() => runQuantumRequest({ ...approval, approvalToken: other.approvalToken }, { ...second, apiKey: KEY, now: () => 1001 }), /check your jobs/i);
  await assert.rejects(() => runQuantumRequest({ ...approval, approvalToken: other.approvalToken }, { ...second, apiKey: KEY, now: () => 1002 }), /fresh cost/);
  assert.equal(second.calls.length, 2);
});

test("probability fetch uses only supported fixed artifact endpoint and normalizes current v2", async () => {
  const mock = fixture([{ id: JOB, status: "completed", backend: "simulator", stats: { qubits: 2 }, results: { "ionq.result.probabilities.json.v2": { id: ARTIFACT } }, results_url: "https://attacker.invalid/steal" }, { probabilities: { registers: { output_all: { "00": 0.5, "11": 0.5 } } } }]);
  const result = await runQuantumRequest({ action: "probabilities", jobId: JOB }, { ...mock, apiKey: KEY });
  assert.deepEqual(result.probabilities, { "00": 0.5, "11": 0.5 }); assert.equal(mock.calls[1].url, `${IONQ_BASE}/jobs/${JOB}/artifacts/${ARTIFACT}`); assert.ok(mock.calls.every((call) => call.url.startsWith(IONQ_BASE)));
  assert.ok(!JSON.stringify(result).includes("attacker"));
});

test("legacy probability artifact name works without accepting arbitrary URLs or paths", async () => {
  const job = { id: JOB, status: "completed", backend: "simulator", stats: { qubits: 2 }, results: { "ionq.result.probabilities.json.v1": { id: "probabilities" } } };
  const mock = fixture([job, { "0": 0.5, "3": 0.5 }]);
  const result = await runQuantumRequest({ action: "probabilities", jobId: JOB }, { ...mock, apiKey: KEY });
  assert.deepEqual(result.probabilities, { "00": 0.5, "11": 0.5 }); assert.equal(mock.calls[1].url, `${IONQ_BASE}/jobs/${JOB}/artifacts/probabilities`);
  const bad = fixture([{ ...job, results: { "ionq.result.probabilities.json.v1": { id: "../../steal" } } }]);
  await assert.rejects(() => runQuantumRequest({ action: "probabilities", jobId: JOB }, { ...bad, apiKey: KEY }), /no supported/); assert.equal(bad.calls.length, 1);
});

test("probability results reject incomplete jobs, dry runs, oversized qubits and malformed distributions", async () => {
  for (const job of [{ status: "started" }, { status: "completed", dry_run: true }, { status: "completed", stats: { qubits: 11 } }]) {
    const mock = fixture([{ id: JOB, ...job }]); await assert.rejects(() => runQuantumRequest({ action: "probabilities", jobId: JOB }, { ...mock, apiKey: KEY })); assert.equal(mock.calls.length, 1);
  }
  for (const artifact of [{ "0": -0.5, "1": 1.5 }, { "0": 0.2 }, { "1024": 1 }, { "4": 1 }, { bad: 1 }]) assert.throws(() => probabilitiesFromArtifact(artifact, "ionq.result.probabilities.json.v1", 2));
  assert.throws(() => probabilitiesFromArtifact({ probabilities: { registers: { output_all: { "000": 1 } } } }, "ionq.result.probabilities.json.v2", 2));
});

test("jobs and costs are explicit read-only calls with key and private metadata redacted", async () => {
  const mock = fixture([{ jobs: [{ id: JOB, backend: "simulator", status: "completed", metadata: { secret: "private" }, submitter_id: "private-id" }] }, { estimated_cost: { value: 0, unit: "usd" }, cost: { value: 0, unit: "usd" }, api_key: KEY }]);
  const jobs = await runQuantumRequest({ action: "jobs" }, { ...mock, apiKey: KEY }); assert.deepEqual(jobs.jobs, [{ id: JOB, status: "completed", backend: "simulator" }]);
  const cost = await runQuantumRequest({ action: "cost", jobId: JOB }, { ...mock, apiKey: KEY }); assert.ok(!JSON.stringify(cost).includes(KEY)); assert.ok(mock.calls.every((call) => call.options.method === "GET"));
});

test("cancellation requires explicit challenge and uses documented PUT endpoint", async () => {
  const mock = fixture([{ id: JOB, status: "canceled" }]);
  await assert.rejects(() => runQuantumRequest({ action: "cancel", jobId: JOB }, { ...mock, apiKey: KEY }), /Confirm cancellation/); assert.equal(mock.calls.length, 0);
  const result = await runQuantumRequest({ action: "cancel", jobId: JOB, confirmation: "CANCEL JOB" }, { ...mock, apiKey: KEY }); assert.equal(result.cancellation.status, "canceled"); assert.equal(mock.calls[0].options.method, "PUT"); assert.equal(mock.calls[0].url, `${IONQ_BASE}/jobs/${JOB}/status/cancel`);
});

test("HTTP errors and large responses never expose credentials or cause retries", async () => {
  let calls = 0;
  await assert.rejects(() => runQuantumRequest({ action: "jobs" }, { apiKey: KEY, fetchImpl: async () => { calls++; return response({ message: KEY }, 401); } }), (error) => error.message.includes("HTTP 401") && !error.message.includes(KEY)); assert.equal(calls, 1);
  await assert.rejects(() => runQuantumRequest({ action: "jobs" }, { apiKey: KEY, fetchImpl: async () => new Response("x".repeat(1048577), { headers: { "content-length": "1048577" } }) }), /limit/);
  await assert.rejects(() => runQuantumRequest({ action: "jobs" }, { apiKey: "bad\nkey", fetchImpl: () => assert.fail("No request") }), /not valid/);
});
