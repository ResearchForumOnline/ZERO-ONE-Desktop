import { useCallback, useEffect, useRef, useState } from "react";
import "./notes.css";

const colors: LocalNote["color"][] = ["midnight", "violet", "blue", "teal", "green", "amber", "rose"];
const errorMessage = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "ZNotes could not finish this action. Your existing notes were retained.";

export default function NotesWorkspace({ active }: { active: boolean }) {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [draft, setDraft] = useState<LocalNote | null>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<LocalNote["state"]>("active");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [labelFilter, setLabelFilter] = useState("");
  const [quick, setQuick] = useState("");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("Loading your encrypted notebook…");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [encryption, setEncryption] = useState<Awaited<ReturnType<Window["zeroOne"]["getNotesEncryptionStatus"]>> | null>(null);
  const draftRef = useRef<LocalNote | null>(null);
  const revision = useRef(0);
  const dirty = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const acceptDraft = useCallback((note: LocalNote | null) => {
    draftRef.current = note; dirty.current = false; revision.current += 1; setDraft(note); setLabel("");
  }, []);

  const refreshEncryption = useCallback(async () => {
    try { setEncryption(await window.zeroOne.getNotesEncryptionStatus()); }
    catch (error) { setEncryption({ version: 0, layers: 0, keys: 0, custody: "unverified", message: `Encryption status could not be verified: ${errorMessage(error)}` }); }
  }, []);

  const refresh = useCallback(async () => {
    const loaded = await window.zeroOne.listNotes();
    await refreshEncryption();
    setNotes(loaded);
    if (!dirty.current) {
      const current = loaded.find(note => note.id === draftRef.current?.id);
      acceptDraft(current || [...loaded].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).find(note => note.state === "active") || null);
    }
    return loaded;
  }, [acceptDraft, refreshEncryption]);

  useEffect(() => {
    if (!active) return;
    void refresh().then(loaded => {
      if (!dirty.current) { setFailed(false); setMessage(loaded.length ? `${loaded.length} notes on this device. Changes save automatically.` : "Your notebook is ready. Create a note or capture an idea below."); }
    }).catch(error => { setFailed(true); setMessage(errorMessage(error)); });
  }, [active, refresh]);

  const saveCurrent = useCallback(async () => {
    const snapshot = draftRef.current;
    if (!snapshot || !dirty.current) return true;
    const atRevision = revision.current;
    setMessage("Saving encrypted note…");
    try {
      const saved = await window.zeroOne.saveNote(snapshot);
      await refreshEncryption();
      setNotes(current => [saved, ...current.filter(note => note.id !== saved.id)]);
      if (draftRef.current?.id === saved.id && revision.current === atRevision) {
        draftRef.current = saved; dirty.current = false; setDraft(saved);
        setFailed(false); setMessage(`Saved locally · ${new Date(saved.updatedAt).toLocaleTimeString()}`);
      }
      return true;
    } catch (error) { setFailed(true); setMessage(errorMessage(error)); return false; }
  }, [refreshEncryption]);

  useEffect(() => {
    // Navigation hides this mounted workspace rather than discarding the draft.
    // Flush immediately instead of waiting for the debounce when it loses focus.
    if (!active) void saveCurrent();
  }, [active, saveCurrent]);

  useEffect(() => {
    const flush = () => { void saveCurrent(); };
    const leaving = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      void saveCurrent();
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("blur", flush);
    window.addEventListener("beforeunload", leaving);
    return () => { window.removeEventListener("blur", flush); window.removeEventListener("beforeunload", leaving); };
  }, [saveCurrent]);

  useEffect(() => {
    if (!dirty.current || !draft) return;
    const timer = window.setTimeout(() => { void saveCurrent(); }, 650);
    return () => window.clearTimeout(timer);
  }, [draft, saveCurrent]);

  function change(patch: Partial<LocalNote>) {
    if (!draftRef.current) return;
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next; revision.current += 1; dirty.current = true;
    setDraft(next); setMessage("Unsaved changes · saving shortly…");
  }

  const create = useCallback(async (content = "", checklist = false) => {
    setBusy(true);
    try {
      if (!await saveCurrent()) return;
      const note = await window.zeroOne.saveNote({ id: crypto.randomUUID(), title: content.trim().split("\n")[0].slice(0, 80) || "Untitled", content, pinned: false, state: "active", color: "midnight", labels: [], checklist: checklist ? [{ id: crypto.randomUUID(), text: "", done: false }] : [] });
      await refreshEncryption();
      setNotes(current => [note, ...current.filter(item => item.id !== note.id)]);
      acceptDraft(note); setState("active"); setQuick(""); setFailed(false); setMessage("New note created and encrypted on this device. Start typing — changes save automatically.");
      window.setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 0);
    } catch (error) { setFailed(true); setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }, [acceptDraft, saveCurrent, refreshEncryption]);

  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void saveCurrent(); }
      if (event.key.toLowerCase() === "n" && !busy) { event.preventDefault(); void create(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active, busy, create, saveCurrent]);

  async function open(note: LocalNote) {
    if (busy || note.id === draftRef.current?.id) return;
    setBusy(true);
    try { if (await saveCurrent()) { acceptDraft(note); setMessage("Changes save automatically. Ctrl/Cmd+S saves immediately."); } }
    finally { setBusy(false); }
  }

  async function setNoteState(next: LocalNote["state"]) {
    change({ state: next });
    if (await saveCurrent()) setState(next);
  }

  async function removeForever() {
    const target = draftRef.current;
    if (!target) return;
    setBusy(true);
    try {
      if (!await saveCurrent()) return;
      await window.zeroOne.deleteNote(target.id);
      acceptDraft(null); await refresh(); setConfirmDelete(false); setMessage("Note deleted from this device."); setFailed(false);
    } catch (error) { setFailed(true); setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function transfer(importing: boolean) {
    setBusy(true);
    try {
      if (!await saveCurrent()) return;
      if (importing) {
        const result = await window.zeroOne.importNotes();
        if (!result.cancelled) { await refresh(); setMessage(`Imported ${result.imported} notes. Existing notes were preserved; imported notes use new identifiers.`); setFailed(false); }
      } else {
        const result = await window.zeroOne.exportNotes();
        if (result.saved) { setMessage(`Exported ${result.count ?? notes.length} notes as plaintext JSON to the file you chose. Keep that file private.`); setFailed(false); }
      }
    } catch (error) { setFailed(true); setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  const labels = [...new Set(notes.flatMap(note => note.labels))].sort();
  const visible = notes.filter(note => note.state === state && (!labelFilter || note.labels.includes(labelFilter)) && `${note.title} ${note.content} ${note.labels.join(" ")} ${note.checklist.map(item => item.text).join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  return <section className="zn-workspace" aria-label="ZNotes local notebook">
    <header className="zn-heading"><div><p>YOUR PRIVATE NOTEBOOK</p><h2>ZNotes</h2><span>Quick ideas, checklists and research. Private desktop storage.</span></div><div className="zn-actions"><button onClick={() => transfer(true)} disabled={busy}>Import JSON</button><button onClick={() => transfer(false)} disabled={busy || !notes.length}>Export JSON</button><button className="primary-action" onClick={() => create()} disabled={busy}>New note +</button></div></header>
    <details className="zn-encryption"><summary>{encryption?.version === 2 && encryption.layers === 2 && encryption.keys === 2 ? "Two independent encryption keys · two AES-256-GCM layers" : encryption?.version === 1 ? "Existing OS-encrypted notebook · automatic upgrade on save" : "Notebook encryption status"}</summary><p>{encryption?.message || "Checking the notebook and protected key files…"}</p>{encryption?.version === 2 && <p>Both key files use the same OS account protection. This is not two-factor authentication or protection against an attacker controlling your unlocked account. Keep the notebook and its protected key folder together in an account-compatible backup. JSON exports are readable plaintext.</p>}{encryption?.legacyBackup && <p>The encrypted notebook from before this upgrade is retained as a migration backup. It keeps the original OS-only encryption.</p>}</details>
    <form className="zn-capture" onSubmit={event => { event.preventDefault(); if (quick.trim()) void create(quick); }}><input aria-label="Quick note" value={quick} onChange={event => setQuick(event.target.value)} placeholder="Take a note…" maxLength={500000} disabled={busy} /><button type="submit" disabled={busy || !quick.trim()}>Capture idea</button><button type="button" onClick={() => create("", true)} disabled={busy}>New checklist ☑</button></form>
    <div className="zn-toolbar"><nav aria-label="Note state">{(["active", "archived", "trash"] as const).map(value => <button key={value} aria-pressed={state === value} onClick={() => setState(value)}>{value === "active" ? "Notes" : value === "archived" ? "Archive" : "Trash"} <span>{notes.filter(note => note.state === value).length}</span></button>)}</nav><input aria-label="Search notes" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search text, labels, checklists…" /><select aria-label="Filter note labels" value={labelFilter} onChange={event => setLabelFilter(event.target.value)}><option value="">All labels</option>{labels.map(value => <option key={value}>{value}</option>)}</select><button aria-label={`Switch to ${layout === "grid" ? "list" : "grid"} view`} onClick={() => setLayout(layout === "grid" ? "list" : "grid")}>{layout === "grid" ? "List view" : "Grid view"}</button></div>
    <div className="zn-panels"><div className={`zn-cards zn-${layout}`} aria-label="Saved notes">{visible.length ? visible.map(note => <article className={`zn-card zn-color-${note.color} ${draft?.id === note.id ? "selected" : ""}`} key={note.id}><button onClick={() => open(note)} disabled={busy} aria-label={`Open ${note.title}`}><div><strong>{note.title}</strong>{note.pinned && <span title="Pinned">◆</span>}</div><p>{note.content || (note.checklist.length ? `${note.checklist.filter(item => item.done).length}/${note.checklist.length} checklist items complete` : "Empty note — ready for your ideas")}</p><div className="zn-card-labels">{note.labels.map(value => <span key={value}>{value}</span>)}</div><small>{new Date(note.updatedAt).toLocaleString()}</small></button></article>) : <div className="zn-empty"><strong>{query || labelFilter ? "No matching notes" : state === "active" ? "Capture your first idea" : `No notes in ${state === "trash" ? "Trash" : "Archive"}`}</strong><p>{state === "active" ? "New note creates a real saved note. Use a checklist for tasks and pin the ideas you need often." : "Your active notes are available in the Notes tab."}</p><button onClick={() => create()} disabled={busy}>Create a note</button></div>}</div>
      <div className="zn-editor">{draft ? <>
        <div className="zn-editor-top"><span>{draft.state === "trash" ? "IN TRASH" : draft.state === "archived" ? "ARCHIVED NOTE" : "NOTE EDITOR"}</span><button onClick={() => change({ pinned: !draft.pinned })} aria-pressed={draft.pinned} disabled={busy}>{draft.pinned ? "Unpin" : "Pin"}</button><button onClick={() => setNoteState(draft.state === "archived" ? "active" : "archived")} disabled={busy}>{draft.state === "archived" ? "Unarchive" : "Archive"}</button>{draft.state === "trash" ? <><button onClick={() => setNoteState("active")} disabled={busy}>Restore</button><button className="zn-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete forever</button></> : <button onClick={() => setNoteState("trash")} disabled={busy}>Move to trash</button>}<button onClick={() => saveCurrent()} disabled={busy}>Save now</button></div>
        <input className="zn-title" ref={titleRef} aria-label="Note title" value={draft.title} onChange={event => change({ title: event.target.value })} maxLength={160} disabled={busy} />
        <textarea className="zn-content" aria-label="Note content" value={draft.content} onChange={event => change({ content: event.target.value })} maxLength={500000} placeholder="Write freely. Changes save automatically to your encrypted notebook." disabled={busy} />
        <div className="zn-checklist">{draft.checklist.map(item => <div key={item.id}><input type="checkbox" aria-label={`Mark ${item.text || "checklist item"} complete`} checked={item.done} onChange={event => change({ checklist: draft.checklist.map(current => current.id === item.id ? { ...current, done: event.target.checked } : current) })} disabled={busy} /><input aria-label="Checklist item text" value={item.text} onChange={event => change({ checklist: draft.checklist.map(current => current.id === item.id ? { ...current, text: event.target.value } : current) })} maxLength={4000} placeholder="Add a task…" disabled={busy} /><button aria-label="Remove checklist item" onClick={() => change({ checklist: draft.checklist.filter(current => current.id !== item.id) })} disabled={busy}>×</button></div>)}<button onClick={() => change({ checklist: [...draft.checklist, { id: crypto.randomUUID(), text: "", done: false }] })} disabled={busy || draft.checklist.length >= 100}>+ Checklist item</button></div>
        <div className="zn-colors" aria-label="Note colour">{colors.map(color => <button key={color} className={`zn-swatch zn-color-${color}`} aria-label={`${color} note colour`} aria-pressed={draft.color === color} onClick={() => change({ color })} disabled={busy} />)}</div>
        <div className="zn-labels">{draft.labels.map(value => <button key={value} onClick={() => change({ labels: draft.labels.filter(current => current !== value) })} aria-label={`Remove label ${value}`} disabled={busy}>{value} ×</button>)}<form onSubmit={event => { event.preventDefault(); if (label.trim() && draft.labels.length < 20) { change({ labels: [...new Set([...draft.labels, label.trim()])] }); setLabel(""); } }}><input aria-label="New note label" value={label} onChange={event => setLabel(event.target.value)} maxLength={80} placeholder="Add a label…" disabled={busy} /><button disabled={busy || !label.trim() || draft.labels.length >= 20}>Add</button></form></div>
        <small className="zn-editor-foot">{draft.content.length.toLocaleString()} characters · Encrypted locally · Ctrl/Cmd+S to save now</small>
        {draft.reminder && <p className="zn-reminder-record">Imported calendar reminder record: {draft.reminder.start.replace("T", " ")} ({draft.reminder.timeZone}), {draft.reminder.reminderMinutes} minutes before. Preserved for export; this desktop notebook does not schedule calendar alerts.</p>}
      </> : <div className="zn-empty"><strong>Your writing space</strong><p>Select a note or create one above. Nothing is uploaded or synced to a company server.</p><button onClick={() => create()} disabled={busy}>Create a note</button></div>}</div>
    </div>
    <div className={`zn-status ${failed ? "failed" : ""}`} role={failed ? "alert" : "status"} aria-live="polite">{message}{failed && <button onClick={() => dirty.current ? saveCurrent() : refresh().then(() => { setFailed(false); setMessage("Notebook reopened."); }).catch(error => setMessage(errorMessage(error)))}>Try again</button>}</div>
    {confirmDelete && <div className="zn-confirm-backdrop"><section className="zn-confirm" role="alertdialog" aria-modal="true" aria-labelledby="zn-delete-title"><h3 id="zn-delete-title">Delete this note forever?</h3><p>The note is currently in Trash and can be restored. Permanent deletion removes it from this device and cannot be undone.</p><button autoFocus onClick={() => setConfirmDelete(false)} disabled={busy}>Keep in Trash</button><button className="zn-danger" onClick={() => removeForever()} disabled={busy}>Delete forever</button></section></div>}
  </section>;
}
