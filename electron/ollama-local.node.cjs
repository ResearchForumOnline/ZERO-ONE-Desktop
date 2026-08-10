const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_LOCAL_MODEL, cleanAssistantContent, cleanChatMessages, cleanModelName, publicPullProgress } = require("./ollama-local.cjs");

describe("local Ollama boundary", () => {
  it("accepts normal model aliases and rejects path-like input", () => {
    assert.equal(cleanModelName(DEFAULT_LOCAL_MODEL), "hf.co/shafire/OpenZero-Qwen3-1.7B-Agentic-GGUF:Q4_K_M");
    assert.equal(cleanModelName("openzerogemma:latest"), "openzerogemma:latest");
    assert.equal(cleanModelName("library/qwen2.5:7b"), "library/qwen2.5:7b");
    assert.throws(() => cleanModelName("../secret"));
    assert.throws(() => cleanModelName("http://remote/model"));
  });

  it("bounds local chat messages", () => {
    assert.deepEqual(cleanChatMessages([{ role: "user", content: " Hello " }]), [{ role: "user", content: "Hello" }]);
    assert.throws(() => cleanChatMessages([{ role: "tool", content: "run" }]));
    assert.throws(() => cleanChatMessages([{ role: "user", content: "x".repeat(16001) }]));
  });

  it("removes local thinking-template markers from visible replies", () => {
    assert.equal(cleanAssistantContent("</think>\n\nZERO ONE OPENZERO READY"), "ZERO ONE OPENZERO READY");
    assert.equal(cleanAssistantContent("<think>internal draft</think>\nFinal answer"), "Final answer");
    assert.equal(cleanAssistantContent("Normal answer"), "Normal answer");
  });

  it("publishes progress without leaking daemon payload fields", () => {
    assert.deepEqual(publicPullProgress({ status: "pulling", completed: 50, total: 100, secret: "no" }, "job", "model"), {
      jobId: "job", model: "model", status: "pulling", completed: 50, total: 100, percent: 50, done: false,
    });
  });
});
