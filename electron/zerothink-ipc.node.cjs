"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createHash, randomUUID } = require("node:crypto");
const { pathToFileURL } = require("node:url");

const rendererURL = pathToFileURL(path.join(__dirname, "..", "dist", "index.html")).href;

function loadMain({ settings = {}, fetcher, dialog = {}, fileSystem = fsp, profile = { persona: "", facts: [] }, agentRunner } = {}) {
  const handlers = new Map();
  const appEvents = new Map();
  const events = [];
  const sender = { id: 42, mainFrame: { url: rendererURL }, isDestroyed: () => false, send: (channel, value) => events.push({ channel, value }) };
  const pilotSession = {};
  const electron = {
    app: { requestSingleInstanceLock: () => true, on: (name, callback) => appEvents.set(name, callback), whenReady: () => ({ then: () => {} }), getVersion: () => "8.0.0", getPath: () => os.tmpdir(), isPackaged: true, commandLine: { appendSwitch: () => {} } },
    ipcMain: { handle: (channel, callback) => handlers.set(channel, callback), on: () => {} },
    dialog,
    safeStorage: { isEncryptionAvailable: () => true },
    session: { fromPartition: () => pilotSession },
  };
  const context = vm.createContext({
    require: (name) => name === "electron" ? electron : name === "node:fs/promises" ? fileSystem : name === "./zerothink-agent.cjs" && agentRunner ? { runAgent: agentRunner } : name.startsWith("./") ? require(path.join(__dirname, name)) : require(name),
    process: { platform: "win32", env: {}, resourcesPath: "C:/synthetic/resources", execPath: "C:/synthetic/ZERO ONE.exe" },
    __dirname, console, URL, Buffer, AbortController, AbortSignal, setTimeout, clearTimeout,
    fetch: fetcher || (() => { throw new Error("Unexpected network request during offline research"); }),
    __testWindow: { webContents: sender }, __testProfile: profile, __testSettings: { assistantProvider: "openzero", openZeroAssistantMode: "server", openZeroUrl: "https://example.org/", model: "synthetic-model", openZeroServerModel: "synthetic-model", ...settings },
  });
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  vm.runInContext(`${source}\nmainWindow = __testWindow; loadSettingsInternal = async () => __testSettings; decryptSecret = () => 'synthetic-key'; decryptToken = () => 'synthetic-key'; localStudio = () => ({ getProfile: async () => __testProfile }); readyVault = async () => ({ snapshot: async () => ({ secure:true, profiles:[] }), getActiveCompletion: async () => null, getServiceKey: async () => "synthetic-key" });`, context);
  const event = { sender, senderFrame: sender.mainFrame };
  function attachContents(contents) {
    const callbacks = new Map();
    contents.on = (name, callback) => callbacks.set(name, callback);
    contents.setWindowOpenHandler = () => {};
    contents.session ||= { setPermissionCheckHandler: () => {}, setPermissionRequestHandler: () => {} };
    appEvents.get("web-contents-created")({}, contents);
    return { navigate: (url) => {
      let prevented = false;
      callbacks.get("will-navigate")({ preventDefault: () => { prevented = true; } }, url);
      return prevented;
    } };
  }
  return { call: (channel, input, target = event) => handlers.get(channel)(target, input), attachContents, event, events, context };
}
const request = () => ({ runId: randomUUID(), question: "How should evidence retrieval be validated?", mode: "research", processId: "evidence-map", documents: [{ id: randomUUID(), title: "Synthetic source", text: "Evidence retrieval should use held-out tasks and record unsupported citations. This is synthetic test material." }], maxPasses: 3, tokenBudget: 3072, useModel: false });

test("native agent approvals bind to the exact preview and reject duplicate or stale responses", async () => {
  const project = await fsp.mkdtemp(path.join(os.tmpdir(), "zerothink-approval-ipc-"));
  const firstId = randomUUID(); const secondId = randomUUID(); const responses = [];
  let firstStarted; let secondStarted;
  const firstReady = new Promise(resolve => { firstStarted = resolve; });
  const secondReady = new Promise(resolve => { secondStarted = resolve; });
  const main = loadMain({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [project] }) }, agentRunner: async (_options, adapters) => {
    const first = adapters.approve({ actionId: firstId, tool: "write_file", path: "first.txt", before: "", after: "first preview" });
    firstStarted(); responses.push(await first);
    const second = adapters.approve({ actionId: secondId, tool: "run_command", command: "echo second-preview", cwd: project });
    secondStarted(); responses.push(await second);
    return { status: "paused", answer: "Synthetic approval lifecycle check", steps: 2, reads: 0, edits: 0, commands: 0, errors: [], changedFiles: [], observations: [] };
  } });
  try {
    await main.call("zerothink:project-select");
    const runId = randomUUID();
    const running = main.call("zerothink:agent-run", { runId, task: "Synthetic approval check", maxSteps: 4 });
    await firstReady;
    assert.equal(main.call("zerothink:agent-approve", { runId, actionId: randomUUID(), approved: true }).accepted, false);
    assert.equal(main.call("zerothink:agent-approve", { runId, approved: true }).accepted, false);
    assert.equal(main.call("zerothink:agent-approve", { runId, actionId: firstId, approved: true }).accepted, true);
    assert.equal(main.call("zerothink:agent-approve", { runId, actionId: firstId, approved: true }).accepted, false);
    await secondReady;
    // An old request cannot approve the next command, even inside the same run.
    assert.equal(main.call("zerothink:agent-approve", { runId, actionId: firstId, approved: true }).accepted, false);
    assert.equal(main.events.filter(event => event.channel === "zerothink:agent-progress" && event.value.pending).at(-1).value.pending.actionId, secondId);
    assert.equal(main.call("zerothink:agent-approve", { runId, actionId: secondId, approved: false }).accepted, true);
    await running;
    assert.deepEqual(responses, [true, false]);
    assert.equal(main.call("zerothink:agent-approve", { runId, actionId: secondId, approved: true }).accepted, false);
  } finally { await fsp.rm(project, { recursive: true, force: true }); }
});

