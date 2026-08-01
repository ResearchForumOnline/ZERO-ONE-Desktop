const { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_SETTINGS = Object.freeze({
  zmailUrl: "https://webmail.zmail.my/?_task=workspace",
  zeroThinkUrl: "https://zerothink.talktoai.org/studio",
  openZeroUrl: "http://127.0.0.1:1024/",
  openZeroPublicUrl: "https://openzero.talktoai.org/",
  callChatUrl: "https://callchat.org/app/",
  model: "openzerogemma:latest",
  mediaEnabled: false,
  launchAtLogin: false,
});

const ALLOWED_ORIGINS = new Set([
  "https://mail.zmail.my",
  "https://zmail.my",
  "https://www.zmail.talktoai.org",
  "https://zerothink.talktoai.org",
  "https://openzero.talktoai.org",
  "https://callchat.org",
  "https://www.callchat.org",
  "http://127.0.0.1:1024",
  "http://localhost:1024",
]);

let mainWindow;
let runtimeSettings = { ...DEFAULT_SETTINGS };
const configuredPermissionSessions = new WeakSet();

function settingsPath() {
  return path.join(app.getPath("userData"), "zero-one-settings.json");
}

function isAllowedUrl(value) {
  try {
    const url = new URL(value);
    return ALLOWED_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}

function configurePermissionPolicy(targetSession) {
  if (!targetSession || configuredPermissionSessions.has(targetSession)) return;
  configuredPermissionSessions.add(targetSession);
  targetSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return permission === "media" && runtimeSettings.mediaEnabled && /^https:\/\/(www\.)?callchat\.org$/.test(requestingOrigin);
  });
  targetSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const allowed = permission === "media" && runtimeSettings.mediaEnabled && /^https:\/\/(www\.)?callchat\.org/.test(details.requestingUrl || "");
    callback(allowed);
  });
}

function cleanUrl(value, fallback) {
  const candidate = String(value || "").trim();
  return isAllowedUrl(candidate) ? candidate : fallback;
}

async function readSettingsFile() {
  try {
    return JSON.parse(await fs.readFile(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}

async function loadSettingsInternal() {
  const stored = await readSettingsFile();
  runtimeSettings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    zmailUrl: cleanUrl(stored.zmailUrl, DEFAULT_SETTINGS.zmailUrl),
    zeroThinkUrl: cleanUrl(stored.zeroThinkUrl, DEFAULT_SETTINGS.zeroThinkUrl),
    openZeroUrl: cleanUrl(stored.openZeroUrl, DEFAULT_SETTINGS.openZeroUrl),
    openZeroPublicUrl: cleanUrl(stored.openZeroPublicUrl, DEFAULT_SETTINGS.openZeroPublicUrl),
    callChatUrl: cleanUrl(stored.callChatUrl, DEFAULT_SETTINGS.callChatUrl),
    model: String(stored.model || DEFAULT_SETTINGS.model).slice(0, 160),
    mediaEnabled: Boolean(stored.mediaEnabled),
    launchAtLogin: Boolean(stored.launchAtLogin),
  };
  return runtimeSettings;
}

function decryptToken(settings) {
  if (!settings.openZeroTokenEncrypted || !safeStorage.isEncryptionAvailable()) return "";
  try {
    return safeStorage.decryptString(Buffer.from(settings.openZeroTokenEncrypted, "base64"));
  } catch {
    return "";
  }
}

function publicSettings(settings) {
  const { openZeroTokenEncrypted: _privateToken, ...visible } = settings;
  return { ...visible, hasOpenZeroToken: Boolean(decryptToken(settings)) };
}

async function saveSettingsInternal(input) {
  const current = await loadSettingsInternal();
  const next = {
    ...current,
    zmailUrl: cleanUrl(input.zmailUrl, current.zmailUrl),
    zeroThinkUrl: cleanUrl(input.zeroThinkUrl, current.zeroThinkUrl),
    openZeroUrl: cleanUrl(input.openZeroUrl, current.openZeroUrl),
    openZeroPublicUrl: cleanUrl(input.openZeroPublicUrl, current.openZeroPublicUrl),
    callChatUrl: cleanUrl(input.callChatUrl, current.callChatUrl),
    model: String(input.model || current.model).trim().slice(0, 160),
    mediaEnabled: Boolean(input.mediaEnabled),
    launchAtLogin: Boolean(input.launchAtLogin),
  };

  if (input.clearOpenZeroToken) {
    delete next.openZeroTokenEncrypted;
  } else if (typeof input.openZeroToken === "string" && input.openZeroToken.trim()) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Windows credential encryption is unavailable; the token was not saved.");
    }
    next.openZeroTokenEncrypted = safeStorage.encryptString(input.openZeroToken.trim()).toString("base64");
  }

  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
  runtimeSettings = next;
  app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, path: process.execPath });
  return publicSettings(next);
}

