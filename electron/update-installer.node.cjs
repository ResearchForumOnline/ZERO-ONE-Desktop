const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { access, mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { downloadVerifiedAsset, fetchTextLimited, parseSha256Sums, safeUpdateFilename } = require("./update-installer.cjs");

test("update checksum parsing accepts standard SHA256SUMS and ignores unsafe paths", () => {
  const sums = parseSha256Sums(`${"a".repeat(64)}  ZERO-ONE-7.9.2-win-x64.exe\n${"b".repeat(64)} *../bad.exe\n`);
  assert.equal(sums.get("ZERO-ONE-7.9.2-win-x64.exe"), "a".repeat(64));
  assert.equal(sums.has("../bad.exe"), false);
});

test("update filenames are exact platform packages", () => {
  assert.equal(safeUpdateFilename("ZERO-ONE-7.9.2-win-x64.exe"), "ZERO-ONE-7.9.2-win-x64.exe");
  assert.equal(safeUpdateFilename("ZERO-ONE-7.9.2-mac-arm64.dmg"), "ZERO-ONE-7.9.2-mac-arm64.dmg");
  assert.equal(safeUpdateFilename("ZERO-ONE-7.9.2-linux-x86_64.AppImage"), "ZERO-ONE-7.9.2-linux-x86_64.AppImage");
  assert.throws(() => safeUpdateFilename("ZERO-ONE-7.9.2-win-x64.exe.cmd"), /recognized/);
  assert.throws(() => safeUpdateFilename("../ZERO-ONE-7.9.2-win-x64.exe"), /recognized/);
});

test("checksum fetch follows the official GitHub asset redirect but rejects other origins", async () => {
  let redirectMode = "";
  const text = await fetchTextLimited("https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v7.9.2/SHA256SUMS.txt", {
    fetchImpl: async (_url, options) => { redirectMode = options.redirect; return { ok: true, status: 200, headers: { get: () => "70" }, text: async () => `${"a".repeat(64)}  file\n` }; },
  });
  assert.equal(redirectMode, "follow");
  assert.match(text, /^[a-f0-9]{64}/);
  await assert.rejects(fetchTextLimited("https://example.com/SHA256SUMS.txt", { fetchImpl: async () => ({ ok: true }) }), /official ZERO ONE/);
});

test("update download is atomic and rejects any byte or checksum mismatch", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "zero-one-updater-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const payload = Buffer.from("verified ZERO ONE package bytes", "utf8");
  const digest = createHash("sha256").update(payload).digest("hex");
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    body: new ReadableStream({ start(controller) { controller.enqueue(payload); controller.close(); } }),
  });
  const destination = path.join(root, "ZERO-ONE-7.9.2-win-x64.exe");
  const result = await downloadVerifiedAsset({
    assetUrl: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v7.9.2/ZERO-ONE-7.9.2-win-x64.exe",
    destination,
    expectedBytes: payload.length,
    expectedSha256: digest,
    fetchImpl,
  });
  assert.equal(result.sha256, digest);
  assert.deepEqual(await readFile(destination), payload);

  const rejected = path.join(root, "ZERO-ONE-7.9.3-win-x64.exe");
  await assert.rejects(downloadVerifiedAsset({
    assetUrl: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v7.9.3/ZERO-ONE-7.9.3-win-x64.exe",
    destination: rejected,
    expectedBytes: payload.length,
    expectedSha256: "0".repeat(64),
    fetchImpl,
  }), /checksum did not match/);
  await assert.rejects(access(rejected));
  await assert.rejects(access(`${rejected}.partial`));
});
