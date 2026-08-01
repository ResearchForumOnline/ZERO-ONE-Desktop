import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const main = readFileSync(resolve(process.cwd(), "electron/main.cjs"), "utf8");
const fuses = readFileSync(resolve(process.cwd(), "build/afterPack.cjs"), "utf8");

describe("desktop security contract", () => {
  it("keeps remote navigation and media on parsed owned origins", () => {
    expect(main).toContain('"https://webmail.zmail.my"');
    expect(main).toContain("new URL(value).origin");
    expect(main).toContain('url.startsWith("https://") && isAllowedUrl(url)');
    expect(main).toContain("isCallChatOrigin(details.requestingUrl");
  });

  it("binds IPC to the main local renderer and rejects insecure credential fallback", () => {
    expect(main).toContain("event?.sender === mainWindow.webContents");
    expect(main).toContain("event?.senderFrame === event.sender.mainFrame");
    expect(main).toContain('backend !== "basic_text"');
  });

  it("fails closed on the versioned ZSEC status contract", () => {
    expect(main).toContain('payload.schema !== "zsec.shield.status.v1"');
    expect(main).toContain("payload.contract_version !== 1");
    expect(main).toContain("payload.quarantine_count");
    expect(main).toContain('const state = !lastScan ? "idle"');
    expect(main).not.toContain('state: findings > 0 ? "attention" : "protected"');
  });

  it("hardens every recognized Electron fuse before signing", () => {
    expect(fuses).toContain("strictlyRequireAllFuses: true");
    expect(fuses).toContain("[FuseV1Options.RunAsNode]: false");
    expect(fuses).toContain("[FuseV1Options.OnlyLoadAppFromAsar]: true");
    expect(fuses).toContain("[FuseV1Options.GrantFileProtocolExtraPrivileges]: false");
  });
});
