import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("0.5.0 local OpenZero documentation contract", () => {
  const readme = read("README.md");
  const notes = read("store/RELEASE_NOTES_0.5.0.md");
  const evidence = read("store/RELEASE_EVIDENCE_0.5.0.md");

  it("presents Local as recommended and Server as advanced", () => {
    expect(readme).toMatch(/Local[^\n]*recommended/i);
    expect(readme).toMatch(/Server[^\n]*advanced/i);
    expect(notes).toMatch(/Local[^\n]*recommended/i);
    expect(notes).toMatch(/Server[^\n]*advanced/i);
  });

  it("does not confuse direct Ollama chat with full OpenZero orchestration", () => {
    for (const document of [readme, notes]) {
      expect(document).toMatch(/model chat/i);
      expect(document).toMatch(/full[^\n]*orchestration/i);
      expect(document).toMatch(/browser control/i);
    }
  });

  it("links only to official Ollama setup and API references", () => {
    for (const document of [readme, notes, evidence]) {
      expect(document).toContain("https://ollama.com/download");
      expect(document).toContain("https://docs.ollama.com/quickstart");
      expect(document).toContain("https://docs.ollama.com/api/chat");
    }
  });

  it("keeps local verification separate from public release and signing", () => {
    expect(evidence).toMatch(/public release and publisher signing remain pending/i);
    expect(evidence).toContain("Authenticode: `NotSigned`");
    expect(evidence).toMatch(/Installed version: `0\.5\.0\.0`/i);
    expect(evidence).toMatch(/real[^\n]*\/api\/chat/i);
    expect(evidence).toMatch(/loopback/i);
  });
});
