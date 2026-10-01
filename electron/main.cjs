const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, net, safeStorage, session, shell, Tray, webContents } = require("electron");
const { execFile, spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { TextDecoder } = require("node:util");
const { fileURLToPath } = require("node:url");
const { parseZsecScanReport, parseZsecStatusPayload } = require("./zsec-contract.cjs");
const { cleanConfiguredUrl, diagnosticOrigin, isAllowedUrl: urlIsAllowed } = require("./url-policy.cjs");
const { loginItemOptions, shouldCloseToTray, shouldStartHidden } = require("./tray-lifecycle.cjs");
const { isWindowsStoreDistribution } = require("./store-distribution.cjs");
const { DEFAULT_LOCAL_MODEL, DEFAULT_OPENZERO_SERVER_MODEL, LOCAL_ASSISTANT_SYSTEM_PROMPT, OLLAMA_LOCAL_ORIGIN, cleanAssistantContent, cleanChatMessages, cleanModelName, inferOpenZeroRoutingSettings, isPublishedLocalModelName, localDirectReply, localResourceOptions, publicPullProgress } = require("./ollama-local.cjs");
const { checkLatestStableRelease, storeManagedUpdateResult } = require("./update-check.cjs");
const { downloadVerifiedAsset, fetchTextLimited, parseSha256Sums, safeUpdateFilename } = require("./update-installer.cjs");
const { classifyBrowserAction, normalizeHttpUrl, requestBrowserPlan, requestCompletionBrowserPlan } = require("./browser-pilot.cjs");
const { createManagedLocalRuntime, manifest: managedRuntimeManifest } = require("./managed-local-runtime.cjs");
const { createResearchProjectStore, MAX_IMPORT } = require("./zerothink-projects.cjs");
const { getProcesses: getZeroThinkProcesses } = require("./zerothink/engine.cjs");
const { runStudio } = require("./zerothink-studio.cjs");
const { createStudioStore } = require("./zerothink-studio-store.cjs");
const { searchWeb } = require("./zerothink-web.cjs");
const { runAgent } = require("./zerothink-agent.cjs");
const { createVaultStore } = require("./zerothink-vault.cjs");
const { buildVaultCompletion, endpointFor } = require("./zerothink-providers.cjs");
const { runQuantumRequest } = require("./zerothink-quantum.cjs");
const { runIBMQuantumRequest } = require("./zerothink-ibm.cjs");
const { createTemplateStore, renderTemplate } = require("./zerothink-templates.cjs");
const { extractPdf, reportHtml, MAX_PDF_BYTES } = require("./zerothink-pdf.cjs");
const { buildCompletionAdapter, normalizeResearchRequest, cleanImportedDocument, DOCUMENT_BYTES, CORPUS_BYTES } = require("./zerothink-desktop.cjs");
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
const IS_WINDOWS_STORE = isWindowsStoreDistribution({
  platform: process.platform,
  windowsStore: process.windowsStore,
  resourcesPath: process.resourcesPath,
  executablePath: process.execPath,
});

const DEFAULT_SETTINGS = Object.freeze({
  openZeroUrl: "http://127.0.0.1:1024/",
  assistantProvider: "openzero",
  model: DEFAULT_LOCAL_MODEL,
  openZeroServerModel: DEFAULT_OPENZERO_SERVER_MODEL,
  openZeroAssistantMode: "local",
  localResourceProfile: "balanced",
  localRuntimeMode: "managed",
  managedLocalConfigured: false,
  localModelTermsAcceptedRevision: "",
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
  "https://talktoai.org",
  "https://github.com",
  "https://huggingface.co",
  "https://ai.google.dev",
  "https://chromewebstore.google.com",
  "https://platform.openai.com",
  "https://console.groq.com",
  "http://127.0.0.1:1024",
  "http://localhost:1024",
]);
const PILOT_PARTITION = "persist:zero-one-browser-pilot";
const PERSISTENT_PARTITIONS = Object.freeze(["openzero", "browser-pilot"].map((name) => `persist:zero-one-${name}`));

let mainWindow;
let tray;
let isQuitting = false;
let closeNoticeOpen = false;
let runtimeSettings = { ...DEFAULT_SETTINGS };
const configuredPermissionSessions = new WeakSet();
const ZOOM_LEVELS = Object.freeze([0.75, 0.85, 1, 1.1, 1.25, 1.4, 1.5]);
let currentZoomFactor = 1;
const localModelPullControllers = new Map();
let localChatActive = false;
const APP_UPDATE_CACHE_MS = 30 * 60 * 1000;
let appUpdateCache = null;
let appUpdateActive = false;
const browserPilotResponses = new Map();
let browserPilotRun = null;
let zeroThinkRun = null;
let managedRuntime;
let assistantController;
let completionRouteRevision = 0;
function publicManagedStatus(value) {
  return { termsAccepted: runtimeSettings.localModelTermsAcceptedRevision === managedRuntimeManifest.model.revision, phase: value.phase, modelId: value.modelId, modelName: value.model, completed: value.downloadedBytes || 0, total: value.totalBytes || 0, detail: value.detail || "" };
}
function localRuntime() {
  return managedRuntime ||= createManagedLocalRuntime({ dataDir: path.join(app.getPath("userData"), "local-runtime"), runtimeDir: app.isPackaged ? path.join(process.resourcesPath, "local-runtime") : path.join(__dirname, "..", "vendor", "local-runtime"), onStatus: (value) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("openzero:managed-status-progress", publicManagedStatus(value)); } });
}
function managedCompletion(signal) {
  return { localStageTimeoutMs: 600000, maxInputCharacters: os.totalmem() >= 16 * 1024 ** 3 ? 24000 : 10000, async complete(request) {
    if (runtimeSettings.localModelTermsAcceptedRevision !== managedRuntimeManifest.model.revision) throw new Error("Open OpenZero and complete CPU setup, including model terms, before using local AI. You can also choose a server or API in the Vault.");
    const result = await localRuntime().complete({ ...request, signal: request.signal || signal });
    return { content: result.text, model: result.model, usage: result.usage ? { inputTokens: result.usage.prompt_tokens || 0, outputTokens: result.usage.completion_tokens || 0, totalTokens: result.usage.total_tokens || 0 } : undefined };
  } };
}

function isPilotSession(targetSession) {
  return Boolean(targetSession && targetSession === session.fromPartition(PILOT_PARTITION));
}

function isPilotPageUrl(value) {
  try { normalizeHttpUrl(value); return true; }
  catch { return false; }
}

function isLoopbackOpenZero(value) {
  try { return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname); }
  catch { return false; }
}

function pilotTargetById(targetId) {
  const target = webContents.fromId(Number(targetId));
  if (!target || target.isDestroyed() || target.getType() !== "webview" || !isPilotSession(target.session)) {
    throw new Error("Open the built-in Browser Pilot tab before starting controlled work.");
  }
  if (target.hostWebContents && target.hostWebContents !== mainWindow?.webContents) throw new Error("The Browser Pilot target is not owned by this window.");
  if (!isPilotPageUrl(target.getURL())) throw new Error("Browser Pilot works only on ordinary HTTP(S) pages.");
  return target;
}

function publicPilotRun(run) {
  if (!run) return { status: "idle", runId: "", step: 0, message: "Ready for a user-granted task.", pending: null };
  return {
    status: run.status,
    runId: run.runId,
    step: run.step,
    message: run.message,
    pending: run.pending ? { preview: run.pending.preview, reason: run.pending.reason } : null,
  };
}

function emitPilotState(run = browserPilotRun) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("browser-pilot:state", publicPilotRun(run));
}

function emitUpdateProgress(progress) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("app:update-progress", progress);
}

function pilotCommand(target, command, payload = {}, timeoutMs = 10_000) {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      browserPilotResponses.delete(requestId);
      reject(new Error("The controlled page did not respond in time."));
    }, Math.max(500, Math.min(Number(timeoutMs) || 10_000, 30_000)));
    timer.unref?.();
    browserPilotResponses.set(requestId, { senderId: target.id, resolve, reject, timer });
    target.send("zero-one-pilot:command", { requestId, command, ...payload });
  });
}

function finishPilotRun(run, status, message) {
  if (!run || browserPilotRun?.runId !== run.runId) return;
  run.controller.abort();
  run.status = status;
  run.message = String(message || "Browser Pilot stopped.").slice(0, 500);
  run.pending = null;
  try { const target = webContents.fromId(run.targetId); if (target && !target.isDestroyed()) void pilotCommand(target, "revoke", {}, 1500).catch(() => {}); } catch { /* best effort */ }
  emitPilotState(run);
}

