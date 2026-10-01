import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const app = readFileSync(resolve(import.meta.dirname, "App.tsx"), "utf8");
const copilot = app.slice(app.indexOf("function Copilot("), app.indexOf("function CommandPalette("));
const service = app.slice(app.indexOf("function ServiceWorkspace("), app.indexOf("function AgentLattice("));
describe("native managed OpenZero app integration", () => {
  it("offers native CPU setup by default and a webview only in explicit server mode", () => {
    expect(service).toContain('serverMode = settings.openZeroAssistantMode === "server"');
    expect(service).toContain("{serverMode ? <div");
    expect(service).toContain("<ManagedLocalSetup autoStart={active && autoSetupRequested}");
    for (const wording of ["Chat with Zero", "Research and saved projects", "Build or edit a project", "Open Browser Pilot"]) expect(service).toContain(wording);
  });
  it("requires an explicit onboarding action before requesting auto setup", () => {
    expect(app).toContain("useState(false)");
    expect(app).toContain("Set up my CPU AI");
    expect(app).toContain("Continue without a model");
    expect(app).toContain("One-time download · about 3.4 GB");
    expect(app).toContain("Review the model terms before the download begins");
    expect(app).toContain('setAutoSetupRequested(true); navigate("service:openzero")');
    expect(app).not.toContain("The Store edition does not download local AI models");
  });
  it("uses the active vault profile for actual Assistant readiness, model and unified completion", () => {
    expect(copilot).toContain("profile = settings.activeChatProfile");
    expect(copilot).toContain("profile?.model");
    expect(copilot).toContain('profile.hasKey || profile.provider === "openzero"');
    expect(copilot).toContain('managedStatus.phase === "ready"');
    expect(copilot).toContain("await window.zeroOne.chat(");
    expect(copilot).not.toContain("chatLocalOpenZero!(");
  });
  it("provides actual cancellation, named progress and elapsed time without fabricated reasoning", () => {
    expect(copilot).toContain("window.zeroOne.cancelAssistantChat()");
    expect(copilot).toContain("window.zeroOne.onAssistantProgress");
    expect(copilot).toContain("setActivity(event.message)");
    expect(copilot).toContain("{elapsed}s");
    expect(copilot).toContain("Stop · Esc");
    expect(copilot).toContain("window.removeEventListener");
    expect(copilot).not.toContain("Thinking deeply");
  });
  it("keeps advanced Ollama explicit and separates Store update constraints from CPU setup", () => {
    expect(app).toContain('!storeManaged && openZeroMode === "local"');
    expect(app).toContain('draft.localRuntimeMode !== "ollama"');
    expect(app).toContain("Built-in CPU AI · automatic setup");
    expect(app).not.toContain("Local model downloading depends on a separate desktop runtime and is therefore not offered in this Store package");
    expect(app).toContain("Managed by Microsoft Store");
  });
  it("retains granted-tab approvals and stop while removing mandatory server pairing", () => {
    expect(app).not.toContain("await window.zeroOne.connectOpenZeroDesktop()");
    expect(app).toContain("window.zeroOne.startBrowserPilot");
    expect(app).toContain("window.zeroOne.approveBrowserPilot");
    expect(app).toContain("window.zeroOne.denyBrowserPilot");
    expect(app).toContain("window.zeroOne.stopBrowserPilot");
  });
  it("repeated native workspace navigation carries a fresh request nonce", () => {
    expect(app).toContain("requestedTabNonce={zeroThinkNavigationNonce}");
    expect(app).toContain('active={view === "zerothink"}');
    expect(app).toContain("setZeroThinkNavigationNonce((value) => value + 1)");
    expect(app).not.toContain("Run records and rollback evidence are kept locally");
  });
  it("discloses retained research projects, model files and recovery copies when resetting", () => {
    expect(app).toContain("research templates and saved research projects are retained");
    expect(app).toContain("Downloaded model files, readable exports, saved diagnostics and server accounts are not deleted");
    expect(app).toContain("Local credential/settings recovery copies");
    expect(app).toContain("This is not a complete data purge");
  });
});
