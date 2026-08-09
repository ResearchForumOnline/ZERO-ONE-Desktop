const fs = require("node:fs/promises");
const path = require("node:path");

/**
 * Encrypted workspace login store for embedded webviews (ZMail, etc.).
 * Credentials are encrypted with Electron safeStorage. There is deliberately
 * no plaintext or base64 fallback when the operating-system vault is absent.
 */

function loginStorePath(userDataPath) {
  return path.join(userDataPath, "workspace-logins.json");
}

function isSafeOrigin(origin, allowedOrigins) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && !["http://127.0.0.1:1024", "http://localhost:1024"].includes(url.origin)) {
      return false;
    }
    return allowedOrigins.has(url.origin);
  } catch {
    return false;
  }
}

function cleanUsername(value) {
  return String(value || "").trim().slice(0, 254);
}

function cleanPassword(value) {
  // Cap length; never log this value.
  return String(value || "").slice(0, 512);
}

async function readStore(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return { version: 1, entries: {} };
  }
}

async function writeStore(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
}

function isSecureCredentialStorage(safeStorage) {
  if (!safeStorage?.isEncryptionAvailable?.()) return false;
  const backend = safeStorage.getSelectedStorageBackend?.();
  return backend !== "basic_text";
}

function encryptSecret(safeStorage, plain) {
  if (!plain) return "";
  if (!isSecureCredentialStorage(safeStorage)) throw new Error("Secure operating-system credential storage is unavailable; the login was not saved.");
  return safeStorage.encryptString(plain).toString("base64");
}

function decryptSecret(safeStorage, encoded) {
  if (!encoded) return "";
  try {
    if (!isSecureCredentialStorage(safeStorage)) return "";
    return safeStorage.decryptString(Buffer.from(encoded, "base64"));
  } catch {
    return "";
  }
}

async function saveLogin({ userDataPath, safeStorage, allowedOrigins, origin, username, password }) {
  const cleanOrigin = String(origin || "").trim();
  if (!isSafeOrigin(cleanOrigin, allowedOrigins)) throw new Error("That site is not allowed for saved logins.");
  const user = cleanUsername(username);
  const pass = cleanPassword(password);
  if (!user || !pass) throw new Error("Username and password are required to save a login.");
  const filePath = loginStorePath(userDataPath);
  const store = await readStore(filePath);
  store.entries = store.entries || {};
  store.entries[cleanOrigin] = {
    username: user,
    passwordEncrypted: encryptSecret(safeStorage, pass),
    updatedAt: new Date().toISOString(),
  };
  await writeStore(filePath, store);
  return { origin: cleanOrigin, username: user };
}

async function loadLogin({ userDataPath, safeStorage, allowedOrigins, origin }) {
  const cleanOrigin = String(origin || "").trim();
  if (!isSafeOrigin(cleanOrigin, allowedOrigins)) return null;
  const store = await readStore(loginStorePath(userDataPath));
  const entry = store.entries?.[cleanOrigin];
  if (!entry) return null;
  const password = decryptSecret(safeStorage, entry.passwordEncrypted);
  if (!password) return null;
  return { origin: cleanOrigin, username: cleanUsername(entry.username), password };
}

async function deleteLogin({ userDataPath, origin }) {
  const cleanOrigin = String(origin || "").trim();
  const filePath = loginStorePath(userDataPath);
  const store = await readStore(filePath);
  if (store.entries?.[cleanOrigin]) {
    delete store.entries[cleanOrigin];
    await writeStore(filePath, store);
  }
  return true;
}

async function listLogins({ userDataPath }) {
  const store = await readStore(loginStorePath(userDataPath));
  return Object.entries(store.entries || {}).map(([origin, entry]) => ({
    origin,
    username: cleanUsername(entry.username),
    updatedAt: entry.updatedAt || "",
  }));
}

async function clearAllLogins({ userDataPath }) {
  await fs.rm(loginStorePath(userDataPath), { force: true });
  return true;
}

