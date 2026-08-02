import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

const main = readFileSync(resolve(process.cwd(), "electron/main.cjs"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const fuses = readFileSync(resolve(process.cwd(), "build/afterPack.cjs"), "utf8");
const beforePack = readFileSync(resolve(process.cwd(), "build/beforePack.cjs"), "utf8");
const zsecContract = readFileSync(resolve(process.cwd(), "electron/zsec-contract.cjs"), "utf8");
const vendorVerifier = readFileSync(resolve(process.cwd(), "build/zsec-vendor-verifier.cjs"), "utf8");
const vendorStager = readFileSync(resolve(process.cwd(), "scripts/stage-zsec-vendor.ps1"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
const vendorLock = JSON.parse(readFileSync(resolve(process.cwd(), "vendor/zsec-shield.lock.json"), "utf8"));
const { parseZsecScanReport, parseZsecStatusPayload } = createRequire(import.meta.url)(resolve(process.cwd(), "electron/zsec-contract.cjs")) as {
  parseZsecScanReport(stdout: string): { outcome: string; filesHashed: number; bytesHashed: number; findings: number; errors: number };
  parseZsecStatusPayload(payload: unknown, fallbackPlatform?: string): { state: string; outcome?: string; errors?: number; filesHashed?: number; bytesHashed?: number; message: string };
};const { readLock } = createRequire(import.meta.url)(resolve(process.cwd(), "build/zsec-vendor-verifier.cjs")) as {
  readLock(lockPath: string): unknown;
};
const { cleanConfiguredUrl, diagnosticOrigin, isAllowedUrl } = createRequire(import.meta.url)(resolve(process.cwd(), "electron/url-policy.cjs")) as {
  cleanConfiguredUrl(value: string, fallback: string, allowedOrigins: Set<string>): string;
  diagnosticOrigin(value: string): string;
  isAllowedUrl(value: string, allowedOrigins: Set<string>): boolean;
};

const baseStatus = {
  schema: "zsec.shield.status.v2",
  contract_version: 2,
  version: "0.1.2",
  platform: "windows",
  definitions: "built-in:0.1.2;feed:absent",
  last_scan: "2026-08-02T02:41:42Z",
  findings: 0,
  last_scan_outcome: "no_configured_rule_matches",
  last_scan_errors: 0,
  last_scan_files_hashed: 4,
  last_scan_bytes_hashed: 1024,
  last_scan_diagnostic: { available: true, error: null },
  quarantine_count: 0,
};

describe("desktop security contract", () => {
  it("keeps remote navigation and media on parsed owned origins", () => {
    expect(main).toContain('"https://webmail.zmail.my"');
    expect(main).toContain("new URL(value).origin");
    expect(main).toContain('url.startsWith("https://") && isAllowedUrl(url)');
    expect(main).toContain("isCallChatOrigin(details.requestingUrl");
    expect(main).toContain("isLocalAppUrl(url)");
    expect(appSource).toContain("https://talktoai.org/report-ai/");
    expect(appSource).not.toContain("4 ready");
    expect(appSource).not.toContain("SOVEREIGN DIGITAL OPERATING SYSTEM");
    expect(appSource).not.toContain("inference stays on your node");
    expect(appSource).toContain("PUBLIC PREVIEW");
    expect(main).not.toContain('url.startsWith("file:")');
  });

  it("rejects URL credentials and secret-like configuration data from diagnostics", () => {
    const origins = new Set(["https://openzero.talktoai.org", "https://webmail.zmail.my"]);
    const fallback = "https://openzero.talktoai.org/";
    expect(isAllowedUrl("https://user:pass@openzero.talktoai.org/", origins)).toBe(false);
    expect(cleanConfiguredUrl("https://openzero.talktoai.org/?token=secret", fallback, origins)).toBe(fallback);
    expect(cleanConfiguredUrl("https://openzero.talktoai.org/#secret", fallback, origins)).toBe(fallback);
    expect(cleanConfiguredUrl("https://webmail.zmail.my/?_task=workspace", fallback, origins)).toBe("https://webmail.zmail.my/?_task=workspace");
    expect(diagnosticOrigin("https://openzero.talktoai.org/private/path?token=secret#fragment")).toBe("https://openzero.talktoai.org");
    expect(main).toContain("No hostname, API tokens, URL credentials/queries/fragments");
  });

  it("binds IPC to the main local renderer and rejects insecure credential fallback", () => {
    expect(main).toContain("event?.sender === mainWindow.webContents");
    expect(main).toContain("event?.senderFrame === event.sender.mainFrame");
    expect(main).toContain('backend !== "basic_text"');
  });

  it("keeps ZMath Secure on fixed platform protections and explicit disk consent", () => {
    expect(main).toContain('ipcMain.handle("zmath:security-status"');
    expect(main).toContain('Get-BitLockerVolume -MountPoint $env:SystemDrive');
    expect(main).toContain('timeout: 8000');
    expect(main).toContain('maxBuffer: 64 * 1024');
    expect(main).toContain('shell.openExternal("ms-settings:deviceencryption")');
    expect(appSource).toContain("never enables or changes disk encryption silently");
    expect(appSource).toContain("established TLS and operating-system cryptography");
    expect(main).not.toContain("Enable-BitLocker");
  });

  it("maps only an exact successful status-v2 scan to ready", () => {
    expect(parseZsecStatusPayload(baseStatus)).toMatchObject({
      state: "ready",
      outcome: "no_configured_rule_matches",
      errors: 0,
      filesHashed: 4,
      bytesHashed: 1024,
    });
    expect(main).toContain("parseZsecStatusPayload");
    expect(main).not.toContain('const state = !lastScan ? "idle" : findings > 0 ? "attention" : "ready"');
  });

  it("keeps v2 idle, findings, and every incomplete scan fail closed", () => {
    const idle = {
      ...baseStatus,
      last_scan: null,
      last_scan_outcome: null,
      last_scan_files_hashed: null,
      last_scan_bytes_hashed: null,
      last_scan_diagnostic: { available: false, error: null },
    };
    expect(parseZsecStatusPayload(idle)).toMatchObject({ state: "idle" });

    const findings = {
      ...baseStatus,
      findings: 2,
      last_scan_outcome: "configured_rule_matches_detected",
    };
    expect(parseZsecStatusPayload(findings)).toMatchObject({ state: "attention" });

    for (const errors of [0, 2]) {
      const incomplete = { ...baseStatus, last_scan_outcome: "incomplete", last_scan_errors: errors };
      expect(parseZsecStatusPayload(incomplete)).toMatchObject({ state: "attention", outcome: "incomplete", errors });
      expect(parseZsecStatusPayload(incomplete).state).not.toBe("ready");
    }
  });

  it("rejects inconsistent, diagnostic-error, and legacy recorded scan evidence", () => {
    expect(() => parseZsecStatusPayload({ ...baseStatus, findings: 1 })).toThrow("Inconsistent clean ZSEC status");
    expect(() => parseZsecStatusPayload({ ...baseStatus, last_scan_diagnostic: { available: false, error: "corrupt" } })).toThrow("Unavailable ZSEC last-scan evidence");

    const legacy = {
      ...baseStatus,
      schema: "zsec.shield.status.v1",
      contract_version: 1,
      last_scan_outcome: undefined,
      last_scan_errors: undefined,
      last_scan_files_hashed: undefined,
      last_scan_bytes_hashed: undefined,
    };
    expect(parseZsecStatusPayload(legacy)).toMatchObject({ state: "unavailable" });
    expect(parseZsecStatusPayload(legacy).state).not.toBe("ready");
  });

  it("keeps on-demand ZSEC scans bounded and user-selected", () => {
    expect(main).toContain('execFile(binary, ["check", selectedPath, "--json"]');
    expect(zsecContract).toContain('report.schema !== "zsec.shield.report.v1"');
    expect(main).toContain('properties: ["openDirectory", "dontAddToRecent"]');
    expect(main).toContain("timeout: 10 * 60 * 1000");
    expect(main).toContain("maxBuffer: 2 * 1024 * 1024");
    expect(main).toContain("isExpectedZsecScanExit(error, outcome)");
  });

  it("parses the real top-level ZSEC scan shape and rejects the obsolete shape", () => {
    const report = JSON.stringify({
      schema: "zsec.shield.report.v1",
      outcome: "no_configured_rule_matches",
      scan: { stats: { files_hashed: 9, bytes_hashed: 2048, findings: 0, errors: 0 } },
    });
    expect(parseZsecScanReport(report)).toMatchObject({ filesHashed: 9, bytesHashed: 2048, findings: 0, errors: 0 });
    expect(() => parseZsecScanReport(JSON.stringify({ schema: "zsec.shield.report.v1", outcome: "no_configured_rule_matches", payload: { scan: { stats: {} } } }))).toThrow("Malformed ZSEC scan report");
    expect(() => parseZsecScanReport(JSON.stringify({ schema: "zsec.shield.report.v1", outcome: "no_configured_rule_matches", scan: { stats: { files_hashed: 1, bytes_hashed: 1, findings: 9, errors: 7 } } }))).toThrow("Inconsistent clean");
    expect(() => parseZsecScanReport(JSON.stringify({ schema: "zsec.shield.report.v1", outcome: "configured_rule_matches_detected", scan: { stats: { files_hashed: 1, bytes_hashed: 1, findings: 0, errors: 0 } } }))).toThrow("Inconsistent finding");
    expect(() => parseZsecScanReport(JSON.stringify({ schema: "zsec.shield.report.v1", outcome: "incomplete", scan: { stats: { files_hashed: 1, bytes_hashed: 1, findings: 0, errors: 0 } } }))).toThrow("Inconsistent incomplete");
  });

  it("pins an immutable, exact-architecture ZSEC payload and fails packaging closed", () => {
    expect(vendorLock).toMatchObject({
      schema: "zero-one.zsec-vendor-lock.v1",
      consumer_version: "0.4.0",
      release: { id: 363682670, tag: "v0.1.2", immutable: true, release_attestation_verified: true },
      asset: { id: 498488611, size: 12392156, sha256: "62ade4111206e6b0b083c60dd2ccd1b7cbc83452e4067d71ea99ac76364dd13d" },
      manifest: { version: "0.1.2", architecture: "x86_64", source_tree_state: "clean" },
    });
    expect(packageJson.version).toBe("0.4.0");
    expect(packageJson.build.beforePack).toBe("build/beforePack.cjs");
    expect(packageJson.build.win.target[0].arch).toEqual(["x64"]);
    expect(packageJson.scripts["dist:mac"]).toContain("--mac dmg zip --arm64");
    expect(packageJson.scripts["dist:linux"]).toContain("--linux AppImage deb --x64");
    expect(packageJson.scripts["dist:win"]).toContain("--publish never");
    expect(packageJson.scripts["dist:mac"]).toContain("--publish never");
    expect(packageJson.scripts["dist:linux"]).toContain("--publish never");
    expect(packageJson.scripts["verify:zsec:native"]).toContain("zsec-native-verifier.cjs");
    expect(beforePack).toContain("context.packager.appInfo.version");
    expect(beforePack).toContain('context.electronPlatformName === "darwin"');
    expect(beforePack).toContain('context.electronPlatformName === "linux"');
    expect(beforePack).not.toContain("context.packager.metadata");
    expect(vendorVerifier).toContain("native manifest digest does not match the lock");
    expect(vendorVerifier).toContain("non-AMD64 PE file");
    expect(vendorStager).toContain('Assert-Condition ($release.immutable -eq $true)');
    expect(vendorStager).toContain("missing-path scan did not fail incomplete");
    expect(vendorVerifier).toContain(vendorLock.manifest.sha256);
    expect(vendorVerifier).toContain(vendorLock.manifest.entrypoint_sha256);
    expect(vendorVerifier).toContain("isDeepStrictEqual(lock, PINNED_LOCK)");
  });

  it("rejects a lock whose embedded scanner identity was rewritten", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "zero-one-lock-test-"));
    try {
      const tamperedLock = structuredClone(vendorLock);
      tamperedLock.manifest.sha256 = "0".repeat(64);
      tamperedLock.manifest.entrypoint_sha256 = "1".repeat(64);
      const lockPath = join(temporaryRoot, "tampered-lock.json");
      writeFileSync(lockPath, JSON.stringify(tamperedLock), "utf8");
      expect(() => readLock(lockPath)).toThrow("embedded immutable ZSEC identity");
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("hardens every recognized Electron fuse before signing", () => {
    expect(fuses).toContain("strictlyRequireAllFuses: true");
    expect(fuses).toContain("[FuseV1Options.RunAsNode]: false");
    expect(fuses).toContain("[FuseV1Options.OnlyLoadAppFromAsar]: true");
    expect(fuses).toContain("[FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false");
    expect(fuses).toContain("[FuseV1Options.GrantFileProtocolExtraPrivileges]: true");
    expect(fuses).toContain("context.packager.executableName");
  });
});
