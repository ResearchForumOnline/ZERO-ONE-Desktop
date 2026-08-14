import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site", "talktoai-zero-one");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const status = JSON.parse(await readFile(path.join(site, "status.json"), "utf8"));
const page = await readFile(path.join(site, "index.html"), "utf8");
const install = await readFile(path.join(site, "install", "index.html"), "utf8");
const qrManifest = JSON.parse(await readFile(path.join(site, "install", "qr", "targets.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function pngDimensions(buffer) {
  const signature = "89504e470d0a1a0a";
  assert(buffer.subarray(0, 8).toString("hex") === signature, "QR asset is not a PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const version = status.desktop.version;
const sourceVersion = packageJson.version;
const releaseRoot = `https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases`;
const releaseUrl = `${releaseRoot}/tag/v${version}`;
const assetRoot = `${releaseRoot}/download/v${version}`;
const expectedAssets = [
  `ZERO-ONE-${version}-win-x64.exe`,
  `ZERO-ONE-${version}-mac-arm64.dmg`,
  `ZERO-ONE-${version}-mac-arm64.zip`,
  `ZERO-ONE-${version}-linux-x86_64.AppImage`,
  `ZERO-ONE-${version}-linux-amd64.deb`,
];

assert(/^\d+\.\d+\.\d+$/.test(sourceVersion), "package.json desktop version is invalid");
assert(/^\d+\.\d+\.\d+$/.test(version), "status.json desktop version is invalid");
assert(status.desktop.release === releaseUrl, "status.json release URL is stale");
assert(status.desktop.windows === `${assetRoot}/${expectedAssets[0]}`, "status.json Windows URL is stale");
assert(/^[a-f0-9]{64}$/.test(status.desktop.sha256_windows), "status.json Windows SHA-256 is invalid");
assert(page.includes(`"softwareVersion":"${version}"`), "landing-page structured version is stale");
assert(page.includes(`"downloadUrl":"${releaseUrl}"`), "landing-page structured release URL is stale");
assert(page.includes(`Desktop ${version}`), "landing page does not show the current desktop version");
assert(install.includes(`Desktop ${version}`), "install page does not show the current desktop version");
assert(install.toLowerCase().includes(status.desktop.sha256_windows), "install-page SHA-256 differs from status.json");
for (const asset of expectedAssets) assert(page.includes(`${assetRoot}/${asset}`), `landing page is missing ${asset}`);
assert(install.includes(status.desktop.windows), "install page Windows URL differs from status.json");
assert(page.includes(`${assetRoot}/SHA256SUMS.txt`) && install.includes(`${assetRoot}/SHA256SUMS.txt`), "checksum URL is stale");
const desktopReleaseVersions = [...`${page}\n${install}`.matchAll(/ZERO-ONE-(\d+\.\d+\.\d+)-(?:win|mac|linux)-/g)].map((match) => match[1]);
assert(desktopReleaseVersions.length >= expectedAssets.length, "current pages are missing desktop release assets");
assert(desktopReleaseVersions.every((candidate) => candidate === version), "current pages mix desktop release versions");
assert(!page.includes("Qwen3 1.7B and legacy Gemma E4B are manual alternatives"), "quality-rejected Qwen copy returned");

for (const [name, record] of Object.entries(qrManifest.files)) {
  const qrPath = path.join(site, "install", "qr", name);
  const data = await readFile(qrPath);
  const dimensions = pngDimensions(data);
  assert(dimensions.width >= 256 && dimensions.height >= 256, `${name} is too small for reliable scanning`);
  assert(sha256(data) === record.sha256, `${name} differs from its reviewed QR manifest`);
  assert(/^https:\/\/talktoai\.org\/ZeroOne\//.test(record.target), `${name} target is not a stable ZERO ONE URL`);
}

console.log(`ZERO_ONE_SITE_OK published=${version} source=${sourceVersion} ${expectedAssets.length} release assets ${Object.keys(qrManifest.files).length} QR manifests`);
