import { useEffect, useRef, useState } from "react";
import "./zerothink.css";
import ZeroThinkAgentWorkspace from "./ZeroThinkAgentWorkspace";
import ZeroThinkVault from "./ZeroThinkVault";
import ZeroThinkQuantum from "./ZeroThinkQuantum";
import ZeroThinkTemplates from "./ZeroThinkTemplates";
import ZeroThinkProjects from "./ZeroThinkProjects";
import ManagedLocalSetup from "./ManagedLocalSetup";

type Props = { settings: ZeroOneSettings; storeManaged: boolean; onSettings: () => void; onSettingsSaved: (value: ZeroOneSettings) => void; requestedTab?: "chat" | "research" | "agent"; requestedTabNonce?: number; active?: boolean };
const freshSession = (): ZeroThinkSession => ({ id: crypto.randomUUID(), title: "New chat", pinned: false, messages: [], documentIds: [], updatedAt: "" });
function failure(error: unknown) { return error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "") : "This operation could not finish. Your saved work was preserved."; }
function CopyText({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState(label), [copying, setCopying] = useState(false);
  async function copy() { setCopying(true); try { setStatus(await window.zeroOne.copyZeroThinkText(text) ? "Copied" : "Copy failed · retry"); } catch { setStatus("Copy failed · retry"); } finally { setCopying(false); } }
  return <button disabled={copying} onClick={copy} aria-live="polite">{copying ? "Copying…" : status}</button>;
}
function Prose({ text }: { text: string }) {
  // Text-only Markdown formatting: no HTML, remote assets or executable links.
  const inline = (line: string) => line.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith("`") && part.endsWith("`") ? <code key={index}>{part.slice(1, -1)}</code> : part);
  const lines = text.split("\n"), blocks = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) { blocks.push(<h3 key={index}>{inline(heading[2])}</h3>); continue; }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line), items = [], start = index;
      const pattern = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
      while (index < lines.length && pattern.test(lines[index])) { items.push(<li key={index}>{inline(lines[index].replace(pattern, ""))}</li>); index++; }
      index--; blocks.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>); continue;
    }
    blocks.push(<p key={index}>{inline(line)}</p>);
  }
  return <div className="zt-prose">{blocks}</div>;
}
function Answer({ text }: { text: string }) {
  // React text nodes keep user/model HTML inert. No remote scripts or HTML execution.
  return <div className="zt-message-body">{text.split(/(```[\s\S]*?```)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("```")) { const code = part.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""); return <div className="zt-code" key={index}><CopyText text={code} label="Copy code" /><pre><code>{code}</code></pre></div>; }
    return <Prose key={index} text={part} />;
  })}</div>;
}
export default function ZeroThinkWorkspace({ settings, storeManaged, onSettings, onSettingsSaved, requestedTab, requestedTabNonce, active = true }: Props) {
  const [tab, setTab] = useState<"chat" | "research" | "agent" | "vault" | "quantum" | "templates">("chat");
  const [vault, setVault] = useState<ZeroThinkVaultSnapshot | null>(null);
  const [session, setSession] = useState<ZeroThinkSession>(freshSession);
  const [sessions, setSessions] = useState<ZeroThinkSessionSummary[]>([]);
  const [library, setLibrary] = useState<ZeroThinkDocument[]>([]);
  const [question, setQuestion] = useState("");
  const [processes, setProcesses] = useState<ZeroThinkProcess[]>([]);
  const [processId, setProcessId] = useState("evidence-map");
  const [useModel, setUseModel] = useState(true);
  const [zeroMode, setZeroMode] = useState(true);
  const [autoWeb, setAutoWeb] = useState(false);
  const [maxPasses, setMaxPasses] = useState(1);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<Awaited<ReturnType<Window["zeroOne"]["listNotes"]>>>([]);
  const [modelSettings, setModelSettings] = useState(settings);
  const [credential, setCredential] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<ZeroThinkProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState("Ask Zero a question. Your conversations and library are saved on this device.");
  const [storageReady, setStorageReady] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const [webQuery, setWebQuery] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState<ZeroThinkProfile>({ persona: "", facts: [] });
  const [factText, setFactText] = useState("");
  const [project, setProject] = useState<ZeroThinkResearchProject | null>(null);
  const [projectRevision, setProjectRevision] = useState(0);
  const [showProjects, setShowProjects] = useState(false);
  const [projectSaveState, setProjectSaveState] = useState("");
  const projectRef = useRef<ZeroThinkResearchProject | null>(null);
  const pendingProjectDraft = useRef<ZeroThinkResearchProjectInput | null>(null);
  const projectSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const runId = useRef("");
  const transcript = useRef<HTMLDivElement>(null);
  const selected = library.filter((doc) => session.documentIds.includes(doc.id));
  const activeProfile = vault?.profiles.find((entry) => entry.id === vault.activeProfileId);
  const localModel = !activeProfile && modelSettings.assistantProvider === "openzero" && modelSettings.openZeroAssistantMode !== "server";
  const blockedLocal = localModel && storeManaged && modelSettings.localRuntimeMode === "ollama";
  const providerLabel = activeProfile?.name || (modelSettings.assistantProvider === "groq" ? "Groq" : modelSettings.assistantProvider === "openai" ? "OpenAI" : modelSettings.openZeroAssistantMode === "server" ? "Your server" : modelSettings.localRuntimeMode === "ollama" ? "Local Ollama" : "OpenZero CPU");
  const keyReady = activeProfile ? activeProfile.hasKey || activeProfile.provider === "openzero" : modelSettings.assistantProvider === "groq" ? modelSettings.hasGroqKey : modelSettings.assistantProvider === "openai" ? modelSettings.hasOpenAiKey : true;
  const searchReady = vault ? vault.profiles.some((entry) => entry.provider === "serper" && entry.hasKey) : Boolean(modelSettings.hasSerperKey);
  const conversationTab = tab === "chat" || tab === "research";
  const workspaceBusy = busy || searching || agentBusy;
  const projectAPI = window.zeroOne as typeof window.zeroOne & ZeroThinkProjectsAPI;
  const selectedFingerprint = JSON.stringify(selected);
  function openModelConnection() {
    if (workspaceBusy) return;
    setShowProfile(false);
    if (activeProfile) { setTab("vault"); setShowTools(true); setShowSetup(false); }
    else setShowSetup(!showSetup);
  }
  function adoptProject(value: ZeroThinkResearchProject | null) { if (projectRef.current?.id !== value?.id) void flushProject().catch((error) => setProjectSaveState(`Autosave failed: ${failure(error)}`)); projectRef.current = value; setProject(value); }
  async function flushProject() {
    const draft = pendingProjectDraft.current;
    if (!draft) { await projectSaveQueue.current; return; }
    pendingProjectDraft.current = null;
    const save = projectSaveQueue.current.catch(() => {}).then(async () => { const saved = await projectAPI.saveZeroThinkProject(draft); if (projectRef.current?.id === saved.id) { adoptProject(saved); setProjectSaveState("Saved on this device"); setProjectRevision((v) => v + 1); } });
    projectSaveQueue.current = save;
    try { await save; } catch (error) { if (!pendingProjectDraft.current) pendingProjectDraft.current = draft; throw error; }
  }
  function projectInput(title: string, id?: string): ZeroThinkResearchProjectInput { return { id, title, question, processId, maxPasses, useModel, zeroMode, autoWeb, documents: selected, result: projectRef.current?.result || null, status: "draft", lastError: "" }; }
  async function createProject(title: string) { const saved = await projectAPI.saveZeroThinkProject({ ...projectInput(title), result: null }); adoptProject(saved); setProjectRevision((v) => v + 1); setProjectSaveState("Saved on this device"); setTab("research"); }
  async function openProject(value: ZeroThinkResearchProject) {
    // Import never starts a run. Restore the selected source snapshots through the existing encrypted library.
    const merged = [...library], restoredDocuments = value.documents.map((doc) => { const existing = merged.find((d) => d.id === doc.id); const restored = existing && (existing.text !== doc.text || existing.title !== doc.title || existing.sourceUrl !== doc.sourceUrl) ? { ...doc, id: crypto.randomUUID() } : doc; if (!merged.some((d) => d.id === restored.id)) merged.push(restored); return restored; });
    const sources = await window.zeroOne.saveZeroThinkLibrary(merged);
    setLibrary(sources); setSession({ ...freshSession(), title: value.title, documentIds: restoredDocuments.map((d) => d.id), messages: value.result ? [{ id: crypto.randomUUID(), role: "assistant", content: value.result.answer, result: value.result, reasoningBrief: value.result.reasoningBrief || "" }] : [] });
    setQuestion(value.question); setProcessId(value.processId); setMaxPasses(value.maxPasses); setUseModel(value.useModel); setZeroMode(value.zeroMode); setAutoWeb(value.autoWeb); adoptProject({ ...value, documents: restoredDocuments }); setTab("research"); setProjectRevision((v) => v + 1); setProjectSaveState("Project restored"); setMessage(value.status === "interrupted" ? value.lastError : "Research project restored. Review its evidence and continue when ready.");
  }
  useEffect(() => {
    if (tab !== "research" || !active || !project?.id) { void flushProject().catch((error) => setProjectSaveState(`Autosave failed: ${failure(error)}`)); return; }
    if (workspaceBusy) return;
    const current = projectRef.current; if (!current) return;
    pendingProjectDraft.current = { ...projectInput(current.title, current.id), result: current.result, status: current.status === "running" ? "interrupted" : current.status, lastError: current.lastError };
    setProjectSaveState("Saving changes…");
    const timer = window.setTimeout(() => { void flushProject().catch((error) => setProjectSaveState(`Autosave failed: ${failure(error)}`)); }, 650);
    return () => window.clearTimeout(timer);
  }, [project?.id, question, processId, maxPasses, useModel, zeroMode, autoWeb, selectedFingerprint, tab, active, workspaceBusy]);
  useEffect(() => { setModelSettings(settings); }, [settings]);
  useEffect(() => { if (requestedTab) setTab(requestedTab); }, [requestedTab, requestedTabNonce]);
  useEffect(() => { let alive = true; window.zeroOne.getZeroThinkVault().then((snapshot) => { if (alive) setVault(snapshot); }).catch((error) => { if (alive) setMessage(`API vault: ${failure(error)}`); }); return () => { alive = false; }; }, [settings.activeChatProfile?.id, settings.activeChatProfile?.model, settings.activeChatProfile?.name, settings.activeChatProfile?.hasKey, settings.assistantProvider, settings.openZeroAssistantMode, settings.localRuntimeMode, settings.managedLocalConfigured]);
  useEffect(() => {
    let alive = true;
    window.zeroOne.getZeroThinkVault().then((value) => { if (alive) setVault(value); }).catch((error) => { if (alive) setMessage(`API vault: ${failure(error)}`); });
    Promise.all([window.zeroOne.listZeroThinkSessions(), window.zeroOne.listZeroThinkLibrary(), window.zeroOne.getZeroThinkProcesses(), window.zeroOne.getZeroThinkProfile()]).then(async ([saved, sources, available, savedProfile]) => {
      if (!alive) return;
      setSessions(saved); setLibrary(sources); setProcesses(available); setStorageReady(true);
      setProfile(savedProfile); setFactText(savedProfile.facts.join("\n"));
      if (saved.length) { const latest = await window.zeroOne.getZeroThinkSession(saved[0].id); if (alive && latest) setSession(latest); }
    }).catch((error) => { if (alive) setMessage(`Workspace storage could not open: ${failure(error)}`); });
    const unsubscribe = window.zeroOne.onZeroThinkProgress((event) => { if (event.runId === runId.current) setProgress(event); });
    return () => { alive = false; unsubscribe(); };
  }, []);
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: "smooth" }); }, [session.messages.length, busy]);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now(), interval = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && runId.current) void window.zeroOne.cancelZeroThink(runId.current); };
    window.addEventListener("keydown", escape);
    return () => { window.clearInterval(interval); window.removeEventListener("keydown", escape); };
  }, [busy]);
  async function persist(value: ZeroThinkSession) {
    const saved = await window.zeroOne.saveZeroThinkSession(value);
    setSession(saved); setSessions(await window.zeroOne.listZeroThinkSessions()); return saved;
  }
  async function openChat(id: string) {
    if (workspaceBusy) return;
    adoptProject(null);
    try { const saved = await window.zeroOne.getZeroThinkSession(id); if (saved) { setSession(saved); setTab("chat"); setQuestion(""); setMessage("Conversation restored. Ask a follow-up."); } }
    catch (error) { setMessage(failure(error)); }
  }
  async function renameChat() {
    if (workspaceBusy) return;
    try { await persist({ ...session, title: renameTitle.trim().slice(0, 160) || "New chat" }); setRenaming(false); } catch (error) { setMessage(failure(error)); }
  }
  async function deleteChat() {
    if (workspaceBusy) return;
    if (!window.confirm("Remove this conversation from this device? Export it first if you want to keep a copy.")) return;
    try { await window.zeroOne.deleteZeroThinkSession(session.id); setSession(freshSession()); setSessions(await window.zeroOne.listZeroThinkSessions()); setMessage("Conversation removed. Your source files and library remain."); } catch (error) { setMessage(failure(error)); }
  }
  async function addSources(imported: ZeroThinkDocument[]) {
    const merged = [...library]; for (const doc of imported) { const index = merged.findIndex((item) => item.id === doc.id); if (index < 0) merged.push(doc); else merged[index] = doc; }
    if (merged.length > 32 || merged.reduce((sum, doc) => sum + new TextEncoder().encode(doc.text).length, 0) > 2 * 1024 * 1024) throw new Error("Your library holds 32 sources and 2 MB of text. Remove an old library source first.");
    setLibrary(await window.zeroOne.saveZeroThinkLibrary(merged));
    const ids = [...new Set([...session.documentIds, ...imported.map((doc) => doc.id)])].slice(0, 8);
    await persist({ ...session, documentIds: ids }); setShowLibrary(true);
    setMessage(`Added ${imported.length} sources to your private library. ${ids.length} selected for this conversation.`);
  }
  async function importFiles() { if (workspaceBusy) return; try { const imported = await window.zeroOne.importZeroThinkDocuments(); if (imported.length) await addSources(imported); } catch (error) { setMessage(failure(error)); } }
  async function openNotes() { if (workspaceBusy) return; try { setNotes(await window.zeroOne.listNotes()); setShowNotes(true); setShowLibrary(true); } catch (error) { setMessage(failure(error)); } }
  async function selectSource(id: string) {
    if (workspaceBusy) return;
    const ids = session.documentIds.includes(id) ? session.documentIds.filter((item) => item !== id) : [...session.documentIds, id];
    if (ids.length > 8) { setMessage("Select up to eight sources for a run. Your other library sources stay saved."); return; }
    try { await persist({ ...session, documentIds: ids }); } catch (error) { setMessage(failure(error)); }
  }
  async function removeLibrarySource(id: string) {
    if (workspaceBusy) return;
    if (!window.confirm("Remove this source from the local library? The original file will remain unchanged.")) return;
    try { setLibrary(await window.zeroOne.saveZeroThinkLibrary(library.filter((doc) => doc.id !== id))); await persist({ ...session, documentIds: session.documentIds.filter((item) => item !== id) }); } catch (error) { setMessage(failure(error)); }
  }
  async function searchWeb() {
    if (!webQuery.trim() || workspaceBusy) return; setSearching(true);
    try { const found = await window.zeroOne.searchZeroThinkWeb(webQuery.trim()); if (found.length) await addSources(found); else setMessage("The search returned no usable source snippets. Try another query."); }
    catch (error) { setMessage(failure(error)); } finally { setSearching(false); }
  }
  async function saveModel() {
    if (workspaceBusy) return;
    setSavingSetup(true);
    try {
      const input: Partial<ZeroOneSettings> = { assistantProvider: modelSettings.assistantProvider, openZeroAssistantMode: modelSettings.openZeroAssistantMode, localRuntimeMode: modelSettings.localRuntimeMode || "managed", model: modelSettings.model, openZeroUrl: modelSettings.openZeroUrl, openZeroServerModel: modelSettings.openZeroServerModel };
      if (credential.trim()) { if (modelSettings.assistantProvider === "groq") input.groqKey = credential.trim(); else if (modelSettings.assistantProvider === "openai") input.openAiKey = credential.trim(); else input.openZeroToken = credential.trim(); }
      const saved = await window.zeroOne.saveSettings(input); setModelSettings(saved); onSettingsSaved(saved); setVault(await window.zeroOne.getZeroThinkVault()); setCredential(""); setShowSetup(false); setMessage("Model settings saved. Questions and selected excerpts go to the provider you chose.");
    } catch (error) { setMessage(failure(error)); } finally { setSavingSetup(false); }
  }
  async function saveProfile() {
    if (workspaceBusy) return;
    try { const saved = await window.zeroOne.saveZeroThinkProfile({ persona: profile.persona, facts: factText.split("\n").map((line) => line.trim()).filter(Boolean) }); setProfile(saved); setFactText(saved.facts.join("\n")); setShowProfile(false); setMessage("Your persona and explicit remembered facts were saved locally. They are used only with your selected model."); } catch (error) { setMessage(failure(error)); }
  }
  async function run() {
    if (!question.trim() || workspaceBusy) return;
    const wantsModel = tab === "chat" || useModel;
    if (wantsModel && (blockedLocal || !keyReady)) { setTab("vault"); setMessage(blockedLocal ? "Switch to Built-in CPU AI in model setup, or choose your own server or API profile. External Ollama is not available in this Store edition." : `Add your ${providerLabel} API key in the Vault. Research can still build evidence maps offline.`); return; }
    if (!storageReady) { setMessage("Open secure workspace storage before starting a saved conversation."); return; }
    const prompt = question.trim(), previous = session.messages;
    if (previous.length >= 98) { setMessage("Start a new conversation before the 100-message limit. Your previous chat remains saved."); return; }
    const user: ZeroThinkMessage = { id: crypto.randomUUID(), role: "user", content: prompt };
    const pending = { ...session, title: session.messages.length ? session.title : prompt.slice(0, 100), messages: [...previous, user] };
    setBusy(true); setElapsed(0); runId.current = crypto.randomUUID(); setProgress(null);
    const runningProject = tab === "research" && projectRef.current ? { ...projectInput(projectRef.current.title, projectRef.current.id), status: "running" as const } : null;
    try {
      setMessage(`I’m on it. ${wantsModel ? `Using ${providerLabel}. CPU models can take several minutes; elapsed time and Stop remain available.` : "Building an offline evidence map."}`);
      await flushProject();
      if (runningProject) adoptProject(await projectAPI.saveZeroThinkProject(runningProject));
      await persist(pending); if (tab === "chat") setQuestion("");
      const conversation: Array<{ role: "user" | "assistant"; content: string }> = []; let characters = 0;
      for (const item of previous.slice(-24).reverse()) { if (characters + item.content.length > 96000) break; characters += item.content.length; conversation.unshift({ role: item.role, content: item.content }); }
      const answer = await window.zeroOne.runZeroThink({ runId: runId.current, question: prompt, mode: tab === "chat" ? "chat" : "research", processId, documents: selected, maxPasses: wantsModel ? maxPasses : 1, tokenBudget: 3072, useModel: wantsModel, zeroMode, autoWeb: autoWeb && wantsModel, conversation });
      const response: ZeroThinkMessage = { id: crypto.randomUUID(), role: "assistant", content: answer.answer, reasoningBrief: answer.reasoningBrief || "", result: answer };
      if (runningProject) { adoptProject(await projectAPI.saveZeroThinkProject({ ...runningProject, result: answer, status: "completed" })); setProjectRevision((v) => v + 1); }
      await persist({ ...pending, messages: [...pending.messages, response] }); setMessage(answer.status === "offline" ? "Evidence map saved. Choose a model for a draft, or add more sources." : "Answer saved. Ask a follow-up or start a new chat.");
    } catch (error) { setMessage(failure(error)); if (runningProject) { try { adoptProject(await projectAPI.saveZeroThinkProject({ ...runningProject, status: "interrupted", lastError: "The run stopped before a final report was saved. Your question, options and source snapshots remain. Review and start a fresh run when ready." })); setProjectRevision((v) => v + 1); } catch (saveError) { setProjectSaveState(`Recovery checkpoint failed: ${failure(saveError)}`); } } } finally { setBusy(false); runId.current = ""; }
  }
  async function saveToNotes(result: ZeroThinkResult) {
    try { await window.zeroOne.saveNote({ id: crypto.randomUUID(), title: `ZeroThink: ${result.question.slice(0, 100)}`, content: result.markdown }); setMessage("Saved to ZNotes on this device."); } catch (error) { setMessage(failure(error)); }
  }
  async function exportResult(result: ZeroThinkResult, format: "markdown" | "json" | "pdf") {
    try { if ((await window.zeroOne.exportZeroThinkReport({ result, format })).saved) setMessage("Export saved as readable text. Keep private exports in a protected folder."); } catch (error) { setMessage(failure(error)); }
  }
  async function exportConversation() {
    const markdown = `# ${session.title}\n\n${session.messages.map((item) => `## ${item.role === "user" ? "You" : "Zero"}\n\n${item.reasoningBrief ? `### Zero mode public brief\n\n${item.reasoningBrief}\n\n` : ""}${item.content}`).join("\n\n")}`;
    await exportResult({ version: "1.1.0", status: "completed", mode: "chat", question: session.title, answer: markdown, markdown, evidence: [], citations: { valid: [], unknown: [], missing: false }, steps: [], metrics: { passes: 0, requestedTokens: 0, sourceCount: 0, retrievedCount: 0 }, warnings: [] }, "markdown");
  }
  return <section className="zerothink-workspace zt-studio" aria-label="ZeroThink Studio">
    <aside className="zt-chat-sidebar">
      <div className="zt-studio-brand">Zero<span>Think</span><small>STUDIO · PRIVATE WORKSPACE</small></div>
      <button className="zt-new-chat" disabled={workspaceBusy} onClick={() => { adoptProject(null); setSession(freshSession()); setTab("chat"); setQuestion(""); setMessage("New conversation. Ask Zero anything, or select library sources."); }}>＋ New chat</button>
      <nav className="zt-mode-nav" aria-label="ZeroThink workspace modes">{([["chat", "Chat", "Ask, explain and write"], ["research", "Research", "Investigate your sources"], ["agent", "Agent", "Build and edit a project"]] as const).map(([id, label, hint]) => <button key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} disabled={workspaceBusy} onClick={() => setTab(id)}><strong>{label}</strong><small>{hint}</small></button>)}</nav>
      <button className="zt-library-toggle" disabled={workspaceBusy} onClick={() => { if (!conversationTab) setTab("chat"); setShowLibrary(!showLibrary); }} aria-expanded={showLibrary}>Files & sources <span>{library.length}</span></button>
      <button className="zt-library-toggle" aria-expanded={showTools} aria-controls="zt-tools-menu" onClick={() => setShowTools(!showTools)}>Tools & settings <span>{showTools ? "−" : "+"}</span></button>
      {showTools && <nav className="zt-feature-nav" id="zt-tools-menu" aria-label="Additional ZeroThink tools">{([["vault", "API keys & models"], ["quantum", "Quantum · IonQ"], ["templates", "Research templates"]] as const).map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} disabled={workspaceBusy} onClick={() => { setTab(id); setShowSetup(false); setShowProfile(false); setShowLibrary(false); }}>{label}</button>)}<button disabled={workspaceBusy} onClick={() => { setShowProfile(!showProfile); setShowSetup(false); }}>Writing style & memory</button><button disabled={workspaceBusy} onClick={openModelConnection}>Model connection</button><button onClick={onSettings}>All app settings</button></nav>}
      <div className="zt-history-heading">Conversations</div>
      <input className="zt-history-filter" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)} placeholder="Find a conversation…" aria-label="Find a conversation" />
      <div className="zt-chat-history">{sessions.filter((entry) => entry.title.toLowerCase().includes(historyFilter.toLowerCase())).map((entry) => <button key={entry.id} className={entry.id === session.id ? "active" : ""} disabled={workspaceBusy} onClick={() => void openChat(entry.id)}><span>{entry.pinned ? "★ " : ""}{entry.title}</span><small>{entry.messageCount} messages</small></button>)}{!sessions.length && <p>Your saved conversations appear here. No website account is needed.</p>}</div>
      <div className="zt-private-status"><span>◈ ON THIS DEVICE</span><p>Encrypted conversations and sources. Keys stay in the app’s private credential storage.</p><button disabled={workspaceBusy} onClick={openModelConnection}>{providerLabel} · Change model</button></div>
    </aside>
    <div className="zt-studio-main">
      <header className="zt-studio-header"><div><p>{tab === "chat" ? "CHAT · ASK, EXPLAIN AND WRITE" : tab === "agent" ? "AGENT · LOCAL PROJECT WORK" : tab === "research" ? "RESEARCH · SOURCES AND EVIDENCE" : "ZERO THINK TOOLS"}</p><h1>{tab === "agent" ? "Build with ZeroThink" : tab === "vault" ? "API keys & models" : tab === "quantum" ? "Quantum · IonQ" : tab === "templates" ? "Research templates" : session.title}</h1></div>{conversationTab && <details className="zt-conversation-menu"><summary>Conversation ···</summary><div className="zt-chat-actions"><button onClick={() => { setRenameTitle(session.title); setRenaming(true); }} disabled={workspaceBusy || !storageReady}>Rename conversation</button><button disabled={workspaceBusy || !storageReady} onClick={() => void persist({ ...session, pinned: !session.pinned }).catch((error) => setMessage(failure(error)))}>{session.pinned ? "Unpin conversation" : "Pin conversation"}</button><button onClick={exportConversation} disabled={!session.messages.length}>Export conversation</button><button onClick={deleteChat} disabled={workspaceBusy || !session.messages.length}>Delete conversation</button></div></details>}</header>
      {renaming && <div className="zt-web-search"><input value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} aria-label="Conversation title" maxLength={160} autoFocus /><button onClick={renameChat}>Save title</button><button onClick={() => setRenaming(false)}>Cancel</button></div>}
      {tab === "research" && <div className="zt-auto-web-controls"><button disabled={workspaceBusy} onClick={() => setShowProjects(!showProjects)}>Saved research projects</button>{project && <><span role="status">{project.title} · {projectSaveState}</span><button disabled={workspaceBusy} onClick={() => { adoptProject(null); setProjectSaveState(""); }}>Detach project</button></>}<small>Save a named project to autosave its question, selected evidence, options and final report.</small></div>}
      {conversationTab && localModel && modelSettings.localRuntimeMode !== "ollama" && <ManagedLocalSetup compact />}
      {showProjects && tab === "research" && <ZeroThinkProjects disabled={workspaceBusy || !storageReady} active={project} revision={projectRevision} onBeforeAction={flushProject} onCreate={createProject} onOpen={openProject} onMessage={setMessage} onDeleted={(id) => { if (projectRef.current?.id === id) adoptProject(null); }} />}

      {showProfile && <section className="zt-inline-setup zt-profile-editor" aria-label="ZeroThink persona and memory"><div className="zt-panel-head"><strong>Your persona and explicit memory</strong><button onClick={() => setShowProfile(false)} aria-label="Close persona and memory">×</button></div><label>Persona / writing preferences<textarea maxLength={8000} disabled={workspaceBusy} value={profile.persona} onChange={(event) => setProfile({ ...profile, persona: event.target.value })} placeholder="For example: explain plainly, help me code, and ask before changing important files." /></label><label>Facts you want remembered · one per line<textarea value={factText} disabled={workspaceBusy} maxLength={21000} onChange={(event) => setFactText(event.target.value)} placeholder="Up to 20 facts, 1,000 characters each. Add only what you want your chosen model to receive." /></label><p>These are your explicit statements, not independently verified facts. The latest five are included in model context, matching the original ZeroThink memory flow. Nothing is automatically extracted from your files or chats.</p><button className="primary-action" onClick={saveProfile} disabled={!storageReady || workspaceBusy}>Save persona and memory</button></section>}
      {showSetup && <section className="zt-inline-setup" aria-label="ZeroThink model setup"><div className="zt-panel-head"><strong>Your model, your endpoint</strong><button onClick={() => setShowSetup(false)} aria-label="Close model setup">×</button></div><div className="zt-setup-grid"><label>Provider<select value={modelSettings.assistantProvider} onChange={(event) => setModelSettings({ ...modelSettings, assistantProvider: event.target.value as ZeroOneSettings["assistantProvider"] })}><option value="openzero">OpenZero · built-in CPU or your server</option><option value="groq">Groq</option><option value="openai">OpenAI</option></select></label>{modelSettings.assistantProvider === "openzero" && <label>Model location<select value={modelSettings.openZeroAssistantMode} onChange={(event) => setModelSettings({ ...modelSettings, openZeroAssistantMode: event.target.value as "local" | "server" })}><option value="server">My own model server</option><option value="local">Built-in CPU AI</option></select></label>}{!storeManaged && modelSettings.assistantProvider === "openzero" && modelSettings.openZeroAssistantMode === "local" && <label>Local engine<select value={modelSettings.localRuntimeMode || "managed"} onChange={(event) => setModelSettings({ ...modelSettings, localRuntimeMode: event.target.value as "managed" | "ollama" })}><option value="managed">Built-in CPU AI · automatic setup</option><option value="ollama">Advanced · existing Ollama installation</option></select></label>}<label>Model ID<input value={modelSettings.assistantProvider === "openzero" && modelSettings.openZeroAssistantMode === "server" ? modelSettings.openZeroServerModel : modelSettings.model} onChange={(event) => setModelSettings({ ...modelSettings, ...(modelSettings.assistantProvider === "openzero" && modelSettings.openZeroAssistantMode === "server" ? { openZeroServerModel: event.target.value } : { model: event.target.value }) })} placeholder="A model available on your chosen provider" /></label>{modelSettings.assistantProvider === "openzero" && modelSettings.openZeroAssistantMode === "server" && <label>Server address<input value={modelSettings.openZeroUrl} onChange={(event) => setModelSettings({ ...modelSettings, openZeroUrl: event.target.value })} placeholder="https://your-server.example" /></label>}<label>Private key / token<input type="password" autoComplete="off" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="Leave empty to keep the saved key" /></label></div><p>Questions and selected excerpts are sent to your chosen model. Remote servers need HTTPS. Built-in CPU AI automatically downloads and sets up the published model; server and API modes use your chosen account.</p><div><button className="primary-action" onClick={saveModel} disabled={savingSetup}>{savingSetup ? "Saving…" : "Save model settings"}</button><button onClick={onSettings}>All app settings</button></div></section>}
      {showLibrary && <section className="zt-studio-library" aria-label="Zero Library"><div className="zt-panel-head"><div><strong>Files & sources</strong><small>{selected.length}/8 selected · {library.length}/32 saved</small></div><div><button onClick={importFiles} disabled={workspaceBusy || !storageReady}>＋ Import text files</button><button onClick={openNotes} disabled={workspaceBusy || !storageReady}>From ZNotes</button><button onClick={() => setShowLibrary(false)} aria-label="Close Zero Library">×</button></div></div><p>Selected TXT, Markdown, CSV and JSON sources stay in your encrypted library. Up to 1 MB per file and 2 MB total. Only checked sources enter this conversation.</p><div className="zt-web-search"><input value={webQuery} onChange={(event) => setWebQuery(event.target.value)} placeholder="Search the web for sources…" aria-label="Web source query" /><button onClick={searchWeb} disabled={workspaceBusy || searching || !storageReady || !webQuery.trim()}>{searching ? "Searching…" : "Search web"}</button><button onClick={() => { setShowLibrary(false); setTab("vault"); setShowTools(true); }}>Add search key</button></div><small>Serper search uses your saved key. Search snippets are labeled excerpts, not full-text papers.</small>{showNotes && <div className="zt-note-picker"><strong>Select a ZNote</strong><button onClick={() => setShowNotes(false)}>Close</button>{notes.map((note) => <button key={note.id} onClick={() => void addSources([{ id: note.id, title: note.title, text: note.content }]).catch((error) => setMessage(failure(error)))}>{note.title}</button>)}{!notes.length && <p>No saved notes yet.</p>}</div>}<div className="zt-library-items">{library.map((doc) => <article key={doc.id}><label><input type="checkbox" checked={session.documentIds.includes(doc.id)} disabled={workspaceBusy} onChange={() => void selectSource(doc.id)} /><strong>{doc.title}</strong></label><details><summary>{doc.text.length.toLocaleString()} characters · Preview</summary><pre>{doc.text.slice(0, 6000)}</pre>{doc.sourceUrl && <span>{doc.sourceUrl}</span>}</details><button disabled={workspaceBusy} onClick={() => void removeLibrarySource(doc.id)} aria-label={`Remove ${doc.title} from library`}>Remove from library</button></article>)}</div></section>}
      <div className="zt-agent-host" hidden={tab !== "agent"} inert={tab !== "agent"} aria-hidden={tab !== "agent"}><ZeroThinkAgentWorkspace settings={settings} providerName={providerLabel} onSettings={() => setTab("vault")} onBusyChange={setAgentBusy} /></div>
      <div className="zt-feature-host" hidden={tab !== "vault"} inert={tab !== "vault"}><ZeroThinkVault disabled={workspaceBusy} onChanged={(value) => { setVault(value); void window.zeroOne.loadSettings().then((saved) => { setModelSettings(saved); onSettingsSaved(saved); }).catch((error) => setMessage(failure(error))); }} /></div>
