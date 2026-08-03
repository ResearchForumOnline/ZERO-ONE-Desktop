function latestPhpSessionId(headerValues = []) {
  let latest = "";
  for (const rawValue of headerValues) {
    const value = String(rawValue || "");
    const matcher = /(?:^|,\s*)PHPSESSID=([A-Za-z0-9,-]{16,128})(?=;|,|$)/gi;
    for (const match of value.matchAll(matcher)) latest = match[1];
  }
  return latest;
}

module.exports = { latestPhpSessionId };