async function continuePilotRun(run) {
  if (!run || browserPilotRun?.runId !== run.runId || run.status === "stopped" || run.status === "finished") return;
  run.status = "running";
  run.pending = null;
  emitPilotState(run);
  try {
    const adapters = await zeroThinkCompletionAdapters(run.controller.signal);
    while (browserPilotRun?.runId === run.runId && !run.controller.signal.aborted && run.step < 12) {
      const target = pilotTargetById(run.targetId);
      await pilotCommand(target, "grant", { grantId: run.grantId });
      await pilotCommand(target, "overlay", { status: "planning", message: `Planning safe step ${run.step + 1} of 12` });
      const snapshot = await pilotCommand(target, "inspect", { grantId: run.grantId });
      run.step += 1;
      run.message = `OpenZero is planning step ${run.step}.`;
      emitPilotState(run);
      const action = await requestCompletionBrowserPlan({ complete: adapters.complete, task: run.task, snapshot, step: run.step, history: run.history, signal: run.controller.signal });
      if (action.action === "finish") {
        finishPilotRun(run, "finished", action.message || "Task finished.");
        return;
      }
      const decision = classifyBrowserAction(action, snapshot);
      if (!decision.allowed) {
        run.history.push({ action: action.action, result: `Policy denied: ${decision.reason}` });
        run.history = run.history.slice(-8);
        run.message = `Policy denied ${action.action}; asking OpenZero for a safer step.`;
        emitPilotState(run);
        continue;
      }
      if (decision.needsApproval) {
        run.status = "paused";
        run.message = decision.reason || "Your approval is required.";
        run.pending = { action, snapshotId: snapshot.snapshot_id, preview: decision.preview, reason: decision.reason };
        await pilotCommand(target, "overlay", { status: "paused", message: `${decision.preview} · approval required in ZERO ONE` });
        emitPilotState(run);
        return;
      }
      const result = await pilotCommand(target, "execute", { grantId: run.grantId, snapshotId: snapshot.snapshot_id, action }, 15_000);
      run.history.push({ action: action.action, result: String(result || "Completed").slice(0, 500) });
      run.history = run.history.slice(-8);
      run.message = `${decision.preview} · checking the result.`;
      emitPilotState(run);
      await new Promise((resolve) => setTimeout(resolve, ["navigate", "click", "back", "forward"].includes(action.action) ? 1100 : 300));
    }
    if (run.step >= 12) finishPilotRun(run, "stopped", "The 12-step safety limit was reached. Review the page before starting another task.");
  } catch (error) {
    if (run.controller.signal.aborted) return;
    finishPilotRun(run, "error", error?.message || "Browser Pilot stopped safely.");
  }
}

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
  return urlIsAllowed(value, new Set([...ALLOWED_ORIGINS, new URL(runtimeSettings.openZeroUrl).origin]));
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
function credentialStorageIsSecure() {
  return isSecureCredentialStorage(safeStorage);
}

function workspaceCredentialStatus() {
  const backend = String(safeStorage.getSelectedStorageBackend?.() || "");
  return { available: credentialStorageIsSecure(), backend: backend === "basic_text" ? "insecure" : backend };
}

function isTrustedIpcSender(event) {
  return Boolean(mainWindow && event?.sender === mainWindow.webContents && event?.senderFrame === event.sender.mainFrame && isLocalAppUrl(event.senderFrame.url));
}

function requireTrustedIpcSender(event) {
  if (!isTrustedIpcSender(event)) throw new Error("Rejected IPC call from an untrusted renderer.");
}

function configurePermissionPolicy(targetSession) {
  if (!targetSession || configuredPermissionSessions.has(targetSession)) return;
  configuredPermissionSessions.add(targetSession);
  targetSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return false;
  });
  targetSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const allowed = false;
    callback(allowed);
  });
  if (isPilotSession(targetSession)) {
    targetSession.on("will-download", (event) => event.preventDefault());
  }
}

function cleanUrl(value, fallback) {
  try {
    const url = new URL(String(value || fallback));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return fallback;
    if (["zerothink.talktoai.org", "openzero.talktoai.org", "callchat.org", "www.callchat.org", "zmail.my", "mail.zmail.my", "webmail.zmail.my"].includes(url.hostname)) return fallback;
    return url.toString();
  } catch { return fallback; }
}

