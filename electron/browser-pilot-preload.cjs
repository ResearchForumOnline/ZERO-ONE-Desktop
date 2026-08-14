const { ipcRenderer } = require("electron");

const state = { grantId: "", snapshotId: "", elements: new Map(), overlay: null };
const INTERACTIVE_SELECTOR = ["a[href]", "button", "input:not([type='hidden'])", "textarea", "select", "summary", "[role='button']", "[role='link']", "[contenteditable='true']"].join(",");
const RISKY_LABEL_RE = /\b(?:accept|apply|approve|archive|authorize|book|buy|cancel(?:\s+(?:account|plan|subscription))?|checkout|commit|confirm|delete|grant|install|log\s*(?:in|out)|merge|order|pay|post|publish|purchase|remove|reply|reserve|save|send|sign(?:\s+(?:in|up))?|submit|subscribe|transfer|upload)\b/i;

function clean(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function randomId(prefix) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function visible(element) {
  if (!(element instanceof Element) || !element.isConnected) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.opacity || "1") >= 0.02 && rect.width > 1 && rect.height > 1;
}

function labelFor(element) {
  const aria = element.getAttribute("aria-label");
  if (aria) return clean(aria, 180);
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const value = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ");
    if (value.trim()) return clean(value, 180);
  }
  if (element.labels?.length) return clean(Array.from(element.labels).map((entry) => entry.textContent || "").join(" "), 180);
  if ("value" in element || element.isContentEditable) return clean(element.getAttribute("placeholder") || element.getAttribute("title") || element.getAttribute("name") || "", 180);
  return clean(element.getAttribute("placeholder") || element.getAttribute("title") || element.textContent || element.getAttribute("name") || "", 180);
}

function sensitiveKind(element, label) {
  const type = clean(element.getAttribute("type"), 40).toLowerCase();
  const autocomplete = clean(element.getAttribute("autocomplete"), 120).toLowerCase();
  const identity = `${type} ${autocomplete} ${clean(element.getAttribute("name"), 120)} ${clean(element.id, 120)} ${String(label).toLowerCase()}`;
  if (type === "file") return "file";
  if (/\b(?:captcha|hcaptcha|recaptcha|turnstile|not\s+a\s+robot)\b/.test(identity)) return "captcha";
  if (type === "password" || /\b(?:password|passcode|one-time-code|otp)\b/.test(identity)) return "password";
  if (/\b(?:cc-number|cc-csc|cc-exp|credit\s*card|card\s*number|cvv|cvc|payment)\b/.test(identity)) return "payment";
  if (/\b(?:api[-_ ]?key|private[-_ ]?key|secret|access[-_ ]?token|auth[-_ ]?token)\b/.test(identity)) return "secret";
  if (["email", "tel"].includes(type) || ["email", "tel", "street-address", "address-line1", "address-line2", "postal-code", "country", "name", "given-name", "family-name", "bday"].some((marker) => autocomplete.split(/\s+/).includes(marker)) || /\b(?:address|birthday|date\s+of\s+birth|email|full\s+name|phone|postcode|postal\s+code)\b/.test(identity)) return "personal";
  return "";
}

function descriptor(element, id) {
  const label = labelFor(element);
  const text = "value" in element || element.isContentEditable ? "" : clean(element.textContent, 180);
  const kind = sensitiveKind(element, label);
  const href = element instanceof HTMLAnchorElement ? clean(element.href, 400) : "";
  const isSubmit = (element instanceof HTMLInputElement && ["submit", "image"].includes(element.type)) || (element instanceof HTMLButtonElement && Boolean(element.form) && (!element.getAttribute("type") || element.type === "submit"));
  return {
    id,
    tag: element.tagName.toLowerCase(),
    role: clean(element.getAttribute("role"), 32),
    type: clean(element.getAttribute("type"), 32),
    label,
    text,
    href,
    disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
    checked: typeof element.checked === "boolean" ? element.checked : undefined,
    has_value: "value" in element ? Boolean(element.value) : Boolean(element.textContent?.trim()),
    sensitive_kind: kind,
    risk: isSubmit || RISKY_LABEL_RE.test(`${label} ${text}`) ? "consequential" : "ordinary",
    options: element instanceof HTMLSelectElement ? Array.from(element.options).slice(0, 20).map((option, index) => ({ value: `o${index + 1}`, label: clean(option.textContent, 120) })) : undefined,
  };
}

function visiblePageText() {
  if (!document.body) return "";
  const parts = [];
  let length = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node && length < 8000; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest("input,textarea,select,[contenteditable='true'],script,style,noscript,template,[aria-hidden='true']") || !visible(parent)) continue;
    const text = clean(node.nodeValue, Math.min(500, 8000 - length));
    if (!text) continue;
    parts.push(text);
    length += text.length + 1;
  }
  return clean(parts.join(" "), 8000);
}

