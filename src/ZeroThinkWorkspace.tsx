import { useEffect, useRef, useState } from "react";
import "./zerothink.css";

type Props = { settings: ZeroOneSettings; storeManaged: boolean; onSettings: () => void };

export default function ZeroThinkWorkspace({ settings, storeManaged, onSettings }: Props) {
  const [question, setQuestion] = useState("");
  const [processes, setProcesses] = useState<ZeroThinkProcess[]>([]);
  const [processId, setProcessId] = useState("evidence-map");
  const [documents, setDocuments] = useState<ZeroThinkDocument[]>([]);
  const [notes, setNotes] = useState<Awaited<ReturnType<Window["zeroOne"]["listNotes"]>>>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [useModel, setUseModel] = useState(false);
  const [maxPasses, setMaxPasses] = useState(3);
  const [result, setResult] = useState<ZeroThinkResult | null>(null);
  const [progress, setProgress] = useState<ZeroThinkProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Add your sources or start with a research question.");
  const [elapsed, setElapsed] = useState(0);
  const runId = useRef("");
  const started = useRef(0);
  const providerLabel = settings.assistantProvider === "groq" ? "Groq" : settings.assistantProvider === "openai" ? "OpenAI" : settings.openZeroAssistantMode === "server" ? "Your OpenZero server" : "Local Ollama";
  const blockedLocal = storeManaged && settings.assistantProvider === "openzero" && settings.openZeroAssistantMode !== "server";

  useEffect(() => {
    window.zeroOne.getZeroThinkProcesses().then((value) => {
      setProcesses(value);
      if (value.length && !value.some((entry) => entry.id === "evidence-map")) setProcessId(value[0].id);
    }).catch(() => setMessage("ZeroThink could not load its research processes. Restart ZERO ONE."));
    return window.zeroOne.onZeroThinkProgress((event) => {
      if (event.runId === runId.current) setProgress(event);
    });
  }, []);

  useEffect(() => {
    if (!busy) return;
    const interval = window.setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, [busy]);

  useEffect(() => {
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && runId.current) void window.zeroOne.cancelZeroThink(runId.current);
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, []);

  async function importFiles() {
    try {
      const imported = await window.zeroOne.importZeroThinkDocuments();
      if (!imported.length) return;
      const merged = [...documents, ...imported];
      if (merged.length > 8 || merged.reduce((sum, doc) => sum + new TextEncoder().encode(doc.text).length, 0) > 2 * 1024 * 1024) throw new Error("This workspace accepts up to 8 sources and 2 MB of text. Remove a source first.");
      setDocuments(merged);
      setMessage(`Imported ${imported.length} local source${imported.length === 1 ? "" : "s"}. Review the excerpts before using a model.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The sources could not be imported."); }
  }

  async function openNotes() {
    try { setNotes(await window.zeroOne.listNotes()); setShowNotes(true); }
    catch { setMessage("ZNotes could not be opened. Secure operating-system storage must be available."); }
  }

  function addNote(note: typeof notes[number]) {
    if (documents.length >= 8) { setMessage("This workspace accepts up to 8 sources. Remove a source first."); return; }
    if (documents.some((doc) => doc.id === note.id)) return;
    const merged = [...documents, { id: note.id, title: note.title, text: note.content }];
    if (merged.reduce((sum, doc) => sum + new TextEncoder().encode(doc.text).length, 0) > 2 * 1024 * 1024) { setMessage("The combined source text exceeds 2 MB."); return; }
    setDocuments(merged);
  }

  async function run() {
    if (!question.trim() || busy) return;
    runId.current = crypto.randomUUID();
    started.current = Date.now();
    setBusy(true); setElapsed(0); setResult(null);
    setProgress({ runId: runId.current, stage: "prepare", status: "running", message: "Preparing your question and selected sources…", pass: 0, maxPasses });
    setMessage(useModel ? `Starting with ${providerLabel}. Selected source text will be sent to that endpoint.` : "Building a local evidence map. No model or network request is needed.");
    try {
      const answer = await window.zeroOne.runZeroThink({ runId: runId.current, question, mode: "research", processId, documents, maxPasses: useModel ? maxPasses : 1, tokenBudget: 3072, useModel });
      setResult(answer);
      setMessage(answer.status === "offline" ? "Local evidence map complete. Enable your selected model for an optional draft and review." : "Research passes complete. Inspect the evidence and citation warnings before relying on the answer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "The research run could not finish.");
    } finally { setBusy(false); runId.current = ""; }
  }

  async function saveReport() {
    if (!result) return;
    try {
      await window.zeroOne.saveNote({ id: crypto.randomUUID(), title: `ZeroThink: ${result.question.slice(0, 100)}`, content: result.markdown });
      setMessage("Report saved as an encrypted ZNote on this device.");
    } catch { setMessage("The report could not be saved. Check that secure storage is available."); }
  }

  async function exportReport(format: "markdown" | "json") {
    if (!result) return;
    try {
      const saved = await window.zeroOne.exportZeroThinkReport({ format, result });
      if (saved.saved) setMessage("Report exported to your chosen file. Exports are readable plaintext; keep private reports in a protected folder.");
    } catch { setMessage("The export could not be written."); }
  }

  const activeProcess = processes.find((entry) => entry.id === processId);
  return <section className="zerothink-workspace" aria-label="ZeroThink research workspace">
    <header className="zt-hero">
      <div><p className="zt-kicker">LOCAL RESEARCH WORKSPACE</p><h1>ZeroThink<span>From question to evidence.</span></h1><p>Your documents, your model, your work. Search sources and build evidence maps offline, or ask your chosen model to draft, critique and revise.</p></div>
      <div className="zt-local-badge"><span>◉</span><strong>SELF HOSTED</strong><small>No hosted account or company server required</small></div>
    </header>
    <div className="zt-layout">
      <aside className="zt-sources glass-card">
        <div className="zt-panel-head"><h2>Source library</h2><span>{documents.length}/8</span></div>
        <p className="zt-help">Only sources you select enter this session. Nothing is saved automatically.</p>
        <div className="zt-source-actions"><button onClick={importFiles} disabled={busy}>＋ Import files</button><button onClick={openNotes} disabled={busy}>From ZNotes</button></div>
        <small className="zt-file-types">Text, Markdown, JSON, CSV · 1 MB each · 2 MB total</small>
        {showNotes && <div className="zt-note-picker"><div className="zt-panel-head"><strong>Select a note</strong><button onClick={() => setShowNotes(false)} aria-label="Close note picker">×</button></div>{notes.length ? notes.map((note) => <button key={note.id} onClick={() => addNote(note)} disabled={busy || documents.some((doc) => doc.id === note.id)}>{note.title}<small>{note.content.length.toLocaleString()} characters</small></button>) : <p>No saved ZNotes yet.</p>}</div>}
        <div className="zt-source-list">{documents.map((doc, index) => <article key={`${doc.id}-${index}`}><div><span>S{index + 1}</span><strong>{doc.title}</strong><button disabled={busy} aria-label={`Remove source ${index + 1}`} onClick={() => setDocuments((current) => current.filter((_, at) => at !== index))}>×</button></div><details><summary>Preview source · {doc.text.length.toLocaleString()} characters</summary><pre>{doc.text.slice(0, 6000)}{doc.text.length > 6000 ? "\n[Preview shortened; the engine retrieves bounded excerpts.]" : ""}</pre></details></article>)}</div>
        {!documents.length && <div className="zt-empty-library"><span>⌕</span><strong>Start with your evidence</strong><p>Import a paper’s text, project notes or a research dataset. The source ledger stays inspectable.</p></div>}
        <div className="zt-source-footer">Source text is held in memory for this workspace. Save a completed report to ZNotes to keep it.</div>
      </aside>
      <div className="zt-main">
        <section className="zt-request glass-card">
          <label className="zt-question-label" htmlFor="zt-question">What do you want to investigate?</label>
          <textarea id="zt-question" maxLength={12000} value={question} disabled={busy} onChange={(event) => setQuestion(event.target.value)} placeholder="Compare the claims in these sources, find gaps, and propose a testable next step…" />
          <div className="zt-controls"><label>Research process<select value={processId} disabled={busy} onChange={(event) => setProcessId(event.target.value)}>{processes.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label><label>Model passes<select value={maxPasses} disabled={busy || !useModel} onChange={(event) => setMaxPasses(Number(event.target.value))}><option value={1}>1 · Draft</option><option value={2}>2 · Draft + revision</option><option value={3}>3 · Draft + critique + revision</option></select></label></div>
          {activeProcess && <p className="zt-process-description">{activeProcess.description}</p>}
          <div className="zt-model-choice"><label><input type="checkbox" checked={useModel} disabled={busy || blockedLocal} onChange={(event) => setUseModel(event.target.checked)} />Use {providerLabel}</label><button onClick={onSettings}>Configure model</button></div>
          <p className="zt-help">{blockedLocal ? "This Store edition works offline immediately. Configure your own OpenZero server, Groq or OpenAI for optional model passes." : useModel ? `Your question and retrieved source excerpts are sent only to ${providerLabel}. No automatic provider fallback. Up to 3,072 requested output tokens per run.` : "Offline mode searches the selected documents and generates an evidence map and research checklist. It does not generate a model answer or browse the web."}</p>
          <div className="zt-run-row"><div role="status" aria-live="polite">{busy ? `${progress?.message || "Working…"} · ${elapsed}s` : message}</div>{busy ? <button className="zt-stop" onClick={() => void window.zeroOne.cancelZeroThink(runId.current)}>Stop · Esc</button> : <button className="primary-action" disabled={!question.trim()} onClick={run}>{useModel ? "Start research →" : "Build evidence map →"}</button>}</div>
          {busy && <div className="zt-progress"><span style={{ width: `${Math.max(8, (progress?.pass || 0) / maxPasses * 100)}%` }} /></div>}
        </section>
        {result ? <section className="zt-result glass-card"><div className="zt-panel-head"><div><p className="zt-kicker">{result.status === "offline" ? "LOCAL EVIDENCE MAP" : "RESEARCH REPORT"}</p><h2>Your working result</h2></div><span>{result.metrics.passes} model passes</span></div><div className="zt-result-actions"><button onClick={saveReport}>Save to encrypted ZNotes</button><button onClick={() => exportReport("markdown")}>Export Markdown</button><button onClick={() => exportReport("json")}>Export JSON</button></div><pre className="zt-answer">{result.answer}</pre>{result.warnings.length > 0 && <div className="zt-warnings" role="status"><strong>Review notes</strong><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<div className="zt-evidence-head"><h3>Evidence ledger</h3><span>{result.evidence.length} retrieved excerpts</span></div>{result.evidence.map((entry, index) => <details className="zt-evidence" key={`${entry.chunkId}-${index}`}><summary><b>[{entry.sourceId}]</b> {entry.title}</summary>{entry.sourceUrl && <span className="zt-source-url">{entry.sourceUrl}</span>}<pre>{entry.excerpt}</pre></details>)}{!result.evidence.length && <p className="zt-help">No matching source excerpts. Add relevant source material to ground this question.</p>}<p className="zt-help">Citation checks establish whether a referenced source ID exists in this workspace. They do not establish that a scientific claim is true.</p></section> : <section className="zt-intro glass-card"><span>↗</span><h2>A research desk you control.</h2><div><article><b>01</b><strong>Bring your sources</strong><p>Import local files or selected encrypted notes. Inspect what the engine will use.</p></article><article><b>02</b><strong>Follow the evidence</strong><p>Deterministic retrieval assigns source IDs and builds a useful map without an API.</p></article><article><b>03</b><strong>Review and keep</strong><p>Optional model passes challenge the draft. Export the ledger or save the report locally.</p></article></div></section>}
      </div>
    </div>
  </section>;
}
