const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, safeStorage, session, shell, Tray, webContents } = require("electron");
const { execFile } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { parseZsecScanReport, parseZsecStatusPayload } = require("./zsec-contract.cjs");
const { cleanConfiguredUrl, diagnosticOrigin, isAllowedUrl: urlIsAllowed } = require("./url-policy.cjs");
const { loginItemOptions, shouldCloseToTray, shouldStartHidden } = require("./tray-lifecycle.cjs");
const { latestPhpSessionCookie } = require("./zerothink-session.cjs");
const { DEFAULT_LOCAL_MODEL, LOCAL_ASSISTANT_SYSTEM_PROMPT, OLLAMA_LOCAL_ORIGIN, cleanAssistantContent, cleanChatMessages, cleanModelName, isInstalledLocalModel, localDirectReply, publicPullProgress } = require("./ollama-local.cjs");
const { checkLatestStableRelease } = require("./update-check.cjs");
const {
  saveLogin,
  loadLogin,
  deleteLogin,
  listLogins,
  clearAllLogins,
  buildLoginAssistScript,
  isSecureCredentialStorage,
} = require("./workspace-logins.cjs");

if (!app.requestSingleInstanceLock()) app.quit();

const DEFAULT_SETTINGS = Object.freeze({
  zmailUrl: "https://webmail.zmail.my/?_task=workspace",
  zeroThinkUrl: "https://zerothink.talktoai.org/studio",
  openZeroUrl: "http://127.0.0.1:1024/",
  openZeroPublicUrl: "https://openzero.talktoai.org/",
  callChatUrl: "https://callchat.org/app/",
  assistantProvider: "openzero",
  model: DEFAULT_LOCAL_MODEL,
  mediaEnabled: false,
  launchAtLogin: false,
  closeToTray: true,
  onboardingCompleted: false,
  trayNoticeShown: false,
  fastLocalModelMigrationCompleted: false,
  lastView: "home",
  lastCopilotOpen: true,
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
  "https://chromewebstore.google.com",
  "https://platform.openai.com",
  "https://console.groq.com",
  "https://callchat.org",
  "https://www.callchat.org",
  "http://127.0.0.1:1024",
  "http://localhost:1024",
]);
const PERSISTENT_PARTITIONS = Object.freeze(["openzero", "zerothink", "zmail", "callchat"].map((name) => `persist:zero-one-${name}`));

let mainWindow;
let tray;
let isQuitting = false;
let closeNoticeOpen = false;
let runtimeSettings = { ...DEFAULT_SETTINGS };
const configuredPermissionSessions = new WeakSet();
const ZOOM_LEVELS = Object.freeze([0.75, 0.85, 1, 1.1, 1.25, 1.4, 1.5]);
let currentZoomFactor = 1;
const localModelPullControllers = new Map();
const APP_UPDATE_CACHE_MS = 30 * 60 * 1000;
let appUpdateCache = null;

function nearestZoomFactor(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return currentZoomFactor;
  return ZOOM_LEVELS.reduce((closest, candidate) =>
    Math.abs(candidate - numeric) < Math.abs(closest - numeric) ? candidate : closest,
  ZOOM_LEVELS[0]);
}

function applyZoomFactor(value) {
  currentZoomFactor = nearestZoomFactor(value);
  for (const contents of webContents.getAllWebContents()) {
    if (!contents.isDestroyed()) contents.setZoomFactor(currentZoomFactor);
  }
  return currentZoomFactor;
}

function stepZoom(direction) {
  const index = ZOOM_LEVELS.indexOf(currentZoomFactor);
  return applyZoomFactor(ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + direction))]);
}

function settingsPath() {
  return path.join(app.getPath("userData"), "zero-one-settings.json");
}

function isAllowedUrl(value) {
  return urlIsAllowed(value, ALLOWED_ORIGINS);
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
  return isSecureCredentialStorage(safeStorage);
}

function workspaceCredentialStatus() {
  const backend = String(safeStorage.getSelectedStorageBackend?.() || "");
  return { available: credentialStorageIsSecure(), backend: backend === "basic_text" ? "insecure" : backend };
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
  return cleanConfiguredUrl(value, fallback, ALLOWED_ORIGINS);
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
    assistantProvider: ["openzero", "openai", "groq"].includes(stored.assistantProvider) ? stored.assistantProvider : DEFAULT_SETTINGS.assistantProvider,
    model: String(stored.model || DEFAULT_SETTINGS.model).slice(0, 160),
    mediaEnabled: Boolean(stored.mediaEnabled),
    launchAtLogin: Boolean(stored.launchAtLogin),
    closeToTray: stored.closeToTray !== false,
    onboardingCompleted: Boolean(stored.onboardingCompleted),
    trayNoticeShown: Boolean(stored.trayNoticeShown),
    fastLocalModelMigrationCompleted: Boolean(stored.fastLocalModelMigrationCompleted),
    lastView: sanitizeLastView(stored.lastView),
    lastCopilotOpen: stored.lastCopilotOpen !== false,
  };
  return runtimeSettings;
}

function sanitizeLastView(value) {
  const view = String(value || "home");
  if (view === "home" || view === "shield" || view === "agents" || view === "settings") return view;
  if (/^service:(openzero|zerothink|zmail|callchat)$/.test(view)) return view;
  return "home";
}

function decryptSecret(settings, key) {
  if (!settings[key] || !credentialStorageIsSecure()) return "";
  try {
    return safeStorage.decryptString(Buffer.from(settings[key], "base64"));
  } catch {
    return "";
  }
}

function decryptToken(settings) { return decryptSecret(settings, "openZeroTokenEncrypted"); }

