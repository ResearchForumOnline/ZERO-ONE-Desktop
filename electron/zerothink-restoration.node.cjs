"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const vm = require("node:vm");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { definition, endpointFor } = require("./zerothink-providers.cjs");
const { normalizeTemplate } = require("./zerothink-templates.cjs");
const rendererURL = pathToFileURL(path.join(__dirname, "..", "dist", "index.html")).href;
const channelMethods = { getZeroThinkVault: "zerothink:vault-get", saveZeroThinkVaultProfile: "zerothink:vault-save", deleteZeroThinkVaultProfile: "zerothink:vault-delete", selectZeroThinkVaultProfile: "zerothink:vault-select", quantumZeroThinkRequest: "zerothink:quantum", quantumZeroThinkIBM: "zerothink:quantum-ibm", listZeroThinkTemplates: "zerothink:templates-list", saveZeroThinkTemplate: "zerothink:template-save", deleteZeroThinkTemplate: "zerothink:template-delete", renderZeroThinkTemplate: "zerothink:template-render" };
function memoryVault(active = null, secure = true) {
  const profiles = active ? [{ ...active }] : [], calls = [];
  const publicSnapshot = () => ({ secure, activeProfileId: active?.id || null, profiles: profiles.map(({ key, ...item }) => ({ ...item, hasKey: Boolean(key) })) });
  return { calls, profiles,
    snapshot: async () => { calls.push("snapshot"); return publicSnapshot(); },
    getActiveCompletion: async () => { calls.push("active"); if (!secure) throw new Error("Secure storage unavailable"); return active; },
    getServiceKey: async (provider, expectedEndpoint) => { calls.push(`key:${provider}`); if (!secure) throw new Error("Secure storage unavailable"); const endpoint = expectedEndpoint === undefined ? null : endpointFor(provider, expectedEndpoint); return profiles.find((item) => item.provider === provider && (endpoint === null || item.endpoint === endpoint))?.key || ""; },
    selectProfile: async (id) => { calls.push(`select:${id}`); active = id === null ? null : profiles.find((item) => item.id === id); return publicSnapshot(); },
    migrateLegacy: async (input) => { calls.push({ migrate: input }); for (const [provider, field] of [["openai", "openAiKey"], ["groq", "groqKey"], ["serper", "serperKey"], ["openzero", "openZeroToken"]]) { if (input[field] && !profiles.some((item) => item.provider === provider)) profiles.push({ id: `legacy-${provider}`, provider, kind: definition(provider).kind, name: "Synthetic migrated profile", model: definition(provider).defaultModel || input.openZeroServerModel, endpoint: definition(provider).endpoint || input.openZeroUrl, key: input[field] }); } return publicSnapshot(); },
    saveProfile: async (input) => { calls.push({ save: input }); const index = profiles.findIndex((entry) => entry.id === input.id); const item = { ...(index >= 0 ? profiles[index] : {}), ...input, id: input.id || randomUUID(), kind: definition(input.provider).kind, key: input.clearKey ? "" : input.key === undefined ? profiles[index]?.key || "" : input.key }; if (index >= 0) profiles[index] = item; else profiles.push(item); return publicSnapshot(); },
  };
}
function loadMain({ active, secure = true, settings = {}, migration = false, decrypt = (bytes) => bytes.toString("utf8"), template, agentRunner, dialog = {}, fetcher } = {}) {
  const handlers = new Map(), events = [], writes = [], vault = memoryVault(active || null, secure);
  const sender = Object.assign(new (require("node:events").EventEmitter)(), { id: 91, mainFrame: { url: rendererURL }, isDestroyed: () => false, send: (channel, value) => events.push({ channel, value }) });
  const electron = { app: { requestSingleInstanceLock: () => true, on: () => {}, whenReady: () => ({ then: () => {} }), getVersion: () => "8.2.0", getPath: () => os.tmpdir(), isPackaged: true, commandLine: { appendSwitch: () => {} }, setLoginItemSettings: () => {} }, ipcMain: { handle: (channel, callback) => handlers.set(channel, callback), on: () => {} }, safeStorage: { isEncryptionAvailable: () => secure, decryptString: decrypt }, dialog, session: { fromPartition: () => ({}) } };
  const templateStore = { list: async () => template ? [template] : [], save: async (value) => normalizeTemplate(value), delete: async () => true };
  const context = vm.createContext({ require: (name) => name === "electron" ? electron : name === "./zerothink-agent.cjs" && agentRunner ? { runAgent: agentRunner } : name.startsWith("./") ? require(path.join(__dirname, name)) : require(name), __dirname, console, URL, Buffer, AbortController, AbortSignal, setTimeout, clearTimeout,
    process: { platform: "win32", env: {}, resourcesPath: "C:/synthetic/resources", execPath: "C:/synthetic/ZERO ONE.exe" },
    fetch: fetcher || (() => { throw new Error("Unexpected network request in a synthetic integration check"); }), __sender: sender, __vault: vault, __writes: writes, __templates: templateStore,
    __settings: { assistantProvider: "groq", model: "synthetic-legacy-model", openZeroAssistantMode: "server", openZeroUrl: "https://example.org/", openZeroServerModel: "synthetic-server", closeToTray: true, ...settings },
  });
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  vm.runInContext(`${source}\nmainWindow = { webContents: __sender }; loadSettingsInternal = async () => __settings; localStudio = () => ({ getProfile: async () => ({ persona: '', facts: [] }) }); localVault = () => __vault; localTemplates = () => __templates; atomicSettingsWrite = async (value) => { __writes.push(value); }; ${migration ? "" : "readyVault = async () => __vault;"}`, context);
  const event = { sender, senderFrame: sender.mainFrame };
  return { call: (channel, input, target = event) => handlers.get(channel)(target, input), context, event, events, vault, writes, evaluate: (code) => vm.runInContext(code, context) };
}
function activeProfile(provider = "gemini") { const metadata = definition(provider); return { id: "synthetic-active-profile", name: "Synthetic selected profile", provider, kind: "chat", model: provider === "gemini" ? "gemini-2.5-flash" : provider === "anthropic" ? "claude-sonnet-4-5" : "synthetic-vault-model", endpoint: metadata.endpoint, key: "SYNTHETIC_FIXTURE_KEY" }; }
function modelResponse(provider) { return provider === "gemini" ? { candidates: [{ content: { parts: [{ text: "SYNTHETIC_VAULT_ANSWER [S1]" }] } }] } : provider === "anthropic" ? { content: [{ type: "text", text: "SYNTHETIC_VAULT_ANSWER [S1]" }] } : { choices: [{ message: { content: "SYNTHETIC_VAULT_ANSWER [S1]" } }], model: "synthetic-vault-model" }; }
const researchRequest = (mode = "research") => ({ runId: randomUUID(), question: "Compare the synthetic observations", mode, processId: "evidence-map", documents: [{ id: randomUUID(), title: "Synthetic evidence", text: "A synthetic observation has ten units. These are invented test values, not real research results." }], maxPasses: 1, tokenBudget: 1024, useModel: true });

