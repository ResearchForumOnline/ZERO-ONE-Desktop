# ZERO ONE Store readiness

## ZERO ONE 8.4.0 release gate

June-backup recovery and simplified native ZeroThink. Source verification, publication and Store submission are tracked separately in the current release receipt. Previous receipts below are historical.

# ZERO ONE Store-readiness gate

## ZERO ONE 8.3.0 release gate

Updated 1 October 2026. **8.3.0 GitHub installers are published** after successful Windows/macOS/Linux checks, native bundled-engine execution and public digest verification. **Microsoft Store Submission 6 is in certification**, package 8.3.0.0, with automatic publication after approval. Submission 5 remains available meanwhile; installed version is unverified. [8.3 delivery receipt](qa/RELEASE_8.3.0.md), [public assets](qa/PUBLIC_RELEASE_8.3.0.json), [Store status](qa/STORE_SUBMISSION_8.3.0.json). Existing 8.2 receipts below are historical.

### 8.3 release gates

- Run full tests, TypeScript/build and pinned ZSEC/runtime verification, then packaged native acceptance before release.
- Verify bundled CPU engine provenance/licence and native dependencies for each packaged platform. Model weights are separately downloaded: 3,416,119,872 bytes, pinned revision and SHA-256, terms acknowledgement, at least 8 GB RAM, download/cancel/retry/loading status and no API key needed.
- Verify onboarding skip starts no download, native OpenZero opens without a default unreachable server webview, and an active Vault profile controls Assistant/Research/Agent/Pilot.
- Review encrypted project save/reopen/import/export and interrupted checkpoints. Imports never execute requests; exports contain selected readable source/report content.
- Reconcile Store listing/reviewer instructions and the public privacy page with 8.3. Use [8.3 reviewer notes](../store/REVIEWER_NOTES_8.3.0.md). Record AppX identity/hash, portal validation, submission, certification, public delivery and installed version separately.

## Preserved 8.2 delivery record

Updated 1 October 2026. Source version **8.2.0** and its Windows/macOS/Linux GitHub installers are published. Partner Center confirmed **Submission 5 in certification**, package **8.2.0.0**, with publication scheduled as soon as certification passes. The preceding **Submission 4 remains available in Microsoft Store** until the update publishes. The current [release receipt](qa/RELEASE_8.2.0.md) records package hashes, corrected cross-platform CI, public assets, saved listing and exact privacy URL. Store certification, public Store delivery and installed state remain separate; no installed-version claim is made.

## Candidate feature scope

The 8.3 Store edition adds managed CPU model setup alongside encrypted ZNotes, saved ZeroThink conversations/library/persona/facts, offline evidence maps, approved project actions, on-demand ZSEC scanning and optional user-configured AI. No company-hosted login/database is required. External Ollama installation remains a direct-build advanced option. Store app updates use Microsoft delivery; separately retrieved model weights are data, not a replacement app installer.

8.2 adds:

- A private OS-encrypted Vault: 64 profiles, 11 integrations and eight selectable chat providers. The selected profile supplies Assistant, Studio Chat, Research and Agent. Serper, IonQ and IBM keys supply their respective services. No publisher keys, guaranteed free quota or automatic quota failover are included.
- Ten built-in research templates and 32 encrypted custom templates, with native Paper Creator/scenario forms that prepare inspectable research requests.
- Local PDF extraction: ten MiB input, 100 pages, one MiB extracted text per source, two MiB saved library text and eight selected sources per run. Image-only scans need OCR outside the app. Markdown, JSON and PDF exports are readable and unencrypted.
- Native local ideal circuit simulation and user-owned IonQ cloud operations. Cloud simulator submission requires confirmation. Hardware submission requires a fresh matching estimate and explicit possible-cost acknowledgement; the review ceiling cannot cap actual provider charges. IBM is backend/status discovery only, with instance CRN/region held in form memory.
- Legacy encrypted-key migration and backup-preserving reset. Clear desktop data creates `.recovery-UUID` copies of existing settings and Vault bytes before removing the current files; it preserves ZNotes, Studio and templates. Recovery copies remain local and are not universally purged.

Hosted ZMail, CallChat, DNA, admin/payment routes, private databases, owner grant credentials and private research artifacts are excluded. No AGI, unrestricted control, model-weight rewriting, scientific validation or quantum advantage is claimed.

## Packaging and submission gate

Run `npm run check`, `npm run verify:zsec` and `npm run dist:store:win`. The immutable pinned ZSEC manifest and native hashes must pass before packaging. Use the identity in `build/store-identity.json` and product **9PMPR7PTW025**. Upload the exact candidate AppX, verify server-side package validation, use `store/REVIEWER_NOTES_8.3.0.md`, reconcile Store descriptions/privacy with the candidate and record the final submission state. Successful local tests or upload do not establish certification or publication.

Public source is Apache-2.0. Historical EULA/source-policy drafts do not impose different unpublished licence terms. The public privacy URL is `https://researchforumonline.github.io/OpenZero/zero-one-privacy.html`; a public legal notice is separate from inference hosting.

## Returned delivery evidence

- Package validation: `ZERO-ONE-8.2.0-win-x64.appx`, 197,017,209 bytes, SHA-256 `7a6783e2959a5a05c2b4c952e6123b0559772b066d148e87fca95a7bbda073f6`, validated by Partner Center and saved in Submission 5.
- Saved English description, release notes, short description and nine product features cover Vault, Quantum, Research Workbench and PDF support. The 5,049-character reviewer instructions were saved and confirmed after reload; exact text is in [STORE_REVIEWER_8.2.0.txt](qa/STORE_REVIEWER_8.2.0.txt).
- The configured privacy URL exactly matches the deployed public 8.2 policy and returned HTTP 200.
- Microsoft status: submission and pre-processing completed; certification in progress; publishing not started. Publish immediately after approval remains selected. See [Store receipt](qa/STORE_SUBMISSION_8.2.0.json).
