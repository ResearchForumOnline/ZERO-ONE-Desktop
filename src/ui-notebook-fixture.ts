// Development-only synthetic UI fixture. Production builds never install this bridge.
export function installNotebookFixture(api: Window["zeroOne"]) {
  const records = new Map<string, LocalNote>();
  const badge = document.createElement("div");
  badge.textContent = "UI TEST FIXTURE · synthetic notes in memory · desktop encryption is tested separately";
  badge.style.cssText = "position:fixed;bottom:0;left:0;right:0;padding:6px;background:#843516;color:#fff;z-index:10000;font:12px sans-serif;text-align:center";
  document.body.append(badge);
  api.listNotes = async () => Array.from(records.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  api.saveNote = async (input) => {
    const note: LocalNote = { pinned: false, state: "active", color: "midnight", labels: [], checklist: [], ...records.get(input.id), ...input, updatedAt: new Date().toISOString() };
    records.set(note.id, structuredClone(note)); return structuredClone(note);
  };
  api.deleteNote = async (id) => records.delete(id);
}
