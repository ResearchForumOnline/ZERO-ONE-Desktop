"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { searchWeb } = require("./zerothink-web.cjs");
test("search requires a key and never sends an invalid query", async () => {
  const fetcher = () => { throw new Error("Unexpected request"); };
  await assert.rejects(searchWeb("test", { fetcher }), /Serper/);
  await assert.rejects(searchWeb("\0", { key: "synthetic", fetcher }), /2,000/);
});
test("web search only uses fixed Serper HTTPS endpoint and returns labelled safe snippets", async () => {
  const result = await searchWeb("synthetic research", { key: "synthetic-test-key", fetcher: async (url, options) => {
    assert.equal(url, "https://google.serper.dev/search");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["X-API-KEY"], "synthetic-test-key");
    assert.deepEqual(JSON.parse(options.body), { q: "synthetic research", num: 3 });
    return new Response(JSON.stringify({ organic: [{ title: "Unsafe", snippet: "x", link: "https://key:secret@example.org/" }, { title: "Article", snippet: "A synthetic excerpt", link: "https://example.org/article#x" }] }));
  } });
  assert.equal(result.length, 1);
  assert.equal(result[0].sourceUrl, "https://example.org/article");
  assert.match(result[0].text, /not the full page/);
  assert.ok(!JSON.stringify(result).includes("synthetic-test-key"));
});
test("limits and quota errors remain explicit", async () => {
  await assert.rejects(searchWeb("test", { key: "synthetic", fetcher: async () => new Response("{}", { status: 429 }) }), /limit was reached/);
  await assert.rejects(searchWeb("test", { key: "synthetic", fetcher: async () => new Response("{}", { headers: { "content-length": "1048577" } }) }), /size limit/);
  await assert.rejects(searchWeb("test", { key: "synthetic", fetcher: async () => new Response("{}") }), /No usable/);
});
