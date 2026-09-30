# ZERO ONE 8.0.0

## ZeroThink is now a local workspace

- Built-in ZeroThink research desk, without a hosted account, subscription, company backend, PHP service or database.
- Import selected UTF-8 TXT, Markdown, JSON and CSV sources; preview and remove sources before a run.
- Add selected encrypted ZNotes to a research session. Source text remains in session memory; reports can be saved to an encrypted ZNote.
- Nine research processes, deterministic local retrieval, evidence ledgers and source-ID checks.
- Offline evidence maps work immediately without a model. Optional draft, critique and revision passes use only the selected provider and a bounded output budget.
- Progress and elapsed-time feedback, Stop and Escape cancellation, Markdown and JSON export.
- Local ZeroThink engine released under Apache-2.0; independent cross-platform Node CLI available separately.

## Existing desktop capabilities

- Encrypted ZNotes, user-owned OpenZero server, optional OpenAI/Groq chat, Browser Pilot and local ZSEC selected-folder scans.
- OpenZero Gemma4 E2B remains the recommended lightweight local model for direct editions. Qwen3 1.7B and the Fusion model remain excluded from published model choices. Upstream model weights are unchanged.
- Store edition does not download or install local models and uses Microsoft Store updates. Users may configure an existing OpenZero server or an optional API provider.
- Updated Electron to 43.7.7 and compatible build dependencies. Candidate tests and packaging are recorded separately from Microsoft certification and public availability.

## Boundaries

Offline mode produces a source map and checklist, not an LLM answer. ZeroThink does not prove scientific claims, execute generated code, alter weights or automatically browse the web. A citation check establishes only that a referenced source ID is present. Imported private sources are sent to a provider only when the user selects model mode. There is no automatic cloud fallback.

Exports are plaintext; encrypted retention uses ZNotes and the operating-system credential store. The desktop adapter imports at most eight sources, one MiB each and two MiB total. Each model stage has a 120-second transport limit and at most 2,048 requested output tokens; the workspace uses a 3,072-token total requested output budget.
