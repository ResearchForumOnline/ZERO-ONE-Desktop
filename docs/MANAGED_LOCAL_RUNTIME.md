# App-owned OpenZero CPU engine

ZERO ONE's managed local route owns its inference process and user-data model directory. It does not need an Ollama installation, administrator privileges, a GPU, a running owner server, or a website login. It is separate from the optional legacy Ollama adapter and from API Vault profiles.

## Immutable sources

- Inference engine: official `ggml-org/llama.cpp` release **b11321**, build commit reported by Windows runtime `b0aca3c65`.
- Platforms: Windows x64 CPU, macOS ARM64, Linux x64 CPU. The Windows archive contains dynamically selected generic x64, SSE4.2, Sandy Bridge and newer CPU variants; AVX2 is not required by the generic/Sandy Bridge route.
- Model: `shafire/OpenZero-Gemma4-E2B-Agentic-GGUF`, revision `5e7205c17e2ed3085a45416da01add508be357e7`, `OpenZero-Gemma4-E2B-Agentic-Q4_K_M.gguf`.
- Download: **3,416,119,872 bytes**, SHA-256 `9a7e717d13208526782c5fa5074bbcd7f445c6ac720e88d0e0e3ae6d87ebdeef`.
- Runtime archives, full SHA-256 digests, sizes, model attribution card digest and RAM floor are committed in `electron/managed-local-runtime-manifest.json`.

The model is an independent Gemma fine-tune. Google Gemma terms and the model's OpenZero Community Source disclosures apply. The app's Apache license and llama.cpp's MIT license do not relicense model weights. Users must review the linked terms before downloading. The pinned model card and a terms notice are retained beside the engine; the MIT llama.cpp and LLVM OpenMP notices are retained where applicable.

## Build and distribution

Run `node scripts/stage-local-runtime.mjs` on the packaging host. This is a **build-time** download of the pinned upstream engine archive. The archive size/digest, safe extraction paths, staged files and license are checked. `node build/local-runtime-verifier.cjs vendor/local-runtime` verifies staged file digests before packaging. The package must carry `vendor/local-runtime` as an unpacked extra resource; native executable and libraries cannot execute from ASAR.

Users download **model data only**, not an executable. HTTPS redirects are limited to Hugging Face distribution hosts. Downloads check free disk space, exact byte count and full SHA-256 before renaming into the active model path. Interrupted partials resume with a verified byte range; a bad hash removes only the owned partial. An invalid installed model is preserved under an `.invalid-UUID` name before replacement. Cancellation retains resumable partials. Setup errors do not reset API Vault settings.

## Runtime boundaries

The child uses no shell and no visible console; it listens only on `127.0.0.1` with a random process-specific bearer key stored in the child environment. The key is not present in command arguments, progress messages or receipts. Its browser UI and GPU layers are disabled. The process owns one parallel generation slot and stops on app exit; no system-wide process is killed. Requests and setup are cancellable; response bytes, output tokens, prompt characters, exact token budget and durations are bounded.

At least 8 GiB available physical RAM is required. Context is 4,096 tokens on smaller eligible computers and 8,192 tokens at 16 GiB or more. Output is capped at 2,048 tokens. Input limits are 10,000/24,000 characters respectively, followed by the local tokenizer check with an additional template reserve. Oversized requests produce an explicit source/conversation reduction message; there is no silent evidence truncation. No smaller acceptable owned model is asserted in this release. Lower-memory computers can use an API Vault provider instead.

## Backend integration

`createManagedLocalRuntime({ dataDir, runtimeDir, onStatus })` returns:

- `status()` — phase, model identity, progress bytes, detail, CPU flag and context size.
- `ensureReady({ signal? })` — single-flight verified download and authenticated startup.
- `complete({ messages, maxTokens?, temperature?, signal?, stage? })` — text, model, and actual terminal usage/timing values when provided. An early Project Agent action has `streamedAction: true` and no fabricated terminal token metrics.
- `cancelSetup()` — abort setup/generation without clearing model data.
- `stop()` — terminate only the owned child and retain the installed model.
- `resetModel()` — stop, wait for in-flight setup to settle and delete only the pinned active model/partial paths.

Keep filesystem paths and auth key in the trusted main process. Renderer IPC must validate its sender and expose only the status/operations needed by the UI. API mode must not automatically start/download local AI. Local mode may ensure readiness when the user has approved first setup and sends a request.

Project Agent requests (`stage: "project-agent"`) send llama.cpp's official `response_format: { type: "json_schema", schema: AGENT_ACTION_SCHEMA }` mechanism. The committed schema requests one supported tool and its arguments envelope, with known per-tool fields only. Every generated action still passes the independent parser, project scope, file validation and approval controls. Ordinary Chat/Research requests retain normal text output. [Pinned official server documentation](https://github.com/ggml-org/llama.cpp/blob/b11321/tools/server/README.md) describes this mechanism. Actual model output can still fail the requested protocol, so the parser and execution controls remain authoritative. A schema request does not establish that generated code is correct or that a task is complete.

All managed completions use bounded UTF-8 SSE transport. Chat and Research retain the complete response through the terminal event. Project Agent returns the first complete top-level JSON object and cancels the remaining owned generation; it does not wait for unwanted model continuation. The engine's `--skip-chat-parsing` flag leaves action validation to the app rather than its native model-specific tool/thought parser. Cancellation also interrupts a caller waiting on another caller's setup without stopping that shared owner's download.

## Verified scope

`electron/managed-local-runtime.node.cjs` covers pins, redirect policy, real filesystem hash checking, encrypted-key-free model paths, startup flags, concurrent setup, resume, disk/RAM failure, corrupt recovery, cancellation, context budget and owned-process cleanup using injected transport/process fixtures.

`scripts/smoke-managed-local-runtime.cjs` runs real CPU inference and records a receipt, authenticated/unauthenticated local endpoint checks, hardware, model hash, output and timing. It performs no external inference request. The Windows owner machine's Intel Core i7-2600 successfully ran the exact pinned model without AVX2 or GPU. macOS/Linux archives were staged and hash/layout checked on Windows; those platform binaries require their respective CI/native smoke checks before native execution claims.

`scripts/smoke-managed-agent.cjs` exercises real model inference with the real project Agent in an isolated synthetic project. It logs model responses and actual tool receipts incrementally, approves only its expected new target file, and independently evaluates the saved function in a restricted VM. `release-audit/local-runtime/cancel-agent-smoke` can be touched to abort the smoke gracefully. No owner project, credential or private account is read. Prompt-only baseline failures are retained separately; do not treat a model's proposed write or claimed result as an executed tool receipt.

The final Windows CPU coding smoke completed in six steps and 243 seconds. Actual receipts show reading the specification, writing one approved `hello.cjs`, reading the saved file, and independently passing two function checks. Two malformed responses were rejected and subsequently repaired. This verifies that narrow disposable coding task, not general autonomous coding or AGI. Earlier protocol and stalled-response failures remain in the audit folder. `scripts/smoke-managed-browser-plan.cjs` probes planning against a synthetic snapshot only; even a passing plan does not establish real browser execution. `scripts/smoke-managed-chat.cjs` separately checks ordinary text with a two-minute deadline.

The final synthetic Browser plan selected the expected `e1` button and passed the parser/policy in 43 seconds; no browser action or navigation was executed. Final ordinary Chat returned “2 plus 2 equals 4.” in 25 seconds including startup, with actual terminal token/timing values. These receipts use the same final pure-content parser flags as the successful coding smoke. The small model still produces malformed protocol responses and older CPUs can take tens of seconds per action; a hosted provider remains a useful alternative for demanding work.
