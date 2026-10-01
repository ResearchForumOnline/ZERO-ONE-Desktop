import { useEffect, useState } from "react";

type Props = { onChanged?: (snapshot: ZeroThinkVaultSnapshot) => void; disabled?: boolean };
function failure(error: unknown) { return error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "") : "The vault operation could not finish. Your saved keys were preserved."; }
const blank = (): ZeroThinkVaultProfileInput => ({ name: "", provider: "groq", model: "", endpoint: "" });
export default function ZeroThinkVault({ onChanged, disabled = false }: Props) {
  const [snapshot, setSnapshot] = useState<ZeroThinkVaultSnapshot | null>(null), [form, setForm] = useState<ZeroThinkVaultProfileInput>(blank), [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("Opening your private vault…");
  const [pending, setPending] = useState<{ kind: "save" | "delete"; profile?: ZeroThinkVaultProfile } | null>(null);
  function update(value: ZeroThinkVaultSnapshot) { setSnapshot(value); onChanged?.(value); }
  useEffect(() => { let alive = true; window.zeroOne.getZeroThinkVault().then((value) => { if (alive) { update(value); setMessage(value.message); } }).catch((error) => { if (alive) setMessage(failure(error)); }); return () => { alive = false; }; }, []);
  const provider = snapshot?.providers.find((item) => item.id === form.provider), blocked = disabled || busy || !!pending || !snapshot?.secure;
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (blocked || !provider) return;
    if (form.id) { setPending({ kind: "save" }); return; }
    await executeSave();
  }
  async function executeSave() {
    if (disabled || busy || !snapshot?.secure || !provider) return;
    setPending(null);
    setBusy(true); const key = credential.trim(); setCredential("");
    try { const input = { ...form, name: form.name || provider.label, model: form.model || provider.defaultModel, endpoint: provider.id === "openzero" ? form.endpoint : provider.endpoint, ...(key ? { key } : {}) }; const value = await window.zeroOne.saveZeroThinkVaultProfile(input); update(value); setForm(blank()); setMessage("Profile saved in your encrypted vault. Choose Make active to use a chat profile."); }
    catch (error) { setMessage(failure(error)); } finally { setBusy(false); }
  }
  async function remove(profile: ZeroThinkVaultProfile) {
    if (blocked) return; setPending({ kind: "delete", profile });
  }
  async function executeRemove(profile: ZeroThinkVaultProfile) {
    if (disabled || busy || !snapshot?.secure) return; setPending(null);
    setBusy(true); try { update(await window.zeroOne.deleteZeroThinkVaultProfile(profile.id)); if (form.id === profile.id) { setForm(blank()); setCredential(""); } setMessage("Profile removed. Existing conversations and results remain saved."); } catch (error) { setMessage(failure(error)); } finally { setBusy(false); }
  }
  async function select(id: string | null) { if (blocked) return; setBusy(true); try { update(await window.zeroOne.selectZeroThinkVaultProfile(id)); setMessage(id ? "Active chat profile changed. New chat, research and Agent requests use this profile." : "Legacy model settings selected. Your vault profiles remain saved."); } catch (error) { setMessage(failure(error)); } finally { setBusy(false); } }
  function edit(profile: ZeroThinkVaultProfile) { setForm({ id: profile.id, name: profile.name, provider: profile.provider, model: profile.model, endpoint: profile.endpoint }); setCredential(""); setMessage("Edit the profile below. Leave the key empty to keep its existing credential."); }
  return <section className="zt-vault" aria-labelledby="zt-vault-heading">
    <header className="zt-panel-heading"><div><h2 id="zt-vault-heading">Private API vault</h2><p>Connect your own accounts. No publisher keys or account login are required.</p></div></header>
    <p className="zt-status" role="status">{message}</p>
    {pending && <div className="zt-vault-confirm" role="alertdialog" aria-modal="false" aria-labelledby="zt-vault-confirm-title">
      <h3 id="zt-vault-confirm-title">{pending.kind === "delete" ? "Remove vault profile?" : "Update this profile?"}</h3>
      <p>{pending.kind === "delete" ? `“${pending.profile?.name}” and its saved key will be removed from this device. Conversations and saved results are retained.` : "Future requests using this profile will use the model, server endpoint and credential you are saving."}</p>
      <div className="zt-toolbar"><button disabled={busy || disabled} onClick={() => { if (pending.kind === "delete" && pending.profile) void executeRemove(pending.profile); else void executeSave(); }}>{pending.kind === "delete" ? "Remove profile and key" : "Confirm update"}</button><button disabled={busy} onClick={() => { setPending(null); setCredential(""); setMessage("Vault change cancelled."); }}>Cancel</button></div>
    </div>}
    <div className="zt-vault-summary"><strong>{snapshot?.secure ? "OS encryption available" : "Vault unavailable"}</strong><span>Chat keys power Chat, Research and Agent. Serper powers web search; IonQ and IBM keys belong to Quantum. Services use the most recently saved key for that provider.</span></div>
    {snapshot && <div className="zt-vault-profiles">
      <div className="zt-toolbar"><h3>Saved profiles · {snapshot.profiles.length}/64</h3><button disabled={blocked || !snapshot.activeProfileId} onClick={() => void select(null)}>Use legacy model settings</button></div>
      {!snapshot.profiles.length && <p>Save a chat provider or service key below to get started. Saving a key does not contact its provider.</p>}
      {snapshot.profiles.map((profile) => <article className={`zt-vault-card${snapshot.activeProfileId === profile.id ? " is-active" : ""}`} key={profile.id}>
        <div><h4>{profile.name}{snapshot.activeProfileId === profile.id ? " · Active" : ""}</h4><p>{snapshot.providers.find((item) => item.id === profile.provider)?.label} · {profile.kind === "chat" ? profile.model : profile.kind === "search" ? "Web research" : "Quantum service"}</p><small>{profile.hasKey ? "Key saved · never displayed" : "No key saved"} · {profile.endpoint}</small></div>
        <div className="zt-toolbar">{profile.kind === "chat" && <button disabled={blocked || snapshot.activeProfileId === profile.id || (!profile.hasKey && profile.provider !== "openzero")} onClick={() => void select(profile.id)}>Make active</button>}<button disabled={blocked} onClick={() => edit(profile)}>Edit</button><button disabled={blocked} onClick={() => void remove(profile)}>Remove</button></div>
      </article>)}
    </div>}
    <form className="zt-vault-form" onSubmit={(event) => void save(event)}>
      <h3>{form.id ? "Edit profile" : "Add a provider or service"}</h3>
      <label>Provider<select value={form.provider} disabled={blocked || !!form.id} onChange={(event) => { const selected = snapshot?.providers.find((item) => item.id === event.target.value); if (selected) { setForm({ ...blank(), provider: selected.id, model: selected.defaultModel, endpoint: selected.endpoint }); setCredential(""); } }}>{snapshot?.providers.map((item) => <option value={item.id} key={item.id}>{item.label} · {item.kind}</option>)}</select></label>
      <label>Profile name<input value={form.name} disabled={blocked} maxLength={80} placeholder={provider?.label || "My provider"} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      {provider?.kind === "chat" && <label>Model<input value={form.model} disabled={blocked} maxLength={192} placeholder={provider.defaultModel || "Model ID served by your server"} onChange={(event) => setForm({ ...form, model: event.target.value })} required={provider.id === "openzero"} /><small>Use a model available to your account. Provider plans, models and limits can change.</small></label>}
      {provider?.id === "openzero" ? <label>Server endpoint<input value={form.endpoint} disabled={blocked} maxLength={2048} placeholder="https://your-server.example/v1" onChange={(event) => setForm({ ...form, endpoint: event.target.value })} required /><small>OpenAI-compatible endpoint. Remote servers require HTTPS; existing loopback servers can use HTTP.</small></label> : provider && <p className="zt-muted">Official endpoint: {provider.endpoint}</p>}
      <label>{provider?.requiresKey ? "API key" : "Server key · optional"}<input type="password" value={credential} disabled={blocked || form.clearKey === true} maxLength={8192} autoComplete="off" spellCheck={false} placeholder={form.id ? "Leave empty to retain the saved key" : "Paste your own key"} onChange={(event) => setCredential(event.target.value)} /></label>
      {form.id && <label className="zt-checkbox"><input type="checkbox" checked={form.clearKey === true} disabled={blocked} onChange={(event) => { setForm({ ...form, clearKey: event.target.checked }); if (event.target.checked) setCredential(""); }} />Remove the saved credential when updating this profile</label>}
      <p>Only the selected provider receives your questions and selected source excerpts. Service keys are used for the corresponding search or quantum action. Saving a key makes no API request and promises no free quota.</p>
      <div className="zt-toolbar"><button type="submit" disabled={blocked}>{busy ? "Saving…" : form.id ? "Update encrypted profile" : "Save encrypted profile"}</button>{form.id && <button type="button" disabled={busy} onClick={() => { setForm(blank()); setCredential(""); setMessage("Profile editing cancelled."); }}>Cancel edit</button>}</div>
    </form>
  </section>;
}