function safeModelName(value, fallback) {
  try { return cleanModelName(value || fallback); }
  catch { return fallback; }
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
  for (const key of ["zmailUrl", "zeroThinkUrl", "callChatUrl", "openZeroPublicUrl", "zeroThinkTokenEncrypted", "zeroThinkEmail"]) delete stored[key];
  const routing = inferOpenZeroRoutingSettings(stored);
  runtimeSettings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    openZeroUrl: cleanUrl(stored.openZeroUrl, DEFAULT_SETTINGS.openZeroUrl),
    assistantProvider: ["openzero", "openai", "groq"].includes(stored.assistantProvider) ? stored.assistantProvider : DEFAULT_SETTINGS.assistantProvider,
    model: safeModelName(stored.model, DEFAULT_SETTINGS.model),
    openZeroServerModel: safeModelName(stored.openZeroServerModel, safeModelName(routing.legacyServerModel, DEFAULT_SETTINGS.openZeroServerModel)),
    openZeroAssistantMode: routing.openZeroAssistantMode,
    localResourceProfile: ["low-memory", "balanced", "performance"].includes(stored.localResourceProfile) ? stored.localResourceProfile : DEFAULT_SETTINGS.localResourceProfile,
    localRuntimeMode: stored.localRuntimeMode === "ollama" ? "ollama" : "managed",
    managedLocalConfigured: stored.managedLocalConfigured === true,
    localModelTermsAcceptedRevision: stored.localModelTermsAcceptedRevision === managedRuntimeManifest.model.revision ? stored.localModelTermsAcceptedRevision : "",
    mediaEnabled: Boolean(stored.mediaEnabled),
    launchAtLogin: IS_WINDOWS_STORE ? false : Boolean(stored.launchAtLogin),
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
  if (view === "home" || view === "notes" || view === "zerothink" || view === "shield" || view === "agents" || view === "pilot" || view === "settings") return view;
  if (/^service:(openzero)$/.test(view)) return view;
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

async function publicSettings(settings) {
  const { openZeroTokenEncrypted: _privateToken, openAiKeyEncrypted: _openAiKey, groqKeyEncrypted: _groqKey, serperKeyEncrypted: _serperKey, zeroThinkTokenEncrypted: _zeroThinkToken, trayNoticeShown: _trayNoticeShown, ...visible } = settings;
  let snapshot;
  try { snapshot = await (await readyVault()).snapshot(); }
  catch { snapshot = { secure: false, profiles: [] }; }
  const has = (provider) => snapshot.secure && snapshot.profiles.some((profile) => profile.provider === provider && profile.hasKey);
  const active = snapshot.profiles.find((entry) => entry.id === snapshot.activeProfileId);
  return { ...visible, activeChatProfile: active ? { id: active.id, name: active.name, provider: active.provider, model: active.model, hasKey: active.hasKey } : null, hasOpenZeroToken: has("openzero"), hasOpenAiKey: has("openai"), hasGroqKey: has("groq"), hasSerperKey: has("serper") };
}

async function saveSettingsInternal(input) {
  const current = await loadSettingsInternal();
  const next = {
    ...current,
    openZeroUrl: cleanUrl(input.openZeroUrl, current.openZeroUrl),
    assistantProvider: ["openzero", "openai", "groq"].includes(input.assistantProvider) ? input.assistantProvider : current.assistantProvider,
    model: safeModelName(input.model, current.model),
    openZeroServerModel: safeModelName(input.openZeroServerModel, current.openZeroServerModel),
    openZeroAssistantMode: input.openZeroAssistantMode === "server" ? "server" : input.openZeroAssistantMode === "local" ? "local" : current.openZeroAssistantMode,
    localResourceProfile: ["low-memory", "balanced", "performance"].includes(input.localResourceProfile) ? input.localResourceProfile : current.localResourceProfile,
    localRuntimeMode: input.localRuntimeMode === "managed" || input.localRuntimeMode === "ollama" ? input.localRuntimeMode : current.localRuntimeMode,
    managedLocalConfigured: typeof input.managedLocalConfigured === "boolean" ? input.managedLocalConfigured : current.managedLocalConfigured,
    mediaEnabled: typeof input.mediaEnabled === "boolean" ? input.mediaEnabled : current.mediaEnabled,
    launchAtLogin: IS_WINDOWS_STORE ? false : typeof input.launchAtLogin === "boolean" ? input.launchAtLogin : current.launchAtLogin,
    closeToTray: typeof input.closeToTray === "boolean" ? input.closeToTray : current.closeToTray,
    onboardingCompleted: typeof input.onboardingCompleted === "boolean" ? input.onboardingCompleted : current.onboardingCompleted,
    lastView: input.lastView !== undefined ? sanitizeLastView(input.lastView) : current.lastView,
    lastCopilotOpen: typeof input.lastCopilotOpen === "boolean" ? input.lastCopilotOpen : current.lastCopilotOpen,
  };

  const vault = await readyVault();
  const vaultSecure = (await vault.snapshot()).secure;
  for (const [inputKey, provider, clearKey] of [
    ["openZeroToken", "openzero", "clearOpenZeroToken"],
    ["openAiKey", "openai", "clearOpenAiKey"],
    ["groqKey", "groq", "clearGroqKey"],
    ["serperKey", "serper", "clearSerperKey"],
  ]) {
    const snapshot = await vault.snapshot();
    if (input[clearKey]) {
      for (const profile of snapshot.profiles.filter((entry) => entry.provider === provider)) await vault.saveProfile({ ...profile, clearKey: true });
    }
    else if (typeof input[inputKey] === "string" && input[inputKey].trim()) {
      const serverEndpoint = provider === "openzero" ? endpointFor("openzero", new URL("/v1/chat/completions", next.openZeroUrl).toString()) : undefined;
      const existing = snapshot.profiles.find((entry) => entry.provider === provider && (provider !== "openzero" || entry.endpoint === serverEndpoint));
      await vault.saveProfile({ ...(existing || {}), provider, name: existing?.name || `${provider} from app settings`, model: provider === "openzero" ? next.openZeroServerModel : next.model, ...(provider === "openzero" ? { endpoint: serverEndpoint } : {}), key: input[inputKey].trim() });
    }
  }
  if (vaultSecure && (next.assistantProvider !== current.assistantProvider || next.openZeroAssistantMode !== current.openZeroAssistantMode || next.model !== current.model || next.openZeroServerModel !== current.openZeroServerModel || next.openZeroUrl !== current.openZeroUrl)) await vault.selectProfile(null);
  for (const [key, clear] of [["openZeroTokenEncrypted", "clearOpenZeroToken"], ["openAiKeyEncrypted", "clearOpenAiKey"], ["groqKeyEncrypted", "clearGroqKey"], ["serperKeyEncrypted", "clearSerperKey"]]) if (vaultSecure || input[clear] === true) delete next[key];

  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await atomicSettingsWrite(next);
  runtimeSettings = next;
  if (!IS_WINDOWS_STORE) app.setLoginItemSettings(loginItemOptions({ enabled: next.launchAtLogin, executablePath: process.execPath, packaged: app.isPackaged }));
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
    { label: "Open ZNotes", click: () => sendMainNavigation("notes") },
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

const { createNotesStore } = require("./notes-store.cjs");
let notesStore;
function localNotes() { return notesStore ||= createNotesStore({ filePath: path.join(app.getPath("userData"), "znotes.encrypted.json"), storage: safeStorage, secure: credentialStorageIsSecure }); }
let studioStore;
function localStudio() { return studioStore ||= createStudioStore({ filePath: path.join(app.getPath("userData"), "zerothink-studio.encrypted.json"), storage: safeStorage, secure: credentialStorageIsSecure }); }
let vaultStore, templateStore, vaultMigration;
function localVault() { return vaultStore ||= createVaultStore({ filePath: path.join(app.getPath("userData"), "zerothink-vault.encrypted.json"), safeStorage }); }
function localTemplates() { return templateStore ||= createTemplateStore({ filePath: path.join(app.getPath("userData"), "zerothink-templates.encrypted.json"), safeStorage }); }
let researchProjectStore;
function localResearchProjects() { return researchProjectStore ||= createResearchProjectStore({ filePath: path.join(app.getPath("userData"), "zerothink-projects.encrypted.json"), storage: safeStorage, secure: credentialStorageIsSecure }); }
async function atomicSettingsWrite(value) {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  const temporary = `${settingsPath()}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" }); await fs.rename(temporary, settingsPath()); }
  finally { await fs.unlink(temporary).catch(() => {}); }
}
async function readyVault() {
  const vault = localVault();
  if (!(await vault.snapshot()).secure) return vault;
  if (!vaultMigration) vaultMigration = (async () => {
    const settings = await loadSettingsInternal();
    const strictLegacySecret = (key) => {
      if (!settings[key]) return "";
      try { const secret = safeStorage.decryptString(Buffer.from(settings[key], "base64")); if (typeof secret !== "string" || !secret.trim()) throw new Error(); return secret; }
      catch { throw new Error("A legacy API credential could not be decrypted. Existing settings were preserved; recover or clear that credential before migration."); }
    };
    await vault.migrateLegacy({ ...settings, openAiKey: strictLegacySecret("openAiKeyEncrypted"), groqKey: strictLegacySecret("groqKeyEncrypted"), openZeroToken: strictLegacySecret("openZeroTokenEncrypted"), serperKey: strictLegacySecret("serperKeyEncrypted") });
    const legacyFields = ["openAiKeyEncrypted", "groqKeyEncrypted", "openZeroTokenEncrypted", "serperKeyEncrypted"];
    if (legacyFields.some((key) => settings[key])) {
      const cleaned = { ...settings }; for (const key of legacyFields) delete cleaned[key];
      await atomicSettingsWrite(cleaned); runtimeSettings = cleaned;
    }
  })().catch((error) => { vaultMigration = null; throw error; });
  await vaultMigration; return vault;
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

function isWorkspaceCredentialHost(urlValue) { try { return new URL(urlValue).origin === new URL(runtimeSettings.openZeroUrl).origin; } catch { return false; } }

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
    const requestedPartition = String(params?.partition || "");
    const pilotView = requestedPartition === PILOT_PARTITION;
    if (pilotView) webPreferences.preload = path.join(__dirname, "browser-pilot-preload.cjs");
    else delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.allowRunningInsecureContent = false;
    // Keep partition cookies/localStorage on disk across restarts.
    if (params && params.partition && !String(params.partition).startsWith("persist:")) {
      params.partition = `persist:${params.partition}`;
    }
    if (pilotView ? !isPilotPageUrl(params.src) : !isAllowedUrl(params.src)) event.preventDefault();
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (isPilotSession(contents.session)) {
      if (isPilotPageUrl(url)) void contents.loadURL(url).catch(() => {});
      return { action: "deny" };
    }
    if (url.startsWith("https://") && isAllowedUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const localApp = isLocalAppUrl(url);
    // The main preload exposes desktop IPC. Remote sites belong in isolated
    // webviews or the external browser, never in the privileged app renderer.
    if (contents === mainWindow?.webContents) {
      if (!localApp) event.preventDefault();
      return;
    }
    const allowed = isPilotSession(contents.session) ? isPilotPageUrl(url) : isAllowedUrl(url);
    if (!localApp && !allowed) event.preventDefault();
  });
});

app.whenReady().then(async () => {
  configurePermissionPolicy(session.defaultSession);
  await loadSettingsInternal();
  let startupVaultActive = false, startupServerKey = "", startupVaultHealthy = false;
  try {
    const vault = await readyVault(), snapshot = await vault.snapshot();
    startupVaultHealthy = true;
    if (snapshot.secure) { startupVaultActive = Boolean(snapshot.activeProfileId); startupServerKey = await vault.getServiceKey("openzero", new URL("/v1/chat/completions", runtimeSettings.openZeroUrl).toString()); }
  } catch { /* Keep the app available for credential recovery; do not replace damaged vault data. */ }
  // Upgrade the former loopback-server default to the verified on-device
  // model only when that model is already installed. Existing remote/server
  // configurations remain untouched and can still be selected in Advanced.
  const legacySlowLocalModels = new Set(["qwen3:1.7b", "openzerogemma:latest", "hf.co/shafire/Zero-Gemma4-E4B-OpenZero-GGUF:latest", "hf.co/shafire/OpenZero-Ministral3-8B-Runtime-Agent-GGUF:Q5_K_M"]);
  if (!startupVaultActive && runtimeSettings.assistantProvider === "openzero" && runtimeSettings.openZeroAssistantMode !== "server" && !runtimeSettings.fastLocalModelMigrationCompleted && legacySlowLocalModels.has(runtimeSettings.model)) {
    const local = await localOllamaStatus();
    if (local.reachable && local.models.some((model) => model.name.toLowerCase() === DEFAULT_LOCAL_MODEL.toLowerCase())) {
      runtimeSettings = { ...runtimeSettings, model: DEFAULT_LOCAL_MODEL, fastLocalModelMigrationCompleted: true };
      await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
      await fs.writeFile(settingsPath(), JSON.stringify(runtimeSettings, null, 2), { encoding: "utf8", mode: 0o600 });
    }
  }
  // Prefer private local Assistant by default so users need no API keys/tokens.
  // Loopback OpenZero panel tokens are still provisioned when available.
  if (!startupVaultActive && runtimeSettings.assistantProvider === "openzero") {
    const local = await localOllamaStatus();
    const hasLocalDefault = local.reachable && local.models.some((model) => model.name.toLowerCase() === DEFAULT_LOCAL_MODEL.toLowerCase());
    // Only migrate a legacy selection. A user may deliberately select a
    // different installed OpenZero GGUF; do not silently replace that choice.
    if (hasLocalDefault && (!runtimeSettings.fastLocalModelMigrationCompleted || legacySlowLocalModels.has(runtimeSettings.model)) && !startupServerKey) {
      runtimeSettings = { ...runtimeSettings, model: DEFAULT_LOCAL_MODEL, assistantProvider: "openzero", fastLocalModelMigrationCompleted: true };
      await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
      await fs.writeFile(settingsPath(), JSON.stringify(runtimeSettings, null, 2), { encoding: "utf8", mode: 0o600 });
    }
    if (startupVaultHealthy && !startupServerKey && credentialStorageIsSecure() && !(await localVault().snapshot()).profiles.length) {
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
  // Refresh ZMail cookies immediately on launch (before user opens the tab).
  // Workspace services use the user-configured OpenZero runtime.
  if (!IS_WINDOWS_STORE) app.setLoginItemSettings(loginItemOptions({ enabled: runtimeSettings.launchAtLogin, executablePath: process.execPath, packaged: app.isPackaged }));
  createTray();
  await createWindow();
  if (runtimeSettings.localModelTermsAcceptedRevision === managedRuntimeManifest.model.revision && runtimeSettings.managedLocalConfigured && runtimeSettings.assistantProvider === "openzero" && runtimeSettings.openZeroAssistantMode === "local" && runtimeSettings.localRuntimeMode !== "ollama") {
    const active = await (await readyVault()).getActiveCompletion().catch(() => null);
    if (!active) void localRuntime().ensureReady().catch(() => {});
  }
});

app.on("window-all-closed", () => {
  if (!runtimeSettings.closeToTray) app.quit();
});

let quitFlushDone = false;
app.on("before-quit", (event) => {
  isQuitting = true;
  zeroThinkRun?.controller.abort();
  assistantController?.abort();
  managedRuntime?.stop();
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
  distribution: IS_WINDOWS_STORE ? "microsoft-store" : "direct",
  });
});

ipcMain.handle("app:check-update", async (event) => {
  requireTrustedIpcSender(event);
  const now = Date.now();
  if (IS_WINDOWS_STORE) return storeManagedUpdateResult(app.getVersion(), now);
  if (appUpdateCache && now - appUpdateCache.cachedAt < APP_UPDATE_CACHE_MS) return appUpdateCache.result;
  const result = await checkLatestStableRelease({ currentVersion: app.getVersion(), timeoutMs: 5_000, now });
  appUpdateCache = { cachedAt: now, result };
  return result;
});

ipcMain.handle("app:install-update", async (event) => {
  requireTrustedIpcSender(event);
  if (IS_WINDOWS_STORE) throw new Error("Updates for this installation are delivered by Microsoft Store.");
  if (!app.isPackaged) throw new Error("Automatic installation is available only in an installed ZERO ONE build.");
  if (appUpdateActive) throw new Error("An update is already being prepared.");
  appUpdateActive = true;
  try {
    emitUpdateProgress({ status: "checking", percent: 0, message: "Checking the release integrity records…" });
    const update = await checkLatestStableRelease({ currentVersion: app.getVersion(), timeoutMs: 10_000, now: Date.now(), platform: process.platform, arch: process.arch });
    if (!update.updateAvailable) return { status: "current", message: "ZERO ONE is already current." };
    if (!update.installSupported) throw new Error("The latest release has no checksum-verified package for this computer.");
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: [process.platform === "win32" ? "Download, verify & install" : "Download & verify", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: `Update ZERO ONE to ${update.latestVersion}`,
      message: `Install ZERO ONE ${update.latestVersion}?`,
      detail: process.platform === "win32"
        ? "ZERO ONE will download the official GitHub package, verify both GitHub's asset digest and SHA256SUMS.txt, preserve your desktop settings, then restart into the installer."
        : "ZERO ONE will download the official GitHub package, verify both GitHub's asset digest and SHA256SUMS.txt, then open the verified package for the operating-system installation step.",
    });
    if (choice.response !== 0) return { status: "cancelled", message: "Update cancelled." };
    const checksumText = await fetchTextLimited(update.checksumUrl, { maxBytes: 1024 * 1024 });
    const filename = safeUpdateFilename(update.assetName);
    const checksum = parseSha256Sums(checksumText).get(filename);
    if (!checksum || checksum !== update.assetDigest) throw new Error("GitHub's release digest and SHA256SUMS.txt do not agree. Nothing was installed.");
    const updateDirectory = path.join(app.getPath("temp"), "zero-one-updates", `v${update.latestVersion}`);
    const destination = path.join(updateDirectory, filename);
    emitUpdateProgress({ status: "downloading", percent: 0, message: `Downloading ZERO ONE ${update.latestVersion}…` });
    const verified = await downloadVerifiedAsset({
      assetUrl: update.assetUrl,
      destination,
      expectedBytes: update.assetSize,
      expectedSha256: checksum,
      onProgress: (progress) => emitUpdateProgress({ status: "downloading", ...progress, message: `Downloading ZERO ONE ${update.latestVersion}…` }),
    });
    await fs.writeFile(path.join(updateDirectory, "verified-update.json"), JSON.stringify({ version: update.latestVersion, filename, bytes: verified.bytes, sha256: verified.sha256, verifiedAt: new Date().toISOString(), source: update.releaseUrl }, null, 2), { encoding: "utf8", mode: 0o600 });
    emitUpdateProgress({ status: "verified", percent: 100, message: "Package verified. Starting the updater…" });
    if (process.platform === "win32") {
      setTimeout(() => {
        const child = spawn(destination, ["/S"], { detached: true, stdio: "ignore", windowsHide: true });
        child.unref();
        isQuitting = true;
        app.quit();
      }, 500);
      return { status: "installing", version: update.latestVersion, message: "Verified installer is starting. ZERO ONE will close and update." };
    }
    if (process.platform === "linux") await fs.chmod(destination, 0o700);
    const openError = await shell.openPath(destination);
    if (openError) throw new Error(`The verified package could not be opened: ${openError}`);
    return { status: "downloaded", version: update.latestVersion, message: "The verified package is open. Complete the operating-system installation step." };
  } catch (error) {
    emitUpdateProgress({ status: "error", percent: 0, message: error?.message || "The update stopped safely." });
    throw error;
  } finally {
    appUpdateActive = false;
  }
});

ipcMain.on("zero-one-pilot:response", (event, payload) => {
  const requestId = String(payload?.requestId || "");
  const pending = browserPilotResponses.get(requestId);
  if (!pending || pending.senderId !== event.sender.id) return;
  clearTimeout(pending.timer);
  browserPilotResponses.delete(requestId);
  if (payload?.ok) pending.resolve(payload.result);
  else pending.reject(new Error(String(payload?.error || "The controlled page rejected the request.").slice(0, 500)));
});

ipcMain.on("zero-one-pilot:overlay-stop", (event) => {
  if (!browserPilotRun || browserPilotRun.targetId !== event.sender.id) return;
  finishPilotRun(browserPilotRun, "stopped", "Stopped and revoked from the page control.");
});

ipcMain.handle("browser-pilot:start", async (event, input) => {
  requireTrustedIpcSender(event);
  const task = String(input?.task || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 3000);
  if (!task) throw new Error("Describe one bounded browser task first.");
  const target = pilotTargetById(input?.targetId);
  if (browserPilotRun && ["running", "paused"].includes(browserPilotRun.status)) finishPilotRun(browserPilotRun, "stopped", "Replaced by a new user-granted task.");
  const run = {
    runId: randomUUID(),
    grantId: randomUUID(),
    targetId: target.id,
    task,
    step: 0,
    history: [],
    status: "running",
    message: "The exact built-in browser tab is granted for this task.",
    pending: null,
    controller: new AbortController(),
  };
  browserPilotRun = run;
  emitPilotState(run);
  void continuePilotRun(run);
  return publicPilotRun(run);
});

ipcMain.handle("browser-pilot:approve", async (event, input) => {
  requireTrustedIpcSender(event);
  const run = browserPilotRun;
  if (!run || run.runId !== String(input?.runId || "") || run.status !== "paused" || !run.pending) throw new Error("There is no matching Browser Pilot action to approve.");
  const target = pilotTargetById(run.targetId);
  const pending = run.pending;
  run.pending = null;
  run.status = "running";
  const result = await pilotCommand(target, "execute", { grantId: run.grantId, snapshotId: pending.snapshotId, action: pending.action }, 15_000);
  run.history.push({ action: pending.action.action, result: `Human approved once. ${String(result || "Completed").slice(0, 400)}` });
  run.history = run.history.slice(-8);
  run.message = `${pending.preview} · approved once; checking the result.`;
  emitPilotState(run);
  setTimeout(() => { void continuePilotRun(run); }, ["navigate", "click", "back", "forward"].includes(pending.action.action) ? 1100 : 300);
  return publicPilotRun(run);
});

ipcMain.handle("browser-pilot:deny", async (event, input) => {
  requireTrustedIpcSender(event);
  const run = browserPilotRun;
  if (!run || run.runId !== String(input?.runId || "") || run.status !== "paused" || !run.pending) throw new Error("There is no matching Browser Pilot action to deny.");
  run.history.push({ action: run.pending.action.action, result: `Human denied: ${run.pending.preview}` });
  run.history = run.history.slice(-8);
  run.pending = null;
  run.status = "running";
  run.message = "Action denied; asking OpenZero for a safer alternative.";
  emitPilotState(run);
  void continuePilotRun(run);
  return publicPilotRun(run);
});

ipcMain.handle("browser-pilot:stop", async (event, input) => {
  requireTrustedIpcSender(event);
  if (browserPilotRun && (!input?.runId || browserPilotRun.runId === String(input.runId))) finishPilotRun(browserPilotRun, "stopped", "Stopped and revoked by the user.");
  return publicPilotRun(browserPilotRun);
});

ipcMain.handle("ui:get-zoom", (event) => {
  requireTrustedIpcSender(event);
  return currentZoomFactor;
});

ipcMain.handle("ui:set-zoom", (event, factor) => {
  requireTrustedIpcSender(event);
  return applyZoomFactor(factor);
});

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

ipcMain.handle("notes:list", async (event) => { requireTrustedIpcSender(event); return localNotes().list(); });
ipcMain.handle("notes:encryption-status", async (event) => { requireTrustedIpcSender(event); return localNotes().encryptionStatus(); });
ipcMain.handle("notes:save", async (event, input) => { requireTrustedIpcSender(event); return localNotes().save(input); });
ipcMain.handle("notes:delete", async (event, id) => { requireTrustedIpcSender(event); return localNotes().remove(id); });

ipcMain.handle("notes:import", async (event) => {
  requireTrustedIpcSender(event);
  const selected = await dialog.showOpenDialog(mainWindow, { title: "Import a ZNotes JSON export", properties: ["openFile"], filters: [{ name: "ZNotes JSON", extensions: ["json"] }] });
  if (selected.canceled || !selected.filePaths.length) return { imported: 0, cancelled: true };
  const handle = await fs.open(selected.filePaths[0], "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error("Choose a ZNotes JSON export up to 20 MB.");
    const buffer = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > stat.size) throw new Error("The note export changed while being read. Try again.");
    const input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead)));
    return localNotes().import(input);
  } finally { await handle.close(); }
});
ipcMain.handle("notes:export", async (event) => {
  requireTrustedIpcSender(event);
  const choice = await dialog.showMessageBox(mainWindow, { type: "warning", title: "Export readable notes", message: "This export is plaintext, not an encrypted backup.", detail: "Includes active, archived and trashed notes. Only save it in a folder you trust. Your encrypted local notebook is retained.", buttons: ["Cancel", "Export notes"], defaultId: 0, cancelId: 0 });
  if (choice.response !== 1) return { saved: false };
  const selected = await dialog.showSaveDialog(mainWindow, { title: "Export ZNotes", defaultPath: `ZNotes-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: "ZNotes JSON", extensions: ["json"] }] });
  if (selected.canceled || !selected.filePath) return { saved: false };
  const notes = await localNotes().list();
  const temporary = `${selected.filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify({ format: "znotes-local-export", version: 1, notes }, null, 2), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await fs.rename(temporary, selected.filePath);
  } finally { await fs.unlink(temporary).catch(() => {}); }
  return { saved: true, count: notes.length };
});

ipcMain.handle("zerothink:sessions-list", async (event) => { requireTrustedIpcSender(event); return localStudio().listSessions(); });
ipcMain.handle("zerothink:session-get", async (event, id) => { requireTrustedIpcSender(event); return localStudio().getSession(id); });
ipcMain.handle("zerothink:session-save", async (event, input) => { requireTrustedIpcSender(event); return localStudio().saveSession(input); });
ipcMain.handle("zerothink:session-delete", async (event, id) => { requireTrustedIpcSender(event); return localStudio().deleteSession(id); });
ipcMain.handle("zerothink:library-list", async (event) => { requireTrustedIpcSender(event); return localStudio().listLibrary(); });
ipcMain.handle("zerothink:library-save", async (event, documents) => { requireTrustedIpcSender(event); return localStudio().saveLibrary(documents); });
ipcMain.handle("zerothink:profile-get", async (event) => { requireTrustedIpcSender(event); return localStudio().getProfile(); });
ipcMain.handle("zerothink:profile-save", async (event, profile) => { requireTrustedIpcSender(event); return localStudio().saveProfile(profile); });
ipcMain.handle("zerothink:vault-get", async (event) => { requireTrustedIpcSender(event); return (await readyVault()).snapshot(); });
ipcMain.handle("zerothink:vault-save", async (event, input) => { requireTrustedIpcSender(event); completionRouteRevision += 1; return (await readyVault()).saveProfile(input); });
ipcMain.handle("zerothink:vault-delete", async (event, id) => { requireTrustedIpcSender(event); completionRouteRevision += 1; return (await readyVault()).deleteProfile(id); });
ipcMain.handle("zerothink:vault-select", async (event, id) => { requireTrustedIpcSender(event); if (zeroThinkRun) throw new Error("Finish the current task before switching its model."); completionRouteRevision += 1; return (await readyVault()).selectProfile(id); });
ipcMain.handle("zerothink:quantum", async (event, input) => { requireTrustedIpcSender(event); return runQuantumRequest(input, { apiKey: input?.action === "local" ? "" : await (await readyVault()).getServiceKey("ionq"), fetchImpl: fetch }); });
ipcMain.handle("zerothink:quantum-ibm", async (event, input) => { requireTrustedIpcSender(event); return runIBMQuantumRequest(input, { apiKey: await (await readyVault()).getServiceKey("ibm"), fetchImpl: fetch }); });
ipcMain.handle("zerothink:templates-list", async (event) => { requireTrustedIpcSender(event); return localTemplates().list(); });
ipcMain.handle("zerothink:template-save", async (event, input) => { requireTrustedIpcSender(event); return localTemplates().save(input); });
ipcMain.handle("zerothink:template-delete", async (event, id) => { requireTrustedIpcSender(event); return localTemplates().delete(id); });
ipcMain.handle("zerothink:template-render", async (event, input) => {
  requireTrustedIpcSender(event);
  const template = input?.templateId ? (await localTemplates().list()).find((item) => item.id === input.templateId) : undefined;
  if (input?.templateId && !template) throw new Error("Choose a saved research template.");
  return renderTemplate({ ...input, template });
});
ipcMain.handle("zerothink:copy-text", (event, value) => {
  requireTrustedIpcSender(event);
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 1024 * 1024) throw new Error("Choose text up to 1 MB to copy.");
  clipboard.writeText(value);
  return true;
});
ipcMain.handle("zerothink:web-search", async (event, query) => {
  requireTrustedIpcSender(event);
  return searchWeb(query, { key: await (await readyVault()).getServiceKey("serper"), fetcher: fetch });
});

let zeroThinkProject = null;
ipcMain.handle("zerothink:project-select", async (event) => {
  requireTrustedIpcSender(event);
  if (zeroThinkRun) throw new Error("Stop the current ZeroThink task before changing its project.");
  const selected = await dialog.showOpenDialog(mainWindow, { title: "Choose a project for the ZeroThink desktop agent", properties: ["openDirectory"] });
  if (selected.canceled || !selected.filePaths.length) return zeroThinkProject ? { path: zeroThinkProject, name: path.basename(zeroThinkProject) } : null;
  const selectedRoot = await fs.realpath(selected.filePaths[0]);
  if (!(await fs.stat(selectedRoot)).isDirectory()) throw new Error("Choose a project folder.");
  zeroThinkProject = selectedRoot;
  return { path: selectedRoot, name: path.basename(selectedRoot) };
});

async function zeroThinkCompletionAdapters(signal) {
  const vault = await readyVault();
  const selected = (await vault.snapshot()).secure ? await vault.getActiveCompletion() : null;
  if (selected) return buildVaultCompletion(selected, { storeManaged: IS_WINDOWS_STORE, fetchImpl: fetch, signal });
  const settings = await loadSettingsInternal();
  const provider = settings.assistantProvider || "openzero";
  const local = provider === "openzero" && settings.openZeroAssistantMode !== "server";
  if (local && settings.localRuntimeMode !== "ollama") return managedCompletion(signal);
  const endpoint = local ? OLLAMA_LOCAL_ORIGIN : provider === "openai" ? "https://api.openai.com/v1/chat/completions" : provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : new URL("/v1/chat/completions", settings.openZeroUrl).toString();
  const token = local ? "" : await vault.getServiceKey(provider, provider === "openzero" ? endpoint : undefined);
  return buildCompletionAdapter({ provider, mode: local ? "local" : "server", endpoint, token, model: provider === "openzero" && !local ? settings.openZeroServerModel : settings.model, storeManaged: IS_WINDOWS_STORE, fetch, signal });
}

ipcMain.handle("zerothink:agent-approve", (event, input) => {
  requireTrustedIpcSender(event);
  if (!zeroThinkRun?.agent || input?.runId !== zeroThinkRun.id || event.sender.id !== zeroThinkRun.owner || typeof input.approved !== "boolean" || !zeroThinkRun.pending || input.actionId !== zeroThinkRun.pending.id) return { accepted: false };
  const pending = zeroThinkRun.pending; zeroThinkRun.pending = null; pending.finish(input.approved);
  return { accepted: true };
});
ipcMain.handle("zerothink:agent-run", async (event, input) => {
  requireTrustedIpcSender(event);
  if (zeroThinkRun) throw new Error("A ZeroThink task is already running. Stop it or wait for it to finish.");
  if (!zeroThinkProject) throw new Error("Choose a project folder first.");
  if (!input || typeof input.runId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.runId)) throw new Error("A valid task identifier is required.");
  const run = { id: input.runId, owner: event.sender.id, controller: new AbortController(), agent: true, pending: null };
  zeroThinkRun = run;
  const notify = (progress) => { if (!event.sender.isDestroyed()) event.sender.send("zerothink:agent-progress", { runId: run.id, ...progress }); };
  const ownerDestroyed = () => run.controller.abort();
  event.sender.once?.("destroyed", ownerDestroyed);
  try {
    const adapters = await zeroThinkCompletionAdapters(run.controller.signal);
    return await runAgent({ task: input.task, root: zeroThinkProject, maxSteps: input.maxSteps, signal: run.controller.signal, onProgress: notify }, { ...adapters, approve: (action) => new Promise((resolve) => {
      if (run.controller.signal.aborted || event.sender.isDestroyed()) { resolve(false); return; }
      if (typeof action.actionId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(action.actionId)) { resolve(false); return; }
      const aborted = () => { if (run.pending?.id === action.actionId) run.pending = null; resolve(false); };
      run.controller.signal.addEventListener("abort", aborted, { once: true });
      run.pending = { id: action.actionId, finish: (approved) => { run.controller.signal.removeEventListener("abort", aborted); resolve(approved); } };
      notify({ status: "approval", message: "Review the proposed change before it runs.", pending: action });
    }) });
  } finally {
    event.sender.removeListener?.("destroyed", ownerDestroyed);
    if (run.pending) { const pending = run.pending; run.pending = null; pending.finish(false); }
    if (zeroThinkRun === run) zeroThinkRun = null;
  }
});

ipcMain.handle("zerothink:research-projects-list", async (event) => { requireTrustedIpcSender(event); return localResearchProjects().listProjects(); });
ipcMain.handle("zerothink:research-project-get", async (event, id) => { requireTrustedIpcSender(event); return localResearchProjects().getProject(id); });
ipcMain.handle("zerothink:research-project-save", async (event, input) => { requireTrustedIpcSender(event); return localResearchProjects().saveProject(input); });
ipcMain.handle("zerothink:research-project-delete", async (event, id) => { requireTrustedIpcSender(event); return localResearchProjects().deleteProject(id); });
ipcMain.handle("zerothink:research-project-export", async (event, id) => {
  requireTrustedIpcSender(event);
  const text = await localResearchProjects().exportProject(id);
  const choice = await dialog.showSaveDialog(mainWindow, { title: "Export readable research project — contains selected source text", defaultPath: "ZeroThink-project.json", filters: [{ name: "Research project JSON", extensions: ["json"] }] });
  if (choice.canceled || !choice.filePath) return { saved: false };
  await fs.writeFile(choice.filePath, text, { encoding: "utf8", mode: 0o600 }); return { saved: true };
});
ipcMain.handle("zerothink:research-project-import", async (event) => {
  requireTrustedIpcSender(event);
  const choice = await dialog.showOpenDialog(mainWindow, { title: "Import a ZeroThink research project", properties: ["openFile"], filters: [{ name: "Research project JSON", extensions: ["json"] }] });
  if (choice.canceled || !choice.filePaths.length) return null;
  const handle = await fs.open(choice.filePaths[0], "r");
  try { const stat = await handle.stat(); if (!stat.isFile() || stat.size < 1 || stat.size > MAX_IMPORT) throw new Error("Choose a research project JSON file up to 4 MiB."); const bytes = Buffer.alloc(stat.size); const read = await handle.read(bytes, 0, stat.size, 0); if (read.bytesRead !== stat.size) throw new Error("The selected project changed during import."); return await localResearchProjects().importProject(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  finally { await handle.close(); }
});

ipcMain.handle("zerothink:processes", (event) => {
  requireTrustedIpcSender(event);
  return getZeroThinkProcesses().map((entry) => ({ id: entry.id, label: entry.name, description: entry.purpose, stages: entry.stages, checks: entry.checks }));
});

ipcMain.handle("zerothink:import", async (event) => {
  requireTrustedIpcSender(event);
  const selected = await dialog.showOpenDialog(mainWindow, {
    title: "Import local sources into ZeroThink",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "PDF and UTF-8 text sources", extensions: ["pdf", "txt", "md", "json", "csv"] }],
  });
  if (selected.canceled) return [];
  if (selected.filePaths.length > 8) throw new Error("Choose at most eight sources.");
  const documents = [];
  let totalBytes = 0;
  for (const selectedPath of selected.filePaths) {
    const handle = await fs.open(selectedPath, "r");
    try {
      const stat = await handle.stat();
      const pdf = path.extname(selectedPath).toLowerCase() === ".pdf";
      if (!stat.isFile() || stat.size > (pdf ? MAX_PDF_BYTES : DOCUMENT_BYTES)) throw new Error("Choose text up to 1 MB per file or PDFs up to 10 MB.");
      // Read through the checked descriptor and enforce the bound again if a file grew.
      const buffer = Buffer.alloc(stat.size + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > stat.size) throw new Error("A source changed while it was being imported. Try again.");
      const data = buffer.subarray(0, bytesRead);
      const document = pdf ? { title: path.basename(selectedPath), text: await extractPdf(data) } : cleanImportedDocument(path.basename(selectedPath), data);
      totalBytes += Buffer.byteLength(document.text, "utf8");
      if (totalBytes > CORPUS_BYTES) throw new Error("Selected sources exceed 2 MB of extracted text. Split them into smaller imports.");
      documents.push({ id: randomUUID(), ...document });
    } finally { await handle.close(); }
  }
  return documents;
});

ipcMain.handle("zerothink:run", async (event, raw) => {
  requireTrustedIpcSender(event);
  if (zeroThinkRun) throw new Error("A ZeroThink run is already active. Stop it or wait for completion.");
  if (!raw || typeof raw.runId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(raw.runId)) throw new Error("A valid research run identifier is required.");
  const input = normalizeResearchRequest(raw);
  if (!getZeroThinkProcesses().some((entry) => entry.id === input.processId)) throw new Error("Choose a supported research process.");
  const controller = new AbortController();
  const run = { id: raw.runId, owner: event.sender.id, controller };
  zeroThinkRun = run;
  try {
    let adapters = {};
    if (raw.useModel === true) {
      adapters = await zeroThinkCompletionAdapters(controller.signal);
      if (raw.autoWeb === true) { const key = await (await readyVault()).getServiceKey("serper"); adapters = { ...adapters, search: (query) => searchWeb(query, { key, fetcher: fetch, signal: controller.signal }) }; }
    }
    const profile = raw.useModel === true ? await localStudio().getProfile() : { persona: "", facts: [] };
    return await runStudio({ ...input, persona: profile.persona, facts: profile.facts.slice(-5), tokenBudget: Math.min(input.tokenBudget, input.maxPasses * 2048), signal: controller.signal, onProgress: (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send("zerothink:progress", { runId: run.id, ...progress });
    } }, adapters);
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") throw new Error("ZeroThink research stopped. Your sources remain in the workspace.");
    throw error;
  } finally { if (zeroThinkRun === run) zeroThinkRun = null; }
});

ipcMain.handle("zerothink:cancel", (event, input) => {
  requireTrustedIpcSender(event);
  if (!zeroThinkRun || input?.runId !== zeroThinkRun.id || event.sender.id !== zeroThinkRun.owner) return { cancelled: false };
  zeroThinkRun.controller.abort();
  return { cancelled: true };
});

ipcMain.handle("zerothink:export", async (event, input) => {
  requireTrustedIpcSender(event);
  if (!["markdown", "json", "pdf"].includes(input?.format) || !input?.result || typeof input.result.markdown !== "string") throw new Error("A completed research report is required.");
  const data = input.format === "json" ? JSON.stringify(input.result, null, 2) : input.result.markdown;
  if (Buffer.byteLength(data, "utf8") > 2 * 1024 * 1024) throw new Error("This report exceeds the export size limit.");
  const extension = input.format === "json" ? "json" : input.format === "pdf" ? "pdf" : "md";
  const selected = await dialog.showSaveDialog(mainWindow, { title: "Export ZeroThink report · readable unencrypted file", defaultPath: `ZeroThink-report-${new Date().toISOString().slice(0, 10)}.${extension}`, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
  if (selected.canceled || !selected.filePath) return { saved: false };
  let output = data;
  if (input.format === "pdf") {
    const printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, javascript: false, partition: `zerothink-export-${randomUUID()}` } });
    try { await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(reportHtml(input.result.markdown))}`); output = await printWindow.webContents.printToPDF({ printBackground: false, preferCSSPageSize: true }); }
    finally { printWindow.destroy(); }
  }
  await fs.writeFile(selected.filePath, output, { ...(typeof output === "string" ? { encoding: "utf8" } : {}), mode: 0o600 });
  return { saved: true };
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
  if (IS_WINDOWS_STORE) return [bundled];
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

