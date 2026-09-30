# ZERO ONE Store-readiness gate

## ZERO ONE 8.1.0 source and public-preview gate

ZERO ONE 8.1.0 restores the original ZeroThink chat/persona/memory/library/depth workflows and adds native project actions. ZNotes has real note creation, autosave and dual-key protection. Exact tests, package hash and submission status are recorded in docs/qa/RELEASE_8.1.0.md. The preceding 8.0.0 Store package is published and was verified installed; this source repair is a separate release.

The Store edition has functional local ZNotes, offline ZeroThink evidence maps and on-demand ZSEC scanning without a separately downloaded AI model. Optional AI uses a configured existing OpenZero server or user-supplied OpenAI/Groq keys. Store model installation is hidden and rejected in the main process. Updates remain Store managed. Direct builds retain existing Ollama support.

ZeroThink imports only selected UTF-8 text files or notes; it does not require a company website, login or database. It supports bounded optional draft/critique/revision, progress, cancellation, source-ID checks and explicit exports. Results do not establish scientific correctness or AGI. The immutable ZSEC vendor manifest and native hashes must verify before packaging.

Current source is Apache-2.0. No keys, private profiles, customer records, DNA files, database snapshots or publisher certificates are included. Historical EULA drafts are non-operative and do not change the source licence. Previous certification failures, payout blocks, smoke tests and platform packages are historical; use only current receipts for current release claims.

Windows Store packaging: npm run check; npm run verify:zsec; npm run dist:store:win. Current Store identity is read from build/store-identity.json. Upload the exact AppX through the existing ZERO ONE Desktop product, replace stale reviewer notes, wait for validation and verify the final submission state.
