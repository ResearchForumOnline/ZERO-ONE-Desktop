# ZERO ONE Desktop 8.1.0 privacy boundary

Updated 30 September 2026. This source disclosure describes the 8.1.0 Store candidate. Public policy: https://researchforumonline.github.io/OpenZero/zero-one-privacy.html. Publisher: QUANTUMENCRYPTION1 LTD. The application's live Store listing, certified package and public notice should describe this same scope.

## ZNotes and local settings

ZNotes titles, text, timestamps, pins, labels, colours, checklists and archive/trash states stay in an encrypted notebook in application data. The new format uses two independent 32-byte AES-256-GCM keys with nested authenticated encryption, fresh nonces/tags and notebook ID/generation/layer binding. Each key is separately wrapped by Electron safeStorage under the same OS account. This is two cryptographic keys, not independent two-factor custody or Microsoft DKE. Existing OS-encrypted notes remain readable; first successful migration retains the original encrypted .legacy-v1.bak before atomic replacement. Deleting a note does not purge that backup or external copies. Invalid/corrupt notebooks and missing keys fail closed. Insecure Linux basic_text storage is refused.

Edits autosave after a short debounce and on transitions; pending changes are not guaranteed to survive forced termination or power loss. Nothing is automatically uploaded/synced. Native-picker JSON import validates the batch and assigns fresh note IDs. Explicit JSON export is plaintext and includes active, archived and trashed notes. Trash is recoverable until permanent deletion is confirmed. User-selected note copies in AI tasks can be sent to the selected model.

Runtime addresses, model choices, Assistant mode and layout/preferences are stored locally. OpenZero tokens and optional OpenAI/Groq API keys are encrypted when saved; decrypted key values stay in the main process and accompany requests to their selected runtime/provider. The app does not expose saved keys through the renderer settings bridge or diagnostics. No publisher-hosted model account is required.

The OpenZero workspace and Browser Pilot use separate persistent Electron partitions. Cookies, cache and site storage can survive app restarts. Optional saved workspace logins require explicit opt-in and secure OS encryption; filling a saved login requires a user request on the approved runtime origin. ZERO ONE does not collect an independent hosted account for this workflow.

## Connections and model requests

The OpenZero address belongs to the user-selected local or self-hosted runtime. By default it is http://127.0.0.1:1024/. The interface probes this one configured endpoint on launch, every 30 seconds, manual refresh and diagnostics export. A bounded GET uses a ZERO-ONE/version user agent, follows redirects and times out after 6.5 seconds. A remote endpoint receives the network address and request metadata even when its embedded panel is not open.

Assistant prompts, recent conversation messages, chosen model and response parameters go to the selected runtime, or directly to OpenAI or Groq when that optional provider is chosen. The endpoint can process and retain them under its own terms. Local Ollama chat is available in direct editions; the Store edition does not install/download local AI models. Store users can configure their own existing OpenZero server or an optional cloud provider. Runtime inference, response quality and provider availability depend on that configuration.

Embedded runtime camera and microphone permission are denied. Opening external setup, support, update or reporting links uses the user's browser; those destinations receive ordinary browser/network metadata.

## ZeroThink local research

ZeroThink is packaged locally without a hosted account or company backend. Conversations, titles, pins, public work briefs, reports, selected source library, persona and explicit remembered facts persist in a separate OS-encrypted Studio file. The persona and latest five facts can enter chosen-model context. Sources are selected files or ZNotes. Removing a library item does not purge excerpts already saved in chats, notes or exports. Removing local conversations cannot erase provider retention or separate backups.

Offline maps use deterministic local retrieval. Chat and model research send the question, selected excerpts, bounded follow-ups/draft/review context, persona and recent explicit facts to the selected model. No automatic provider fallback occurs. Endpoints are the user's server, OpenAI or Groq; direct editions support local Ollama. Store builds do not download models. Provider retention follows its own practices.

Serper web search is optional, with its user-supplied key separately OS-encrypted and excluded from renderer settings and diagnostics. Search web sends the query/key to Serper and returns up to three labelled snippets, not full pages. Auto web is off until enabled; then a bounded model decision can generate and send a query derived from the user's request. Notebook/library contents are not attached to the search request. Queries themselves can contain sensitive details; an instruction to avoid private details cannot guarantee a model-generated query contains none.

