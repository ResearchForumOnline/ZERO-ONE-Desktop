"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { runAgent, runLocalCommand, parseAction, projectPath } = require("./zerothink-agent.cjs");

const action = (tool, args = {}) => ({ content: JSON.stringify({ tool, arguments: args }) });
const sequence = entries => { let index = 0; return async request => { assert.equal(request.messages[0].role, "system"); assert.equal(request.messages[1].role, "user"); return entries[index++] ?? action("finish", { answer: "Done." }); }; };
async function fixture(fn) { const root = await fs.mkdtemp(path.join(os.tmpdir(), "zerothink-agent-")); try { await fn(root); } finally { await fs.rm(root, { recursive: true, force: true }); } }

test("project agent executes real bounded reads, approved writes and a shell check before reporting", async () => fixture(async root => {
  await fs.writeFile(path.join(root, "app.txt"), "old implementation\n");
  const approved = []; const progress = [];
  // A cold Windows PowerShell on a shared CI runner can exceed five seconds.
  // This fixture still executes a real bounded shell; production limits stay unchanged.
  const shellTimeout = process.platform === "win32" ? 30000 : 5000;
  const report = await runAgent({ task: "Update app and check it", root, maxSteps: 6, onProgress: event => progress.push(event) }, {
    complete: sequence([action("list_files", { path: "." }), action("read_file", { path: "app.txt" }), action("write_file", { path: "app.txt", content: "new implementation\n", explanation: "Repair the fixture" }), action("run_command", { command: "echo verified", cwd: ".", timeoutMs: shellTimeout }), action("finish", { answer: "Updated the file and ran an echo check." })]),
    approve: async input => { approved.push(input); return true; },
  });
  assert.equal(report.status, "completed", JSON.stringify(report.errors)); assert.equal(report.edits, 1); assert.equal(report.commands, 1); assert.equal(report.reads, 2);
  assert.equal(report.errors.length, 0); assert.deepEqual(report.changedFiles, ["app.txt"]);
  assert.equal(await fs.readFile(path.join(root, "app.txt"), "utf8"), "new implementation\n");
  assert.equal(approved[0].before, "old implementation\n"); assert.equal(approved[0].after, "new implementation\n");
  assert.equal(approved[1].command, "echo verified"); assert.equal(approved[1].cwd, await fs.realpath(root));
  assert.match(approved[0].actionId, /^[\da-f-]{36}$/i);
  assert.notEqual(approved[0].actionId, approved[1].actionId);
  assert.ok(progress.some(event => event.status === "approval"));
  assert.ok(report.observations.find(item => item.tool === "run_command").output.stdout.includes("verified"));
}));

test("denied writes never execute and prevent a false completion claim", async () => fixture(async root => {
  const report = await runAgent({ task: "Create file", root }, { complete: sequence([action("write_file", { path: "new.txt", content: "no" }), action("finish", { answer: "Created it." })]), approve: async () => false });
  assert.equal(report.status, "paused"); assert.equal(report.edits, 0); assert.match(report.answer, /Unfinished/);
  await assert.rejects(fs.stat(path.join(root, "new.txt")), { code: "ENOENT" });
}));

test("sensitive paths, traversal and outside links are rejected without approval", async () => fixture(async root => {
  for (const supplied of ["../outside.txt", ".env", ".env.local", ".git/config", "credentials.json", "nested/passwords.txt", "a/private.key", "C:\\outside.txt"]) await assert.rejects(projectPath(root, supplied, { allowMissing: true }));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "zerothink-outside-"));
  try {
    await fs.writeFile(path.join(outside, "private.txt"), "outside");
    await fs.symlink(outside, path.join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(projectPath(root, "linked/private.txt"), /links|junctions|leaves/);
    let approvals = 0;
    const report = await runAgent({ task: "Edit outside", root, maxSteps: 2 }, { complete: sequence([action("write_file", { path: "linked/private.txt", content: "changed" }), action("finish", { answer: "Done." })]), approve: () => { approvals += 1; return true; } });
    assert.equal(approvals, 0); assert.equal(report.edits, 0); assert.equal(report.status, "paused");
    assert.equal(await fs.readFile(path.join(outside, "private.txt"), "utf8"), "outside");
  } finally { await fs.rm(outside, { recursive: true, force: true }); }
}));