function publicSettings(settings) {
  const { openZeroTokenEncrypted: _privateToken, openAiKeyEncrypted: _openAiKey, groqKeyEncrypted: _groqKey, zeroThinkTokenEncrypted: _zeroThinkToken, trayNoticeShown: _trayNoticeShown, ...visible } = settings;
  return { ...visible, hasOpenZeroToken: Boolean(decryptToken(settings)), hasOpenAiKey: Boolean(decryptSecret(settings, "openAiKeyEncrypted")), hasGroqKey: Boolean(decryptSecret(settings, "groqKeyEncrypted")), hasZeroThinkAccount: Boolean(decryptZeroThinkToken(settings)) };
}

function decryptZeroThinkToken(settings) {
  if (!settings.zeroThinkTokenEncrypted || !credentialStorageIsSecure()) return "";
  try { return safeStorage.decryptString(Buffer.from(settings.zeroThinkTokenEncrypted, "base64")); } catch { return ""; }
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
    assistantProvider: ["openzero", "openai", "groq"].includes(input.assistantProvider) ? input.assistantProvider : current.assistantProvider,
    model: String(input.model || current.model).trim().slice(0, 160),
    mediaEnabled: typeof input.mediaEnabled === "boolean" ? input.mediaEnabled : current.mediaEnabled,
    launchAtLogin: typeof input.launchAtLogin === "boolean" ? input.launchAtLogin : current.launchAtLogin,
    closeToTray: typeof input.closeToTray === "boolean" ? input.closeToTray : current.closeToTray,
    onboardingCompleted: typeof input.onboardingCompleted === "boolean" ? input.onboardingCompleted : current.onboardingCompleted,
    lastView: input.lastView !== undefined ? sanitizeLastView(input.lastView) : current.lastView,
    lastCopilotOpen: typeof input.lastCopilotOpen === "boolean" ? input.lastCopilotOpen : current.lastCopilotOpen,
  };

  if (input.clearOpenZeroToken) {
    delete next.openZeroTokenEncrypted;
  } else if (typeof input.openZeroToken === "string" && input.openZeroToken.trim()) {
    if (!credentialStorageIsSecure()) {
      throw new Error("Secure operating-system credential storage is unavailable; the token was not saved.");
    }
    next.openZeroTokenEncrypted = safeStorage.encryptString(input.openZeroToken.trim()).toString("base64");
  }
  for (const [inputKey, encryptedKey, clearKey] of [
    ["openAiKey", "openAiKeyEncrypted", "clearOpenAiKey"],
    ["groqKey", "groqKeyEncrypted", "clearGroqKey"],
  ]) {
    if (input[clearKey]) delete next[encryptedKey];
    else if (typeof input[inputKey] === "string" && input[inputKey].trim()) {
      if (!credentialStorageIsSecure()) throw new Error("Secure operating-system credential storage is unavailable; the API key was not saved.");
      next[encryptedKey] = safeStorage.encryptString(input[inputKey].trim()).toString("base64");
    }
  }

  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
  runtimeSettings = next;
  app.setLoginItemSettings(loginItemOptions({ enabled: next.launchAtLogin, executablePath: process.execPath, packaged: app.isPackaged }));
  return publicSettings(next);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendMainNavigation(view) {
  showMainWindow();
  mainWindow?.webContents.send("app:navigate", view);
}

