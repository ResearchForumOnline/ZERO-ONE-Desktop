"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { reportHtml, extractPdf, MAX_PDF_BYTES } = require("./zerothink-pdf.cjs");
function fixture(text = "Synthetic ZeroThink PDF evidence") {
  const stream = `BT /F1 12 Tf 70 760 Td (${text}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let content = "%PDF-1.4\n", offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(content)); content += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(content); content += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}
test("real PDF.js extracts synthetic PDF text in a bounded worker", async () => { const text = await extractPdf(fixture()); assert.match(text, /\[PDF page 1\]/); assert.match(text, /Synthetic ZeroThink PDF evidence/); });
test("PDF sources reject non-PDF and oversized input before creating a worker", async () => { await assert.rejects(extractPdf(Buffer.from("not a pdf")), /Choose a PDF/); await assert.rejects(extractPdf(Buffer.alloc(MAX_PDF_BYTES + 1)), /Choose a PDF/); });
test("image-only PDF reports OCR requirement instead of fake empty evidence", async () => { await assert.rejects(extractPdf(fixture("")), /no extractable text/); });
test("corrupt PDFs preserve generic parser errors", async () => { await assert.rejects(extractPdf(Buffer.from("%PDF-1.4 corrupt private content")), /could not be read/); });
test("PDF worker timeout terminates bounded extraction", async () => { let terminated = false; await assert.rejects(extractPdf(fixture(), { timeoutMs: 5, workerFactory: () => { const worker = new EventEmitter(); worker.terminate = async () => { terminated = true; }; return worker; } }), /30-second limit/); assert.equal(terminated, true); });
test("PDF export keeps all model and source HTML inert", () => { const html = reportHtml('<script>fetch("https://invalid.test")</script><img src=x>&'); assert.ok(html.includes("&lt;script&gt;")); assert.ok(html.includes("&lt;img src=x&gt;")); assert.ok(!html.includes("<script>")); assert.ok(html.includes("default-src 'none'")); assert.ok(html.includes("unencrypted export")); });
test("PDF exports bound report length and refuse invalid strings", () => { assert.throws(() => reportHtml(null), /2 MB/); assert.throws(() => reportHtml("\0"), /2 MB/); assert.throws(() => reportHtml("x".repeat(2097153)), /2 MB/); });
module.exports = { fixture };
