const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { saveLogin, loadLogin, deleteLogin, listLogins, buildLoginAssistScript, clearAllLogins, isSecureCredentialStorage } = require("./workspace-logins.cjs");

const fakeSafe = {
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => "dpapi",
  encryptString: (plain) => Buffer.from(`encrypted:${plain}`, "utf8"),
  decryptString: (encoded) => Buffer.from(encoded).toString("utf8").replace(/^encrypted:/, ""),
};

test("workspace logins encrypt and round-trip", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zero-one-logins-"));
  const allowed = new Set(["https://webmail.zmail.my"]);
  await saveLogin({
    userDataPath: dir,
    safeStorage: fakeSafe,
    allowedOrigins: allowed,
    origin: "https://webmail.zmail.my",
    username: "user@zmail.my",
    password: "secret-pass",
  });
  const loaded = await loadLogin({
    userDataPath: dir,
    safeStorage: fakeSafe,
    allowedOrigins: allowed,
    origin: "https://webmail.zmail.my",
  });
  assert.equal(loaded.username, "user@zmail.my");
  assert.equal(loaded.password, "secret-pass");
  const listed = await listLogins({ userDataPath: dir });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].username, "user@zmail.my");
  await deleteLogin({ userDataPath: dir, origin: "https://webmail.zmail.my" });
  const after = await loadLogin({
    userDataPath: dir,
    safeStorage: fakeSafe,
    allowedOrigins: allowed,
    origin: "https://webmail.zmail.my",
  });
  assert.equal(after, null);
  await clearAllLogins({ userDataPath: dir });
  const script = buildLoginAssistScript({ username: "a", password: "b" }, { canSave: true });
  assert.match(script, /ZERO_ONE_SAVE_LOGIN_SIGNAL/);
  assert.match(script, /__zeroOnePendingLogin/);
  assert.match(script, /input\[type="password"\]/);
  assert.match(script, /data-zero-one-save-login-consent/);
  assert.match(script, /!consent\.checked/);
  assert.match(script, /saveApprovedForms\.has\(form\)/);
  assert.match(script, /event\.isTrusted && consent\.checked/);
  assert.match(script, /Fill saved ZERO ONE login/);
  assert.match(script, /if \(event\.isTrusted\) fill\(form\)/);
  assert.match(script, /passwords\.length !== 1/);
  assert.match(script, /new-password/);
  assert.match(script, /change\[-_\]\?password/);
  assert.ok(!script.includes("fill(form);\n      form.addEventListener"));
  assert.ok(!script.includes("ZERO_ONE_SAVE_LOGIN:\" +"));
});

test("workspace login persistence refuses unavailable and basic_text storage", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zero-one-logins-insecure-"));
  const allowed = new Set(["https://webmail.zmail.my"]);
  for (const insecureSafe of [
    { isEncryptionAvailable: () => false },
    { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => "basic_text", encryptString: () => Buffer.from("no") },
  ]) {
    assert.equal(isSecureCredentialStorage(insecureSafe), false);
    await assert.rejects(() => saveLogin({
      userDataPath: dir,
      safeStorage: insecureSafe,
      allowedOrigins: allowed,
      origin: "https://webmail.zmail.my",
      username: "user@zmail.my",
      password: "secret-pass",
    }), /not saved/);
  }
  assert.deepEqual(await listLogins({ userDataPath: dir }), []);
});

test("workspace logins reject disallowed origins", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zero-one-logins-bad-"));
  const allowed = new Set(["https://webmail.zmail.my"]);
  await assert.rejects(
    () => saveLogin({
      userDataPath: dir,
      safeStorage: fakeSafe,
      allowedOrigins: allowed,
      origin: "https://evil.example",
      username: "x",
      password: "y",
    }),
    /not allowed/,
  );
  const loaded = await loadLogin({
    userDataPath: dir,
    safeStorage: fakeSafe,
    allowedOrigins: allowed,
    origin: "https://evil.example",
  });
  assert.equal(loaded, null);
});
