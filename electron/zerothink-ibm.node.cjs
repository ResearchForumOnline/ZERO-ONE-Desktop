"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { IAM_URL, API_VERSION, REGIONS, normalizeIBMRequest, runIBMQuantumRequest } = require("./zerothink-ibm.cjs");
const KEY = "synthetic-ibm-key", BEARER = "synthetic-bearer", CRN = "crn:v1:bluemix:public:quantum-computing:us-east:a/synthetic-account:synthetic-instance::";
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
const fixture = (data) => { const calls = []; let index = 0; return { calls, fetchImpl: async (url, init) => { calls.push({ url, init }); if (index >= data.length) throw new Error("Unexpected request"); const value = data[index++]; if (value instanceof Error) throw value; return response(value); } }; };
const IAM = { access_token: BEARER, token_type: "Bearer", expires_in: 3600 };

test("IBM read-only discovery uses official IAM exchange and fixed Quantum headers", async () => {
  const mock = fixture([IAM, { devices: [{ name: "ibm_fez", status: { name: "online" }, qubits: 156, queue_length: 2, wait_time_seconds: 60, private: "omitted" }] }]);
  const result = await runIBMQuantumRequest({ action: "backends", instanceCRN: CRN, region: "us-east" }, { ...mock, apiKey: KEY });
  assert.equal(mock.calls.length, 2); assert.equal(mock.calls[0].url, IAM_URL); assert.equal(mock.calls[0].init.method, "POST"); assert.equal(new URLSearchParams(mock.calls[0].init.body).get("apikey"), KEY); assert.equal(new URLSearchParams(mock.calls[0].init.body).get("grant_type"), "urn:ibm:params:oauth:grant-type:apikey");
  assert.equal(mock.calls[1].url, REGIONS["us-east"] + "/backends?fields=wait_time_seconds"); assert.equal(mock.calls[1].init.method, "GET"); assert.equal(mock.calls[1].init.headers.Authorization, "Bearer " + BEARER); assert.equal(mock.calls[1].init.headers["Service-CRN"], CRN); assert.equal(mock.calls[1].init.headers["IBM-API-Version"], API_VERSION); assert.ok(mock.calls.every((call) => call.init.redirect === "error"));
  assert.deepEqual(result.backends, [{ name: "ibm_fez", status: "online", qubits: 156, queue_length: 2, wait_time_seconds: 60 }]); assert.ok(!JSON.stringify(result).includes(KEY)); assert.ok(!JSON.stringify(result).includes(BEARER)); assert.ok(!JSON.stringify(result).includes("synthetic-account"));
});

test("IBM eu-de status uses the selected fixed regional service", async () => {
  const mock = fixture([IAM, { state: true, status: "active", message: "available", length_queue: 14, backend_version: "1.3.24", access_token: BEARER }]);
  const result = await runIBMQuantumRequest({ action: "status", instanceCRN: CRN.replace("us-east", "eu-de"), region: "eu-de", backend: "ibm_fez" }, { ...mock, apiKey: KEY });
  assert.equal(mock.calls[1].url, REGIONS["eu-de"] + "/backends/ibm_fez/status"); assert.equal(result.status.available, true); assert.equal(result.status.queueLength, 14); assert.ok(!JSON.stringify(result).includes(BEARER));
});

test("IBM never permits job submission, arbitrary regions, invalid CRNs or backend traversal", async () => {
  for (const input of [{ action: "submit", instanceCRN: CRN }, { action: "backends", instanceCRN: CRN, region: "https://evil.invalid" }, { action: "backends", instanceCRN: CRN, region: "eu-de" }, { action: "backends", instanceCRN: "invalid" }, { action: "backends", instanceCRN: CRN + "\nHeader:inject" }, { action: "status", instanceCRN: CRN, backend: "../jobs" }]) assert.throws(() => normalizeIBMRequest(input));
  await assert.rejects(() => runIBMQuantumRequest({ action: "backends", instanceCRN: CRN }, { fetchImpl: () => assert.fail("No network") }), /own IBM/);
});

test("IBM rejects invalid IAM bearer data before using the Quantum service", async () => {
  for (const iam of [{}, { access_token: "" }, { access_token: "token\nline" }, { access_token: BEARER, token_type: "Basic" }, { access_token: BEARER, expires_in: 0 }]) {
    const mock = fixture([iam]); await assert.rejects(() => runIBMQuantumRequest({ action: "backends", instanceCRN: CRN }, { ...mock, apiKey: KEY }), /no valid bearer/); assert.equal(mock.calls.length, 1);
  }
});

test("IBM response whitelist and string redaction protect both key and bearer", async () => {
  const mock = fixture([IAM, { devices: [{ name: "ibm_fez", status: { name: "online", reason: KEY + " " + BEARER }, qubits: -1, queue_length: 2, api_key: KEY, authorization: BEARER }] }]);
  const result = await runIBMQuantumRequest({ action: "backends", instanceCRN: CRN }, { ...mock, apiKey: KEY }); assert.equal(result.backends[0].reason, "[redacted] [redacted]"); assert.equal(result.backends[0].qubits, undefined); assert.ok(!JSON.stringify(result).includes(KEY)); assert.ok(!JSON.stringify(result).includes(BEARER));
});

test("IBM network and authentication errors never echo keys and do not retry", async () => {
  const mock = fixture([new Error("Leak " + KEY)]);
  await assert.rejects(() => runIBMQuantumRequest({ action: "backends", instanceCRN: CRN }, { ...mock, apiKey: KEY }), (error) => !error.message.includes(KEY)); assert.equal(mock.calls.length, 1);
  await assert.rejects(() => runIBMQuantumRequest({ action: "backends", instanceCRN: CRN }, { apiKey: KEY, fetchImpl: async () => response({ message: KEY }, 401) }), (error) => error.message.includes("HTTP 401") && !error.message.includes(KEY));
  await assert.rejects(() => runIBMQuantumRequest({ action: "backends", instanceCRN: CRN }, { apiKey: KEY, fetchImpl: async () => new Response("x".repeat(1048577), { headers: { "content-length": "1048577" } }) }), /limit/);
});

test("IBM query reauthenticates on each explicit request and never retains bearer in reports", async () => {
  const mock = fixture([IAM, { devices: [] }, { access_token: "second-synthetic-bearer", expires_in: 3600 }, { devices: [] }]);
  await runIBMQuantumRequest({ action: "backends", instanceCRN: CRN }, { ...mock, apiKey: KEY }); const result = await runIBMQuantumRequest({ action: "backends", instanceCRN: CRN }, { ...mock, apiKey: KEY }); assert.equal(mock.calls.length, 4); assert.equal(mock.calls[2].url, IAM_URL); assert.ok(!JSON.stringify(result).includes("bearer"));
});
