import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import packageMetadata from "../package.json";
import "./styles.css";

const previewVersion = `${packageMetadata.version.split(".").slice(0, 2).join(".")}-preview`;

if (!window.zeroOne && import.meta.env.DEV) {
  const previewSessions = new Map<string, ZeroThinkSession>();
  let previewLibrary: ZeroThinkDocument[] = [];
  let previewProfile: ZeroThinkProfile = { persona: "", facts: [] };
  const previewSettings: ZeroOneSettings = {
    openZeroUrl: "http://127.0.0.1:1024/",
    assistantProvider: "openzero",
    model: "hf.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF:Q4_K_M",
    openZeroServerModel: "hf.co/shafire/OpenZero-Ministral3-8B-Runtime-Agent-GGUF:Q5_K_M",
    openZeroAssistantMode: "local",
    localResourceProfile: "balanced",
    mediaEnabled: false,
    launchAtLogin: false,
    closeToTray: true,
    onboardingCompleted: false,
    hasOpenZeroToken: false,
    hasOpenAiKey: false,
    hasGroqKey: false,
  };
  window.zeroOne = {
    getManagedLocalStatus: async () => ({ phase: "idle", detail: "CPU inference and model downloads require the installed desktop app. This browser is a layout review." }),
    setupManagedLocal: async () => { throw new Error("Install ZERO ONE to set up the bundled CPU model."); },
    cancelManagedLocalSetup: async () => ({ cancelled: false }),
    stopManagedLocal: async () => ({ phase: "idle" }),
    onManagedLocalStatus: () => () => {},
    onAssistantProgress: () => () => {},
    cancelAssistantChat: async () => ({ cancelled: false }),
    listZeroThinkProjects: async () => [],
    getZeroThinkProject: async () => null,
    saveZeroThinkProject: async () => { throw new Error("Project autosave requires desktop encryption."); },
    deleteZeroThinkProject: async () => false,
    exportZeroThinkProject: async () => ({ saved: false }),
    importZeroThinkProject: async () => null,
    getZeroThinkVault: async () => ({ version: 1, secure: false, activeProfileId: null, profiles: [], providers: [], message: "Native encrypted vault requires the desktop app. This browser is a layout review." }),
    saveZeroThinkVaultProfile: async () => { throw new Error("API keys can only be saved in the native encrypted vault."); },
    deleteZeroThinkVaultProfile: async () => { throw new Error("Vault changes require the desktop app."); },
    selectZeroThinkVaultProfile: async () => { throw new Error("Provider selection requires the desktop app."); },
    quantumZeroThinkRequest: async () => { throw new Error("Quantum execution requires the desktop app. This browser review does not contact IonQ."); },
    quantumZeroThinkIBM: async () => { throw new Error("IBM Quantum inspection requires the desktop app and your credentials."); },
    listZeroThinkTemplates: async () => [],
    saveZeroThinkTemplate: async () => { throw new Error("Saved templates require desktop encryption."); },
    deleteZeroThinkTemplate: async () => false,
    renderZeroThinkTemplate: async () => { throw new Error("Research templates require the desktop app."); },
    listZeroThinkSessions: async () => Array.from(previewSessions.values()).map(({ id, title, pinned, updatedAt, messages }) => ({ id, title, pinned, updatedAt, messageCount: messages.length })),
    getZeroThinkSession: async (id) => previewSessions.get(id) || null,
    saveZeroThinkSession: async (input) => { const value = { ...input, updatedAt: new Date().toISOString() }; previewSessions.set(input.id, value); return value; },
    deleteZeroThinkSession: async (id) => previewSessions.delete(id),
    listZeroThinkLibrary: async () => previewLibrary,
    saveZeroThinkLibrary: async (documents) => { previewLibrary = documents; return documents; },
    getZeroThinkProfile: async () => previewProfile,
    saveZeroThinkProfile: async (value) => { previewProfile = value; return value; },
    copyZeroThinkText: async (value) => { await navigator.clipboard.writeText(value); return true; },
    importNotes: async () => { throw new Error("Note import requires the desktop app."); },
    exportNotes: async () => { throw new Error("Note export requires the desktop app."); },
    searchZeroThinkWeb: async () => { throw new Error("Web search requires the desktop app and your encrypted Serper key."); },
    selectZeroThinkProject: async () => { throw new Error("Project access requires the desktop app's native folder picker."); },
    runZeroThinkAgent: async () => { throw new Error("Desktop agent execution requires the desktop app."); },
    approveZeroThinkAgent: async () => ({ accepted: false }),
    onZeroThinkAgentProgress: () => () => undefined,
    getZeroThinkProcesses: async () => {
      const response = await fetch("/api/dev-zerothink/processes");
      if (!response.ok) throw new Error("Local research preview is unavailable.");
      return response.json();
    },
    importZeroThinkDocuments: () => new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".txt,.md,.csv,.json"; input.multiple = true;
      input.oncancel = () => resolve([]);
      input.onchange = async () => {
        try {
          const files = Array.from(input.files || []);
          if (files.length > 8 || files.some((file) => file.size > 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 2 * 1024 * 1024) throw new Error("Choose up to 8 UTF-8 sources, 1 MB each and 2 MB total.");
          const documents = await Promise.all(files.map(async (file) => ({ id: crypto.randomUUID(), title: file.name, text: new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()) })));
          resolve(documents);
        } catch (error) { reject(error); }
      };
      input.click();
    }),
    runZeroThink: async (input) => {
      const response = await fetch("/api/dev-zerothink/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Local research preview failed.");
      return result;
    },
    cancelZeroThink: async () => ({ cancelled: false }),
    onZeroThinkProgress: () => () => undefined,
    exportZeroThinkReport: async ({ format, result }) => {
      if (format === "pdf") throw new Error("PDF export requires the desktop app.");
      const blob = new Blob([format === "json" ? JSON.stringify(result, null, 2) : result.markdown], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `ZeroThink-report.${format === "json" ? "json" : "md"}`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { saved: true };
    },
    listNotes: async () => [],
    getNotesEncryptionStatus: async () => ({ version: 0, layers: 0, keys: 0, custody: "development", message: "Desktop encryption is unavailable in this browser review." }),
    saveNote: async () => { throw new Error("ZNotes requires the desktop app and secure OS storage."); },
    deleteNote: async () => false,
    getAppInfo: async () => ({ name: "ZERO ONE", version: previewVersion, platform: navigator.platform.toLowerCase().includes("mac") ? "darwin" : navigator.platform.toLowerCase().includes("linux") ? "linux" : "win32", packaged: false, distribution: "direct" }),
    checkForAppUpdate: async () => ({ status: "current", updateAvailable: false, currentVersion: packageMetadata.version, latestVersion: packageMetadata.version, releaseUrl: `https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v${packageMetadata.version}`, assetName: "", assetUrl: "", assetSize: 0, assetDigest: "", checksumUrl: "", installSupported: false, checkedAt: new Date().toISOString() }),
    installAppUpdate: async () => ({ status: "current", message: "Preview mode does not install updates." }),
    onAppUpdateProgress: () => () => undefined,
    getUserInterfaceScale: async () => 1,
    setUserInterfaceScale: async (factor) => factor,
    quitApp: async () => true,
    onAppNavigate: () => () => undefined,
    getSystemSnapshot: async () => ({ hostname: "ZERO-ONE-PREVIEW", platform: "Windows 11", cpu: "Preview CPU", cores: 16, memoryTotal: 32 * 1024 ** 3, memoryUsed: 11 * 1024 ** 3, memoryPercent: 34, uptimeSeconds: 420000 }),
    loadSettings: async () => ({ ...previewSettings }),
    saveSettings: async (settings) => ({ ...Object.assign(previewSettings, settings) }),
    clearLocalData: async () => ({ cleared: false }),
    probeServices: async () => [
      { name: "openzero", state: "online", status: 200, latencyMs: 14, url: previewSettings.openZeroUrl },
    ],
    connectOpenZeroDesktop: async () => ({ settings: { ...previewSettings, hasOpenZeroToken: true }, hint: "oz_preview", model: previewSettings.openZeroServerModel, models: [previewSettings.openZeroServerModel] }),
    startBrowserPilot: async () => ({ status: "finished", runId: "preview", step: 1, message: "Preview Browser Pilot completed without controlling the page.", pending: null }),
    approveBrowserPilot: async (runId) => ({ status: "finished", runId, step: 1, message: "Preview action approved.", pending: null }),
    denyBrowserPilot: async (runId) => ({ status: "stopped", runId, step: 1, message: "Preview action denied.", pending: null }),
    stopBrowserPilot: async (runId) => ({ status: "stopped", runId, step: 1, message: "Preview run stopped.", pending: null }),
    onBrowserPilotState: () => () => undefined,
    chat: async () => ({ content: "Preview mode keeps all actions local and disabled.", model: previewSettings.model }),
    openExternal: async () => true,
    exportDiagnostics: async () => ({ saved: false }),
    getZsecStatus: async () => ({ installed: true, state: "ready", version: "0.1.2-preview", platform: "Windows 11", definitions: "built-in:0.1.2;feed:absent", lastScan: new Date(Date.now() - 36 * 60 * 1000).toISOString(), outcome: "no_configured_rule_matches", errors: 0, filesHashed: 1842, bytesHashed: 248000000, findings: 0, quarantine: 0, message: "The last on-demand scan reported no configured-rule matches." }),
    scanWithZsec: async () => ({ cancelled: false, outcome: "no_configured_rule_matches", filesHashed: 1842, bytesHashed: 248000000, findings: 0, errors: 0, message: "Scan complete: 1,842 files checked and no configured-rule matches detected." }),
    getZmathSecurityStatus: async () => ({
      transport: { state: "protected", message: "Owned remote workspaces require HTTPS; loopback OpenZero traffic is restricted to this machine." },
      credentials: { state: "protected", message: "OpenZero tokens use operating-system secure storage." },
      disk: { state: "off", message: "Windows BitLocker protection is not currently on for the system drive." },
      engine: { state: "interface-only", message: "The public app exposes a versioned ZMath Secure interface; experimental proprietary cipher research is not embedded or claimed as active encryption." },
    }),
    openDiskEncryptionSettings: async () => false,
  };
}
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("ui-test") === "1") {
  const { installNotebookFixture } = await import("./ui-notebook-fixture");
  installNotebookFixture(window.zeroOne);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
