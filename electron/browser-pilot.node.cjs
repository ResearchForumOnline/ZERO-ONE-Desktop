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
