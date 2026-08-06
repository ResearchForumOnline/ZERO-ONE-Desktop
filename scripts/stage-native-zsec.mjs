import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { EXPECTED, verifyNativeZsec } = require("../build/zsec-native-verifier.cjs");
const expected = EXPECTED[process.platform];
if (!expected) throw new Error(`Use scripts/stage-zsec-vendor.ps1 on ${process.platform}.`);
const actualArch = process.arch === "x64" ? "x86_64" : process.arch;
if (actualArch !== expected.architecture) throw new Error(`No pinned ZSEC runtime for ${process.platform}/${process.arch}.`);

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1")), "..");
const vendorRoot = path.join(projectRoot, "vendor");
const destination = path.join(vendorRoot, "zsec-shield");
const provenancePath = path.join(vendorRoot, "zsec-shield-provenance.json");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "zero-one-zsec-"));
const archivePath = path.join(temporary, expected.archive);
const url = `https://github.com/ResearchForumOnline/ZSEC-Shield/releases/download/v0.1.2/${expected.archive}`;

try {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`ZSEC download failed with HTTP ${response.status}.`);
  const archive = Buffer.from(await response.arrayBuffer());
  const archiveSha256 = crypto.createHash("sha256").update(archive).digest("hex");
  if (archiveSha256 !== expected.archiveSha256) throw new Error("ZSEC archive digest mismatch.");
  fs.writeFileSync(archivePath, archive, { mode: 0o600 });
  const extract = spawnSync("tar", ["-xzf", archivePath, "-C", temporary], { encoding: "utf8" });
  if (extract.status !== 0) throw new Error(`ZSEC extraction failed: ${extract.stderr || extract.stdout}`);
  const extracted = path.join(temporary, expected.archiveRoot);
  const packageVersion = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")).version;
  const provenance = {
    schema: "zero-one.zsec-native-provenance.v1",
    consumerVersion: packageVersion,
    repository: "ResearchForumOnline/ZSEC-Shield",
    release: "v0.1.2",
    asset: expected.archive,
    archiveSha256: expected.archiveSha256,
    platform: expected.os,
    architecture: expected.architecture,
  };
  const temporaryProvenance = path.join(temporary, "provenance.json");
  fs.writeFileSync(temporaryProvenance, `${JSON.stringify(provenance, null, 2)}\n`, { mode: 0o600 });
  verifyNativeZsec(extracted, temporaryProvenance, process.platform, process.arch);
  const smoke = spawnSync(path.join(extracted, "zsec-shield"), ["--version"], { encoding: "utf8" });
  if (smoke.status !== 0 || smoke.stdout.trim() !== "zsec-shield 0.1.2") throw new Error("Native ZSEC version smoke failed.");
  if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
  fs.renameSync(extracted, destination);
  fs.copyFileSync(temporaryProvenance, provenancePath);
  process.stdout.write(`Staged verified ${expected.os}/${expected.architecture} ZSEC runtime.\n`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
