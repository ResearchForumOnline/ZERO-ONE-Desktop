"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");

const MANIFEST_NAME = "NATIVE-MANIFEST.json";
const REQUIRED_LICENSES = [
  "LICENSE",
  "LICENSES/Python/LICENSE.txt",
  "THIRD_PARTY_NOTICES.md",
];
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const PINNED_LOCK = {
  schema: "zero-one.zsec-vendor-lock.v1",
  consumer_version: "0.6.5",
  repository: "ResearchForumOnline/ZSEC-Shield",
  release: {
    id: 363682670,
    tag: "v0.1.2",
    url: "https://github.com/ResearchForumOnline/ZSEC-Shield/releases/tag/v0.1.2",
    immutable: true,
    prerelease: true,
    release_attestation_verified: true,
    tag_object: "b5e53c2fbc196ffba9d734e493a84f1208393827",
    tag_commit: "78efb1186c50efeeedf68bc14044cbc019fc0e8e",
    tag_signature_verified: false,
  },
  asset: {
    id: 498488611,
    name: "zsec-shield-0.1.2-windows-x86_64.zip",
    url: "https://github.com/ResearchForumOnline/ZSEC-Shield/releases/download/v0.1.2/zsec-shield-0.1.2-windows-x86_64.zip",
    size: 12392156,
    sha256: "62ade4111206e6b0b083c60dd2ccd1b7cbc83452e4067d71ea99ac76364dd13d",
    archive_root: "zsec-shield-0.1.2-windows-x86_64",
  },
  manifest: {
    sha256: "54a7b6ae8e412b10e15ababc52da9dc8e66f6487b74839cce9cfb3572c437643",
    schema: "zsec.shield.native-distribution.v1",
    product: "ZSEC Shield",
    version: "0.1.2",
    os: "windows",
    architecture: "x86_64",
    entrypoint: "zsec-shield.exe",
    entrypoint_sha256: "6bc60026691fff00319e23c7ba9d49d1ab9f893715766177226062baa069d501",
    layout: "pyinstaller-onedir",
    source_tree_state: "clean",
    source_revision: "78efb1186c50efeeedf68bc14044cbc019fc0e8e",
    file_count: 89,
    pe_machine: "AMD64",
  },
  contracts: {
    status_schema: "zsec.shield.status.v2",
    status_version: 2,
    scan_schema: "zsec.shield.report.v1",
  },
};

function fail(message) {
  throw new Error(`ZSEC vendor verification failed: ${message}`);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function safeRelativePath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes("\0")) {
    fail("manifest contains an invalid path");
  }
  if (path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)) fail(`unsafe path ${value}`);
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes(":") || part.endsWith(".") || part.endsWith(" ") || WINDOWS_RESERVED.test(part))) {
    fail(`unsafe path ${value}`);
  }
  return parts.join("/");
}

function walkFiles(root, current = root, result = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) fail(`symbolic link is not allowed: ${absolute}`);
    if (entry.isDirectory()) {
      walkFiles(root, absolute, result);
    } else if (entry.isFile()) {
      result.push({
        absolute,
        relative: path.relative(root, absolute).split(path.sep).join("/"),
        size: stat.size,
      });
    } else {
      fail(`special filesystem entry is not allowed: ${absolute}`);
    }
  }
  return result;
}

function assertAmd64Pe(file, relative) {
  if (file.length < 64 || file.readUInt16LE(0) !== 0x5a4d) fail(`not a PE file: ${relative}`);
  const peOffset = file.readUInt32LE(0x3c);
  if (peOffset < 64 || peOffset + 6 > file.length || file.readUInt32LE(peOffset) !== 0x00004550) {
    fail(`invalid PE header: ${relative}`);
  }
  if (file.readUInt16LE(peOffset + 4) !== 0x8664) fail(`non-AMD64 PE file: ${relative}`);
}

function readLock(lockPath) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  if (!isDeepStrictEqual(lock, PINNED_LOCK)) {
    fail("private lock does not match the embedded immutable ZSEC identity");
  }
  return lock;
}

