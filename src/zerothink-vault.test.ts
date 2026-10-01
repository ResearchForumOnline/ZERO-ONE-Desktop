import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ui = readFileSync(resolve(root, "src/ZeroThinkVault.tsx"), "utf8");
const vault = readFileSync(resolve(root, "electron/zerothink-vault.cjs"), "utf8");

describe("native ZeroThink private vault interaction contract", () => {
  it("uses fixed native IPC methods and has no browser key storage", () => {
    for (const method of ["getZeroThinkVault", "saveZeroThinkVaultProfile", "deleteZeroThinkVaultProfile", "selectZeroThinkVaultProfile"]) expect(ui).toContain(`window.zeroOne.${method}`);
    for (const unsafe of ["localStorage", "sessionStorage", "fetch(", "navigator.clipboard", "dangerouslySetInnerHTML"]) expect(ui).not.toContain(unsafe);
  });
  it("hides keys and clears entered keys before sending the save request", () => {
    expect(ui).toContain('type="password"'); expect(ui).toContain('autoComplete="off"'); expect(ui).toContain("Key saved · never displayed");
    expect(ui).toMatch(/const key = credential\.trim\(\); setCredential\(""\)/);
    expect(ui.indexOf('const key = credential.trim(); setCredential("")')).toBeLessThan(ui.indexOf("await window.zeroOne.saveZeroThinkVaultProfile(input)"));
  });
  it("renders explicit local confirmations for updates and deletion", () => {
    expect(ui).toContain('role="alertdialog"'); expect(ui).toContain("Remove profile and key"); expect(ui).toContain("Confirm update"); expect(ui).toContain("setPending(null); setCredential(\"\")"); expect(ui).not.toContain("window.confirm");
  });
  it("presents real service kinds and explicit account quota wording", () => {
    for (const wording of ["Chat keys power Chat, Research and Agent", "Serper powers web search", "IonQ and IBM keys belong to Quantum", "Saving a key makes no API request", "promises no free quota"]) expect(ui).toContain(wording);
    expect(ui).toContain('profile.kind === "chat" &&'); expect(ui).toContain("!snapshot?.secure");
  });
  it("redacts credentials from snapshots and encrypts the full state", () => {
    expect(vault).toContain("hasKey: !!key"); expect(vault).toContain("safeStorage.encryptString(encoded)"); expect(vault).toContain('getSelectedStorageBackend() !== "basic_text"'); expect(vault).toContain('await fs.rename(temporary, filePath)'); expect(vault).toContain("state.legacyMigrated = true");
  });
});
