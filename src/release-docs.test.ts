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
  const managedSmoke = read("scripts/smoke-managed-local-runtime.cjs");
  const managedAgentSmoke = read("scripts/smoke-managed-agent.cjs");
  const managedManifest = JSON.parse(read("electron/managed-local-runtime-manifest.json"));
  const managedSetup = read("src/ManagedLocalSetup.tsx");
  const credentialVerifier = read("scripts/verify-openzero-credential.cjs");
  const installedVerifier = read("scripts/verify-installed-openzero.cjs");
  const recommendedModel = "hf.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF:Q4_K_M";
  const serverModel = "hf.co/shafire/OpenZero-Ministral3-8B-Runtime-Agent-GGUF:Q5_K_M";

  it("derives the current documentation contract from package.json", () => {
    expect(readme).toContain(`Current source version is **${packageMetadata.version}**`);
    expect(currentNotes).toContain(`# ZERO ONE ${packageMetadata.version}`);
    expect(storeReadiness).toContain(`## ZERO ONE ${packageMetadata.version} release gate`);
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

  it("pins and actually smokes the managed CPU model rather than requiring external Ollama", () => {
    expect(managedManifest.model.id).toBe("shafire/OpenZero-Gemma4-E2B-Agentic-GGUF");
    expect(managedManifest.model.file).toBe("OpenZero-Gemma4-E2B-Agentic-Q4_K_M.gguf");
    expect(managedManifest.model.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(managedManifest.model.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(managedManifest.model.bytes).toBe(3416119872);
    expect(managedSmoke).toContain("await manager.ensureReady()");
    expect(managedSmoke).toContain("await manager.complete(");
    expect(managedSmoke).toContain("unauthenticatedStatus !== 401");
    expect(managedSmoke).toContain("modelSha256: await hashFile(manager.modelPath)");
    expect(managedSmoke).toContain("gpuLayers: 0");
    expect(managedAgentSmoke).toContain("runAgent");
    expect(managedSetup).toContain("window.zeroOne.setupManagedLocal({ acceptTerms: termsAccepted })");
    expect(managedSetup).toContain("termsAccepted");
    expect(managedSetup).toContain("window.zeroOne.cancelManagedLocalSetup()");
    expect(managedSmoke).not.toContain("OpenZero-Qwen3-1.7B-Agentic-GGUF");
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

  it("documents native local tools and separates full remote server orchestration", () => {
    expect(readme).toMatch(/Local[^\n]*recommended/i);
    expect(readme).toMatch(/Server[^\n]*advanced/i);
    expect(readme).toMatch(/model chat/i);
    expect(readme).toMatch(/full[^\n]*orchestration/i);
    expect(readme).toMatch(/browser control/i);
    expect(readme).toMatch(/server model setting is separate/i);
    expect(readme).toContain("Agent planning and Browser Pilot planning");
    expect(readme).toContain("Filesystem writes and project commands require approval");
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