function verifyZsecVendor(vendorRoot, lockPath = path.resolve("vendor/zsec-shield.lock.json")) {
  const root = path.resolve(vendorRoot);
  const lock = readLock(path.resolve(lockPath));
  const manifestPath = path.join(root, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) fail(`missing ${MANIFEST_NAME}`);

  const manifestBytes = fs.readFileSync(manifestPath);
  if (sha256(manifestBytes) !== lock.manifest.sha256) fail("native manifest digest does not match the lock");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (
    manifest.schema !== lock.manifest.schema
    || manifest.product !== lock.manifest.product
    || manifest.version !== lock.manifest.version
    || manifest.target?.os !== lock.manifest.os
    || manifest.target?.architecture !== lock.manifest.architecture
    || manifest.entrypoint !== lock.manifest.entrypoint
    || manifest.layout !== lock.manifest.layout
    || manifest.build?.source_tree_state !== lock.manifest.source_tree_state
    || manifest.build?.source_revision !== lock.manifest.source_revision
    || manifest.runtime_policy?.scanner_mode !== "on-demand"
    || manifest.runtime_policy?.real_time_protection !== false
    || manifest.runtime_policy?.telemetry !== false
  ) {
    fail("native manifest identity or policy is invalid");
  }
  if (!Array.isArray(manifest.files) || manifest.files.length !== lock.manifest.file_count) {
    fail("native manifest file count is invalid");
  }

  const records = new Map();
  let previous = "";
  for (const record of manifest.files) {
    const relative = safeRelativePath(record.path);
    const caseKey = relative.toLowerCase();
    if (relative < previous) fail("native manifest inventory is not sorted");
    previous = relative;
    if (records.has(caseKey)) fail(`duplicate or case-colliding manifest path: ${relative}`);
    if (
      record.type !== "file"
      || !Number.isSafeInteger(record.size)
      || record.size < 0
      || typeof record.sha256 !== "string"
      || !/^[0-9a-f]{64}$/.test(record.sha256)
    ) {
      fail(`invalid manifest record: ${relative}`);
    }
    records.set(caseKey, { ...record, path: relative });
  }

  const actualFiles = walkFiles(root).filter((file) => file.relative !== MANIFEST_NAME);
  if (actualFiles.length !== records.size) fail("staged file count does not match the manifest");
  const actualKeys = new Set();
  let peFiles = 0;
  for (const actual of actualFiles) {
    const relative = safeRelativePath(actual.relative);
    const key = relative.toLowerCase();
    if (actualKeys.has(key)) fail(`case-colliding staged path: ${relative}`);
    actualKeys.add(key);
    const record = records.get(key);
    if (!record || record.path !== relative) fail(`unlisted staged file: ${relative}`);
    if (record.size !== actual.size) fail(`size mismatch: ${relative}`);
    const bytes = fs.readFileSync(actual.absolute);
    if (sha256(bytes) !== record.sha256) fail(`digest mismatch: ${relative}`);
    if (/\.(exe|dll|pyd)$/i.test(relative)) {
      assertAmd64Pe(bytes, relative);
      peFiles += 1;
    }
  }
  for (const record of records.values()) {
    if (!actualKeys.has(record.path.toLowerCase())) fail(`missing staged file: ${record.path}`);
  }
  for (const required of REQUIRED_LICENSES) {
    if (!records.has(required.toLowerCase())) fail(`missing required license or notice: ${required}`);
  }
  const entrypoint = records.get(lock.manifest.entrypoint.toLowerCase());
  if (!entrypoint || entrypoint.sha256 !== lock.manifest.entrypoint_sha256) {
    fail("entrypoint digest does not match the private lock");
  }

  return {
    schema: "zero-one.zsec-vendor-verification.v1",
    version: manifest.version,
    sourceRevision: manifest.build.source_revision,
    files: actualFiles.length,
    peFiles,
    architecture: manifest.target.architecture,
    entrypointSha256: entrypoint.sha256,
  };
}

if (require.main === module) {
  const vendorRoot = process.argv[2];
  const lockPath = process.argv[3];
  if (!vendorRoot) {
    process.stderr.write("Usage: node build/zsec-vendor-verifier.cjs VENDOR_ROOT [LOCK_PATH]\n");
    process.exit(2);
  }
  try {
    process.stdout.write(`${JSON.stringify(verifyZsecVendor(vendorRoot, lockPath), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

module.exports = { readLock, verifyZsecVendor };
