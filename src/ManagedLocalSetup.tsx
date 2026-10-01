import { useCallback, useEffect, useRef, useState } from "react";
import "./managed-local.css";

const busyPhases = new Set(["downloading", "verifying", "starting"]);
const gb = (bytes: number) => `${(bytes / 1_000_000_000).toFixed(2)} GB`;

export function useManagedLocalStatus() {
  const [status, setStatus] = useState<ManagedLocalStatus>({ phase: "idle", detail: "Checking the built-in CPU engine…" });
  const refresh = useCallback(async () => {
    if (!window.zeroOne.getManagedLocalStatus) return;
    try { setStatus(await window.zeroOne.getManagedLocalStatus()); }
    catch (error) { setStatus({ phase: "error", detail: error instanceof Error ? error.message : "Local setup could not be checked." }); }
  }, []);
  useEffect(() => {
    void refresh();
    return window.zeroOne.onManagedLocalStatus?.(setStatus);
  }, [refresh]);
  return { status, refresh };
}

export default function ManagedLocalSetup({ autoStart = false, compact = false, onReady }: { autoStart?: boolean; compact?: boolean; onReady?: () => void }) {
  const { status, refresh } = useManagedLocalStatus();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const termsAccepted = status.termsAccepted === true || acceptTerms;
  const automaticAttempt = useRef(false);
  const busy = pending || busyPhases.has(status.phase);
  const total = status.total || 3_416_119_872;
  const completed = status.completed || 0;
  const percent = Math.max(0, Math.min(100, Math.round(completed / total * 100)));
  const setup = useCallback(async () => {
    if (!window.zeroOne.setupManagedLocal || pending || !termsAccepted) return;
    setPending(true); setError("");
    try { await window.zeroOne.setupManagedLocal({ acceptTerms: termsAccepted }); await refresh(); onReady?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Setup could not finish. Retry when the connection is available."); await refresh(); }
    finally { setPending(false); }
  }, [pending, refresh, onReady, termsAccepted]);
  useEffect(() => {
    if (!autoStart || automaticAttempt.current || !termsAccepted) return;
    automaticAttempt.current = true; void setup();
  }, [autoStart, setup, termsAccepted]);
  const heading = status.phase === "ready" ? "Your CPU AI is ready" : status.phase === "downloading" ? `Downloading your model · ${percent}%` : status.phase === "verifying" ? "Verifying the model download" : status.phase === "starting" ? "Loading the model on your CPU" : busy ? "Preparing local AI" : "One setup. Your own local AI.";
  return <section className={`managed-local-card ${compact ? "compact" : ""}`} aria-label="Built-in CPU AI setup" aria-busy={busy}>
    <div className="managed-local-title"><span aria-hidden="true">Ø</span><div><p>OPENZERO · BUILT-IN CPU ENGINE</p><h2>{heading}</h2></div><span className="managed-local-phase">{status.phase.toUpperCase()}</span></div>
    <p>ZERO ONE chooses the published OpenZero Gemma4 E2B model and configures its built-in engine for you. No API key, GPU or separate runtime installation is needed.</p>
    {!compact && <div className="managed-local-facts"><span>One-time model download: about {gb(total)}</span><span>8 GB RAM minimum</span><span>Prompts stay on this computer in local mode</span></div>}
    <p role="status" aria-live="polite">{error || status.detail || status.message || "Choose Set up my CPU AI. You can cancel the download or use notes and offline research while it prepares."}</p>
    {status.phase === "downloading" && <><progress max={100} value={percent} aria-label="Model download progress" /><small>{gb(completed)} of {gb(total)}</small></>}
    {status.phase === "verifying" && <small>The full SHA-256 hash is checked before the model is used.</small>}
    {status.phase === "starting" && <small>Loading can take time on older processors. This is a real local process; the app remains usable.</small>}
    {!status.termsAccepted && !busy && status.phase !== "ready" && <div className="managed-local-terms"><p>Model weights have Google Gemma and OpenZero Community Source terms, separate from the app’s Apache license.</p><button type="button" className="secondary-action" onClick={() => void window.zeroOne.openExternal("https://huggingface.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF/blob/5e7205c17e2ed3085a45416da01add508be357e7/README.md")}>Review model terms</button><label><input type="checkbox" checked={acceptTerms} onChange={event => setAcceptTerms(event.target.checked)} /> I have reviewed and accept the model terms and the one-time {gb(total)} download.</label></div>}
    <div className="managed-local-actions">
      {status.phase !== "ready" && <button type="button" className="primary-action" disabled={busy || !termsAccepted} onClick={() => void setup()}>{busy ? "Setting up automatically…" : error || status.phase === "error" || status.phase === "cancelled" ? "Retry CPU setup" : "Set up my CPU AI"}</button>}
      {busy && <button type="button" className="secondary-action" onClick={async () => { await window.zeroOne.cancelManagedLocalSetup(); await refresh(); }}>Cancel setup</button>}
      {status.phase === "ready" && <button type="button" className="secondary-action" onClick={async () => { await window.zeroOne.stopManagedLocal(); await refresh(); }}>Release model memory</button>}
      <button type="button" className="secondary-action" disabled={busy} onClick={() => void refresh()}>Check status</button>
    </div>
    {!compact && <small>Model weights are downloaded from the publisher's pinned Hugging Face revision and verified. The engine is included with the app. Large coding and research requests run more slowly on a CPU; you can choose your own server or API profile in the Vault.</small>}
  </section>;
}
