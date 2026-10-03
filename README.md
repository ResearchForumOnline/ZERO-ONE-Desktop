# ZERO ONE

<p align="center">
  <img src="assets/zero-one-icon.png" width="112" alt="ZERO ONE orbit mark">
</p>

<p align="center"><strong>Private on-device ZNotes, local ZeroThink research, your OpenZero runtime, Browser Pilot, ZSEC Shield and ZMath Secure.</strong></p>

<p align="center">
  <a href="https://apps.microsoft.com/detail/9PMPR7PTW025">Microsoft Store</a> ·
  <a href="https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/latest">Latest release</a> ·
  <a href="docs/SECURITY_ARCHITECTURE.md">Security</a> ·
  <a href="docs/PRIVACY.md">Privacy</a>
</p>

![ZERO ONE command center](store/screenshots/01-command-center.png)

ZERO ONE is an open-source native desktop workspace for private notes, CPU AI, saved research and approved project/browser work. Version 8.3 includes a bundled local engine with verified model setup; own API/server profiles remain optional. Security panels report actual bounded observations, not guarantees inferred from an AI response.

## Download and install

ZERO ONE adapts from full desktop layouts down to compact 720 × 520 windows. Use the header zoom controls or `Ctrl +`, `Ctrl -`, and `Ctrl 0` to adjust the interface from 75% to 150%; embedded workspaces follow the same scale.

Use the authenticated [latest ZERO ONE release](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/latest). No development tools are required.

| Platform | Package | Install |
|---|---|---|
| Windows 10/11 x64 | `ZERO-ONE-*-win-x64.exe` | Download the latest Windows installer from [Releases](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/latest) |
| macOS Apple silicon | `ZERO-ONE-*-mac-arm64.dmg` | Open the disk image and drag ZERO ONE to Applications |
| Linux x64 | `ZERO-ONE-*-linux-x86_64.AppImage` | Make executable and open |
| Debian/Ubuntu x64 | `ZERO-ONE-*-linux-amd64.deb` | Open with the software installer or use `sudo apt install ./ZERO-ONE-*-linux-amd64.deb` |

Current source version is **8.4.0**. [Windows/macOS/Linux 8.3.0 installers](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v8.3.0) are published, with successful platform CI and independently verified public asset digests. Microsoft Store accepted Submission 6 for 8.3.0.0; it is in certification and will publish automatically after approval. Submission 5 remains available meanwhile. Installed Store state has not been checked or changed. See [8.3 changes](store/RELEASE_NOTES_8.3.0.md), [verification receipt](docs/qa/RELEASE_8.3.0.md), [reviewer notes](store/REVIEWER_NOTES_8.3.0.md) and [Store-readiness gate](docs/STORE_READINESS.md). Direct installers remain unsigned; updater verification requires matching GitHub digest and SHA256SUMS.

## What is included

- **Built-in CPU AI:** one setup flow reviews model terms, downloads pinned/hash-verified OpenZero Gemma4 E2B weights and configures authenticated local inference. Download/cancel/retry/load/memory controls are native. No separate Ollama install, GPU or API key is needed; allow at least 8 GB RAM and a 3.42-GB download.
- **Named research projects:** up to 32 encrypted projects with debounced autosave, question/process/depth/options, selected evidence snapshots and latest completed result. Reopen interrupted checkpoints for review; bounded portable JSON import never launches actions and exports contain readable selected content.

