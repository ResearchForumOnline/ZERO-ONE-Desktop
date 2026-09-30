"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildCompletionAdapter, cleanImportedDocument, normalizeResearchRequest, DOCUMENT_BYTES, RESPONSE_BYTES, STAGE_TIMEOUT_MS } = require("./zerothink-desktop.cjs");

const messages = [{ role: "system", content: "Use supplied sources only." }, { role: "user", content: "Explain the synthetic fixture." }];
const defaults = { provider: "openzero", mode: "server", endpoint: "http://127.0.0.1:1024", token: "synthetic-token", model: "synthetic-model" };
const completion = (content = "Fixture answer", usage = { prompt_tokens: 20, completion_tokens: 10 }) => new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), { headers: { "Content-Type": "application/json" } });

test("research request normalization preserves only bounded engine inputs and source metadata", () => {
  const value = normalizeResearchRequest({ question: "  Question?  ", documents: [{ id: "S1", title: "C:\\private\\source.md", text: " evidence ", sourceUrl: "https://example.org/paper" }], processId: "synthetic-process", ignored: "discarded" });
  assert.deepEqual(value, { question: "Question?", mode: "research", maxPasses: 3, tokenBudget: 3072, documents: [{ id: "S1", title: "source.md", text: "evidence", sourceUrl: "https://example.org/paper" }], processId: "synthetic-process" });
  assert.deepEqual(normalizeResearchRequest({ question: "Q", mode: "quick", maxPasses: 1, tokenBudget: 512 }).documents, []);
});

test("research validation rejects invalid modes, passes, budget, identifiers and sources", () => {
  for (const value of [null, {}, { question: "" }, { question: "x".repeat(12001) }, { question: "Q", mode: "execute" }, { question: "Q", maxPasses: 4 }, { question: "Q", maxPasses: "3" }, { question: "Q", tokenBudget: 6145 }, { question: "Q", processId: "../private" }, { question: "Q", documents: Array(9).fill({ title: "a", text: "b" }) }, { question: "Q", documents: [{ title: "a", text: "b", sourceUrl: "https://secret:token@example.org/" }] }, { question: "Q", documents: [{ id: "S1", title: "a", text: "b" }, { id: "S1", title: "b", text: "c" }] }]) {
    assert.throws(() => normalizeResearchRequest(value), { name: "ValidationError" });
  }
  assert.throws(() => normalizeResearchRequest({ question: "Q", documents: [{ title: "a", text: "é".repeat(DOCUMENT_BYTES) }] }));
  assert.throws(() => normalizeResearchRequest({ question: "Q", documents: [1, 2, 3].map(i => ({ title: `${i}.txt`, text: "a".repeat(DOCUMENT_BYTES) })) }));
});

test("text imports accept portable UTF-8 documents without disclosing an absolute path", () => {
  for (const extension of ["txt", "md", "csv", "json", "TXT"]) {
    assert.deepEqual(cleanImportedDocument(`C:\\private\\data.${extension}`, Buffer.from("\ufeffSynthetic evidence\n", "utf8")), { title: `data.${extension}`, text: "Synthetic evidence" });
  }
});

test("text imports reject binary, malformed, NUL, empty and oversized documents", () => {
  for (const [name, bytes] of [["source.pdf", Buffer.from("a")], ["source.txt", Buffer.alloc(0)], ["source.txt", Buffer.alloc(DOCUMENT_BYTES + 1)], ["source.txt", Buffer.from([0xc3, 0x28])], ["source.txt", Buffer.from("a\0b")]]) {
    assert.throws(() => cleanImportedDocument(name, bytes), { name: "ValidationError" });
  }
  assert.throws(() => cleanImportedDocument("file.txt", "not a buffer"));
});