test("all ZeroThink IPC methods reject other frames before acting", async () => {
  const main = loadMain();
  for (const channel of ["zerothink:vault-get", "zerothink:vault-save", "zerothink:vault-delete", "zerothink:vault-select", "zerothink:quantum", "zerothink:templates-list", "zerothink:template-save", "zerothink:template-delete", "zerothink:template-render", "zerothink:processes", "zerothink:import", "zerothink:run", "zerothink:cancel", "zerothink:export", "zerothink:sessions-list", "zerothink:session-get", "zerothink:session-save", "zerothink:session-delete", "zerothink:library-list", "zerothink:library-save", "zerothink:profile-get", "zerothink:profile-save", "zerothink:web-search", "zerothink:project-select", "zerothink:agent-run", "zerothink:agent-approve", "notes:import", "notes:export"]) {
    await assert.rejects(async () => main.call(channel, request(), { sender: main.event.sender, senderFrame: {} }), /untrusted renderer/);
    await assert.rejects(async () => main.call(channel, request(), { sender: { id: 42 }, senderFrame: {} }), /untrusted renderer/);
  }
});

test("privileged IPC rejects a main frame that navigated away from the exact packaged renderer", async () => {
  const main = loadMain();
  const original = main.event.senderFrame.url;
  for (const url of ["https://talktoai.org/", "http://127.0.0.1:1024/", "https://example.org/", "about:blank", pathToFileURL(path.join(__dirname, "..", "dist", "other.html")).href, ""]) {
    main.event.senderFrame.url = url;
    for (const channel of ["notes:list", "zerothink:processes", "zerothink:import", "zerothink:run", "zerothink:cancel", "zerothink:export"]) {
      await assert.rejects(async () => main.call(channel, request()), /untrusted renderer/);
    }
  }
  main.event.senderFrame.url = original;
  assert.equal(main.call("zerothink:processes").length, 9);
});

test("main-window navigation rejects remote pages while isolated workspace navigation keeps its allowlist", () => {
  const main = loadMain();
  const privileged = main.attachContents(main.event.sender);
  assert.equal(privileged.navigate(rendererURL), false);
  for (const url of ["https://talktoai.org/", "http://127.0.0.1:1024/", "https://github.com/ResearchForumOnline", "https://unconfigured.example/"]) {
    assert.equal(privileged.navigate(url), true);
  }
  const workspace = main.attachContents({});
  assert.equal(workspace.navigate("https://talktoai.org/"), false);
  assert.equal(workspace.navigate("http://127.0.0.1:1024/"), false);
  assert.equal(workspace.navigate("https://unconfigured.example/"), true);
});

test("desktop IPC executes the real offline engine and emits run-specific progress without networking", async () => {
  const main = loadMain();
  const processes = main.call("zerothink:processes");
  assert.equal(processes.length, 9);
  assert.ok(processes.every((entry) => entry.label && entry.description));
  const input = request();
  const result = await main.call("zerothink:run", input);
  assert.equal(result.status, "offline");
  assert.equal(result.metrics.passes, 0);
  assert.ok(result.evidence.some((entry) => entry.sourceId === "S1"));
  assert.ok(result.markdown.includes("held-out"));
  assert.ok(main.events.length > 0);
  assert.ok(main.events.every((entry) => entry.channel === "zerothink:progress" && entry.value.runId === input.runId));
});

test("desktop IPC uses only the chosen provider for draft, critique and revision", async () => {
  const requests = [];
  const main = loadMain({ settings: { assistantProvider: "groq", model: "synthetic-groq" }, fetcher: async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body), redirect: options.redirect });
    return new Response(JSON.stringify({ choices: [{ message: { content: "A held-out test is proposed [S1]." } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }), { status: 200 });
  } });
  const result = await main.call("zerothink:run", { ...request(), useModel: true });
  assert.equal(result.status, "completed"); assert.equal(result.metrics.passes, 3);
  assert.equal(requests.length, 3);
  assert.ok(requests.every((entry) => entry.url === "https://api.groq.com/openai/v1/chat/completions" && entry.redirect === "error" && entry.body.model === "synthetic-groq"));
  assert.ok(requests.reduce((sum, entry) => sum + entry.body.max_tokens, 0) <= 3072);
  assert.ok(!JSON.stringify(result).includes("synthetic-key"));
});

