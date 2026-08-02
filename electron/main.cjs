const { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { parseZsecScanReport } = require("./zsec-contract.cjs");

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
  "https://webmail.zmail.my",
  "https://zmail.my",
  "https://www.zmail.talktoai.org",
  "https://zerothink.talktoai.org",
  "https://openzero.talktoai.org",
  "https://talktoai.org",
  "https://github.com",
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

function isLocalAppUrl(value) {
  try {
    const url = new URL(value);
    if (!app.isPackaged) {
      const devOrigin = new URL(process.env.ZERO_ONE_DEV_URL || "http://127.0.0.1:5173").origin;
      return url.origin === devOrigin;
    }
    if (url.protocol !== "file:") return false;
    const rendererPath = path.resolve(path.join(__dirname, "..", "dist", "index.html"));
    return path.resolve(fileURLToPath(url)) === rendererPath;
  } catch {
    return false;
  }
}
function isCallChatOrigin(value) {
  try {
    const origin = new URL(value).origin;
    return origin === "https://callchat.org" || origin === "https://www.callchat.org";
  } catch {
    return false;
  }
}

function credentialStorageIsSecure() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const backend = safeStorage.getSelectedStorageBackend?.();
  return process.platform !== "linux" || backend !== "basic_text";
}

function isTrustedIpcSender(event) {
  return Boolean(mainWindow && event?.sender === mainWindow.webContents && event?.senderFrame === event.sender.mainFrame);
}

function requireTrustedIpcSender(event) {
  if (!isTrustedIpcSender(event)) throw new Error("Rejected IPC call from an untrusted renderer.");
}

