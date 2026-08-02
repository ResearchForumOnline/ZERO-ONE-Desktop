import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SERVICES, ServiceDefinition, ServiceId, serviceById, serviceUrl } from "./lib/services";

type View = "home" | "shield" | "agents" | "settings" | `service:${ServiceId}`;
type ChatMessage = { role: "user" | "assistant"; content: string };

const initialAssistant: ChatMessage[] = [
  {
    role: "assistant",
    content: "ZERO ONE is online. Connect your OpenZero API token in Settings and I can reason across your command center while inference stays on your node.",
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
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function StatusDot({ state }: { state?: ServiceProbe["state"] }) {
  return <span className={`status-dot ${state || "checking"}`} aria-label={state || "checking"} />;
}

function Sidebar({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  return (
    <aside className="sidebar">
      <button className="brand-mark" onClick={() => onNavigate("home")} aria-label="ZERO ONE home">
        <span className="brand-orbit" />
        <span>Ø</span>
      </button>
      <nav className="primary-nav" aria-label="Primary navigation">
        <NavButton active={view === "home"} label="Command" onClick={() => onNavigate("home")} icon="home" />
        <NavButton active={view === "shield"} label="ZSEC" onClick={() => onNavigate("shield")} icon="shield" />
        <NavButton active={view === "agents"} label="Agents" onClick={() => onNavigate("agents")} icon="agents" />
        <div className="nav-separator" />
        {SERVICES.map((service) => (
          <button
            key={service.id}
            className={`nav-service ${view === `service:${service.id}` ? "active" : ""}`}
            style={{ "--service-accent": service.accent } as React.CSSProperties}
            onClick={() => onNavigate(`service:${service.id}`)}
            title={service.name}
          >
            {service.glyph}
          </button>
        ))}
      </nav>
      <NavButton active={view === "settings"} label="Settings" onClick={() => onNavigate("settings")} icon="settings" compact />
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

function Topbar({ view, probes, system, onRefresh, onSearch, searchRef }: { view: View; probes: ServiceProbe[]; system: SystemSnapshot | null; onRefresh: () => void; onSearch: () => void; searchRef: React.RefObject<HTMLButtonElement | null> }) {
  const online = probes.filter((probe) => probe.state === "online").length;
  const title = view === "home" ? "Command center" : view === "shield" ? "ZSEC Shield" : view === "agents" ? "Agent lattice" : view === "settings" ? "System settings" : serviceById(view.split(":")[1] as ServiceId).name;
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
        <button className="icon-button" onClick={onRefresh} aria-label="Refresh status">
          <Icon name="refresh" />
        </button>
      </div>
    </header>
  );
}

function Dashboard({ settings, probes, system, zsec, onOpen, onOpenShield }: { settings: ZeroOneSettings; probes: ServiceProbe[]; system: SystemSnapshot | null; zsec: ZsecSnapshot | null; onOpen: (id: ServiceId) => void; onOpenShield: () => void }) {
  const openZero = probes.find((probe) => probe.name === "openzero");
  return (
    <div className="view-scroll dashboard">
      <section className="hero-panel">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="hero-kicker"><span /> SOVEREIGN DIGITAL OPERATING SYSTEM</div>
          <h2>Your intelligence.<br /><em>Your conversations.</em><br />One sovereign command.</h2>
          <p>Mail, research, local AI, agents, calls, and deterministic endpoint security—composed into one fast desktop experience.</p>
          <div className="hero-actions">
            <button className="primary-action" onClick={() => onOpen("openzero")}><span>Enter OpenZero</span><span>↗</span></button>
            <button className="secondary-action shield-action" onClick={onOpenShield}><Icon name="shield" size={17} /> Open ZSEC Shield</button>
          </div>
        </div>
        <div className="hero-core" aria-label="ZERO ONE neural core">
          <div className="core-ring ring-one" />
          <div className="core-ring ring-two" />
          <div className="core-ring ring-three" />
          <div className="core-center"><strong>16</strong><span>AGENTS</span></div>
          {[0, 1, 2, 3, 4, 5].map((index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}
        </div>
        <div className="hero-metrics">
          <Metric label="Local runtime" value={openZero?.state === "online" ? "ACTIVE" : "STANDBY"} tone={openZero?.state === "online" ? "green" : "amber"} />
          <Metric label="Memory" value={system ? `${system.memoryPercent}%` : "—"} />
          <Metric label="Privacy" value="USER-CONTROLLED" tone="cyan" />
          <Metric label="Endpoint" value={zsec?.state === "ready" ? "NO RULE MATCHES" : zsec?.state === "attention" ? "REVIEW" : zsec?.state === "idle" ? "INSTALLED" : "READY TO INSTALL"} tone={zsec?.state === "ready" ? "green" : "amber"} />
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
          <div className="card-title-row"><div><p>AUTONOMY</p><h3>Agent lattice</h3></div><span className="mode-badge">ULTRA / 16</span></div>
          <div className="mini-agent-grid">
            {Array.from({ length: 16 }, (_, index) => <span key={index} className={index < 4 ? "active" : ""}><i />{String(index + 1).padStart(2, "0")}</span>)}
          </div>
          <div className="lattice-footer"><span><i className="green" />4 ready</span><span><i />12 sleeping</span><button onClick={() => onOpen("openzero")}>Manage runtime →</button></div>
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
  const lastScan = snapshot?.lastScan ? new Date(snapshot.lastScan).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not yet recorded";

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
        <div className="zsec-radar" aria-hidden="true"><span /><i /><b>ZS</b></div>
        <div className="zsec-copy">
          <p className="section-kicker">NO AI · DETERMINISTIC CONTROLS · LOCAL EVIDENCE</p>
          <h2>Programmatic endpoint defence,<br /><em>without the black box.</em></h2>
          <p>ZSEC Shield performs explicit, on-demand checks on the folder you choose. Scanning stays on this machine and reports bounded rule matches without automatically deleting or quarantining anything.</p>
          <div className="zsec-state-row" aria-live="polite"><span className={`zsec-state ${state}`}>{state.replace("-", " ")}</span><span>{snapshot?.message || "Checking the local ZSEC Shield runtime."}</span></div>
        </div>
      </section>

      <section className="zsec-start glass-card" aria-labelledby="zsec-start-title">
        <div className="zsec-start-copy">
          <p className="section-kicker">SIMPLE, CONSENT-BASED SCANNING</p>
          <h3 id="zsec-start-title">One folder. One clear result.</h3>
          <ol className="zsec-steps">
            <li><span>1</span><div><strong>Choose</strong><small>Select one folder yourself.</small></div></li>
            <li><span>2</span><div><strong>Scan locally</strong><small>ZSEC hashes files and applies configured rules.</small></div></li>
            <li><span>3</span><div><strong>Review</strong><small>Nothing is removed automatically.</small></div></li>
          </ol>
        </div>
        <div className="zsec-controls">
          {snapshot?.installed ? (
            <>
              <button className="primary-action zsec-primary" onClick={startScan} disabled={scanning} aria-busy={scanning}>{scanning ? "Scanning…" : "Choose folder and scan"}</button>
              <button className="secondary-action" onClick={onRefresh} disabled={scanning}>Refresh status</button>
            </>
          ) : (
            <>
              <button className="primary-action zsec-primary" onClick={() => window.zeroOne.openExternal("https://talktoai.org/zsec/#shield")}>Get ZSEC Shield</button>
              <button className="secondary-action" onClick={() => window.zeroOne.openExternal("https://github.com/ResearchForumOnline/ZSEC-Shield")}>View source</button>
            </>
          )}
          <p>No background scan, deletion, upload, or quarantine is started by this button.</p>
        </div>
        {scanResult && (
          <div className={`zsec-result ${scanResult.outcome === "configured_rule_matches_detected" ? "attention" : scanResult.outcome === "incomplete" ? "incomplete" : "clear"}`} role="status" aria-live="polite">
            <strong>{scanResult.cancelled ? "Scan cancelled" : scanResult.outcome === "configured_rule_matches_detected" ? "Review recommended" : scanResult.outcome === "incomplete" ? "Scan incomplete" : "Scan complete"}</strong>
            <p>{scanResult.message}</p>
            {!scanResult.cancelled && typeof scanResult.filesHashed === "number" && <small>{scanResult.filesHashed.toLocaleString()} files · {formatBytes(scanResult.bytesHashed || 0)} read · {scanResult.errors || 0} errors</small>}
          </div>
        )}
      </section>

      <section className="zsec-stats" aria-label="ZSEC Shield status">
        <article><span>ENGINE</span><strong>{snapshot?.installed ? snapshot.version || "Installed" : "Not installed"}</strong><small>Bundled runtime first; fixed system locations second</small></article>
        <article><span>DEFINITIONS</span><strong>{snapshot?.definitions || "Awaiting install"}</strong><small>Built-in data-only rules; production update signing remains a release gate</small></article>
        <article><span>LAST SCAN</span><strong>{lastScan}</strong><small>Rendered from the versioned local CLI status contract</small></article>
        <article><span>RULE MATCHES</span><strong className={(snapshot?.findings || 0) > 0 ? "danger" : "safe"}>{snapshot?.lastScan ? snapshot.findings ?? 0 : "—"}</strong><small>{snapshot?.quarantine ?? 0} recoverable quarantine items</small></article>
      </section>
      <section className="zsec-platforms">
        {[
          ["WINDOWS 10 / 11", "On-demand selected-folder scanning and deterministic local evidence"],
          ["macOS", "On-demand selected-folder scanning; notarization is required for public release"],
          ["LINUX", "On-demand scanning plus package, service, and advisory inspection"],
        ].map(([name, detail], index) => <article key={name}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{name}</h3><p>{detail}</p></div><strong>PREVIEW</strong></article>)}
      </section>
      <section className="zsec-boundary glass-card">
        <Icon name="shield" size={25} /><div><strong>Truthful protection boundary</strong><p>ZSEC Desktop Preview is an on-demand security companion. It does not claim kernel-level real-time interception, independent antivirus certification, or complete malware prevention. Keep the operating system’s built-in protection enabled.</p></div>
      </section>
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

function ServiceWorkspace({ service, settings, probe }: { service: ServiceDefinition; settings: ZeroOneSettings; probe?: ServiceProbe }) {
  const url = serviceUrl(service, settings);
  return (
    <section className="workspace-view">
      <div className="workspace-toolbar" style={{ "--service-accent": service.accent } as React.CSSProperties}>
        <div className="workspace-identity"><span>{service.glyph}</span><div><p>{service.eyebrow}</p><h2>{service.name}</h2></div></div>
        <div className="workspace-address"><Icon name="shield" size={16} /><span>{url}</span></div>
        <div className="workspace-actions"><span className="workspace-health"><StatusDot state={probe?.state} />{probe?.state || "checking"}</span><button onClick={() => window.zeroOne.openExternal(url)}><Icon name="external" size={17} /> Browser</button></div>
      </div>
      {service.id === "callchat" && !settings.mediaEnabled && (
        <div className="permission-banner"><Icon name="call" size={18} /><span>Camera and microphone are locked. Enable CallChat media in Settings when you want to make a call.</span></div>
      )}
      {probe?.state === "offline" && service.id === "openzero" && (
        <div className="runtime-banner"><span className="warning-symbol">!</span><div><strong>Local OpenZero is not responding</strong><p>Start the OpenZero node on port 1024, or use its public project page from Settings.</p></div></div>
      )}
      <webview className="product-webview" src={url} partition={`persist:zero-one-${service.id}`} />
    </section>
  );
}

function AgentLattice({ settings, openZeroProbe, onOpenZero }: { settings: ZeroOneSettings; openZeroProbe?: ServiceProbe; onOpenZero: () => void }) {
  return (
    <div className="view-scroll agent-view">
      <section className="agent-hero glass-card">
        <div><p className="section-kicker">SOVEREIGN ORCHESTRATION</p><h2>Sixteen minds.<br /><em>One objective.</em></h2><p>ZERO ONE visualizes the OpenZero autonomy pool without pretending that idle workers are running. Launch and inspect real work inside OpenZero.</p></div>
        <div className="agent-runtime"><StatusDot state={openZeroProbe?.state} /><span>OPENZERO RUNTIME</span><strong>{openZeroProbe?.state || "CHECKING"}</strong><small>{settings.model}</small></div>
      </section>
      <section className="agent-deck">
        {Array.from({ length: 16 }, (_, index) => {
          const active = openZeroProbe?.state === "online" && index === 0;
          return (
            <article key={index} className={`agent-tile ${active ? "active" : ""}`}>
              <div className="agent-orb"><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
              <p>WORKER {String(index + 1).padStart(2, "0")}</p>
              <strong>{active ? "READY" : "SLEEPING"}</strong>
              <small>{active ? "Awaiting objective" : "Zero resources reserved"}</small>
            </article>
          );
        })}
      </section>
      <div className="agent-action-bar"><div><Icon name="shield" /><span>Execution remains bounded by OpenZero tool permissions and confirmations.</span></div><button className="primary-action" onClick={onOpenZero}>Open autonomous console ↗</button></div>
    </div>
  );
}

function SettingsView({ settings, onSaved }: { settings: ZeroOneSettings; onSaved: (settings: ZeroOneSettings) => void }) {
  const [draft, setDraft] = useState<ZeroOneSettings>(settings);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const saved = await window.zeroOne.saveSettings({ ...draft, openZeroToken: token || undefined });
      setToken("");
      onSaved(saved);
      setMessage("Settings saved. Secrets remain protected by secure storage for this operating-system account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {      setSaving(false);
    }
  };

  const field = (key: keyof ZeroOneSettings, label: string, help: string) => (
    <label className="setting-field"><span>{label}</span><input value={String(draft[key] || "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /><small>{help}</small></label>
  );

  return (
    <div className="view-scroll settings-view">
      <form onSubmit={save}>
        <section className="settings-section glass-card">
          <div className="settings-heading"><div><p>CONNECTIONS</p><h2>Owned services</h2></div><span>Only approved ZERO ONE origins are accepted</span></div>
          <div className="settings-grid">
            {field("openZeroUrl", "OpenZero local node", "Default: loopback port 1024. The API is never exposed by this app.")}
            {field("zeroThinkUrl", "ZeroThink Studio", "Your signed-in cognitive workspace.")}
            {field("zmailUrl", "ZMail Workspace", "Your secure webmail and zSign workspace.")}
            {field("callChatUrl", "CallChat", "Voice and video workspace.")}
          </div>
        </section>
        <section className="settings-section glass-card">
          <div className="settings-heading"><div><p>LOCAL AI</p><h2>OpenZero copilot</h2></div><span>{draft.hasOpenZeroToken ? "Token stored securely" : "Token required"}</span></div>
          <div className="settings-grid">
            {field("model", "Default model", "Use an installed OpenZero/Ollama model alias.")}
            <label className="setting-field"><span>OpenZero API token</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={draft.hasOpenZeroToken ? "•••••••••••••••• (leave blank to keep)" : "Paste oz_ token"} autoComplete="off" /><small>Encrypted with the operating system's secure credential storage. Insecure Linux fallback storage is rejected.</small></label>
          </div>
          {draft.hasOpenZeroToken && <label className="check-row danger"><input type="checkbox" checked={Boolean(draft.clearOpenZeroToken)} onChange={(event) => setDraft({ ...draft, clearOpenZeroToken: event.target.checked })} /><span>Remove the stored OpenZero token when I save</span></label>}
        </section>        <section className="settings-section glass-card">
          <div className="settings-heading"><div><p>DESKTOP</p><h2>App behavior</h2></div><span>Privacy-first defaults</span></div>
          <label className="check-row"><input type="checkbox" checked={draft.mediaEnabled} onChange={(event) => setDraft({ ...draft, mediaEnabled: event.target.checked })} /><span><strong>Enable camera and microphone for CallChat</strong><small>All other embedded services remain denied access.</small></span></label>
          <label className="check-row"><input type="checkbox" checked={draft.launchAtLogin} onChange={(event) => setDraft({ ...draft, launchAtLogin: event.target.checked })} /><span><strong>Launch ZERO ONE when I sign in</strong><small>Uses the current operating system account and can be changed at any time.</small></span></label>
        </section>
        <div className="settings-footer"><span role="status" aria-live="polite">{message}</span><button className="primary-action" disabled={saving}>{saving ? "Saving…" : "Save secure settings"}</button></div>
      </form>
    </div>
  );}

function Copilot({ settings, onOpenSettings }: { settings: ZeroOneSettings; onOpenSettings: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialAssistant);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stream = streamRef.current;
    if (stream) stream.scrollTop = stream.scrollHeight;
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text } as ChatMessage];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const response = await window.zeroOne.chat({ model: settings.model, messages: next.map(({ role, content }) => ({ role, content })) });
      setMessages((current) => [...current, { role: "assistant", content: response.content }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The local copilot is unavailable." }]);
    } finally {
      setBusy(false);
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
  };

  return (
    <aside className="copilot">
      <div className="copilot-header"><div className="copilot-symbol">Ø<span /></div><div><p>OPENZERO COPILOT</p><h3>Zero</h3></div><span className={`copilot-state ${settings.hasOpenZeroToken ? "ready" : "locked"}`}>{settings.hasOpenZeroToken ? "READY" : "LOCKED"}</span></div>
      <div className="copilot-context"><span>MODEL</span><strong>{settings.model}</strong></div>
      <div className="chat-stream" ref={streamRef}>
        {messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><span>{message.role === "assistant" ? "Ø" : "YOU"}</span><p>{message.content}</p></div>)}
        {busy && <div className="thinking"><i /><i /><i /></div>}
      </div>
      {!settings.hasOpenZeroToken && <button className="token-prompt" onClick={onOpenSettings}><Icon name="shield" size={16} /> Connect local token</button>}
      <div className="chat-compose"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={keyDown} placeholder="Ask your local intelligence…" rows={2} /><button onClick={send} disabled={busy || !input.trim()} aria-label="Send"><Icon name="send" size={18} /></button><small>Enter to send · Shift Enter for line break</small></div>
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

export default function App() {
  const [view, setView] = useState<View>("home");
  const [settings, setSettings] = useState<ZeroOneSettings | null>(null);
  const [probes, setProbes] = useState<ServiceProbe[]>([]);
  const [system, setSystem] = useState<SystemSnapshot | null>(null);
  const [zsec, setZsec] = useState<ZsecSnapshot | null>(null);
  const [palette, setPalette] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const closePalette = useCallback(() => {
    setPalette(false);
    window.requestAnimationFrame(() => searchButtonRef.current?.focus());
  }, []);

  const refresh = useCallback(async () => {
    const [serviceState, machine, zsecState] = await Promise.all([window.zeroOne.probeServices(), window.zeroOne.getSystemSnapshot(), window.zeroOne.getZsecStatus()]);
    setProbes(serviceState);
    setSystem(machine);
    setZsec(zsecState);
  }, []);

  useEffect(() => {
    window.zeroOne.loadSettings().then(setSettings);
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); }
      if (event.key === "Escape" && palette) closePalette();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [closePalette, palette]);

  if (!settings) return <div className="boot-screen"><div className="boot-mark">Ø</div><p>INITIALIZING ZERO ONE</p><span /></div>;

  const activeService = view.startsWith("service:") ? serviceById(view.split(":")[1] as ServiceId) : null;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Sidebar view={view} onNavigate={setView} />
      <main className="main-stage">
        <Topbar view={view} probes={probes} system={system} onRefresh={refresh} onSearch={() => setPalette(true)} searchRef={searchButtonRef} />
        <div className="content-frame" id="main-content">
          {view === "home" && <Dashboard settings={settings} probes={probes} system={system} zsec={zsec} onOpen={(id) => setView(`service:${id}`)} onOpenShield={() => setView("shield")} />}
          {view === "shield" && <ZsecView snapshot={zsec} onRefresh={refresh} />}
          {view === "agents" && <AgentLattice settings={settings} openZeroProbe={probes.find((probe) => probe.name === "openzero")} onOpenZero={() => setView("service:openzero")} />}
          {view === "settings" && <SettingsView settings={settings} onSaved={(saved) => { setSettings(saved); refresh(); }} />}
          {activeService && <ServiceWorkspace service={activeService} settings={settings} probe={probes.find((probe) => probe.name === activeService.id)} />}
        </div>
      </main>
      <Copilot settings={settings} onOpenSettings={() => setView("settings")} />
      {palette && <CommandPalette onClose={closePalette} onNavigate={setView} />}
    </div>
  );
}