<div className="zt-feature-host" hidden={tab !== "quantum"} inert={tab !== "quantum"}><ZeroThinkQuantum onOpenVault={() => setTab("vault")} onSaveReport={async (title, text) => { await addSources([{ id: crypto.randomUUID(), title, text }]); }} /></div>
<div className="zt-feature-host" hidden={tab !== "templates"} inert={tab !== "templates"}><ZeroThinkTemplates busy={workspaceBusy} onUse={(prompt, process) => { setQuestion(prompt); if (process) setProcessId(process); setTab("research"); setMaxPasses(3); setMessage("Research brief prepared. Select your evidence sources and send when ready."); }} /></div>
<div className="zt-conversation-host" hidden={!conversationTab} inert={!conversationTab} aria-hidden={!conversationTab}><div className="zt-transcript" ref={transcript} aria-live="polite">
        {!session.messages.length && <div className="zt-chat-welcome"><span>◈</span><h2>{tab === "research" ? "What would you like to investigate?" : "What can Zero help you with?"}</h2><p>{tab === "research" ? "Add your files, choose a question, then build an evidence report. Start with the defaults; more research controls are in Options." : "Ask a question, write something, or work through an idea. Your conversations are saved here, with no website account."}</p><div className="zt-start-cards">{(tab === "research" ? [{ title: "Review a claim", detail: "Separate evidence from assumptions", prompt: "Review a claim in my selected sources. Identify supporting evidence, contradictions and gaps." }, { title: "Compare sources", detail: "Find agreement and differences", prompt: "Compare my selected sources. What do they agree on, where do they differ, and what remains uncertain?" }, { title: "Plan an investigation", detail: "Turn a question into next steps", prompt: "Help me design a research plan with a clear question, evidence needed and reproducible checks." }] : [{ title: "Explain an idea", detail: "Plain words and useful examples", prompt: "Explain a difficult idea with examples" }, { title: "Write with me", detail: "Draft, improve and organise", prompt: "Help me turn my notes into a clear, well-structured draft" }, { title: "Plan an app", detail: "Work out features and next steps", prompt: "Help me plan and build an app" }]).map(({ title, detail, prompt }) => <button key={title} onClick={() => setQuestion(prompt)}><strong>{title}</strong><small>{detail}</small></button>)}</div><div className="zt-welcome-paths"><button disabled={workspaceBusy || !storageReady} onClick={importFiles}>Add files to this conversation</button><button disabled={workspaceBusy} onClick={() => setTab(tab === "research" ? "templates" : "agent")}>{tab === "research" ? "Browse research templates" : "Build or edit a project → Agent"}</button></div><p className="zt-welcome-context">{tab === "research" ? "Research also works without a model: open Options and turn off Use selected model to create a local evidence map." : "Use Agent for real file edits and project commands. Use Research for evidence reports and saved research projects."}</p></div>}
        {session.messages.map((entry) => <article key={entry.id} className={`zt-chat-message ${entry.role}`}><div className="zt-message-label">{entry.role === "user" ? "YOU" : "ZERO"}</div>{entry.reasoningBrief && <details className="zt-public-brief"><summary>◈ Zero mode · public approach and evidence</summary><pre>{entry.reasoningBrief}</pre></details>}<Answer text={entry.content} />{entry.role === "assistant" && <div className="zt-message-tools"><CopyText text={entry.content} label="Copy answer" />{entry.result && <><button onClick={() => void saveToNotes(entry.result!)}>Save to ZNotes</button><button onClick={() => void exportResult(entry.result!, "markdown")}>Export Markdown</button><button onClick={() => void exportResult(entry.result!, "json")}>Export JSON</button><button onClick={() => void exportResult(entry.result!, "pdf")}>Export PDF</button></>}</div>}{entry.result && entry.result.evidence.length > 0 && <details className="zt-chat-ledger"><summary>Evidence ledger · {entry.result.evidence.length} selected excerpts</summary>{entry.result.evidence.map((item, index) => <details key={`${item.chunkId}-${index}`}><summary>[{item.sourceId}] {item.title}</summary><pre>{item.excerpt}</pre>{item.sourceUrl && <span>{item.sourceUrl}</span>}</details>)}</details>}{entry.result && entry.result.warnings.length > 0 && <details className="zt-chat-ledger"><summary>Review notes · {entry.result.warnings.length}</summary><ul>{entry.result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}</article>)}
        {busy && <div className="zt-working" role="status"><span />{progress?.message || "I’m on it. Preparing your request…"} · {elapsed}s</div>}
      </div>
      <section className="zt-composer"><div className="zt-composer-controls"><button disabled={workspaceBusy} onClick={openModelConnection} title="Change your model connection">{providerLabel}</button><button onClick={() => setShowLibrary(!showLibrary)} aria-expanded={showLibrary}>Files · {selected.length} selected</button><button className={showOptions ? "active" : ""} aria-expanded={showOptions} aria-controls="zt-run-options" disabled={workspaceBusy} onClick={() => setShowOptions(!showOptions)}>Options {showOptions ? "−" : "+"}</button><span className="zt-run-summary">{maxPasses === 1 ? "Direct answer" : `${maxPasses} review passes`}{autoWeb ? " · Web research on" : ""}</span></div>{showOptions && <div className="zt-run-options" id="zt-run-options"><div className="zt-research-options"><label>Review depth<select value={maxPasses} onChange={(event) => setMaxPasses(Number(event.target.value))} disabled={workspaceBusy}><option value={1}>Direct · one answer</option><option value={2}>Reviewed · draft and revision</option><option value={3}>Thorough · research, critique and final</option></select></label><label><input type="checkbox" checked={zeroMode} onChange={(event) => setZeroMode(event.target.checked)} disabled={workspaceBusy} />Zero mode · include public approach brief</label></div><div className="zt-option-help">More review passes take longer and use more model tokens. The Zero mode brief describes the answer’s approach and evidence.</div><div className="zt-research-options"><label><input type="checkbox" checked={autoWeb} disabled={workspaceBusy || !searchReady || (tab === "research" && !useModel)} onChange={(event) => setAutoWeb(event.target.checked)} />Automatic web research</label>{!searchReady && <button disabled={workspaceBusy} onClick={() => { setTab("vault"); setShowTools(true); }}>Add Serper search key</button>}</div><p className="zt-option-help">{searchReady ? "Zero can send a generated public query to Serper when useful. Results are search excerpts; full pages are not fetched." : "Web research needs your Serper key. Chat and local source research work without it."}</p>{tab === "research" && <div className="zt-research-options"><label>Research process<select value={processId} disabled={workspaceBusy} onChange={(event) => setProcessId(event.target.value)}>{processes.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label><label><input type="checkbox" checked={useModel} onChange={(event) => setUseModel(event.target.checked)} disabled={workspaceBusy} />Use selected model</label><small>{useModel ? "Draft and review with your selected model." : "Local evidence map and checklist; no model answer or web search."}</small></div>}</div>}<div className="zt-input-row"><textarea value={question} maxLength={12000} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void run(); } }} placeholder={tab === "chat" ? "Ask Zero anything, or continue this conversation…" : "What do you want to investigate in the selected sources?"} aria-label="Message ZeroThink" disabled={workspaceBusy} />{busy ? <button className="zt-stop" onClick={() => void window.zeroOne.cancelZeroThink(runId.current)}>Stop · Esc</button> : <button className="zt-send" onClick={run} disabled={!question.trim() || !storageReady || workspaceBusy}>{tab === "research" ? "Research ↑" : "Send ↑"}</button>}</div><p className="zt-composer-status" role="status">{message}</p><small>Enter to send · Shift + Enter for a new line · Saved on this device</small></section></div>
    </div>
  </section>;
}
