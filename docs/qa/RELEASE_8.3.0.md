# ZERO ONE 8.3.0 verification record

Prepared 1 October 2026. Source, native execution, packaged delivery, Microsoft certification and installed state are separate outcomes.

## Implemented changes

- App-owned CPU inference with bundled, hash-verified llama.cpp b11321 binaries; separately downloaded pinned OpenZero Gemma4 E2B Q4_K_M weights. First setup reviews model terms and automates download, verification, loading and configuration. No GPU, separate Ollama installation or publisher API key is required.
- Native OpenZero setup replaces the default unreachable server webview. Optional server/API profiles remain explicit choices. A provider selected during a long download is preserved.
- Assistant acknowledgement, named progress, elapsed time, Stop/Escape and actual CPU/API labels. CPU work receives a longer bounded stage timeout.
- Encrypted named research projects with autosaved drafts, source snapshots, completed reports and interrupted checkpoints. Pending saves flush before navigation/export. Portable JSON excludes Vault/device configuration but contains readable selected research.
- Agent exact targeted edits, full before/after approval, pre-write digest checks, bounded context and strict tool parsing. A small compatibility path accepts only known flattened tool fields and retains execution checks.
- Browser Pilot uses the selected CPU/Vault completion adapter; isolated-tab grants, blocked sensitive fields, consequential approvals and cancellation remain in effect.

## Local verification

| Check | Result |
|---|---|
| UI/regression suites | 69 tests passed in 9 suites |
| Node backend suites | 242 passed, 0 failed |
| TypeScript and production Vite build | Passed |
| Existing published-site validator | Passed; static site still identifies its older 7.9.2 publication |
| Windows engine source payload | 34 pinned files verified |
| Windows ZSEC source payload | 89 files / 60 PE files verified, pinned 0.1.2 |
| Real Electron encryption/project persistence | Passed: encrypted save/reopen, portable disk round trip with new identity, credential-free export, edit/delete and interrupted recovery |
| Workflow YAML review | Both workflows parse; platform package/resource verification and native engine smoke steps retained |

### Real CPU inference and coding

Hardware: Intel Core i7-2600 at 3.40 GHz, 32 GB RAM, CPU only, zero GPU layers. This is one older Windows machine, not a broad performance evaluation.

Pinned model: `shafire/OpenZero-Gemma4-E2B-Agentic-GGUF`, revision `5e7205c17e2ed3085a45416da01add508be357e7`, 3,416,119,872 bytes, SHA-256 `9a7e717d13208526782c5fa5074bbcd7f445c6ac720e88d0e0e3ae6d87ebdeef`.

A short plain answer produced 86 tokens at 6.23 generation tokens/second. Loading took 19.3 seconds; the request took 28.2 seconds. Unauthenticated loopback access returned 401. No external inference was used.

The final synthetic project task completed in 243.4 seconds over six planning steps: read its README specification, approve and write `hello.cjs`, read back the saved file, finish. Two malformed replies were rejected without execution and recovered. Independent VM evaluation checked `hello("Ada")` and `hello("Zero")`. Earlier failed/stalled trials are retained locally and are not counted as successful runs. This verifies a small coding task, not general coding quality, unattended hours of work or scientific validity.

The owned server disables its native chat-channel parser because ZERO ONE owns action parsing. Project actions are streamed until the first complete JSON object, then independently validated. Plain answers collect the full text stream. Model schema requests are not treated as proof of a valid or successful action.

The final ordinary Chat probe with the production parser flags returned `2 plus 2 equals 4.` in 25.4 seconds including startup. A synthetic Browser snapshot produced the expected button action in 43.0 seconds; parser and policy accepted it. No browser action or navigation was executed by that probe. Sanitized records are in [NATIVE_CPU_8.3.0.json](NATIVE_CPU_8.3.0.json).

## Packaged Windows verification

The unsigned Store upload package is **217,157,475 bytes**, SHA-256 `4af1eaa0bbf7acef5cbc0b816f300e759314f7e0df5e4ff8cc8cc9b9bfd5e819`. Identity `talktoai.ZEROONEDesktop`, version **8.3.0.0**, architecture x64, existing publisher. All 213 ZIP entries passed integrity checking. The archived ASAR matches the staged ASAR and all 32 checked production/renderer files match the source/build. [Package receipt](PACKAGE_8.3.0.json).

The actual packaged app passed startup/DOM, 34-file CPU payload verification, fresh idle setup with no accepted terms or download, isolated Browser Pilot tab mounting, scanner identity and clean/incomplete scan evidence checks. This smoke does not execute CPU inference inside the packaged app or install an unsigned package over the user's Store application. Real CPU inference above uses the same verified native runtime and production manager.

A stale staged ZSEC provenance resource was detected during packaging acceptance and corrected to the verified 8.3 consumer lock. The packaging hook now validates both the source lock and the provenance resource before packaging. Store smoke uses its explicit app-owned scanner state directory, matching production behavior.

## Remaining release gates

Platform CI/public asset receipts and Store status are recorded after those actions return. The Microsoft Partner Center session currently requires sign-in in Brave. No 8.3 Store submission, certification, public Store delivery or installed-version claim is made by this verification record. Windows App Certification Kit acceptance is not claimed.

Public matching privacy notice: <https://researchforumonline.github.io/OpenZero/zero-one-privacy.html>. Source licensing does not replace engine/model terms.
