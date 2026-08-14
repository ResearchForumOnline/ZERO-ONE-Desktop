const LATEST_RELEASE_API = "https://api.github.com/repos/ResearchForumOnline/ZERO-ONE-Desktop/releases/latest";
const RELEASE_TAG_PREFIX = "https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/";
const DEFAULT_TIMEOUT_MS = 5_000;

function parseStableVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value || "").trim());
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) return null;
  return parts;
}

function compareStableVersions(left, right) {
  const a = parseStableVersion(left);
  const b = parseStableVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function checkedAt(now) {
  const value = new Date(now);
  return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
}

function unavailableResult(currentVersion, now) {
  return {
    status: "unavailable",
    updateAvailable: false,
    currentVersion: String(currentVersion || ""),
    latestVersion: "",
    releaseUrl: "",
    assetName: "",
    assetUrl: "",
    assetSize: 0,
    assetDigest: "",
    checksumUrl: "",
    installSupported: false,
    checkedAt: checkedAt(now),
  };
}

function platformAssetName(version, platform, arch) {
  if (platform === "win32" && arch === "x64") return `ZERO-ONE-${version}-win-x64.exe`;
  if (platform === "darwin" && arch === "arm64") return `ZERO-ONE-${version}-mac-arm64.dmg`;
  if (platform === "linux" && arch === "x64") return `ZERO-ONE-${version}-linux-x86_64.AppImage`;
  return "";
}

function releaseAsset(payload, name, normalizedTag) {
  const expectedUrl = `https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/${normalizedTag}/${name}`;
  const matches = (Array.isArray(payload?.assets) ? payload.assets : []).filter((asset) => asset?.name === name && asset?.browser_download_url === expectedUrl);
  return matches.length === 1 ? matches[0] : null;
}

async function checkLatestStableRelease({
  currentVersion,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = Date.now(),
  platform = process.platform,
  arch = process.arch,
} = {}) {
  const current = parseStableVersion(currentVersion);
  if (!current || typeof fetchImpl !== "function") return unavailableResult(currentVersion, now);

  const controller = new AbortController();
  const boundedTimeout = Math.max(250, Math.min(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 15_000));
  const timer = setTimeout(() => controller.abort(), boundedTimeout);
  timer.unref?.();

  try {
    const response = await fetchImpl(LATEST_RELEASE_API, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": `ZERO-ONE/${String(currentVersion)}`,
      },
    });
    if (!response?.ok) return unavailableResult(currentVersion, now);

    const payload = await response.json();
    const tag = String(payload?.tag_name || "").trim();
    const latest = parseStableVersion(tag);
    if (!latest || payload?.draft !== false || payload?.prerelease !== false) {
      return unavailableResult(currentVersion, now);
    }

    const normalizedTag = `v${latest.join(".")}`;
    const releaseUrl = `${RELEASE_TAG_PREFIX}${normalizedTag}`;
    if (String(payload?.html_url || "") !== releaseUrl) return unavailableResult(currentVersion, now);

    const comparison = compareStableVersions(normalizedTag, currentVersion);
    const updateAvailable = comparison === 1;
    const version = latest.join(".");
    const assetName = platformAssetName(version, platform, arch);
    const asset = assetName ? releaseAsset(payload, assetName, normalizedTag) : null;
    const checksum = releaseAsset(payload, "SHA256SUMS.txt", normalizedTag);
    const assetDigest = /^sha256:[a-f0-9]{64}$/.test(String(asset?.digest || "")) ? String(asset.digest).slice(7) : "";
    const installSupported = Boolean(updateAvailable && asset && checksum && assetDigest && Number.isSafeInteger(Number(asset.size)) && Number(asset.size) > 0);
    return {
      status: updateAvailable ? "available" : "current",
      updateAvailable,
      currentVersion: current.join("."),
      latestVersion: version,
      releaseUrl,
      assetName: installSupported ? assetName : "",
      assetUrl: installSupported ? String(asset.browser_download_url) : "",
      assetSize: installSupported ? Number(asset.size) : 0,
      assetDigest: installSupported ? assetDigest : "",
      checksumUrl: installSupported ? String(checksum.browser_download_url) : "",
      installSupported,
      checkedAt: checkedAt(now),
    };
  } catch {
    return unavailableResult(currentVersion, now);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  LATEST_RELEASE_API,
  RELEASE_TAG_PREFIX,
  checkLatestStableRelease,
  compareStableVersions,
  parseStableVersion,
  platformAssetName,
  releaseAsset,
};
