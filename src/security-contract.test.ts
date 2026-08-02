import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const main = readFileSync(resolve(process.cwd(), "electron/main.cjs"), "utf8");
const fuses = readFileSync(resolve(process.cwd(), "build/afterPack.cjs"), "utf8");
const zsecContract = readFileSync(resolve(process.cwd(), "electron/zsec-contract.cjs"), "utf8");
const { parseZsecScanReport } = createRequire(import.meta.url)(resolve(process.cwd(), "electron/zsec-contract.cjs")) as {
  parseZsecScanReport(stdout: string): { outcome: string; filesHashed: number; bytesHashed: number; findings: number; errors: number };
};

describe("desktop security contract", () => {
  it("keeps remote navigation and media on parsed owned origins", () => {
    expect(main).toContain('"https://webmail.zmail.my"');
    expect(main).toContain("new URL(value).origin");
    expect(main).toContain('url.startsWith("https://") && isAllowedUrl(url)');
    expect(main).toContain("isCallChatOrigin(details.requestingUrl");
    expect(main).toContain("isLocalAppUrl(url)");
    expect(main).not.toContain('url.startsWith("file:")');
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

  it("keeps on-demand ZSEC scans bounded and user-selected", () => {
    expect(main).toContain('execFile(binary, ["check", selectedPath, "--json"]');
    expect(zsecContract).toContain('report.schema !== "zsec.shield.report.v1"');
    expect(main).toContain('properties: ["openDirectory", "dontAddToRecent"]');
    expect(main).toContain("timeout: 10 * 60 * 1000");
    expect(main).toContain("maxBuffer: 2 * 1024 * 1024");
  });

  it("parses the real top-level ZSEC scan shape and rejects the obsolete shape", () => {
    const report = JSON.stringify({
      schema: "zsec.shield.report.v1",
      outcome: "no_configured_rule_matches",
      scan: { stats: { files_hashed: 9, bytes_hashed: 2048, findings: 0, errors: 0 } },
    });
    expect(parseZsecScanReport(report)).toMatchObject({ filesHashed: 9, bytesHashed: 2048, findings: 0, errors: 0 });
    expect(() => parseZsecScanReport(JSON.stringify({ schema: "zsec.shield.report.v1", outcome: "no_configured_rule_matches", payload: { scan: { stats: {} } } }))).toThrow("Malformed ZSEC scan report");
  });

  it("hardens every recognized Electron fuse before signing", () => {
    expect(fuses).toContain("strictlyRequireAllFuses: true");
    expect(fuses).toContain("[FuseV1Options.RunAsNode]: false");
    expect(fuses).toContain("[FuseV1Options.OnlyLoadAppFromAsar]: true");
    expect(fuses).toContain("[FuseV1Options.GrantFileProtocolExtraPrivileges]: false");
  });
});
