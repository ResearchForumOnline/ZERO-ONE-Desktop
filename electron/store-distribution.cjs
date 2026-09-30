const fs = require("node:fs");
const path = require("node:path");

const STORE_MARKER = "zero-one-store-edition.json";

function isWindowsStoreDistribution({
  platform = process.platform,
  windowsStore = process.windowsStore,
  resourcesPath = process.resourcesPath,
  executablePath = process.execPath,
  existsSync = fs.existsSync,
} = {}) {
  if (platform !== "win32") return false;
  if (windowsStore === true) return true;
  if (resourcesPath && existsSync(path.join(resourcesPath, STORE_MARKER))) return true;
  return /[\\/]WindowsApps[\\/]/i.test(executablePath || "");
}

module.exports = { STORE_MARKER, isWindowsStoreDistribution };
