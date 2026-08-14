const PILOT_ACTIONS = new Set(["finish", "navigate", "click", "type", "select", "scroll", "wait", "back", "forward"]);
const ELEMENT_ID_RE = /^e[1-9]\d{0,3}$/;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const RISKY_LABEL_RE = /\b(?:accept|apply|approve|archive|authorize|book|buy|cancel(?:\s+(?:account|plan|subscription))?|checkout|commit|confirm|delete|grant|install|log\s*(?:in|out)|merge|order|pay|post|publish|purchase|remove|reply|reserve|save|send|sign(?:\s+(?:in|up))?|submit|subscribe|transfer|upload)\b/i;
const BLOCKED_SENSITIVE_KINDS = new Set(["password", "payment", "secret", "file", "captcha"]);

function clip(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeHttpUrl(value, base = undefined) {
  const parsed = new URL(String(value || ""), base);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Browser Pilot accepts only credential-free HTTP(S) addresses.");
  }
  return parsed.href;
}

function normalizeApiOrigin(value) {
  const parsed = new URL(normalizeHttpUrl(value));
  if (parsed.protocol === "http:" && !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("OpenZero must use HTTPS, or HTTP through loopback.");
  }
  if (parsed.search || parsed.hash) throw new Error("OpenZero API address cannot contain a query or fragment.");
  return parsed.origin;
}

function redactSnapshotUrl(value) {
  const parsed = new URL(normalizeHttpUrl(value));
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.split("/").map((segment) => {
    if (segment.length > 48 || /(?:^|[-_])[A-Za-z0-9_-]{32,}(?:$|[-_])/.test(segment)) return "redacted";
    return segment;
  }).join("/");
  return parsed.href;
}

function normalizeBrowserAction(rawAction, currentUrl) {
  if (!rawAction || typeof rawAction !== "object" || Array.isArray(rawAction)) {
    throw new Error("OpenZero must return one browser action object.");
  }
  const action = clip(rawAction.action, 32).toLowerCase();
  if (!PILOT_ACTIONS.has(action)) throw new Error(`Unsupported browser action: ${action || "missing"}.`);
  const result = { action, reason: clip(rawAction.reason, 240) };
  if (action === "finish") return { ...result, message: clip(rawAction.message, 1600) || "Task finished." };
  if (action === "navigate") return { ...result, url: normalizeHttpUrl(rawAction.url, currentUrl) };
  if (["click", "type", "select"].includes(action)) {
    const elementId = clip(rawAction.element_id, 16);
    if (!ELEMENT_ID_RE.test(elementId)) throw new Error("A current element_id such as e3 is required.");
    result.element_id = elementId;
  }
  if (action === "type") {
    if (typeof rawAction.text !== "string" || rawAction.text.length > 4000) throw new Error("Type actions require at most 4,000 characters.");
    return { ...result, text: rawAction.text, clear: rawAction.clear !== false };
  }
  if (action === "select") {
    const value = clip(rawAction.value, 500);
    if (!value) throw new Error("Select actions require a value.");
    return { ...result, value };
  }
  if (action === "scroll") {
    const direction = clip(rawAction.direction, 16).toLowerCase() || "down";
    if (!["up", "down", "top", "bottom"].includes(direction)) throw new Error("Unsupported scroll direction.");
    const amount = Number.parseInt(rawAction.amount, 10);
    return { ...result, direction, amount: Number.isFinite(amount) ? Math.max(100, Math.min(amount, 2000)) : 700 };
  }
  if (action === "wait") {
    const ms = Number.parseInt(rawAction.ms, 10);
    return { ...result, ms: Number.isFinite(ms) ? Math.max(100, Math.min(ms, 5000)) : 750 };
  }
  return result;
}

function findElement(snapshot, elementId) {
  return (Array.isArray(snapshot?.interactive) ? snapshot.interactive : []).find((entry) => entry?.id === elementId) || null;
}

function sameOrigin(left, right) {
  try { return new URL(left).origin === new URL(right).origin; }
  catch { return false; }
}

function actionPreview(action, snapshot) {
  const element = action.element_id ? findElement(snapshot, action.element_id) : null;
  const label = clip(element?.label || element?.text || action.element_id, 100);
  if (action.action === "navigate") return `Navigate to ${action.url}`;
  if (action.action === "click") return `Click ${label}`;
  if (action.action === "type") return `Type ${String(action.text || "").length} character(s) into ${label}`;
  if (action.action === "select") return `Choose an option in ${label}`;
  if (action.action === "scroll") return `Scroll ${action.direction}`;
  if (action.action === "wait") return `Wait ${action.ms} ms`;
  if (action.action === "back") return "Go back";
  if (action.action === "forward") return "Go forward";
  return clip(action.message, 160) || "Finish";
}

