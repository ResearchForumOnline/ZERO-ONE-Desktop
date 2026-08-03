const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { loginItemOptions, shouldCloseToTray, shouldStartHidden } = require("./tray-lifecycle.cjs");

describe("desktop tray lifecycle", () => {
  it("starts hidden only for the explicit login-item switch", () => {
    assert.equal(shouldStartHidden(["ZERO ONE.exe", "--hidden"]), true);
    assert.equal(shouldStartHidden(["ZERO ONE.exe"]), false);
  });

  it("hides only when tray mode is enabled and quit is not underway", () => {
    assert.equal(shouldCloseToTray({ isQuitting: false, closeToTray: true }), true);
    assert.equal(shouldCloseToTray({ isQuitting: false, closeToTray: false }), false);
    assert.equal(shouldCloseToTray({ isQuitting: true, closeToTray: true }), false);
  });

  it("adds the hidden switch only to packaged login launches", () => {
    assert.deepEqual(loginItemOptions({ enabled: true, executablePath: "C:/ZERO ONE.exe", packaged: true }), {
      openAtLogin: true,
      path: "C:/ZERO ONE.exe",
      args: ["--hidden"],
    });
    assert.deepEqual(loginItemOptions({ enabled: false, executablePath: "C:/ZERO ONE.exe", packaged: true }).args, []);
  });
});
