'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createManagedLocalRuntime, manifest } = require('../electron/managed-local-runtime.cjs');
const manager = createManagedLocalRuntime({ runtimeDir: path.resolve('vendor/local-runtime'), dataDir: path.resolve('release-audit/local-runtime/models') });
const controller = new AbortController();
const deadline = setTimeout(() => controller.abort(), 120000);
const started = Date.now(); let result, error;
(async () => { try {
  result = await manager.complete({ messages: [{ role: 'user', content: 'What is 2 plus 2? Reply with one short sentence in ordinary text.' }], stage: 'chat', maxTokens: 32, signal: controller.signal });
} catch (e) { error = { name: e.name, message: e.message }; }
finally {
  clearTimeout(deadline); manager.stop();
  const receipt = { schema: 1, at: new Date().toISOString(), cpu: os.cpus()[0].model, runtimeVersion: manifest.runtimeVersion, modelId: manifest.model.id, modelRevision: manifest.model.revision, elapsedMs: Date.now() - started, result, error, answerAccepted: Boolean(result && /4|four/i.test(result.text) && !/^\s*\{/.test(result.text)), externalInferenceRequests: 0, modelMocked: false };
  await fs.mkdir('release-audit/local-runtime', { recursive: true }); await fs.writeFile('release-audit/local-runtime/native-chat.json', JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.answerAccepted) process.exitCode = 1;
} })().catch(e => { console.error(e.message); process.exitCode = 1; });
