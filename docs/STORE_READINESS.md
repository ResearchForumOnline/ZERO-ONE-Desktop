# ZERO ONE Store-readiness gate

## ZERO ONE 8.2.0 source and public-preview gate

Updated 1 October 2026. Source version **8.2.0** is the current candidate. Partner Center showed the preceding **Submission 4 available in Microsoft Store** on this date. That 8.1 publication state is separate from 8.2 packaging, upload, certification, delivery and installation. The 8.1 release receipt in `docs/qa/RELEASE_8.1.0.md` remains historical evidence for 8.1; source edits alone do not update installed apps.

## Candidate feature scope

The Store edition includes encrypted ZNotes, saved ZeroThink conversations/library/persona/facts, offline evidence maps, approved native project actions, on-demand ZSEC scanning and optional user-configured AI. No company-hosted login or database is required. Local model downloads/installations are hidden and rejected in the Store main process; direct builds retain existing Ollama support. Store updates use Microsoft delivery.

8.2 adds:

- A private OS-encrypted Vault: 64 profiles, 11 integrations and eight selectable chat providers. The selected profile supplies Assistant, Studio Chat, Research and Agent. Serper, IonQ and IBM keys supply their respective services. No publisher keys, guaranteed free quota or automatic quota failover are included.
- Ten built-in research templates and 32 encrypted custom templates, with native Paper Creator/scenario forms that prepare inspectable research requests.
- Local PDF extraction: ten MiB input, 100 pages, one MiB extracted text per source, two MiB saved library text and eight selected sources per run. Image-only scans need OCR outside the app. Markdown, JSON and PDF exports are readable and unencrypted.
- Native local ideal circuit simulation and user-owned IonQ cloud operations. Cloud simulator submission requires confirmation. Hardware submission requires a fresh matching estimate and explicit possible-cost acknowledgement; the review ceiling cannot cap actual provider charges. IBM is backend/status discovery only, with instance CRN/region held in form memory.
- Legacy encrypted-key migration and backup-preserving reset. Clear desktop data creates `.recovery-UUID` copies of existing settings and Vault bytes before removing the current files; it preserves ZNotes, Studio and templates. Recovery copies remain local and are not universally purged.

Hosted ZMail, CallChat, DNA, admin/payment routes, private databases, owner grant credentials and private research artifacts are excluded. No AGI, unrestricted control, model-weight rewriting, scientific validation or quantum advantage is claimed.

## Packaging and submission gate

Run `npm run check`, `npm run verify:zsec` and `npm run dist:store:win`. The immutable pinned ZSEC manifest and native hashes must pass before packaging. Use the identity in `build/store-identity.json` and product **9PMPR7PTW025**. Upload the exact candidate AppX, verify server-side package validation, use `store/REVIEWER_NOTES_8.2.0.md`, reconcile Store descriptions/privacy with the candidate and record the final submission state. Successful local tests or upload do not establish certification or publication.

Public source is Apache-2.0. Historical EULA/source-policy drafts do not impose different unpublished licence terms. The public privacy URL is `https://researchforumonline.github.io/OpenZero/zero-one-privacy.html`; a public legal notice is separate from inference hosting.
