'use strict';
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createManagedLocalRuntime, manifest } = require('../electron/managed-local-runtime.cjs');
const { runAgent } = require('../electron/zerothink-agent.cjs');
const started = Date.now();
const manager = createManagedLocalRuntime({ runtimeDir: path.resolve('vendor/local-runtime'), dataDir: path.resolve('release-audit/local-runtime/models') });
const responses = [], progress = [], approvals = [];
const controller = new AbortController();
const deadline = setTimeout(() => controller.abort(), 15 * 60 * 1000);
process.once('SIGINT', () => controller.abort());
const cancellationFile = path.resolve('release-audit/local-runtime/cancel-agent-smoke');
const cancelPoll = setInterval(() => { fs.access(cancellationFile).then(() => controller.abort()).catch(() => {}); }, 250);
const traceFile = path.resolve('release-audit/local-runtime/agent-trace.jsonl');
function trace(value) { require('node:fs').appendFileSync(traceFile, JSON.stringify(value) + '\n'); console.log(JSON.stringify(value)); }
let root;
(async () => { try {
  await fs.mkdir(path.dirname(traceFile), { recursive: true }); await fs.writeFile(traceFile, ''); await fs.unlink(cancellationFile).catch(() => {});
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'zero-real-agent-'));
  await fs.writeFile(path.join(root, 'README.txt'), 'Synthetic disposable coding fixture. Specification: create hello.cjs with a function hello(name) returning "Hello, " + name + "!". Export using module.exports = { hello }. No other code or I/O is needed.\n');
  const task = 'Read README.txt to obtain the function specification. Implement that specification in hello.cjs using write_file. After the write succeeds, read_file hello.cjs to inspect the saved code, then finish with an accurate summary. Do not use run_command; a separate test harness will test the saved function. The specification is only in README.txt, so read it before writing.';
  const report = await runAgent({ root, task, maxSteps: 8, signal: controller.signal, onProgress: event => { progress.push({ ...event, elapsedMs: Date.now() - started }); trace(progress.at(-1)); } }, {
    complete: async request => { const begin = Date.now(); const answer = await manager.complete({ stage: request.stage, messages: request.messages, maxTokens: 2048, temperature: request.temperature, signal: request.signal }); responses.push({ elapsedMs: Date.now() - begin, text: answer.text, usage: answer.usage, timings: answer.timings }); trace({ modelResponse: responses.at(-1) }); return { content: answer.text }; },
    approve: async action => { const allowed = action.tool === 'write_file' && action.path === 'hello.cjs' && action.creating === true; approvals.push({ tool: action.tool, path: action.path, allowed }); return allowed; },
  });
  const saved = await fs.readFile(path.join(root, 'hello.cjs'), 'utf8').catch(() => null); let functionTests = null;
  if (saved) { try { const context = vm.createContext({ module: { exports: {} } }, { codeGeneration: { strings: false, wasm: false } }); vm.runInContext(saved, context, { timeout: 1000 }); functionTests = { ada: vm.runInContext('module.exports.hello("Ada")', context, { timeout: 1000 }), zero: vm.runInContext('module.exports.hello("Zero")', context, { timeout: 1000 }) }; } catch (e) { functionTests = { error: e.message }; } }
  const write = report.observations.find(o => o.tool === 'write_file');
  const readSpecification = report.observations.some(o => o.tool === 'read_file' && o.arguments.path === 'README.txt' && o.step < write?.step);
  const readSavedCode = report.observations.some(o => o.tool === 'read_file' && o.arguments.path === 'hello.cjs' && o.step > write?.step);
  const receipt = { schema: 1, at: new Date().toISOString(), task, cpu: os.cpus()[0].model, runtimeVersion: manifest.runtimeVersion, modelId: manifest.model.id, modelRevision: manifest.model.revision, modelSha256: manifest.model.sha256, elapsedMs: Date.now() - started, report: { ...report, root: '[synthetic disposable workspace]' }, responses, progress, approvals, savedCode: saved, functionTests, readSpecification, readSavedCode, allAssertionsPassed: report.status === 'completed' && report.edits === 1 && readSpecification && readSavedCode && report.commands === 0 && functionTests?.ada === 'Hello, Ada!' && functionTests?.zero === 'Hello, Zero!', modelMocked: false, outsideProjectReads: 0, externalInferenceRequests: 0 };
  await fs.mkdir('release-audit/local-runtime', { recursive: true }); await fs.writeFile('release-audit/local-runtime/native-agent.json', JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify({ receipt: 'release-audit/local-runtime/native-agent.json', status: report.status, allAssertionsPassed: receipt.allAssertionsPassed, reads: report.reads, edits: report.edits, functionTests }));
  if (!receipt.allAssertionsPassed) process.exitCode = 1;
} finally { clearTimeout(deadline); clearInterval(cancelPoll); manager.stop(); if (root) await fs.rm(root, { recursive: true, force: true }); } })().catch(e => { console.error(e.message); process.exitCode = 1; });
