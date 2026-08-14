const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zeroOne", {
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  checkForAppUpdate: () => ipcRenderer.invoke("app:check-update"),
  installAppUpdate: () => ipcRenderer.invoke("app:install-update"),
  onAppUpdateProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("app:update-progress", listener);
    return () => ipcRenderer.removeListener("app:update-progress", listener);
  },
  getUserInterfaceScale: () => ipcRenderer.invoke("ui:get-zoom"),
  setUserInterfaceScale: (factor) => ipcRenderer.invoke("ui:set-zoom", factor),
  startZeroThinkSignIn: () => ipcRenderer.invoke("zerothink:sign-in"),
  restoreZeroThinkSession: () => ipcRenderer.invoke("zerothink:restore-session"),
  signOutZeroThink: () => ipcRenderer.invoke("zerothink:sign-out"),
  listSavedWorkspaceLogins: () => ipcRenderer.invoke("workspace:list-logins"),
  getWorkspaceCredentialStatus: () => ipcRenderer.invoke("workspace:credential-status"),
  deleteSavedWorkspaceLogin: (origin) => ipcRenderer.invoke("workspace:delete-login", origin),
  clearSavedWorkspaceLogins: () => ipcRenderer.invoke("workspace:clear-logins"),
  keepZmailSessionAlive: () => ipcRenderer.invoke("workspace:keep-zmail-alive"),
  quitApp: () => ipcRenderer.invoke("app:quit"),
  onAppNavigate: (callback) => {
    const listener = (_event, view) => callback(view);
    ipcRenderer.on("app:navigate", listener);
    return () => ipcRenderer.removeListener("app:navigate", listener);
  },
  getSystemSnapshot: () => ipcRenderer.invoke("system:snapshot"),
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  clearLocalData: () => ipcRenderer.invoke("settings:clear-local-data"),
  probeServices: () => ipcRenderer.invoke("services:probe"),
  connectOpenZeroDesktop: () => ipcRenderer.invoke("openzero:connect-desktop"),
  startBrowserPilot: (input) => ipcRenderer.invoke("browser-pilot:start", input),
  approveBrowserPilot: (runId) => ipcRenderer.invoke("browser-pilot:approve", { runId }),
  denyBrowserPilot: (runId) => ipcRenderer.invoke("browser-pilot:deny", { runId }),
  stopBrowserPilot: (runId) => ipcRenderer.invoke("browser-pilot:stop", { runId }),
  onBrowserPilotState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("browser-pilot:state", listener);
    return () => ipcRenderer.removeListener("browser-pilot:state", listener);
  },
  getLocalOpenZeroStatus: () => ipcRenderer.invoke("openzero:local-status"),
  openOllamaDownload: () => ipcRenderer.invoke("openzero:open-ollama-download"),
  pullLocalOpenZeroModel: async (model, onProgress) => {
    const listener = (_event, progress) => {
      if (typeof onProgress === "function") onProgress(progress);
    };
    ipcRenderer.on("openzero:local-pull-progress", listener);
    try { return await ipcRenderer.invoke("openzero:local-pull", { model }); }
    finally { ipcRenderer.removeListener("openzero:local-pull-progress", listener); }
  },
  cancelLocalOpenZeroModelPull: () => ipcRenderer.invoke("openzero:local-pull-cancel"),
  unloadLocalOpenZeroModels: (input) => ipcRenderer.invoke("openzero:local-unload", input),
  chatLocalOpenZero: (request) => ipcRenderer.invoke("openzero:local-chat", request),
  chat: (request) => ipcRenderer.invoke("openzero:chat", request),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  exportDiagnostics: () => ipcRenderer.invoke("diagnostics:export"),
  getZsecStatus: () => ipcRenderer.invoke("zsec:status"),
  scanWithZsec: () => ipcRenderer.invoke("zsec:scan-selected"),
  getZmathSecurityStatus: () => ipcRenderer.invoke("zmath:security-status"),
  openDiskEncryptionSettings: () => ipcRenderer.invoke("zmath:open-disk-encryption-settings"),
});
