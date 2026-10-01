'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createManagedLocalRuntime, manifest } = require('../electron/managed-local-runtime.cjs');
const { requestCompletionBrowserPlan, classifyBrowserAction } = require('../electron/browser-pilot.cjs');
const manager = createManagedLocalRuntime({ runtimeDir: path.resolve('vendor/local-runtime'), dataDir: path.resolve('release-audit/local-runtime/models') });
const controller = new AbortController(); const deadline = setTimeout(() => controller.abort(), 120000);
const started = Date.now(); let rawResponse, result, error;
const snapshot = { url: 'https://example.invalid/fixture', title: 'Synthetic documentation fixture', text: 'This is a synthetic snapshot. The Documentation button opens the documentation.', viewport: { width: 1200, height: 800 }, interactive: [{ id: 'e1', label: 'Documentation', tag: 'button', href: 'https://example.invalid/docs' }] };
(async () => { try {
  result = await requestCompletionBrowserPlan({ task: 'Click the Documentation button using its listed element identifier.', snapshot, step: 1, history: [], signal: controller.signal, complete: async request => { const answer = await manager.complete(request); rawResponse = answer; return { content: answer.text }; } });
} catch (e) { error = { name: e.name, message: e.message }; }
finally {
  clearTimeout(deadline); manager.stop();
  const policy = result ? classifyBrowserAction(result, snapshot) : null;
  const receipt = { schema: 1, at: new Date().toISOString(), cpu: os.cpus()[0].model, runtimeVersion: manifest.runtimeVersion, modelId: manifest.model.id, modelRevision: manifest.model.revision, elapsedMs: Date.now() - started, snapshot, rawResponse, result, policy, error, parserAccepted: Boolean(result), expectedAction: result?.action === 'click' && result?.element_id === 'e1', browserActionsExecuted: 0, realBrowserNavigations: 0, externalInferenceRequests: 0, snapshotSynthetic: true, modelMocked: false };
  await fs.mkdir('release-audit/local-runtime', { recursive: true }); await fs.writeFile('release-audit/local-runtime/native-browser-plan.json', JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt, null, 2));
  if (!receipt.parserAccepted || !receipt.expectedAction || !policy?.allowed) process.exitCode = 1;
} })().catch(e => { console.error(e.message); process.exitCode = 1; });
