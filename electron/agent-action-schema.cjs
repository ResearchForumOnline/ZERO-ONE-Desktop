"use strict";
// Grammar supplied only to the bundled inference engine; every resulting action
// still passes the independent project scope, text and human approval checks.
const text = (maxLength, minLength = 0) => ({ type: "string", minLength, maxLength });
const relativePath = text(4096, 1);
const explanation = text(2000);
function branch(tool, properties, required) {
  return {
    type: "object",
    properties: {
      tool: { type: "string", enum: [tool] },
      arguments: { type: "object", properties, required, additionalProperties: false },
    },
    required: ["tool", "arguments"],
    additionalProperties: false,
  };
}
const AGENT_ACTION_SCHEMA = {
  anyOf: [
    branch("list_files", { path: relativePath, depth: { type: "integer", minimum: 1, maximum: 3 } }, []),
    branch("read_file", { path: relativePath, startLine: { type: "integer", minimum: 1, maximum: 1000000 }, lines: { type: "integer", minimum: 1, maximum: 400 } }, ["path"]),
    branch("search_files", { path: relativePath, query: text(200, 1) }, ["query"]),
    branch("write_file", { path: relativePath, content: text(262144), explanation }, ["path", "content"]),
    branch("edit_file", { path: relativePath, oldText: text(65536, 1), newText: text(65536), explanation }, ["path", "oldText", "newText"]),
    branch("run_command", { command: text(8000, 1), cwd: relativePath, timeoutMs: { type: "integer", minimum: 1000, maximum: 120000 }, explanation }, ["command"]),
    branch("finish", { answer: text(24000, 1) }, ["answer"]),
  ],
};
module.exports = { AGENT_ACTION_SCHEMA };