function inspect(grantId) {
  if (!grantId || grantId !== state.grantId) throw new Error("The Browser Pilot grant is no longer active.");
  state.snapshotId = randomId("snap");
  state.elements.clear();
  const interactive = [];
  for (const element of Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR))) {
    if (!visible(element) || interactive.length >= 60) continue;
    const id = `e${interactive.length + 1}`;
    state.elements.set(id, element);
    interactive.push(descriptor(element, id));
  }
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).filter(visible).slice(0, 24).map((heading) => ({ level: Number(heading.tagName.slice(1)), text: clean(heading.textContent, 200) }));
  return {
    snapshot_id: state.snapshotId,
    url: location.href,
    title: clean(document.title, 300),
    text: visiblePageText(),
    headings,
    interactive,
    input_value_omitted: true,
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
  };
}

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("The target does not accept text.");
  setter.call(element, value);
}

async function execute(grantId, snapshotId, action) {
  if (!grantId || grantId !== state.grantId || !snapshotId || snapshotId !== state.snapshotId) throw new Error("The page changed; a new snapshot is required.");
  if (["click", "type", "select"].includes(action.action)) {
    const element = state.elements.get(action.element_id);
    if (!visible(element)) throw new Error("The target is stale or no longer visible.");
    const details = descriptor(element, action.element_id);
    if (["password", "payment", "secret", "file", "captcha"].includes(details.sensitive_kind)) throw new Error(`Browser Pilot blocks ${details.sensitive_kind} fields.`);
    if (details.disabled) throw new Error("The target is disabled.");
    element.scrollIntoView({ block: "center", inline: "nearest" });
    element.focus?.();
    if (action.action === "click") element.click();
    else if (action.action === "type") {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) setNativeValue(element, action.clear === false ? `${element.value}${action.text}` : action.text);
      else if (element.isContentEditable) element.textContent = action.clear === false ? `${element.textContent || ""}${action.text}` : action.text;
      else throw new Error("The target does not accept text.");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      if (!(element instanceof HTMLSelectElement)) throw new Error("The target is not a select control.");
      const optionIndex = /^o([1-9]\d*)$/.exec(String(action.value || ""));
      const option = optionIndex ? element.options[Number(optionIndex[1]) - 1] : null;
      if (!option) throw new Error("That select option is unavailable.");
      element.value = option.value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return `${action.action} completed; the next snapshot must confirm the result.`;
  }
  if (action.action === "navigate") { location.assign(action.url); return "Navigation started."; }
  if (action.action === "back") { history.back(); return "Back navigation started."; }
  if (action.action === "forward") { history.forward(); return "Forward navigation started."; }
  if (action.action === "scroll") {
    const amount = action.direction === "up" ? -action.amount : action.amount;
    if (action.direction === "top") scrollTo({ top: 0, behavior: "smooth" });
    else if (action.direction === "bottom") scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    else scrollBy({ top: amount, behavior: "smooth" });
    return `Scrolled ${action.direction}.`;
  }
  if (action.action === "wait") { await new Promise((resolve) => setTimeout(resolve, action.ms)); return `Waited ${action.ms} ms.`; }
  throw new Error("Unsupported page action.");
}

function overlay(status, message) {
  if (!state.overlay) {
    const host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;right:14px;bottom:14px;z-index:2147483647";
    const root = host.attachShadow({ mode: "closed" });
    const card = document.createElement("div");
    card.innerHTML = '<strong data-title>ZERO ONE PILOT</strong><span data-message></span><button type="button">STOP & REVOKE</button>';
    card.style.cssText = "font:12px/1.35 system-ui;color:#eafff3;background:#07120d;border:1px solid #00ff85;border-radius:12px;padding:11px;box-shadow:0 12px 40px #000a;display:grid;gap:7px;max-width:290px";
    card.querySelector("button").style.cssText = "font:700 10px system-ui;color:#07120d;background:#00ff85;border:0;border-radius:8px;padding:7px;cursor:pointer";
    card.querySelector("button").addEventListener("click", () => ipcRenderer.send("zero-one-pilot:overlay-stop"));
    root.append(card);
    document.documentElement.append(host);
    state.overlay = { host, card };
  }
  state.overlay.card.querySelector("[data-title]").textContent = `ZERO ONE PILOT · ${clean(status, 24).toUpperCase()}`;
  state.overlay.card.querySelector("[data-message]").textContent = clean(message, 220);
}

function revoke() {
  state.grantId = "";
  state.snapshotId = "";
  state.elements.clear();
  state.overlay?.host.remove();
  state.overlay = null;
}

ipcRenderer.on("zero-one-pilot:command", async (_event, message) => {
  const requestId = String(message?.requestId || "");
  try {
    let result;
    if (message.command === "grant") {
      revoke();
      state.grantId = String(message.grantId || "");
      if (!state.grantId) throw new Error("A grant is required.");
      overlay("granted", "This exact tab is available to the governed Browser Pilot.");
      result = { granted: true, url: location.href };
    } else if (message.command === "inspect") result = inspect(String(message.grantId || ""));
    else if (message.command === "execute") result = await execute(String(message.grantId || ""), String(message.snapshotId || ""), message.action || {});
    else if (message.command === "overlay") { overlay(message.status || "active", message.message || ""); result = true; }
    else if (message.command === "revoke") { revoke(); result = true; }
    else throw new Error("Unknown Browser Pilot command.");
    ipcRenderer.send("zero-one-pilot:response", { requestId, ok: true, result });
  } catch (error) {
    ipcRenderer.send("zero-one-pilot:response", { requestId, ok: false, error: clean(error?.message || error, 500) });
  }
});
