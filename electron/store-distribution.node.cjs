const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { STORE_MARKER, isWindowsStoreDistribution } = require("./store-distribution.cjs");

test("Microsoft Store detection is fail-closed and portable", () => {
  assert.equal(isWindowsStoreDistribution({ platform: "linux", windowsStore: true }), false);
  assert.equal(isWindowsStoreDistribution({ platform: "win32", windowsStore: true, existsSync: () => false }), true);
  assert.equal(isWindowsStoreDistribution({
    platform: "win32", windowsStore: false, resourcesPath: "C:/package/resources",
    existsSync: (file) => file === path.join("C:/package/resources", STORE_MARKER),
  }), true);
  assert.equal(isWindowsStoreDistribution({
    platform: "win32", windowsStore: false, resourcesPath: "C:/direct/resources",
    executablePath: "C:/direct/ZERO ONE.exe", existsSync: () => false,
  }), false);
  assert.equal(isWindowsStoreDistribution({
    platform: "win32", windowsStore: false, resourcesPath: "C:/direct/resources",
    executablePath: "C:/Program Files/WindowsApps/talktoai.ZeroOne_7.9.5.0_x64/ZERO ONE.exe",
    existsSync: () => false,
  }), true);
});
