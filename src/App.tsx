import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SERVICES, ServiceDefinition, ServiceId, retainMountedServiceTab, serviceById, serviceIdFromView, serviceUrl } from "./lib/services";

type View = "home" | "shield" | "agents" | "settings" | `service:${ServiceId}`;
type ChatMessage = { role: "user" | "assistant"; content: string };
type ZeroThinkAccountState = "checking" | "linking" | "linked" | "signed-out" | "needs-link";
type LocalOpenZeroStatus = { reachable: boolean; origin: string; defaultModel: string; version: string; models: Array<{ name: string; size: number; modifiedAt: string }>; message?: string };
type LocalOpenZeroProgress = { status: string; completed: number; total: number; percent?: number; done: boolean };

const OPENZERO_MINISTRAL_RUNTIME_MODEL = "hf.co/shafire/OpenZero-Ministral3-8B-Runtime-Agent-GGUF:Q5_K_M";
const OPENZERO_GEMMA_COMPAT_MODEL = "hf.co/shafire/Zero-Gemma4-E4B-OpenZero-GGUF:latest";
const LOCAL_OPENZERO_MODEL = OPENZERO_MINISTRAL_RUNTIME_MODEL;
const LOCAL_MODEL_PROFILES = [
  { id: OPENZERO_MINISTRAL_RUNTIME_MODEL, label: "OpenZero Ministral 8B Runtime Agent", detail: "Default runtime edition · about 6.1 GB · upstream weights unchanged" },
  { id: OPENZERO_GEMMA_COMPAT_MODEL, label: "OpenZero Gemma4 E4B", detail: "Compatibility fallback · about 5.9 GB" },
] as const;
const isPublishedLocalModel = (model: string) => model.startsWith("hf.co/shafire/") && (model.includes("/openzero-") || model.includes("/zero-")) && model.includes("-gguf:");
const ZOOM_STEPS = [0.75, 0.85, 1, 1.1, 1.25, 1.4, 1.5] as const;
function nearestZoom(value: number) {
  return ZOOM_STEPS.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest, ZOOM_STEPS[2]);
}
const localOpenZeroApi = () => window.zeroOne as typeof window.zeroOne & {
  getLocalOpenZeroStatus?: () => Promise<LocalOpenZeroStatus>;
  openOllamaDownload?: () => Promise<boolean>;
  pullLocalOpenZeroModel?: (model: string, onProgress: (progress: LocalOpenZeroProgress) => void) => Promise<{ status: string }>;
  cancelLocalOpenZeroModelPull?: () => Promise<{ cancelled: number }>;
  chatLocalOpenZero?: (request: { model?: string; messages: ChatMessage[] }) => Promise<{ content: string; model: string }>;
};

const initialAssistant: ChatMessage[] = [
  {
    role: "assistant",
    content: "I’m your ZERO ONE Assistant. Private Local mode uses OpenZero + Ollama on this PC with no API keys. If the model is installed, just ask — otherwise open Settings once to download the tested OpenZero Gemma E4B model (~5.9 GB).",
  },
];

const iconPaths: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z",
  agents: "M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 15.5C5 15.5 8.1 13 12 13s7 2.5 7 5.5V21H5z",
  settings: "M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm8.2 4.8.1-1.3-.1-1.3 2-1.6-2-3.5-2.5 1a8 8 0 0 0-2.2-1.3L15.1 3h-4.2l-.4 2.6a8 8 0 0 0-2.2 1.3l-2.5-1-2 3.5 2 1.6-.1 1.3.1 1.3-2 1.6 2 3.5 2.5-1a8 8 0 0 0 2.2 1.3l.4 2.6h4.2l.4-2.6a8 8 0 0 0 2.2-1.3l2.5 1 2-3.5z",
  refresh: "M20 6v5h-5M4 18v-5h5m9.7-4A7 7 0 0 0 6.2 7M5.3 16a7 7 0 0 0 12.5 1",
  external: "M14 4h6v6m0-6-9 9M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6",
  send: "m4 4 17 8-17 8 3-8zM7 12h14",
  search: "m20 20-4.3-4.3M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  shield: "M12 3 5 6v5c0 4.8 2.9 8 7 10 4.1-2 7-5.2 7-10V6z",
  pulse: "M3 12h4l2-5 4 10 2-5h6",
  mail: "M3 6h18v12H3zM3 7l9 7 9-7",
  call: "M7 4h3l2 5-2 1.5a14 14 0 0 0 3.5 3.5L15 12l5 2v3c0 1.7-1.3 3-3 3C9.8 20 4 14.2 4 7c0-1.7 1.3-3 3-3Z",
};

