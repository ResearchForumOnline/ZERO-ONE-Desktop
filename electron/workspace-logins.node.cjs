const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { saveLogin, loadLogin, deleteLogin, listLogins, buildLoginAssistScript, clearAllLogins } = require("./workspace-logins.cjs");

test("workspace logins encrypt and round-trip", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zero-one-logins-"));
  const allowed = new Set(["https://webmail.zmail.my"]);
  const fakeSafe = {
    isEncryptionAvailable: () => false,
  };
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
  const script = buildLoginAssistScript({ username: "a", password: "b" });
  assert.match(script, /ZERO_ONE_SAVE_LOGIN_SIGNAL/);
  assert.match(script, /__zeroOnePendingLogin/);
  assert.match(script, /input\[type="password"\]/);
  assert.ok(!script.includes("ZERO_ONE_SAVE_LOGIN:\" +"));
});

test("workspace logins reject disallowed origins", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zero-one-logins-bad-"));
  const allowed = new Set(["https://webmail.zmail.my"]);
  const fakeSafe = { isEncryptionAvailable: () => false };
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
