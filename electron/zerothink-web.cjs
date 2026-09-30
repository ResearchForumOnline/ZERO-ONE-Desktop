"use strict";
const { randomUUID } = require("node:crypto");
const { TextDecoder } = require("node:util");

async function searchWeb(query, { key, fetcher = fetch, signal } = {}) {
  if (typeof query !== "string" || !query.trim() || query.length > 2000 || query.includes("\0")) throw new Error("Enter a web search up to 2,000 characters.");
  if (typeof key !== "string" || !key.trim()) throw new Error("Add your Serper search key in Settings to search the web.");
  const timeout = AbortSignal.timeout(30000);
  const response = await fetcher("https://google.serper.dev/search", {
    method: "POST", redirect: "error", signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { "Content-Type": "application/json", "X-API-KEY": key.trim() },
    body: JSON.stringify({ q: query.trim(), num: 3 }),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "Serper's search limit was reached. Try later or check your plan." : `Web search could not complete (HTTP ${response.status}). Check your Serper key.`);
  if (Number(response.headers?.get?.("content-length") || 0) > 1024 * 1024) throw new Error("Web search response exceeds its size limit.");
  if (!response.body?.getReader) throw new Error("The web search response is unavailable.");
  const reader = response.body.getReader();
  const chunks = []; let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 1024 * 1024) throw new Error("Web search response exceeds its size limit.");
      chunks.push(Buffer.from(chunk.value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  const documents = [];
  for (const result of Array.isArray(payload.organic) ? payload.organic.slice(0, 10) : []) {
    if (!result || typeof result.title !== "string" || typeof result.snippet !== "string" || typeof result.link !== "string") continue;
    let url; try { url = new URL(result.link); } catch { continue; }
    if (url.protocol !== "https:" || url.username || url.password) continue;
    const title = result.title.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 150).trim();
    const snippet = result.snippet.replace(/\0/g, "").slice(0, 8000).trim();
    if (!title || !snippet) continue;
    url.hash = "";
    documents.push({ id: randomUUID(), title, sourceUrl: url.toString(), text: `WEB SEARCH SNIPPET — not the full page. Retrieved ${new Date().toISOString()}.\n${snippet}` });
    if (documents.length === 3) break;
  }
  if (!documents.length) throw new Error("No usable web search snippets were returned. Try a more specific query.");
  return documents;
}
module.exports = { searchWeb };
