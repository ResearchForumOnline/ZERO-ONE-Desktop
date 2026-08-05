"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const EXPECTED = Object.freeze({
  darwin: Object.freeze({
    os: "macos",
    architecture: "arm64",
    archive: "zsec-shield-0.1.2-macos-arm64.tar.gz",
    archiveSha256: "511aa035d326eabd8adcd24102af63d4ee7f56d1c3eaa0a59d0bcacacf5511b5",
    archiveRoot: "zsec-shield-0.1.2-macos-arm64",
    manifestSha256: "dc04dfbeb61fb7880e33b8f8b6b0572ed599f10ad9f4dcbde7b2b7db3a3eb1dc",
    entrypointSha256: "093221f5d8f4e3dbfdab41a4e0dea074bc1532e756bd7e7c5ee7cb280e0ab2e3",
    fileRecords: 85,
  }),
  linux: Object.freeze({
    os: "linux",
    architecture: "x86_64",
    archive: "zsec-shield-0.1.2-linux-x86_64.tar.gz",
    archiveSha256: "e6c1c6cbac04a4ae6ed262174d33867690795e025ece20c267f939ba99376bf4",
    archiveRoot: "zsec-shield-0.1.2-linux-x86_64",
    manifestSha256: "7a6c4744118e23b1ab7383a5f8702ffe1c57f49808c067bc67a95f0f5e36d799",
    entrypointSha256: "4023b38e418c442134865dc8aab3cf9e0e56d66187b2f2639c904c54d526ad93",
    fileRecords: 83,
  }),
});

function fail(message) {
  throw new Error(`Native ZSEC verification failed: ${message}`);
}

function digest(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function safePath(root, relative) {
  if (typeof relative !== "string" || !relative || relative.includes("\0") || path.isAbsolute(relative)) fail("unsafe manifest path");
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) fail(`path escapes bundle: ${relative}`);
  return resolved;
}

function verifyNativeZsec(vendorRoot, provenancePath, platform = process.platform, architecture = process.arch) {
  const expected = EXPECTED[platform];
  if (!expected) fail(`unsupported platform ${platform}`);
  const expectedArch = architecture === "x64" ? "x86_64" : architecture;
  if (expectedArch !== expected.architecture) fail(`unsupported architecture ${architecture}`);

  const root = path.resolve(vendorRoot);
  const provenance = JSON.parse(fs.readFileSync(path.resolve(provenancePath), "utf8"));
  if (
    provenance.schema !== "zero-one.zsec-native-provenance.v1"
    || provenance.consumerVersion !== "0.6.2"
    || provenance.release !== "v0.1.2"
    || provenance.asset !== expected.archive
    || provenance.archiveSha256 !== expected.archiveSha256
    || provenance.platform !== expected.os
    || provenance.architecture !== expected.architecture
  ) fail("provenance does not match the pinned native release");

  const manifestPath = path.join(root, "NATIVE-MANIFEST.json");
  const manifestBytes = fs.readFileSync(manifestPath);
  if (digest(manifestBytes) !== expected.manifestSha256) fail("manifest digest mismatch");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (
    manifest.schema !== "zsec.shield.native-distribution.v1"
    || manifest.product !== "ZSEC Shield"
    || manifest.version !== "0.1.2"
    || manifest.target?.os !== expected.os
    || manifest.target?.architecture !== expected.architecture
    || manifest.entrypoint !== "zsec-shield"
    || manifest.build?.source_revision !== "78efb1186c50efeeedf68bc14044cbc019fc0e8e"
    || manifest.build?.source_tree_state !== "clean"
    || manifest.runtime_policy?.scanner_mode !== "on-demand"
    || manifest.runtime_policy?.real_time_protection !== false
    || manifest.runtime_policy?.telemetry !== false
    || !Array.isArray(manifest.files)
    || manifest.files.length !== expected.fileRecords
  ) fail("manifest identity or security policy mismatch");

  for (const record of manifest.files) {
    const absolute = safePath(root, record.path);
    const stat = fs.lstatSync(absolute);
    if (record.type === "symlink") {
      if (!stat.isSymbolicLink() || fs.readlinkSync(absolute) !== record.target) fail(`symlink mismatch: ${record.path}`);
      continue;
    }
    if (record.type !== "file" || !stat.isFile() || stat.size !== record.size) fail(`file identity mismatch: ${record.path}`);
    if (digest(fs.readFileSync(absolute)) !== record.sha256) fail(`file digest mismatch: ${record.path}`);
  }
  const entrypoint = manifest.files.find((record) => record.path === manifest.entrypoint);
  if (!entrypoint || entrypoint.sha256 !== expected.entrypointSha256) fail("entrypoint digest mismatch");
  for (const required of ["LICENSE", "LICENSES/Python/LICENSE.txt", "THIRD_PARTY_NOTICES.md"]) {
    if (!manifest.files.some((record) => record.path === required)) fail(`missing ${required}`);
  }
  return { schema: "zero-one.zsec-native-verification.v1", platform: expected.os, architecture: expected.architecture, version: manifest.version, records: manifest.files.length };
}

if (require.main === module) {
  try {
    const result = verifyNativeZsec(process.argv[2], process.argv[3]);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

module.exports = { EXPECTED, verifyNativeZsec };
