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
    model: "openzerogemma:latest",
    mediaEnabled: false,
    launchAtLogin: false,
    hasOpenZeroToken: false,
  };
  window.zeroOne = {
    getAppInfo: async () => ({ name: "ZERO ONE", version: "0.2.0-preview", platform: "win32", packaged: false }),
    getSystemSnapshot: async () => ({ hostname: "ZERO-ONE-PREVIEW", platform: "Windows 11", cpu: "Preview CPU", cores: 16, memoryTotal: 32 * 1024 ** 3, memoryUsed: 11 * 1024 ** 3, memoryPercent: 34, uptimeSeconds: 420000 }),
    loadSettings: async () => previewSettings,
    saveSettings: async (settings) => Object.assign(previewSettings, settings),
    probeServices: async () => [
      { name: "openzero", state: "online", status: 200, latencyMs: 14, url: previewSettings.openZeroUrl },
      { name: "zerothink", state: "online", status: 200, latencyMs: 32, url: previewSettings.zeroThinkUrl },
      { name: "zmail", state: "online", status: 200, latencyMs: 38, url: previewSettings.zmailUrl },
      { name: "callchat", state: "online", status: 200, latencyMs: 29, url: previewSettings.callChatUrl },
    ],
    chat: async () => ({ content: "Preview mode keeps all actions local and disabled.", model: previewSettings.model }),
    openExternal: async () => true,
    exportDiagnostics: async () => ({ saved: false }),
    getZsecStatus: async () => ({ installed: true, state: "ready", version: "0.1.0-preview", platform: "Windows 11", definitions: "2026.08.01.1", lastScan: new Date(Date.now() - 36 * 60 * 1000).toISOString(), findings: 0, quarantine: 0, message: "No findings were reported by the last local scan." }),
  };
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