function configurePermissionPolicy(targetSession) {
  if (!targetSession || configuredPermissionSessions.has(targetSession)) return;
  configuredPermissionSessions.add(targetSession);
  targetSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return permission === "media" && runtimeSettings.mediaEnabled && isCallChatOrigin(requestingOrigin);
  });
  targetSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const allowed = permission === "media" && runtimeSettings.mediaEnabled && isCallChatOrigin(details.requestingUrl || "");
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
  if (!settings.openZeroTokenEncrypted || !credentialStorageIsSecure()) return "";
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
    if (!credentialStorageIsSecure()) {
      throw new Error("Secure operating-system credential storage is unavailable; the token was not saved.");
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
      state: response.ok ? "online" : "degraded",
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
    minWidth: 1000,
    minHeight: 680,
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
    if (url.startsWith("https://") && isAllowedUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const localApp = isLocalAppUrl(url);
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

ipcMain.handle("app:info", (event) => {
  requireTrustedIpcSender(event);
  return ({
  name: "ZERO ONE",
  version: app.getVersion(),
  platform: process.platform,
  packaged: app.isPackaged,
  });
});

ipcMain.handle("system:snapshot", (event) => {
  requireTrustedIpcSender(event);
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

function zsecCandidates() {
  const bundledName = process.platform === "win32" ? "zsec-shield.exe" : "zsec-shield";
  const bundled = path.join(process.resourcesPath, "zsec-shield", bundledName);
  if (process.platform === "win32") {
    return [
      bundled,
      path.join(process.env.LOCALAPPDATA || "", "Programs", "ZSEC Shield", "zsec-shield.exe"),
      path.join(process.env.ProgramFiles || "C:\\Program Files", "ZSEC Shield", "zsec-shield.exe"),
    ];
  }
  if (process.platform === "darwin") {
    return [bundled, "/Applications/ZSEC Shield.app/Contents/MacOS/zsec-shield", "/usr/local/bin/zsec-shield"];
  }
  return [bundled, "/usr/local/bin/zsec-shield", "/usr/bin/zsec-shield"];
}

async function existingZsecBinary() {
  for (const candidate of zsecCandidates()) {
    if (!candidate) continue;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue through fixed, platform-owned install locations only.
    }
  }
  return null;
}

function runZsecStatus(binary) {
  return new Promise((resolve) => {
    execFile(binary, ["status", "--json"], { timeout: 6000, windowsHide: true, maxBuffer: 256 * 1024 }, (error, stdout) => {
      if (error) {
        resolve({ installed: true, state: "unavailable", platform: process.platform, message: "ZSEC Shield is installed but did not return a valid local status." });
        return;
      }
      try {
        const payload = JSON.parse(String(stdout || "{}"));
        if (payload.schema !== "zsec.shield.status.v1" || payload.contract_version !== 1) {
          throw new Error("Unsupported ZSEC status contract");
        }
        const findings = Number(payload.findings);
        const quarantine = Number(payload.quarantine_count);
        if (!Number.isSafeInteger(findings) || findings < 0 || !Number.isSafeInteger(quarantine) || quarantine < 0) {
          throw new Error("Invalid ZSEC status counters");
        }
        const lastScan = payload.last_scan == null ? undefined : String(payload.last_scan).slice(0, 80);
        if (lastScan && Number.isNaN(Date.parse(lastScan))) throw new Error("Invalid ZSEC scan timestamp");
        const state = !lastScan ? "idle" : findings > 0 ? "attention" : "ready";
        resolve({
          installed: true,
          state,
          version: String(payload.version || "unknown").slice(0, 40),
          platform: String(payload.platform || process.platform).slice(0, 80),
          definitions: String(payload.definitions || "not reported").slice(0, 80),
          lastScan,
          findings,
          quarantine,
          message: !lastScan
            ? "ZSEC Shield is installed. Run an on-demand scan to create local evidence."
            : findings > 0
              ? "Review the configured-rule matches from the last local scan."
              : "The last on-demand scan reported no configured-rule matches.",
        });
      } catch {
        resolve({ installed: true, state: "unavailable", platform: process.platform, message: "ZSEC Shield returned malformed status data." });
      }
    });
  });
}

ipcMain.handle("zsec:status", async (event) => {
  requireTrustedIpcSender(event);
  const binary = await existingZsecBinary();
  if (!binary) {
    return { installed: false, state: "not-installed", platform: process.platform, findings: 0, quarantine: 0, message: "Install ZSEC Shield to enable deterministic endpoint scanning." };
  }
  return runZsecStatus(binary);
});

function runZsecScan(binary, selectedPath) {
  return new Promise((resolve) => {
    execFile(binary, ["check", selectedPath, "--json"], { timeout: 10 * 60 * 1000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
      try {
        const result = parseZsecScanReport(stdout);
        const { outcome } = result;
        resolve({
          ...result,
          message: outcome === "configured_rule_matches_detected"
            ? `${result.findings} configured-rule match${result.findings === 1 ? "" : "es"} detected. Open the ZSEC evidence report before deciding what to do.`
            : outcome === "no_configured_rule_matches"
              ? `Scan complete: ${result.filesHashed} file${result.filesHashed === 1 ? "" : "s"} checked and no configured-rule matches detected.`
              : `Scan completed with ${result.errors} error${result.errors === 1 ? "" : "s"}. Review the local ZSEC report.`,
        });
      } catch {
        const timedOut = error?.killed || error?.signal;
        resolve({
          cancelled: false,
          outcome: "incomplete",
          filesHashed: 0,
          bytesHashed: 0,
          findings: 0,
          errors: 1,
          message: timedOut ? "The local scan reached the ten-minute safety limit." : "ZSEC Shield did not return a valid local scan report.",
        });
      }
    });
  });
}

ipcMain.handle("zsec:scan-selected", async (event) => {
  requireTrustedIpcSender(event);
  const binary = await existingZsecBinary();
  if (!binary) {
    return { cancelled: false, outcome: "incomplete", findings: 0, filesHashed: 0, bytesHashed: 0, errors: 1, message: "ZSEC Shield is not installed. Use Get ZSEC Shield to install the deterministic scanner first." };
  }
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "Choose one folder to scan locally",
    buttonLabel: "Scan this folder",
    properties: ["openDirectory", "dontAddToRecent"],
  });
  if (selection.canceled || selection.filePaths.length !== 1) {
    return { cancelled: true, message: "No folder was selected." };
  }
  return runZsecScan(binary, selection.filePaths[0]);
});

ipcMain.handle("settings:load", async (event) => {
  requireTrustedIpcSender(event);
  return publicSettings(await loadSettingsInternal());
});
ipcMain.handle("settings:save", async (event, input) => {
  requireTrustedIpcSender(event);
  return saveSettingsInternal(input || {});
});

ipcMain.handle("services:probe", async (event) => {
  requireTrustedIpcSender(event);
  const settings = await loadSettingsInternal();
  return Promise.all([
    probe("zmail", settings.zmailUrl),
    probe("zerothink", settings.zeroThinkUrl),
    probe("openzero", settings.openZeroUrl),
    probe("callchat", settings.callChatUrl),
  ]);
});

ipcMain.handle("openzero:chat", async (event, request) => {
  requireTrustedIpcSender(event);
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

ipcMain.handle("shell:open-external", async (event, url) => {
  requireTrustedIpcSender(event);
  if (!isAllowedUrl(url)) throw new Error("That destination is outside the ZERO ONE allowlist.");
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("diagnostics:export", async (event) => {
  requireTrustedIpcSender(event);
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
