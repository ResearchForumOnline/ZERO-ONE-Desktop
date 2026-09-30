"use strict";

const path = require("node:path");
const { TextDecoder } = require("node:util");

const DOCUMENT_BYTES = 1024 * 1024;
const CORPUS_BYTES = 2 * DOCUMENT_BYTES;
const RESPONSE_BYTES = 1024 * 1024;
const STAGE_TIMEOUT_MS = 120000;
const MAX_COMPLETION_TOKENS = 2048;
const FILE_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json"]);
const PROVIDERS = new Set(["openzero", "openai", "groq", "ollama"]);

function invalid(message) {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value, label, maximum, { empty = false } = {}) {
  if (typeof value !== "string" || value.includes("\0") || value.length > maximum) {
    throw invalid(`${label} is invalid or exceeds its size limit.`);
  }
  const text = value.trim();
  if (!empty && !text) throw invalid(`${label} is required.`);
  return text;
}

function boundedInteger(value, fallback, minimum, maximum, label) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw invalid(`${label} is outside its supported range.`);
  }
  return value;
}

function displayTitle(value) {
  const input = boundedText(value, "Document title", 1024);
  // Imported paths never become source names or model-visible absolute paths.
  const title = path.posix.basename(input.replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 160).trim();
  if (!title || title === "." || title === "..") throw invalid("Document title is invalid.");
  return title;
}

function cleanSourceUrl(value) {
  if (value === undefined || value === "") return undefined;
  const text = boundedText(value, "Source URL", 2048);
  let url;
  try { url = new URL(text); } catch { throw invalid("Source URL is invalid."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw invalid("Source URL must be HTTP or HTTPS without embedded credentials.");
  }
  return url.toString();
}

function normalizeResearchRequest(raw) {
  if (!plainObject(raw)) throw invalid("A research request is required.");
  const question = boundedText(raw.question, "Research question", 12000);
  const mode = raw.mode === undefined ? "research" : raw.mode;
  if (!["quick", "research", "review"].includes(mode)) throw invalid("Choose a supported research mode.");
  const maxPasses = boundedInteger(raw.maxPasses, 3, 1, 3, "Research passes");
  const tokenBudget = boundedInteger(raw.tokenBudget, 3072, 512, 6144, "Token budget");
  const documents = raw.documents === undefined ? [] : raw.documents;
  if (!Array.isArray(documents) || documents.length > 8) throw invalid("A research request accepts at most eight documents.");
  let bytes = 0;
  const identifiers = new Set();
  const cleaned = documents.map((document) => {
    if (!plainObject(document)) throw invalid("A supplied document is invalid.");
    const text = boundedText(document.text, "Document text", DOCUMENT_BYTES);
    const size = Buffer.byteLength(text, "utf8");
    bytes += size;
    if (size > DOCUMENT_BYTES || bytes > CORPUS_BYTES) throw invalid("Documents exceed the local research size limit.");
    const result = { title: displayTitle(document.title), text };
    if (document.id !== undefined) {
      if (typeof document.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(document.id) || identifiers.has(document.id)) {
        throw invalid("Document identifiers must be distinct, short identifiers.");
      }
      identifiers.add(document.id);
      result.id = document.id;
    }
    const sourceUrl = cleanSourceUrl(document.sourceUrl);
    if (sourceUrl) result.sourceUrl = sourceUrl;
    return result;
  });
  const request = { question, mode, documents: cleaned, maxPasses, tokenBudget };
  if (raw.processId !== undefined) {
    if (typeof raw.processId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(raw.processId)) throw invalid("Research process identifier is invalid.");
    request.processId = raw.processId;
  }
  return request;
}

function cleanImportedDocument(name, buffer) {
  const title = displayTitle(name);
  if (!FILE_EXTENSIONS.has(path.posix.extname(title).toLowerCase())) throw invalid("Import a TXT, Markdown, CSV or JSON text document.");
  if (!(buffer instanceof Uint8Array) || buffer.byteLength === 0 || buffer.byteLength > DOCUMENT_BYTES) {
    throw invalid("An imported document must contain between one byte and one MiB of UTF-8 text.");
  }
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { throw invalid("The imported document is not valid UTF-8 text."); }
  text = boundedText(text, "Imported document", DOCUMENT_BYTES);
  return { title, text };
}

function isLoopback(hostname) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function endpointFor(value, ollama) {
  if (typeof value !== "string" || value.length > 2048) throw invalid("A valid model endpoint is required.");
  let url;
  try { url = new URL(value); } catch { throw invalid("A valid model endpoint is required."); }
  if (url.username || url.password || url.search || url.hash || !["http:", "https:"].includes(url.protocol)) {
    throw invalid("Model endpoints cannot contain credentials, query parameters or fragments.");
  }
  if (url.protocol !== "https:" && !isLoopback(url.hostname)) throw invalid("Remote model endpoints require HTTPS.");
  const host = url.hostname.toLowerCase();
  if (/^169\.254\./.test(host) || /^\[(?:fe[89ab][0-9a-f]:|ff)/i.test(host) || host === "0.0.0.0" || host === "[::]") {
    throw invalid("This model endpoint is not an allowed server address.");
  }
  const pathname = url.pathname.replace(/\/+$/, "");
  if (ollama) {
    if (!["", "/api", "/api/chat"].includes(pathname)) throw invalid("Choose an Ollama server origin or its chat endpoint.");
    url.pathname = "/api/chat";
  } else if (pathname === "") url.pathname = "/v1/chat/completions";
  else if (pathname.endsWith("/v1")) url.pathname = `${pathname}/chat/completions`;
  else if (!pathname.endsWith("/chat/completions")) throw invalid("Choose an OpenAI-compatible chat endpoint.");
  return url.toString();
}

function messagesFor(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) throw invalid("Supply between one and 64 completion messages.");
  let size = 0;
  return value.map((message) => {
    if (!plainObject(message) || !["system", "user", "assistant"].includes(message.role)) throw invalid("A completion message is invalid.");
    const content = boundedText(message.content, "Completion message", 262144);
    size += Buffer.byteLength(content, "utf8");
    if (size > CORPUS_BYTES + 65536) throw invalid("Completion messages exceed the supported size limit.");
    return { role: message.role, content };
  });
}

function validSignal(value) {
  if (value !== undefined && !(value instanceof AbortSignal)) throw invalid("A cancellation signal is invalid.");
  return value;
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1000000000 ? value : 0;
}

function publicContent(value) {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > RESPONSE_BYTES) throw new Error("The model returned an invalid text response.");
  let content = value.replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, "");
  const incomplete = content.search(/<think\b/i);
  if (incomplete >= 0) content = content.slice(0, incomplete);
  content = content.trim();
  if (!content) throw new Error("The model returned no visible answer.");
  return content;
}