- On-device ZNotes with saved note creation, autosave, checklists, pins, labels, colours, archive/trash and local imports/exports. Dual-key notebook protection uses independent authenticated encryption keys under OS custody.
- Built-in **ZeroThink Studio**: persistent conversations, follow-up context, a local source library, persona and memory, original Zero mode public briefs, research/review passes, optional web search and exports.
- **Private API Vault**: up to 64 named encrypted profiles across 11 integrations. Eight chat choices are Groq, OpenAI, Google Gemini, Anthropic Claude, xAI, NVIDIA NIM, Featherless and your OpenZero/compatible server. Serper, IonQ and IBM supply search or quantum services. The selected chat profile drives Assistant, ZeroThink Chat, Research and native Agent; service keys are used for their specific service. Provider quotas, model access and costs depend on the user's account; no free-token allowance or automatic quota failover is promised.
- **Research Workbench**: ten built-in workflows and up to 32 encrypted custom templates with editable stages, source requirements and checks. Paper Creator and scenario forms prepare visible, source-labelled questions for Research. They do not fabricate experiments or calibrated probabilities.
- **Quantum workspace**: bounded local ideal statevector simulation, user-owned IonQ backend/job/probability discovery and explicitly confirmed cloud simulator or hardware jobs. Hardware requires an exact-circuit estimate, a review ceiling and acknowledgement that actual charges can exceed the estimate; the ceiling is not a provider-enforced spending cap. IBM provides IAM authentication and read-only backend/status discovery with an entered instance CRN and region; it does not submit IBM hardware jobs.
- Selected text/PDF source imports and readable Markdown, JSON or PDF report exports. PDFs are extracted locally; image-only scans require prior OCR.
- **Native ZeroThink Agent**: choose a local project, inspect files, review proposed edits and approve commands. Tools return actual observations; the run reports unresolved errors and step-budget exhaustion. A user-approved command has normal OS permissions, not a container sandbox.
- A built-in Browser Pilot: one isolated tab, one user-granted task, a 12-step limit, structural snapshots that omit form values, secret/payment/file/CAPTCHA blocking, cross-site and consequential approval pauses, and an immediate stop-and-revoke control.
- Guided Assistant setup with private local OpenZero Gemma4 E2B as the recommended lightweight default and optional OpenZero server, OpenAI or Groq providers.
- A truthful automation surface that reports real endpoint reachability and permissions, not invented worker telemetry.
- OS-protected credential storage; insecure Linux fallback storage is refused.
- The matching native ZSEC Shield 0.1.2 selected-folder scanner on every published platform.
- ZMath Secure status for HTTPS/loopback transport, credential storage, and optional Windows BitLocker.
- Redacted diagnostics that exclude note content and credentials; embedded runtime camera/microphone access is denied.
- A visible update control that checks the official stable GitHub release, verifies the platform package against two matching SHA-256 records, and starts the installer only after the user approves.

![ZSEC Shield selected-folder scanning](store/screenshots/02-zsec-shield.png)

## First run

1. Open ZNotes and write a note; it is encrypted on this device.
2. Open ZeroThink, import selected UTF-8 files or add selected ZNotes, and build an offline evidence map. Research model mode is optional. Model runs send bounded selected sources, conversation and your saved persona/latest explicit facts to the configured provider.
3. Choose Set up my CPU AI to review the model terms and let ZERO ONE download/verify/configure the CPU engine. Or open ZeroThink → API Vault and select your own provider/key/model. Browser Pilot uses the same chosen completion adapter; it still requires a granted isolated tab. Serper is separate and optional.
4. Open ZSEC Shield, choose one folder and review the local result. No background scan, deletion, upload or quarantine starts automatically.

## ZeroThink local research

