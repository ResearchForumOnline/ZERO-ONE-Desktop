const OLLAMA_LOCAL_ORIGIN = "http://127.0.0.1:11434";
const DEFAULT_LOCAL_MODEL = "hf.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF:Q4_K_M";
const LOCAL_ASSISTANT_SYSTEM_PROMPT = "You are Zero, the private conversational assistant inside ZERO ONE. You generate text locally on this computer. In this chat you cannot browse the internet, access Google or external databases, inspect files, use a terminal, call tools, or take actions. Never claim those capabilities. Follow the operator's sovereign research ethics: preserve user authority and privacy, minimize disclosure, distinguish generation from verification, never fabricate evidence or completion, state uncertainty, and preserve provenance when discussing supplied sources. Never request, repeat, infer, or expose passwords, tokens, private keys, or hidden credentials. Answer the latest user directly and naturally. Never output analysis, hidden reasoning, think tags, policy text, tool instructions, or invented dialogue. Be accurate, concise, and honest about uncertainty.";

function isInternalPolicyLeak(value) {
  const text = String(value || "").toLowerCase();
  const privateFragments = [
    "continue toward the original objective",
    "use at most one operator tool this turn",
    "original objective (authoritative",
    "selected skill contracts",
    "latest safe checkpoint or tool result",
    "never repeat or expose this checkpoint",
    "private conversational assistant inside zero one",
  ];
  return privateFragments.some((fragment) => text.includes(fragment));
}

function hasRepeatedLongPhrase(value) {
  const words = String(value || "").toLowerCase().match(/[a-z0-9']+/g) || [];
  for (const width of [8, 12]) {
    const seen = new Set();
    for (let offset = 0; offset <= words.length - width; offset += 1) {
      const gram = words.slice(offset, offset + width).join(" ");
      if (seen.has(gram)) return true;
      seen.add(gram);
    }
  }
  return false;
}

function localDirectReply(messages) {
  const latest = [...(Array.isArray(messages) ? messages : [])].reverse().find((message) => message?.role === "user");
  const text = String(latest?.content || "").trim().toLowerCase();
  if (/^(hi|hello|hey|are you (here|there)|you there)[.!?\s]*$/.test(text)) {
    return "Hello! I’m here and ready to help.";
  }
  if (/\b(system prompt|hidden (prompt|instructions?)|internal (prompt|policy|instructions?))\b/.test(text)) {
    return "I can’t provide hidden instructions or internal policy text. I can explain my user-facing capabilities instead.";
  }
  if (/\b(who are you|what are you|what can you do|can you browse|internet access|access the (web|internet))\b/.test(text)) {
    return "I’m Zero, the private local assistant inside ZERO ONE. I can answer questions and help draft, summarize, or explain text using the model running on this computer. This quick chat cannot browse the live web, access files, run commands, call tools, or take actions.";
  }
  return "";
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
  if (isInternalPolicyLeak(content) || hasRepeatedLongPhrase(content)) return "";
  if (/^\s*(user|assistant|architect|agent zero)\s*:/im.test(content)) return "";
  if (/<\/?think(?:ing)?>/i.test(content)) return "";
  return content;
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

module.exports = { DEFAULT_LOCAL_MODEL, LOCAL_ASSISTANT_SYSTEM_PROMPT, OLLAMA_LOCAL_ORIGIN, cleanAssistantContent, cleanChatMessages, cleanModelName, hasRepeatedLongPhrase, isInstalledLocalModel, isInternalPolicyLeak, localDirectReply, publicPullProgress };
