const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyBrowserAction,
  compactSnapshot,
  normalizeApiOrigin,
  normalizeBrowserAction,
  normalizeHttpUrl,
  redactSnapshotUrl,
  requestBrowserPlan,
  requestCompletionBrowserPlan,
} = require("./browser-pilot.cjs");

test("Browser Pilot accepts only credential-free HTTP(S) pages and secure OpenZero origins", () => {
  assert.equal(normalizeHttpUrl("https://example.com/a"), "https://example.com/a");
  assert.throws(() => normalizeHttpUrl("file:///etc/passwd"), /HTTP\(S\)/);
  assert.throws(() => normalizeHttpUrl("https://user:pass@example.com"), /credential-free/);
  assert.equal(normalizeApiOrigin("http://127.0.0.1:1024/"), "http://127.0.0.1:1024");
  assert.throws(() => normalizeApiOrigin("http://example.com"), /HTTPS/);
});

test("Browser Pilot normalizes one bounded action and rejects arbitrary selectors", () => {
  assert.deepEqual(normalizeBrowserAction({ action: "scroll", direction: "down", amount: 99999 }, "https://example.com"), { action: "scroll", reason: "", direction: "down", amount: 2000 });
  assert.throws(() => normalizeBrowserAction({ action: "click", selector: "#send" }, "https://example.com"), /element_id/);
  assert.throws(() => normalizeBrowserAction({ action: "javascript", code: "alert(1)" }, "https://example.com"), /Unsupported/);
});

test("Browser Pilot blocks secrets and pauses consequential, personal, and cross-site actions", () => {
  const snapshot = { url: "https://example.com/a", interactive: [
    { id: "e1", label: "Search", sensitive_kind: "", risk: "ordinary" },
    { id: "e2", label: "Send payment", sensitive_kind: "", risk: "consequential" },
    { id: "e3", label: "API key", sensitive_kind: "secret", risk: "ordinary" },
    { id: "e4", label: "Email", sensitive_kind: "personal", risk: "ordinary" },
  ] };
  assert.equal(classifyBrowserAction({ action: "click", element_id: "e1" }, snapshot).needsApproval, false);
  assert.equal(classifyBrowserAction({ action: "click", element_id: "e2" }, snapshot).needsApproval, true);
  assert.equal(classifyBrowserAction({ action: "type", element_id: "e3", text: "x" }, snapshot).allowed, false);
  assert.equal(classifyBrowserAction({ action: "type", element_id: "e4", text: "a@example.com" }, snapshot).needsApproval, true);
  assert.equal(classifyBrowserAction({ action: "navigate", url: "https://other.example/" }, snapshot).needsApproval, true);
});

test("Browser Pilot snapshots omit values and planner uses the dedicated route", async () => {
  const compact = compactSnapshot({
    snapshot_id: "s1", url: "https://example.com/reset/abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ?token=PRIVATE#secret", title: "Example", text: "body",
    interactive: [{ id: "e1", tag: "input", label: "Name", has_value: true, value: "PRIVATE", href: "https://example.com/action?session=PRIVATE" }],
  });
  assert.equal(compact.interactive[0].has_value, true);
  assert.equal("value" in compact.interactive[0], false);
  assert.equal(compact.url, "https://example.com/reset/redacted");
  assert.equal(compact.interactive[0].href, "https://example.com/action");
  assert.equal(compact.input_value_omitted, true);
  assert.equal(redactSnapshotUrl("https://example.com/a?secret=x#hidden"), "https://example.com/a");
  let request;
  const result = await requestBrowserPlan({
    apiBaseUrl: "http://127.0.0.1:1024", apiKey: "oz_test", model: "m", task: "inspect", snapshot: compact, step: 1, history: [],
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ action: { action: "finish", message: "Done" } }) }; },
  });
  assert.equal(request.url, "http://127.0.0.1:1024/v1/browser/plan");
  assert.equal(request.options.redirect, "error");
  assert.match(request.options.headers.Authorization, /^Bearer /);
  assert.equal(result.action, "finish");

  await assert.rejects(requestBrowserPlan({
    apiBaseUrl: "http://127.0.0.1:1024", apiKey: "oz_stale", model: "m", task: "inspect", snapshot: compact, step: 1, history: [],
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: "Expired" }) }),
  }), (error) => error.status === 401 && /HTTP 401/.test(error.message) && !/Expired/.test(error.message));
});
test("Browser Pilot planner errors never reflect provider credentials or transport details", async () => {
  const marker = "SYNTHETIC_PRIVATE_PLANNER_KEY", request = { apiBaseUrl: "https://synthetic-server.example", apiKey: marker, model: "m", task: "inspect", snapshot: { url: "https://example.com/", interactive: [] }, step: 1, history: [] };
  for (const status of [301, 401, 403, 429, 500]) {
    await assert.rejects(requestBrowserPlan({ ...request, fetchImpl: async () => ({ ok: false, status, json: async () => ({ error: { message: `Synthetic provider echoed ${marker}` } }) }) }), (error) => error.status === status && error.message.includes(`HTTP ${status}`) && !error.message.includes(marker));
  }
  await assert.rejects(requestBrowserPlan({ ...request, fetchImpl: async () => { throw new Error(`Synthetic transport echoed https://user:${marker}@server.example`); } }), (error) => /could not be reached/.test(error.message) && !error.message.includes(marker) && !error.message.includes("https://user"));
});