test("the native vault selection drives Assistant, Studio chat and Research execution", async () => {
  for (const provider of ["gemini", "anthropic", "nvidia"]) {
    const profile = activeProfile(provider), network = [];
    const main = loadMain({ active: profile, fetcher: async (url, options) => { network.push({ url, headers: options.headers, body: JSON.parse(options.body), redirect: options.redirect }); return new Response(JSON.stringify(modelResponse(provider)), { status: 200 }); } });
    const assistant = await main.call("openzero:chat", { model: "SHOULD_NOT_OVERRIDE_VAULT", messages: [{ role: "user", content: "Synthetic assistant query" }] });
    assert.match(assistant.content, /SYNTHETIC_VAULT_ANSWER/);
    for (const mode of ["chat", "research"]) { const result = await main.call("zerothink:run", researchRequest(mode)); assert.equal(result.status, "completed"); assert.match(result.answer, /SYNTHETIC_VAULT_ANSWER/); assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_FIXTURE_KEY/); }
    assert.equal(network.length, 3); assert.ok(network.every((entry) => entry.url.startsWith(profile.endpoint) && entry.redirect === "error"));
    assert.ok(network.every((entry) => JSON.stringify(entry.body).includes(provider === "gemini" ? "Synthetic" : profile.model) || provider === "gemini"));
    assert.ok(!network.some((entry) => entry.url.startsWith("https://api.groq.com/")));
  }
});
test("native Agent receives the same selected vault completion transport", async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "zt-restoration-agent-")); t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const requests = [], profile = activeProfile("anthropic");
  const main = loadMain({ active: profile, dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [root] }) }, fetcher: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return new Response(JSON.stringify(modelResponse("anthropic")), { status: 200 }); }, agentRunner: async (_input, adapters) => { const response = await adapters.complete({ messages: [{ role: "user", content: "Synthetic project execution transport check" }], maxTokens: 512 }); return { status: "completed", answer: response.content, steps: 1, reads: 0, edits: 0, commands: 0, errors: [], changedFiles: [], observations: [] }; } });
  await main.call("zerothink:project-select"); const result = await main.call("zerothink:agent-run", { runId: randomUUID(), task: "Synthetic transport check", maxSteps: 8 });
  assert.match(result.answer, /SYNTHETIC_VAULT_ANSWER/); assert.equal(requests.length, 1); assert.equal(requests[0].url, profile.endpoint); assert.equal(requests[0].body.model, profile.model);
});
test("the Quantum IPC executes a local Bell simulation without vault credentials or a network call", async () => {
  const main = loadMain({ secure: false });
  const result = await main.call("zerothink:quantum", { action: "local", circuit: { qubits: 2, circuit: [{ gate: "h", target: 0 }, { gate: "cnot", control: 0, target: 1 }] }, shots: 256, seed: 1 });
  assert.equal(result.status, "completed"); assert.equal(result.provenance, "local-ideal-statevector");
  assert.ok(Math.abs(result.probabilities["00"] - 0.5) < 1e-12); assert.ok(Math.abs(result.probabilities["11"] - 0.5) < 1e-12);
  assert.equal(Object.values(result.counts).reduce((total, count) => total + count, 0), 256); assert.equal(main.vault.calls.length, 0);
});
test("the IonQ discovery IPC obtains only its user-owned service key from the native vault", async () => {
  const requests = [], key = "SYNTHETIC_IONQ_FIXTURE_KEY", main = loadMain({ active: { ...activeProfile(), provider: "ionq", kind: "quantum", key }, fetcher: async (url, options) => { requests.push({ url, options }); return new Response(JSON.stringify([{ backend: "simulator", qubits: 29, status: "available" }]), { status: 200 }); } });
  const result = await main.call("zerothink:quantum", { action: "backends" });
  assert.equal(result.backends[0].backend, "simulator"); assert.equal(requests.length, 1); assert.equal(requests[0].url, "https://api.ionq.co/v0.4/backends");
  assert.equal(requests[0].options.headers.Authorization, `apiKey ${key}`); assert.equal(requests[0].options.method, "GET"); assert.equal(requests[0].options.redirect, "error");
  assert.ok(main.vault.calls.includes("key:ionq")); assert.ok(!main.vault.calls.some((entry) => typeof entry === "string" && /key:(ibm|openai|groq)/.test(entry))); assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_IONQ_FIXTURE_KEY/);
});
test("the IBM discovery IPC authenticates its own vault key and performs read-only backend queries", async () => {
  const requests = [], key = "SYNTHETIC_IBM_FIXTURE_KEY", bearer = "SYNTHETIC_IBM_BEARER", instanceCRN = "crn:v1:bluemix:public:quantum-computing:us-east:a/synthetic-account:synthetic-instance::";
  const main = loadMain({ active: { ...activeProfile(), provider: "ibm", kind: "quantum", key }, fetcher: async (url, options) => { requests.push({ url, options }); return new Response(JSON.stringify(requests.length === 1 ? { access_token: bearer, token_type: "Bearer", expires_in: 3600 } : { devices: [{ name: "ibm_synthetic", status: { name: "online" }, qubits: 127 }] }), { status: 200 }); } });
  const result = await main.call("zerothink:quantum-ibm", { action: "backends", instanceCRN, region: "us-east" });
  assert.equal(result.backends[0].name, "ibm_synthetic"); assert.equal(result.provenance, "ibm-quantum-compute-rest"); assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://iam.cloud.ibm.com/identity/token"); assert.equal(requests[0].options.method, "POST"); assert.equal(new URLSearchParams(requests[0].options.body).get("apikey"), key);
  assert.equal(requests[1].url, "https://quantum.cloud.ibm.com/api/v1/backends?fields=wait_time_seconds"); assert.equal(requests[1].options.method, "GET"); assert.equal(requests[1].options.headers.Authorization, `Bearer ${bearer}`); assert.equal(requests[1].options.headers["Service-CRN"], instanceCRN);
  assert.ok(requests.every((request) => request.options.redirect === "error")); assert.ok(main.vault.calls.includes("key:ibm")); assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_IBM_FIXTURE_KEY|SYNTHETIC_IBM_BEARER/);
});
test("every restored vault/template/quantum handler rejects untrusted frames before provider or storage access", async () => {
  const main = loadMain({ active: activeProfile() });
  for (const channel of Object.values(channelMethods)) { await assert.rejects(async () => main.call(channel, {}, { sender: main.event.sender, senderFrame: {} }), /untrusted renderer/); await assert.rejects(async () => main.call(channel, {}, { sender: { id: main.event.sender.id }, senderFrame: main.event.senderFrame }), /untrusted renderer/); }
  assert.equal(main.vault.calls.length, 0);
});
test("the renderer preload maps every restored API to its privileged handler", async () => {
  const invocations = [], listeners = [], context = vm.createContext({ require: (name) => { if (name !== "electron") throw new Error("Unexpected preload dependency"); return { contextBridge: { exposeInMainWorld: (name, api) => { context.api = api; context.exposedName = name; } }, ipcRenderer: { invoke: async (channel, ...args) => { invocations.push({ channel, args }); }, on: (...args) => listeners.push(args), removeListener: () => {} } }; } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "preload.cjs"), "utf8"), context); assert.equal(context.exposedName, "zeroOne");
  for (const [method, channel] of Object.entries(channelMethods)) { assert.equal(typeof context.api[method], "function"); await context.api[method]("SYNTHETIC_ARGUMENT"); assert.equal(invocations.at(-1).channel, channel); }
});
test("template rendering uses the saved authoritative workflow and rejects unknown IDs", async () => {
  const saved = normalizeTemplate({ name: "Authoritative synthetic workflow", description: "Private custom test", kind: "custom", processId: "custom", stages: ["AUTHORITATIVE_STAGE"], requiredSources: [], validationChecks: ["Use supplied evidence"] });
  const main = loadMain({ template: saved }); const result = await main.call("zerothink:template-render", { templateId: saved.id, fields: { title: "Synthetic task" }, template: { ...saved, stages: ["UNTRUSTED_REPLACEMENT_STAGE"] } });
  assert.match(result.question, /AUTHORITATIVE_STAGE/); assert.doesNotMatch(result.question, /UNTRUSTED_REPLACEMENT_STAGE/);
  await assert.rejects(main.call("zerothink:template-render", { templateId: randomUUID(), fields: { title: "Task" } }), /saved research template/);
});
test("a corrupt legacy encrypted key is retained and migration does not mark it successfully imported", async () => {
  const encrypted = Buffer.from("SYNTHETIC_DAMAGED_CIPHERTEXT").toString("base64");
  const main = loadMain({ migration: true, settings: { openAiKeyEncrypted: encrypted }, decrypt: () => { throw new Error("Synthetic decrypt failure"); } });
  await assert.rejects(main.evaluate("readyVault()"), /legacy|decrypt|preserv|recover|key/i); assert.equal(main.writes.length, 0); assert.ok(!main.vault.calls.some((entry) => typeof entry === "object" && entry.migrate));
});
test("successfully migrated legacy keys move to the native vault before encrypted settings cleanup", async () => {
  const main = loadMain({ migration: true, settings: { openAiKeyEncrypted: Buffer.from("SYNTHETIC_OLD_OPENAI_KEY").toString("base64"), groqKeyEncrypted: Buffer.from("SYNTHETIC_OLD_GROQ_KEY").toString("base64") } });
  await main.evaluate("readyVault()"); assert.equal(await main.vault.getServiceKey("openai"), "SYNTHETIC_OLD_OPENAI_KEY"); assert.equal(await main.vault.getServiceKey("groq"), "SYNTHETIC_OLD_GROQ_KEY");
  assert.equal(main.writes.length, 1); assert.ok(!("openAiKeyEncrypted" in main.writes[0])); assert.ok(!("groqKeyEncrypted" in main.writes[0])); assert.doesNotMatch(JSON.stringify(main.writes[0]), /SYNTHETIC_OLD_OPENAI_KEY|SYNTHETIC_OLD_GROQ_KEY/);
});
test("unavailable secure storage returns settings without pretending saved keys are available", async () => {
  const main = loadMain({ secure: false }); const value = await main.evaluate("publicSettings(__settings)");
  assert.equal(value.hasOpenAiKey, false); assert.equal(value.hasGroqKey, false); assert.equal(value.hasSerperKey, false); assert.equal(value.hasOpenZeroToken, false); assert.ok(!main.vault.calls.some((entry) => typeof entry === "string" && entry.startsWith("key:")));
});
test("saving unrelated settings without secure storage retains recoverable legacy ciphertext", async () => {
  const encrypted = Buffer.from("SYNTHETIC_RECOVERABLE_CIPHERTEXT").toString("base64");
  const main = loadMain({ secure: false, settings: { openAiKeyEncrypted: encrypted, serperKeyEncrypted: encrypted } });
  await main.evaluate("saveSettingsInternal({closeToTray:false})");
  assert.equal(main.writes.length, 1); assert.equal(main.writes[0].openAiKeyEncrypted, encrypted); assert.equal(main.writes[0].serperKeyEncrypted, encrypted);
});
test("saving unrelated settings preserves the selected native vault chat profile", async () => {
  const main = loadMain({ active: activeProfile("gemini"), settings: { assistantProvider: "groq", model: "synthetic-legacy-model", openZeroAssistantMode: "server" } });
  await main.evaluate("saveSettingsInternal({assistantProvider:'groq',model:'synthetic-legacy-model',openZeroAssistantMode:'server',closeToTray:false})");
  assert.ok(!main.vault.calls.includes("select:null")); assert.equal((await main.vault.getActiveCompletion()).provider, "gemini");
});
test("saving an app-settings server key creates a distinct profile without overwriting a different saved server", async () => {
  const first = { ...activeProfile("openzero"), endpoint: "https://server-a.example/v1/chat/completions", key: "SYNTHETIC_SERVER_A_KEY" };
  const main = loadMain({ active: first, settings: { assistantProvider: "openzero", openZeroUrl: "https://server-b.example/", openZeroServerModel: "synthetic-server-model" } });
  await main.evaluate("saveSettingsInternal({openZeroToken:'SYNTHETIC_SERVER_B_KEY'})");
  assert.equal(main.vault.profiles.length, 2); assert.equal(main.vault.profiles[0].endpoint, first.endpoint); assert.equal(main.vault.profiles[0].key, first.key);
  const second = main.vault.profiles.find((profile) => profile.endpoint === "https://server-b.example/v1/chat/completions"); assert.equal(second.key, "SYNTHETIC_SERVER_B_KEY");
  await main.evaluate("saveSettingsInternal({openZeroToken:'SYNTHETIC_SERVER_B_UPDATED_KEY'})"); assert.equal(main.vault.profiles.length, 2); assert.equal(main.vault.profiles[0].key, first.key); assert.equal(main.vault.profiles.find((profile) => profile.id === second.id).key, "SYNTHETIC_SERVER_B_UPDATED_KEY");
});
test("pairing a new server retains existing server credentials, refuses redirects and redacts returned token metadata", async () => {
  const first = { ...activeProfile("openzero"), endpoint: "https://server-a.example/v1/chat/completions", key: "SYNTHETIC_SERVER_A_KEY" }, token = `oz_${"S".repeat(40)}`, requests = [];
  const main = loadMain({ active: first, settings: { assistantProvider: "openzero", openZeroUrl: "https://server-b.example/" }, fetcher: async (url, options) => { requests.push({ url, options }); return new Response(JSON.stringify(requests.length % 2 === 1 ? { api_key: token, hint: `Synthetic response with ${token}` } : { data: [{ id: "synthetic-server-model" }, { id: token }], recommended_model: token }), { status: 200 }); } });
  const response = await main.evaluate("provisionOpenZeroDesktop()"); assert.equal(main.vault.profiles.length, 2); assert.equal(main.vault.profiles[0].endpoint, first.endpoint); assert.equal(main.vault.profiles[0].key, first.key); assert.ok(main.vault.calls.includes("select:null"));
  assert.ok(requests.every((request) => request.options.redirect === "error")); assert.equal(requests[1].url, "https://server-b.example/v1/models"); assert.equal(requests[1].options.headers.Authorization, `Bearer ${token}`); assert.ok(!JSON.stringify(response).includes(token));
  await main.evaluate("provisionOpenZeroDesktop()"); assert.equal(main.vault.profiles.length, 2); assert.equal(main.vault.profiles[0].key, first.key);
});
test("pairing validates HTTPS and endpoint restrictions before any request or credential update", async () => {
  for (const endpoint of ["http://remote-server.example/", "https://169.254.169.254/", "https://[fe80::1]/", "https://0.0.0.0/", "https://credential:password@remote-server.example/"]) {
    let requests = 0; const main = loadMain({ settings: { openZeroUrl: endpoint }, fetcher: async () => { requests++; throw new Error("Should never request this fixture"); } });
    await assert.rejects(main.evaluate("provisionOpenZeroDesktop()")); assert.equal(requests, 0); assert.ok(!main.vault.calls.some((call) => typeof call === "object" && call.save));
  }
});
test("pairing provider bodies and transport failures never expose server secrets", async () => {
  const marker = "SYNTHETIC_ERROR_CREDENTIAL";
  const rejected = loadMain({ fetcher: async () => new Response(JSON.stringify({ error: { message: marker } }), { status: 403 }) });
  await assert.rejects(rejected.evaluate("provisionOpenZeroDesktop()"), (error) => /rejected/.test(error.message) && !error.message.includes(marker));
  const failed = loadMain({ fetcher: async () => { throw new Error(`Synthetic transport echoed ${marker}`); } });
  await assert.rejects(failed.evaluate("provisionOpenZeroDesktop()"), (error) => /could not be reached/.test(error.message) && !error.message.includes(marker));
  let count = 0; const verifyFailed = loadMain({ fetcher: async () => { if (++count === 1) return new Response(JSON.stringify({ api_key: `oz_${"S".repeat(40)}` })); throw new Error(marker); } });
  await assert.rejects(verifyFailed.evaluate("provisionOpenZeroDesktop()"), (error) => /verification request failed/.test(error.message) && !error.message.includes(marker));
});

