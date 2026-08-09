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
    checkedAt: checkedAt(now),
  };
}

async function checkLatestStableRelease({
  currentVersion,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = Date.now(),
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
    return {
      status: updateAvailable ? "available" : "current",
      updateAvailable,
      currentVersion: current.join("."),
      latestVersion: latest.join("."),
      releaseUrl,
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
};
