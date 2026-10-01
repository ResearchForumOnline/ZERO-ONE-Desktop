"use strict";
const { workerData, parentPort } = require("node:worker_threads");
(async () => {
  let task;
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    task = getDocument({ data: workerData.data, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, maxImageSize: 0, stopAtErrors: true, verbosity: 0 });
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error("Choose a PDF with at most 100 pages.");
    const pages = []; let bytes = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.filter((item) => typeof item.str === "string").map((item) => item.str + (item.hasEOL ? "\n" : " ")).join("").trim();
      const section = `[PDF page ${n}]\n${text}`;
      bytes += Buffer.byteLength(section, "utf8");
      if (bytes > workerData.maxTextBytes) throw new Error("PDF text exceeds the 1 MB source limit. Split the document first.");
      pages.push(section); page.cleanup();
    }
    if (!pages.some((page) => page.replace(/\[PDF page \d+\]/g, "").trim())) throw new Error("This PDF has no extractable text. Image-only scans need OCR before import.");
    parentPort.postMessage({ text: pages.join("\n\n") });
  } catch (error) {
    // Parser errors can include document strings; only our own public limit messages cross IPC.
    const message = /^(Choose a PDF|PDF text exceeds|This PDF has)/.test(error?.message || "") ? error.message : "The PDF could not be read. Encrypted or corrupt PDFs are not imported.";
    parentPort.postMessage({ error: message });
  } finally { await task?.destroy().catch(() => {}); }
})();