test("a file changed during approval is retained and needs a fresh proposal", async () => fixture(async root => {
  const file = path.join(root, "app.txt"); await fs.writeFile(file, "old");
  const report = await runAgent({ task: "Edit app", root }, { complete: sequence([action("write_file", { path: "app.txt", content: "proposed" }), action("finish", { answer: "Done." })]), approve: async () => { await fs.writeFile(file, "owner's edit"); return true; } });
  assert.equal(report.status, "paused"); assert.equal(report.edits, 0); assert.match(report.errors[0].message, /changed after approval/);
  assert.equal(await fs.readFile(file, "utf8"), "owner's edit");
}));

test("nested new files are real atomic writes and existing executable permissions survive", async () => fixture(async root => {
  const file = path.join(root, "app.sh"); await fs.writeFile(file, "old", { mode: 0o700 });
  const mode = (await fs.stat(file)).mode & 0o777;
  const report = await runAgent({ task: "Create files", root }, { complete: sequence([action("write_file", { path: "src/game/main.txt", content: "game" }), action("write_file", { path: "app.sh", content: "new" }), action("finish", { answer: "Created and updated files." })]), approve: async () => true });
  assert.equal(report.edits, 2); assert.equal(await fs.readFile(path.join(root, "src/game/main.txt"), "utf8"), "game");
  assert.equal((await fs.stat(file)).mode & 0o777, mode);
}));

test("stop while waiting for approval leaves the project unchanged", async () => fixture(async root => {
  const controller = new AbortController();
  const report = await runAgent({ task: "Create file", root, signal: controller.signal }, { complete: sequence([action("write_file", { path: "new.txt", content: "no" })]), approve: () => { setTimeout(() => controller.abort(), 10); return new Promise(() => {}); } });
  assert.equal(report.status, "stopped"); assert.equal(report.edits, 0);
  await assert.rejects(fs.stat(path.join(root, "new.txt")), { code: "ENOENT" });
}));

test("step caps and malformed model tool markup remain visibly unfinished", async () => fixture(async root => {
  assert.throws(() => parseAction("<function=write_file>"), /No action was executed/);
  assert.throws(() => parseAction('{"tool":"remove_all","arguments":{}}'), /supported tool/);
  const report = await runAgent({ task: "Inspect files", root, maxSteps: 2 }, { complete: async () => action("list_files", { path: "." }), approve: () => true });
  assert.equal(report.status, "paused"); assert.equal(report.steps, 2); assert.equal(report.reads, 2); assert.match(report.answer, /step limit/);
}));

test("failed shell commands preserve captured evidence and never claim verification", async () => fixture(async root => {
  const report = await runAgent({ task: "Check app", root }, { complete: sequence([action("run_command", { command: "synthetic failure" }), action("finish", { answer: "All tests passed." })]), approve: () => true, runCommand: async () => ({ exitCode: 1, stdout: "failure evidence", stderr: "synthetic error" }) });
  assert.equal(report.status, "paused"); assert.equal(report.commands, 1); assert.match(report.errors[0].message, /failed/);
  assert.equal(report.observations[0].output.stdout, "failure evidence");
}));

