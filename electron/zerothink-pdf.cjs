"use strict";
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_BYTES = 1024 * 1024;
function reportHtml(markdown) {
  if (typeof markdown !== "string" || Buffer.byteLength(markdown, "utf8") > 2 * MAX_TEXT_BYTES || markdown.includes("\0")) throw new Error("Choose a report up to 2 MB to export.");
  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>ZeroThink research report</title><style>@page{size:A4;margin:18mm}body{font:11pt Arial,sans-serif;color:#172230;line-height:1.5}header{font-size:9pt;color:#506176;border-bottom:1px solid #bdc9d2;padding-bottom:8px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}footer{font-size:9pt;color:#506176}</style></head><body><header>ZERO ONE · ZeroThink · Exported research report</header><pre>${escape(markdown)}</pre><footer>Model drafts and source excerpts require review. This file is a readable, unencrypted export.</footer></body></html>`;
}
function extractPdf(buffer, { timeoutMs = 30000, workerFactory = (file, options) => new Worker(file, options) } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_PDF_BYTES || !buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) return Promise.reject(new Error("Choose a PDF up to 10 MB."));
  return new Promise((resolve, reject) => {
    const worker = workerFactory(path.join(__dirname, "zerothink-pdf-worker.cjs"), { workerData: { data: new Uint8Array(buffer), maxTextBytes: MAX_TEXT_BYTES }, resourceLimits: { maxOldGenerationSizeMb: 192 } });
    let done = false;
    const finish = (error, text) => { if (done) return; done = true; clearTimeout(timer); void worker.terminate(); error ? reject(error) : resolve(text); };
    const timer = setTimeout(() => finish(new Error("PDF extraction reached its 30-second limit. Try a smaller document.")), timeoutMs);
    worker.once("message", (value) => {
      if (value?.error || typeof value?.text !== "string" || Buffer.byteLength(value.text, "utf8") > MAX_TEXT_BYTES) finish(new Error(value?.error || "PDF text could not be extracted within its size limit."));
      else finish(null, value.text);
    });
    worker.once("error", () => finish(new Error("The PDF could not be read. It may be encrypted, corrupt or too large to process.")));
    worker.once("exit", () => { if (!done) finish(new Error("PDF extraction ended without a readable result.")); });
  });
}
module.exports = { reportHtml, extractPdf, MAX_PDF_BYTES, MAX_TEXT_BYTES };
