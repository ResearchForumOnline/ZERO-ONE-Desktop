# ZERO ONE Desktop 8.2.0 reviewer notes

Updated 1 October 2026. Product **9PMPR7PTW025**, publisher **QUANTUMENCRYPTION1 LTD**, candidate **8.2.0.0**. These notes describe the candidate being prepared, not a certification/publication receipt. The preceding 8.1 update's Submission 4 is available in Microsoft Store.

Upload package: **ZERO-ONE-8.2.0-win-x64.appx**, 197,017,209 bytes, SHA-256 `7a6783e2959a5a05c2b4c952e6123b0559772b066d148e87fca95a7bbda073f6`. Final checks: **55 Vitest and 188 Node tests passed**, followed by TypeScript/Vite build, immutable ZSEC verification and AppX archive/identity checks. All 26 Electron production modules and renderer files match the tested source. Real Electron acceptance verified OS-encrypted Vault/template/report round trips and PDF extraction/export from the final packaged ASAR. Fixtures were synthetic, with no real provider/paid quantum request. These checks do not establish installed Store-signed GUI acceptance.

## Account-free local review

No publisher-hosted account, company database, payment, API key or downloaded AI model is required to review local features. Store model installation/download and direct GitHub installer updates are unavailable in this edition.

1. Open **ZNotes**, create a note, enter text and wait for autosave. Select another note, reopen the first and verify its content. Check checklist, pin, label, archive/trash/restore. Notes use the existing dual-key encrypted notebook and OS-wrapped keys. JSON export prompts that it is readable and includes archived/trashed notes.
2. Open **ZeroThink**, import a small selected TXT/MD/CSV/JSON source or choose an existing ZNote. Open Research and turn **Use selected model** off. Select the source, enter a question and send. This builds a local evidence map without a provider and records it in encrypted Studio.
3. Import a small text-based PDF using the native file picker. The app extracts text locally and labels pages. Limits are ten MiB input, 100 pages and one MiB extracted text per source, two MiB total library text, 32 saved sources and eight selected sources per run. Image-only scans require OCR elsewhere; corrupt/encrypted documents are rejected.
4. Open **Research Workbench**. Inspect ten built-in workflows. Enter a Paper Creator title/question or scenario observations, use Preview and then Use in Research. The resulting question enters the Research composer; it does not automatically call a model. Create/copy/edit/delete a custom template. Up to 32 custom templates are stored with OS encryption. Unsaved form fields are not whole-project autosave.
5. From a saved research answer, use **Export PDF**, Markdown or JSON and choose a local path. Exports are readable and unencrypted; they do not publish the report or verify scientific claims.
6. Open **Quantum**, select the local simulator, inspect the small circuit and run it. This performs a bounded ideal classical simulation, with provenance and reproducible sampled counts; it requires no API key, network request or quantum hardware.
7. Open **ZSEC Shield**, choose a folder and request its on-demand scan. No automatic upload, background scan, deletion, quarantine or real-time protection is claimed.

## Optional user-owned API/provider review

The native private Vault supports 64 named profiles across 11 integrations. Eight chat providers are Groq, OpenAI, Google Gemini, Anthropic Claude, xAI, NVIDIA NIM, Featherless and a user-owned OpenZero/compatible server. Serper, IonQ and IBM are service integrations. Enter a reviewer's own optional key/model ID, save and select a chat profile. Assistant, ZeroThink Chat, Research and Agent use that selected profile. Saved key values are not returned to the renderer or diagnostics; public reads show only metadata/key-presence flags. OS secure storage is required; Linux basic_text is refused. No publisher account/key, free-token promise, automatic quota failover or automatic model download is included.

Model tasks send the chosen question, bounded conversation/project/source context and explicit persona/latest five facts to that provider, under its privacy, retention, quota and billing terms. Auto web is off until enabled and uses a separately entered Serper key. A model-generated query can reflect private details in the user's request.

For **Agent**, choose a local project folder. Reads/searches are bounded and reject common secret files and outside-project file paths. Review full write/command proposals before approval. An approved command runs with normal OS permissions, so the project working directory is not a sandbox. Stop/Escape requests cancellation but cannot undo completed effects.

**Browser Pilot** requires a configured OpenZero planner endpoint, a dedicated isolated tab and an explicit user grant. A selected general chat API is not that planner. Structural snapshots omit form values but can include private visible text/labels. Identified password/payment/secret/file/CAPTCHA operations are blocked, consequential/cross-site operations pause, and the task stops at 12 steps or user cancellation. This is not unrestricted/infallible desktop control.

## Quantum cloud boundary

Optional IonQ backend/job/result/estimate queries use the user's own Vault key and fixed v0.4 API origin. Simulator cloud submission requires explicit confirmation. Hardware submission is not required for review: it requires a fresh estimate bound to the exact circuit/backend/shots/key, a stated review ceiling and explicit acknowledgement that actual charges can exceed that estimate. The ceiling is not a provider spending cap; remote jobs/charges may continue after desktop cancellation. No owner grant key, restricted result or research dataset is bundled.

IBM uses the user's Vault key for IAM authentication followed by read-only Quantum backend/status queries with the user's entered instance CRN and region. These fields remain in current form memory; no IBM hardware job/instance creation or Qiskit installation is provided.

Current quantum reports stay in memory unless explicitly exported or added to encrypted Studio Library. Adding a report to Library can allow chosen excerpts into a subsequent model request. Keys/tokens are omitted from reports. A simulator or cloud job does not run the language model on quantum hardware or improve model weights.

## Recovery, retention and policy

**Clear desktop data** is a user-confirmed reset, including recovery from damaged old credential ciphertext. Before removing current settings/Vault files, it copies their original bytes to local sibling `.recovery-UUID` files. The action clears current settings/Vault, saved workspace logins, runtime/pilot session storage and Store-local ZSEC state, then restarts. It retains ZNotes, notebook wrapped keys/legacy backup, encrypted Studio and encrypted custom templates. Recovery copies and external exports/diagnostics remain. This is not a universal purge or remote-account deletion.

Public privacy URL: https://researchforumonline.github.io/OpenZero/zero-one-privacy.html. Full source disclosure: docs/PRIVACY.md. Hosted mail/calls, DNA, admin/payment routes and company account databases are excluded. Apache-2.0 applies to the public source; no hidden historical EULA overrides it.

Record actual package validation, submission/certification/publication and installed version separately. Prior submission evidence or successful synthetic tests do not establish acceptance of this candidate.