test("command cancellation stops the owned child process", async () => fixture(async root => {
  const controller = new AbortController();
  const command = process.platform === "win32" ? "Start-Sleep -Seconds 20" : "sleep 20";
  const pending = runLocalCommand({ command, cwd: root, timeoutMs: 10000, signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(pending, { name: "AbortError" });
}));

test("project Agent completes through the real bounded adapter instead of exceeding its token limit", async () => fixture(async root => {
  const { buildCompletionAdapter } = require("./zerothink-desktop.cjs");
  const seen = [];
  const adapter = buildCompletionAdapter({ provider: "openzero", mode: "server", endpoint: "https://example.org/v1", model: "synthetic", fetch: async (_url, request) => {
    const body = JSON.parse(request.body); seen.push(body.max_tokens);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ tool: "finish", arguments: { answer: "Synthetic task completed." } }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  } });
  await assert.rejects(adapter.complete({ messages: [{ role: "user", content: "Fixture" }], maxTokens: 4096 }), /token limit/);
  const report = await runAgent({ task: "Return a bounded summary", root, maxSteps: 1 }, { ...adapter, approve: async () => true });
  assert.equal(report.status, "completed"); assert.deepEqual(report.errors, []); assert.deepEqual(seen, [2048]);
}));

test("edit_file performs a unique approved atomic replacement with digest receipts and permissions", async () => fixture(async root => {
  const file = path.join(root, "large.txt"), text = "keep this line\n".repeat(5000) + "unique old target\nend\n"; await fs.writeFile(file, text, { mode: 0o700 });
  const mode = (await fs.stat(file)).mode & 0o777; let preview;
  const report = await runAgent({ task: "Edit the unique target", root }, { complete: sequence([action("edit_file", { path: "large.txt", oldText: "unique old target", newText: "unique repaired target", explanation: "Repair one target" }), action("finish", { answer: "Repaired one target." })]), approve: async input => { preview = input; return true; } });
  assert.equal(report.status, "completed"); assert.equal(report.edits, 1); assert.equal(preview.tool, "edit_file"); assert.equal(preview.before, text); assert.match(preview.after, /unique repaired target/);
  assert.equal(await fs.readFile(file, "utf8"), text.replace("unique old target", "unique repaired target")); assert.equal((await fs.stat(file)).mode & 0o777, mode);
  const receipt = report.observations[0].output; assert.equal(receipt.replacements, 1); assert.equal(receipt.charsRemoved, 17); assert.equal(receipt.charsAdded, 22); assert.match(receipt.sha256, /^[a-f0-9]{64}$/); assert.notEqual(receipt.beforeSha256, receipt.sha256);
}));

test("edit_file refuses missing ambiguous overlapping empty and no-op text before approval", async () => fixture(async root => {
  const file = path.join(root, "app.txt"); await fs.writeFile(file, "aaaa");
  for (const oldText of ["missing", "aa", "", "aaaa"]) {
    let approvals = 0; const report = await runAgent({ task: "Edit", root, maxSteps: 1 }, { complete: async () => action("edit_file", { path: "app.txt", oldText, newText: oldText === "aaaa" ? "aaaa" : "replacement" }), approve: () => { approvals++; return true; } });
    assert.equal(approvals, 0); assert.equal(report.edits, 0); assert.equal(report.status, "paused"); assert.equal(await fs.readFile(file, "utf8"), "aaaa");
  }
}));

test("edit_file preserves denied and concurrently edited files", async () => fixture(async root => {
  const file = path.join(root, "app.txt"); await fs.writeFile(file, "old target");
  const denied = await runAgent({ task: "Edit", root, maxSteps: 1 }, { complete: async () => action("edit_file", { path: "app.txt", oldText: "old target", newText: "new target" }), approve: async () => false });
  assert.equal(denied.edits, 0); assert.equal(await fs.readFile(file, "utf8"), "old target");
  const stale = await runAgent({ task: "Edit", root, maxSteps: 1 }, { complete: async () => action("edit_file", { path: "app.txt", oldText: "old target", newText: "new target" }), approve: async () => { await fs.writeFile(file, "owner edited target"); return true; } });
  assert.equal(stale.edits, 0); assert.match(stale.errors[0].message, /changed after approval/); assert.equal(await fs.readFile(file, "utf8"), "owner edited target");
}));

test("edit_file rejects symlinks and sensitive paths without presenting a write approval", async () => fixture(async root => {
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "zt-edit-outside-"));
  try {
    await fs.writeFile(path.join(outside, "app.txt"), "old target"); await fs.symlink(outside, path.join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
    for (const relative of ["linked/app.txt", ".env", "../app.txt"]) { let approvals = 0; const report = await runAgent({ task: "Edit", root, maxSteps: 1 }, { complete: async () => action("edit_file", { path: relative, oldText: "old target", newText: "new target" }), approve: () => { approvals++; return true; } }); assert.equal(report.edits, 0); assert.equal(approvals, 0); }
    assert.equal(await fs.readFile(path.join(outside, "app.txt"), "utf8"), "old target");
  } finally { await fs.rm(outside, { recursive: true, force: true }); }
}));


