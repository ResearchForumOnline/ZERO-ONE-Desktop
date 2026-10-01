'use strict';
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const manifest = require('./managed-local-runtime-manifest.json');
const hashFile = async (file, signal) => { signal?.throwIfAborted(); const h = crypto.createHash('sha256'); const stream = createReadStream(file, { signal }); for await (const chunk of stream) { signal?.throwIfAborted(); h.update(chunk); } return h.digest('hex'); };
const allowedDownload = value => { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || !(['huggingface.co', 'cdn-lfs.huggingface.co', 'cdn-lfs-us-1.huggingface.co', 'cas-bridge.xethub.hf.co'].includes(u.hostname) || u.hostname.endsWith('.hf.co'))) throw new Error('Model download redirect was refused.'); return u.href; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function awaitSetupForCaller(operation, signal) {
  if (!signal) return operation;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => { cleanup(); reject(signal.reason || new DOMException('Setup wait cancelled.', 'AbortError')); };
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) onAbort();
  });
}
async function freePort() { return new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); }); }
async function readFirstAction(response, { signal, abortGeneration, actionRequest = true } = {}) {
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) throw new Error('The local engine did not return an action event stream.');
  const reader = response.body.getReader();
  const onAbort = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let wireBytes = 0, buffer = '', eventData = [], text = '', scanned = 0, depth = 0, started = false, inString = false, escaped = false, usage, timings = {};
  const scan = delta => {
    text += delta;
    if (Buffer.byteLength(text, 'utf8') > 320 * 1024) throw new Error('The local action exceeded its text limit.');
    if (!actionRequest) return null;
    for (; scanned < text.length; scanned++) {
      const c = text[scanned];
      if (!started) { if (/\s/.test(c)) continue; if (c !== '{') throw new Error('The local model did not start a JSON tool object. No action was executed.'); started = true; depth = 1; continue; }
      if (inString) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') inString = false; continue; }
      if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return text.slice(0, scanned + 1);
    }
    return null;
  };
  const event = () => {
    if (!eventData.length) return null;
    const data = eventData.join('\n'); eventData = [];
    if (data === '[DONE]') { if (actionRequest) throw new Error('The local action stream ended before a complete JSON object.'); if (!text.trim()) throw new Error('The local model returned an empty answer.'); return { text, usage, timings }; }
    let item; try { item = JSON.parse(data); } catch { throw new Error('The local action event stream was malformed.'); }
    if (!item || typeof item !== 'object' || item.error) throw new Error('The local action event stream returned an error.');
    if (!actionRequest) {
      if (item.usage && ['prompt_tokens', 'completion_tokens', 'total_tokens'].every(k => Number.isFinite(item.usage[k]) && item.usage[k] >= 0)) usage = Object.fromEntries(['prompt_tokens', 'completion_tokens', 'total_tokens'].map(k => [k, item.usage[k]]));
      for (const k of ['prompt_ms', 'prompt_n', 'prompt_per_second', 'predicted_ms', 'predicted_n', 'predicted_per_second']) if (Number.isFinite(item.timings?.[k])) timings[k] = item.timings[k];
    }
    const delta = item.choices?.[0]?.delta;
    if (!delta) { if (Array.isArray(item.choices) && item.choices.length === 0) return null; throw new Error('The local action event stream has an unsupported event.'); }
    if (delta.tool_calls?.length || (delta.content !== undefined && delta.content !== null && typeof delta.content !== 'string')) throw new Error('The local action stream used an unsupported tool format.');
    return typeof delta.content === 'string' ? scan(delta.content) : null;
  };
  const consumeLines = () => {
    let split;
    while ((split = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, split).replace(/\r$/, ''); buffer = buffer.slice(split + 1);
      if (!line) { const complete = event(); if (complete !== null) return complete; }
      else if (line.startsWith('data:')) eventData.push(line.slice(5).replace(/^ /, ''));
      else if (!line.startsWith(':') && !line.startsWith('id:') && !line.startsWith('event:') && !line.startsWith('retry:')) throw new Error('The local action stream has an unsupported SSE field.');
    }
    return null;
  };
  try {
    while (true) {
      signal?.throwIfAborted();
      const part = await reader.read();
      signal?.throwIfAborted();
      if (part.done) { buffer += decoder.decode(); const complete = consumeLines(); if (complete !== null) return complete; throw new Error('The local action stream was truncated before a complete JSON object.'); }
      wireBytes += part.value.length; if (wireBytes > 2 * 1024 ** 2) throw new Error('The local action stream exceeded its byte limit.');
      buffer += decoder.decode(part.value, { stream: true });
      const complete = consumeLines(); if (complete !== null) return complete;
    }
  } finally { signal?.removeEventListener('abort', onAbort); await reader.cancel().catch(() => {}); abortGeneration?.(); }
}
function createManagedLocalRuntime(options) {
  const { dataDir, runtimeDir, onStatus = () => {}, fetchImpl = global.fetch, spawnImpl = spawn } = options;
  const spec = options.model || manifest.model;
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const totalRam = options.totalRamBytes || os.totalmem();
  const contextSize = totalRam >= 16 * 1024 ** 3 ? 8192 : 4096;
  let state = { phase: 'idle', modelId: spec.id, model: spec.name, downloadedBytes: 0, totalBytes: spec.bytes, detail: 'Local AI is ready to set up.', cpuOnly: true, contextSize };
  let pending, controller, child, token, base, generation, generationActive = false;
  const update = values => { state = { ...state, ...values }; try { onStatus({ ...state }); } catch {} };
  const modelPath = path.join(dataDir, spec.file);
  const partial = modelPath + '.partial';
  async function verifyRuntime() {
    const platformSpec = manifest.platforms[`${platform}-${arch}`];
    if (!platformSpec) throw new Error('This CPU platform is not supported by the bundled local engine.');
    const receipt = JSON.parse(await fs.readFile(path.join(runtimeDir, 'provenance.json'), 'utf8'));
    if (receipt.runtimeVersion !== manifest.runtimeVersion || receipt.platform !== `${platform}-${arch}` || receipt.archiveSha256 !== platformSpec.sha256 || !Array.isArray(receipt.files) || !receipt.files.length) throw new Error('Bundled local engine provenance is invalid. Reinstall the latest app.');
    for (const item of receipt.files) {
      if (!/^[a-zA-Z0-9._-]+$/.test(item.file) || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Bundled local engine manifest is invalid.');
      if (await hashFile(path.join(runtimeDir, item.file)) !== item.sha256) throw new Error('Bundled local engine verification failed. Reinstall the latest app.');
    }
    if (!receipt.files.some(f => f.file === platformSpec.executable)) throw new Error('Bundled local engine executable is missing.');
    return path.join(runtimeDir, platformSpec.executable);
  }
  async function fetchModel(signal) {
    await fs.mkdir(dataDir, { recursive: true });
    const existing = await fs.stat(modelPath).catch(() => null);
    if (existing) { update({ phase: 'verifying', detail: 'Verifying the installed model.' }); if (existing.size === spec.bytes && await hashFile(modelPath, signal) === spec.sha256) return; await fs.rename(modelPath, modelPath + '.invalid-' + crypto.randomUUID()); update({ detail: 'A damaged model was preserved. Downloading a verified replacement.' }); }
    let offset = (await fs.stat(partial).catch(() => ({ size: 0 }))).size;
    if (offset > spec.bytes) { await fs.unlink(partial); offset = 0; }
    if (offset === spec.bytes) { update({ phase: 'verifying' }); if (await hashFile(partial, signal) === spec.sha256) { await fs.rename(partial, modelPath); return; } await fs.unlink(partial); offset = 0; }
    const disk = await (options.statfsImpl || fs.statfs)(dataDir);
    if (Number(disk.bavail) * Number(disk.bsize) < spec.bytes - offset + 512 * 1024 ** 2) throw new Error('Local AI needs more free disk space. Free at least 4 GB and retry.');
    update({ phase: 'downloading', downloadedBytes: offset, detail: 'Downloading your OpenZero model. You can cancel and resume later.' });
    let url = `https://huggingface.co/${spec.id}/resolve/${spec.revision}/${encodeURIComponent(spec.file)}`;
    let response;
    for (let hop = 0; hop < 6; hop++) {
      response = await fetchImpl(allowedDownload(url), { redirect: 'manual', signal, headers: offset ? { Range: `bytes=${offset}-` } : {} });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location'); await response.body?.cancel(); if (!location) throw new Error('Model redirect was incomplete.'); url = new URL(location, url).href; response = null;
    }
    if (!response || ![200, 206].includes(response.status)) throw new Error('Model download failed. Check your connection and retry.');
    if (response.status === 206 && response.headers.get('content-range') !== `bytes ${offset}-${spec.bytes - 1}/${spec.bytes}`) throw new Error('Model resume range was invalid.');
    if (response.status === 200) offset = 0;
    const declared = Number(response.headers.get('content-length'));
    if (declared && declared !== spec.bytes - offset) throw new Error('Model download size did not match the pinned release.');
    const handle = await fs.open(partial, offset ? 'a' : 'w');
    let received = offset, last = 0;
    try { for await (const chunk of response.body) { if (signal.aborted) throw new Error('Setup cancelled.'); received += chunk.length; if (received > spec.bytes) throw new Error('Model download exceeded its pinned size.'); await handle.write(chunk); if (Date.now() - last > 150) { update({ downloadedBytes: received }); last = Date.now(); } } } finally { await handle.close(); }
    if (received !== spec.bytes) throw new Error('Download interrupted. Retry to resume the model download.');
    update({ phase: 'verifying', downloadedBytes: received, detail: 'Checking the model SHA-256. This can take a minute.' });
    if (await hashFile(partial, signal) !== spec.sha256) { await fs.unlink(partial); throw new Error('Model verification failed. Retry to download a fresh copy.'); }
    if (signal.aborted) throw new Error('Setup cancelled.');
    await fs.rename(partial, modelPath);
  }
  async function start(signal, executable) {
    if (signal.aborted) throw new Error('Setup cancelled.');
    update({ phase: 'starting', detail: 'Loading the model on your CPU. The first start can take a few minutes.' });
    const port = await (options.portImpl || freePort)(); token = crypto.randomBytes(32).toString('hex'); base = `http://127.0.0.1:${port}`;
    const threads = Math.max(1, Math.min(8, Math.floor((options.cpuCount || os.cpus().length) / 2)));
    // No API key appears in command arguments or diagnostics. No shell, remote listener, GPU or UI.
    const args = ['-m', modelPath, '--host', '127.0.0.1', '--port', String(port), '-ngl', '0', '-t', String(threads), '-tb', String(threads), '-c', String(contextSize), '--parallel', '1', '--jinja', '--skip-chat-parsing', '--reasoning', 'off', '--no-webui', '--no-warmup'];
    child = spawnImpl(executable, args, { cwd: runtimeDir, shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'], env: { PATH: process.env.PATH || '', SystemRoot: process.env.SystemRoot || '', HOME: process.env.HOME || '', TMPDIR: process.env.TMPDIR || '', TEMP: process.env.TEMP || '', LLAMA_API_KEY: token, GGML_BACKEND_PATH: runtimeDir } });
    let exited = false; child.once('error', () => { exited = true; }); child.once('exit', () => { exited = true; if (state.phase === 'ready') update({ phase: 'error', detail: 'The local engine stopped. Retry to restart it.' }); });
    const deadline = Date.now() + (options.startTimeoutMs || 240000);
    while (Date.now() < deadline && !signal.aborted && !exited) {
      try { const r = await fetchImpl(base + '/health', { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) }); if (r.ok) { update({ phase: 'ready', detail: 'OpenZero is running locally on your CPU.' }); return; } } catch {}
      await sleep(300);
    }
    child?.kill(); child = null; token = null; base = null;
    throw new Error(signal.aborted ? 'Setup cancelled.' : 'The CPU model could not start. Retry, or choose your own API in the Vault.');
  }
  async function ensureReady({ signal } = {}) {
    signal?.throwIfAborted();
    if (state.phase === 'ready' && child) return { ...state };
    if (pending) return awaitSetupForCaller(pending, signal);
    controller = new AbortController(); const combined = signal ? AbortSignal.any([signal, controller.signal, AbortSignal.timeout(2 * 60 * 60 * 1000)]) : AbortSignal.any([controller.signal, AbortSignal.timeout(2 * 60 * 60 * 1000)]);
    pending = (async () => { try { if ((options.totalRamBytes || os.totalmem()) < spec.minimumRamBytes) throw new Error('This model needs at least 8 GB RAM. Choose your own API in the Vault on this computer.'); const executable = await verifyRuntime(); await fetchModel(combined); await start(combined, executable); return { ...state }; } catch (e) { update({ phase: combined.aborted ? 'cancelled' : 'error', detail: combined.aborted ? 'Setup cancelled. Retry to resume.' : String(e.message).slice(0, 300) }); throw new Error(state.detail); } finally { pending = null; } })();
    return pending;
  }
  async function complete({ messages, maxTokens = 1024, temperature = 0.6, signal, stage } = {}) {
    if (!Array.isArray(messages) || !messages.length || messages.length > 64 || messages.some(m => !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) throw new Error('Local AI request is invalid.');
    if (messages.reduce((n, m) => n + m.content.length, 0) > (contextSize === 8192 ? 24000 : 10000)) throw new Error('Local AI input is too long. Select fewer sources or shorten the conversation; no content has been silently removed.');
    if (generationActive) throw new Error('Local AI is already answering. Wait or cancel the current request.');
    generationActive = true;
    try { await ensureReady({ signal }); generation = new AbortController(); const combined = AbortSignal.any([generation.signal, AbortSignal.timeout(15 * 60 * 1000), ...(signal ? [signal] : [])]);
      const outputLimit = Math.max(1, Math.min(2048, Math.floor(maxTokens) || 1024));
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const tokenResponse = await fetchImpl(base + '/tokenize', { method: 'POST', redirect: 'error', signal: combined, headers, body: JSON.stringify({ content: JSON.stringify(messages), add_special: true }) });
      if (!tokenResponse.ok) throw new Error('The local engine could not check the context budget. Retry.');
      const tokenData = await tokenResponse.json();
      if (!Array.isArray(tokenData.tokens) || tokenData.tokens.length + outputLimit + 512 > contextSize) throw new Error('Local AI context is full. Select fewer sources or shorten the conversation; no content has been silently removed.');
      const samplingTemperature = Number.isFinite(Number(temperature)) ? Math.max(0, Math.min(1.5, Number(temperature))) : 0.6;
      const actionRequest = stage === 'project-agent';
      const format = actionRequest ? { response_format: { type: 'json_schema', schema: require('./agent-action-schema.cjs').AGENT_ACTION_SCHEMA } } : {};
      const r = await fetchImpl(base + '/v1/chat/completions', { method: 'POST', redirect: 'error', signal: combined, headers, body: JSON.stringify({ model: spec.name, messages, max_tokens: outputLimit, temperature: samplingTemperature, stream: true, stream_options: { include_usage: true }, ...format }) });
      if (!r.ok) throw new Error('Local AI could not answer. Shorten the request and retry.');
      if (actionRequest) { const text = await readFirstAction(r, { signal: combined, abortGeneration: () => generation?.abort() }); return { text, model: spec.name, streamedAction: true }; }
      const result = await readFirstAction(r, { signal: combined, abortGeneration: () => generation?.abort(), actionRequest: false });
      return { ...result, model: spec.name };
    } finally { generation = null; generationActive = false; }
  }
  function cancelSetup() { controller?.abort(); generation?.abort(); }
  function stop() { cancelSetup(); const owned = child; child = null; token = null; base = null; if (owned && !owned.killed) owned.kill(); update({ phase: 'idle', detail: 'Local AI stopped. Your verified model stays installed.' }); }
  async function resetModel() { stop(); if (pending) await pending.catch(() => {}); for (const file of [modelPath, partial]) await fs.unlink(file).catch(e => { if (e.code !== 'ENOENT') throw e; }); update({ phase: 'idle', downloadedBytes: 0, detail: 'Local model removed. Retry to download a verified copy.' }); return { ...state }; }
  return { status: () => ({ ...state }), ensureReady, complete, cancelSetup, stop, resetModel, modelPath };
}
module.exports = { createManagedLocalRuntime, hashFile, allowedDownload, manifest, readFirstAction };
