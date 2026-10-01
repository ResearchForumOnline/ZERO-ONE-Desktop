import { useState } from "react";

type Props = { onOpenVault: () => void; onSaveReport?: (title: string, text: string) => Promise<void> };
const BELL: ZeroThinkQuantumCircuit = { qubits: 2, gateset: "qis", circuit: [{ gate: "h", target: 0 }, { gate: "cnot", control: 0, target: 1 }] };
const GHZ: ZeroThinkQuantumCircuit = { qubits: 4, gateset: "qis", circuit: [{ gate: "h", target: 0 }, { gate: "cnot", control: 0, target: 1 }, { gate: "cnot", control: 1, target: 2 }, { gate: "cnot", control: 2, target: 3 }] };
const INTERFERENCE: ZeroThinkQuantumCircuit = { qubits: 1, gateset: "qis", circuit: [{ gate: "h", target: 0 }, { gate: "rz", target: 0, rotation: Math.PI / 2 }, { gate: "h", target: 0 }] };
function errorText(error: unknown) { return error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "") : "Quantum request could not finish."; }
function reportText(result: ZeroThinkQuantumResult) { const { approvalToken: _approval, ...publicReport } = result; return JSON.stringify(publicReport, null, 2); }

function IBMDiscovery({ onOpenVault, onSaveReport }: Props) {
  const [instanceCRN, setInstanceCRN] = useState(""), [region, setRegion] = useState<"us-east" | "eu-de">("us-east"), [backend, setBackend] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("Save your own IBM Quantum key in the Vault, then enter your service instance CRN to inspect its backends."), [result, setResult] = useState<ZeroThinkIBMResult | null>(null);
  const [devices, setDevices] = useState<NonNullable<ZeroThinkIBMResult["backends"]>>([]);
  async function run(action: "backends" | "status") {
    setBusy(true); setMessage("Authenticating with IBM IAM and reading the selected Quantum service…");
    try { const bridge = window.zeroOne as typeof window.zeroOne & ZeroThinkIBMBridge; if (!bridge.quantumZeroThinkIBM) throw new Error("IBM discovery requires the updated desktop app."); const value = await bridge.quantumZeroThinkIBM({ action, instanceCRN, region, ...(action === "status" ? { backend } : {}) }); setResult(value); if (value.backends) { setDevices(value.backends); setBackend(value.backends[0]?.name || ""); } setMessage("IBM read-only response received. No jobs were submitted and no automatic polling is running."); }
    catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  async function save() {
    if (!result) return;
    setBusy(true);
    try { const title = `IBM Quantum · ${result.action} · ${result.recordedAt.slice(0, 10)}`, text = JSON.stringify(result, null, 2); if (onSaveReport) await onSaveReport(title, text); else { const library = await window.zeroOne.listZeroThinkLibrary(); if (library.length >= 32) throw new Error("Remove a library document before saving another report."); await window.zeroOne.saveZeroThinkLibrary([...library, { id: crypto.randomUUID(), title, text }]); } setMessage("IBM backend evidence saved to your encrypted Zero Library."); }
    catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  return <section className="zt-quantum-card" aria-label="IBM Quantum read-only discovery"><div className="zt-studio-header"><div><p>IBM QUANTUM · BACKEND DISCOVERY</p><h2>Your IBM instance</h2></div><button onClick={onOpenVault}>IBM key · Private Vault</button></div>
    <p>Read the backends available to your own IBM Quantum service and check queue status. This workspace does not submit IBM hardware jobs.</p>
    <label>Instance CRN<input value={instanceCRN} maxLength={512} autoComplete="off" spellCheck={false} disabled={busy} placeholder="crn:v1:bluemix:public:quantum-computing:us-east:a/…:…::" onChange={(event) => { setInstanceCRN(event.target.value); setDevices([]); setBackend(""); }} /></label>
    <small>The CRN comes from your IBM Quantum Instances page. It remains in memory for this app session; it is not saved in plaintext. API keys stay in your private Vault.</small>
    <label>Instance region<select value={region} disabled={busy} onChange={(event) => { setRegion(event.target.value as "us-east" | "eu-de"); setDevices([]); setBackend(""); }}><option value="us-east">US East</option><option value="eu-de">Germany · eu-de</option></select></label>
    <button disabled={busy || !instanceCRN} onClick={() => void run("backends")}>Load my IBM backends</button>
    {devices.length > 0 && <><label>Select backend<select value={backend} disabled={busy} onChange={(event) => setBackend(event.target.value)}>{devices.map((device) => <option key={device.name} value={device.name}>{device.name} · {device.status}{device.qubits !== undefined ? ` · ${device.qubits} qubits` : ""}</option>)}</select></label><button disabled={busy || !backend} onClick={() => void run("status")}>Refresh selected backend status</button><div className="zt-quantum-jobs">{devices.map((device) => <div key={device.name}><strong>{device.name} · {device.status}</strong><p>{device.qubits !== undefined ? `${device.qubits} qubits · ` : ""}{device.queue_length !== undefined ? `${device.queue_length} queued jobs` : ""}{device.wait_time_seconds !== undefined ? ` · estimated wait ${device.wait_time_seconds}s` : ""}</p>{device.reason && <small>{device.reason}</small>}</div>)}</div></>}
    <p role="status" aria-live="polite">{busy ? "● " : ""}{message}</p>
    {result && <><div className="zt-chat-actions"><button disabled={busy} onClick={() => void save()}>Save IBM evidence to library</button><button disabled={busy} onClick={() => void window.zeroOne.copyZeroThinkText(JSON.stringify(result, null, 2)).then(() => setMessage("IBM evidence JSON copied.")).catch((error) => setMessage(errorText(error)))}>Copy evidence JSON</button></div>{result.status && <p><strong>{result.backend} · {result.status.status}</strong> · {result.status.message}{result.status.queueLength !== undefined ? ` · ${result.status.queueLength} queued jobs` : ""}</p>}{result.warnings.map((warning) => <p key={warning}><small>{warning}</small></p>)}<details><summary>Inspect IBM evidence report</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(result, null, 2)}</pre></details></>}
  </section>;
}

export default function ZeroThinkQuantum({ onOpenVault, onSaveReport }: Props) {
  const [lane, setLane] = useState<"ionq" | "ibm">("ionq");
  const [circuit, setCircuit] = useState(JSON.stringify(BELL, null, 2));
  const [shots, setShots] = useState(1024), [seed, setSeed] = useState(1), [backend, setBackend] = useState("simulator"), [name, setName] = useState("ZeroThink Bell experiment");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("Run a local experiment immediately. Add your own IonQ key in the Vault to inspect cloud jobs or submit a circuit.");
  const [result, setResult] = useState<ZeroThinkQuantumResult | null>(null), [estimate, setEstimate] = useState<ZeroThinkQuantumResult | null>(null);
  const [backends, setBackends] = useState<NonNullable<ZeroThinkQuantumResult["backends"]>>([]), [jobs, setJobs] = useState<ZeroThinkQuantumJob[]>([]), [jobId, setJobId] = useState("");
  const [review, setReview] = useState<"simulator" | "hardware" | "cancel" | null>(null), [confirmation, setConfirmation] = useState(""), [ceiling, setCeiling] = useState(""), [acknowledge, setAcknowledge] = useState(false);
  const [saved, setSaved] = useState(false);
  const request = { circuit, shots, seed, backend, name };
  const hardware = backend !== "simulator";
  function resetReview() { setEstimate(null); setReview(null); setConfirmation(""); setAcknowledge(false); }
  function preset(value: ZeroThinkQuantumCircuit, title: string) { setCircuit(JSON.stringify(value, null, 2)); setName(title); resetReview(); }
  async function run(input: ZeroThinkQuantumRequest) {
    setBusy(true); setSaved(false); setMessage(input.action === "local" ? "Calculating the circuit on this device…" : "Contacting IonQ once using your private vault key…");
    try {
      const bridge = window.zeroOne as typeof window.zeroOne & ZeroThinkQuantumBridge;
      if (!bridge.quantumZeroThinkRequest) throw new Error("Quantum Zero requires the updated desktop app.");
      const value = await bridge.quantumZeroThinkRequest(input);
      setResult(value);
      if (value.backends) setBackends(value.backends);
      if (value.jobs) setJobs(value.jobs);
      if (value.job?.id) setJobId(value.job.id);
      if (value.estimate) { setEstimate(value); setCeiling(String(value.estimate.estimated_total_cost)); }
      if (input.action === "submit" || input.action === "cancel") { setReview(null); setConfirmation(""); setEstimate(null); }
      setMessage(input.action === "local" ? "Local simulation finished. Probabilities are ideal; counts are reproducible seeded samples." : input.action === "submit" ? `IonQ accepted job ${value.job?.id}. Use Refresh status to follow it; nothing is automatically resubmitted.` : "IonQ response received. No automatic polling is running.");
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  async function saveReport() {
    if (!result) return;
    setBusy(true);
    try {
      const title = `Quantum Zero · ${result.backend || result.action} · ${result.recordedAt.slice(0, 10)}`;
      if (onSaveReport) await onSaveReport(title, reportText(result));
      else { const existing = await window.zeroOne.listZeroThinkLibrary(); if (existing.length >= 32) throw new Error("Your library has 32 documents. Remove one before saving this report."); await window.zeroOne.saveZeroThinkLibrary([...existing, { id: crypto.randomUUID(), title, text: reportText(result) }]); }
      setSaved(true); setMessage("Report saved to your encrypted Zero Library. Select it in Research to ask questions about the evidence.");
    } catch (error) { setMessage(errorText(error)); } finally { setBusy(false); }
  }
  const states = Object.entries(result?.probabilities || {}).sort((a, b) => b[1] - a[1]);
  const availableBackends = [...new Set(["simulator", ...backends.map((item) => item.backend).filter((item) => /^qpu\.[a-z0-9.-]+$/.test(item)), ...(hardware ? [backend] : [])])];
  const requiredConfirmation = review === "cancel" ? "CANCEL JOB" : review === "hardware" ? "SUBMIT HARDWARE" : "SUBMIT SIMULATOR";
  return <div className="zt-quantum-workspace" style={{ padding: "20px", overflowY: "auto", minHeight: 0 }}>
    <header className="zt-studio-header"><div><p>QUANTUM ZERO · NATIVE EXPERIMENTS</p><h1>Circuit lab & IonQ</h1></div><button onClick={onOpenVault}>IonQ key · Private Vault</button></header>
    <div className="zt-chat-actions"><button disabled={busy} className={lane === "ionq" ? "active" : ""} onClick={() => setLane("ionq")}>Local circuits & IonQ</button><button disabled={busy} className={lane === "ibm" ? "active" : ""} onClick={() => setLane("ibm")}>IBM Quantum · discovery</button></div>
    <div hidden={lane !== "ibm"}><IBMDiscovery onOpenVault={onOpenVault} onSaveReport={onSaveReport} /></div>
    <div hidden={lane !== "ionq"}>
    <p>Use the local ideal simulator without a key. Your own IonQ account connects cloud simulation, hardware cost review, job status, probabilities, and billing evidence.</p>
    <div className="zt-quantum-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: "18px" }}>
      <section className="zt-quantum-card" aria-label="Quantum circuit editor">
        <h2>Build an experiment</h2>
        <div className="zt-chat-actions"><button disabled={busy} onClick={() => preset(BELL, "ZeroThink Bell experiment")}>Bell pair</button><button disabled={busy} onClick={() => preset(GHZ, "ZeroThink GHZ experiment")}>4-qubit GHZ</button><button disabled={busy} onClick={() => preset(INTERFERENCE, "ZeroThink interference experiment")}>Interference</button></div>
        <label>Experiment name<input value={name} maxLength={100} disabled={busy} onChange={(event) => setName(event.target.value)} /></label>
        <label>Circuit JSON<textarea className="zt-quantum-editor" value={circuit} disabled={busy} spellCheck={false} rows={15} style={{ width: "100%", boxSizing: "border-box", fontFamily: "monospace" }} onChange={(event) => { setCircuit(event.target.value); resetReview(); }} /></label>
        <small>1–10 qubits · up to 256 gates · h, x, y, z, s, si, t, ti, v, vi, rx, ry, rz, cnot, swap. Rotation angles are radians. Qubit 0 is the rightmost bit.</small>
        <div className="zt-quantum-fields"><label>Shots<input type="number" value={shots} min={1} max={4096} disabled={busy} onChange={(event) => { setShots(Number(event.target.value)); resetReview(); }} /></label><label>Local sample seed<input type="number" value={seed} min={0} max={4294967295} disabled={busy} onChange={(event) => setSeed(Number(event.target.value))} /></label></div>
        <button className="zt-new-chat" disabled={busy} onClick={() => void run({ action: "local", ...request })}>▶ Run locally · no API key</button>
      </section>
      <section className="zt-quantum-card" aria-label="IonQ cloud controls">
        <h2>Your IonQ workspace</h2>
        <div className="zt-chat-actions"><button disabled={busy} onClick={() => void run({ action: "backends" })}>Fetch backends</button><button disabled={busy} onClick={() => void run({ action: "jobs" })}>Load my recent jobs</button></div>
        <label>Cloud backend<select value={backend} disabled={busy} onChange={(event) => { setBackend(event.target.value); resetReview(); }}>{availableBackends.map((item) => <option key={item} value={item}>{item === "simulator" ? "IonQ cloud simulator" : item}</option>)}</select></label>
        {!backends.length && <small>Fetch backends to see the current hardware choices and availability.</small>}
        {backends.find((item) => item.backend === backend) && <p>{backends.find((item) => item.backend === backend)?.status} · {backends.find((item) => item.backend === backend)?.qubits} qubits</p>}
        <div className="zt-chat-actions"><button disabled={busy} onClick={() => void run({ action: "estimate", ...request })}>Get current cost estimate</button><button disabled={busy || (hardware && !estimate)} onClick={() => { setReview(hardware ? "hardware" : "simulator"); setConfirmation(""); setAcknowledge(false); }}>Review {hardware ? "hardware" : "cloud simulation"} submission</button></div>
        {estimate?.estimate && <div className="zt-quantum-estimate"><strong>Estimate: {estimate.estimate.estimated_total_cost} {estimate.estimate.estimated_unit}</strong><p>For this exact circuit, target and shot count. Review expires at {estimate.estimateExpiresAt ? new Date(estimate.estimateExpiresAt).toLocaleTimeString() : "unknown"}. Actual charges may differ.</p></div>}
        {review && <section className="zt-quantum-review" aria-label="Confirm IonQ operation"><h3>{review === "cancel" ? "Cancel the selected job" : `Review ${review} submission`}</h3><p>{review === "cancel" ? `Request cancellation of ${jobId}. Partial execution may still be billed.` : `Send the displayed circuit once to ${backend} using ${shots} shots. IonQ receives the circuit and experiment name.`}</p>
          {review === "hardware" && <><label>Estimate review ceiling ({estimate?.estimate?.estimated_unit})<input type="number" min={0} step="any" value={ceiling} disabled={busy} onChange={(event) => setCeiling(event.target.value)} /></label><label className="zt-quantum-check"><input type="checkbox" checked={acknowledge} disabled={busy} onChange={(event) => setAcknowledge(event.target.checked)} />I approve this hardware job and understand actual billing may exceed the estimate. This review ceiling is not a provider spending limit.</label></>}
          <label>Type {requiredConfirmation}<input value={confirmation} disabled={busy} autoComplete="off" onChange={(event) => setConfirmation(event.target.value)} /></label>
          <div className="zt-chat-actions"><button disabled={busy || confirmation !== requiredConfirmation || (review === "hardware" && (!acknowledge || !estimate || ceiling === ""))} onClick={() => void run(review === "cancel" ? { action: "cancel", jobId, confirmation } : { action: "submit", ...request, confirmation, ...(review === "hardware" ? { approvalToken: estimate?.approvalToken, maxEstimatedCost: Number(ceiling), costUnit: estimate?.estimate?.estimated_unit, acknowledgeCostMayExceedEstimate: acknowledge } : {}) })}>{review === "cancel" ? "Request cancellation" : "Submit this job once"}</button><button disabled={busy} onClick={() => setReview(null)}>Close review</button></div>
        </section>}
        <h3>Inspect a job</h3><label>IonQ job ID<input placeholder="Job UUID" value={jobId} disabled={busy} onChange={(event) => { setJobId(event.target.value); setReview(null); }} /></label>
        <div className="zt-chat-actions"><button disabled={busy || !jobId} onClick={() => void run({ action: "job", jobId })}>Refresh status</button><button disabled={busy || !jobId} onClick={() => void run({ action: "probabilities", jobId })}>Fetch probabilities</button><button disabled={busy || !jobId} onClick={() => void run({ action: "cost", jobId })}>Get billed cost</button><button disabled={busy || !jobId} onClick={() => { setReview("cancel"); setConfirmation(""); }}>Cancel job…</button></div>
        {jobs.length > 0 && <div className="zt-quantum-jobs">{jobs.map((job) => <button key={job.id} disabled={busy} onClick={() => { setJobId(job.id); setReview(null); }}><strong>{job.name || job.id}</strong><small>{job.backend} · {job.status} · {job.id}</small></button>)}</div>}
      </section>
    </div>
    <p className="zt-status" role="status" aria-live="polite">{busy ? "● " : ""}{message}</p>
    {result && <section className="zt-quantum-card zt-quantum-results" aria-label="Quantum experiment results"><div className="zt-studio-header"><div><p>{result.provenance === "local-ideal-statevector" ? "LOCAL CLASSICAL SIMULATION" : result.backend === "simulator" ? "IONQ CLOUD SIMULATION" : "IONQ API EVIDENCE"}</p><h2>{result.backend || result.action}{result.status ? ` · ${result.status}` : ""}</h2></div><div className="zt-chat-actions"><button disabled={busy || saved} onClick={() => void saveReport()}>{saved ? "Saved in library" : "Save report to library"}</button><button disabled={busy} onClick={() => void window.zeroOne.copyZeroThinkText(reportText(result)).then(() => setMessage("JSON report copied. It contains experiment data; share it only when you intend to.")).catch((error) => setMessage(errorText(error)))}>Copy JSON report</button></div></div>
      {states.length > 0 && <div className="zt-quantum-probabilities">{states.slice(0, 32).map(([state, probability]) => <div className="zt-quantum-state" key={state} style={{ display: "grid", gridTemplateColumns: "90px 1fr 100px", gap: "12px", alignItems: "center", padding: "6px 0" }}><code>|{state}⟩</code><meter min={0} max={1} value={probability} style={{ width: "100%" }} aria-label={`Probability of ${state}`} /><span>{(probability * 100).toFixed(3)}%{result.counts ? ` · ${result.counts[state] || 0}` : ""}</span></div>)}{states.length > 32 && <p>Showing the 32 most probable states. The full distribution is in the JSON report.</p>}</div>}
      {result.warnings.map((warning) => <p key={warning}><small>{warning}</small></p>)}
      <details><summary>Inspect full evidence report</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reportText(result)}</pre></details>
    </section>}
    </div>
  </div>;
}
