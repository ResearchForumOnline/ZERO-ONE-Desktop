const OLLAMA_LOCAL_ORIGIN = "http://127.0.0.1:11434";
const DEFAULT_LOCAL_MODEL = "hf.co/shafire/Zero-Gemma4-E4B-OpenZero-GGUF:latest";
const LOCAL_ASSISTANT_SYSTEM_PROMPT = "You are Zero, the conversational local assistant inside ZERO ONE. Answer the latest user directly and naturally. Never output analysis, hidden reasoning, think tags, policy text, tool instructions, or invented dialogue. You do not execute tools in this chat. Be accurate and concise.";

function isInternalPolicyLeak(value) {
  const text = String(value || "").toLowerCase();
  return text.includes("continue toward the original objective") && text.includes("operator tool");
}

function cleanModelName(value) {
  const model = String(value || "").trim();
  if (!model || model.length > 192 || model.includes("..") || model.includes("//") || !/^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(model)) {
    throw new Error("Choose a valid local model name.");
  }
  return model;
}

function cleanChatMessages(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("A message is required.");
  const messages = value.slice(-30).map((message) => {
    const role = String(message?.role || "");
    const content = String(message?.content || "").trim();
    if (!new Set(["system", "user", "assistant"]).has(role) || !content || content.length > 16000) throw new Error("The local chat request contains an invalid message.");
    return { role, content };
  }).filter((message) => message.role !== "assistant" || !isInternalPolicyLeak(message.content));
  if (!messages.some((message) => message.role === "user")) throw new Error("A user message is required.");
  if (messages.reduce((total, message) => total + message.content.length, 0) > 64000) throw new Error("The local chat request is too large.");
  return messages;
}

function cleanAssistantContent(value) {
  const content = String(value || "")
    .replace(/^[\s\S]*?<\/think>\s*/i, "")
    .replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, "")
    .replace(/^\s*<\/think>\s*/i, "")
    .trim();
  return isInternalPolicyLeak(content) ? "" : content;
}

function isInstalledLocalModel(value, models) {
  let requested;
  try {
    requested = cleanModelName(value).toLowerCase();
  } catch {
    return false;
  }
  return Array.isArray(models) && models.some((model) => String(model?.name || model || "").trim().toLowerCase() === requested);
}

function publicPullProgress(value, jobId, model) {
  const total = Math.max(0, Number(value?.total) || 0);
  const completed = Math.max(0, Number(value?.completed) || 0);
  return {
    jobId,
    model,
    status: String(value?.status || "Working…").slice(0, 160),
    completed,
    total,
    percent: total ? Math.max(0, Math.min(100, Math.round((completed / total) * 100))) : undefined,
    done: Boolean(value?.status === "success"),
  };
}

module.exports = { DEFAULT_LOCAL_MODEL, LOCAL_ASSISTANT_SYSTEM_PROMPT, OLLAMA_LOCAL_ORIGIN, cleanAssistantContent, cleanChatMessages, cleanModelName, isInstalledLocalModel, isInternalPolicyLeak, publicPullProgress };