test("managed CPU IPC requires the trusted renderer and explicit model terms before setup", async () => {
  const main = loadMain();
  main.evaluate(`globalThis.__cpuCalls = []; localRuntime = () => ({ status: () => ({phase:'idle',modelId:'synthetic',downloadedBytes:0,totalBytes:3416119872}), ensureReady: async () => { __cpuCalls.push('ensure'); return {phase:'ready'}; }, stop: () => __cpuCalls.push('stop'), cancelSetup: () => __cpuCalls.push('cancel') });`);
  for (const channel of ['openzero:managed-status','openzero:managed-setup','openzero:managed-cancel','openzero:managed-stop','openzero:chat-cancel']) {
    const outsider={sender:{id:999,mainFrame:{url:rendererURL}},senderFrame:{url:rendererURL}};
    await assert.rejects(Promise.resolve().then(()=>main.call(channel,{acceptTerms:true},outsider)),/trusted|main|renderer/i);
  }
  await assert.rejects(main.call('openzero:managed-setup'),/terms before downloading/i);
  assert.deepEqual(Array.from(main.evaluate('__cpuCalls')),[]);
  main.evaluate('saveSettingsInternal = async (input) => { __writes.push(input); return input; };');
  const ready=await main.call('openzero:managed-setup',{acceptTerms:true});
  assert.equal(ready.phase,'ready');assert.equal(ready.termsAccepted,true);
  assert.equal(main.writes[0].localModelTermsAcceptedRevision,require('./managed-local-runtime-manifest.json').model.revision);
  assert.equal(main.writes[1].managedLocalConfigured,true);
  assert.ok(main.vault.calls.includes('select:null'));
  assert.deepEqual(Array.from(main.evaluate('__cpuCalls')),['ensure']);
});
test("managed completion refuses a silent model download before CPU setup acceptance", async () => {
  const main=loadMain();
  main.evaluate("localRuntime = () => { throw new Error('Unexpected CPU startup'); }; globalThis.__managed = managedCompletion();");
  await assert.rejects(main.evaluate("__managed.complete({messages:[{role:'user',content:'hello'}]})"),/complete CPU setup/);
});
test("Assistant announces preparation and its actual selected model request", async () => {
  const main=loadMain({active:activeProfile(),fetcher:async()=>new Response(JSON.stringify(modelResponse('gemini')),{status:200})});
  await main.call('openzero:chat',{messages:[{role:'user',content:'Synthetic query'}]});
  assert.deepEqual(main.events.filter(e=>e.channel==='openzero:chat-progress').map(e=>e.value.stage),['preparing','waiting','complete']);
  assert.equal(main.event.sender.listenerCount('destroyed'),0);
});

test("a newer explicit Vault choice wins while CPU setup is still downloading", async () => {
  const profile=activeProfile();const main=loadMain({active:profile});
  main.evaluate("localRuntime = () => ({ ensureReady: () => new Promise(resolve => { globalThis.__finishCpu = resolve; }) }); saveSettingsInternal = async (input) => { __writes.push(input); return input; };");
  const pending=main.call('openzero:managed-setup',{acceptTerms:true});
  for(let i=0;i<50&&!main.evaluate('typeof __finishCpu !== "undefined"');i++) await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(main.evaluate('typeof __finishCpu'),'function');
  await main.call('zerothink:vault-select',profile.id);
  main.evaluate("__finishCpu({phase:'ready'});");await pending;
  assert.ok(!main.vault.calls.includes('select:null'));
  assert.equal(main.writes.at(-1).managedLocalConfigured,true);
  assert.equal(main.writes.at(-1).assistantProvider,undefined);
});