Native Agent mode uses a project chosen through the native folder picker. Project paths, file names/content, task history and tool/command results can enter selected-model context. File tools reject outside-project paths, links and common secret files. Proposed writes and commands require approval. Commands run with normal OS permissions and can access outside-project files/networks; the working directory is not a sandbox. Activity and results stay in memory unless the user copies them. Stop aborts future actions and requests termination of owned processes; it cannot reverse side effects. This is separate from Browser Pilot and does not rewrite model weights.

The research transport refuses credential-bearing redirects, requires HTTPS for remote endpoints, bounds responses to one MiB and uses a 120-second per-stage transport limit. Stop or Escape cancels future stages and aborts the active request; it cannot retract material already received by a remote provider. Diagnostics do not include ZeroThink source text, titles, questions or reports.

## Browser Pilot behavior

Browser Pilot operates only after the user opens its dedicated isolated browser tab, supplies a task and grants that tab. For each planned step, the configured OpenZero runtime receives the task, selected model, step number, up to six short prior action/result records and a compact page snapshot. Snapshot data includes bounded visible page text, page title, headings, a redacted page URL, viewport information and interactive-control metadata such as labels, roles, checked state, presence of a value and select-option labels. Form input/textarea/select and editable-region values are omitted. URL queries/fragments and long token-like path segments are removed. Visible page text and labels may still contain personal or confidential information; snapshot redaction does not guarantee every sensitive value is identified.

The planner uses the configured OpenZero /v1/browser/plan endpoint; a remote self-hosted runtime receives this page context. Browser Pilot does not directly use the optional OpenAI/Groq Assistant keys. Its runtime may independently call a model provider under that runtime's configuration and privacy practices.

The application blocks fields it identifies as passwords, payments, secrets, file selections or CAPTCHA. Cross-site actions, entering identified personal information and consequential actions pause for approval. Detection is based on page structure and labels. There is a 12-step limit and a stop/revoke control. Downloads are blocked in the pilot partition. Leaving the workspace, stopping, an error, completion or closing the app ends the run. Snapshots/run history are not written to disk by ZERO ONE; current task state, short step results and pending approval remain in memory during the run. Browser cookies and site storage persist until cleared. Ordinary navigation also sends requests to visited websites.

## On-demand ZSEC

The Windows x64 Store package contains the exact pinned ZSEC Shield 0.1.2 runtime. Scanning begins after the user selects a folder through the OS picker and requests a scan. The desktop invokes fixed bounded commands and reports aggregate outcomes and counts. It does not automatically upload samples, quarantine/delete files or begin background scans. Local CLI reports and ZSEC state can contain paths, hashes, matches and errors. The Store edition uses its app-local ZSEC state directory. The pinned runtime has no real-time protection or production definition-feed trust keys; these features are not implied by a clear scan result.

## Diagnostics

Diagnostics export is a user-selected local JSON file. It contains generation time, app version/platform, OS release, logical-core count, total memory, one OpenZero probe's state/status/latency/origin and fixed offline message, runtime origin, launch/media preference flags and whether an OpenZero token exists. Origins can identify a user-configured server. The media flag is a retained settings field; embedded media remains denied.

The export excludes OS hostname, key/token values, URL credentials/paths/queries/fragments, cookies, ZNotes titles/text, prompts, model responses and browser task/page contents. ZERO ONE does not automatically send this file anywhere. The user controls sharing and retention. The AI-output reporting link is https://talktoai.org/report-ai/; users choose what to provide and should avoid credentials and unrelated private material.

## Retention and deletion

Trash retains notes until confirmed permanent deletion. Separate exports and the encrypted migration backup can retain old copies. Clear desktop data clears settings/API keys, saved logins and OpenZero/pilot partitions after confirmation, plus Store-local ZSEC state. It deliberately retains the ZNotes notebook/wrapped keys/legacy backup and encrypted Studio chats/library/profile. External exports and diagnostics remain. It does not erase provider data or remote accounts.

The direct NSIS installer retains application data on uninstall. Store uninstall retention follows Windows package behavior and requires verification on the final Store-signed installation; the local unsigned candidate does not establish that behavior. No universal data-removal promise is made by the source build.

## Verification boundary

The current candidate's tests, package hash and actual Partner Center state are recorded separately in `docs/qa/RELEASE_8.1.0.md`. Source-level privacy statements must be reconciled with Microsoft certification, the Store-signed installation, the chosen remote runtime/provider's practices and the public notice. Older release evidence and retired hosted integrations are historical rather than current product behavior.
