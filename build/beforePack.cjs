"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Arch } = require("builder-util");
const { verifyZsecVendor } = require("./zsec-vendor-verifier.cjs");
const { verifyNativeZsec } = require("./zsec-native-verifier.cjs");

/**
 * Packaging gate: package.json version must match the ZSEC consumer lock.
 * Reads the lock file so a version bump cannot leave a stale hard-coded pin
 * (this was the root cause of several Windows package-windows CI failures).
 */
module.exports = async function beforePack(context) {
  const projectRoot = context.packager.projectDir;
  const packageVersion = context.packager.appInfo.version;
  const lockPath = path.join(projectRoot, "vendor", "zsec-shield.lock.json");
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ZSEC vendor lock at ${lockPath}: ${error instanceof Error ? error.message : error}`);
  }
  const lockedConsumer = String(lock.consumer_version || "");
  if (!lockedConsumer) {
    throw new Error("ZSEC vendor lock is missing consumer_version.");
  }
  if (packageVersion !== lockedConsumer) {
    throw new Error(
      `ZERO ONE package version ${packageVersion} does not match the locked ZSEC consumer version ${lockedConsumer}. ` +
        "Bump vendor/zsec-shield.lock.json consumer_version (and PINNED_LOCK in build/zsec-vendor-verifier.cjs) together with package.json.",
    );
  }

  let verification;
  if (context.electronPlatformName === "win32" && context.arch === Arch.x64) {
    verification = verifyZsecVendor(
      path.join(projectRoot, "vendor", "zsec-shield"),
      lockPath,
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
