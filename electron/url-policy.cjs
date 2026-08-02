function parseAllowedUrl(value, allowedOrigins) {
  try {
    const url = new URL(String(value || "").trim());
    if (!allowedOrigins.has(url.origin) || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function isAllowedUrl(value, allowedOrigins) {
  return Boolean(parseAllowedUrl(value, allowedOrigins));
}

function cleanConfiguredUrl(value, fallback, allowedOrigins) {
  const url = parseAllowedUrl(value, allowedOrigins);
  if (!url || url.hash) return fallback;
  for (const [key, entryValue] of url.searchParams) {
    if (key !== "_task" || entryValue !== "workspace") return fallback;
  }
  return url.toString();
}

function diagnosticOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "invalid";
  }
}

module.exports = { cleanConfiguredUrl, diagnosticOrigin, isAllowedUrl, parseAllowedUrl };
