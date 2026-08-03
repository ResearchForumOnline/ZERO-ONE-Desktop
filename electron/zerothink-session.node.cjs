const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { latestPhpSessionId } = require("./zerothink-session.cjs");

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
});