function createTray() {
  if (tray) return tray;
  const iconPath = path.join(__dirname, "..", "assets", "zero-one-icon.png");
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
  tray = new Tray(trayIcon);
  tray.setToolTip("ZERO ONE — workspaces and local AI");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open ZERO ONE", click: showMainWindow },
    { label: "Open ZeroThink", click: () => sendMainNavigation("service:zerothink") },
    { label: "Settings", click: () => sendMainNavigation("settings") },
    { type: "separator" },
    { label: "Quit ZERO ONE", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
  return tray;
}

async function persistTrayNoticeShown() {
  if (runtimeSettings.trayNoticeShown) return;
  runtimeSettings = { ...runtimeSettings, trayNoticeShown: true };
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(runtimeSettings, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function handleFirstHideToTray() {
  if (closeNoticeOpen || !mainWindow || mainWindow.isDestroyed()) return;
  closeNoticeOpen = true;
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "ZERO ONE is still available",
    message: "ZERO ONE can keep running beside the clock.",
    detail: "Choose Keep running to hide it in the notification area. Open it again from the ZERO ONE tray icon. You can change this any time in Settings.",
    buttons: ["Keep running", "Quit ZERO ONE"],
    defaultId: 0,
    cancelId: 0,
    checkboxLabel: "Do not show this message again",
    checkboxChecked: true,
  });
  closeNoticeOpen = false;
  if (result.response === 1) {
    isQuitting = true;
    app.quit();
    return;
  }
  mainWindow?.hide();
  if (result.checkboxChecked) await persistTrayNoticeShown();
}

async function zeroThinkApi(action, payload = {}) {
  const response = await fetch("https://zerothink.talktoai.org/api/cli", {
    method: "POST", headers: { "Content-Type": "application/json", "User-Agent": `ZERO-ONE/${app.getVersion()}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) throw new Error(result.message || `ZeroThink returned HTTP ${response.status}.`);
  return result;
}

const ZERO_THINK_ORIGIN = "https://zerothink.talktoai.org";
const ZERO_THINK_PARTITION = "persist:zero-one-zerothink";

async function createZeroThinkDesktopSession(accessToken) {
  if (!accessToken) throw new Error("ZeroThink did not return an account token.");
  const targetSession = session.fromPartition(ZERO_THINK_PARTITION);
  const linked = await targetSession.fetch(`${ZERO_THINK_ORIGIN}/desktop_session.php`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": `ZERO-ONE/${app.getVersion()}`,
    },
    // Some shared-host configurations remove Authorization before PHP. Keep
    // the one-time account token in the encrypted HTTPS request body instead.
    body: JSON.stringify({ access_token: accessToken }),
  });
  const result = await linked.json().catch(() => ({}));
  if (!linked.ok) throw new Error(result.message || `The ZeroThink desktop session bridge returned HTTP ${linked.status}.`);

  // Main-process Chromium fetches do not reliably commit response cookies.
  // Copy only a strictly validated PHP session id into this isolated partition.
  const setCookieValues = typeof linked.headers.getSetCookie === "function"
    ? linked.headers.getSetCookie()
    : [linked.headers.get("set-cookie")].filter(Boolean);
  // PHP may send an initial id and then a regenerated authenticated id. The
  // last PHPSESSID is authoritative; copying the first preserves guest state.
  const sessionCookie = latestPhpSessionCookie(setCookieValues);
  if (!sessionCookie?.value || (sessionCookie.expirationDate !== undefined && sessionCookie.expirationDate <= Date.now() / 1000)) {
    throw new Error("ZeroThink approved the account but did not return a valid desktop session cookie.");
  }
  // Copy the server cookie without extending its lifetime. The persistent
  // partition retains persistent cookies; session cookies remain session-only.
  await targetSession.cookies.set({
    url: ZERO_THINK_ORIGIN,
    name: "PHPSESSID",
    value: sessionCookie.value,
    path: sessionCookie.path,
    secure: true,
    httpOnly: sessionCookie.httpOnly,
    sameSite: sessionCookie.sameSite,
    ...(sessionCookie.expirationDate === undefined ? {} : { expirationDate: sessionCookie.expirationDate }),
  });
  await targetSession.cookies.flushStore();

  const identityResponse = await targetSession.fetch(`${ZERO_THINK_ORIGIN}/api/cli`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": `ZERO-ONE/${app.getVersion()}` },
    body: JSON.stringify({ action: "me" }),
  });
  const identity = await identityResponse.json().catch(() => ({}));
  const email = String(identity.user?.email || "").trim().slice(0, 254);
  if (!identityResponse.ok || identity.status !== "success" || !email) {
    throw new Error("ZeroThink returned a session cookie, but the in-app account could not be verified.");
  }

  // Identity is proven above by the cookie-authenticated API. Also confirm the
  // embedded route remains reachable before switching the visible webview.
  const studio = await targetSession.fetch(`${ZERO_THINK_ORIGIN}/studio`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    redirect: "follow",
    headers: { "User-Agent": `ZERO-ONE/${app.getVersion()}` },
  });
  // Electron's Session.fetch can expose an empty Response.url even after a
  // successful fixed-origin request. The authenticated `me` check above is
  // authoritative; validate a final URL only when Electron supplies one.
  const finalResponseUrl = String(studio.url || "");
  const finalUrl = finalResponseUrl ? new URL(finalResponseUrl) : null;
  if (!studio.ok || (finalUrl && (finalUrl.origin !== ZERO_THINK_ORIGIN || !finalUrl.pathname.startsWith("/studio")))) {
    throw new Error("Google approved the device, but ZeroThink did not create an in-app session. Please retry linking.");
  }
  await targetSession.cookies.flushStore();
  return { status: "success", url: `${ZERO_THINK_ORIGIN}/studio`, email, plan: String(identity.user?.plan || "") };
}

async function zeroThinkIdentityFromCookies() {
  const targetSession = session.fromPartition(ZERO_THINK_PARTITION);
  const identityResponse = await targetSession.fetch(`${ZERO_THINK_ORIGIN}/api/cli`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": `ZERO-ONE/${app.getVersion()}` },
    body: JSON.stringify({ action: "me" }),
  });
  const identity = await identityResponse.json().catch(() => ({}));
  const email = String(identity.user?.email || "").trim().slice(0, 254);
  if (!identityResponse.ok || identity.status !== "success" || !email) return null;
  await targetSession.cookies.flushStore();
  return { status: "success", url: `${ZERO_THINK_ORIGIN}/studio`, email, plan: String(identity.user?.plan || "") };
}

async function restoreZeroThinkSession() {
  const current = await loadSettingsInternal();
  // 1) Reuse cookies already saved in the persistent partition (survives app close).
  try {
    const fromCookies = await zeroThinkIdentityFromCookies();
    if (fromCookies) return { ...fromCookies, email: fromCookies.email || String(current.zeroThinkEmail || "") };
  } catch {
    // Fall through to token restore.
  }
  // 2) Rebuild a desktop session from the encrypted device token (Google re-link only if this fails).
  const accessToken = decryptZeroThinkToken(current);
  if (!accessToken) return { status: "signed_out", email: "" };
  try {
    const linked = await createZeroThinkDesktopSession(accessToken);
    return { ...linked, email: linked.email || String(current.zeroThinkEmail || "") };
  } catch (error) {
    // 3) Last chance: cookies may still work even if token bridge failed.
    try {
      const fromCookies = await zeroThinkIdentityFromCookies();
      if (fromCookies) return { ...fromCookies, email: fromCookies.email || String(current.zeroThinkEmail || "") };
    } catch {
      // ignore
    }
    return { status: "needs_link", email: String(current.zeroThinkEmail || ""), message: error instanceof Error ? error.message : "ZeroThink needs to be linked again." };
  }
}

async function startZeroThinkPairing() {
  if (!credentialStorageIsSecure()) throw new Error("Secure operating-system credential storage is unavailable.");
  const started = await zeroThinkApi("device_start", { label: `${os.hostname()} ZERO ONE`, platform: `${os.type()} ${os.release()}`, hostname: os.hostname(), version: app.getVersion() });
  await shell.openExternal(started.verification_url);
  const interval = Math.max(2, Number(started.interval) || 3) * 1000;
  const deadline = Date.now() + Math.max(60, Number(started.expires_in) || 900) * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    const polled = await zeroThinkApi("device_poll", { device_code: started.device_code });
    if (polled.status === "authorization_pending") continue;
    if (polled.status !== "success" || !polled.access_token) throw new Error(polled.message || "ZeroThink account linking was not approved.");
    const linked = await createZeroThinkDesktopSession(polled.access_token);
    const current = await loadSettingsInternal();
    const next = { ...current, zeroThinkTokenEncrypted: safeStorage.encryptString(polled.access_token).toString("base64"), zeroThinkEmail: linked.email || String(polled.user?.email || "") };
    await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
    await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
    runtimeSettings = next;
    return { ...linked, email: next.zeroThinkEmail, userCode: started.user_code };
  }
  throw new Error("The ZeroThink sign-in request expired. Please try again.");
}

async function signOutZeroThink() {
  const current = await loadSettingsInternal();
  delete current.zeroThinkTokenEncrypted; delete current.zeroThinkEmail;
  await fs.writeFile(settingsPath(), JSON.stringify(current, null, 2), { encoding: "utf8", mode: 0o600 });
  runtimeSettings = current;
  const target = session.fromPartition("persist:zero-one-zerothink");
  await target.clearStorageData(); await target.clearCache(); await target.clearAuthCache();
  return true;
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
      url: diagnosticOrigin(url),
    };
  } catch (error) {
    return {
      name,
      state: "offline",
      status: 0,
      latencyMs: Date.now() - started,
      url: diagnosticOrigin(url),
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
    minWidth: 720,
    minHeight: 520,
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
  const revealAfterNormalLaunch = () => {
    if (!shouldStartHidden(process.argv) && mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  };
  mainWindow.once("ready-to-show", revealAfterNormalLaunch);
  // Some Windows/Electron combinations finish loading without emitting a
  // usable ready-to-show event. A completed renderer load is an equally safe
  // reveal point and prevents a normal launch from becoming tray-only.
  mainWindow.webContents.once("did-finish-load", revealAfterNormalLaunch);
  mainWindow.on("close", (event) => {
    if (!shouldCloseToTray({ isQuitting, closeToTray: runtimeSettings.closeToTray })) return;
    event.preventDefault();
    if (runtimeSettings.trayNoticeShown) mainWindow.hide();
    else void handleFirstHideToTray();
  });
  mainWindow.on("minimize", (event) => {
    if (!runtimeSettings.closeToTray) return;
    event.preventDefault();
    if (runtimeSettings.trayNoticeShown) mainWindow.hide();
    else void handleFirstHideToTray();
  });
  mainWindow.on("closed", () => { mainWindow = undefined; });

  const devUrl = process.env.ZERO_ONE_DEV_URL || "http://127.0.0.1:5173";
  if (!app.isPackaged) await mainWindow.loadURL(devUrl);
  else await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function isWorkspaceCredentialHost(urlValue) {
  try {
    const origin = new URL(urlValue).origin;
    return (
      origin === "https://webmail.zmail.my"
      || origin === "https://mail.zmail.my"
      || origin === "https://www.zmail.talktoai.org"
      || origin === "https://zmail.my"
      || origin === "https://zerothink.talktoai.org"
    );
  } catch {
    return false;
  }
}

async function injectWorkspaceLoginAssist(contents) {
  if (!contents || contents.isDestroyed()) return;
  const url = contents.getURL();
  if (!url || !isWorkspaceCredentialHost(url)) return;
  let origin = "";
  try { origin = new URL(url).origin; } catch { return; }
  let saved = null;
  try {
    saved = await loadLogin({
      userDataPath: app.getPath("userData"),
      safeStorage,
      allowedOrigins: ALLOWED_ORIGINS,
      origin,
    });
  } catch {
    saved = null;
  }
  try {
    await contents.executeJavaScript(buildLoginAssistScript(
      saved ? { username: saved.username, password: saved.password } : null,
      { canSave: credentialStorageIsSecure() },
    ), true);
  } catch {
    // Page may not allow script yet; retry on next load event.
  }
}

async function flushAllWorkspaceSessions() {
  for (const partition of PERSISTENT_PARTITIONS) {
    try {
      const targetSession = session.fromPartition(partition);
      await targetSession.cookies.flushStore();
    } catch {
      // best effort
    }
  }
}

async function capturePendingWorkspaceLogin(contents) {
  if (!credentialStorageIsSecure() || !contents || contents.isDestroyed()) return;
  let payload = null;
  try {
    payload = await contents.executeJavaScript(
      "(() => { const pending = window.__zeroOnePendingLogin || null; window.__zeroOnePendingLogin = null; return pending; })()",
      true,
    );
  } catch {
    return;
  }
  if (!payload || typeof payload !== "object") return;
  try {
    await saveLogin({
      userDataPath: app.getPath("userData"),
      safeStorage,
      allowedOrigins: ALLOWED_ORIGINS,
      origin: payload.origin,
      username: payload.username,
      password: payload.password,
    });
  } catch {
    // origin may be disallowed or fields incomplete
  }
}

app.on("web-contents-created", (_event, contents) => {
  configurePermissionPolicy(contents.session);
  contents.on("dom-ready", () => {
    contents.setZoomFactor(currentZoomFactor);
    void injectWorkspaceLoginAssist(contents);
  });
  contents.on("did-finish-load", () => {
    void injectWorkspaceLoginAssist(contents);
  });
  contents.on("console-message", (event, level, message) => {
    const text = String(message || event?.message || "");
    // Secure path: signal only, credentials pulled via executeJavaScript.
    if (text === "ZERO_ONE_SAVE_LOGIN_SIGNAL" || text.includes("ZERO_ONE_SAVE_LOGIN_SIGNAL")) {
      void capturePendingWorkspaceLogin(contents);
      return;
    }
  });
  contents.on("before-input-event", (event, input) => {
    if (!(input.control || input.meta) || input.alt) return;
    const key = String(input.key || "").toLowerCase();
    const code = String(input.code || "");
    if (key === "+" || key === "=" || code === "NumpadAdd") {
      event.preventDefault();
      stepZoom(1);
    } else if (key === "-" || code === "NumpadSubtract") {
      event.preventDefault();
      stepZoom(-1);
    } else if (key === "0" || code === "Numpad0") {
      event.preventDefault();
      applyZoomFactor(1);
    }
  });
  contents.on("will-attach-webview", (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.allowRunningInsecureContent = false;
    // Keep partition cookies/localStorage on disk across restarts.
    if (params && params.partition && !String(params.partition).startsWith("persist:")) {
      params.partition = `persist:${params.partition}`;
    }
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
  await loadSettingsInternal();
  // Upgrade the former loopback-server default to the verified on-device
  // model only when that model is already installed. Existing remote/server
  // configurations remain untouched and can still be selected in Advanced.
  const legacySlowLocalModels = new Set(["qwen3:1.7b", "openzerogemma:latest", "hf.co/shafire/Zero-Gemma4-E4B-OpenZero-GGUF:latest"]);
  if (runtimeSettings.assistantProvider === "openzero" && !runtimeSettings.fastLocalModelMigrationCompleted && legacySlowLocalModels.has(runtimeSettings.model)) {
    const local = await localOllamaStatus();
    if (local.reachable && local.models.some((model) => model.name.toLowerCase() === DEFAULT_LOCAL_MODEL.toLowerCase())) {
      runtimeSettings = { ...runtimeSettings, model: DEFAULT_LOCAL_MODEL, fastLocalModelMigrationCompleted: true };
      await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
      await fs.writeFile(settingsPath(), JSON.stringify(runtimeSettings, null, 2), { encoding: "utf8", mode: 0o600 });
    }
  }
  // Prefer private local Assistant by default so users need no API keys/tokens.
  // Loopback OpenZero panel tokens are still provisioned when available.
  if (runtimeSettings.assistantProvider === "openzero") {
    const local = await localOllamaStatus();
    const hasLocalDefault = local.reachable && local.models.some((model) => model.name.toLowerCase() === DEFAULT_LOCAL_MODEL.toLowerCase());
    if (hasLocalDefault && (runtimeSettings.model !== DEFAULT_LOCAL_MODEL || !runtimeSettings.fastLocalModelMigrationCompleted) && !decryptToken(runtimeSettings)) {
      runtimeSettings = { ...runtimeSettings, model: DEFAULT_LOCAL_MODEL, assistantProvider: "openzero", fastLocalModelMigrationCompleted: true };
      await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
      await fs.writeFile(settingsPath(), JSON.stringify(runtimeSettings, null, 2), { encoding: "utf8", mode: 0o600 });
    }
    if (!decryptToken(runtimeSettings)) {
      try {
        const endpoint = new URL(runtimeSettings.openZeroUrl);
        if (["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname)) await provisionOpenZeroDesktop(runtimeSettings);
      } catch {
        // Local Ollama chat still works without an OpenZero desktop token.
      }
    }
  }
  // Soft keep-alive for embedded ZMail so Roundcube idle timers do not log users out
  // while ZERO ONE is open (pairs with server session_lifetime=7 days).
  setInterval(() => { keepZmailSessionAlive().catch(() => {}); }, 8 * 60 * 1000);
  // Refresh ZMail cookies immediately on launch (before user opens the tab).
  setTimeout(() => { keepZmailSessionAlive().catch(() => {}); }, 2_000);
  setTimeout(() => { keepZmailSessionAlive().catch(() => {}); }, 15_000);
  // Warm ZeroThink cookie session if a device token already exists.
  setTimeout(() => { restoreZeroThinkSession().catch(() => {}); }, 3_000);
  app.setLoginItemSettings(loginItemOptions({ enabled: runtimeSettings.launchAtLogin, executablePath: process.execPath, packaged: app.isPackaged }));
  createTray();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (!runtimeSettings.closeToTray) app.quit();
});

let quitFlushDone = false;
app.on("before-quit", (event) => {
  isQuitting = true;
  if (quitFlushDone) return;
  // Ensure partition cookies are written before process exit.
  event.preventDefault();
  const finish = () => {
    quitFlushDone = true;
    app.exit(0);
  };
  Promise.race([
    flushAllWorkspaceSessions(),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]).finally(finish);
});

app.on("second-instance", () => showMainWindow());

app.on("activate", () => {
  if (mainWindow && !mainWindow.isDestroyed()) showMainWindow();
  else createWindow();
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

ipcMain.handle("app:check-update", async (event) => {
  requireTrustedIpcSender(event);
  const now = Date.now();
  if (appUpdateCache && now - appUpdateCache.cachedAt < APP_UPDATE_CACHE_MS) return appUpdateCache.result;
  const result = await checkLatestStableRelease({ currentVersion: app.getVersion(), timeoutMs: 5_000, now });
  appUpdateCache = { cachedAt: now, result };
  return result;
});

ipcMain.handle("ui:get-zoom", (event) => {
  requireTrustedIpcSender(event);
  return currentZoomFactor;
});

ipcMain.handle("ui:set-zoom", (event, factor) => {
  requireTrustedIpcSender(event);
  return applyZoomFactor(factor);
});

ipcMain.handle("zerothink:sign-in", async (event) => {
  requireTrustedIpcSender(event);
  return startZeroThinkPairing();
});
ipcMain.handle("zerothink:restore-session", async (event) => {
  requireTrustedIpcSender(event);
  return restoreZeroThinkSession();
});
ipcMain.handle("zerothink:sign-out", async (event) => { requireTrustedIpcSender(event); return signOutZeroThink(); });

ipcMain.handle("workspace:list-logins", async (event) => {
  requireTrustedIpcSender(event);
  return listLogins({ userDataPath: app.getPath("userData") });
});
ipcMain.handle("workspace:credential-status", (event) => {
  requireTrustedIpcSender(event);
  return workspaceCredentialStatus();
});
ipcMain.handle("workspace:delete-login", async (event, origin) => {
  requireTrustedIpcSender(event);
  return deleteLogin({ userDataPath: app.getPath("userData"), origin });
});
ipcMain.handle("workspace:clear-logins", async (event) => {
  requireTrustedIpcSender(event);
  return clearAllLogins({ userDataPath: app.getPath("userData") });
});
ipcMain.handle("workspace:keep-zmail-alive", async (event) => {
  requireTrustedIpcSender(event);
  return keepZmailSessionAlive();
});

ipcMain.handle("app:quit", (event) => {
  requireTrustedIpcSender(event);
  isQuitting = true;
  app.quit();
  return true;
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
        resolve(parseZsecStatusPayload(String(stdout || "{}"), process.platform));
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

function isExpectedZsecScanExit(error, outcome) {
  if (error?.killed || error?.signal) return false;
  if (outcome === "no_configured_rule_matches") return !error;
  if (outcome === "configured_rule_matches_detected") return error?.code === 1;
  if (outcome === "incomplete") return error?.code === 2;
  return false;
}

function runZsecScan(binary, selectedPath) {
  return new Promise((resolve) => {
    execFile(binary, ["check", selectedPath, "--json"], { timeout: 10 * 60 * 1000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
      try {
        const result = parseZsecScanReport(stdout);
        const { outcome } = result;
        if (!isExpectedZsecScanExit(error, outcome)) throw new Error("ZSEC scan exit code does not match its report");
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

function readBitLockerStatus() {
  if (process.platform !== "win32") {
    return Promise.resolve({ state: "unsupported", message: "Disk-encryption guidance is currently available for Windows 10 and 11 only." });
  }
  const script = [
    "$ErrorActionPreference='Stop'",
    "$v=Get-BitLockerVolume -MountPoint $env:SystemDrive",
    "[pscustomobject]@{ProtectionStatus=[string]$v.ProtectionStatus;VolumeStatus=[string]$v.VolumeStatus;EncryptionPercentage=[int]$v.EncryptionPercentage}|ConvertTo-Json -Compress",
  ].join(";");
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 8000, windowsHide: true, maxBuffer: 64 * 1024 }, (error, stdout) => {
      if (error) {
        resolve({ state: "unavailable", message: "Windows did not expose a readable BitLocker status. Open Device encryption to review it directly." });
        return;
      }
      try {
        const status = JSON.parse(String(stdout || "{}"));
        const enabled = status.ProtectionStatus === "On";
        resolve({
          state: enabled ? "protected" : "off",
          volumeStatus: String(status.VolumeStatus || "Unknown"),
          encryptionPercentage: Number.isFinite(status.EncryptionPercentage) ? status.EncryptionPercentage : undefined,
          message: enabled ? "Windows BitLocker protection is on for the system drive." : "Windows BitLocker protection is not currently on for the system drive.",
        });
      } catch {
        resolve({ state: "unavailable", message: "Windows returned an unreadable BitLocker status. No setting was changed." });
      }
    });
  });
}

ipcMain.handle("zmath:security-status", async (event) => {
  requireTrustedIpcSender(event);
  const disk = await readBitLockerStatus();
  return {
    transport: { state: "protected", message: "Owned remote workspaces require HTTPS; loopback OpenZero traffic is restricted to this machine." },
    credentials: {
      state: credentialStorageIsSecure() ? "protected" : "unavailable",
      message: credentialStorageIsSecure() ? "OpenZero tokens use operating-system secure storage." : "Secure credential storage is unavailable, so ZERO ONE refuses to save tokens.",
    },
    disk,
    engine: { state: "interface-only", message: "The public app exposes a versioned ZMath Secure interface; experimental proprietary cipher research is not embedded or claimed as active encryption." },
  };
});

ipcMain.handle("zmath:open-disk-encryption-settings", async (event) => {
  requireTrustedIpcSender(event);
  if (process.platform !== "win32") return false;
  await shell.openExternal("ms-settings:deviceencryption");
  return true;
});

ipcMain.handle("settings:load", async (event) => {
  requireTrustedIpcSender(event);
  return publicSettings(await loadSettingsInternal());
});
ipcMain.handle("settings:save", async (event, input) => {
  requireTrustedIpcSender(event);
  return saveSettingsInternal(input || {});
});

ipcMain.handle("settings:clear-local-data", async (event) => {
  requireTrustedIpcSender(event);
  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Clear ZERO ONE desktop data?",
    message: "Remove local settings and embedded workspace sessions?",
    detail: "This clears settings, encrypted tokens, saved ZMail/workspace logins, and cookies/storage for ZMail, ZeroThink, OpenZero, and CallChat. It does not delete server-side accounts or diagnostics files you saved.",
    buttons: ["Cancel", "Clear and restart"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (result.response !== 1) return { cleared: false };
  for (const partition of PERSISTENT_PARTITIONS) {
    const targetSession = session.fromPartition(partition);
    await targetSession.clearStorageData();
    await targetSession.clearCache();
    await targetSession.clearAuthCache();
  }
  await clearAllLogins({ userDataPath: app.getPath("userData") });
  await fs.rm(settingsPath(), { force: true });
  app.setLoginItemSettings(loginItemOptions({ enabled: false, executablePath: process.execPath, packaged: app.isPackaged }));
  runtimeSettings = { ...DEFAULT_SETTINGS };
  setTimeout(() => { app.relaunch(); app.exit(0); }, 250);
  return { cleared: true };
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

async function fetchLocalOllama(pathname, options = {}, timeoutMs = 8000) {
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(`${OLLAMA_LOCAL_ORIGIN}${pathname}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: { Accept: "application/json", "User-Agent": `ZERO-ONE/${app.getVersion()}`, ...(options.headers || {}) },
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function localOllamaStatus() {
  try {
    const [versionResponse, tagsResponse] = await Promise.all([
      fetchLocalOllama("/api/version"),
      fetchLocalOllama("/api/tags"),
    ]);
    if (!versionResponse.ok || !tagsResponse.ok) throw new Error("The local model service returned an error.");
    const [versionPayload, tagsPayload] = await Promise.all([versionResponse.json(), tagsResponse.json()]);
    const models = Array.isArray(tagsPayload.models) ? tagsPayload.models.slice(0, 250).map((model) => ({
      name: String(model?.name || model?.model || "").slice(0, 192),
      size: Math.max(0, Number(model?.size) || 0),
      modifiedAt: String(model?.modified_at || "").slice(0, 64),
    })).filter((model) => model.name) : [];
    return { reachable: true, origin: OLLAMA_LOCAL_ORIGIN, defaultModel: DEFAULT_LOCAL_MODEL, version: String(versionPayload.version || "unknown").slice(0, 64), models };
  } catch (error) {
    return { reachable: false, origin: OLLAMA_LOCAL_ORIGIN, defaultModel: DEFAULT_LOCAL_MODEL, version: "", models: [], message: error?.name === "AbortError" ? "The local model service did not respond in time." : "Ollama is not running on this computer." };
  }
}

async function chatViaLocalOllama(request, preferredModel) {
  const model = cleanModelName(preferredModel || DEFAULT_LOCAL_MODEL);
  const chatMessages = cleanChatMessages(request?.messages).filter((message) => message.role !== "system");
  const directReply = localDirectReply(chatMessages);
  if (directReply) return { content: directReply, model, provider: "zero-one-local" };
  const messages = [{ role: "system", content: LOCAL_ASSISTANT_SYSTEM_PROMPT }, ...chatMessages];
  const response = await fetchLocalOllama("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, think: false, keep_alive: "15m", options: { temperature: 0.2, repeat_penalty: 1.15, num_predict: 256, num_ctx: 2048 } }),
  }, 120000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || `The local model service returned HTTP ${response.status}.`).slice(0, 300));
  const content = cleanAssistantContent(payload?.message?.content);
  if (!content) throw new Error("The local model returned no assistant message.");
  return { content, model: String(payload.model || model).slice(0, 192), provider: "ollama-local" };
}

/** Ask ZMail to refresh through its own server-controlled session policy. */
async function keepZmailSessionAlive() {
  const targetSession = session.fromPartition("persist:zero-one-zmail");
  configurePermissionPolicy(targetSession);
  const base = cleanUrl(runtimeSettings.zmailUrl, DEFAULT_SETTINGS.zmailUrl);
  const origin = new URL(base).origin;
  // Prefer a lightweight refresh endpoint; fall back to workspace root.
  const candidates = [
    `${origin}/?_task=mail&_action=refresh`,
    `${origin}/?_task=workspace`,
    origin + "/",
  ];
  let ok = false;
  for (const url of candidates) {
    try {
      const response = await targetSession.fetch(url, {
        method: "GET",
        headers: { "User-Agent": `ZERO-ONE/${app.getVersion()}`, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
        redirect: "manual",
      });
      if (response.status > 0 && response.status < 500) {
        ok = true;
        break;
      }
    } catch {
      // try next candidate
    }
  }
  await targetSession.cookies.flushStore().catch(() => {});
  return ok;
}

ipcMain.handle("openzero:local-status", async (event) => {
  requireTrustedIpcSender(event);
  return localOllamaStatus();
});

ipcMain.handle("openzero:open-ollama-download", async (event) => {
  requireTrustedIpcSender(event);
  await shell.openExternal("https://ollama.com/download");
  return true;
});

ipcMain.handle("openzero:local-pull", async (event, input) => {
  requireTrustedIpcSender(event);
  const model = cleanModelName(input?.model || DEFAULT_LOCAL_MODEL);
  const jobId = randomUUID();
  if (localModelPullControllers.has(jobId)) throw new Error("That model download is already running.");
  if ([...localModelPullControllers.values()].some((entry) => entry.senderId === event.sender.id)) throw new Error("A local model download is already running.");
  const controller = new AbortController();
  const sender = event.sender;
  const cancelWhenRendererCloses = () => controller.abort();
  sender.once("destroyed", cancelWhenRendererCloses);
  localModelPullControllers.set(jobId, { controller, senderId: event.sender.id });
  const publish = (payload) => {
    if (!event.sender.isDestroyed()) event.sender.send("openzero:local-pull-progress", publicPullProgress(payload, jobId, model));
  };
  try {
    const response = await fetchLocalOllama("/api/pull", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
    });
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(String(payload?.error || `The local model service returned HTTP ${response.status}.`).slice(0, 300));
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let last = { status: "starting" };
    const consume = (line) => {
      if (!line.trim()) return;
      const payload = JSON.parse(line);
      if (payload.error) throw new Error(String(payload.error).slice(0, 300));
      last = payload;
      publish(payload);
    };
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      if (buffer.length > 256 * 1024) throw new Error("The local model service returned an oversized progress message.");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) consume(line);
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (last.status !== "success") throw new Error("The local model download ended before completion.");
    return { jobId, model, status: "success" };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("The local model download was cancelled.");
    throw error;
  } finally {
    sender.removeListener("destroyed", cancelWhenRendererCloses);
    localModelPullControllers.delete(jobId);
  }
});

ipcMain.handle("openzero:local-pull-cancel", async (event) => {
  requireTrustedIpcSender(event);
  let cancelled = 0;
  for (const entry of localModelPullControllers.values()) {
    if (entry.senderId !== event.sender.id) continue;
    entry.controller.abort();
    cancelled += 1;
  }
  return { cancelled };
});

ipcMain.handle("openzero:local-chat", async (event, request) => {
  requireTrustedIpcSender(event);
  try {
    return await chatViaLocalOllama(request, request?.model || DEFAULT_LOCAL_MODEL);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("The local assistant took too long. Check Ollama and the tested OpenZero Gemma E4B selection in Settings, then try again.");
    throw error;
  }
});

async function provisionOpenZeroDesktop(settings = null) {
  if (!credentialStorageIsSecure()) throw new Error("Secure operating-system credential storage is unavailable.");
  settings = settings || await loadSettingsInternal();
  const pairingEndpoint = new URL("/api/openzero/key", settings.openZeroUrl).toString();
  const paired = await fetch(pairingEndpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": `ZERO-ONE/${app.getVersion()}` },
    body: JSON.stringify({ action: "rotate" }),
  });
  const payload = await paired.json().catch(() => ({}));
  if (!paired.ok) throw new Error(payload?.error?.message || `OpenZero automatic connection returned HTTP ${paired.status}.`);
  const token = String(payload.api_key || "");
  if (!/^oz_[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error("OpenZero returned an invalid API credential.");

  const modelsEndpoint = new URL("/v1/models", settings.openZeroUrl).toString();
  const verified = await fetch(modelsEndpoint, { headers: { Authorization: `Bearer ${token}`, "User-Agent": `ZERO-ONE/${app.getVersion()}` } });
  if (!verified.ok) throw new Error("OpenZero created desktop access, but verification failed. Try again.");
  const modelPayload = await verified.json().catch(() => ({}));
  const models = Array.isArray(modelPayload?.data) ? modelPayload.data.map((entry) => String(entry?.id || "").trim()).filter(Boolean) : [];
  const browserModel = models.includes("openzerogemma:latest") ? "openzerogemma:latest" : String(modelPayload?.recommended_model || models[0] || settings.model);
  const next = { ...settings, assistantProvider: "openzero", model: browserModel, openZeroTokenEncrypted: safeStorage.encryptString(token).toString("base64") };
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
  runtimeSettings = next;
  return { settings: publicSettings(next), hint: String(payload.hint || ""), model: browserModel, models };
}

ipcMain.handle("openzero:connect-desktop", async (event) => {
  requireTrustedIpcSender(event);
  return provisionOpenZeroDesktop();
});

ipcMain.handle("openzero:chat", async (event, request) => {
  requireTrustedIpcSender(event);
  const settings = await loadSettingsInternal();
  const provider = settings.assistantProvider || "openzero";
  const providers = {
    openzero: { token: decryptToken(settings), endpoint: new URL("/v1/chat/completions", settings.openZeroUrl).toString(), label: "OpenZero" },
    openai: { token: decryptSecret(settings, "openAiKeyEncrypted"), endpoint: "https://api.openai.com/v1/chat/completions", label: "OpenAI" },
    groq: { token: decryptSecret(settings, "groqKeyEncrypted"), endpoint: "https://api.groq.com/openai/v1/chat/completions", label: "Groq" },
  };
  const selected = providers[provider] || providers.openzero;

  // An explicitly selected model that exists in local Ollama stays local even
  // when a separate OpenZero panel token is stored for browser workflows.
  const requestedLocalModel = request?.model || settings.model || DEFAULT_LOCAL_MODEL;
  const localStatus = provider === "openzero" ? await localOllamaStatus() : null;
  const useLocalOllama = provider === "openzero" && (!selected.token || (localStatus?.reachable && isInstalledLocalModel(requestedLocalModel, localStatus.models)));
  if (useLocalOllama) {
    try {
      return await chatViaLocalOllama(request, requestedLocalModel);
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("The local assistant took too long. Install or start Ollama, then try again.");
      throw new Error(error?.message || "Local Assistant is unavailable. Install Ollama and download OpenZero Gemma E4B once — no API key required.");
    }
  }

  if (!selected.token) throw new Error(`Finish ${selected.label} setup in Settings before using Assistant.`);
  const messages = Array.isArray(request?.messages) ? request.messages.slice(-30) : [];
  if (!messages.length) throw new Error("A message is required.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(selected.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${selected.token}`,
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
    if (!response.ok) throw new Error(payload?.error?.message || `${selected.label} returned HTTP ${response.status}.`);
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${selected.label} returned no assistant message.`);
    return { content, model: payload.model || settings.model, provider };
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
    system: { release: os.release(), logicalCores: os.cpus().length, memoryTotalBytes: os.totalmem() },
    services,
    settings: {
      serviceOrigins: {
        zmail: diagnosticOrigin(settings.zmailUrl),
        zeroThink: diagnosticOrigin(settings.zeroThinkUrl),
        openZero: diagnosticOrigin(settings.openZeroUrl),
        callChat: diagnosticOrigin(settings.callChatUrl),
      },
      mediaEnabled: settings.mediaEnabled,
      launchAtLogin: settings.launchAtLogin,
      hasOpenZeroToken: settings.hasOpenZeroToken,
    },
    privacy: "No hostname, API tokens, URL credentials/queries/fragments, cookies, message bodies, mailbox data, prompts, model responses, or call data are included. The user chooses where to save this local file and controls its retention.",
  };
  await fs.writeFile(result.filePath, JSON.stringify(report, null, 2), "utf8");
  return { saved: true, path: result.filePath };
});