async function probe(name, url) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": `ZERO-ONE/${app.getVersion()}` },
    });
    return {
      name,
      state: response.status < 500 ? "online" : "degraded",
      status: response.status,
      latencyMs: Date.now() - started,
      url,
    };
  } catch (error) {
    return {
      name,
      state: "offline",
      status: 0,
      latencyMs: Date.now() - started,
      url,
      message: error?.name === "AbortError" ? "Timed out" : "Unavailable",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createWindow() {
  await loadSettingsInternal();
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: "#07090f",
    title: "ZERO ONE",
    icon: path.join(__dirname, "..", "assets", "zero-one-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      spellcheck: true,
    },
  });

  mainWindow.removeMenu();
  mainWindow.once("ready-to-show", () => mainWindow.show());

  const devUrl = process.env.ZERO_ONE_DEV_URL || "http://127.0.0.1:5173";
  if (!app.isPackaged) await mainWindow.loadURL(devUrl);
  else await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.on("web-contents-created", (_event, contents) => {
  configurePermissionPolicy(contents.session);
  contents.on("will-attach-webview", (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.allowRunningInsecureContent = false;
    if (!isAllowedUrl(params.src)) event.preventDefault();
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const localApp = url.startsWith("file:") || url.startsWith("http://127.0.0.1:5173");
    if (!localApp && !isAllowedUrl(url)) event.preventDefault();
  });
});

app.whenReady().then(async () => {
  configurePermissionPolicy(session.defaultSession);
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("app:info", () => ({
  name: "ZERO ONE",
  version: app.getVersion(),
  platform: process.platform,
  packaged: app.isPackaged,
}));

ipcMain.handle("system:snapshot", () => {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    cpu: os.cpus()?.[0]?.model || "Windows CPU",
    cores: os.cpus()?.length || 0,
    memoryTotal: total,
    memoryUsed: total - free,
    memoryPercent: Math.round(((total - free) / total) * 100),
    uptimeSeconds: os.uptime(),
  };
});

ipcMain.handle("settings:load", async () => publicSettings(await loadSettingsInternal()));
ipcMain.handle("settings:save", async (_event, input) => saveSettingsInternal(input || {}));

ipcMain.handle("services:probe", async () => {
  const settings = await loadSettingsInternal();
  return Promise.all([
    probe("zmail", settings.zmailUrl),
    probe("zerothink", settings.zeroThinkUrl),
    probe("openzero", settings.openZeroUrl),
    probe("callchat", settings.callChatUrl),
  ]);
});

ipcMain.handle("openzero:chat", async (_event, request) => {
  const settings = await loadSettingsInternal();
  const token = decryptToken(settings);
  if (!token) throw new Error("Add your OpenZero API token in Settings before using the copilot.");
  const endpoint = new URL("/v1/chat/completions", settings.openZeroUrl).toString();
  const messages = Array.isArray(request?.messages) ? request.messages.slice(-30) : [];
  if (!messages.length) throw new Error("A message is required.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: String(request?.model || settings.model),
        messages,
        temperature: 0.55,
        max_tokens: 1400,
        stream: false,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `OpenZero returned HTTP ${response.status}.`);
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenZero returned no assistant message.");
    return { content, model: payload.model || settings.model };
  } finally {
    clearTimeout(timeout);
  }
});

ipcMain.handle("shell:open-external", async (_event, url) => {
  if (!isAllowedUrl(url)) throw new Error("That destination is outside the ZERO ONE allowlist.");
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("diagnostics:export", async () => {
  const settings = publicSettings(await loadSettingsInternal());
  const services = await Promise.all([
    probe("zmail", settings.zmailUrl),
    probe("zerothink", settings.zeroThinkUrl),
    probe("openzero", settings.openZeroUrl),
    probe("callchat", settings.callChatUrl),
  ]);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export ZERO ONE diagnostics",
    defaultPath: `ZERO-ONE-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };
  const report = {
    generatedAt: new Date().toISOString(),
    app: { version: app.getVersion(), platform: process.platform },
    system: { hostname: os.hostname(), release: os.release(), cores: os.cpus().length, memoryTotal: os.totalmem() },
    services,
    settings,
    privacy: "No API tokens, cookies, message bodies, mailbox data, or call data are included.",
  };
  await fs.writeFile(result.filePath, JSON.stringify(report, null, 2), "utf8");
  return { saved: true, path: result.filePath };
});
