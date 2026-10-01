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
  listSavedWorkspaceLogins: () => ipcRenderer.invoke("workspace:list-logins"),
  getWorkspaceCredentialStatus: () => ipcRenderer.invoke("workspace:credential-status"),
  deleteSavedWorkspaceLogin: (origin) => ipcRenderer.invoke("workspace:delete-login", origin),
  clearSavedWorkspaceLogins: () => ipcRenderer.invoke("workspace:clear-logins"),
  quitApp: () => ipcRenderer.invoke("app:quit"),
  onAppNavigate: (callback) => {
    const listener = (_event, view) => callback(view);
    ipcRenderer.on("app:navigate", listener);
    return () => ipcRenderer.removeListener("app:navigate", listener);
  },
  getSystemSnapshot: () => ipcRenderer.invoke("system:snapshot"),
  listNotes: () => ipcRenderer.invoke("notes:list"),
  getNotesEncryptionStatus: () => ipcRenderer.invoke("notes:encryption-status"),
  saveNote: (note) => ipcRenderer.invoke("notes:save", note),
  deleteNote: (id) => ipcRenderer.invoke("notes:delete", id),
  importNotes: () => ipcRenderer.invoke("notes:import"),
  exportNotes: () => ipcRenderer.invoke("notes:export"),
  listZeroThinkSessions: () => ipcRenderer.invoke("zerothink:sessions-list"),
  getZeroThinkSession: (id) => ipcRenderer.invoke("zerothink:session-get", id),
  saveZeroThinkSession: (input) => ipcRenderer.invoke("zerothink:session-save", input),
  deleteZeroThinkSession: (id) => ipcRenderer.invoke("zerothink:session-delete", id),
  listZeroThinkLibrary: () => ipcRenderer.invoke("zerothink:library-list"),
  saveZeroThinkLibrary: (documents) => ipcRenderer.invoke("zerothink:library-save", documents),
  getZeroThinkProfile: () => ipcRenderer.invoke("zerothink:profile-get"),
  getZeroThinkVault: () => ipcRenderer.invoke("zerothink:vault-get"),
  saveZeroThinkVaultProfile: (input) => ipcRenderer.invoke("zerothink:vault-save", input),
  deleteZeroThinkVaultProfile: (id) => ipcRenderer.invoke("zerothink:vault-delete", id),
  selectZeroThinkVaultProfile: (id) => ipcRenderer.invoke("zerothink:vault-select", id),
  quantumZeroThinkRequest: (input) => ipcRenderer.invoke("zerothink:quantum", input),
  quantumZeroThinkIBM: (input) => ipcRenderer.invoke("zerothink:quantum-ibm", input),
  listZeroThinkTemplates: () => ipcRenderer.invoke("zerothink:templates-list"),
  saveZeroThinkTemplate: (input) => ipcRenderer.invoke("zerothink:template-save", input),
  deleteZeroThinkTemplate: (id) => ipcRenderer.invoke("zerothink:template-delete", id),
  renderZeroThinkTemplate: (input) => ipcRenderer.invoke("zerothink:template-render", input),
  saveZeroThinkProfile: (profile) => ipcRenderer.invoke("zerothink:profile-save", profile),
  copyZeroThinkText: (text) => ipcRenderer.invoke("zerothink:copy-text", text),
  searchZeroThinkWeb: (query) => ipcRenderer.invoke("zerothink:web-search", query),
  selectZeroThinkProject: () => ipcRenderer.invoke("zerothink:project-select"),
  runZeroThinkAgent: (input) => ipcRenderer.invoke("zerothink:agent-run", input),
  approveZeroThinkAgent: (runId, actionId, approved) => ipcRenderer.invoke("zerothink:agent-approve", { runId, actionId, approved }),
  onZeroThinkAgentProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("zerothink:agent-progress", listener);
    return () => ipcRenderer.removeListener("zerothink:agent-progress", listener);
  },
  getZeroThinkProcesses: () => ipcRenderer.invoke("zerothink:processes"),
  importZeroThinkDocuments: () => ipcRenderer.invoke("zerothink:import"),
  runZeroThink: (input) => ipcRenderer.invoke("zerothink:run", input),
  cancelZeroThink: (runId) => ipcRenderer.invoke("zerothink:cancel", { runId }),
  exportZeroThinkReport: (input) => ipcRenderer.invoke("zerothink:export", input),
  onZeroThinkProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("zerothink:progress", listener);
    return () => ipcRenderer.removeListener("zerothink:progress", listener);
  },
  getManagedLocalStatus: () => ipcRenderer.invoke("openzero:managed-status"),
  setupManagedLocal: (input) => ipcRenderer.invoke("openzero:managed-setup", input),
  cancelManagedLocalSetup: () => ipcRenderer.invoke("openzero:managed-cancel"),
  stopManagedLocal: () => ipcRenderer.invoke("openzero:managed-stop"),
  onAssistantProgress: (callback) => { const listener = (_event, value) => callback(value); ipcRenderer.on("openzero:chat-progress", listener); return () => ipcRenderer.removeListener("openzero:chat-progress", listener); },
  cancelAssistantChat: () => ipcRenderer.invoke("openzero:chat-cancel"),
  onManagedLocalStatus: (callback) => { const listener = (_event, value) => callback(value); ipcRenderer.on("openzero:managed-status-progress", listener); return () => ipcRenderer.removeListener("openzero:managed-status-progress", listener); },
  listZeroThinkProjects: () => ipcRenderer.invoke("zerothink:research-projects-list"),
  getZeroThinkProject: (id) => ipcRenderer.invoke("zerothink:research-project-get", id),
  saveZeroThinkProject: (input) => ipcRenderer.invoke("zerothink:research-project-save", input),
  deleteZeroThinkProject: (id) => ipcRenderer.invoke("zerothink:research-project-delete", id),
  exportZeroThinkProject: (id) => ipcRenderer.invoke("zerothink:research-project-export", id),
  importZeroThinkProject: () => ipcRenderer.invoke("zerothink:research-project-import"),
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
