# ZERO ONE 8.4.0

Built-in OpenZero CPU AI and saved ZeroThink research projects.

- A bundled CPU engine replaces separate-runtime setup for the recommended local mode. Choose **Set up my CPU AI**, review the model terms, and let ZERO ONE download, verify and configure the published model. No API key, GPU or separate Ollama installation is required. Store and direct distributions support this path.
- Gemma4 E2B remains the recommended lightweight model: pinned OpenZero Agentic Q4_K_M weights, 3,416,119,872 bytes (about 3.42 GB), checked against their pinned SHA-256 before use. At least 8 GB RAM and sufficient free disk space are required. The Fusion model and Qwen3 1.7B remain excluded after earlier quality checks.
- First-run onboarding provides setup and account-free skip choices. Download progress, cancellation, verification, loading, failure/retry and memory-release controls reflect actual work. Hidden workspace mounting does not silently start a new download. Local prompts use an authenticated loopback CPU process; optional API/server profiles remain explicit choices.
- The OpenZero tile is a native CPU workspace by default, with direct links to ZeroThink Chat, Research, Agent and Browser Pilot. Hosted panels open only in explicit Server mode.
- Assistant reads the active API Vault profile and uses the same completion routing as ZeroThink and Browser Pilot. Immediate acknowledgement, named progress, elapsed time and actual Stop/Escape cancellation replace ambiguous waiting.
- Research projects save question, process, depth, model/search options, selected source snapshots and latest completed report with OS encryption. Up to 32 named projects can be saved/reopened. Running checkpoints recover as interrupted, never as invented completion. Bounded portable JSON import does not start model, browser or command actions.
- Fixed Agent’s incompatible 4,096-token request against adapters limited to 2,048 tokens. The managed adapter now honors the supported 2,048-token action budget. Concrete tool examples, schema requests and bounded legacy-format normalization improve model compatibility; independent validation still rejects invalid replies.
- The Agent can make an approved exact-section edit instead of replacing a whole file. It requires one literal match, shows the proposed change, rechecks the source digest and refuses a stale overwrite. Context, step, approval and resource limits remain.
- Browser Pilot plans through the built-in model, selected Vault chat profile or server. Separate OpenZero pairing is no longer a prerequisite. Granted-tab ownership, secret-field restrictions, approvals, step limits and Stop remain.
- Historical 8.3 CPU acceptance on an Intel Core i7-2600 at 3.40 GHz, 32 GB RAM and zero GPU layers produced an 86-token response at approximately 6.23 generation tokens/second. Model loading took 19.3 seconds and the measured request 28.2 seconds. This is one short test on one machine, not a broad performance guarantee or proof of sustained coding quality.

8.2 features remain: encrypted API Vault, dual-key ZNotes, saved conversations/persona/library, research templates, local PDF extraction and readable PDF/Markdown/JSON exports, local ideal quantum simulation, user-owned IonQ workflows and read-only IBM discovery.

Portable projects and reports include selected readable content. Vault keys and device configuration are excluded, but anything users typed into a source or report remains content. Linux requires secure desktop keyring storage. Downloaded weights and the bundled engine retain their upstream licences; public app source is Apache-2.0.

No publisher keys, hosted account databases, grant credentials or private datasets are bundled. Media/voice generation, bundled Qiskit/IBM hardware submission and the original ZMath/ZBA engine remain outside this release. No AGI, unrestricted control, scientific validation, guaranteed free API quota or automatic provider quota failover is claimed.


## June ZeroThink recovery

Clear Chat, Research and Agent modes; Tools & settings retains Vault, quantum tools, templates and personalization. New chat and saved conversation navigation repaired; active Vault model changes open the right editor. Optional research form fields are collapsed. Safe Markdown formatting improves readable answers.

Thirteen built-in workflows include narrative review mapping, supervisor/lab discovery and validation/correction planning recovered from the June backup. Deterministic claim/reference review flags unknown citations and numbers absent from cited excerpts, adds exact excerpt SHA-256 receipts and supplies observed issues to revision without extra model calls. These checks do not establish truth or semantic entailment. Full ledger is preserved in exported/saved Markdown.

DNA Lab, admin/users/login, backup databases and private credentials are excluded. Native image/voice/media parity remains incomplete and is documented honestly in the recovery inventory.

## Delivery status

Build, GitHub release and Store acceptance must be verified in the 8.4 receipt; no inherited 8.3 publication claim applies.

Microsoft Store accepted Submission 7 (8.4.0.0) on 3 October 2026 as **Update in certification**, with automatic publication after approval. The description, release notes, reviewer instructions and live 8.4 privacy notice were verified. Previous Submission 6 remains live; installed Store version is unverified. [Store receipt](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/blob/main/docs/qa/STORE_SUBMISSION_8.4.0.json).

**GitHub 8.4.0 published:** [Windows/macOS/Linux installers](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v8.4.0). All seven release jobs passed, including native Linux/macOS runtime checks. The initial cancellation-test race passed on retry; main contains the deterministic correction. Public SHA256SUMS matches GitHub asset digest metadata; installer bodies were not independently downloaded and rehashed. [Public receipt](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/blob/main/docs/qa/PUBLIC_RELEASE_8.4.0.json).
