import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const packageMetadata = JSON.parse(read("package.json")) as { version: string };
const currentNotes = read(`store/RELEASE_NOTES_${packageMetadata.version}.md`);

describe(`${packageMetadata.version} current release documentation contract`, () => {
  const readme = read("README.md");
  const storeReadiness = read("docs/STORE_READINESS.md");
  const storeIndex = read("store/README.md");
  const packagedLocalChatSmoke = read("scripts/smoke-packaged-local-chat.ps1");
  const packagedWindowsSmoke = read("scripts/smoke-packaged-windows.ps1");
  const credentialVerifier = read("scripts/verify-openzero-credential.cjs");
  const installedVerifier = read("scripts/verify-installed-openzero.cjs");
  const recommendedModel = "hf.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF:Q4_K_M";
  const serverModel = "hf.co/shafire/OpenZero-Ministral3-8B-Runtime-Agent-GGUF:Q5_K_M";

  it("derives the current documentation contract from package.json", () => {
    expect(readme).toContain(`Current source version is **${packageMetadata.version}**`);
    expect(currentNotes).toContain(`# ZERO ONE ${packageMetadata.version}`);
    expect(storeReadiness).toContain(`## ZERO ONE ${packageMetadata.version} source and public-preview gate`);
    expect(storeIndex).toContain(`Working-tree product version: \`${packageMetadata.version}\``);
  });

  it("documents the recommended lightweight model and keeps alternatives honest", () => {
    expect(readme).toContain(recommendedModel);
    expect(readme).toMatch(/Qwen3 1\.7B[^\n]*excluded/i);
    expect(readme).toMatch(/Fusion[^\n]*excluded/i);
    expect(readme).not.toMatch(/Qwen[^\n]*default/i);
    expect(currentNotes).toMatch(/Gemma4 E2B[^\n]*recommended lightweight/i);
    expect(currentNotes).toMatch(/(?:blocks?|excluded)[^\n]*Fusion model|Fusion model[^\n]*(?:blocked|excluded)/i);
  });

  it("smokes the packaged default rather than a historical model", () => {
    for (const script of [packagedLocalChatSmoke, packagedWindowsSmoke]) {
      expect(script).toContain(recommendedModel);
      expect(script).toContain("getLocalOpenZeroStatus");
      expect(script).toContain("status.defaultModel");
      expect(script).not.toContain("OpenZero-Qwen3-1.7B-Agentic-GGUF");
    }
  });

  it("verifies the separate current OpenZero server route and model", () => {
    for (const script of [credentialVerifier, installedVerifier]) {
      expect(script).toContain(serverModel);
      expect(script).toContain("settings.openZeroServerModel");
      expect(script).toContain("settings.openZeroUrl");
      expect(script).toContain("cleanConfiguredUrl");
      expect(script).not.toContain('settings.model || "openzerogemma:latest"');
    }
  });

  it("keeps local model chat separate from full OpenZero orchestration", () => {
    expect(readme).toMatch(/Local[^\n]*recommended/i);
    expect(readme).toMatch(/Server[^\n]*advanced/i);
    expect(readme).toMatch(/model chat/i);
    expect(readme).toMatch(/full[^\n]*orchestration/i);
    expect(readme).toMatch(/browser control/i);
    expect(readme).toMatch(/server model setting is separate/i);
  });

  it("links to official Ollama setup and API references", () => {
    expect(readme).toContain("https://ollama.com/download");
    expect(readme).toContain("https://docs.ollama.com/quickstart");
    expect(readme).toContain("https://docs.ollama.com/api/chat");
  });
});

describe("preserved 0.5.0 historical release evidence", () => {
  const notes = read("store/RELEASE_NOTES_0.5.0.md");
  const evidence = read("store/RELEASE_EVIDENCE_0.5.0.md");

  it("retains the historical local/server capability boundary", () => {
    expect(notes).toMatch(/Local[^\n]*recommended/i);
    expect(notes).toMatch(/Server[^\n]*advanced/i);
    expect(notes).toMatch(/model chat/i);
    expect(notes).toMatch(/full[^\n]*orchestration/i);
    expect(notes).toMatch(/browser control/i);
  });

  it("keeps historical verification separate from public release and signing", () => {
    expect(evidence).toMatch(/public release and publisher signing remain pending/i);
    expect(evidence).toContain("Authenticode: `NotSigned`");
    expect(evidence).toMatch(/Installed version: `0\.5\.0\.0`/i);
    expect(evidence).toMatch(/real[^\n]*\/api\/chat/i);
    expect(evidence).toMatch(/loopback/i);
  });
});