test("OpenZero transport sends bounded nonstream chat, credentials only in headers and no redirect follow", async () => {
  let request;
  const engine = buildCompletionAdapter({ ...defaults, fetch: async (url, options) => { request = { url, options }; return completion(); } });
  const result = await engine.complete({ messages, maxTokens: 2048, stage: "draft" });
  assert.equal(request.url, "http://127.0.0.1:1024/v1/chat/completions");
  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.headers.Authorization, "Bearer synthetic-token");
  const body = JSON.parse(request.options.body);
  assert.equal(body.max_tokens, 2048); assert.equal(body.stream, false); assert.equal(body.model, "synthetic-model");
  assert.ok(!request.options.body.includes("synthetic-token"));
  assert.deepEqual(result, { content: "Fixture answer", usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } });
});

test("OpenAI and Groq retain their full compatible paths and use their selected key", async () => {
  for (const [provider, endpoint] of [["openai", "https://api.openai.com/v1/chat/completions"], ["groq", "https://api.groq.com/openai/v1/chat/completions"]]) {
    const engine = buildCompletionAdapter({ ...defaults, provider, endpoint, fetch: async (url, options) => { assert.equal(url, endpoint); assert.equal(options.headers.Authorization, "Bearer synthetic-token"); return completion(); } });
    assert.equal((await engine.complete({ messages })).content, "Fixture answer");
  }
  const engine = buildCompletionAdapter({ ...defaults, endpoint: "https://operator.example/prefix/v1", fetch: async (url) => { assert.equal(url, "https://operator.example/prefix/v1/chat/completions"); return completion(); } });
  await engine.complete({ messages });
});

test("Ollama local transport uses api/chat and its actual counters", async () => {
  for (const choice of [{ provider: "ollama" }, { provider: "openzero", mode: "local" }]) {
    const engine = buildCompletionAdapter({ ...defaults, ...choice, endpoint: "http://127.0.0.1:11434", token: "", fetch: async (url, options) => {
      assert.equal(url, "http://127.0.0.1:11434/api/chat");
      const body = JSON.parse(options.body); assert.equal(body.stream, false); assert.equal(body.options.num_predict, 1024); assert.equal(options.headers.Authorization, undefined);
      return new Response(JSON.stringify({ message: { content: "Local answer" }, prompt_eval_count: 18, eval_count: 7 }));
    } });
    assert.deepEqual(await engine.complete({ messages }), { content: "Local answer", usage: { inputTokens: 18, outputTokens: 7, totalTokens: 25 } });
  }
});

test("Store edition rejects local Ollama routing and permits an existing self-hosted OpenZero server", async () => {
  assert.throws(() => buildCompletionAdapter({ ...defaults, mode: "local", storeManaged: true }));
  assert.throws(() => buildCompletionAdapter({ ...defaults, provider: "ollama", storeManaged: true }));
  const engine = buildCompletionAdapter({ ...defaults, storeManaged: true, fetch: async () => completion() });
  assert.equal((await engine.complete({ messages })).content, "Fixture answer");
});

test("invalid provider, endpoint, credential and model configuration is rejected before transport", () => {
  for (const override of [{ provider: "other" }, { mode: "other" }, { endpoint: "http://remote.example/v1" }, { endpoint: "http://127.0.0.1.evil.example/v1" }, { endpoint: "https://user:pass@example.org/v1" }, { endpoint: "https://example.org/v1?token=secret" }, { endpoint: "https://example.org/v1#token" }, { endpoint: "https://169.254.169.254/v1" }, { endpoint: "https://example.org/admin" }, { token: "key\r\nX-Test: injected" }, { model: "" }, { model: "m\nnew" }, { provider: "groq", token: "" }, { signal: {} }]) {
    assert.throws(() => buildCompletionAdapter({ ...defaults, ...override }), { name: "ValidationError" });
  }
});

test("completion limits and message role/text validation precede any network call", async () => {
  let calls = 0;
  const engine = buildCompletionAdapter({ ...defaults, fetch: async () => { calls++; return completion(); } });
  for (const request of [{}, { messages: [] }, { messages, maxTokens: 2049 }, { messages, maxTokens: 0 }, { messages, maxTokens: "2048" }, { messages: [{ role: "tool", content: "x" }] }, { messages: [{ role: "user", content: "x\0y" }] }, { messages, signal: {} }, { messages, stage: "x".repeat(81) }]) await assert.rejects(engine.complete(request), { name: "ValidationError" });
  assert.equal(calls, 0);
});

