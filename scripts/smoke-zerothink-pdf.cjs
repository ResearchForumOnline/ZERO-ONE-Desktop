"use strict";
// Native artifact export/import acceptance with synthetic data only. The hidden
// BrowserWindow renders escaped local data, never a user browser or remote site.
const { app, BrowserWindow } = require("electron");
const fsSync = require("node:fs"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const temporaryRoot = path.resolve(os.tmpdir()), profileDirectory = fsSync.mkdtempSync(path.join(temporaryRoot, "zeroone-pdf-smoke-"));
const repoRoot = path.resolve(__dirname, "..");
const moduleRootArg = process.argv.find((value) => value.startsWith("--module-root="))?.slice(14);
const moduleRoot = moduleRootArg ? path.resolve(moduleRootArg) : repoRoot;
app.setName("ZeroOnePDFSyntheticSmoke"); app.setPath("userData", profileDirectory);
app.disableHardwareAcceleration();
const receiptArg = process.argv.find((value) => value.startsWith("--receipt="))?.slice(10), artifactArg = process.argv.find((value) => value.startsWith("--artifact="))?.slice(11);
const receiptPath = receiptArg ? path.resolve(receiptArg) : null, artifactPath = artifactArg ? path.resolve(artifactArg) : null;
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
let printWindow;
app.whenReady().then(async () => {
  for (const target of [receiptPath, artifactPath].filter(Boolean)) if (!target.startsWith(repoRoot + path.sep)) throw new Error("Smoke artifacts must remain inside this checkout.");
  // Electron exposes an ASAR as a virtual directory to fs; original-fs verifies
  // the actual archive without disabling normal packaged module resolution.
  if (moduleRoot !== repoRoot && (!moduleRoot.startsWith(repoRoot + path.sep) || !moduleRoot.endsWith("app.asar") || !require("original-fs").statSync(moduleRoot).isFile())) throw new Error("Packaged smoke must use an app.asar inside this checkout.");
  const { reportHtml, extractPdf, MAX_PDF_BYTES, MAX_TEXT_BYTES } = require(path.join(moduleRoot, "electron/zerothink-pdf.cjs"));
  const preferences = { nodeIntegration: false, contextIsolation: true, sandbox: true, javascript: false, partition: `zeroone-pdf-synthetic-${crypto.randomUUID()}` };
  printWindow = new BrowserWindow({ show: false, webPreferences: preferences });
  let remoteRequests = 0;
  printWindow.webContents.session.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, callback) => { remoteRequests++; callback({ cancel: true }); });
  printWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  assert.equal(printWindow.isVisible(), false);
  const actual = printWindow.webContents.getLastWebPreferences();
  assert.equal(actual.sandbox, true); assert.equal(actual.javascript, false); assert.equal(actual.nodeIntegration, false); assert.equal(actual.contextIsolation, true);
  let exported, imported, pageCount, fixtureLineCount;
  for (const lineCount of [62, 70, 54, 78]) {
    const lines = ["SYNTHETIC FIRST RESEARCH TITLE", "Normal paragraphs preserve evidence and source limitations.", "<script>syntheticNeverExecuted()</script>", '<img src="https://invalid.example/no-request">'];
    for (let i = 1; i <= lineCount; i++) lines.push(i === Math.floor(lineCount / 2) ? "SYNTHETIC SECOND RESEARCH TITLE" : `Paragraph ${String(i).padStart(2, "0")}: Local evidence is readable and requires review.`);
    const markdown = lines.join("\n"), html = reportHtml(markdown);
    assert.ok(html.includes("&lt;script&gt;")); assert.ok(html.includes("&lt;img")); assert.ok(!html.includes("<script>")); assert.ok(!html.includes("<img")); assert.ok(html.includes("default-src 'none'"));
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    exported = await printWindow.webContents.printToPDF({ printBackground: false, preferCSSPageSize: true });
    assert.ok(exported.length < MAX_PDF_BYTES); assert.ok(exported.subarray(0, 5).equals(Buffer.from("%PDF-")));
    imported = await extractPdf(exported);
    pageCount = (imported.match(/\[PDF page \d+\]/g) || []).length; fixtureLineCount = lineCount;
    if (pageCount === 2) break;
  }
  assert.equal(pageCount, 2, "Synthetic report exports as two real PDF pages");
  assert.match(imported, /SYNTHETIC FIRST RESEARCH TITLE/); assert.match(imported, /SYNTHETIC SECOND RESEARCH TITLE/);
  assert.match(imported, /Normal paragraphs preserve evidence and source limitations/);
  assert.match(imported, /Paragraph 01/); assert.match(imported, new RegExp(`Paragraph ${fixtureLineCount}`));
  assert.match(imported, /syntheticNeverExecuted/); assert.match(imported, /unencrypted export/); assert.ok(Buffer.byteLength(imported) < MAX_TEXT_BYTES);
  assert.equal(remoteRequests, 0, "Escaped synthetic HTML starts no remote requests");
  const sourceHashes = {};
  for (const file of ["electron/zerothink-pdf.cjs", "electron/zerothink-pdf-worker.cjs"]) sourceHashes[file] = hash(await fs.readFile(path.join(moduleRoot, file)));
  sourceHashes["scripts/smoke-zerothink-pdf.cjs"] = hash(await fs.readFile(__filename));
  const packagedSourceComparison = {};
  if (moduleRoot !== repoRoot) for (const file of ["electron/main.cjs", "electron/preload.cjs", "electron/zerothink-vault.cjs", "electron/zerothink-providers.cjs", "electron/zerothink-quantum.cjs", "electron/zerothink-ibm.cjs", "electron/zerothink-templates.cjs", "electron/zerothink-pdf.cjs", "electron/zerothink-pdf-worker.cjs"]) {
    const packagedSHA256 = hash(await fs.readFile(path.join(moduleRoot, file))), sourceSHA256 = hash(await fs.readFile(path.join(repoRoot, file)));
    packagedSourceComparison[file] = { packagedSHA256, sourceSHA256, matches: packagedSHA256 === sourceSHA256 };
    assert.equal(packagedSHA256, sourceSHA256, `${file} in the staged package must match current source`);
  }
  const receipt = { electron: process.versions.electron, node: process.versions.node, platform: process.platform, data: "synthetic only", moduleOrigin: moduleRoot === repoRoot ? "source checkout" : "packaged app.asar", visibleWindows: 0, hiddenArtifactWindow: true, sandboxEnabled: actual.sandbox, javascriptEnabled: actual.javascript, nodeIntegrationEnabled: actual.nodeIntegration, contextIsolationEnabled: actual.contextIsolation, remoteRequests, productionReportHtmlUsed: true, escapedModelHtmlVerified: true, realPrintToPDFUsed: true, realElectronNodeWorkerUsed: true, pdfjsVersion: require(path.join(moduleRoot, "node_modules/pdfjs-dist/package.json")).version, pages: pageCount, fixtureLineCount, pdfBytes: exported.length, pdfSHA256: hash(exported), extractedTextBytes: Buffer.byteLength(imported), extractedTextSHA256: hash(imported), titlesAndParagraphsVerified: true, sourceHashes, packagedSourceComparison };
  if (artifactPath) { await fs.mkdir(path.dirname(artifactPath), { recursive: true }); await fs.writeFile(artifactPath, exported, { flag: "wx", mode: 0o600 }); }
  if (receiptPath) { await fs.mkdir(path.dirname(receiptPath), { recursive: true }); await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o600 }); }
  console.log(JSON.stringify(receipt));
}).catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  printWindow?.destroy();
  const resolved = path.resolve(profileDirectory);
  if (!resolved.startsWith(temporaryRoot + path.sep) || !path.basename(resolved).startsWith("zeroone-pdf-smoke-")) { console.error("Synthetic cleanup target escaped the temporary root"); process.exitCode = 1; }
  else await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
  app.exit(process.exitCode || 0);
});
