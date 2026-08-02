# Submission checklist

No final submit, publish, availability, pricing, legal acceptance or public representation is authorized by this checklist.

## Global release gate

- [ ] Freeze the exact source commit, version and platform feature matrix.
- [ ] Replace `EULA_DRAFT.md` with independently reviewed, approved and published proprietary EULA/customer terms; `UNLICENSED` prevents npm publication but is not customer terms, and the draft must never be packaged or presented for acceptance.
- [ ] Complete Matrix/Element, connected-service, icon, font and other third-party rights review.
- [ ] Publish stable product, privacy, support, security and vulnerability-disclosure URLs.
- [ ] Complete the connected-service privacy/data-retention audit and obtain legal approval.
- [ ] Build on each target operating system from a clean environment.
- [ ] Generate SBOM, provenance, SHA-256 digests and immutable release artifacts.
- [ ] Sign every shipped executable/helper and the update channel with platform-appropriate identities.
- [ ] Test install, first run, upgrade, rollback, offline behaviour and clean uninstall.
- [ ] Test keyboard-only operation, focus order, screen reader, 200% scaling, high contrast and reduced motion.
- [ ] Verify that every public statement matches the exact binary and production service state.
- [ ] Document and test live-generative-AI safety controls, moderation/escalation, governance ownership, abuse handling and incident response; the report link alone is insufficient.
- [x] Expose the visible AI-output reporting route at `https://talktoai.org/report-ai/`.
- [ ] Create least-privilege, non-expiring reviewer accounts; store credentials only in private portal fields.
- [ ] Capture platform-native screenshots from the exact signed candidate using synthetic/demo data.
- [ ] Keep ZSEC wording to on-demand scanner/status preview; verify that missing or stale status is never labelled protected.
- [x] Reproducibly stage the complete ZSEC onedir payload and verify both versioned scan/status contracts for the Windows x64 preview.
- [ ] Sign the complete ZSEC payload and commission production rule trust before public distribution.
- [ ] Provide and test a matching ZSEC runtime for every advertised OS/architecture, or omit scanning there.

## Microsoft Store — MSI/EXE route

- [ ] Reserve `ZERO ONE` and verify the Partner Center publisher identity.
- [ ] Confirm whether to continue with signed NSIS EXE or create MSIX; document the decision.
- [x] Produce and temp-install/test an earlier unsigned Windows x64 candidate; do not treat it as final 0.3.1 evidence.
- [ ] Keep 0.3.1 Windows x64 only; do not submit or advertise Windows arm64, macOS or Linux packages.
- [ ] Authenticode-sign the installer and every shipped PE, including ZSEC EXE, DLL and PYD files, with a trusted certificate matching the publisher.
- [ ] Preserve the immutable upstream ZSEC manifest/lock, then generate an authenticated post-sign manifest mapping each upstream hash to the deployed signed hash, signer and trusted timestamp.
- [ ] Confirm installer is standalone and its submitted install command is silent; retain command/output evidence.
- [ ] Confirm clean Windows 10 and 11 install, launch, upgrade and uninstall.
- [ ] Verify clear-data and uninstall retention on the exact signed candidate; document that the current uninstaller preserves application data unless the user clears it first.
- [ ] Run Windows App Certification Kit where applicable and retain the report.
- [ ] Enter description, applicable licence terms, at least one screenshot and the required 300×300 Store logo.
- [ ] Prefer at least four current desktop screenshots and supply accurate captions.
- [ ] Complete age rating, properties, privacy, support, system requirements, pricing and availability without inference.
- [ ] Confirm all required remote servers and reviewer accounts work immediately before submission.
- [ ] Re-download the submitted URL and prove its hash matches the approved artifact.
- [ ] After submission, verify certification outcome and the live Store install path; an uploaded package is not a release.

## Apple direct notarized Mac release

- [ ] Build x64 and arm64 on supported macOS; decide separate builds or a verified universal distribution.
- [ ] Replace/review the PNG fallback with correct 1024×1024 source art and native icon output.
- [ ] Sign the main app and every helper with Developer ID; verify hardened runtime and entitlements.
- [ ] Notarize with `notarytool`, staple the ticket and validate Gatekeeper online and offline.
- [ ] Test camera/microphone consent, secure credential storage, ZSEC-not-installed behaviour and every webview on Intel and Apple silicon.
- [ ] Publish versioned DMG/ZIP, signatures/hashes, system requirements, privacy, support and uninstall instructions.
- [ ] Verify the public download and Gatekeeper path on a clean Mac.

## Mac App Store — separate later gate

- [ ] Create a separate MAS target and App Sandbox/entitlement design; the current DMG target is not sufficient.
- [ ] Prove the app offers adequate app-like utility beyond repackaged websites under Guideline 4.2.
- [ ] Bundle a self-contained signed native ZSEC helper with sandbox-safe user-selected-folder access, or omit ZSEC from the MAS build.
- [ ] Create App Store Connect record, bundle ID, SKU, category and age rating.
- [ ] Provide required privacy and support URLs plus complete App Privacy answers for connected services.
- [ ] Provide 1–10 accepted 16:10 Mac screenshots with no alpha.
- [ ] Supply review contact, exact setup notes and non-expiring credentials for all sign-in paths.
- [ ] Test the signed MAS build, not the direct DMG build, through the review flow.
- [ ] Use manual release until the approved listing and binary have a final evidence review.

## Linux direct

- [ ] Build x64/arm64 AppImage and DEB on clean supported Linux environments.
- [ ] Add and validate AppStream MetaInfo, desktop entry and properly named installed icon in the product source through a separately reviewed change.
- [ ] Publish signed checksums and sign DEB repository `InRelease`/`Release` metadata with a dedicated release key.
- [ ] Document supported distributions, glibc/runtime requirements, sandbox/portal behaviour and uninstall commands.
- [ ] Test Linux secure-storage backend handling and ensure credentials are refused when only `basic_text` is available.
- [ ] Bundle a matching tested native ZSEC payload for each Linux architecture or omit scanning; test AppImage/DEB install, run, update and removal.
- [ ] Publish platform-native screenshots and a stable privacy/support page.
- [ ] Verify downloaded artifacts and package repository metadata from a clean machine.

## Flathub hold

- [ ] Do not create or submit a Flathub PR from AI-assisted material.
- [ ] Obtain a written eligibility decision or applicable exception under Flathub’s current generative-AI policy.
- [ ] Resolve the application and metadata licence/redistribution terms.
- [ ] Only after those gates, prepare upstream-integrated MetaInfo, desktop file, icon and an offline source-buildable Flatpak manifest through an eligible human-controlled workflow.

## Final evidence record

Record for each channel: portal product ID, submitted version, source commit, artifact URL, SHA-256, signing identity, certification/notarization report, privacy-policy revision, screenshots used, reviewer account owner/expiry, submission timestamp, approval timestamp, public URL and independently verified install result.

## Key official references

- [Microsoft MSI/EXE package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements)
- [Microsoft Store submission fields](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/create-app-submission)
- [Apple App Review](https://developer.apple.com/app-store/review/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Flathub requirements](https://docs.flathub.org/docs/for-app-authors/requirements)