test("completion planner uses configured chat directly and sends only bounded redacted snapshot fields", async () => {
  let request;
  const marker = "PRIVATE_UNRENDERED_FORM_VALUE";
  const result = await requestCompletionBrowserPlan({ task: "Inspect documentation", step: 2, history: [], snapshot: { url: "https://example.com/a?token=" + marker + "#private", title: "Doc", text: "x".repeat(10000), cookies: marker, viewport: { width: 1200, height: 800, credentials: marker }, interactive: Array.from({ length: 65 }, (_, i) => ({ id: "e" + (i + 1), label: "Read docs", tag: "button", value: marker, password: marker, rawHtml: marker, href: "https://example.com/docs?session=" + marker })) }, complete: async input => { request = input; return { content: '{"action":"click","element_id":"e1","reason":"Read documentation"}' }; } });
  assert.equal(result.action, "click"); assert.equal(request.maxTokens, 1024); assert.equal(request.stage, "browser-plan");
  assert.doesNotMatch(JSON.stringify(request), /PRIVATE_UNRENDERED_FORM_VALUE/);
  const context = JSON.parse(request.messages[1].content); assert.equal(context.snapshot.text.length, 4000); assert.equal(context.snapshot.interactive.length, 40); assert.deepEqual(context.snapshot.viewport, { width: 1200, height: 800 });
  assert.match(request.messages[0].content, /untrusted data/); assert.equal(classifyBrowserAction(result, context.snapshot).allowed, true);
});

test("completion planner rejects tool markup prose fences arrays and unsupported JSON without executing anything", async () => {
  const input = { task: "Read docs", snapshot: { url: "https://example.com", interactive: [] }, step: 1, history: [] };
  for (const content of ['<function=click>', 'Here is the plan: {"action":"finish"}', '```json\n{"action":"finish"}\n```', '[{"action":"finish"}]', '{"action":"javascript","code":"alert(1)"}', '{"action":"click","selector":"#send"}', '{"action":"navigate","url":"file:///private"}', '{"action":"finish"} trailing']) {
    await assert.rejects(requestCompletionBrowserPlan({ ...input, complete: async () => ({ content }) }), /No action was executed/);
  }
});

test("completion planner keeps secret field blocking and consequential approval in existing classifier", async () => {
  const snapshot = { url: "https://example.com", interactive: [{ id: "e1", label: "Token", sensitive_kind: "secret" }, { id: "e2", label: "Publish", risk: "consequential" }] };
  const secret = await requestCompletionBrowserPlan({ snapshot, task: "Inspect", complete: async () => '{"action":"type","element_id":"e1","text":"x"}' });
  assert.equal(classifyBrowserAction(secret, snapshot).allowed, false);
  const publish = await requestCompletionBrowserPlan({ snapshot, task: "Inspect", complete: async () => '{"action":"click","element_id":"e2"}' });
  assert.equal(classifyBrowserAction(publish, snapshot).needsApproval, true);
});

test("completion planner cancellation is immediate even when its adapter hangs", async () => {
  const controller = new AbortController();
  const pending = requestCompletionBrowserPlan({ task: "Inspect", snapshot: { url: "https://example.com" }, signal: controller.signal, complete: async () => new Promise(() => {}) });
  const stopped = assert.rejects(pending, { name: "AbortError" }); controller.abort(); await stopped;
});