test("the two-pass UI label matches the real draft and revision stages", async () => {
  const main = loadMain({ settings: { assistantProvider: "groq", model: "synthetic-groq" }, fetcher: async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "Test the source against held-out tasks [S1]." } }] }), { status: 200 }) });
  const result = await main.call("zerothink:run", { ...request(), maxPasses: 2, useModel: true });
  assert.deepEqual(Array.from(result.steps, (entry) => entry.id), ["retrieve", "draft", "revise"]);
  const workspace = fs.readFileSync(path.join(__dirname, "..", "src", "ZeroThinkWorkspace.tsx"), "utf8");
  assert.ok(workspace.includes('<option value={2}>2 · Draft + revision</option>'));
  assert.ok(!workspace.includes('<option value={2}>2 · Draft + critique</option>'));
});

test("bundled engine provenance preserves the published portable record exactly", () => {
  const publishedHashes = {
    "engine.cjs": "d0b1c0a9131e6cfad56f75aa8bba21b30219d8452761ba8c6beabc15f80d7498",
    "templates.cjs": "237f8fc9c5b60279be53c88b1463a80bda54278cea080e454790a3617b2fe0fd",
    "LICENSE": "c95bae1d1ce0235ecccd3560b772ec1efb97f348a79f0fbe0a634f0c2ccefe2c",
    "NOTICE": "4caab4d66a62df3578ba7fab581c524ce5f7d2578bdab7324a8c85d223e35575",
    "PROVENANCE.json": "b9f70483a419b6c06870c187f2c6075849c73b8743e95eee98245aec8f27e65d",
  };
  for (const [filename, expectedHash] of Object.entries(publishedHashes)) {
    const bytes = fs.readFileSync(path.join(__dirname, "zerothink", filename));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash, filename);
  }
  const provenance = fs.readFileSync(path.join(__dirname, "zerothink", "PROVENANCE.json"));
  assert.equal(createHash("sha256").update(provenance).digest("hex"), "b9f70483a419b6c06870c187f2c6075849c73b8743e95eee98245aec8f27e65d");
  const record = JSON.parse(provenance);
  assert.equal(record.version, "1.0.0");
  assert.equal(record.license, "Apache-2.0");
  assert.ok(record.claim_boundary.includes("not scientific novelty"));
});

test("Stop cancels the active model request, prevents future passes and permits a later offline run", async () => {
  let began;
  const started = new Promise((resolve) => { began = resolve; });
  const main = loadMain({ fetcher: async (_url, options) => {
    began();
    return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")), { once: true }));
  } });
  const input = { ...request(), useModel: true };
  const running = main.call("zerothink:run", input);
  await started;
  await assert.rejects(main.call("zerothink:run", request()), /already active/);
  assert.equal(main.call("zerothink:cancel", { runId: randomUUID() }).cancelled, false);
  assert.equal(main.call("zerothink:cancel", { runId: input.runId }).cancelled, true);
  await assert.rejects(running, /research stopped/);
  assert.equal((await main.call("zerothink:run", request())).status, "offline");
});

test("local file import checks a selected descriptor and returns no absolute path", async () => {
  const fixture = path.join(__dirname, "..", "tests", "fixtures", "local-research.md");
  const main = loadMain({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [fixture] }) } });
  const imported = await main.call("zerothink:import");
  assert.equal(imported.length, 1); assert.equal(imported[0].title, "local-research.md");
  assert.ok(imported[0].text.includes("Synthetic research fixture"));
  assert.ok(!JSON.stringify(imported).includes(__dirname));
});

test("report exports write only to the user's selected destination and honor cancellation", async () => {
  const writes = [];
  const main = loadMain({ dialog: { showSaveDialog: async () => ({ canceled: false, filePath: "synthetic-chosen.md" }) }, fileSystem: { ...fsp, writeFile: async (...args) => writes.push(args) } });
  const result = await main.call("zerothink:run", request());
  assert.equal((await main.call("zerothink:export", { format: "markdown", result })).saved, true);
  assert.equal(writes[0][0], "synthetic-chosen.md"); assert.equal(writes[0][1], result.markdown);
  const cancelled = loadMain({ dialog: { showSaveDialog: async () => ({ canceled: true }) }, fileSystem: { ...fsp, writeFile: async () => { throw new Error("Unexpected write"); } } });
  assert.equal((await cancelled.call("zerothink:export", { format: "json", result })).saved, false);
  await assert.rejects(main.call("zerothink:export", { format: "json", result: { markdown: "x".repeat(3 * 1024 * 1024) } }), /export size limit/);
});
