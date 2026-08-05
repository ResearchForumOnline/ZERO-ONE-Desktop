"use strict";

const path = require("node:path");
const { Arch } = require("builder-util");
const { verifyZsecVendor } = require("./zsec-vendor-verifier.cjs");
const { verifyNativeZsec } = require("./zsec-native-verifier.cjs");

module.exports = async function beforePack(context) {
  const projectRoot = context.packager.projectDir;
  const packageVersion = context.packager.appInfo.version;
  if (packageVersion !== "0.6.2") {
    throw new Error("ZERO ONE package version does not match the locked ZSEC consumer version.");
  }

  let verification;
  if (context.electronPlatformName === "win32" && context.arch === Arch.x64) {
    verification = verifyZsecVendor(
      path.join(projectRoot, "vendor", "zsec-shield"),
      path.join(projectRoot, "vendor", "zsec-shield.lock.json"),
    );
  } else if (context.electronPlatformName === "darwin" && context.arch === Arch.arm64) {
    verification = verifyNativeZsec(
      path.join(projectRoot, "vendor", "zsec-shield"),
      path.join(projectRoot, "vendor", "zsec-shield-provenance.json"),
      "darwin",
      "arm64",
    );
  } else if (context.electronPlatformName === "linux" && context.arch === Arch.x64) {
    verification = verifyNativeZsec(
      path.join(projectRoot, "vendor", "zsec-shield"),
      path.join(projectRoot, "vendor", "zsec-shield-provenance.json"),
      "linux",
      "x64",
    );
  } else {
    throw new Error(`ZERO ONE has no verified ZSEC payload for ${context.electronPlatformName}/${context.arch}.`);
  }
  process.stdout.write(`Verified bundled ZSEC vendor payload: ${JSON.stringify(verification)}\n`);
};
