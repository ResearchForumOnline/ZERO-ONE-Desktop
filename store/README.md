# ZERO ONE Store submission pack

Status: **validated unsigned Windows x64 internal metadata; blocked from Store upload**.

Working-tree product version: `7.9.1`.

This directory contains:

- `SOURCE_POLICY.md` — proprietary/public boundary and release rules.
- `EULA_DRAFT.md` — non-operative legal-review outline and tracked release blocker; never package or present it as customer terms.
- `LISTING_COPY.md` — historical draft Microsoft, Apple and Linux/direct copy for the 0.4.0 installable preview; refresh it from the exact signed candidate before submission.
- `STORE_METADATA_MATRIX.md` — portal fields, assets, evidence, and blockers.
- `PRIVACY_SUMMARY.md` — data-boundary worksheet; not a substitute for the live public policy.
- `SCREENSHOT_REQUIREMENTS.md` — platform capture specifications and truthful-state rules.
- `ASSET_MANIFEST.md` — current source assets and missing final assets.
- `SUBMISSION_CHECKLIST.md` — per-channel submission and post-publication verification gates.
- `RELEASE_EVIDENCE.md` — preserved 0.4.0 preview evidence and historical candidate records; never borrow hashes or tests across builds. Current release notes are version-specific files such as `RELEASE_NOTES_7.9.1.md`.

## Current boundary

- Product: `ZERO ONE` 7.9.1 source by `QUANTUMENCRYPTION1 LTD`; signed-candidate evidence remains pending.
- Configured package: Windows x64 one-click NSIS.
- Configured preview targets: Windows x64, macOS arm64 and Linux x64. Windows arm64 and Intel macOS are not configured.
- Local security integration: user-selected-folder scan and status surface backed by exact immutable ZSEC Shield 0.1.2 Windows x86_64 payload.
- Runtime limits: unsigned, on-demand, no real-time protection, no automatic deletion/quarantine from the desktop, and zero production feed trust keys.
- Source: proprietary/private ZERO ONE repository; public Apache-2.0 ZSEC Shield dependency with required notices retained.
- Data lifecycle: service probes run on launch and every 30 seconds; persistent workspace sessions and settings survive restarts, confirmed clear-data removes the desktop-held settings/token/session partitions, and the current uninstaller intentionally preserves application data.

The current icon and preview screenshots are not automatically final Store assets. Exact-candidate captures must be regenerated after every visual/build change and reviewed at Store display sizes.

Before portal entry, compare every statement with the exact signed binary, live privacy/support/report pages, connected-service behavior, and current portal fields. Replace every placeholder. Store submission remains blocked on trusted signing of every installed PE, an approved EULA/customer licence, AI safety/governance beyond the reporting link, the separate authenticated post-sign ZSEC manifest, and exact final signed-candidate testing. A draft release, upload, validation pass, or visible Submit button is not publication evidence.
