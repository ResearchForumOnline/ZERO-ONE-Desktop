const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ZSIGN_ORIGIN,
  isZmailWorkspaceUrl,
  isZmailZsignSsoUrl,
} = require("./zmail-integration.cjs");

test("recognizes only reviewed ZMail workspace origins", () => {
  assert.equal(isZmailWorkspaceUrl("https://webmail.zmail.my/?_task=workspace"), true);
  assert.equal(isZmailWorkspaceUrl("https://mail.zmail.my/"), true);
  assert.equal(isZmailWorkspaceUrl("https://evil.example/?next=https://webmail.zmail.my"), false);
  assert.equal(isZmailWorkspaceUrl("http://webmail.zmail.my/"), false);
  assert.equal(isZmailWorkspaceUrl("https://user:pass@webmail.zmail.my/"), false);
});

test("recognizes only the exact account-bound zSign SSO hop", () => {
  assert.equal(isZmailZsignSsoUrl("https://webmail.zmail.my/?_task=workspace&_action=plugin.zmail-zsign-sso"), true);
  assert.equal(isZmailZsignSsoUrl("https://zmail.my/?_action=plugin.zmail-zsign-sso&_task=workspace"), true);
  assert.equal(isZmailZsignSsoUrl("https://webmail.zmail.my/?_task=mail&_action=plugin.zmail-zsign-sso"), false);
  assert.equal(isZmailZsignSsoUrl("https://zsign.zmail.my/"), false);
  assert.equal(isZmailZsignSsoUrl("https://evil.example/?_task=workspace&_action=plugin.zmail-zsign-sso"), false);
  assert.equal(isZmailZsignSsoUrl("https://webmail.zmail.my/?_task=workspace&_action=plugin.zmail-zsign-sso#token"), false);
  assert.equal(isZmailZsignSsoUrl("https://webmail.zmail.my/?_task=workspace&_action=plugin.zmail-zsign-sso&next=https://evil.example"), false);
  assert.equal(isZmailZsignSsoUrl("https://webmail.zmail.my/?_task=workspace&_task=workspace&_action=plugin.zmail-zsign-sso"), false);
  assert.equal(ZSIGN_ORIGIN, "https://zsign.zmail.my");
});
