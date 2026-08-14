const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LATEST_RELEASE_API,
  checkLatestStableRelease,
  compareStableVersions,
  parseStableVersion,
  platformAssetName,
} = require("./update-check.cjs");

test("stable version parsing and comparison are strict", () => {
  assert.deepEqual(parseStableVersion("v0.6.4"), [0, 6, 4]);
  assert.equal(parseStableVersion("0.6.4-beta.1"), null);
  assert.equal(parseStableVersion("0.6"), null);
  assert.equal(compareStableVersions("0.6.4", "0.6.3"), 1);
  assert.equal(compareStableVersions("0.6.3", "0.6.3"), 0);
  assert.equal(compareStableVersions("0.5.9", "0.6.0"), -1);
  assert.equal(compareStableVersions("bad", "0.6.0"), null);
  assert.equal(platformAssetName("7.9.2", "win32", "x64"), "ZERO-ONE-7.9.2-win-x64.exe");
  assert.equal(platformAssetName("7.9.2", "linux", "arm64"), "");
});

test("official stable GitHub response exposes only checksum-verifiable install metadata", async () => {
  let request;
  const result = await checkLatestStableRelease({
    currentVersion: "0.6.3",
    now: Date.UTC(2026, 7, 9, 12, 0, 0),
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          tag_name: "v0.6.4",
          draft: false,
          prerelease: false,
          html_url: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v0.6.4",
          assets: [
            { name: "ZERO-ONE-0.6.4-win-x64.exe", browser_download_url: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v0.6.4/ZERO-ONE-0.6.4-win-x64.exe", size: 1234, digest: `sha256:${"a".repeat(64)}` },
            { name: "SHA256SUMS.txt", browser_download_url: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v0.6.4/SHA256SUMS.txt", size: 100, digest: `sha256:${"b".repeat(64)}` },
          ],
        }),
      };
    },
  });

  assert.equal(request.url, LATEST_RELEASE_API);
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.redirect, "error");
  assert.match(request.options.headers["User-Agent"], /^ZERO-ONE\//);
  assert.deepEqual(result, {
    status: "available",
    updateAvailable: true,
    currentVersion: "0.6.3",
    latestVersion: "0.6.4",
    releaseUrl: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v0.6.4",
    assetName: "ZERO-ONE-0.6.4-win-x64.exe",
    assetUrl: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v0.6.4/ZERO-ONE-0.6.4-win-x64.exe",
    assetSize: 1234,
    assetDigest: "a".repeat(64),
    checksumUrl: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v0.6.4/SHA256SUMS.txt",
    installSupported: true,
    checkedAt: "2026-08-09T12:00:00.000Z",
  });
});

test("draft, prerelease, and non-official release URLs are never offered", async () => {
  for (const payload of [
    { tag_name: "v0.6.4", draft: true, prerelease: false, html_url: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v0.6.4" },
    { tag_name: "v0.6.4", draft: false, prerelease: true, html_url: "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v0.6.4" },
    { tag_name: "v0.6.4", draft: false, prerelease: false, html_url: "https://example.invalid/download" },
  ]) {
    const result = await checkLatestStableRelease({
      currentVersion: "0.6.3",
      fetchImpl: async () => ({ ok: true, json: async () => payload }),
    });
    assert.equal(result.status, "unavailable");
    assert.equal(result.updateAvailable, false);
    assert.equal(result.releaseUrl, "");
    assert.equal(result.installSupported, false);
  }
});

test("network failures and timeouts stay non-blocking", async () => {
  const failed = await checkLatestStableRelease({
    currentVersion: "0.6.3",
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(failed.status, "unavailable");

  const timedOut = await checkLatestStableRelease({
    currentVersion: "0.6.3",
    timeoutMs: 250,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }),
  });
  assert.equal(timedOut.status, "unavailable");
  assert.equal(timedOut.updateAvailable, false);
});
