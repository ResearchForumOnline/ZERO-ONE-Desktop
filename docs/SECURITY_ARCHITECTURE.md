# ZERO ONE security architecture

## Trust boundaries

The local React renderer is unprivileged. Electron exposes a narrow typed preload bridge; it does not expose Node.js, a general filesystem API, a shell-command API, raw network proxying or browser automation. IPC is accepted only from the main window's main renderer frame.

Each remote product runs in a separate persistent webview partition. Attached webviews receive no preload, have Node integration disabled, context isolation and sandboxing enabled, and are rejected unless their parsed origin is allowlisted. New-window and external-browser requests are deny-by-default and restricted to the same owned-origin list.

Camera and microphone access is denied unless the user enables CallChat media. Permission checks compare parsed origin equality with `https://callchat.org` or `https://www.callchat.org`.

OpenZero credentials are encrypted with Electron `safeStorage`. When Linux reports the insecure `basic_text` backend, credential storage is refused. Tokens are used only in the main process and are never returned to the renderer or included in diagnostics.

## ZSEC Shield bridge

ZERO ONE does not execute arbitrary paths or commands. It probes fixed platform-owned install locations and invokes only:

```text
zsec-shield status --json
```

Execution has a six-second timeout and 256 KiB output cap. The app rejects any output that is not JSON schema `zsec.shield.status.v1`, contract version 1, with bounded non-negative counters and a valid scan timestamp when one exists. A missing last scan is shown as installed/idle, never protected or clean.

The ZSEC runtime is a separate on-demand program. Before distribution, its native binary, installer, status contract and app dependency relationship must be signed and tested together.

## Release hardening

Packaged binaries flip Electron fuses before code signing: RunAsNode, NODE_OPTIONS, CLI inspection and extra file-protocol privileges are disabled; cookie encryption, embedded-ASAR integrity, ASAR-only loading, the browser V8 snapshot and WebAssembly trap handlers are enabled. Builds fail when the fuse package does not recognize every Electron fuse.

## Explicit non-goals in this preview

- Kernel or filesystem-driver interception.
- Background real-time malware prevention.
- Memory or behaviour scanning.
- Cloud reputation or sample upload.
- Autonomous deletion.
- Remote command execution from the advisory/definition feed.
- Independent antivirus certification or efficacy percentages.