/** Build inject script: user-triggered fill + explicit save consent. */
function buildLoginAssistScript(saved, options = {}) {
  const payload = JSON.stringify(saved || null);
  const canSave = options.canSave === true;
  // Credentials never go through console.log (avoids DevTools / log leakage).
  // Main process receives ZERO_ONE_SAVE_LOGIN_SIGNAL then reads window.__zeroOnePendingLogin.
  return `(() => {
    if (window.__zeroOneLoginAssist) return true;
    window.__zeroOneLoginAssist = true;
    const saved = ${payload};
    const canSave = ${JSON.stringify(canSave)};
    const saveApprovedForms = new WeakSet();

    function findLoginForms() {
      const forms = Array.from(document.querySelectorAll("form"));
      return forms.filter((form) => {
        const pass = form.querySelector('input[type="password"]');
        if (!pass) return false;
        const user = form.querySelector('input[type="email"], input[type="text"], input[name*="user" i], input[name*="login" i], input[name="_user"], input[autocomplete="username"]');
        return Boolean(user);
      });
    }

    function pickUserInput(form) {
      return form.querySelector('input[type="email"], input[autocomplete="username"], input[name="_user"], input[name*="user" i], input[name*="login" i], input[type="text"]');
    }

    function fill(form) {
      if (!saved || !saved.username || !saved.password) return;
      const user = pickUserInput(form);
      const pass = form.querySelector('input[type="password"]');
      if (!user || !pass) return;
      const set = (el, value) => {
        const proto = window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        if (desc && desc.set) desc.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      if (!user.value) set(user, saved.username);
      if (!pass.value) set(pass, saved.password);
    }

    function captureFromForm(form) {
      try {
        const consent = form.querySelector('input[data-zero-one-save-login-consent="1"]');
        if (!canSave || !consent || !consent.checked || !saveApprovedForms.has(form)) return;
        const user = pickUserInput(form);
        const pass = form.querySelector('input[type="password"]');
        if (!user || !pass || !user.value || !pass.value) return;
        window.__zeroOnePendingLogin = {
          origin: location.origin,
          username: user.value,
          password: pass.value
        };
        console.log("ZERO_ONE_SAVE_LOGIN_SIGNAL");
      } catch (_) {}
    }

    function addControls(form) {
      if (form.querySelector('[data-zero-one-login-controls="1"]')) return;
      if (!saved && !canSave) return;
      const controls = document.createElement('div');
      controls.dataset.zeroOneLoginControls = '1';
      controls.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0;padding:9px 10px;border:1px solid rgba(50,120,200,.28);border-radius:8px;background:rgba(50,120,200,.06);font:13px system-ui,sans-serif;';
      if (saved && saved.username && saved.password) {
        const fillButton = document.createElement('button');
        fillButton.type = 'button';
        fillButton.textContent = 'Fill saved ZERO ONE login';
        fillButton.dataset.zeroOneFillLogin = '1';
        fillButton.addEventListener('click', (event) => { if (event.isTrusted) fill(form); });
        controls.appendChild(fillButton);
      }
      if (canSave) {
        const label = document.createElement('label');
        label.style.cssText = 'display:inline-flex;align-items:center;gap:7px;cursor:pointer;';
        const consent = document.createElement('input');
        consent.type = 'checkbox';
        consent.checked = false;
        consent.autocomplete = 'off';
        consent.dataset.zeroOneSaveLoginConsent = '1';
        consent.addEventListener('change', (event) => {
          if (event.isTrusted && consent.checked) saveApprovedForms.add(form);
          else saveApprovedForms.delete(form);
        });
        const text = document.createElement('span');
        text.textContent = saved ? 'Update saved login on this PC' : 'Save login in ZERO ONE on this PC';
        label.append(consent, text);
        controls.appendChild(label);
      }
      const submit = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submit && submit.parentNode) submit.parentNode.insertBefore(controls, submit);
      else form.appendChild(controls);
    }

    function bind(form) {
      if (form.dataset.zeroOneBound) return;
      form.dataset.zeroOneBound = "1";
      addControls(form);
      form.addEventListener("submit", () => captureFromForm(form), true);
      const pass = form.querySelector('input[type="password"]');
      if (pass) {
        pass.addEventListener("keydown", (event) => {
          if (event.key === "Enter") captureFromForm(form);
        }, true);
      }
      const buttons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
      buttons.forEach((btn) => {
        btn.addEventListener("click", () => captureFromForm(form), true);
      });
    }

    function scan() {
      findLoginForms().forEach(bind);
    }
    scan();
    const obs = new MutationObserver(() => scan());
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(scan, 500);
    setTimeout(scan, 1500);
    setTimeout(scan, 4000);
    return true;
  })();`;
}

module.exports = {
  saveLogin,
  loadLogin,
  deleteLogin,
  listLogins,
  clearAllLogins,
  buildLoginAssistScript,
  isSecureCredentialStorage,
  isSafeOrigin,
  loginStorePath,
};
