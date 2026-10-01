import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const workspace = readFileSync(resolve(import.meta.dirname, "ZeroThinkWorkspace.tsx"), "utf8");
const panel = readFileSync(resolve(import.meta.dirname, "ZeroThinkProjects.tsx"), "utf8");
describe("native saved research project UI contracts", () => {
  it("autosaves bounded settings and selected source snapshots through native storage", () => {
    expect(workspace).toContain("projectAPI.saveZeroThinkProject");
    expect(workspace).toContain("documents: selected");
    expect(workspace).toContain("650");
    expect(workspace).toContain("Autosave failed:");
    expect(workspace).toContain("window.clearTimeout(timer)");
    expect(panel).not.toMatch(/localStorage|sessionStorage|fetch\(|dangerouslySetInnerHTML/);
  });
  it("persists a running checkpoint before actual research and the final result after it", () => {
    expect(workspace.indexOf("saveZeroThinkProject(runningProject)")).toBeLessThan(workspace.indexOf("await window.zeroOne.runZeroThink"));
    expect(workspace).toContain('result: answer, status: "completed"');
    expect(workspace).toContain('status: "interrupted", lastError:');
    expect(workspace).toContain("elapsed}s");
    expect(workspace).toContain("Stop · Esc");
  });
  it("imports only prepare a reviewable project, exports disclose source text", () => {
    expect(panel).toContain("api.importZeroThinkProject()");
    expect(panel).toContain("await onOpen(p)");
    expect(panel).not.toContain("runZeroThink");
    expect(panel).toContain("Imports never trigger model, web or computer actions");
    expect(panel).toContain("anything typed into your question, source text or answer remains content");
  });
  it("flushes captured Research drafts on navigation and before portable operations", () => {
    expect(workspace).toContain('tab !== "research" || !active || !project?.id');
    expect(workspace).toContain("pendingProjectDraft.current = {");
    expect(workspace).toContain("projectSaveQueue.current.catch(() => {}).then");
    expect(workspace).toContain("projectSaveQueue.current = save;");
    expect(workspace).toContain("onBeforeAction={flushProject}");
    expect(panel.indexOf("await onBeforeAction()")).toBeLessThan(panel.indexOf("await action()"));
    expect(workspace.indexOf("await flushProject();", workspace.indexOf("async function run()"))).toBeLessThan(workspace.indexOf("saveZeroThinkProject(runningProject)"));
  });
  it("refreshes selected Vault metadata after managed setup and repeated tab requests", () => {
    expect(workspace).toContain("settings.activeChatProfile?.id, settings.activeChatProfile?.model");
    expect(workspace).toContain("[requestedTab, requestedTabNonce]");
  });
  it("offers built-in CPU setup in both distributions without an API credential", () => {
    expect(workspace).toContain("<ManagedLocalSetup compact");
    expect(workspace).toContain('<option value="local">Built-in CPU AI</option>');
    expect(workspace).toContain('blockedLocal = localModel && storeManaged && modelSettings.localRuntimeMode === "ollama"');
    expect(workspace).toContain('"Local Ollama" : "OpenZero CPU"');
    expect(workspace).toContain("if (requestedTab) setTab(requestedTab)");
  });
});
