const ZMAIL_WORKSPACE_ORIGINS = Object.freeze(new Set([
  "https://webmail.zmail.my",
  "https://mail.zmail.my",
  "https://www.zmail.talktoai.org",
  "https://zmail.my",
]));

const ZSIGN_ORIGIN = "https://zsign.zmail.my";

function parsedUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function isZmailWorkspaceUrl(value) {
  const url = parsedUrl(value);
  return Boolean(url && url.protocol === "https:" && ZMAIL_WORKSPACE_ORIGINS.has(url.origin));
}

function isZmailZsignSsoUrl(value) {
  const url = parsedUrl(value);
  if (!url || url.protocol !== "https:" || !ZMAIL_WORKSPACE_ORIGINS.has(url.origin) || url.hash) return false;
  const query = Array.from(url.searchParams.entries());
  return url.pathname === "/"
    && query.length === 2
    && url.searchParams.getAll("_task").length === 1
    && url.searchParams.getAll("_action").length === 1
    && url.searchParams.get("_task") === "workspace"
    && url.searchParams.get("_action") === "plugin.zmail-zsign-sso";
}

module.exports = {
  ZMAIL_WORKSPACE_ORIGINS,
  ZSIGN_ORIGIN,
  isZmailWorkspaceUrl,
  isZmailZsignSsoUrl,
};