function classifyBrowserAction(action, snapshot) {
  const decision = { allowed: true, needsApproval: false, reason: "", preview: actionPreview(action, snapshot) };
  if (["finish", "wait", "scroll"].includes(action.action)) return decision;
  if (action.action === "navigate" && !sameOrigin(snapshot?.url, action.url)) {
    return { ...decision, needsApproval: true, reason: "The action crosses to a new site." };
  }
  if (["click", "type", "select"].includes(action.action)) {
    const element = findElement(snapshot, action.element_id);
    if (!element) return { ...decision, allowed: false, reason: "The target is not in the current snapshot." };
    if (BLOCKED_SENSITIVE_KINDS.has(String(element.sensitive_kind || ""))) {
      return { ...decision, allowed: false, reason: `Browser Pilot blocks ${element.sensitive_kind} fields.` };
    }
    if (element.disabled) return { ...decision, allowed: false, reason: "The target is disabled." };
    const descriptor = `${element.label || ""} ${element.text || ""}`;
    if (element.risk === "consequential" || RISKY_LABEL_RE.test(descriptor)) {
      decision.needsApproval = true;
      decision.reason = "This can cause a consequential action.";
    }
    if (["type", "select"].includes(action.action) && element.sensitive_kind === "personal") {
      decision.needsApproval = true;
      decision.reason = "This enters personal information.";
    }
    if (action.action === "click" && element.href && !sameOrigin(snapshot?.url, element.href)) {
      decision.needsApproval = true;
      decision.reason = "This link crosses to a new site.";
    }
  }
  return decision;
}

function compactSnapshot(snapshot) {
  return {
    snapshot_id: clip(snapshot?.snapshot_id, 80),
    url: redactSnapshotUrl(snapshot?.url),
    title: clip(snapshot?.title, 300),
    text: clip(snapshot?.text, 8000),
    headings: (Array.isArray(snapshot?.headings) ? snapshot.headings : []).slice(0, 24).map((entry) => ({ level: Number(entry?.level) || 0, text: clip(entry?.text, 200) })),
    interactive: (Array.isArray(snapshot?.interactive) ? snapshot.interactive : []).slice(0, 60).map((entry) => ({
      id: clip(entry?.id, 16), tag: clip(entry?.tag, 24), role: clip(entry?.role, 32), type: clip(entry?.type, 32),
      label: clip(entry?.label, 160), text: clip(entry?.text, 180), href: entry?.href ? redactSnapshotUrl(entry.href) : "", disabled: Boolean(entry?.disabled),
      checked: typeof entry?.checked === "boolean" ? entry.checked : undefined,
      has_value: typeof entry?.has_value === "boolean" ? entry.has_value : undefined,
      sensitive_kind: clip(entry?.sensitive_kind, 32), risk: clip(entry?.risk, 32),
      options: Array.isArray(entry?.options) ? entry.options.slice(0, 20).map((option) => ({ value: clip(option?.value, 120), label: clip(option?.label, 120) })) : undefined,
    })),
    viewport: snapshot?.viewport || {},
    input_value_omitted: true,
  };
}

async function requestBrowserPlan({ apiBaseUrl, apiKey, model, task, snapshot, step, history, signal, fetchImpl = fetch }) {
  const origin = normalizeApiOrigin(apiBaseUrl);
  if (!apiKey) throw new Error("Connect full OpenZero in Settings before using Browser Pilot.");
  const safeSnapshot = compactSnapshot(snapshot);
  const response = await fetchImpl(`${origin}/v1/browser/plan`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "User-Agent": "ZERO-ONE-Browser-Pilot/1" },
    body: JSON.stringify({
      model: clip(model, 200), task: clip(task, 3000), step,
      history: (Array.isArray(history) ? history : []).slice(-6).map((entry) => ({ action: clip(entry?.action, 32), result: clip(entry?.result, 500) })),
      snapshot: safeSnapshot,
    }),
    signal,
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(clip(payload?.error?.message || payload?.message || `OpenZero returned HTTP ${response.status}.`, 400));
    error.status = Number(response.status) || 0;
    throw error;
  }
  return normalizeBrowserAction(payload?.action, safeSnapshot.url);
}

module.exports = {
  actionPreview,
  classifyBrowserAction,
  compactSnapshot,
  normalizeApiOrigin,
  normalizeBrowserAction,
  normalizeHttpUrl,
  redactSnapshotUrl,
  requestBrowserPlan,
};
