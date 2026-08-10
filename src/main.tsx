import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if (!window.zeroOne && import.meta.env.DEV) {
  const previewSettings: ZeroOneSettings = {
    zmailUrl: "https://webmail.zmail.my/?_task=workspace",
    zeroThinkUrl: "https://zerothink.talktoai.org/studio",
    openZeroUrl: "http://127.0.0.1:1024/",
    openZeroPublicUrl: "https://openzero.talktoai.org/",
    callChatUrl: "https://callchat.org/app/",
    assistantProvider: "openzero",
    model: "hf.co/shafire/OpenZero-Qwen3-1.7B-Agentic-GGUF:Q4_K_M",
    mediaEnabled: false,
    launchAtLogin: false,
    closeToTray: true,
    onboardingCompleted: false,
    hasOpenZeroToken: false,
    hasOpenAiKey: false,
    hasGroqKey: false,
    hasZeroThinkAccount: false,
  };
  window.zeroOne = {
    getAppInfo: async () => ({ name: "ZERO ONE", version: "7.8-preview", platform: navigator.platform.toLowerCase().includes("mac") ? "darwin" : navigator.platform.toLowerCase().includes("linux") ? "linux" : "win32", packaged: false }),
    checkForAppUpdate: async () => ({ status: "current", updateAvailable: false, currentVersion: "7.8.3", latestVersion: "7.8.3", releaseUrl: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v7.8.3", checkedAt: new Date().toISOString() }),
    getUserInterfaceScale: async () => 1,
    setUserInterfaceScale: async (factor) => factor,
    startZeroThinkSignIn: async () => ({ status: "success", email: "preview@example.com", userCode: "PREVIEW" }),
    restoreZeroThinkSession: async () => ({ status: "signed_out", email: "" }),
    signOutZeroThink: async () => true,
    quitApp: async () => true,
    onAppNavigate: () => () => undefined,
    getSystemSnapshot: async () => ({ hostname: "ZERO-ONE-PREVIEW", platform: "Windows 11", cpu: "Preview CPU", cores: 16, memoryTotal: 32 * 1024 ** 3, memoryUsed: 11 * 1024 ** 3, memoryPercent: 34, uptimeSeconds: 420000 }),
    loadSettings: async () => previewSettings,
    saveSettings: async (settings) => Object.assign(previewSettings, settings),
    clearLocalData: async () => ({ cleared: false }),
    probeServices: async () => [
      { name: "openzero", state: "online", status: 200, latencyMs: 14, url: previewSettings.openZeroUrl },
      { name: "zerothink", state: "online", status: 200, latencyMs: 32, url: previewSettings.zeroThinkUrl },
      { name: "zmail", state: "online", status: 200, latencyMs: 38, url: previewSettings.zmailUrl },
      { name: "callchat", state: "online", status: 200, latencyMs: 29, url: previewSettings.callChatUrl },
    ],
    connectOpenZeroDesktop: async () => ({ settings: { ...previewSettings, hasOpenZeroToken: true, model: "openzerogemma:latest" }, hint: "oz_preview", model: "openzerogemma:latest", models: ["openzerogemma:latest"] }),
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
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