The workspace uses the open-source [ZeroThink engine and cross-platform CLI](https://github.com/ResearchForumOnline/ZeroThink), licensed Apache-2.0. The engine is vendored with its licence and provenance under `electron/zerothink/`. It searches selected documents, assigns inspectable source IDs, builds evidence maps and provides nine research processes. Optional model passes draft, critique and revise. Source-ID validation establishes whether a referenced excerpt exists, not whether a scientific claim is true.

The encrypted Studio library holds up to 32 selected documents and two MiB of text; up to eight sources enter a run. Selected TXT, Markdown, JSON and CSV files are limited to one MiB each. PDF input is limited to ten MiB, 100 pages and one MiB of extracted text per document. Extraction runs locally with time and memory bounds; encrypted/corrupt or image-only PDFs are rejected. Conversations, source copies, persona and explicit facts persist locally. Markdown, JSON and PDF exports are readable and unencrypted. The app never automatically scans folders or publishes private research.

Offline research needs no model, API key, hosted account, website or database. Store and direct builds support the bundled managed CPU engine, an existing server or the seven named cloud chat providers in the Vault. Existing Ollama remains an explicit advanced option in direct builds. There is no automatic quota failover. Research does not execute commands or edit model weights; native Agent writes/commands require approval and Browser Pilot requires a granted tab.

Research Workbench templates are encrypted locally. Named Research projects now autosave question, process, depth, options, selected evidence snapshots and the latest completed report. Up to 32 projects can be reopened/exported/imported; interrupted runs reopen for review and never automatically restart. Unsaved Workbench form fields still need Use in Research and a named project. Quantum reports can be explicitly added to Library. IBM instance CRN/region must be re-entered after restart. See [privacy and reset behavior](docs/PRIVACY.md).

ZERO ONE 8.0.0 package and submission evidence is recorded in `docs/qa/RELEASE_8.0.0.md`. Previous releases do not establish certification of this version.

## Browser Pilot

Browser Pilot is included in ZERO ONE 7.9.2; there is no browser extension to install for the in-app workflow. Open **Browser Pilot**, navigate its dedicated isolated tab, describe one bounded task, and grant that tab. OpenZero plans one strict action at a time using page labels and structure. Passwords, payment fields, secret inputs, file inputs and CAPTCHA values are never included in the snapshot and cannot be operated by the pilot. Cross-site navigation, personal-data typing and consequential actions pause for an explicit one-time approval. Every run stops after 12 steps and the page overlay has a persistent STOP control.

The optional [OpenZero Tab Pilot for Chrome and Brave](https://chromewebstore.google.com/detail/openzero-tab-pilot/cgaalobjjknalamgchppccbocnhonhbf) remains available for people who want governed control in an existing external browser. Browsers deliberately require the user or an administrator to approve extension installation; ZERO ONE does not bypass that platform security boundary.

## Updates

ZERO ONE checks the official stable GitHub release shortly after launch, every six hours while open, and whenever **Settings → Check for updates** is pressed. An available compatible package can be installed with **Install verified update**. ZERO ONE requires an exact platform filename, official repository download URL, declared byte size, GitHub SHA-256 asset digest and a matching entry in `SHA256SUMS.txt`; it downloads to a private temporary file and refuses installation if any check differs. On Windows the verified one-click installer preserves the current user's settings, sessions and downloaded model data.

## OpenZero: Local or Server

For most people, **Local** is the recommended mode. In 8.3, choose **Set up my CPU AI**, review the model terms, and let ZERO ONE download and configure its bundled CPU engine. No API key, GPU or separate runtime installation is needed. The pinned `OpenZero-Gemma4-E2B-Agentic-Q4_K_M` weights are 3,416,119,872 bytes (about 3.42 GB), verified by SHA-256 before use. Model identifier: `hf.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF:Q4_K_M`. Setup needs internet for retrieval, at least 8 GB RAM and enough disk space. Prompts stay in the authenticated loopback process in local mode; enabled web/cloud services receive their selected inputs.

The [OpenZero Gemma4 E2B model card](https://huggingface.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF) provides upstream provenance and terms. App-source licensing does not replace weight or engine licences. Cancellation, retries, verification/loading status and memory release are visible. Skipping onboarding downloads no model. Already configured local models may be restarted on app launch.

One native CPU-only check on an Intel Core i7-2600 at 3.40 GHz with 32 GB RAM produced an 86-token answer at about **6.23 generation tokens/second**. Loading took 19.3 seconds and the measured request 28.2 seconds. This single short sample is not a performance promise or an hours-long coding assessment.

The rejected Fusion and Qwen3 1.7B releases remain excluded from the recommended setup after earlier quality checks.

Advanced Ollama users can preserve their selected compatible model in direct builds. See the official [Ollama download](https://ollama.com/download), [quickstart](https://docs.ollama.com/quickstart) and [chat API](https://docs.ollama.com/api/chat). The managed engine is the default; ZERO ONE does not silently install an external runtime.

**Server** is the advanced mode for someone who already operates an OpenZero server. It requires that server's HTTPS address and desktop credential. Server mode uses the runtime model reported by that server—currently the OpenZero Ministral 8B runtime edition in the standard deployment—and can expose the orchestration, tools, skills and governed automation implemented by that OpenZero deployment. The server model setting is separate from the lightweight local Assistant selection.

An existing OpenZero server can expose its **Recursive Lab** if that deployment implements it. Native ZERO ONE Agent actions use a selected project, actual file/tool observations and explicit write/command approvals. Model chat alone does not gain unrestricted filesystem or self-modification authority.

Private **model chat** and native desktop tools are separate capabilities. The selected completion adapter powers Chat, Research, Agent planning and Browser Pilot planning. Full server orchestration and remote skills still depend on the actual server deployment. Filesystem writes and project commands require approval; browser control requires a granted isolated tab and pauses for consequential actions.

## Build from source

Requirements: Node.js 24 and npm.

```bash
git clone https://github.com/ResearchForumOnline/ZERO-ONE-Desktop.git
cd ZERO-ONE-Desktop
npm ci
npm run check
npm run dev
```

Platform packages are produced on their native operating systems by the pinned [release workflow](.github/workflows/release.yml).

## Open-core and security boundary

The desktop shell, security contracts, tests and build configuration are Apache-2.0 licensed. Unpublished ZMath research, experimental cipher implementations, production secrets, signing keys, server infrastructure and private datasets are not included.

ZERO ONE uses established TLS and operating-system cryptography. It reads Windows BitLocker status but never silently enables disk encryption or stores a recovery key. ZSEC Shield is an on-demand security companion—not certified antivirus, real-time prevention or guaranteed malware detection. Keep the operating system's built-in protection enabled.

See [ZMath Secure](docs/ZMATH_SECURE_BOUNDARY.md), [privacy](docs/PRIVACY.md), [security architecture](docs/SECURITY_ARCHITECTURE.md) and [release evidence](store/RELEASE_EVIDENCE.md).

## Licence

Apache License 2.0. ZERO ONE names, logos and product identity are not granted for confusing or impersonating distributions; see [TRADEMARKS.md](TRADEMARKS.md).
