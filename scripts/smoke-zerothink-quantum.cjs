"use strict";
// No BrowserWindow, user account, API key, or cloud request is used in this smoke.
const { app, safeStorage } = require("electron");
const fsSync = require("node:fs"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { runQuantumRequest } = require("../electron/zerothink-quantum.cjs");
const { createStudioStore } = require("../electron/zerothink-studio-store.cjs");
const { isSecureCredentialStorage } = require("../electron/workspace-logins.cjs");
const temporaryRoot = path.resolve(os.tmpdir());
const profileDirectory = fsSync.mkdtempSync(path.join(temporaryRoot, "zeroone-quantum-smoke-"));
app.setName("ZeroOneQuantumSyntheticSmoke"); app.setPath("userData", profileDirectory);
const receiptArg = process.argv.find((arg) => arg.startsWith("--receipt="))?.slice(10);
const receiptPath = receiptArg ? path.resolve(receiptArg) : null;
const repoRoot = path.resolve(__dirname, "..");
if (receiptPath && !receiptPath.startsWith(repoRoot + path.sep)) throw new Error("Smoke receipt must stay inside this checkout.");
async function cleanup() { const resolved = path.resolve(profileDirectory); if (!resolved.startsWith(temporaryRoot + path.sep) || !path.basename(resolved).startsWith("zeroone-quantum-smoke-")) throw new Error("Synthetic cleanup target escaped its temporary directory."); await fs.rm(resolved, { recursive: true, force: true }); }
app.whenReady().then(async () => {
  assert.ok(isSecureCredentialStorage(safeStorage), "Operating-system encrypted storage is available");
  const noNetwork = () => { throw new Error("Local smoke must never contact a cloud service"); };
  const bell = await runQuantumRequest({ action: "local", circuit: { qubits: 2, gateset: "qis", circuit: [{ gate: "h", target: 0 }, { gate: "cnot", control: 0, target: 1 }] }, shots: 512, seed: 123 }, { fetchImpl: noNetwork });
  const ghz = await runQuantumRequest({ action: "local", circuit: { qubits: 4, gateset: "qis", circuit: [{ gate: "h", target: 0 }, { gate: "cnot", control: 0, target: 1 }, { gate: "cnot", control: 1, target: 2 }, { gate: "cnot", control: 2, target: 3 }] }, shots: 512, seed: 123 }, { fetchImpl: noNetwork });
  assert.ok(Math.abs(bell.probabilities["00"] - 0.5) < 1e-10); assert.ok(Math.abs(bell.probabilities["11"] - 0.5) < 1e-10);
  assert.ok(Math.abs(ghz.probabilities["0000"] - 0.5) < 1e-10); assert.ok(Math.abs(ghz.probabilities["1111"] - 0.5) < 1e-10);
  const filePath = path.join(profileDirectory, "synthetic-studio.encrypted.json");
  const configuration = { filePath, storage: safeStorage, secure: () => isSecureCredentialStorage(safeStorage) };
  const store = createStudioStore(configuration), title = "Synthetic quantum report only";
  const documents = [{ id: crypto.randomUUID(), title, text: JSON.stringify(bell) }, { id: crypto.randomUUID(), title: "Synthetic GHZ report only", text: JSON.stringify(ghz) }];
  await store.saveLibrary(documents); assert.deepEqual(await store.listLibrary(), documents);
  const envelope = await fs.readFile(filePath, "utf8"); assert.ok(!envelope.includes(title)); assert.ok(!envelope.includes("local-ideal-statevector")); assert.ok(!envelope.includes("probabilities"));
  const restarted = createStudioStore(configuration); assert.deepEqual(await restarted.listLibrary(), documents);
  await restarted.saveLibrary([]); assert.deepEqual(await restarted.listLibrary(), []);
  const receipt = { electron: process.versions.electron, platform: process.platform, fixtures: "synthetic only", visibleWindowsOpened: 0, cloudRequests: 0, bellStateProbabilitiesVerified: true, ghzStateProbabilitiesVerified: true, seededSampleCountsVerified: Object.values(bell.counts).reduce((a, b) => a + b, 0) === 512, operatingSystemStorageSecure: true, reportEncryptedAtRest: true, studioReportRoundTripMatches: true, studioReloadRoundTripMatches: true, syntheticReportsRemoved: true };
  if (receiptPath) { await fs.mkdir(path.dirname(receiptPath), { recursive: true }); await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 }); }
  console.log(JSON.stringify(receipt));
}).catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await cleanup().catch((error) => { console.error(error.message); process.exitCode = 1; }); app.exit(process.exitCode || 0); });