test("bounded flattened tool compatibility normalizes field placement and still requires write approval", async () => fixture(async root => {
  const flat = { tool: "write_file", path: "hello.txt", content: "hello", explanation: "Create fixture" };
  const parsed = parseAction(JSON.stringify(flat)); assert.equal(parsed.protocol, "flat-compatible"); assert.deepEqual(parsed.arguments, { path: "hello.txt", content: "hello", explanation: "Create fixture" });
  let approvals = 0;
  const report = await runAgent({ task: "Create hello", root }, { complete: sequence([{ content: JSON.stringify(flat) }, { content: '{"tool":"finish","answer":"Created hello."}' }]), approve: async preview => { approvals++; assert.equal(preview.tool, "write_file"); assert.equal(preview.after, "hello"); return true; } });
  assert.equal(report.status, "completed"); assert.equal(approvals, 1); assert.equal(await fs.readFile(path.join(root, "hello.txt"), "utf8"), "hello"); assert.equal(report.observations[0].protocol, "flat-compatible");
  const denied = await runAgent({ task: "Overwrite hello", root, maxSteps: 1 }, { complete: async () => ({ content: JSON.stringify({ ...flat, content: "denied" }) }), approve: async () => false });
  assert.equal(denied.edits, 0); assert.equal(await fs.readFile(path.join(root, "hello.txt"), "utf8"), "hello");
}));

test("flattened compatibility rejects unknown tools fields mixed envelopes and arbitrary arrays", () => {
  for (const action of [
    { tool: "write_file", path: "x", content: "x", approval: true },
    { tool: "write_file", arguments: { path: "x", content: "x" }, path: "other" },
    { tool: "write_file", arguments: { path: "x", content: "x", skipApproval: true } },
    { tool: "run_command", command: "echo x", selector: "#x" },
    { tool: "unknown", path: "x" }, { tool: "write_file", arguments: [] }, [{ tool: "finish", answer: "Done" }],
  ]) assert.throws(() => parseAction(JSON.stringify(action)), /No action was executed/);
});

test("flattened compatibility does not bypass sensitive-path or edit validation", async () => fixture(async root => {
  let approvals = 0;
  const report = await runAgent({ task: "Unsafe fixture", root, maxSteps: 1 }, { complete: async () => ({ content: '{"tool":"write_file","path":"../outside.txt","content":"x"}' }), approve: async () => { approvals++; return true; } });
  assert.equal(approvals, 0); assert.equal(report.edits, 0); assert.match(report.errors[0].message, /traversal/);
}));

