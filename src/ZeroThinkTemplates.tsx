import { useEffect, useState } from "react";

type Props = { onUse: (question: string, processId?: string) => void; busy?: boolean };
const bridge = () => window.zeroOne as typeof window.zeroOne & ZeroThinkTemplateAPI;
const processNames: Array<[string, string]> = [["custom", "Custom workflow"], ["paper-draft", "Paper draft"], ["literature-review", "Literature review"], ["evidence-map", "Evidence map"], ["expert-discovery", "Expert discovery"], ["collaboration-plan", "Collaboration plan"], ["study-plan", "Study plan"], ["gap-analysis", "Gap analysis"], ["claim-ledger", "Claim ledger"]];
const emptyEditor = (): ZeroThinkTemplateInput => ({ name: "", description: "", kind: "custom", processId: "custom", stages: ["Define purpose", "Compare selected evidence", "Draft", "Review limitations"], requiredSources: ["Selected library sources"], validationChecks: ["Keep supplied source IDs", "Do not invent results or citations"] });
function failure(error: unknown) { return error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "") : "The research workspace could not finish this operation."; }
const FIELD_LABELS: Array<[string, string, number]> = [["title", "Title / scenario", 180], ["problem", "Research question or problem", 1800], ["method", "Methods or proposed approach", 1800], ["evidence", "Evidence notes · user-supplied, not independently verified", 1800], ["limitations", "Limitations and missing evidence", 1200], ["notes", "Additional researcher notes", 1800]];
export default function ZeroThinkTemplates({ onUse, busy = false }: Props) {
  const [templates, setTemplates] = useState<ZeroThinkResearchTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("builtin-paper");
  const [kind, setKind] = useState<"paper" | "scenario" | "custom">("paper");
  const [fields, setFields] = useState<Record<string, string>>({ audience: "Researcher review", citationStyle: "Use supplied source IDs", length: "Draft within the chosen model's output limit" });
  const [editor, setEditor] = useState<ZeroThinkTemplateInput | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("Build a research question from your actual sources, methods and observations. The selected library sources enter Research when you run it.");
  const [preview, setPreview] = useState("");
  const selected = templates.find((item) => item.id === selectedId);
  const blocked = busy || pending;
  useEffect(() => {
    let alive = true;
    bridge().listZeroThinkTemplates().then((items) => { if (alive) { setTemplates(items); setReady(true); } }).catch((error) => { if (alive) setNotice(failure(error)); });
    return () => { alive = false; };
  }, []);
  async function reload() { setTemplates(await bridge().listZeroThinkTemplates()); setReady(true); }
  function setField(name: string, value: string) { setFields((current) => ({ ...current, [name]: value })); setPreview(""); }
  function choose(id: string) { setSelectedId(id); const item = templates.find((entry) => entry.id === id); if (item) setKind(item.kind); setPreview(""); }
  function openEditor(copy: boolean) {
    if (!selected) { setEditor(emptyEditor()); return; }
    setEditor({ ...(copy || selected.builtIn ? {} : { id: selected.id }), name: copy ? `${selected.name} copy`.slice(0, 100) : selected.name, description: selected.description, kind: selected.kind, processId: selected.processId, stages: [...selected.stages], requiredSources: [...selected.requiredSources], validationChecks: [...selected.validationChecks] });
  }
  async function saveEditor() {
    if (!editor || blocked) return; setPending(true);
    try { const cleaned = { ...editor, stages: editor.stages.map((item) => item.trim()).filter(Boolean), requiredSources: editor.requiredSources.map((item) => item.trim()).filter(Boolean), validationChecks: editor.validationChecks.map((item) => item.trim()).filter(Boolean) }; const saved = await bridge().saveZeroThinkTemplate(cleaned); await reload(); setSelectedId(saved.id); setKind(saved.kind); setEditor(null); setPreview(""); setNotice("Custom workflow saved in encrypted local storage."); }
    catch (error) { setNotice(failure(error)); } finally { setPending(false); }
  }
  async function remove() {
    if (!selected || selected.builtIn || blocked || !window.confirm(`Delete the custom workflow “${selected.name}”? Your research conversations and sources are retained.`)) return;
    setPending(true); try { await bridge().deleteZeroThinkTemplate(selected.id); await reload(); choose("builtin-paper"); setEditor(null); setNotice("Custom workflow deleted. Conversations and sources are retained."); }
    catch (error) { setNotice(failure(error)); } finally { setPending(false); }
  }
  async function prepare(use: boolean) {
    if (!selected || blocked) return; setPending(true);
    try { const request: ZeroThinkTemplateRequest = { templateId: selected.id, kind, fields, ...(selected.builtIn ? {} : { template: selected }) }; const rendered = await bridge().renderZeroThinkTemplate(request); setPreview(rendered.question); if (use) { onUse(rendered.question, rendered.processId); setNotice("Workflow placed in Research. Select the sources and click Run when ready."); } else setNotice("This is the deterministic workflow prompt. No model was called and no research was executed."); }
    catch (error) { setNotice(failure(error)); } finally { setPending(false); }
  }
  const scenarioFields: Array<[string, string, number]> = [["outcome", "Outcome to observe", 1000], ["baseline", "Baseline and alternatives", 1000], ["observations", "Actual observations · state what was measured", 1800], ["horizon", "Observation horizon", 100]];
  return <section className="zt-panel" aria-label="Research templates and paper creator">
    <header className="zt-panel-head"><div><h2>Research Workbench</h2><p>Paper Creator · custom workflows · scenario analysis</p></div></header>
    <div className="zt-inline-setup">
      <label>Workflow<select value={selectedId} disabled={blocked || !ready} onChange={(event) => choose(event.target.value)}>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}{item.builtIn ? "" : " · custom"}</option>)}</select></label>
      <label>Output type<select value={kind} disabled={blocked} onChange={(event) => { setKind(event.target.value as typeof kind); setPreview(""); }}><option value="paper">Research paper draft</option><option value="scenario">Scenario / decision analysis</option><option value="custom">Custom research workflow</option></select></label>
      {selected && <><p>{selected.description}</p><details><summary>Visible stages and validation checks</summary><ol>{selected.stages.map((stage, index) => <li key={index}>{stage}</li>)}</ol><strong>Required sources</strong><ul>{selected.requiredSources.map((source, index) => <li key={index}>{source}</li>)}</ul><strong>Checks</strong><ul>{selected.validationChecks.map((check, index) => <li key={index}>{check}</li>)}</ul></details></>}
      <div className="zt-actions"><button disabled={blocked || !ready} onClick={() => setEditor(emptyEditor())}>New custom workflow</button><button disabled={blocked || !selected} onClick={() => openEditor(true)}>Save a custom copy</button>{selected && !selected.builtIn && <><button disabled={blocked} onClick={() => openEditor(false)}>Edit workflow</button><button disabled={blocked} onClick={remove}>Delete workflow</button></>}</div>
    </div>
    {editor && <section className="zt-inline-setup" aria-label="Custom workflow editor"><h3>{editor.id ? "Edit custom workflow" : "New custom workflow"}</h3>
      <label>Name<input maxLength={100} disabled={blocked} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></label>
      <label>Description<textarea maxLength={600} disabled={blocked} value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} /></label>
      <label>Default output type<select value={editor.kind} disabled={blocked} onChange={(event) => setEditor({ ...editor, kind: event.target.value as typeof editor.kind })}><option value="paper">Paper draft</option><option value="scenario">Scenario analysis</option><option value="custom">Custom workflow</option></select></label>
      <label>Research process<select value={editor.processId} disabled={blocked} onChange={(event) => setEditor({ ...editor, processId: event.target.value })}>{processNames.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {([['stages', 'Stages'], ['requiredSources', 'Required sources'], ['validationChecks', 'Validation checks']] as const).map(([name, label]) => <label key={name}>{label} · one per line, up to 12<textarea maxLength={3000} disabled={blocked} value={editor[name].join("\n")} onChange={(event) => setEditor({ ...editor, [name]: event.target.value.split("\n") })} /></label>)}
      <p>Templates are visible instructions. Saving a template does not run the stages or establish that a claim is true.</p><div className="zt-actions"><button className="primary-action" disabled={blocked || !editor.name.trim()} onClick={saveEditor}>{pending ? "Saving…" : "Save workflow"}</button><button disabled={blocked} onClick={() => { if (window.confirm("Discard the unsaved workflow editor changes?")) setEditor(null); }}>Cancel editing</button></div>
    </section>}
    <section className="zt-inline-setup" aria-label="Research project fields">
      <h3>{kind === "paper" ? "Paper Creator" : kind === "scenario" ? "Scenario workspace" : "Research request"}</h3>
      {FIELD_LABELS.map(([name, label, maximum]) => <label key={name}>{label}{name === "title" ? <input disabled={blocked} maxLength={maximum} value={fields[name] || ""} onChange={(event) => setField(name, event.target.value)} /> : <textarea disabled={blocked} maxLength={maximum} value={fields[name] || ""} onChange={(event) => setField(name, event.target.value)} />}</label>)}
      {kind === "paper" && <><label>Audience<input disabled={blocked} maxLength={200} value={fields.audience || ""} onChange={(event) => setField("audience", event.target.value)} /></label><label>Citation style<input disabled={blocked} maxLength={100} value={fields.citationStyle || ""} onChange={(event) => setField("citationStyle", event.target.value)} /></label><label>Requested length<input disabled={blocked} maxLength={100} value={fields.length || ""} onChange={(event) => setField("length", event.target.value)} /></label><label>Inclusion criteria<textarea disabled={blocked} maxLength={800} value={fields.inclusion || ""} onChange={(event) => setField("inclusion", event.target.value)} /></label><label>Exclusion criteria<textarea disabled={blocked} maxLength={800} value={fields.exclusion || ""} onChange={(event) => setField("exclusion", event.target.value)} /></label></>}
      {kind === "scenario" && scenarioFields.map(([name, label, maximum]) => <label key={name}>{label}<textarea disabled={blocked} maxLength={maximum} value={fields[name] || ""} onChange={(event) => setField(name, event.target.value)} /></label>)}
      <p>Choose your actual sources in the Zero Library before running. Fields are researcher-supplied context; citations, results and probabilities are never invented by this form. This prepares a question for the existing Research executor.</p>
      <div className="zt-actions"><button disabled={blocked || !ready || !(fields.title?.trim() || fields.problem?.trim())} onClick={() => void prepare(false)}>Preview workflow prompt</button><button className="primary-action" disabled={blocked || !ready || !(fields.title?.trim() || fields.problem?.trim())} onClick={() => void prepare(true)}>{pending ? "Preparing…" : "Use in Research"}</button></div>
    </section>
    <p role="status" aria-live="polite">{notice}</p>{preview && <details><summary>Prepared research question · no model call</summary><pre>{preview}</pre></details>}
  </section>;
}
