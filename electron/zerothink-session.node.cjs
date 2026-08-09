const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { latestPhpSessionCookie, latestPhpSessionId } = require("./zerothink-session.cjs");

describe("ZeroThink desktop session cookie", () => {
  it("uses the regenerated authenticated session when two cookies are returned", () => {
    assert.equal(latestPhpSessionId([
      "PHPSESSID=aaaaaaaaaaaaaaaa; Path=/; Secure; HttpOnly",
      "PHPSESSID=bbbbbbbbbbbbbbbb; Path=/; Secure; HttpOnly",
    ]), "bbbbbbbbbbbbbbbb");
  });

  it("handles combined Set-Cookie values and rejects malformed ids", () => {
    assert.equal(latestPhpSessionId(["PHPSESSID=short; Path=/, PHPSESSID=cccccccccccccccc; Path=/"]), "cccccccccccccccc");
    assert.equal(latestPhpSessionId(["PHPSESSID=bad/value; Path=/"]), "");
  });

  it("preserves the server cookie lifetime instead of inventing one", () => {
    const persistent = latestPhpSessionCookie(["PHPSESSID=dddddddddddddddd; Path=/studio; Secure; HttpOnly; SameSite=Strict; Max-Age=600"]);
    assert.equal(persistent.value, "dddddddddddddddd");
    assert.equal(persistent.path, "/studio");
    assert.equal(persistent.secure, true);
    assert.equal(persistent.httpOnly, true);
    assert.equal(persistent.sameSite, "strict");
    assert.ok(persistent.expirationDate > Date.now() / 1000 + 590);
    assert.equal(latestPhpSessionCookie(["PHPSESSID=eeeeeeeeeeeeeeee; Path=/; Secure"]).expirationDate, undefined);
  });
});
