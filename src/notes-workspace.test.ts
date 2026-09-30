import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const notes = readFileSync(resolve(root, "src/NotesWorkspace.tsx"), "utf8");
const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const agent = readFileSync(resolve(root, "src/ZeroThinkAgentWorkspace.tsx"), "utf8");

describe("local ZNotes interaction contract", () => {
  it("agent approvals prevent double clicks and preserve newer pending previews", () => {
    expect(agent).toContain("approvalSending.current === actionId");
    expect(agent).toContain("approveZeroThinkAgent(runId.current, actionId, approved)");
    expect(agent).toContain("current?.pending?.actionId === actionId");
    expect(agent).toContain("disabled={approvalSendingId === pending.actionId}");
  });
  it("creates persisted notes before exposing the editor", () => {
    expect(notes).toMatch(/const note = await window\.zeroOne\.saveNote/);
    expect(notes).toMatch(/acceptDraft\(note\)/);
    expect(notes).toContain("New note created and encrypted on this device.");
    expect(notes).not.toMatch(/setSelectedId\(null\);\s*setTitle\(""\)/);
  });
  it("keeps the notebook mounted while switching workspaces and saves edits automatically", () => {
    expect(app).toContain('<NotesWorkspace active={view === "notes"} />');
    expect(app).not.toContain('{view === "notes" && <NotesWorkspace');
    expect(notes).toContain("window.setTimeout(() => { void saveCurrent(); }, 650)");
    expect(notes).toContain('event.key.toLowerCase() === "s"');
    expect(notes).toContain("revision.current === atRevision");
    expect(notes).toContain("if (!await saveCurrent()) return");
  });
  it("restores original note organisation and explicit export controls", () => {
    for (const control of ["Capture idea", "New checklist", "Grid view", "List view", "Filter note labels", "Archive", "Trash", "Pin", "Note colour", "Import JSON", "Export JSON", "Try again"]) expect(notes).toContain(control);
    expect(notes).toContain('role="alertdialog"');
    expect(notes).toContain('role={failed ? "alert" : "status"}');
    expect(notes).not.toContain("window.confirm");
    expect(notes).not.toContain("localStorage");
  });
});