function zsecArguments(args) {
  return IS_WINDOWS_STORE ? ["--state-dir", path.join(app.getPath("userData"), "zsec-shield-state"), ...args] : args;
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
    execFile(binary, zsecArguments(["status", "--json"]), { timeout: 6000, windowsHide: true, maxBuffer: 256 * 1024 }, (error, stdout) => {
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
    execFile(binary, zsecArguments(["check", selectedPath, "--json"]), { timeout: 10 * 60 * 1000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
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
  if (["assistantProvider", "model", "openZeroAssistantMode", "openZeroServerModel", "openZeroUrl", "localRuntimeMode"].some(key => Object.prototype.hasOwnProperty.call(input || {}, key))) completionRouteRevision += 1;
  return saveSettingsInternal(input || {});
});

ipcMain.handle("settings:clear-local-data", async (event) => {
  requireTrustedIpcSender(event);
  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Clear ZERO ONE desktop data?",
    message: "Remove local settings and embedded workspace sessions?",
    detail: "This clears settings, the encrypted API vault, saved workspace logins and OpenZero workspace cookies. An encrypted credential/settings recovery copy is retained locally before reset, including when old credentials cannot decrypt. Your encrypted ZNotes notebook, ZeroThink conversations/source library, research templates, saved research projects and downloaded local model files are retained; manage these inside ZNotes, ZeroThink and CPU setup. Diagnostics files you saved are retained.",
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
  // An explicit user-confirmed reset also works when ciphertext cannot decrypt.
  // Preserve original bytes before removing any recoverable credentials.
  const suffix = `.recovery-${randomUUID()}`;
  for (const file of [settingsPath(), path.join(app.getPath("userData"), "zerothink-vault.encrypted.json")]) {
    try { const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Credential recovery requires ordinary local files."); await fs.copyFile(file, `${file}${suffix}`, 1); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  await fs.rm(path.join(app.getPath("userData"), "zerothink-vault.encrypted.json"), { force: true });
  vaultStore = undefined; vaultMigration = null;
  await fs.rm(settingsPath(), { force: true });
  if (IS_WINDOWS_STORE) await fs.rm(path.join(app.getPath("userData"), "zsec-shield-state"), { recursive: true, force: true });
  else app.setLoginItemSettings(loginItemOptions({ enabled: false, executablePath: process.execPath, packaged: app.isPackaged }));
  runtimeSettings = { ...DEFAULT_SETTINGS };
  setTimeout(() => { app.relaunch(); app.exit(0); }, 250);
  return { cleared: true };
});

ipcMain.handle("services:probe", async (event) => {
  requireTrustedIpcSender(event);
  const settings = await loadSettingsInternal();
  return Promise.all([
    probe("openzero", settings.openZeroUrl),
  ]);
});

async function fetchLocalOllama(pathname, options = {}, timeoutMs = 8000) {
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const localFetch = IS_WINDOWS_STORE ? net.fetch : fetch;
    return await localFetch(`${OLLAMA_LOCAL_ORIGIN}${pathname}`, {
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
    const [versionResponse, tagsResponse, runningResponse] = await Promise.all([
      fetchLocalOllama("/api/version"),
      fetchLocalOllama("/api/tags"),
      fetchLocalOllama("/api/ps").catch(() => null),
    ]);
    if (!versionResponse.ok || !tagsResponse.ok) throw new Error("The local model service returned an error.");
    const [versionPayload, tagsPayload] = await Promise.all([versionResponse.json(), tagsResponse.json()]);
    const models = Array.isArray(tagsPayload.models) ? tagsPayload.models.slice(0, 250).map((model) => ({
      name: String(model?.name || model?.model || "").slice(0, 192),
      size: Math.max(0, Number(model?.size) || 0),
      modifiedAt: String(model?.modified_at || "").slice(0, 64),
    })).filter((model) => model.name) : [];
    const runningPayload = runningResponse?.ok ? await runningResponse.json().catch(() => ({})) : {};
    const runningModels = Array.isArray(runningPayload.models) ? runningPayload.models.slice(0, 16).map((model) => ({
      name: String(model?.name || model?.model || "").slice(0, 192),
      size: Math.max(0, Number(model?.size) || 0),
      expiresAt: String(model?.expires_at || "").slice(0, 64),
    })).filter((model) => model.name) : [];
    return { reachable: true, origin: OLLAMA_LOCAL_ORIGIN, defaultModel: DEFAULT_LOCAL_MODEL, version: String(versionPayload.version || "unknown").slice(0, 64), models, runningModels };
  } catch (error) {
    return { reachable: false, origin: OLLAMA_LOCAL_ORIGIN, defaultModel: DEFAULT_LOCAL_MODEL, version: "", models: [], runningModels: [], message: error?.name === "AbortError" ? "The local model service did not respond in time." : "Ollama is not running on this computer." };
  }
}

async function chatViaLocalOllama(request, preferredModel) {
  if (localChatActive) throw new Error("The local Assistant is already answering. Wait for it to finish before sending another request.");
  localChatActive = true;
  try {
  const model = cleanModelName(preferredModel || DEFAULT_LOCAL_MODEL);
  const chatMessages = cleanChatMessages(request?.messages).filter((message) => message.role !== "system");
  const directReply = localDirectReply(chatMessages);
  if (directReply) return { content: directReply, model, provider: "zero-one-local" };
  const status = await localOllamaStatus();
  for (const running of status.runningModels || []) {
    if (running.name.toLowerCase() === model.toLowerCase()) continue;
    if (!isPublishedLocalModelName(running.name)) continue;
    await fetchLocalOllama("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: running.name, prompt: "", stream: false, keep_alive: 0 }),
    }, 30_000).catch(() => null);
  }
  const messages = [{ role: "system", content: LOCAL_ASSISTANT_SYSTEM_PROMPT }, ...chatMessages];
  const resources = localResourceOptions(runtimeSettings.localResourceProfile);
  const response = await fetchLocalOllama("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, think: false, keep_alive: resources.keep_alive, options: { temperature: 0.2, repeat_penalty: 1.15, num_predict: resources.num_predict, num_ctx: resources.num_ctx } }),
  }, 120000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || `The local model service returned HTTP ${response.status}.`).slice(0, 300));
  const content = cleanAssistantContent(payload?.message?.content);
  if (!content) throw new Error("The local model returned no assistant message.");
  return { content, model: String(payload.model || model).slice(0, 192), provider: "ollama-local" };
  } finally {
    localChatActive = false;
  }
}

/** Ask ZMail to refresh through its own server-controlled session policy. */
ipcMain.handle("openzero:managed-status", async (event) => { requireTrustedIpcSender(event); return publicManagedStatus(localRuntime().status()); });
ipcMain.handle("openzero:managed-setup", async (event, input) => {
  requireTrustedIpcSender(event);
  const selectionRevision = ++completionRouteRevision;
  const settings = await loadSettingsInternal();
  if (settings.localModelTermsAcceptedRevision !== managedRuntimeManifest.model.revision) {
    if (input?.acceptTerms !== true) throw new Error("Review and accept the displayed model terms before downloading the CPU model.");
    runtimeSettings = { ...settings, localModelTermsAcceptedRevision: managedRuntimeManifest.model.revision };
    await atomicSettingsWrite(runtimeSettings);
  }
  const value = await localRuntime().ensureReady();
  const vault = await readyVault();
  if (completionRouteRevision === selectionRevision) {
    await vault.selectProfile(null);
    await saveSettingsInternal({ assistantProvider: "openzero", openZeroAssistantMode: "local", localRuntimeMode: "managed", managedLocalConfigured: true });
  } else {
    // A newer explicit selection wins over this earlier, possibly long download.
    await saveSettingsInternal({ managedLocalConfigured: true });
  }
  return publicManagedStatus(value);
});
ipcMain.handle("openzero:managed-cancel", async (event) => { requireTrustedIpcSender(event); localRuntime().cancelSetup(); return { cancelled: true }; });
ipcMain.handle("openzero:managed-stop", async (event) => { requireTrustedIpcSender(event); localRuntime().stop(); return publicManagedStatus(localRuntime().status()); });
ipcMain.handle("openzero:chat-cancel", (event) => { requireTrustedIpcSender(event); const cancelled = Boolean(assistantController); assistantController?.abort(); return { cancelled }; });

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
  if (IS_WINDOWS_STORE) throw new Error("Local model downloading is not included in the Microsoft Store edition.");
  const model = cleanModelName(input?.model || DEFAULT_LOCAL_MODEL);
  const preflight = await localOllamaStatus();
  if (!preflight.reachable) {
    throw new Error("Ollama is not running on this computer. Install or start Ollama, choose Check again, then download the local Assistant.");
  }
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
  let responseStarted = false;
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
    responseStarted = true;
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
    if (error?.name === "TypeError" || /fetch failed|socket|terminated|connection (?:closed|reset|refused)/i.test(String(error?.message || ""))) {
      throw new Error(responseStarted
        ? "The local model download connection was interrupted. Keep Ollama running, check internet access and free disk space, then try again."
        : "ZERO ONE could not reach Ollama. Install or start Ollama, choose Check again, then download the local Assistant.");
    }
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

ipcMain.handle("openzero:local-unload", async (event, input) => {
  requireTrustedIpcSender(event);
  const status = await localOllamaStatus();
  if (!status.reachable) throw new Error("Ollama is not running on this computer.");
  const selected = cleanModelName(input?.model || DEFAULT_LOCAL_MODEL);
  const requested = input?.all === true
    ? status.runningModels
      .filter((entry) => isPublishedLocalModelName(entry.name) || entry.name.toLowerCase() === selected.toLowerCase())
      .map((entry) => entry.name)
    : [cleanModelName(input?.model || DEFAULT_LOCAL_MODEL)];
  let unloaded = 0;
  for (const model of [...new Set(requested)]) {
    if (!model) continue;
    const response = await fetchLocalOllama("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "", stream: false, keep_alive: 0 }),
    }, 30_000);
    if (response.ok) unloaded += 1;
  }
  return { unloaded };
});

ipcMain.handle("openzero:local-chat", async (event, request) => {
  requireTrustedIpcSender(event);
  try {
    return await chatViaLocalOllama(request, request?.model || DEFAULT_LOCAL_MODEL);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("The local assistant took too long. Check Ollama and the selected local model in Settings, then try again. A smaller model may respond faster on CPU-only systems.");
    throw error;
  }
});

async function provisionOpenZeroDesktop(settings = null) {
  if (!credentialStorageIsSecure()) throw new Error("Secure operating-system credential storage is unavailable.");
  settings = settings || await loadSettingsInternal();
  // Validate the credential destination before requesting or transmitting a
  // token, and retain distinct profiles for distinct user-owned servers.
  const serverEndpoint = endpointFor("openzero", new URL("/v1/chat/completions", settings.openZeroUrl).toString());
  const pairingEndpoint = new URL("/api/openzero/key", settings.openZeroUrl).toString();
  let paired;
  try {
    paired = await fetch(pairingEndpoint, {
      method: "POST",
      redirect: "error",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": `ZERO-ONE/${app.getVersion()}` },
      body: JSON.stringify({ action: "rotate" }),
    });
  } catch { throw new Error("OpenZero pairing could not be reached. Check its address and connection."); }
  const payload = await paired.json().catch(() => ({}));
  if (!paired.ok) throw new Error("OpenZero automatic connection was rejected. Check its server settings and try again.");
  const token = String(payload.api_key || "");
  if (!/^oz_[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error("OpenZero returned an invalid API credential.");

  const modelsEndpoint = new URL("/v1/models", settings.openZeroUrl).toString();
  let verified;
  try { verified = await fetch(modelsEndpoint, { redirect: "error", headers: { Authorization: `Bearer ${token}`, "User-Agent": `ZERO-ONE/${app.getVersion()}` } }); }
  catch { throw new Error("OpenZero created desktop access, but its verification request failed. Check the server connection and try again."); }
  if (!verified.ok) throw new Error("OpenZero created desktop access, but verification failed. Try again.");
  const modelPayload = await verified.json().catch(() => ({}));
  const models = Array.isArray(modelPayload?.data) ? modelPayload.data.map((entry) => String(entry?.id || "").trim()).filter((model) => model && !model.includes(token)) : [];
  const recommended = safeModelName(String(modelPayload?.recommended_model || "").includes(token) ? "" : modelPayload?.recommended_model, DEFAULT_OPENZERO_SERVER_MODEL);
  const browserModel = models.includes(recommended) ? recommended : models.includes(DEFAULT_OPENZERO_SERVER_MODEL) ? DEFAULT_OPENZERO_SERVER_MODEL : safeModelName(models[0], settings.openZeroServerModel || DEFAULT_OPENZERO_SERVER_MODEL);
  const next = { ...settings, assistantProvider: "openzero", openZeroServerModel: browserModel };
  const vault = await readyVault();
  const existing = (await vault.snapshot()).profiles.find((entry) => entry.provider === "openzero" && entry.endpoint === serverEndpoint);
  await vault.saveProfile({ ...(existing || {}), provider: "openzero", name: existing?.name || "OpenZero desktop connection", endpoint: serverEndpoint, model: browserModel, key: token });
  await vault.selectProfile(null);
  delete next.openZeroTokenEncrypted;
  await atomicSettingsWrite(next);
  runtimeSettings = next;
  return { settings: await publicSettings(next), hint: String(payload.hint || "").replaceAll(token, "[redacted]").slice(0, 500), model: browserModel, models };
}

ipcMain.handle("openzero:connect-desktop", async (event) => {
  requireTrustedIpcSender(event);
  return provisionOpenZeroDesktop();
});

ipcMain.handle("openzero:chat", async (event, request) => {
  requireTrustedIpcSender(event);
  if (assistantController) throw new Error("The Assistant is already answering. Stop it or wait for the current answer.");
  const controller = new AbortController(); assistantController = controller;
  const destroyed = () => controller.abort(); event.sender.once("destroyed", destroyed);
  const progress = (stage, message) => { if (!event.sender.isDestroyed()) event.sender.send("openzero:chat-progress", { stage, message }); };
  try {
    progress("preparing", "I’m on it. Preparing your selected model…");
    const adapter = await zeroThinkCompletionAdapters(controller.signal);
    progress("waiting", "Your model is generating an answer. CPU inference can take time; you can stop it at any point.");
    const response = await adapter.complete({ messages: cleanChatMessages(request?.messages), maxTokens: 1024, signal: controller.signal });
    progress("complete", "Answer ready.");
    return { content: response.content, model: response.model || "Configured model" };
  } finally { event.sender.removeListener("destroyed", destroyed); if (assistantController === controller) assistantController = null; }
});

ipcMain.handle("shell:open-external", async (event, url) => {
  requireTrustedIpcSender(event);
  if (!isAllowedUrl(url)) throw new Error("That destination is outside the ZERO ONE allowlist.");
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("diagnostics:export", async (event) => {
  requireTrustedIpcSender(event);
  const settings = await publicSettings(await loadSettingsInternal());
  const services = await Promise.all([
    probe("openzero", settings.openZeroUrl),
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
        openZero: diagnosticOrigin(settings.openZeroUrl),
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
