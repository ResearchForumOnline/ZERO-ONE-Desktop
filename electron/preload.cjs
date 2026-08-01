const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zeroOne", {
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  getSystemSnapshot: () => ipcRenderer.invoke("system:snapshot"),
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  probeServices: () => ipcRenderer.invoke("services:probe"),
  chat: (request) => ipcRenderer.invoke("openzero:chat", request),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  exportDiagnostics: () => ipcRenderer.invoke("diagnostics:export"),
});
