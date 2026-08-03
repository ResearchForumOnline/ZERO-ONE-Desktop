import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const main = readFileSync(resolve(process.cwd(), "electron/main.cjs"), "utf8");

describe("ZSEC control centre", () => {
  it("leads with one understandable, consent-based action", () => {
    expect(app).toContain("GUIDED SECURE CHECK");
    expect(app).toContain("Check a folder now");
    expect(app).toContain("Choose folder and scan");
    expect(app).toContain("does not upload, delete, quarantine, or change system settings");
    expect(main).toContain('properties: ["openDirectory", "dontAddToRecent"]');
    expect(main).toContain('execFile(binary, ["check", selectedPath, "--json"]');
  });

  it("separates ZSEC evidence from operating-system live protection", () => {
    expect(app).toContain("PROTECTION AT A GLANCE");
    expect(app).toContain("ZSEC folder checks");
    expect(app).toContain("Live file protection");
    expect(app).toContain("YOUR OS");
    expect(app).toContain("Automatic file changes");
    expect(app).toContain("OFF BY DESIGN");
    expect(app).toContain("not a complete antivirus");
    expect(app).not.toContain("ZSEC real-time protection is active");
    expect(app).not.toContain("Your computer is protected by ZSEC");
  });

  it("labels scan evidence without turning a no-match result into a clean claim", () => {
    expect(app).toContain("LAST SCAN: NO MATCHES");
    expect(app).toContain("No configured-rule matches");
    expect(app).toContain("A match is a review signal, not proof that a file is malicious");
    expect(app).not.toContain("Your device is clean");
    expect(app).not.toContain("Threat free");
  });

  it("shows automatic safety guardrails without implying automatic threat removal", () => {
    expect(app).toContain("AUTOMATIC SAFETY DEFAULTS");
    expect(app).toContain("These guardrails are automatic; threat removal is not.");
    expect(app).toContain("No AI, telemetry, or file upload");
    expect(app).toContain("Links, reparse points, and special files are not followed");
  });

  it("animates the scanner indicator only while a requested scan is running", () => {
    expect(app).toContain('zsec-radar ${scanning ? "scanning" : ""}');
    expect(css).toContain(".zsec-radar span{animation:none}");
    expect(css).toContain(".zsec-radar.scanning span{animation:spin 1.1s linear infinite}");
  });

  it("keeps the ZSEC action, evidence, and details layouts usable on narrow windows", () => {
    expect(css).toContain(".zsec-command-grid{display:grid");
    expect(css).toMatch(/@media\(max-width:1320px\)\{\.zsec-command-grid\{grid-template-columns:1fr\}/);
    expect(css).toMatch(/@media\(max-width:720px\).*\.zsec-stats\{grid-template-columns:1fr\}/s);
    expect(css).toContain(".zsec-details-grid{grid-template-columns:1fr}");
  });
});
