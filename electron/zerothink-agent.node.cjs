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
  const report = await runAgent({ task: "Update app and check it", root, maxSteps: 6, onProgress: event => progress.push(event) }, {
    complete: sequence([action("list_files", { path: "." }), action("read_file", { path: "app.txt" }), action("write_file", { path: "app.txt", content: "new implementation\n", explanation: "Repair the fixture" }), action("run_command", { command: "echo verified", cwd: ".", timeoutMs: 5000 }), action("finish", { answer: "Updated the file and ran an echo check." })]),
    approve: async input => { approved.push(input); return true; },
  });
  assert.equal(report.status, "completed"); assert.equal(report.edits, 1); assert.equal(report.commands, 1); assert.equal(report.reads, 2);
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
