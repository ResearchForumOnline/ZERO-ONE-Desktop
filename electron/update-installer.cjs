const { createHash } = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const RELEASE_DOWNLOAD_PREFIX = "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/";
const MAX_PACKAGE_BYTES = 600 * 1024 * 1024;

function parseSha256Sums(text) {
  const entries = new Map();
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = /^([a-fA-F0-9]{64})\s+\*?([^\\/]+)$/.exec(line.trim());
    if (match) entries.set(match[2], match[1].toLowerCase());
  }
  return entries;
}

function safeUpdateFilename(value) {
  const name = String(value || "");
  if (!/^ZERO-ONE-\d+\.\d+\.\d+-(?:win-x64\.exe|mac-arm64\.dmg|linux-x86_64\.AppImage)$/.test(name)) {
    throw new Error("The release did not contain a recognized ZERO ONE package.");
  }
  return name;
}

async function fetchTextLimited(url, { fetchImpl = fetch, maxBytes = 1024 * 1024, signal } = {}) {
  if (!String(url || "").startsWith(RELEASE_DOWNLOAD_PREFIX)) throw new Error("Refusing verification data outside the official ZERO ONE release channel.");
  const response = await fetchImpl(url, { method: "GET", redirect: "follow", signal, headers: { "User-Agent": "ZERO-ONE-Updater/1" } });
  if (!response.ok) throw new Error(`Update verification returned HTTP ${response.status}.`);
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (declared > maxBytes) throw new Error("Update verification file is unexpectedly large.");
  const text = await response.text();
  if (Buffer.byteLength(text) > maxBytes) throw new Error("Update verification file is unexpectedly large.");
  return text;
}

async function downloadVerifiedAsset({ assetUrl, destination, expectedBytes, expectedSha256, fetchImpl = fetch, signal, onProgress = () => {} }) {
  if (!String(assetUrl || "").startsWith(RELEASE_DOWNLOAD_PREFIX)) throw new Error("Refusing a package outside the official ZERO ONE release channel.");
  const expectedSize = Number(expectedBytes);
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize > MAX_PACKAGE_BYTES) throw new Error("The update package size is invalid.");
  if (!/^[a-f0-9]{64}$/.test(String(expectedSha256 || ""))) throw new Error("The update checksum is invalid.");
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const partial = `${destination}.partial`;
  await fsp.rm(partial, { force: true });
  await fsp.rm(destination, { force: true });
  const response = await fetchImpl(assetUrl, { method: "GET", redirect: "follow", signal, headers: { "User-Agent": "ZERO-ONE-Updater/1", Accept: "application/octet-stream" } });
  if (!response.ok || !response.body) throw new Error(`Update download returned HTTP ${response.status}.`);
  const hash = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_PACKAGE_BYTES || bytes > expectedSize) return callback(new Error("The update exceeded its verified size."));
      hash.update(chunk);
      onProgress({ completed: bytes, total: expectedSize, percent: Math.min(100, Math.round((bytes / expectedSize) * 100)) });
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(partial, { flags: "wx", mode: 0o600 }));
    if (bytes !== expectedSize) throw new Error(`The update size did not match (${bytes} of ${expectedSize} bytes).`);
    const actualSha256 = hash.digest("hex");
    if (actualSha256 !== expectedSha256) throw new Error("The update checksum did not match. Nothing was installed.");
    await fsp.rename(partial, destination);
    return { path: destination, bytes, sha256: actualSha256 };
  } catch (error) {
    await fsp.rm(partial, { force: true }).catch(() => {});
    throw error;
  }
}

module.exports = { MAX_PACKAGE_BYTES, RELEASE_DOWNLOAD_PREFIX, downloadVerifiedAsset, fetchTextLimited, parseSha256Sums, safeUpdateFilename };
