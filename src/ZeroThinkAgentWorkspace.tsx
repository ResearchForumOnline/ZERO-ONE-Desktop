import { useEffect, useRef, useState } from "react";

export default function ZeroThinkAgentWorkspace({ settings, onSettings }: { settings: ZeroOneSettings; onSettings: () => void }) {
  const [project, setProject] = useState<{ path: string; name: string } | null>(null);
  const [task, setTask] = useState("");
  const [maxSteps, setMaxSteps] = useState(16);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ZeroThinkAgentProgress | null>(null);
  const [events, setEvents] = useState<ZeroThinkAgentProgress[]>([]);
  const [result, setResult] = useState<ZeroThinkAgentResult | null>(null);
  const [message, setMessage] = useState("Choose a local project, then ask ZeroThink to inspect, fix or build it.");
  const [elapsed, setElapsed] = useState(0);
  const [approvalSendingId, setApprovalSendingId] = useState<string | null>(null);
  const approvalSending = useRef<string | null>(null);
  const runId = useRef("");
  const provider = settings.assistantProvider === "groq" ? "Groq" : settings.assistantProvider === "openai" ? "OpenAI" : settings.openZeroAssistantMode === "server" ? "your OpenZero server" : "local Ollama";
  useEffect(() => window.zeroOne.onZeroThinkAgentProgress((event) => {
    if (event.runId !== runId.current) return;
    setProgress(previous => ({ ...previous, ...event }));
    setEvents(previous => [...previous.slice(-99), event]);
  }), []);
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const interval = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && runId.current) void window.zeroOne.cancelZeroThink(runId.current); };
    window.addEventListener("keydown", escape);
    return () => { window.clearInterval(interval); window.removeEventListener("keydown", escape); };
  }, [busy]);
  const fail = (error: unknown) => setMessage(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "The desktop agent could not finish. Review its tool activity.");
  async function chooseProject() { try { const selected = await window.zeroOne.selectZeroThinkProject(); if (selected) setProject(selected); } catch (error) { fail(error); } }
  async function run() {
    if (!project || !task.trim() || busy) return;
    setBusy(true); setResult(null); setEvents([]); setElapsed(0);
    runId.current = crypto.randomUUID();
    setProgress({ runId: runId.current, status: "model", message: "Preparing the first project action…", step: 0 });
    setMessage(`Working with ${provider}. You can stop with Escape.`);
    try { const value = await window.zeroOne.runZeroThinkAgent({ runId: runId.current, task, maxSteps }); setResult(value); setMessage(value.status === "completed" ? "The agent finished its pass. Review the changed files and command results." : "The task stopped or reached its step budget. Review the activity before continuing."); }
    catch (error) { fail(error); }
    finally { setBusy(false); runId.current = ""; setProgress(current => current ? { ...current, pending: undefined } : null); }
  }
  async function approve(approved: boolean) {
    const actionId = progress?.pending?.actionId;
    if (!actionId || approvalSending.current === actionId) return;
    approvalSending.current = actionId; setApprovalSendingId(actionId);
    try {
      const response = await window.zeroOne.approveZeroThinkAgent(runId.current, actionId, approved);
      if (response.accepted) setProgress(current => current?.pending?.actionId === actionId ? { ...current, pending: undefined, status: "tool", message: approved ? "Approved. Running the selected action…" : "Action declined. Continuing with that result…" } : current);
      else setMessage("That approval no longer matches the pending action. Review the current preview.");
    }
    catch (error) { fail(error); }
    finally { if (approvalSending.current === actionId) { approvalSending.current = null; setApprovalSendingId(null); } }
  }
  const pending = progress?.pending;
  return <section className="zt-agent-desk" aria-label="ZeroThink desktop agent">
    <div className="zt-panel-head"><div><p className="zt-kicker">DESKTOP EXECUTION</p><h2>Ask. Inspect. Change. Verify.</h2></div><button onClick={onSettings}>Configure model</button></div>
    <p className="zt-help">The agent works in your selected project through real file tools and approved commands. It uses {provider}; it needs a working model connection. Project text and tool results are sent to that selected endpoint.</p>
    <div className="zt-project"><button disabled={busy} onClick={chooseProject}>Choose project folder</button><span>{project?.path || "No folder selected"}</span></div>
    <label className="zt-question-label" htmlFor="zt-agent-task">What should ZeroThink do?</label>
    <textarea id="zt-agent-task" value={task} maxLength={12000} disabled={busy} onChange={event => setTask(event.target.value)} placeholder="Inspect this project, fix the note creation bug, then run its existing tests and report exactly what changed…" />
    <div className="zt-run-row"><label>Step budget <select disabled={busy} value={maxSteps} onChange={event => setMaxSteps(Number(event.target.value))}>{[8, 16, 32, 64].map(value => <option key={value} value={value}>{value} actions</option>)}</select></label>{busy ? <button className="zt-stop" onClick={() => void window.zeroOne.cancelZeroThink(runId.current)}>Stop · Esc</button> : <button className="primary-action" disabled={!project || !task.trim()} onClick={run}>Run desktop agent →</button>}</div>
    <p className="zt-help">Reads and searches stay inside the selected folder and exclude common secret files. Writes require review. Commands require review and run with your normal desktop account; a command can access resources outside the project. Each command has a time limit. Choosing a folder does not grant unattended command approval.</p>
    <div role="status" aria-live="polite">{busy ? `${progress?.message} · step ${progress?.step || 0}/${maxSteps} · ${elapsed}s` : message}</div>
    {pending && <section className="zt-agent-approval" aria-label="Review agent action"><h3>{pending.tool === "run_command" ? "Review command" : "Review file change"}</h3><p>{pending.explanation}</p>{pending.command ? <><p>Working folder: {pending.cwd}</p><pre>{pending.command}</pre></> : <><p>{pending.path}</p><details><summary>Existing file</summary><pre>{pending.before || "[New file]"}</pre></details><details open><summary>Proposed file</summary><pre>{pending.after}</pre></details></>}<div><button disabled={approvalSendingId === pending.actionId} onClick={() => approve(false)}>Decline</button><button className="primary-action" disabled={approvalSendingId === pending.actionId} onClick={() => approve(true)}>{approvalSendingId === pending.actionId ? "Sending approval…" : "Approve this action"}</button></div></section>}
    {result && <section className="zt-agent-result"><h3>{result.status === "completed" ? "Pass finished" : "Task unfinished"}</h3><p>{result.reads} reads · {result.edits} edits · {result.commands} commands · {result.errors.filter(error => !error.resolved).length} unresolved tool errors</p><pre>{result.answer}</pre>{result.changedFiles.length > 0 && <><h4>Changed files</h4><ul>{result.changedFiles.map(file => <li key={file}>{file}</li>)}</ul></>}{result.errors.length > 0 && <details><summary>Tool errors</summary><pre>{result.errors.map(error => `${error.step}. ${error.tool}: ${error.message}${error.resolved ? " [resolved]" : ""}`).join("\n")}</pre></details>}</section>}
    {events.length > 0 && <details className="zt-agent-log" open><summary>Live execution activity · last {events.length} events</summary>{events.map((event, index) => <p key={index}><span>{event.step ? `${event.step}. ` : ""}{event.tool || event.status}</span> {event.message}</p>)}</details>}
    {result && result.observations.length > 0 && <details className="zt-agent-result"><summary>Actual tool results and command output</summary>{result.observations.map((observation, index) => <pre key={index}>{JSON.stringify(observation, null, 2)}</pre>)}</details>}
  </section>;
}