test("provider error bodies, transport exceptions and redirects never expose credentials or private URL details", async () => {
  for (const status of [302, 401, 403, 429, 500]) {
    const engine = buildCompletionAdapter({ ...defaults, fetch: async () => new Response("synthetic-token private provider error", { status }) });
    await assert.rejects(engine.complete({ messages }), error => !error.message.includes("synthetic-token") && !error.message.includes("private provider"));
  }
  const engine = buildCompletionAdapter({ ...defaults, fetch: async () => { throw new Error("https://private.server/path?key=synthetic-token"); } });
  await assert.rejects(engine.complete({ messages }), error => error.message === "The model connection failed; check the selected server and network.");
});

test("advertised and streamed oversized responses are rejected within one MiB", async () => {
  const advertised = buildCompletionAdapter({ ...defaults, fetch: async () => new Response("{}", { headers: { "Content-Length": String(RESPONSE_BYTES + 1) } }) });
  await assert.rejects(advertised.complete({ messages }), /one MiB/);
  let cancelled = false;
  const streamed = buildCompletionAdapter({ ...defaults, fetch: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(RESPONSE_BYTES)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } })) });
  await assert.rejects(streamed.complete({ messages }), /one MiB/);
  assert.equal(cancelled, true);
});

test("malformed JSON, binary UTF-8, empty and nontext completions fail safely", async () => {
  for (const body of ["{broken", Buffer.from([0xff]), JSON.stringify({ choices: [{ message: { content: "" } }] }), JSON.stringify({ choices: [{ message: { content: ["text"] } }] }), "null"]) {
    const engine = buildCompletionAdapter({ ...defaults, fetch: async () => new Response(body) });
    await assert.rejects(engine.complete({ messages }));
  }
});

test("visible content excludes think blocks and usage never accepts negative or fabricated string counts", async () => {
  const engine = buildCompletionAdapter({ ...defaults, fetch: async () => completion("<think>private reasoning</think>\nPublic answer", { prompt_tokens: "20", completion_tokens: -5, total_tokens: 999 }) });
  assert.deepEqual(await engine.complete({ messages }), { content: "Public answer", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } });
  const incomplete = buildCompletionAdapter({ ...defaults, fetch: async () => completion("<think>private reasoning") });
  await assert.rejects(incomplete.complete({ messages }), /no visible answer/);
});

test("pre-aborted and in-flight cancellation terminate stages even if a mocked transport ignores the signal", async () => {
  const before = new AbortController(); before.abort();
  let calls = 0;
  const engine = buildCompletionAdapter({ ...defaults, fetch: async () => { calls++; return new Promise(() => {}); } });
  await assert.rejects(engine.complete({ messages, signal: before.signal }), { name: "AbortError" });
  assert.equal(calls, 0);
  const during = new AbortController();
  const pending = engine.complete({ messages, signal: during.signal }); during.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("cancellation releases a streaming response body", async () => {
  const controller = new AbortController();
  let cancelled = false;
  let begun;
  const started = new Promise(resolve => { begun = resolve; });
  const engine = buildCompletionAdapter({ ...defaults, fetch: async () => new Response(new ReadableStream({ start() { begun(); }, cancel() { cancelled = true; } })) });
  const pending = engine.complete({ messages, signal: controller.signal });
  await started; await Promise.resolve(); controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await Promise.resolve(); assert.equal(cancelled, true);
});

test("each stage has an enforced 120-second timeout without waiting for a hung transport", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const engine = buildCompletionAdapter({ ...defaults, fetch: async () => new Promise(() => {}) });
  const pending = engine.complete({ messages });
  t.mock.timers.tick(STAGE_TIMEOUT_MS);
  await assert.rejects(pending, { name: "TimeoutError" });
});
