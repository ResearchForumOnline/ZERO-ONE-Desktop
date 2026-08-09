function latestPhpSessionId(headerValues = []) {
  return latestPhpSessionCookie(headerValues)?.value || "";
}

function latestPhpSessionCookie(headerValues = []) {
  let latest = null;
  for (const rawValue of headerValues) {
    const value = String(rawValue || "");
    const matcher = /(?:^|,\s*)PHPSESSID=([A-Za-z0-9,-]{16,128})(?=;|,|$)/gi;
    const matches = [...value.matchAll(matcher)];
    for (const match of matches) {
      const cookieStart = Number(match.index || 0) + match[0].indexOf("PHPSESSID=");
      const after = value.slice(cookieStart);
      const nextCookie = /,\s*(?=[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/.exec(after);
      const rawCookie = nextCookie ? after.slice(0, nextCookie.index) : after;
      const attributes = new Map();
      for (const part of rawCookie.split(";").slice(1)) {
        const [rawName, ...rawAttributeValue] = part.trim().split("=");
        if (rawName) attributes.set(rawName.toLowerCase(), rawAttributeValue.join("=").trim());
      }
      const maxAge = Number(attributes.get("max-age"));
      let expirationDate;
      if (attributes.has("max-age") && Number.isFinite(maxAge)) expirationDate = Math.floor(Date.now() / 1000) + maxAge;
      else if (attributes.has("expires")) {
        const expiresAt = Date.parse(attributes.get("expires"));
        if (Number.isFinite(expiresAt)) expirationDate = Math.floor(expiresAt / 1000);
      }
      const sameSiteValue = String(attributes.get("samesite") || "").toLowerCase();
      latest = {
        value: match[1],
        path: String(attributes.get("path") || "/").startsWith("/") ? String(attributes.get("path") || "/") : "/",
        secure: attributes.has("secure"),
        httpOnly: attributes.has("httponly"),
        sameSite: sameSiteValue === "strict" ? "strict" : sameSiteValue === "none" ? "no_restriction" : sameSiteValue === "lax" ? "lax" : "unspecified",
        ...(expirationDate === undefined ? {} : { expirationDate }),
      };
    }
  }
  return latest;
}

module.exports = { latestPhpSessionId, latestPhpSessionCookie };