test("bundled Agent grammar covers only canonical known tool envelopes with bounded argument fields", () => {
  const { AGENT_ACTION_SCHEMA } = require("./agent-action-schema.cjs");
  assert.equal(AGENT_ACTION_SCHEMA.anyOf.length, 7);
  const tools = AGENT_ACTION_SCHEMA.anyOf.map(branch => branch.properties.tool.enum[0]);
  assert.deepEqual(tools, ["list_files", "read_file", "search_files", "write_file", "edit_file", "run_command", "finish"]);
  for (const branch of AGENT_ACTION_SCHEMA.anyOf) {
    assert.equal(branch.type, "object"); assert.equal(branch.additionalProperties, false); assert.deepEqual(branch.required, ["tool", "arguments"]);
    const args = branch.properties.arguments; assert.equal(args.type, "object"); assert.equal(args.additionalProperties, false);
    for (const field of args.required) assert.ok(args.properties[field]);
    for (const field of Object.values(args.properties)) {
      assert.ok(["string", "integer"].includes(field.type));
      if (field.type === "string") assert.ok(Number.isInteger(field.maxLength) && field.maxLength <= 262144);
      else assert.ok(Number.isInteger(field.maximum) && field.minimum >= 1);
    }
    const tool = branch.properties.tool.enum[0];
    const supplied = Object.fromEntries(args.required.map(field => [field, field === "content" ? "" : "fixture"]));
    assert.equal(parseAction(JSON.stringify({ tool, arguments: supplied })).tool, tool);
    assert.throws(() => parseAction(JSON.stringify({ tool, arguments: { ...supplied, unapprovedField: "x" } })), /No action was executed/);
  }
  const edit = AGENT_ACTION_SCHEMA.anyOf.find(branch => branch.properties.tool.enum[0] === "edit_file");
  assert.deepEqual(edit.properties.arguments.required, ["path", "oldText", "newText"]);
});

test("Agent model history compacts oversized observations instead of dropping the latest verified read", async () => fixture(async root => {
  await fs.writeFile(path.join(root, "large.txt"), "VISIBLE_LATEST_OBSERVATION\n" + ('"'.repeat(700) + "\n").repeat(30));
  let calls = 0;
  const report = await runAgent({ task: "Read this synthetic fixture", root, maxSteps: 2 }, { maxInputCharacters: 10000, approve: async () => true, complete: async request => {
    calls++; assert.ok(request.messages.reduce((sum, message) => sum + message.content.length, 0) <= 10000);
    if (calls === 1) return action("read_file", { path: "large.txt", lines: 400 });
    assert.match(request.messages[1].content, /VISIBLE_LATEST_OBSERVATION/); assert.match(request.messages[1].content, /observation compacted; reread smaller range/); assert.match(request.messages[1].content, /sha256/);
    return action("finish", { answer: "Read the fixture." });
  } });
  assert.equal(report.status, "completed"); assert.equal(report.observations[0].output.content.includes("VISIBLE_LATEST_OBSERVATION"), true); assert.ok(report.observations[0].output.content.length > 10000);
}));

test("Agent repeated large observations remain inside trusted model budget without shortening the goal", async () => fixture(async root => {
  await fs.writeFile(path.join(root, "large.txt"), "KEEP_VERIFIED_EXCERPT\n" + ('"'.repeat(700) + "\n").repeat(30));
  const task = "AUTHORITATIVE_GOAL " + "preserve this goal ".repeat(40); let calls = 0;
  const report = await runAgent({ task, root, maxSteps: 6 }, { maxInputCharacters: 10000, approve: async () => true, complete: async request => {
    calls++; const prompt = request.messages[1].content; assert.ok(prompt.includes(task)); assert.ok(request.messages.reduce((sum, message) => sum + message.content.length, 0) <= 10000);
    if (calls > 1) { assert.match(prompt, /KEEP_VERIFIED_EXCERPT/); assert.match(prompt, /Verified totals: [1-5] reads/); }
    return calls < 6 ? action("read_file", { path: "large.txt", lines: 400 }) : action("finish", { answer: "Read fixture five times." });
  } });
  assert.equal(report.status, "completed"); assert.equal(report.observations.length, 5); assert.equal(report.reads, 5);
}));

test("Agent rejects an oversized authoritative goal before calling the model or executing tools", async () => fixture(async root => {
  let calls = 0;
  await assert.rejects(runAgent({ task: "x".repeat(9000), root }, { maxInputCharacters: 10000, complete: async () => { calls++; return action("finish", { answer: "No" }); }, approve: async () => true }), /no tools were executed/);
  assert.equal(calls, 0);
}));