function Icon({ name, size = 20 }: { name: keyof typeof iconPaths; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={iconPaths[name]} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(unitIndex === 0 || value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function StatusDot({ state }: { state?: ServiceProbe["state"] }) {
  return <span className={`status-dot ${state || "checking"}`} aria-label={state || "checking"} />;
}

function Sidebar({ view, mountedServiceIds, version, onNavigate }: { view: View; mountedServiceIds: readonly ServiceId[]; version: string; onNavigate: (view: View) => void }) {
  return (
    <aside className="sidebar">
      <button className="brand-mark" onClick={() => onNavigate("home")} aria-label="ZERO ONE home">
        <span className="brand-orbit" />
        <span>Ø</span>
      </button>
      <nav className="primary-nav" aria-label="Primary navigation">
        <NavButton active={view === "home"} label="Command" onClick={() => onNavigate("home")} icon="home" />
        <NavButton active={view === "shield"} label="ZSEC" onClick={() => onNavigate("shield")} icon="shield" />
        <NavButton active={view === "agents"} label="Automation" onClick={() => onNavigate("agents")} icon="agents" />
        <div className="nav-separator" />
        {SERVICES.map((service) => (
          <button
            key={service.id}
            className={`nav-service ${view === `service:${service.id}` ? "active" : ""} ${mountedServiceIds.includes(service.id) ? "mounted" : ""}`}
            style={{ "--service-accent": service.accent } as React.CSSProperties}
            onClick={() => onNavigate(`service:${service.id}`)}
            title={`${service.name}${mountedServiceIds.includes(service.id) ? " — open" : ""}`}
            aria-label={`${service.name}${mountedServiceIds.includes(service.id) ? ", open workspace" : ""}`}
            aria-current={view === `service:${service.id}` ? "page" : undefined}
          >
            {service.glyph}
          </button>
        ))}
      </nav>
      <NavButton active={view === "settings"} label="Settings" onClick={() => onNavigate("settings")} icon="settings" compact />
      <span className="sidebar-version" aria-label={`ZERO ONE version ${version || "unknown"}`}>v{version || "—"}</span>
    </aside>
  );
}

function NavButton({ active, label, onClick, icon, compact = false }: { active: boolean; label: string; onClick: () => void; icon: keyof typeof iconPaths; compact?: boolean }) {
  return (
    <button className={`nav-button ${active ? "active" : ""} ${compact ? "compact" : ""}`} onClick={onClick} title={label}>
      <Icon name={icon} size={21} />
      <span>{label}</span>
    </button>
  );
}

function Topbar({ view, probes, system, zoom, copilotOpen, onZoom, onToggleCopilot, onRefresh, onSearch, searchRef }: { view: View; probes: ServiceProbe[]; system: SystemSnapshot | null; zoom: number; copilotOpen: boolean; onZoom: (factor: number) => void; onToggleCopilot: () => void; onRefresh: () => void; onSearch: () => void; searchRef: React.RefObject<HTMLButtonElement | null> }) {
  const online = probes.filter((probe) => probe.state === "online").length;
  const title = view === "home" ? "Command center" : view === "shield" ? "ZSEC Shield" : view === "agents" ? "Automation" : view === "settings" ? "Settings" : serviceById(view.split(":")[1] as ServiceId).name;
  return (
    <header className="topbar">
      <div>
        <p className="top-eyebrow">ZERO ONE / {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" }).toUpperCase()}</p>
        <h1>{title}</h1>
      </div>
      <div className="top-actions">
        <button ref={searchRef} className="command-trigger" onClick={onSearch} aria-label="Search or command">
          <Icon name="search" size={17} />
          <span>Search or command</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="telemetry-pill" aria-live="polite" aria-label={`${online} of ${SERVICES.length} connected services are online`}>
          <span className="live-pulse" />
          <span>{online}/{SERVICES.length} online</span>
          {system && <strong>{system.memoryPercent}% RAM</strong>}        </div>
        <div className="zoom-controls" role="group" aria-label="Interface zoom">
          <button type="button" onClick={() => onZoom(nearestZoom(zoom - 0.1))} aria-label="Zoom out" title="Zoom out (Ctrl -)">−</button>
          <button type="button" className="zoom-value" onClick={() => onZoom(1)} aria-label={`Reset zoom, currently ${Math.round(zoom * 100)} percent`} title="Reset zoom (Ctrl 0)">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => onZoom(nearestZoom(zoom + 0.1))} aria-label="Zoom in" title="Zoom in (Ctrl +)">+</button>
        </div>
        <button type="button" className={`copilot-toggle ${copilotOpen ? "active" : ""}`} onClick={onToggleCopilot} aria-pressed={copilotOpen} aria-label={`${copilotOpen ? "Hide" : "Show"} quick Assistant`}><span>Ø</span><b>Assistant</b></button>
        <button className="icon-button" onClick={onRefresh} aria-label="Refresh status">
          <Icon name="refresh" />
        </button>
      </div>
    </header>
  );
}

function UpdateBanner({ update, onDismiss }: { update: AppUpdateInfo; onDismiss: () => void }) {
  const reviewRelease = () => { void window.zeroOne.openExternal(update.releaseUrl); };
  return (
    <aside className="app-update-banner" role="status" aria-live="polite">
      <span className="app-update-mark" aria-hidden="true">↑</span>
      <div><strong>ZERO ONE {update.latestVersion} is available</strong><small>Review the official GitHub release when convenient. Nothing is downloaded or installed automatically.</small></div>
      <button type="button" className="app-update-review" onClick={reviewRelease}>Review download ↗</button>
      <button type="button" className="app-update-dismiss" onClick={onDismiss} aria-label={`Dismiss ZERO ONE ${update.latestVersion} update notice`}>×</button>
    </aside>
  );
}

function Dashboard({ settings, probes, system, zsec, onOpen, onOpenShield }: { settings: ZeroOneSettings; probes: ServiceProbe[]; system: SystemSnapshot | null; zsec: ZsecSnapshot | null; onOpen: (id: ServiceId) => void; onOpenShield: () => void }) {
  const openZero = probes.find((probe) => probe.name === "openzero");
  const openZeroReady = openZero?.state === "online";
  const endpointValue = zsec?.state === "ready" ? "LAST SCAN CLEAR" : zsec?.state === "attention" ? "REVIEW" : zsec?.state === "idle" ? "INSTALLED" : zsec?.state === "not-installed" ? "NOT INSTALLED" : "UNAVAILABLE";
  return (
    <div className="view-scroll dashboard">
      <section className="hero-panel">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="hero-kicker"><span /> PRIVATE DESKTOP COMMAND CENTER</div>
          <h2>Your workspaces.<br /><em>Your configured AI.</em><br />One desktop command.</h2>
          <p>Mail, research, configured AI, agent controls, calls, and explicit on-demand security scans—composed into one fast desktop experience.</p>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => onOpen("openzero")}><span>Open full OpenZero panel</span><span>↗</span></button>
            <button className="secondary-action shield-action" onClick={onOpenShield}><Icon name="shield" size={17} /> Open ZSEC Shield</button>
          </div>
        </div>
        <div className="hero-core" aria-label="ZERO ONE neural core">
          <div className="core-ring ring-one" />
          <div className="core-ring ring-two" />
          <div className="core-ring ring-three" />
          <div className="core-center"><strong>{openZeroReady ? 1 : 0}</strong><span>ENDPOINT</span></div>
          {[0, 1, 2, 3, 4, 5].map((index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}
        </div>
        <div className="hero-metrics">
          <Metric label="OpenZero panel" value={openZeroReady ? "ONLINE" : "OFFLINE"} tone={openZeroReady ? "green" : "amber"} />
          <Metric label="Memory" value={system ? `${system.memoryPercent}%` : "—"} />
          <Metric label="Sessions" value="SEPARATE" tone="cyan" />
          <Metric label="ZSEC evidence" value={endpointValue} tone={zsec?.state === "ready" ? "green" : "amber"} />
        </div>
      </section>
      <div className="section-heading">
        <div><p>CONNECTED SYSTEMS</p><h3>Your four workspaces</h3></div>
        <span>Live health and direct access</span>
      </div>
      <section className="service-grid">
        {SERVICES.map((service) => (
          <ServiceCard key={service.id} service={service} probe={probes.find((item) => item.name === service.id)} onOpen={() => onOpen(service.id)} />
        ))}
      </section>

      <section className="lower-grid">
        <div className="glass-card lattice-card">
          <div className="card-title-row"><div><p>AUTONOMY</p><h3>Agent slots</h3></div><span className="mode-badge">{openZeroReady ? "ENDPOINT ONLINE" : "ENDPOINT OFFLINE"}</span></div>
          <div className="mini-agent-grid">
            {Array.from({ length: 16 }, (_, index) => <span key={index} className={openZeroReady && index === 0 ? "active" : ""}><i />{String(index + 1).padStart(2, "0")}</span>)}
          </div>
          <div className="lattice-footer"><span><i className={openZeroReady ? "green" : ""} />{openZeroReady ? "Endpoint reachable" : "Endpoint unavailable"}</span><span><i />Slots are UI capacity, not worker telemetry</span><button onClick={() => onOpen("openzero")}>Open runtime →</button></div>
        </div>
        <div className="glass-card activity-card">
          <div className="card-title-row"><div><p>SYSTEM</p><h3>Machine intelligence</h3></div><Icon name="pulse" /></div>
          <dl className="system-list">
            <div><dt>Node</dt><dd>{system?.hostname || "Connecting"}</dd></div>
            <div><dt>Processor</dt><dd>{system ? `${system.cores} logical cores` : "—"}</dd></div>
            <div><dt>Memory</dt><dd>{system ? `${formatBytes(system.memoryUsed)} / ${formatBytes(system.memoryTotal)}` : "—"}</dd></div>
            <div><dt>Uptime</dt><dd>{system ? formatUptime(system.uptimeSeconds) : "—"}</dd></div>
            <div><dt>Selected model</dt><dd className="mono">{settings.model}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function ZsecView({ snapshot, onRefresh }: { snapshot: ZsecSnapshot | null; onRefresh: () => Promise<void> }) {
  const [scanResult, setScanResult] = useState<ZsecScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const state = snapshot?.state || "unavailable";
  const platformLabel = snapshot?.platform === "darwin" ? "MACOS APPLE SILICON" : snapshot?.platform === "linux" ? "LINUX X64" : "WINDOWS 10 / 11 X64";
  const lastScan = snapshot?.lastScan ? new Date(snapshot.lastScan).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not yet recorded";
  const stateSummary = {
    idle: { label: "READY TO SCAN", title: "Choose what ZSEC checks" },
    ready: { label: "LAST SCAN: NO MATCHES", title: "Your last selected-folder check completed" },
    attention: { label: "REVIEW LAST SCAN", title: "The last check needs your attention" },
    "not-installed": { label: "SCANNER NOT INSTALLED", title: "Add the ZSEC scanning engine" },
    unavailable: { label: "STATUS UNAVAILABLE", title: "ZSEC needs a status refresh" },
  }[state];
  const signedFeedActive = Boolean(snapshot?.definitions?.includes("feed:active"));
  const filesChecked = typeof snapshot?.filesHashed === "number" ? snapshot.filesHashed.toLocaleString() : "—";
  const matches = snapshot?.lastScan ? snapshot.findings ?? 0 : "—";
  const errors = snapshot?.lastScan ? snapshot.errors ?? 0 : "—";

  const startScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await window.zeroOne.scanWithZsec();
      setScanResult(result);
      if (!result.cancelled) await onRefresh();
    } catch {
      setScanResult({ cancelled: false, outcome: "incomplete", errors: 1, message: "The local scan could not start. Refresh status and try again." });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="view-scroll zsec-view">
      <section className="zsec-hero glass-card">
        <div className={`zsec-radar ${scanning ? "scanning" : ""}`} aria-hidden="true"><span /><i /><b>{scanning ? "SCAN" : "ZS"}</b></div>
        <div className="zsec-copy">
          <p className="section-kicker">NO AI · DETERMINISTIC CONTROLS · LOCAL EVIDENCE</p>
          <h2>A useful security check,<br /><em>without hidden changes.</em></h2>
          <p>ZSEC checks a folder you choose for configured exact-file and byte-pattern rules. It stays local, shows evidence, and never silently deletes or quarantines your files.</p>
          <div className="zsec-state-row" aria-live="polite"><span className={`zsec-state ${state}`}>{stateSummary.label}</span><span>{stateSummary.title}</span></div>
        </div>
      </section>

      <section className="zsec-command-grid" aria-label="ZSEC actions and protection status">
        <div className="zsec-secure-now glass-card">
          <p className="section-kicker">GUIDED SECURE CHECK</p>
          <h3 id="zsec-start-title">Check a folder now</h3>
          <p>Pick Downloads, Desktop, or another folder. ZSEC reads regular files, applies its configured rules, and returns a result without changing the folder.</p>
          <div className="zsec-controls" aria-labelledby="zsec-start-title">
            {snapshot?.installed ? (
              <>
                <button className="primary-action zsec-primary" onClick={startScan} disabled={scanning} aria-busy={scanning}>{scanning ? "Scanning selected folder…" : "Choose folder and scan"}</button>
                <button className="secondary-action" onClick={onRefresh} disabled={scanning}><Icon name="refresh" size={16} /> Refresh evidence</button>
              </>
            ) : (
              <>
                <button className="primary-action zsec-primary" onClick={() => window.zeroOne.openExternal("https://talktoai.org/zsec/#shield")}>Get ZSEC Shield</button>
                <button className="secondary-action" onClick={() => window.zeroOne.openExternal("https://github.com/ResearchForumOnline/ZSEC-Shield")}><Icon name="external" size={16} /> View source</button>
              </>
            )}
          </div>
          <small className="zsec-action-note">You remain in control: this action does not upload, delete, quarantine, or change system settings.</small>
          {scanResult && (
            <div className={`zsec-result ${scanResult.outcome === "configured_rule_matches_detected" ? "attention" : scanResult.outcome === "incomplete" ? "incomplete" : "clear"}`} role="status" aria-live="polite">
              <strong>{scanResult.cancelled ? "No folder selected" : scanResult.outcome === "configured_rule_matches_detected" ? "Review the reported matches" : scanResult.outcome === "incomplete" ? "The scan was incomplete" : "No configured-rule matches"}</strong>
              <p>{scanResult.message}</p>
              {!scanResult.cancelled && typeof scanResult.filesHashed === "number" && <small>{scanResult.filesHashed.toLocaleString()} files · {formatBytes(scanResult.bytesHashed || 0)} read · {scanResult.errors || 0} errors</small>}
            </div>
          )}
        </div>

        <div className="zsec-protection-card glass-card">
          <div className="zsec-card-heading"><div><p className="section-kicker">PROTECTION AT A GLANCE</p><h3>What is active right now</h3></div><Icon name="shield" size={24} /></div>
          <ul className="zsec-protection-list">
            <li><div><strong>ZSEC folder checks</strong><span>Known exact rules, on demand</span></div><b className={snapshot?.installed ? "active" : "off"}>{snapshot?.installed ? "READY" : "NOT INSTALLED"}</b></li>
            <li><div><strong>Live file protection</strong><span>Keep Windows Security, XProtect, or your Linux protection active</span></div><b className="system">YOUR OS</b></li>
            <li><div><strong>Automatic file changes</strong><span>No silent deletion or quarantine</span></div><b className="safe">OFF BY DESIGN</b></li>
            <li><div><strong>Detection rules</strong><span>{signedFeedActive ? "A verified signed feed is active" : "Bundled rules; no production signed feed is active"}</span></div><b className={signedFeedActive ? "active" : "system"}>{signedFeedActive ? "SIGNED FEED" : "BUILT-IN"}</b></li>
          </ul>
        </div>
      </section>

      <section className="zsec-stats" aria-label="Last ZSEC check evidence">
        <article><span>LAST CHECK</span><strong>{lastScan}</strong><small>{snapshot?.message || "No local status is available yet."}</small></article>
        <article><span>FILES CHECKED</span><strong className="evidence">{filesChecked}</strong><small>{typeof snapshot?.bytesHashed === "number" ? `${formatBytes(snapshot.bytesHashed)} read` : "No verified scan counters yet"}</small></article>
        <article><span>RULE MATCHES</span><strong className={(snapshot?.findings || 0) > 0 ? "danger" : "safe"}>{matches}</strong><small>A match is a review signal, not proof that a file is malicious</small></article>
        <article><span>SCAN ERRORS</span><strong className={(snapshot?.errors || 0) > 0 ? "danger" : "safe"}>{errors}</strong><small>Unreadable, changed, skipped, or incomplete files are never hidden</small></article>
      </section>

      <section className="zsec-safe-defaults glass-card">
        <div><p className="section-kicker">AUTOMATIC SAFETY DEFAULTS</p><h3>Every ZSEC scan starts in safe mode</h3><p>These guardrails are automatic; threat removal is not.</p></div>
        <ul><li><span>✓</span><strong>Local only</strong><small>No AI, telemetry, or file upload</small></li><li><span>✓</span><strong>Non-destructive</strong><small>No delete or quarantine from ZERO ONE</small></li><li><span>✓</span><strong>Bounded</strong><small>Links, reparse points, and special files are not followed</small></li></ul>
      </section>

      <details className="zsec-details glass-card">
        <summary>Technical details and protection limits</summary>
        <div className="zsec-details-grid">
          <dl><div><dt>Engine</dt><dd>{snapshot?.installed ? snapshot.version || "Installed" : "Not installed"}</dd></div><div><dt>Rules</dt><dd>{snapshot?.definitions || "Awaiting install"}</dd></div><div><dt>Platform</dt><dd>{platformLabel}</dd></div><div><dt>Release channel</dt><dd>PUBLIC PREVIEW</dd></div><div><dt>Recoverable quarantine entries</dt><dd>{snapshot?.quarantine ?? 0}</dd></div></dl>
          <div><strong>Current boundary</strong><p>ZSEC is an on-demand companion, not a complete antivirus. It does not provide kernel-level interception, behavior or memory monitoring, browser or email filtering, cloud reputation, or zero-day protection. Keep your operating system’s built-in real-time protection enabled.</p></div>
        </div>
      </details>
    </div>
  );
}
function Metric({ label, value, tone = "white" }: { label: string; value: string; tone?: string }) {
  return <div className="hero-metric"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function ServiceCard({ service, probe, onOpen }: { service: ServiceDefinition; probe?: ServiceProbe; onOpen: () => void }) {
  return (
    <article className="service-card" style={{ "--service-accent": service.accent } as React.CSSProperties}>
      <div className="service-glow" />
      <div className="service-top"><span className="service-glyph">{service.glyph}</span><span className="service-status"><StatusDot state={probe?.state} />{probe?.state || "checking"}{probe?.latencyMs ? ` · ${probe.latencyMs}ms` : ""}</span></div>
      <p className="service-eyebrow">{service.eyebrow}</p>
      <h3>{service.name}</h3>
      <p className="service-description">{service.description}</p>
      <div className="capability-row">{service.capabilities.map((item) => <span key={item}>{item}</span>)}</div>
      <button className="service-open" onClick={onOpen}>Open workspace <span>↗</span></button>
    </article>
  );
}

function ServiceWorkspace({ service, settings, probe, active }: { service: ServiceDefinition; settings: ZeroOneSettings; probe?: ServiceProbe; active: boolean }) {
  const configuredUrl = serviceUrl(service, settings);
  const [workspaceUrl, setWorkspaceUrl] = useState(configuredUrl);
  const [reloadKey, setReloadKey] = useState(0);
  const [pairing, setPairing] = useState(false);
  const [restoringAccount, setRestoringAccount] = useState(service.id === "zerothink" && settings.hasZeroThinkAccount);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountState, setAccountState] = useState<ZeroThinkAccountState>(settings.hasZeroThinkAccount ? "checking" : "signed-out");
  const [accountError, setAccountError] = useState("");
  const [zeroThinkDockOpen, setZeroThinkDockOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openZeroSetup, setOpenZeroSetup] = useState<"idle" | "connecting" | "ready" | "error">(settings.hasOpenZeroToken ? "ready" : "idle");
  const [openZeroSetupMessage, setOpenZeroSetupMessage] = useState(settings.hasOpenZeroToken ? `${settings.model || "OpenZero"} connected` : "");
  const webviewRef = useRef<HTMLElement>(null);

  useEffect(() => { setWorkspaceUrl(configuredUrl); setReloadKey((value) => value + 1); }, [configuredUrl]);
  useEffect(() => {
    if (service.id !== "zmail") return;
    // Ask ZMail to refresh through its own server-controlled session.
    void window.zeroOne.keepZmailSessionAlive?.();
  }, [service.id]);
  useEffect(() => {
    if (service.id !== "zmail") return;
    const handleMailAction = async (event: Event) => {
      const request = (event as CustomEvent<{ id: string; action: "inbox" | "compose" }>).detail;
      if (!request?.id) return;
      if (request.action === "compose") {
        try {
          const origin = new URL(settings.zmailUrl).origin;
          setWorkspaceUrl(`${origin}/?_task=mail&_action=compose`);
          window.dispatchEvent(new CustomEvent("zero-one:zmail-result", { detail: { id: request.id, ok: true, message: "ZMail compose is open. Tell me the recipient, subject and key points and I’ll help draft it; review everything in ZMail before you press Send." } }));
        } catch {
          window.dispatchEvent(new CustomEvent("zero-one:zmail-result", { detail: { id: request.id, ok: false, message: "The configured ZMail address is invalid." } }));
        }
        return;
      }
      try {
        const webview = webviewRef.current as HTMLElement & { executeJavaScript?: (code: string, userGesture?: boolean) => Promise<unknown> };
        if (!webview?.executeJavaScript) throw new Error("Open ZMail once, then try Check inbox again.");
        const rows = await webview.executeJavaScript(`(() => Array.from(document.querySelectorAll('#messagelist tbody tr, table.messagelist tbody tr')).slice(0,10).map((row) => ({ sender: (row.querySelector('.fromto, .sender, [class*="from"]')?.textContent || '').trim().replace(/\\s+/g,' ').slice(0,120), subject: (row.querySelector('.subject, [class*="subject"]')?.textContent || '').trim().replace(/\\s+/g,' ').slice(0,180), date: (row.querySelector('.date, [class*="date"]')?.textContent || '').trim().replace(/\\s+/g,' ').slice(0,80), unread: row.classList.contains('unread') || row.getAttribute('aria-label')?.toLowerCase().includes('unread') })))()`, false) as Array<{ sender: string; subject: string; date: string; unread: boolean }>;
        const clean = Array.isArray(rows) ? rows.filter((row) => row.sender || row.subject).slice(0, 10) : [];
        const message = clean.length ? `Visible ZMail messages (${clean.length}):\n${clean.map((row, index) => `${index + 1}. ${row.unread ? "UNREAD · " : ""}${row.sender || "Unknown sender"} — ${row.subject || "No subject"}${row.date ? ` · ${row.date}` : ""}`).join("\n")}` : "No message rows are visible. Open the ZMail inbox and try again; ZERO ONE does not bypass login or read hidden mailbox data.";
        window.dispatchEvent(new CustomEvent("zero-one:zmail-result", { detail: { id: request.id, ok: true, message } }));
      } catch (error) {
        window.dispatchEvent(new CustomEvent("zero-one:zmail-result", { detail: { id: request.id, ok: false, message: error instanceof Error ? error.message : "The visible inbox could not be read." } }));
      }
    };
    window.addEventListener("zero-one:zmail-action", handleMailAction);
    return () => window.removeEventListener("zero-one:zmail-action", handleMailAction);
  }, [service.id, settings.zmailUrl]);
  useEffect(() => {
    if (service.id !== "zerothink") return;
    if (!settings.hasZeroThinkAccount) {
      setRestoringAccount(false);
      setAccountState("signed-out");
      setAccountEmail("");
      return;
    }
    let active = true;
    setRestoringAccount(true);
    setAccountState("checking");
    window.zeroOne.restoreZeroThinkSession().then((result) => {
      if (!active) return;
      if (result.status === "success") {
        setAccountEmail(result.email || settings.zeroThinkEmail || "");
        setAccountState("linked");
        setWorkspaceUrl(result.url || settings.zeroThinkUrl);
        setAccountError("");
        setReloadKey((value) => value + 1);
      } else {
        setAccountEmail("");
        setAccountState("needs-link");
        setAccountError(result.message || "Your saved ZeroThink link needs approval again.");
        setWorkspaceUrl("https://zerothink.talktoai.org/guest");
      }
    }).catch((error) => {
      if (active) {
        setAccountState("needs-link");
        setAccountEmail("");
        setAccountError(error instanceof Error ? error.message : "The ZeroThink session could not be restored.");
        setWorkspaceUrl("https://zerothink.talktoai.org/guest");
      }
    }).finally(() => { if (active) setRestoringAccount(false); });
    return () => { active = false; };
  }, [service.id, settings.hasZeroThinkAccount, settings.zeroThinkEmail, settings.zeroThinkUrl]);
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;
    let timer = window.setTimeout(() => { setLoading(false); setLoadError("This workspace is taking too long to load."); }, 20000);
    const start = () => { window.clearTimeout(timer); setLoading(true); setLoadError(""); timer = window.setTimeout(() => { setLoading(false); setLoadError("This workspace is taking too long to load."); }, 20000); };
    const stop = () => { window.clearTimeout(timer); setLoading(false); };
    const fail = (event?: Event & { errorCode?: number; isMainFrame?: boolean }) => {
      // Chromium aborts navigations with -3 during redirects/reloads; ignore those.
      if (event && typeof event.errorCode === "number" && (event.errorCode === -3 || event.isMainFrame === false)) return;
      window.clearTimeout(timer);
      setLoading(false);
      setLoadError("The workspace could not be loaded inside ZERO ONE.");
    };
    webview.addEventListener("did-start-loading", start);
    webview.addEventListener("did-stop-loading", stop);
    webview.addEventListener("did-fail-load", fail as EventListener);
    webview.addEventListener("render-process-gone", fail as EventListener);
    return () => {
      window.clearTimeout(timer);
      webview.removeEventListener("did-start-loading", start);
      webview.removeEventListener("did-stop-loading", stop);
      webview.removeEventListener("did-fail-load", fail as EventListener);
      webview.removeEventListener("render-process-gone", fail as EventListener);
    };
  }, [reloadKey, workspaceUrl]);

  const retry = () => { setLoadError(""); setLoading(true); setReloadKey((value) => value + 1); };
  const pairZeroThink = async () => {
    setPairing(true); setAccountState("linking"); setAccountError("");
    try { const result = await window.zeroOne.startZeroThinkSignIn(); setAccountEmail(result.email || ""); setAccountState("linked"); setWorkspaceUrl(result.url || settings.zeroThinkUrl); retry(); }
    catch (error) { setAccountState("needs-link"); setAccountError(error instanceof Error ? error.message : "ZeroThink sign-in was not completed."); }
    finally { setPairing(false); }
  };
  const signOutZeroThink = async () => { await window.zeroOne.signOutZeroThink(); setAccountEmail(""); setAccountError(""); setAccountState("signed-out"); setWorkspaceUrl("https://zerothink.talktoai.org/guest"); retry(); };
  const accountLinked = accountState === "linked";
  const zeroThinkOrigin = (() => { try { return new URL(settings.zeroThinkUrl).origin; } catch { return "https://zerothink.talktoai.org"; } })();
  const zeroThinkStudioPath = (() => { try { return new URL(settings.zeroThinkUrl).pathname || "/studio"; } catch { return "/studio"; } })();
  const zeroThinkPath = (() => { try { return new URL(workspaceUrl).pathname; } catch { return "/"; } })();
  const openZeroThinkPath = (path: string) => { setLoadError(""); setLoading(true); setWorkspaceUrl(`${zeroThinkOrigin}${path}`); };
  const connectLocalOpenZero = async () => {
    setOpenZeroSetup("connecting"); setOpenZeroSetupMessage("Checking OpenZero and selecting the browser model…");
    try {
      const result = await window.zeroOne.connectOpenZeroDesktop();
      const gemmaReady = result.models.includes("openzerogemma:latest");
      setOpenZeroSetup("ready");
      setOpenZeroSetupMessage(gemmaReady ? "OpenZero Gemma 4 is connected and ready for Assistant/API use." : `Connected with ${result.model}. Install openzerogemma:latest in the OpenZero panel for the recommended browser-agent model.`);
    } catch (error) {
      setOpenZeroSetup("error");
      setOpenZeroSetupMessage(error instanceof Error ? error.message : "OpenZero could not be connected. Start the local OpenZero panel and try again.");
    }
  };
  const workspaceSurface = (
    <div className="workspace-surface">
      {loading && <div className="workspace-loading" role="status"><span /><strong>Loading {service.name}…</strong><small>You can keep using the tray or another workspace.</small></div>}
      {loadError && <div className="workspace-error" role="alert"><span>!</span><h3>{loadError}</h3><p>Check your connection, retry here, or open the service in your browser.</p><div><button className="primary-action" onClick={retry}>Try again</button><button className="secondary-action" onClick={() => window.zeroOne.openExternal(workspaceUrl)}>Open in browser</button></div></div>}
      <webview key={`${workspaceUrl}-${reloadKey}`} ref={webviewRef} className="product-webview" src={workspaceUrl} partition={`persist:zero-one-${service.id}`} />
    </div>
  );
  return (
    <section
      className={`workspace-view workspace-tab-panel ${active ? "active" : "inactive"}`}
      data-service-tab={service.id}
      aria-hidden={!active}
      inert={!active}
    >
      <div className="workspace-toolbar" style={{ "--service-accent": service.accent } as React.CSSProperties}>
        <div className="workspace-identity"><span>{service.glyph}</span><div><p>{service.eyebrow}</p><h2>{service.name}</h2></div></div>
        <div className="workspace-address"><Icon name="shield" size={16} /><span>{workspaceUrl}</span></div>
        <div className="workspace-actions"><span className="workspace-health"><StatusDot state={probe?.state} />{probe?.state === "online" ? "reachable" : probe?.state || "checking"}</span><button onClick={retry}>Retry</button><button onClick={() => window.zeroOne.openExternal(workspaceUrl)}><Icon name="external" size={17} /> Browser</button></div>
      </div>
      {service.id === "zerothink" && (
        <div className={`account-banner ${accountLinked ? "linked" : accountState}`} role="status" aria-live="polite"><div><strong>{accountLinked ? "Signed in on this PC" : pairing ? "Finish Google approval in your browser…" : restoringAccount ? "Restoring your saved ZeroThink login…" : accountState === "needs-link" ? "Saved login needs a quick refresh" : "Sign in to ZeroThink (one time)"}</strong><span>{accountError || (accountLinked ? `${accountEmail || "ZeroThink account"} · Stays signed in after you close ZERO ONE.` : "Click Sign in with Google. Approve once in your browser, then return here. ZERO ONE saves the link so you should not need to do this every time.")}</span></div>{accountLinked ? <button className="secondary-action" onClick={signOutZeroThink}>Sign out</button> : <><button className="primary-action" disabled={pairing || restoringAccount} onClick={pairZeroThink}>{pairing ? "Waiting for approval…" : restoringAccount ? "Restoring login…" : accountState === "needs-link" ? "Sign in again ↗" : "Sign in with Google ↗"}</button><button className="secondary-action" disabled={restoringAccount} onClick={() => setWorkspaceUrl("https://zerothink.talktoai.org/guest")}>Continue as guest</button></>}</div>
      )}
      {service.id === "callchat" && !settings.mediaEnabled && (
        <div className="permission-banner"><Icon name="call" size={18} /><span>Camera and microphone are locked. Enable CallChat media in Settings when you want to make a call.</span></div>
      )}
      {service.id === "zmail" && (
        <div className={`openzero-context-banner ${openZeroSetup}`} role="status" aria-live="polite">
          <strong>Save login is optional</strong>
          <span>Tick “Save login in ZERO ONE” on the sign-in form only if you want an encrypted copy in your operating-system vault.</span>
          <i aria-hidden="true" />
          <strong>You control filling</strong>
          <span>Use “Fill saved ZERO ONE login” when needed. Server cookie expiry and logout remain unchanged.</span>
        </div>
      )}
      {service.id === "openzero" && probe?.state !== "offline" && (
        <div className="openzero-context-banner" role="note">
          <strong>Full OpenZero panel</strong>
          <span>Models, runs, tools and automation live here.</span>
          <i aria-hidden="true" />
          <strong>Assistant</strong>
          <span>The top-right drawer is fast everyday chat.</span>
          <i aria-hidden="true" />
          <strong>Tab Pilot</strong>
          <span>Chrome or Brave actions stay tab-scoped and require your approval.</span>
          <button type="button" className="context-link" disabled={openZeroSetup === "connecting"} onClick={connectLocalOpenZero}>{openZeroSetup === "connecting" ? "Connecting…" : openZeroSetup === "ready" ? "Reconnect OpenZero" : "Connect OpenZero + Gemma"}</button>
          <button type="button" className="context-link" onClick={() => window.zeroOne.openExternal("https://chromewebstore.google.com/detail/openzero-tab-pilot/cgaalobjjknalamgchppccbocnhonhbf")}>Install extension ↗</button>
          {openZeroSetupMessage && <span className={`context-status ${openZeroSetup}`}>{openZeroSetupMessage}</span>}
        </div>
      )}
      {probe?.state === "offline" && service.id === "openzero" && (
        <div className="runtime-banner"><span className="warning-symbol">!</span><div><strong>The full OpenZero panel is not responding</strong><p>Start OpenZero or its secure tunnel, then check the full-panel address in Settings. The local Assistant can still work independently.</p></div></div>
      )}
      {probe?.state === "offline" && service.id !== "openzero" && (
        <div className="runtime-banner"><span className="warning-symbol">!</span><div><strong>{service.name} is not reachable</strong><p>Check your network, VPN, or the workspace URL in Settings. You can still retry inside ZERO ONE or open the service in a browser.</p></div></div>
      )}
      {service.id === "zerothink" ? (
        <div className={`zerothink-layout ${zeroThinkDockOpen ? "" : "dock-collapsed"}`}>
          <aside className="zerothink-dock" aria-label="ZeroThink tools">
            <div className="zerothink-dock-head"><div><span>ZERO THINK</span><strong>Task space</strong></div><button onClick={() => setZeroThinkDockOpen((open) => !open)} aria-expanded={zeroThinkDockOpen} aria-label={zeroThinkDockOpen ? "Collapse ZeroThink tools" : "Expand ZeroThink tools"}>{zeroThinkDockOpen ? "‹" : "›"}</button></div>
            <button className="zerothink-new-task" onClick={() => openZeroThinkPath(accountLinked ? zeroThinkStudioPath : "/guest")}><span>＋</span><b>New task</b></button>
            <nav className="zerothink-tools">
              <p>WORKSPACE</p>
              <button className={zeroThinkPath === zeroThinkStudioPath || zeroThinkPath === "/guest" ? "active" : ""} onClick={() => openZeroThinkPath(accountLinked ? zeroThinkStudioPath : "/guest")}><Icon name="home" size={16} /><span>Workspace</span></button>
              <button className={zeroThinkPath === "/oracle" ? "active" : ""} onClick={() => openZeroThinkPath("/oracle")}><Icon name="pulse" size={16} /><span>Oracle</span></button>
              <p>LEARN &amp; CONNECT</p>
              <button className={zeroThinkPath === "/faq" ? "active" : ""} onClick={() => openZeroThinkPath("/faq")}><Icon name="shield" size={16} /><span>Help &amp; FAQ</span></button>
              <button className={zeroThinkPath === "/cli" ? "active" : ""} onClick={() => openZeroThinkPath("/cli")}><Icon name="agents" size={16} /><span>Optional CLI</span></button>
            </nav>
            <div className="zerothink-account-card"><span className={accountLinked ? "online" : "guest"}>{accountLinked ? (accountEmail.slice(0, 1).toUpperCase() || "Z") : "G"}</span><div><strong>{accountLinked ? (accountEmail || "ZeroThink account") : "Guest workspace"}</strong><small>{accountLinked ? "Saved on this PC" : accountState === "checking" ? "Restoring login…" : "Not signed in"}</small></div></div>
          </aside>
          {workspaceSurface}
        </div>
      ) : workspaceSurface}
    </section>
  );
}

function AgentLattice({ settings, openZeroProbe, onOpenZero }: { settings: ZeroOneSettings; openZeroProbe?: ServiceProbe; onOpenZero: () => void }) {
  return (
    <div className="view-scroll agent-view">
      <section className="agent-hero glass-card">
        <div><p className="section-kicker">BOUNDED AUTOMATION</p><h2>Automate work.<br /><em>Stay in control.</em></h2><p>OpenZero handles multi-step work through the permissions and confirmations configured in your local runtime. ZERO ONE never invents background workers or claims jobs that are not actually running.</p></div>
        <div className="agent-runtime"><StatusDot state={openZeroProbe?.state} /><span>OPENZERO ENDPOINT</span><strong>{openZeroProbe?.state || "CHECKING"}</strong><small>{settings.model}</small></div>
      </section>
      <section className="automation-grid">
        <article className="glass-card"><Icon name="pulse" /><strong>Local runtime</strong><p>{openZeroProbe?.state === "online" ? `Ready with ${settings.model}` : "Optional local OpenZero connection is not currently reachable."}</p></article>
        <article className="glass-card"><Icon name="shield" /><strong>Permission boundaries</strong><p>Tools and browser actions remain governed by OpenZero permissions and confirmation rules.</p></article>
        <article className="glass-card"><Icon name="agents" /><strong>Recursive Lab</strong><p>Agent Zero can persist code workspaces, inspect diffs, run approved tests, and promote or roll back verified changes through OpenZero.</p></article>
        <article className="glass-card"><Icon name="agents" /><strong>Real activity only</strong><p>Open the automation console to see actual runs, progress and results.</p></article>
      </section>
      <div className="agent-action-bar"><div><Icon name="shield" /><span>Execution remains bounded by OpenZero tool permissions and confirmations.</span></div><button className="primary-action" onClick={onOpenZero}>Open autonomous console ↗</button></div>
    </div>
  );
}

function SettingsView({ settings, appVersion, openZeroProbe, onSaved }: { settings: ZeroOneSettings; appVersion: string; openZeroProbe?: ServiceProbe; onSaved: (settings: ZeroOneSettings) => void }) {
  const [draft, setDraft] = useState<ZeroOneSettings>(settings);
  const [token, setToken] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [localChecking, setLocalChecking] = useState(false);
  const [localPulling, setLocalPulling] = useState(false);
  const [localStatus, setLocalStatus] = useState<LocalOpenZeroStatus | null>(null);
  const [localProgress, setLocalProgress] = useState<LocalOpenZeroProgress | null>(null);
  const [openZeroMode, setOpenZeroMode] = useState<"local" | "server">(() => isPublishedLocalModel((settings.model || "").toLowerCase()) ? "local" : "server");
  const [zmath, setZmath] = useState<ZmathSecurityStatus | null>(null);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => { setDraft(settings); setOpenZeroMode(isPublishedLocalModel((settings.model || "").toLowerCase()) ? "local" : "server"); }, [settings]);
  useEffect(() => { window.zeroOne.getZmathSecurityStatus().then(setZmath); }, []);
  const checkForUpdate = async () => {
    setCheckingUpdate(true);
    try { setUpdateInfo(await window.zeroOne.checkForAppUpdate()); }
    catch { setUpdateInfo({ status: "unavailable", updateAvailable: false, currentVersion: appVersion, latestVersion: appVersion, releaseUrl: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/latest", checkedAt: new Date().toISOString() }); }
    finally { setCheckingUpdate(false); }
  };
  const refreshLocalOpenZero = useCallback(async () => {
    const getStatus = localOpenZeroApi().getLocalOpenZeroStatus;
    if (!getStatus) return;
    setLocalChecking(true);
    try { setLocalStatus(await getStatus()); }
    catch { setLocalStatus({ reachable: false, origin: "http://127.0.0.1:11434", defaultModel: LOCAL_OPENZERO_MODEL, version: "", models: [], message: "The local model service could not be checked." }); }
    finally { setLocalChecking(false); }
  }, []);
  useEffect(() => { if (draft.assistantProvider === "openzero" && openZeroMode === "local") refreshLocalOpenZero(); }, [draft.assistantProvider, openZeroMode, refreshLocalOpenZero]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const saved = await window.zeroOne.saveSettings({ ...draft, openZeroToken: token || undefined, openAiKey: openAiKey || undefined, groqKey: groqKey || undefined });
      setToken("");
      setOpenAiKey("");
      setGroqKey("");
      onSaved(saved);
      setMessage("Settings saved. Secrets remain protected by secure storage for this operating-system account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {      setSaving(false);
    }
  };

  const [savedLogins, setSavedLogins] = useState<Array<{ origin: string; username: string; updatedAt?: string }>>([]);
  const [workspaceCredentialStatus, setWorkspaceCredentialStatus] = useState<{ available: boolean; backend?: string } | null>(null);
  const refreshSavedLogins = async () => {
    try {
      const [list, status] = await Promise.all([
        window.zeroOne.listSavedWorkspaceLogins?.(),
        window.zeroOne.getWorkspaceCredentialStatus?.(),
      ]);
      setSavedLogins(Array.isArray(list) ? list : []);
      setWorkspaceCredentialStatus(status || { available: false });
    } catch {
      setSavedLogins([]);
      setWorkspaceCredentialStatus({ available: false });
    }
  };
  useEffect(() => { void refreshSavedLogins(); }, []);

  const clearLocalData = async () => {
    setMessage("");
    try {
      const result = await window.zeroOne.clearLocalData();
      if (!result.cleared) setMessage("Local-data clearing cancelled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to clear local data.");
    }
  };

  const field = (key: keyof ZeroOneSettings, label: string, help: string) => (
    <label className="setting-field"><span>{label}</span><input value={String(draft[key] || "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /><small>{help}</small></label>
  );
  const dirty = Boolean(token.trim() || openAiKey.trim() || groqKey.trim()) || JSON.stringify(draft) !== JSON.stringify(settings);
  const chooseProvider = (provider: ZeroOneSettings["assistantProvider"]) => {
    const suggested = provider === "openzero" ? LOCAL_OPENZERO_MODEL : provider === "groq" ? "openai/gpt-oss-120b" : "gpt-5-mini";
    setDraft({ ...draft, assistantProvider: provider, model: suggested });
  };

  const installLocalOpenZeroModel = async () => {
    const pull = localOpenZeroApi().pullLocalOpenZeroModel;
    if (!pull) { setMessage("This preview cannot install the local model. Use the packaged ZERO ONE app."); return; }
    setLocalPulling(true);
    setLocalProgress({ status: "starting", completed: 0, total: 0, percent: 0, done: false });
    setMessage("");
    try {
      const model = draft.model || LOCAL_OPENZERO_MODEL;
      await pull(model, setLocalProgress);
      const saved = await window.zeroOne.saveSettings({ ...draft, assistantProvider: "openzero", model });
      setDraft(saved); onSaved(saved);
      await refreshLocalOpenZero();
      setMessage("The selected local Assistant is installed and ready to use.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The local model could not be downloaded. Check the connection and try again.");
    } finally { setLocalPulling(false); }
  };
  const localOpenZeroRunning = Boolean(localStatus?.reachable);
  const selectedLocalModel = draft.model || LOCAL_OPENZERO_MODEL;
  const localModelInstalled = Boolean(localStatus?.models.some((model) => model.name.toLowerCase() === selectedLocalModel.toLowerCase()));
  const localOpenZeroReady = openZeroMode === "local" && localOpenZeroRunning && localModelInstalled;
  const chooseOpenZeroMode = (mode: "local" | "server") => {
    setOpenZeroMode(mode);
    setMessage("");
    if (mode === "local") { setToken(""); setDraft({ ...draft, assistantProvider: "openzero", model: localStatus?.defaultModel || LOCAL_OPENZERO_MODEL, clearOpenZeroToken: false }); }
    else setDraft({ ...draft, assistantProvider: "openzero" });
  };

  return (
    <div className="view-scroll settings-view">
      <form onSubmit={save}>
        <section className="settings-section glass-card settings-intro">
          <div className="settings-heading"><div><p>EVERYDAY CONTROLS</p><h2>Make ZERO ONE work your way</h2></div><span>Safe defaults are already selected</span></div>
          <label className="check-row"><input type="checkbox" checked={draft.closeToTray} onChange={(event) => setDraft({ ...draft, closeToTray: event.target.checked })} /><span><strong>Keep ZERO ONE ready in the system tray</strong><small>Closing or minimising hides the window. Choose Quit from the tray when you want to stop it.</small></span></label>
          <label className="check-row"><input type="checkbox" checked={draft.launchAtLogin} onChange={(event) => setDraft({ ...draft, launchAtLogin: event.target.checked })} /><span><strong>Start when I sign in to this computer</strong><small>Starts quietly in the tray.</small></span></label>
          <label className="check-row"><input type="checkbox" checked={draft.mediaEnabled} onChange={(event) => setDraft({ ...draft, mediaEnabled: event.target.checked })} /><span><strong>Allow camera and microphone in CallChat</strong><small>Other workspaces remain blocked from camera and microphone access.</small></span></label>
        </section>
        <section className="settings-section glass-card settings-update-section" aria-labelledby="version-updates-heading">
          <div className="settings-heading"><div><p>VERSION &amp; UPDATES</p><h2 id="version-updates-heading">ZERO ONE v{appVersion || "—"}</h2></div><span>Official stable releases only</span></div>
          <div className="settings-update-row">
            <div className={`settings-update-state ${updateInfo?.status || "idle"}`}>
              <span aria-hidden="true">{updateInfo?.status === "available" ? "↑" : updateInfo?.status === "current" ? "✓" : "i"}</span>
              <div><strong>{updateInfo?.status === "available" ? `Version ${updateInfo.latestVersion} is available` : updateInfo?.status === "current" ? "You have the latest version" : updateInfo?.status === "unavailable" ? "Update service is temporarily unavailable" : "Ready to check for updates"}</strong><small>{updateInfo?.checkedAt ? `Last checked ${new Date(updateInfo.checkedAt).toLocaleString("en-GB")}` : "ZERO ONE checks the official GitHub release channel. Nothing installs without you reviewing it."}</small></div>
            </div>
            <div className="settings-update-actions">
              <button type="button" className="secondary-action" disabled={checkingUpdate} onClick={checkForUpdate}>{checkingUpdate ? "Checking…" : "Check for updates"}</button>
              {updateInfo?.updateAvailable && <button type="button" className="primary-action" onClick={() => window.zeroOne.openExternal(updateInfo.releaseUrl)}>Review official release ↗</button>}
            </div>
          </div>
        </section>
        <section className="settings-section glass-card account-setup">
          <div className="settings-heading"><div><p>ZEROTHINK</p><h2>Account access</h2></div><span>Sign in once</span></div>
          <p>Open the ZeroThink workspace and click <strong>Sign in with Google</strong>. Approve once in your browser, then return here. ZERO ONE stores a secure desktop link so you stay signed in after you close the app.</p>
          {settings.hasZeroThinkAccount ? <p className="no-token-note"><Icon name="shield" size={15} /> Saved ZeroThink account{settings.zeroThinkEmail ? `: ${settings.zeroThinkEmail}` : ""} · restore runs automatically when you open ZeroThink.</p> : <p className="no-token-note">No ZeroThink account linked yet. Open ZeroThink and sign in once.</p>}
        </section>
        <section className="settings-section glass-card">
          <div className="settings-heading"><div><p>ZMAIL &amp; WORKSPACES</p><h2>Saved logins on this PC</h2></div><span>{workspaceCredentialStatus === null ? "Checking secure storage" : workspaceCredentialStatus.available ? "Secure OS vault" : "Password saving unavailable"}</span></div>
          <p>Password saving is off by default. On an approved workspace sign-in form, tick <strong>Save login in ZERO ONE on this PC</strong> to opt in. A saved login is filled only when you press <strong>Fill saved ZERO ONE login</strong>. Persistent workspace cookies keep the server’s original expiry and logout rules.</p>
          {workspaceCredentialStatus?.available === false && <p className="runtime-banner" role="status"><span className="warning-symbol">!</span><span>ZERO ONE cannot access a secure operating-system credential vault, so it will not capture, decrypt, or fill workspace passwords.</span></p>}
          {savedLogins.length === 0 ? <p className="no-token-note">No saved workspace logins. Open ZMail and explicitly tick the save-login option if you want one stored.</p> : (
            <ul className="saved-login-list">
              {savedLogins.map((entry) => (
                <li key={entry.origin}>
                  <div><strong>{entry.username}</strong><small>{entry.origin}</small></div>
                  <button type="button" className="secondary-action" onClick={async () => { await window.zeroOne.deleteSavedWorkspaceLogin?.(entry.origin); await refreshSavedLogins(); setMessage("Saved login removed."); }}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          {savedLogins.length > 0 && <button type="button" className="secondary-action data-clear-action" onClick={async () => { await window.zeroOne.clearSavedWorkspaceLogins?.(); await refreshSavedLogins(); setMessage("All saved workspace logins cleared."); }}>Clear all saved logins</button>}
        </section>
        <section className="settings-section glass-card assistant-setup">
          <div className="settings-heading"><div><p>ASSISTANT DRAWER</p><h2>Choose how the quick chat answers</h2></div><span>Local model recommended</span></div>
          <p className="setup-lead">The top-right Assistant uses the fast local Qwen model for everyday chat. OpenZero browser planning uses <strong>openzerogemma:latest</strong> when available. They stay separate so a slower browser model does not make normal chat feel broken.</p>
          <div className="product-role-map" aria-label="How the connected OpenZero tools differ">
            <article><strong>Assistant drawer</strong><span>Quick questions and private local chat inside ZERO ONE.</span></article>
            <article><strong>OpenZero panel</strong><span>The full runtime for models, runs, tools and automation.</span></article>
            <article><strong>Tab Pilot</strong><span>Chrome/Brave browser actions planned by OpenZero Gemma, with explicit tab and action consent.</span></article>
          </div>
          <div className="provider-picker" role="radiogroup" aria-label="Assistant provider">
            <button type="button" role="radio" aria-checked={draft.assistantProvider === "openzero"} className={draft.assistantProvider === "openzero" ? "selected" : ""} onClick={() => chooseProvider("openzero")}><strong>Private Assistant</strong><span>Recommended · private</span><small>Run a fast local model, or use your OpenZero server</small></button>
            <button type="button" role="radio" aria-checked={draft.assistantProvider === "groq"} className={draft.assistantProvider === "groq" ? "selected" : ""} onClick={() => chooseProvider("groq")}><strong>Groq</strong><span>Optional · fast cloud</span><small>Use your own Groq API key</small></button>
            <button type="button" role="radio" aria-checked={draft.assistantProvider === "openai"} className={draft.assistantProvider === "openai" ? "selected" : ""} onClick={() => chooseProvider("openai")}><strong>OpenAI</strong><span>Optional · cloud</span><small>Use your own OpenAI API key</small></button>
          </div>
          {draft.assistantProvider === "openzero" && <>
            <div className="openzero-mode-picker" role="radiogroup" aria-label="OpenZero location">
              <button type="button" role="radio" aria-checked={openZeroMode === "local"} className={openZeroMode === "local" ? "selected" : ""} onClick={() => chooseOpenZeroMode("local")}><span className="recommended-pill">RECOMMENDED</span><strong>Local Assistant model</strong><small>Private, automatic chat setup. No token or technical configuration.</small></button>
              <button type="button" role="radio" aria-checked={openZeroMode === "server"} className={openZeroMode === "server" ? "selected" : ""} onClick={() => chooseOpenZeroMode("server")}><span>ADVANCED</span><strong>Use my OpenZero server</strong><small>Uses an existing OpenZero runtime for Assistant replies.</small></button>
            </div>
            {openZeroMode === "local" ? <div className={`local-openzero-setup ${localOpenZeroReady ? "ready" : localPulling || localChecking ? "connecting" : ""}`} aria-live="polite" aria-busy={localPulling || localChecking}>
              <label className="setting-field"><span>Local Assistant model</span><select value={selectedLocalModel} onChange={(event) => setDraft({ ...draft, assistantProvider: "openzero", model: event.target.value })}>{LOCAL_MODEL_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select><small>{LOCAL_MODEL_PROFILES.find((profile) => profile.id === selectedLocalModel)?.detail || "A locally installed OpenZero GGUF."}</small></label>
              <div className="local-openzero-status"><span className={`status-dot ${localOpenZeroReady || localOpenZeroRunning ? "online" : localPulling || localChecking ? "checking" : "offline"}`} /><div><strong>{localOpenZeroReady ? "Local OpenZero Assistant is ready" : localPulling ? "Downloading the selected local Assistant…" : localChecking ? "Checking this computer…" : localOpenZeroRunning ? "Local engine ready—one model download remains" : "Install or start Ollama to continue"}</strong><small>{localOpenZeroReady ? "Quick chat runs on this computer. Open Assistant and start chatting." : localPulling ? `${localProgress?.status || "Preparing download"}${Number.isFinite(localProgress?.percent) ? ` · ${Math.round(localProgress?.percent || 0)}%` : ""}` : localOpenZeroRunning ? "Choose the compact default for responsiveness, or the 8B runtime edition on a capable CPU with at least 10 GB free disk space." : "Ollama is the small local engine that runs the private Assistant model."}</small></div></div>
              {localPulling && <div className="model-download-bar" role="progressbar" aria-label="Local Qwen Assistant download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(localProgress?.percent || 0)}><span style={{ width: `${Math.max(2, localProgress?.percent || 0)}%` }} /></div>}
              <div className="connection-progress" aria-label="Local Assistant setup progress"><span className={localOpenZeroRunning ? "done" : "current"}>1<i>Local engine</i></span><b /><span className={localModelInstalled ? "done" : localPulling || localOpenZeroRunning ? "current" : ""}>2<i>Selected model</i></span><b /><span className={localOpenZeroReady ? "done" : ""}>3<i>Ready to chat</i></span></div>
              <div className="setup-actions">{!localOpenZeroRunning && <button type="button" className="primary-action" onClick={() => localOpenZeroApi().openOllamaDownload?.() || window.zeroOne.openExternal("https://ollama.com/download")}>Install Ollama ↗</button>}{localOpenZeroRunning && !localModelInstalled && <button type="button" className="primary-action" disabled={localPulling} onClick={installLocalOpenZeroModel}>{localPulling ? "Downloading…" : "Download selected local Assistant"}</button>}{localPulling && <button type="button" className="secondary-action" onClick={() => localOpenZeroApi().cancelLocalOpenZeroModelPull?.()}>Cancel download</button>}<button type="button" className="secondary-action" disabled={localChecking || localPulling} onClick={refreshLocalOpenZero}>{localChecking ? "Checking…" : "Check again"}</button></div>
              <p className="no-token-note"><Icon name="shield" size={15} /> Local Assistant mode needs no API key or token. Prompts and answers stay on this computer.</p>
            </div> : <details className="server-openzero-setup" open><summary>Use OpenZero server for Assistant</summary><p>Enter these only if you already have an OpenZero server. The same address opens its full panel from the OpenZero tile.</p><div className="settings-grid">{field("openZeroUrl", "Full panel and API address", "The approved OpenZero runtime address, including https:// or a secure loopback tunnel.")}<label className="setting-field"><span>Assistant/API desktop token</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={draft.hasOpenZeroToken ? "Stored securely · leave blank to keep" : "Paste the token supplied by your server"} autoComplete="off" /><small>Stored with this operating-system account and sent only to your configured OpenZero server.</small></label>{field("model", "Assistant model", "The model installed on your OpenZero server.")}</div></details>}
          </>}
          <div className="settings-grid">
            {draft.assistantProvider !== "openzero" && field("model", "Assistant model", "The provider model ID used by Assistant.")}
            {draft.assistantProvider === "groq" && <label className="setting-field"><span>Groq API key</span><input type="password" value={groqKey} onChange={(event) => setGroqKey(event.target.value)} placeholder={draft.hasGroqKey ? "Stored securely · leave blank to keep" : "Paste gsk_ key"} autoComplete="off" /><small>Sent only to Groq when Groq is selected.</small></label>}
            {draft.assistantProvider === "openai" && <label className="setting-field"><span>OpenAI API key</span><input type="password" value={openAiKey} onChange={(event) => setOpenAiKey(event.target.value)} placeholder={draft.hasOpenAiKey ? "Stored securely · leave blank to keep" : "Paste sk- key"} autoComplete="off" /><small>Sent only to OpenAI when OpenAI is selected.</small></label>}
          </div>
          {draft.assistantProvider !== "openzero" && <div className="hosted-provider-help"><div><strong>Cloud provider setup</strong><span>Add your own key below. ZERO ONE stores it securely and uses it only when this provider is selected.</span></div><button type="button" className="secondary-action" onClick={() => window.zeroOne.openExternal(draft.assistantProvider === "groq" ? "https://console.groq.com/keys" : "https://platform.openai.com/api-keys")}>Open {draft.assistantProvider === "groq" ? "Groq keys" : "OpenAI keys"} ↗</button></div>}
          {draft.assistantProvider === "openzero" && openZeroMode === "server" && draft.hasOpenZeroToken && <label className="check-row danger"><input type="checkbox" checked={Boolean(draft.clearOpenZeroToken)} onChange={(event) => setDraft({ ...draft, clearOpenZeroToken: event.target.checked })} /><span>Remove the stored server token when I save</span></label>}
          {draft.assistantProvider === "groq" && draft.hasGroqKey && <label className="check-row danger"><input type="checkbox" checked={Boolean(draft.clearGroqKey)} onChange={(event) => setDraft({ ...draft, clearGroqKey: event.target.checked })} /><span>Remove the stored Groq key when I save</span></label>}
          {draft.assistantProvider === "openai" && draft.hasOpenAiKey && <label className="check-row danger"><input type="checkbox" checked={Boolean(draft.clearOpenAiKey)} onChange={(event) => setDraft({ ...draft, clearOpenAiKey: event.target.checked })} /><span>Remove the stored OpenAI key when I save</span></label>}
        </section>
        <details className="settings-details glass-card">
          <summary>Advanced connection addresses</summary>
        <section className="settings-section glass-card">
          <div className="settings-heading"><div><p>CONNECTIONS</p><h2>Owned services</h2></div><span>Only approved ZERO ONE origins are accepted</span></div>
          <div className="settings-grid">
            {(draft.assistantProvider !== "openzero" || openZeroMode === "local") && field("openZeroUrl", "OpenZero full panel and API", "Used by the OpenZero tile and automation status. Use an approved HTTPS address or secure loopback tunnel.")}
            {field("zeroThinkUrl", "ZeroThink Studio", "Your signed-in cognitive workspace.")}
            {field("zmailUrl", "ZMail Workspace", "Your secure webmail and zSign workspace.")}
            {field("callChatUrl", "CallChat", "Voice and video workspace.")}
          </div>
        </section>
        </details>
        <details className="settings-details glass-card"><summary>Security, privacy and app controls</summary><section className="settings-section">
          <div className="settings-heading"><div><p>ZMATH SECURE</p><h2>Automatic protection</h2></div><span>Secure defaults · no configuration required</span></div>
          <div className="zmath-grid">
            <article><span className={`zmath-status ${zmath?.transport.state || "checking"}`}>{zmath?.transport.state || "checking"}</span><strong>Connection guard</strong><p>{zmath?.transport.message || "Checking transport policy…"}</p></article>
            <article><span className={`zmath-status ${zmath?.credentials.state || "checking"}`}>{zmath?.credentials.state || "checking"}</span><strong>Credential vault</strong><p>{zmath?.credentials.message || "Checking operating-system secure storage…"}</p></article>
            <article><span className={`zmath-status ${zmath?.disk.state || "checking"}`}>{zmath?.disk.state || "checking"}</span><strong>System disk</strong><p>{zmath?.disk.message || "Reading Windows disk-encryption status…"}</p></article>
          </div>
          <div className="zmath-disk-action">
            <div><strong>Optional full-disk encryption</strong><p>ZERO ONE never enables or changes disk encryption silently. Windows manages BitLocker and its recovery key. Initial encryption can take time; modern hardware usually has modest overhead, while older or storage-heavy systems may notice more.</p></div>
            <button type="button" className="secondary-action" onClick={() => window.zeroOne.openDiskEncryptionSettings()}>Open Windows encryption settings</button>
          </div>
          <p className="zmath-boundary">ZMath Secure is the product security policy and compatibility layer. This open-source client uses established TLS and operating-system cryptography. Experimental proprietary ZMath cipher research is not embedded in this repository and is not represented as active protection.</p>
        </section>
        <section className="settings-section glass-card">
          <div className="settings-heading"><div><p>DESKTOP</p><h2>App behavior</h2></div><span>Privacy-first defaults</span></div>
          <button type="button" className="secondary-action data-clear-action" onClick={clearLocalData}>Clear desktop data</button><small className="data-clear-note">Removes settings, encrypted tokens, saved ZMail logins, and workspace cookies after confirmation. Server accounts and diagnostics files you saved are not deleted.</small>
          <button type="button" className="secondary-action quit-action" onClick={() => window.zeroOne.quitApp()}>Quit ZERO ONE completely</button>
        </section>
        <section className="settings-section glass-card">
          <div className="settings-heading"><div><p>ABOUT</p><h2>ZERO ONE</h2></div><span>Open-core desktop shell</span></div>
          <dl className="system-list about-list">
            <div><dt>Version</dt><dd className="mono">{appVersion || "—"}</dd></div>
            <div><dt>Assistant default</dt><dd>OpenZero Local · Ministral 3 8B Q5_K_M</dd></div>
            <div><dt>Security</dt><dd>TLS · OS credential store · ZSEC Shield on-demand</dd></div>
            <div><dt>Source</dt><dd><button type="button" className="linkish" onClick={() => window.zeroOne.openExternal("https://github.com/ResearchForumOnline/ZERO-ONE-Desktop")}>GitHub ↗</button></dd></div>
          </dl>
          <small className="data-clear-note">Apache-2.0 open shell. Proprietary ZMath research and production secrets are not included in this repository.</small>
        </section>
        </details>
        <div className="settings-footer"><span role="status" aria-live="polite">{message || (dirty ? "You have unsaved changes." : "All changes saved.")}</span><button className="primary-action" disabled={saving || !dirty}>{saving ? "Saving…" : "Save changes"}</button></div>
      </form>
    </div>
  );}

function Copilot({ settings, onOpenSettings }: { settings: ZeroOneSettings; onOpenSettings: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialAssistant);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [localChecking, setLocalChecking] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<LocalOpenZeroProgress | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const clearChat = () => setMessages(initialAssistant);
  // Published OpenZero GGUF selections are local even when a separate panel
  // token is retained for browser workflows.
  const selectedModel = (settings.model || "").toLowerCase();
  const publishedLocalModel = selectedModel.startsWith("hf.co/shafire/") && (selectedModel.includes("/openzero-") || selectedModel.includes("/zero-")) && selectedModel.includes("-gguf:");
  const localSelected = settings.assistantProvider === "openzero" && (publishedLocalModel || settings.model === LOCAL_OPENZERO_MODEL || !settings.hasOpenZeroToken);
  const providerLabel = settings.assistantProvider === "groq" ? "Groq" : settings.assistantProvider === "openai" ? "OpenAI" : localSelected ? "OpenZero Local" : "OpenZero Server";
  const ready = settings.assistantProvider === "groq" ? settings.hasGroqKey : settings.assistantProvider === "openai" ? settings.hasOpenAiKey : localSelected ? localReady : settings.hasOpenZeroToken;

  const refreshLocal = useCallback(async () => {
    if (!localSelected || !localOpenZeroApi().getLocalOpenZeroStatus) { setLocalReady(false); return; }
    setLocalChecking(true);
    try {
      const status = await localOpenZeroApi().getLocalOpenZeroStatus!();
      const modelName = (settings.model || status.defaultModel || LOCAL_OPENZERO_MODEL).toLowerCase();
      setLocalReady(status.reachable && status.models.some((model) => model.name.toLowerCase() === modelName || model.name.toLowerCase().startsWith(`${modelName.split(":")[0]}:`)));
    } catch {
      setLocalReady(false);
    } finally {
      setLocalChecking(false);
    }
  }, [localSelected, settings.model]);

  useEffect(() => {
    refreshLocal();
    if (!localSelected) return;
    const id = window.setInterval(refreshLocal, 20_000);
    return () => window.clearInterval(id);
  }, [localSelected, refreshLocal]);

  useEffect(() => {
    const stream = streamRef.current;
    if (stream) stream.scrollTop = stream.scrollHeight;
  }, [messages, busy]);

  const pullLocalModel = async () => {
    const pull = localOpenZeroApi().pullLocalOpenZeroModel;
    if (!pull || pulling) return;
    setPulling(true);
    setPullProgress({ status: "starting", completed: 0, total: 0, done: false });
    try {
      await pull(settings.model || LOCAL_OPENZERO_MODEL, (progress) => setPullProgress(progress));
      await refreshLocal();
      setMessages((current) => [...current, { role: "assistant", content: "Local model is ready. Ask me anything — no API key required." }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Could not download the local model." }]);
    } finally {
      setPulling(false);
    }
  };

  const runMailAction = (action: "inbox" | "compose") => {
    if (busy) return;
    const id = crypto.randomUUID();
    setBusy(true);
    const timeout = window.setTimeout(() => {
      window.removeEventListener("zero-one:zmail-result", receive as EventListener);
      setMessages((current) => [...current, { role: "assistant", content: "Open the ZMail workspace and try again. ZERO ONE only reads the mailbox view you are already signed into." }]);
      setBusy(false);
    }, 8000);
    const receive = (event: Event) => {
      const result = (event as CustomEvent<{ id: string; message: string }>).detail;
      if (result?.id !== id) return;
      window.clearTimeout(timeout);
      window.removeEventListener("zero-one:zmail-result", receive as EventListener);
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
      setBusy(false);
    };
    window.addEventListener("zero-one:zmail-result", receive as EventListener);
    window.dispatchEvent(new CustomEvent("zero-one:zmail-action", { detail: { id, action } }));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !ready) return;
    const next = [...messages, { role: "user", content: text } as ChatMessage];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const request = { model: settings.model || LOCAL_OPENZERO_MODEL, messages: next.map(({ role, content }) => ({ role, content })) };
      // Prefer direct local chat when in local mode; otherwise unified chat (which also falls back to Ollama).
      const response = localSelected && localOpenZeroApi().chatLocalOpenZero
        ? await localOpenZeroApi().chatLocalOpenZero!(request)
        : await window.zeroOne.chat(request);
      setMessages((current) => [...current, { role: "assistant", content: response.content }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The configured OpenZero model is unavailable." }]);
    } finally {
      setBusy(false);
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
  };

  return (
    <aside className="copilot">
      <div className="copilot-header"><div className="copilot-symbol">Ø<span /></div><div><p>ZERO ONE ASSISTANT</p><h3>Zero</h3></div><span className={`copilot-state ${ready ? "ready" : "setup"}`}>{ready ? "READY" : localChecking ? "CHECK" : "SETUP"}</span></div>
      <div className="copilot-context"><span>{providerLabel.toUpperCase()}</span><strong>{settings.model || LOCAL_OPENZERO_MODEL}</strong><button type="button" className="chat-clear" onClick={clearChat} title="Clear conversation (Ctrl+L)" aria-label="Clear conversation">Clear</button></div>
      <div className="chat-stream" ref={streamRef}>
        {messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><span>{message.role === "assistant" ? "Ø" : "YOU"}</span><p>{message.content}</p></div>)}
        {busy && <div className="thinking"><i /><i /><i /></div>}
      </div>
      {!ready && (
        <div className="assistant-empty">
          <strong>{localSelected ? "One-time local model" : "One quick setup"}</strong>
          <span>
            {localSelected
              ? "Download the private OpenZero local model once. No account, token, or cloud key is required."
              : `${providerLabel} is selected. Add its key once to start chatting here.`}
          </span>
          {localSelected ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="token-prompt" disabled={pulling} onClick={pullLocalModel}>
                <Icon name="shield" size={16} /> {pulling ? (pullProgress?.percent != null ? `Downloading ${pullProgress.percent}%` : "Downloading…") : "Download OpenZero model · ~5.9 GB"}
              </button>
              <button className="token-prompt" onClick={() => localOpenZeroApi().openOllamaDownload?.()}>Get Ollama ↗</button>
              <button className="token-prompt" onClick={onOpenSettings}>Settings</button>
            </div>
          ) : (
            <button className="token-prompt" onClick={onOpenSettings}><Icon name="shield" size={16} /> Set up Assistant</button>
          )}
        </div>
      )}
      <div className="copilot-report"><button type="button" onClick={() => window.zeroOne.openExternal("https://talktoai.org/report-ai/")}>Report AI output</button><span>Opens privacy-aware support guidance</span></div>
      <div className="assistant-mail-actions" aria-label="ZMail assistant actions"><button type="button" disabled={busy} onClick={() => runMailAction("inbox")}><Icon name="mail" size={14} /> Check visible inbox</button><button type="button" disabled={busy} onClick={() => runMailAction("compose")}><Icon name="send" size={14} /> Compose email</button></div>
      <div className="chat-compose"><textarea disabled={!ready} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={keyDown} placeholder={ready ? `Ask ${providerLabel}…` : "Install the local model above — no keys needed"} rows={2} /><button onClick={send} disabled={busy || !input.trim() || !ready} aria-label="Send"><Icon name="send" size={18} /></button><small>{ready ? "Enter to send · Shift+Enter newline · Ctrl+L clear · Ctrl+J toggle" : "OpenZero Local is the zero-config private default"}</small></div>
    </aside>
  );
}

function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: View) => void }) {
  const [query, setQuery] = useState("");
  const paletteRef = useRef<HTMLDivElement>(null);
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(paletteRef.current?.querySelectorAll<HTMLElement>('input,button,[href],[tabindex]:not([tabindex="-1"])') || []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const actions = useMemo(() => [
    { label: "Open command center", hint: "Dashboard", view: "home" as View },
    { label: "Open ZSEC Shield", hint: "Deterministic endpoint security", view: "shield" as View },    { label: "Inspect 16-agent lattice", hint: "Autonomy", view: "agents" as View },
    ...SERVICES.map((service) => ({ label: `Open ${service.name}`, hint: service.eyebrow, view: `service:${service.id}` as View })),
    { label: "Open secure settings", hint: "Configuration", view: "settings" as View },
  ].filter((action) => `${action.label} ${action.hint}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div ref={paletteRef} className="command-palette" role="dialog" aria-modal="true" aria-label="ZERO ONE command palette" onKeyDown={trapFocus} onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-input"><Icon name="search" /><input autoFocus aria-label="Search commands" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ZERO ONE…" /><kbd>ESC</kbd></div>
        <div className="palette-results">{actions.length ? actions.map((action) => <button key={action.label} onClick={() => { onNavigate(action.view); onClose(); }}><span>{action.label}<small>{action.hint}</small></span><strong>↗</strong></button>) : <p className="palette-empty" role="status">No matching commands</p>}</div>
      </div>
    </div>
  );}

function Welcome({ onFinish, onSetup }: { onFinish: () => void; onSetup: () => void }) {
  return <div className="welcome-backdrop"><section className="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <span className="welcome-mark">Ø</span><p>WELCOME TO ZERO ONE</p><h1 id="welcome-title">Your workspaces, in one calm desktop.</h1>
    <div className="welcome-points">
      <article><strong>1. Assistant needs no config</strong><span>Private chat uses OpenZero Local + Ollama on this PC. Download the model once if prompted — no cloud key.</span></article>
      <article><strong>2. Sign in with control</strong><span>ZMail passwords are saved only after you tick the opt-in box, then filled only when you request it. ZeroThink linking remains an explicit browser approval.</span></article>
      <article><strong>3. ZSEC Shield is local</strong><span>On-demand folder scanning stays on this computer. Server ZSEC handles Linux security updates separately.</span></article>
    </div>
    <div className="welcome-actions"><button className="secondary-action" onClick={onSetup}>Review setup</button><button className="primary-action" onClick={onFinish}>Start using ZERO ONE</button></div>
  </section></div>;
}

function isValidView(value: string | undefined): value is View {
  if (!value) return false;
  if (value === "home" || value === "shield" || value === "agents" || value === "settings") return true;
  return /^service:(openzero|zerothink|zmail|callchat)$/.test(value);
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const [settings, setSettings] = useState<ZeroOneSettings | null>(null);
  const [probes, setProbes] = useState<ServiceProbe[]>([]);
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [zsec, setZsec] = useState<ZsecSnapshot | null>(null);
  const [zoom, setZoom] = useState(1);
  const [palette, setPalette] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(() => window.innerWidth > 1180);
  const [bootError, setBootError] = useState("");
  const [restoredLayout, setRestoredLayout] = useState(false);
  const [mountedServiceIds, setMountedServiceIds] = useState<ServiceId[]>([]);
  const [appUpdate, setAppUpdate] = useState<AppUpdateInfo | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState("");
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const bridgeUnavailable = "ZERO ONE could not start its secure desktop bridge. Restart the app; if this continues, install the latest update.";

  useEffect(() => {
    if (!window.zeroOne?.getUserInterfaceScale) { setBootError(bridgeUnavailable); return; }
    window.zeroOne.getUserInterfaceScale().then(setZoom).catch(() => setZoom(1));
    window.zeroOne.getAppInfo?.().then((info) => setAppVersion(info.version)).catch(() => setAppVersion(""));
  }, []);

  useEffect(() => {
    if (!window.zeroOne?.checkForAppUpdate) return;
    let active = true;
    const check = () => {
      window.zeroOne.checkForAppUpdate().then((result) => {
        if (active) setAppUpdate(result);
      }).catch(() => {});
    };
    const startup = window.setTimeout(check, 1_500);
    const background = window.setInterval(check, 6 * 60 * 60 * 1000);
    return () => { active = false; window.clearTimeout(startup); window.clearInterval(background); };
  }, []);

  const updateZoom = useCallback(async (factor: number) => {
    const applied = await window.zeroOne.setUserInterfaceScale(nearestZoom(factor));
    setZoom(applied);
  }, []);
  const stepZoom = useCallback(async (direction: 1 | -1) => {
    const index = ZOOM_STEPS.indexOf(nearestZoom(zoom) as typeof ZOOM_STEPS[number]);
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (index < 0 ? 2 : index) + direction))];
    await updateZoom(next);
  }, [updateZoom, zoom]);
  const closePalette = useCallback(() => {
    setPalette(false);
    window.requestAnimationFrame(() => searchButtonRef.current?.focus());
  }, []);

  const navigate = useCallback((next: View, options?: { collapseCopilot?: boolean }) => {
    setMountedServiceIds((current) => retainMountedServiceTab(current, serviceIdFromView(next)) as ServiceId[]);
    setView(next);
    if (options?.collapseCopilot || next.startsWith("service:")) setCopilotOpen(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!window.zeroOne?.probeServices || !window.zeroOne?.getSystemSnapshot || !window.zeroOne?.getZsecStatus) {
      setBootError(bridgeUnavailable);
      return;
    }
    const [serviceState, machine, zsecState] = await Promise.allSettled([window.zeroOne.probeServices(), window.zeroOne.getSystemSnapshot(), window.zeroOne.getZsecStatus()]);
    if (serviceState.status === "fulfilled") setProbes(serviceState.value);
    if (machine.status === "fulfilled") setSystem(machine.value);
    if (zsecState.status === "fulfilled") setZsec(zsecState.value);
  }, []);

  useEffect(() => {
    if (!window.zeroOne?.loadSettings) { setBootError(bridgeUnavailable); return; }
    window.zeroOne.loadSettings().then((value) => {
      setSettings(value);
      setBootError("");
      if (!restoredLayout) {
        const restoredView = value.lastView;
        if (isValidView(restoredView)) {
          setView(restoredView);
          setMountedServiceIds((current) => retainMountedServiceTab(current, serviceIdFromView(restoredView)) as ServiceId[]);
        }
        if (typeof value.lastCopilotOpen === "boolean") setCopilotOpen(value.lastCopilotOpen && window.innerWidth > 900);
        setRestoredLayout(true);
      }
    }).catch(() => setBootError("ZERO ONE could not load its local settings."));
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh, restoredLayout]);

  // Persist last workspace / assistant drawer without blocking UI.
  useEffect(() => {
    if (!settings || !restoredLayout) return;
    const handle = window.setTimeout(() => {
      window.zeroOne.saveSettings({ ...settings, lastView: view, lastCopilotOpen: copilotOpen }).then(setSettings).catch(() => {});
    }, 400);
    return () => window.clearTimeout(handle);
  }, [view, copilotOpen, restoredLayout]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally omit settings body to avoid loop

  useEffect(() => {
    if (!window.zeroOne?.onAppNavigate) return;
    return window.zeroOne.onAppNavigate((destination) => { navigate(destination as View, { collapseCopilot: true }); });
  }, [navigate]);

  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (mod && key === "k") { event.preventDefault(); setPalette(true); }
      if (mod && key === "j") { event.preventDefault(); setCopilotOpen((value) => !value); }
      if (mod && key === "l" && !event.shiftKey) {
        // Let the Assistant compose field handle clear when focused; otherwise open palette search focus.
        const tag = (event.target as HTMLElement | null)?.tagName;
        if (tag !== "TEXTAREA" && tag !== "INPUT") {
          event.preventDefault();
          document.querySelector<HTMLButtonElement>(".chat-clear")?.click();
        }
      }
      if (mod && (key === "=" || key === "+")) { event.preventDefault(); void stepZoom(1); }
      if (mod && key === "-") { event.preventDefault(); void stepZoom(-1); }
      if (mod && key === "0") { event.preventDefault(); void updateZoom(1); }
      if (event.key === "Escape" && palette) closePalette();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [closePalette, palette, stepZoom, updateZoom]);

  if (!settings) return <div className="boot-screen"><div className="boot-mark">Ø</div><p>{bootError || "INITIALIZING ZERO ONE"}</p>{bootError ? <button className="primary-action" onClick={() => window.location.reload()}>Try again</button> : <span />}</div>;

  const completeOnboarding = async (destination?: View) => {
    const saved = await window.zeroOne.saveSettings({ ...settings, onboardingCompleted: true, lastView: destination || view, lastCopilotOpen: copilotOpen });
    setSettings(saved);
    if (destination) setView(destination);
  };

  const activeServiceId = serviceIdFromView(view);
  const activeService = activeServiceId ? serviceById(activeServiceId) : null;
  const renderedServiceIds = retainMountedServiceTab(mountedServiceIds, activeServiceId);
  return (
    <div className={`app-shell ${copilotOpen ? "" : "copilot-collapsed"}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Sidebar view={view} mountedServiceIds={renderedServiceIds} version={appVersion} onNavigate={(next) => navigate(next)} />
      <main className="main-stage">
        <Topbar view={view} probes={probes} system={system} zoom={zoom} copilotOpen={copilotOpen} onZoom={updateZoom} onToggleCopilot={() => setCopilotOpen((value) => !value)} onRefresh={refresh} onSearch={() => setPalette(true)} searchRef={searchButtonRef} />
        {appUpdate?.updateAvailable && appUpdate.status === "available" && appUpdate.latestVersion !== dismissedUpdateVersion && <UpdateBanner update={appUpdate} onDismiss={() => setDismissedUpdateVersion(appUpdate.latestVersion)} />}
        <div className="content-frame" id="main-content">
          {view === "home" && <Dashboard settings={settings} probes={probes} system={system} zsec={zsec} onOpen={(id) => navigate(`service:${id}`)} onOpenShield={() => navigate("shield")} />}
          {view === "shield" && <ZsecView snapshot={zsec} onRefresh={refresh} />}
          {view === "agents" && <AgentLattice settings={settings} openZeroProbe={probes.find((probe) => probe.name === "openzero")} onOpenZero={() => navigate("service:openzero")} />}
          {view === "settings" && <SettingsView settings={settings} appVersion={appVersion} openZeroProbe={probes.find((probe) => probe.name === "openzero")} onSaved={(saved) => { setSettings(saved); refresh(); }} />}
          {renderedServiceIds.map((serviceId) => {
            const service = serviceById(serviceId);
            return <ServiceWorkspace key={serviceId} service={service} settings={settings} probe={probes.find((probe) => probe.name === serviceId)} active={serviceId === activeService?.id} />;
          })}
        </div>
      </main>
      <Copilot settings={settings} onOpenSettings={() => navigate("settings")} />
      {palette && <CommandPalette onClose={closePalette} onNavigate={navigate} />}
      {!settings.onboardingCompleted && <Welcome onFinish={() => completeOnboarding()} onSetup={() => completeOnboarding("settings")} />}
    </div>
  );
}