async function readResponse(response, signal) {
  const advertised = response.headers?.get?.("content-length");
  if (advertised && /^\d+$/.test(advertised) && Number(advertised) > RESPONSE_BYTES) {
    throw new Error("The model response exceeded the one MiB limit.");
  }
  if (!response.body || typeof response.body.getReader !== "function") throw new Error("The model returned an invalid response body.");
  const reader = response.body.getReader();
  const abortRead = () => { Promise.resolve(reader.cancel()).catch(() => {}); };
  signal.addEventListener("abort", abortRead, { once: true });
  if (signal.aborted) abortRead();
  let bytes = 0;
  let complete = false;
  const chunks = [];
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      if (!(item.value instanceof Uint8Array)) throw new Error("The model returned an invalid response body.");
      bytes += item.value.byteLength;
      if (bytes > RESPONSE_BYTES) throw new Error("The model response exceeded the one MiB limit.");
      chunks.push(item.value);
    }
    complete = true;
  } finally {
    signal.removeEventListener("abort", abortRead);
    if (!complete) Promise.resolve(reader.cancel()).catch(() => {});
    try { reader.releaseLock(); } catch { /* A cancelled read may still be pending. */ }
  }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes))); }
  catch { throw new Error("The model returned invalid JSON."); }
}

function buildCompletionAdapter(options) {
  if (!plainObject(options) || !PROVIDERS.has(options.provider)) throw invalid("Choose a supported model provider.");
  if (options.mode !== undefined && !["local", "server"].includes(options.mode)) throw invalid("Choose local or server model routing.");
  const ollama = options.provider === "ollama" || (options.provider === "openzero" && options.mode === "local");
  if (ollama && options.storeManaged === true) throw invalid("The Store edition uses an existing OpenZero server or an optional API provider for ZeroThink.");
  const endpoint = endpointFor(options.endpoint, ollama);
  const model = boundedText(options.model, "Model name", 192);
  if (/[\r\n\u0000-\u001f]/.test(model)) throw invalid("Model name is invalid.");
  const token = options.token === undefined ? "" : options.token;
  if (typeof token !== "string" || token.length > 8192 || /[\u0000-\u0020\u007f]/.test(token)) throw invalid("The model credential is invalid.");
  if (["openai", "groq"].includes(options.provider) && !token) throw invalid("Save a key for the selected API provider before starting ZeroThink.");
  const fetcher = options.fetch || globalThis.fetch;
  if (typeof fetcher !== "function") throw invalid("A model transport is unavailable.");
  const adapterSignal = validSignal(options.signal);

  return Object.freeze({
    async complete(request) {
      if (!plainObject(request)) throw invalid("A completion request is required.");
      const messages = messagesFor(request.messages);
      const maxTokens = boundedInteger(request.maxTokens, 1024, 1, MAX_COMPLETION_TOKENS, "Completion token limit");
      const requestSignal = validSignal(request.signal);
      if (request.stage !== undefined) boundedText(request.stage, "Research stage", 80);
      const controller = new AbortController();
      let timedOut = false;
      const abort = () => controller.abort();
      const sources = [...new Set([adapterSignal, requestSignal].filter(Boolean))];
      for (const signal of sources) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", abort, { once: true });
      }
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, STAGE_TIMEOUT_MS);
      let abortListener;
      try {
        if (controller.signal.aborted) throw new Error("Cancelled");
        const headers = { "Content-Type": "application/json", Accept: "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const body = ollama
          ? { model, messages, stream: false, options: { num_predict: maxTokens, temperature: 0.3 }, keep_alive: "5m" }
          : { model, messages, stream: false, max_tokens: maxTokens, temperature: 0.3 };
        const cancelled = new Promise((_, reject) => {
          abortListener = () => reject(new Error("Cancelled"));
          controller.signal.addEventListener("abort", abortListener, { once: true });
        });
        const operation = (async () => {
          const response = await fetcher(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal, redirect: "error" });
          if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status > 299) {
            // Never interpolate the endpoint, provider error body or key into errors.
            Promise.resolve(response?.body?.cancel?.()).catch(() => {});
            const status = Number.isInteger(response?.status) ? response.status : 0;
            throw new Error(status === 401 || status === 403 ? "The model server rejected authentication; check its saved key." : status === 429 ? "The model provider limit was reached; retry later or choose another configured provider." : "The model server could not complete this request.");
          }
          const data = await readResponse(response, controller.signal);
          if (!plainObject(data)) throw new Error("The model returned an invalid completion.");
          const content = publicContent(ollama ? data.message?.content : data.choices?.[0]?.message?.content);
          const inputTokens = count(ollama ? data.prompt_eval_count : data.usage?.prompt_tokens);
          const outputTokens = count(ollama ? data.eval_count : data.usage?.completion_tokens);
          return { content, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } };
        })();
        return await Promise.race([operation, cancelled]);
      } catch (error) {
        if (controller.signal.aborted) {
          const stopped = new Error(timedOut ? "The model stage timed out after 120 seconds." : "The research request was cancelled.");
          stopped.name = timedOut ? "TimeoutError" : "AbortError";
          throw stopped;
        }
        const allowed = [
          "The model server rejected authentication; check its saved key.",
          "The model provider limit was reached; retry later or choose another configured provider.",
          "The model server could not complete this request.",
          "The model response exceeded the one MiB limit.",
          "The model returned an invalid response body.",
          "The model returned invalid JSON.",
          "The model returned an invalid completion.",
          "The model returned an invalid text response.",
          "The model returned no visible answer.",
        ];
        throw new Error(allowed.includes(error?.message) ? error.message : "The model connection failed; check the selected server and network.");
      } finally {
        clearTimeout(timeout);
        for (const signal of sources) signal.removeEventListener("abort", abort);
        if (abortListener) controller.signal.removeEventListener("abort", abortListener);
      }
    },
  });
}

module.exports = { buildCompletionAdapter, cleanImportedDocument, normalizeResearchRequest, DOCUMENT_BYTES, CORPUS_BYTES, RESPONSE_BYTES, STAGE_TIMEOUT_MS, MAX_COMPLETION_TOKENS };
