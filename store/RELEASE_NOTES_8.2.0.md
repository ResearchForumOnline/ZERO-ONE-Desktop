# ZERO ONE 8.2.0

ZeroThink restoration: private API Vault, Quantum and Research Workbench.

- Native encrypted API vault with up to 64 named profiles. Chat providers: Groq, OpenAI, Gemini, Anthropic, xAI, NVIDIA NIM, Featherless and your OpenZero/OpenAI-compatible server. Serper, IonQ and IBM Quantum use separate service keys. Keys are never displayed in saved profile status or exported diagnostics.
- Select one vault chat profile for ZeroThink Chat, Research, project Agent and ZERO ONE Assistant. Existing user-entered keys migrate locally into the vault; missing/decryption failures preserve the old settings. Model IDs are editable. Saving a key makes no provider request and establishes no entitlement or free quota.
- Native quantum workspace: Bell/GHZ presets, editable bounded circuits, local ideal statevector simulation with probabilities and reproducible samples, IonQ v0.4 backend/job/result/cost inspection, explicit cloud simulator submission and reviewed hardware submission. Hardware requires a current estimate bound to the exact job and explicit approval. Estimates are not spending guarantees. This release performed no live paid jobs.
- IBM Quantum reads backend availability using the user's own API key and instance CRN. IBM hardware execution is not implemented.
- Research Workbench restores paper-creator fields, ten visible built-in workflows, editable encrypted custom templates, scenario assumptions and research prompts. Select your evidence and run the existing draft/critique/revision engine. Templates do not generate experiments, prove claims or invent source citations.
- Local PDF text import (10 MB / 100 pages per PDF, 1 MB extracted text, existing 2 MB library limit). Scanned image-only and encrypted PDFs need preprocessing. Markdown, JSON and readable PDF exports remain explicit user choices.
- Existing encrypted conversations/library/persona, dual-key ZNotes, local evidence retrieval, approved project edits/commands and Browser Pilot remain available.

Gemma4 E2B is the recommended lightweight local model for direct desktop installs. Qwen3 1.7B and the Fusion model remain excluded after earlier quality checks. The Store edition uses the user's existing server or API providers for model execution; it does not download model weights.

Original later ZeroThink source was audited alongside the January backup. See docs/ZEROTHINK_PARITY_8.2.0.md for source hashes and remaining differences, including hosted accounts, media generation, voice and research-project autosave. This release restores working native features and does not claim complete original-system parity, AGI or quantum advantage.

Provider API calls transmit selected text/circuits to the provider the user configures. No publisher keys, old owner database snapshots, grant credentials or private research results are bundled. Local vault, conversations, templates and notes use OS-backed encryption; Linux needs a secure desktop keyring. Exported reports are unencrypted.

Release state is reported in docs/qa/RELEASE_8.2.0.md. Source checks, packaging, public GitHub assets, Store submission/certification and installed versions are separate states.
