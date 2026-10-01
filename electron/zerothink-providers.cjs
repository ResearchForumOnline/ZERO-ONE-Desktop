"use strict";

// Keys stay in the main process. Provider origins are deliberately independent
// of the application publisher's websites and of model-generated settings.
const { TextDecoder } = require("node:util");
const PROVIDERS = Object.freeze([
  { id: "groq", label: "Groq", kind: "chat", endpoint: "https://api.groq.com/openai/v1/chat/completions", defaultModel: "llama-3.3-70b-versatile", requiresKey: true },
  { id: "openai", label: "OpenAI", kind: "chat", endpoint: "https://api.openai.com/v1/chat/completions", defaultModel: "gpt-4.1-mini", requiresKey: true },
  { id: "gemini", label: "Google Gemini", kind: "chat", endpoint: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.5-flash", requiresKey: true },
  { id: "anthropic", label: "Anthropic Claude", kind: "chat", endpoint: "https://api.anthropic.com/v1/messages", defaultModel: "claude-sonnet-4-5", requiresKey: true },
  { id: "xai", label: "xAI", kind: "chat", endpoint: "https://api.x.ai/v1/chat/completions", defaultModel: "grok-3-mini", requiresKey: true },
  { id: "nvidia", label: "NVIDIA NIM", kind: "chat", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", defaultModel: "meta/llama-3.3-70b-instruct", requiresKey: true },
  { id: "featherless", label: "Featherless", kind: "chat", endpoint: "https://api.featherless.ai/v1/chat/completions", defaultModel: "Qwen/Qwen3-32B", requiresKey: true },
  { id: "openzero", label: "Your OpenZero / compatible server", kind: "chat", endpoint: "", defaultModel: "", requiresKey: false },
  { id: "serper", label: "Serper web search", kind: "search", endpoint: "https://google.serper.dev/search", defaultModel: "", requiresKey: true },
  { id: "ionq", label: "IonQ Quantum Cloud", kind: "quantum", endpoint: "https://api.ionq.co/v0.4", defaultModel: "", requiresKey: true },
  { id: "ibm", label: "IBM Quantum", kind: "quantum", endpoint: "https://quantum.cloud.ibm.com/api/v1", defaultModel: "", requiresKey: true },
].map(Object.freeze));
const RESPONSE_BYTES = 1024 * 1024;
function invalid(message) { const error = new Error(message); error.name = "ValidationError"; return error; }
function definition(provider) { const found = PROVIDERS.find((entry) => entry.id === provider); if (!found) throw invalid("Choose a supported vault provider."); return found; }
function text(value, max, label, empty = false) {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw invalid(`${label} is invalid.`);
  const cleaned = value.trim(); if (!empty && !cleaned) throw invalid(`${label} is required.`); return cleaned;
}
function credential(value) { if (typeof value !== "string" || value.length > 8192 || /[\u0000-\u0020\u007f]/.test(value)) throw invalid("The API key is invalid."); return value; }
function endpointFor(provider, value = "") {
  const metadata = definition(provider);
  if (provider !== "openzero") {
    if (value && value !== metadata.endpoint) throw invalid("This provider uses its official API endpoint. Choose your own server for a custom endpoint.");
    return metadata.endpoint;
  }
  let url; try { url = new URL(text(value, 2048, "Server endpoint")); } catch { throw invalid("Enter a valid server endpoint."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw invalid("Server endpoints must have no embedded credentials, query or fragment.");
  const host = url.hostname.toLowerCase();
  const loopback = host === "localhost" || host === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(host);
  if (url.protocol !== "https:" && !loopback) throw invalid("Remote model servers require HTTPS; HTTP is accepted only on loopback.");
  if (/^169\.254\./.test(host) || /^\[(?:fe[89ab][0-9a-f]:|ff)/i.test(host) || host === "0.0.0.0" || host === "[::]") throw invalid("This server address is not supported.");
  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname) url.pathname = "/v1/chat/completions";
  else if (pathname.endsWith("/v1")) url.pathname = `${pathname}/chat/completions`;
  else if (!pathname.endsWith("/chat/completions")) throw invalid("Enter an OpenAI-compatible server origin or chat-completions endpoint.");
  return url.toString();
}
function normalizeProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("A vault profile is required.");
  const provider = definition(input.provider), model = provider.kind === "chat" ? text(input.model || provider.defaultModel, 192, "Model") : "";
  if (model && !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/.test(model)) throw invalid("The model identifier is invalid.");
  if (provider.id === "gemini" && !/^(?:models\/)?[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(model)) throw invalid("Enter a Gemini model identifier, without a URL.");
  return { provider: provider.id, kind: provider.kind, name: text(input.name || provider.label, 80, "Profile name"), model, endpoint: endpointFor(provider.id, input.endpoint || "") };
}
function messagesFor(value) {
  if (!Array.isArray(value) || !value.length || value.length > 64) throw invalid("Supply between one and 64 model messages.");
  let total = 0;
  const messages = value.map((message) => {
    if (!message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string" || !message.content.trim() || message.content.includes("\0") || message.content.length > 262144) throw invalid("A model message is invalid.");
    total += Buffer.byteLength(message.content, "utf8"); if (total > 2162688) throw invalid("The model messages exceed the supported limit.");
    return { role: message.role, content: message.content };
  });
  if (!messages.some((message) => message.role !== "system")) throw invalid("Add a user message before running the model.");
  return messages;
}
function visible(value) {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > RESPONSE_BYTES) throw new Error("The provider returned an invalid text answer.");
  let content = value.replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, "");
  const unfinished = content.search(/<think\b/i); if (unfinished >= 0) content = content.slice(0, unfinished);
  content = content.trim(); if (!content) throw new Error("The provider returned no visible answer."); return content;
}
const count = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000 ? value : 0;
async function readJson(response, signal) {
  const advertised = response.headers?.get?.("content-length");
  if (advertised && /^\d+$/.test(advertised) && Number(advertised) > RESPONSE_BYTES) throw new Error("The provider response exceeded one MiB.");
  if (!response.body || typeof response.body.getReader !== "function") throw new Error("The provider returned an invalid response.");
  const reader = response.body.getReader(), chunks = []; let size = 0, done = false;
  const cancel = () => { Promise.resolve(reader.cancel()).catch(() => {}); }; signal.addEventListener("abort", cancel, { once: true }); if (signal.aborted) cancel();
  try {
    while (true) { const item = await reader.read(); if (item.done) break; if (!(item.value instanceof Uint8Array)) throw new Error("The provider returned an invalid response."); size += item.value.byteLength; if (size > RESPONSE_BYTES) throw new Error("The provider response exceeded one MiB."); chunks.push(item.value); }
    done = true;
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size))); } catch { throw new Error("The provider returned invalid JSON."); }
  } finally { signal.removeEventListener("abort", cancel); if (!done) cancel(); try { reader.releaseLock(); } catch { /* Cancellation can leave a read pending. */ } }
}
function buildVaultCompletion(profile, options = {}) {
  const normalized = normalizeProfile(profile), provider = definition(normalized.provider), key = credential(profile.key || "");
  if (provider.kind !== "chat") throw invalid("This vault profile is for a service, not a chat model.");
  if (provider.requiresKey && !key) throw invalid("Save an API key for this profile before using it.");
  // This is an existing compatible server, not a model download or managed
  // local runtime; it is available in both direct and Store distributions.
  const fetcher = options.fetchImpl || globalThis.fetch;
  if (typeof fetcher !== "function") throw invalid("A provider transport is unavailable.");
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) throw invalid("The cancellation signal is invalid.");
  const timeoutMs = options.timeoutMs === undefined ? 120000 : options.timeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 120000) throw invalid("The provider timeout is invalid.");
  return Object.freeze({
    async complete(request) {
      if (!request || typeof request !== "object") throw invalid("A model request is required.");
      const messages = messagesFor(request.messages), maxTokens = request.maxTokens === undefined ? 1024 : request.maxTokens;
      if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || maxTokens > 2048) throw invalid("Choose between one and 2048 completion tokens per stage.");
      if (request.signal !== undefined && !(request.signal instanceof AbortSignal)) throw invalid("The cancellation signal is invalid.");
      const controller = new AbortController(), sources = [...new Set([options.signal, request.signal].filter(Boolean))];
      const abort = () => controller.abort(); for (const signal of sources) { if (signal.aborted) controller.abort(); else signal.addEventListener("abort", abort, { once: true }); }
      let timedOut = false, abortListener;
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
      let endpoint = normalized.endpoint, headers = { "Content-Type": "application/json", Accept: "application/json" }, body;
      const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n"), conversation = messages.filter((message) => message.role !== "system");
      if (provider.id === "gemini") {
        endpoint += `/models/${encodeURIComponent(normalized.model.replace(/^models\//, ""))}:generateContent`;
        headers["x-goog-api-key"] = key;
        body = { contents: conversation.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })), generationConfig: { maxOutputTokens: maxTokens } };
        if (system) body.systemInstruction = { parts: [{ text: system }] };
      } else if (provider.id === "anthropic") {
        headers["x-api-key"] = key; headers["anthropic-version"] = "2023-06-01";
        body = { model: normalized.model, max_tokens: maxTokens, messages: conversation };
        if (system) body.system = system;
      } else {
        if (key) headers.Authorization = `Bearer ${key}`;
        body = { model: normalized.model, messages, stream: false, [provider.id === "openai" ? "max_completion_tokens" : "max_tokens"]: maxTokens };
      }
      try {
        if (controller.signal.aborted) throw new Error("Cancelled");
        const cancelled = new Promise((_, reject) => { abortListener = () => reject(new Error("Cancelled")); controller.signal.addEventListener("abort", abortListener, { once: true }); });
        const operation = (async () => {
          let response;
          try { response = await fetcher(endpoint, { method: "POST", headers, body: JSON.stringify(body), redirect: "error", signal: controller.signal }); }
          catch { throw new Error("The provider could not be reached. Check your connection and selected profile."); }
          if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status > 299) {
            Promise.resolve(response?.body?.cancel?.()).catch(() => {});
            const status = response?.status;
            throw new Error(status === 401 || status === 403 ? "The provider rejected authentication. Replace the key in your vault." : status === 429 ? "This provider reached its usage or rate limit. Choose another saved profile or retry later." : "The provider could not complete this request.");
          }
          const data = await readJson(response, controller.signal);
          if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The provider returned an invalid completion.");
          let content, inputTokens, outputTokens;
          if (provider.id === "gemini") {
            content = data.candidates?.[0]?.content?.parts?.filter((part) => part && part.thought !== true && typeof part.text === "string").map((part) => part.text).join("\n");
            inputTokens = count(data.usageMetadata?.promptTokenCount); outputTokens = count(data.usageMetadata?.candidatesTokenCount) + count(data.usageMetadata?.thoughtsTokenCount);
          } else if (provider.id === "anthropic") {
            content = data.content?.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n");
            inputTokens = count(data.usage?.input_tokens); outputTokens = count(data.usage?.output_tokens);
          } else { content = data.choices?.[0]?.message?.content; inputTokens = count(data.usage?.prompt_tokens); outputTokens = count(data.usage?.completion_tokens); }
          return { content: visible(content), model: normalized.model, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } };
        })();
        return await Promise.race([operation, cancelled]);
      } catch (error) {
        if (controller.signal.aborted) { const stopped = new Error(timedOut ? "The provider stage timed out." : "The model request was cancelled."); stopped.name = timedOut ? "TimeoutError" : "AbortError"; throw stopped; }
        // Our validation/status/decoding errors are fixed messages. Unknown
        // transport errors, which can echo URLs or credentials, never escape.
        const approved = /^(The provider |This provider )/.test(error?.message || "");
        throw new Error(approved ? error.message : "The provider returned an invalid completion.");
      } finally { clearTimeout(timeout); if (abortListener) controller.signal.removeEventListener("abort", abortListener); for (const signal of sources) signal.removeEventListener("abort", abort); }
    },
  });
}
module.exports = { PROVIDERS, definition, endpointFor, normalizeProfile, credential, buildVaultCompletion };
