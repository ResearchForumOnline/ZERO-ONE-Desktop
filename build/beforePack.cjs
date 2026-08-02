"use strict";

const path = require("node:path");
const { Arch } = require("builder-util");
const { verifyZsecVendor } = require("./zsec-vendor-verifier.cjs");

module.exports = async function beforePack(context) {
  if (context.electronPlatformName !== "win32" || context.arch !== Arch.x64) {
    throw new Error("ZERO ONE 0.3.1 packaging is limited to Windows x64 until a matching native ZSEC payload is verified.");
  }

  const projectRoot = context.packager.projectDir;
  const packageVersion = context.packager.appInfo.version;
  if (packageVersion !== "0.3.1") {
    throw new Error("ZERO ONE package version does not match the locked ZSEC consumer version.");
  }

  const verification = verifyZsecVendor(
    path.join(projectRoot, "vendor", "zsec-shield"),
    path.join(projectRoot, "vendor", "zsec-shield.lock.json"),
  );
  process.stdout.write(`Verified bundled ZSEC vendor payload: ${JSON.stringify(verification)}\n`);
};
