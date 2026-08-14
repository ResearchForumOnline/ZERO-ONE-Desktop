import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(root, "src/styles.css"), "utf8");
const main = readFileSync(resolve(root, "electron/main.cjs"), "utf8");
const preload = readFileSync(resolve(root, "electron/preload.cjs"), "utf8");
const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");

describe("responsive desktop shell", () => {
  it("reflows the assistant below the workspace at constrained widths", () => {
    expect(css).toContain("@media(max-width:1040px)");
    expect(css).toMatch(/\.copilot\{grid-column:2;grid-row:2/);
    expect(css).toContain("@media(max-width:720px)");
    expect(css).toMatch(/\.sidebar\{grid-column:1;grid-row:1;overflow-x:auto/);
    expect(css).toContain("@media(max-width:720px) and (max-height:620px)");
    expect(css).toMatch(/grid-template-rows:56px minmax\(0,1fr\) 180px/);
  });

  it("keeps every primary content surface scrollable", () => {
    expect(css).toMatch(/\.view-scroll\{height:100%;overflow-y:auto/);
    expect(css).toMatch(/\.main-stage,.copilot,.content-frame,.view-scroll\{min-height:0\}/);
    expect(css).toMatch(/\.content-frame>\.view-scroll\{position:absolute;inset:0;width:100%;height:auto;overflow-y:auto;overflow-x:hidden/);
    expect(css).toContain(".view-scroll::-webkit-scrollbar-thumb");
    expect(css).toMatch(/\.content-frame\{overflow:hidden\}/);
  });

  it("does not create an unused desktop grid row at short viewport heights", () => {
    expect(css).not.toMatch(/@media\(max-height:620px\)\{\.app-shell\{/);
    expect(css).toContain("@media(min-width:721px) and (max-width:1040px) and (max-height:620px)");
    expect(css).toMatch(/\.app-shell\{height:100dvh;min-height:0;overflow:hidden\}/);
  });

  it("pins an embedded workspace to the full remaining service surface", () => {
    expect(css).toMatch(/\.workspace-surface\{display:block;flex:1 1 0;min-width:0;min-height:0\}/);
    expect(css).toMatch(/\.workspace-surface>\.product-webview\{position:absolute;inset:0;width:100%;height:100%;min-height:100%/);
    expect(css).toMatch(/\.sidebar\{overflow-x:hidden\}/);
  });

  it("keeps opened service webviews mounted while making inactive tabs inaccessible", () => {
    expect(app).toContain("retainMountedServiceTab(current, serviceIdFromView(next))");
    expect(app).toContain("renderedServiceIds.map((serviceId)");
    expect(app).toContain("key={serviceId}");
    expect(app).toContain("aria-hidden={!active}");
    expect(app).toContain("inert={!active}");
    expect(css).toContain(".workspace-tab-panel.inactive{visibility:hidden;pointer-events:none;z-index:0}");
    expect(app).not.toContain("{activeService && <ServiceWorkspace");
  });

  it("offers bounded ZMail assistant actions without automatic sending", () => {
    expect(app).toContain("Check visible inbox");
    expect(app).toContain("Compose email");
    expect(app).toContain("zero-one:zmail-action");
    expect(app).toContain("review everything in ZMail before you press Send");
    expect(app).toContain("row.getClientRects().length > 0");
    expect(app).toContain("onOpenZmail()");
    expect(app).toContain('navigate("service:zmail", { collapseCopilot: false })');
    expect(app).toContain("ZMail home");
  });

  it("exposes bounded zoom to the renderer and embedded workspaces", () => {
    expect(main).toContain("const ZOOM_LEVELS");
    expect(main).toContain("webContents.getAllWebContents()");
    expect(main).toContain('ipcMain.handle("ui:set-zoom"');
    expect(preload).toContain('setUserInterfaceScale: (factor) => ipcRenderer.invoke("ui:set-zoom", factor)');
  });

  it("checks only for an official stable update and leaves installation to the user", () => {
    expect(main).toContain('require("./update-check.cjs")');
    expect(main).toContain('ipcMain.handle("app:check-update"');
    expect(main).toContain("APP_UPDATE_CACHE_MS");
    expect(preload).toContain('checkForAppUpdate: () => ipcRenderer.invoke("app:check-update")');
    expect(app).toContain("ZERO ONE {update.latestVersion} is available");
    expect(app).toContain("Nothing is downloaded or installed automatically.");
    expect(app).toContain("Review download ↗");
    expect(app).toContain("window.setInterval(check, 6 * 60 * 60 * 1000)");
    expect(css).toContain(".app-update-banner");
    expect(main).not.toContain("autoUpdater");
  });

  it("always identifies the installed version and offers a visible update status", () => {
    expect(app).toContain('className="sidebar-version"');
    expect(app).toContain('aria-label={`ZERO ONE version ${version || "unknown"}`}');
    expect(app).toContain("VERSION &amp; UPDATES");
    expect(app).toContain("Check for updates");
    expect(app).toContain("You have the latest version");
    expect(app).toContain("Official stable releases only");
    expect(css).toContain(".sidebar-version");
    expect(css).toMatch(/\.sidebar-version\{[^}]*font:700 10px\/1\.2/);
    expect(css).toContain(".settings-update-section");
  });

  it("shows a consistent keyboard focus indicator on interactive controls", () => {
    for (const selector of ["button:focus-visible", "input:focus-visible", "textarea:focus-visible", "select:focus-visible", "a:focus-visible", "summary:focus-visible", '[role="button"]:focus-visible']) {
      expect(css).toContain(selector);
    }
    expect(css).toContain("outline:2px solid var(--cyan)");
  });

  it("uses the ZeroThink CLI device flow through the system browser", () => {
    expect(main).toContain('zeroThinkApi("device_start"');
    expect(main).toContain('zeroThinkApi("device_poll"');
    expect(main).toContain("shell.openExternal(started.verification_url)");
    expect(main).toContain('session.fromPartition("persist:zero-one-zerothink")');
    expect(main).toContain("desktop_session.php");
    expect(main).toContain('credentials: "include"');
    expect(main).toContain("targetSession.cookies.set");
    expect(main).toContain('name: "PHPSESSID"');
    expect(main).toContain("latestPhpSessionCookie");
    expect(main).toContain("sessionCookie.expirationDate");
    expect(main).toContain("zeroThinkIdentityFromCookies");
    expect(main).toContain("flushAllWorkspaceSessions");
    expect(main).not.toContain("hardenPartitionCookies");
    expect(main).toContain("buildLoginAssistScript");
    expect(main).toContain("ZERO_ONE_SAVE_LOGIN_SIGNAL");
    expect(main).toContain("capturePendingWorkspaceLogin");
    expect(main).toContain('body: JSON.stringify({ action: "me" })');
    expect(main).toContain('identity.status !== "success"');
    expect(main).toContain('body: JSON.stringify({ access_token: accessToken })');
    expect(main).toContain('const finalResponseUrl = String(studio.url || "")');
    expect(main).toContain('finalResponseUrl ? new URL(finalResponseUrl) : null');
    expect(main).toContain('finalUrl && (finalUrl.origin !== ZERO_THINK_ORIGIN || !finalUrl.pathname.startsWith("/studio"))');
    expect(main).toContain('ipcMain.handle("zerothink:restore-session"');
    expect(main).toContain('ipcMain.handle("workspace:list-logins"');
    expect(preload).toContain('restoreZeroThinkSession: () => ipcRenderer.invoke("zerothink:restore-session")');
    expect(preload).toContain('signOutZeroThink: () => ipcRenderer.invoke("zerothink:sign-out")');
    expect(preload).toContain("listSavedWorkspaceLogins");
    expect(preload).toContain("getWorkspaceCredentialStatus");
    expect(preload).toContain("keepZmailSessionAlive");
  });

  it("gives ZeroThink a responsive, honest task-space shell", () => {
    expect(app).toContain('className="zerothink-dock"');
    expect(app).toContain("Signed in on this PC");
    expect(app).toContain("Stays signed in after you close ZERO ONE");
    expect(app).toContain('accountState === "linked"');
    expect(app).toContain("Sign in once");
    expect(app).toContain("Saved logins on this PC");
    expect(app).toContain("Save login is optional");
    expect(app).toContain("Password saving is off by default");
    expect(app).not.toContain("it will be remembered automatically");
    expect(css).toContain(".zerothink-layout.dock-collapsed");
    expect(css).toContain("@media(max-width:560px)");
    expect(css).toContain(".saved-login-list");
  });

  it("makes OpenZero the guided Assistant default with optional hosted providers", () => {
    expect(main).toContain('assistantProvider: "openzero"');
    expect(main).toContain('model: DEFAULT_LOCAL_MODEL');
    expect(main).toContain('"https://api.openai.com/v1/chat/completions"');
    expect(main).toContain('"https://api.groq.com/openai/v1/chat/completions"');
    expect(main).toContain('decryptSecret(settings, "openAiKeyEncrypted")');
    expect(main).toContain('decryptSecret(settings, "groqKeyEncrypted")');
    expect(app).toContain("Local model recommended");
    expect(app).toContain("Set up Assistant");
    expect(app).toContain("Local Assistant model");
    expect(app).toContain("Use my OpenZero server");
    expect(app).toContain("Local Assistant mode needs no API key or token");
    expect(app).toContain("Download selected local Assistant");
    expect(app).toContain("no API key required");
    expect(app).toContain("Assistant needs no config");
    expect(app).toContain("chat-clear");
    expect(app).toContain('key === "j"');
    expect(app).toContain("lastView");
    expect(app).toContain("Apache-2.0 open shell");
    expect(app).toContain('const LOCAL_OPENZERO_MODEL = OPENZERO_GEMMA_E2B_MODEL');
    expect(app).toContain("chatLocalOpenZero");
    expect(app).toContain("getLocalOpenZeroStatus");
    expect(app).toContain("model.name.toLowerCase() === modelName");
    expect(app).not.toContain('startsWith(`${modelName.split(":")[0]}:`)');
    expect(main).toContain('ipcMain.handle("openzero:connect-desktop"');
    expect(main).toContain('new URL("/api/openzero/key", settings.openZeroUrl)');
    expect(main).toContain('new URL("/v1/models", settings.openZeroUrl)');
    expect(main).toContain('await provisionOpenZeroDesktop(runtimeSettings)');
    expect(main).toContain('["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname)');
    expect(main).toContain("keepZmailSessionAlive");
    expect(main).toContain("chatViaLocalOllama");
    expect(preload).toContain('connectOpenZeroDesktop: () => ipcRenderer.invoke("openzero:connect-desktop")');
    expect(app).toContain('chooseProvider("groq")');
    expect(app).toContain('chooseProvider("openai")');
    expect(app).not.toContain("LOCKED");
  });

  it("embeds the configured full OpenZero panel and distinguishes connected surfaces", () => {
    expect(app).toContain("const configuredUrl = serviceUrl(service, settings)");
    expect(app).not.toContain('service.id === "openzero" ? settings.openZeroPublicUrl');
    expect(app).toContain("Full OpenZero panel");
    expect(app).toContain("The top-right drawer is fast everyday chat.");
    expect(app).toContain("Chrome or Brave actions stay tab-scoped and require your approval.");
    expect(app).toContain("cgaalobjjknalamgchppccbocnhonhbf");
    expect(app).toContain("Connect full OpenZero");
    expect(app).toContain("openZeroServerModel");
    expect(app).not.toMatch(/Install openzerogemma:latest[^\n]*recommended browser-agent model/);
    expect(main).toContain("recommended_model");
    expect(main).toContain("openZeroServerModel");
    expect(main).toContain('"https://chromewebstore.google.com"');
    expect(main).toContain('new URL("/api/openzero/key", settings.openZeroUrl)');
    expect(app).toContain('field("openZeroUrl", "OpenZero full panel and API"');
  });

  it("keeps local model management on the fixed Ollama loopback API", () => {
    expect(main).toContain('OLLAMA_LOCAL_ORIGIN');
    expect(main).toContain('fetchLocalOllama("/api/version")');
    expect(main).toContain('fetchLocalOllama("/api/tags")');
    expect(main).toContain('fetchLocalOllama("/api/pull"');
    expect(main).toContain('fetchLocalOllama("/api/chat"');
    expect(main).toContain('think: false');
    expect(main).toContain("num_predict: resources.num_predict");
    expect(main).toContain('}, 120000);');
    expect(main).toContain('repeat_penalty: 1.15');
    expect(main).toContain('LOCAL_ASSISTANT_SYSTEM_PROMPT');
    expect(main).toContain("localResourceOptions(runtimeSettings.localResourceProfile)");
    expect(main).toContain("inferOpenZeroRoutingSettings(stored)");
    expect(main).toContain('const useLocalOllama = provider === "openzero" && settings.openZeroAssistantMode !== "server";');
    expect(app).toContain('const localSelected = settings.assistantProvider === "openzero" && settings.openZeroAssistantMode !== "server";');
    expect(app).toContain("Current custom model · {selectedLocalModel}");
    expect(main).toContain("if (!isPublishedLocalModelName(running.name)) continue;");
    expect(main).toContain("status.runningModels.filter((entry) => isPublishedLocalModelName(entry.name))");
    expect(app).toContain("for (const running of runningLocalModels)");
    expect(app).toContain("unloadLocalOpenZeroModels?.({ model: running.name })");
    expect(app).not.toContain("unloadLocalOpenZeroModels?.({ all: true })");
    expect(main).toContain('ipcMain.handle("openzero:local-unload"');
    expect(preload).toContain('ipcRenderer.invoke("openzero:local-unload"');
    expect(main).toContain('ipcMain.handle("openzero:local-pull-cancel"');
    expect(preload).toContain('ipcRenderer.invoke("openzero:local-status")');
    expect(main).toContain('shell.openExternal("https://ollama.com/download")');
    expect(preload).toContain('ipcRenderer.on("openzero:local-pull-progress"');
    expect(preload).toContain('ipcRenderer.removeListener("openzero:local-pull-progress"');
    expect(main).toContain("sandbox: true");
    expect(preload).not.toContain('require("node:crypto")');
    expect(preload).not.toContain("globalThis.crypto.getRandomValues");
    expect(main).toContain("const jobId = randomUUID()");
  });

  it("reveals the window after a normal installed launch", () => {
    expect(main).toContain('mainWindow.once("ready-to-show", revealAfterNormalLaunch)');
    expect(main).toContain('mainWindow.webContents.once("did-finish-load", revealAfterNormalLaunch)');
    expect(main).toContain('!shouldStartHidden(process.argv)');
  });

  it("shows recovery instead of a blank renderer when the preload bridge is unavailable", () => {
    expect(app).toContain("could not start its secure desktop bridge");
    expect(app).toContain("if (!window.zeroOne?.loadSettings)");
    expect(app).toContain("if (!window.zeroOne?.getUserInterfaceScale)");
    expect(app).toContain("if (!window.zeroOne?.onAppNavigate) return");
  });
});
