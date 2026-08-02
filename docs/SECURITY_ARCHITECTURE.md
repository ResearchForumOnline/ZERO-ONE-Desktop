# ZERO ONE security architecture

## Trust boundaries

The local React renderer is unprivileged. Electron exposes a narrow typed preload bridge; it does not expose Node.js, a general filesystem API, a shell-command API, raw network proxying, or browser automation. IPC is accepted only from the main window's main renderer frame.

Each remote product runs in a separate persistent webview partition. Attached webviews receive no preload, have Node integration disabled, context isolation and sandboxing enabled, and are rejected unless their parsed origin is allowlisted. New-window and external-browser requests are deny-by-default and restricted to reviewed owned/public-support origins.

Camera and microphone access is denied unless the user enables CallChat media. Permission checks compare parsed origin equality with `https://callchat.org` or `https://www.callchat.org`.

OpenZero credentials are encrypted with Electron `safeStorage`. When Linux reports the insecure `basic_text` backend, credential storage is refused. Tokens are used only in the main process and are never returned to the renderer or included in diagnostics.

## ZMath Secure platform layer

ZMath Secure is a visible policy and compatibility layer, not a claim that an unpublished cipher is active. Remote owned products require HTTPS; the only allowed HTTP model target is a loopback OpenZero endpoint on this machine. The renderer can request a bounded status object but receives no generic PowerShell or shell primitive.

On Windows, the main process invokes a fixed, non-interactive `Get-BitLockerVolume` status query with no renderer-controlled arguments, an eight-second timeout, and a 64 KiB output cap. The opt-in action opens the fixed `ms-settings:deviceencryption` page. ZERO ONE does not enable BitLocker, handle recovery keys, or implement full-disk encryption itself.

The public repository contains only the documented ZMath compatibility boundary. Unpublished research and experimental cipher implementations remain outside Git history and release artifacts. Standard TLS and operating-system cryptography remain active even when no proprietary engine exists.

## ZSEC supply-chain boundary

ZERO ONE 0.4.0 consumes only ZSEC Shield 0.1.2 from immutable public release ID `363682670` and source revision `78efb1186c50efeeedf68bc14044cbc019fc0e8e`. Windows x64, macOS arm64 and Linux x64 packages each stage the matching authenticated native asset, verify its pinned archive and manifest identities, and smoke the native entrypoint before packaging.

The private lock is not trusted by itself. The verifier embeds the complete expected lock identity—including release/tag objects, archive SHA-256, native-manifest SHA-256, entrypoint SHA-256, architecture, source revision, file count, and contracts—and rejects any rewritten lock. The stager additionally verifies live immutable-release metadata, the GitHub release-integrity attestation, safe ZIP structure, exact bidirectional manifest inventory, every file size/hash, required licences, and AMD64 headers for every EXE/DLL/PYD.

The v0.1.2 GitHub release attestation proves release/tag/asset integrity. Its original workflow did not create an Actions/SLSA build-provenance attestation. The next-release workflow now has full-SHA Action pins and build provenance, without changing immutable v0.1.2.

## ZSEC runtime bridge

ZERO ONE invokes only the bundled fixed runtime first, followed by fixed platform-owned install locations. It never accepts a renderer-supplied executable or argument vector.

Status command:

```text
zsec-shield status --json
```

Status execution has a six-second timeout and 256 KiB output cap. Contract v2 validation requires bounded counters, consistent diagnostic availability, exact outcomes, a valid timestamp when one exists, and these state rules:

- no prior scan with null evidence → `idle`;
- `no_configured_rule_matches` with zero findings/errors → `ready`;
- configured matches with at least one finding and zero errors → `attention`;
- incomplete evidence → `attention`;
- legacy recorded scans, malformed data, unavailable diagnostics, or contradictory counters → `unavailable`.

Selected-folder scan command:

```text
zsec-shield check <user-selected-folder> --json
```

The operating-system picker supplies exactly one folder. Execution uses a fixed argument vector, ten-minute timeout, and 2 MiB output cap. Scan reports must satisfy the same outcome invariants, and the process exit must match the report: 0 for clean, 1 for configured matches, and 2 for incomplete. Timeouts, spawn failures, mismatches, and malformed reports fail closed as incomplete.

The renderer receives only bounded aggregate counts and messages. The desktop does not request ZSEC quarantine, deletion, upload, background service installation, or definition updates.

## Electron release hardening

Before code signing, the after-pack hook flips every recognized fuse with `strictlyRequireAllFuses`:

- RunAsNode, `NODE_OPTIONS`, and CLI inspection disabled;
- cookie encryption, embedded-ASAR integrity, ASAR-only loading, and Wasm trap handlers enabled;
- browser-process-specific V8 snapshot disabled because the required snapshot file is not present in the packaged Electron distribution;
- extra file-protocol privileges enabled because the trusted renderer currently uses `loadFile`.

The file-protocol exception does not extend Node/preload privileges to remote HTTPS webviews. Migrating the trusted renderer to a custom protocol would allow this fuse to be disabled in a later release.

## Explicit non-goals

- Kernel or filesystem-driver interception.
- Background real-time malware prevention.
- Memory or behavioural scanning.
- Cloud reputation or sample upload.
- Autonomous deletion or quarantine from the desktop button.
- Remote command execution from an advisory/definition feed.
- Independent antivirus certification or efficacy percentages.
