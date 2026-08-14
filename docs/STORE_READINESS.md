# ZERO ONE Store-readiness gate

Status: **installable unsigned public preview; not submitted or approved by any Store**.

## ZERO ONE 7.9.2 source and public-preview gate

- Windows 10/11 x64: one-click NSIS installer, bundled native ZSEC, packaged and installed-app smoke tested.
- macOS Apple silicon: DMG and ZIP built on macOS CI with the pinned native ZSEC runtime.
- Linux x64: AppImage and DEB built on Linux CI with the pinned native ZSEC runtime.
- A tag-triggered, pinned GitHub workflow publishes packages plus one `SHA256SUMS.txt` only after all platform verification and packaging jobs pass.
- These packages deliberately remain prereleases until trusted Windows signing, Apple Developer ID/notarization and Linux repository signing are available.

## Verified source and package boundary

- Automated desktop security and contract suites, TypeScript checking, and the production Vite build pass on Windows.
- Windows x64, macOS arm64 and Linux x64 are configured preview package targets.
- Packaging fails unless the package version is internally consistent and the matching ZSEC 0.1.2 asset, manifest, hashes, licences, source revision and native architecture verify. Historical 0.4.0 evidence remains preserved in `store/RELEASE_EVIDENCE.md`; it is not evidence for the current 7.9.2 build.
- ZSEC status v2 and scan v1 parsers reject malformed, legacy, contradictory, and exit-code-mismatched evidence.
- Packaged smoke exercises launch, DOM, preload IPC, bundled ZSEC version, clean scan, and persisted incomplete scan.
- An earlier unsigned one-click NSIS candidate installed silently to the current-user application directory and removed its install directory plus shortcuts on clean uninstall; repeat this on the exact final signed candidate.
- Remote webviews have separate partitions, no preload, sandboxing, and an owned-origin allowlist. CallChat media is denied by default.
- Exact final-candidate hashes, signature inventory, screenshots, install/uninstall evidence and known limitations must be recorded in `store/RELEASE_EVIDENCE.md`; signing and Store evidence remain pending.

## Public dependency state

ZSEC Shield v0.1.2 is a public immutable prerelease with GitHub release-integrity attestation and an exact locked Windows x86_64 asset. It is on-demand, unsigned, has no real-time driver, and has no production rule-feed trust key. It is not an antivirus certification.

The upstream workflow for the next release now pins every Action to a reviewed full commit and adds build provenance. This does not retroactively give v0.1.2 SLSA build provenance and does not alter its immutable bytes.

## Blocking release gates

| Gate | Windows x64 | macOS | Linux |
|---|---|---|---|
| Native package | Built and functionally smoke-tested | DMG/ZIP built and native payload verified in CI | AppImage/DEB built and native payload verified in CI |
| Publisher signature | Missing on installer and multiple shipped PEs | Developer ID/notarization absent | Package/repository signing absent |
| Store identity | Partner Center product/publisher identity not verified in this release | App Store Connect identity not verified | Distribution accounts not configured |
| Compliance | Clean Windows 10/11, WACK where applicable, Narrator, High Contrast, keyboard-only, 200% scale, and reduced-motion evidence pending | Native sandbox/notarization/VoiceOver design pending | Native package-manager/Orca/confinement design pending |
| Legal/public metadata | Approved EULA/customer licence, exact connected-service privacy answers, verified support route, AI safety/governance evidence, and third-party rights review pending | Same | Same |
| ZSEC | Exact payload verified but nested unsigned PEs block public trust | No matching signed native payload | No matching signed native payload |
| Updates | In-app stable-release check and dual-SHA-256 verified package install exist; trusted publisher signing, signed update metadata and incident revocation plan remain absent | Verified download/open flow exists; notarization and signed update metadata remain absent | Verified download/open flow exists; repository/package signing and revocation remain absent |

For the Microsoft MSI/EXE route, the installer and every installed PE must chain to a trusted root. An unsigned installer or one unsigned nested DLL/PYD is a hard blocker. A self-signed certificate does not solve this.

Signing the verified upstream ZSEC files changes their bytes, so the immutable upstream v0.1.2 manifest and consumer lock must not be rewritten to describe post-signing files. A release build needs a separate authenticated post-sign manifest mapping each verified upstream hash to its deployed signed hash, signer identity, and trusted timestamp, followed by packaged and installed-candidate verification. Consuming a future fully signed upstream ZSEC release is the alternative. This provenance bridge is a release blocker.

Microsoft Store policy requires a means for users to report inappropriate live generative-AI content and requires generated content to comply with all Store policies. ZERO ONE's visible `https://talktoai.org/report-ai/` link supplies the chosen reporting route. The link alone is not safety evidence: model/output controls, moderation and escalation rules, governance ownership, abuse testing, and incident response must be documented and tested against the final production configuration before submission.

## Windows completion sequence

1. Reserve and verify the exact Partner Center product/publisher identity and route.
2. Approve and publish the proprietary EULA/customer licence and complete third-party rights review.
3. Obtain a trusted Authenticode or Microsoft Trusted Signing identity.
4. Verify the immutable upstream ZSEC payload, sign the installer and every shipped PE, then generate and authenticate the separate upstream-to-post-sign manifest; rebuild and verify every signature and mapping.
5. Complete AI safety/governance review and production-output abuse tests; verify both the visible reporting route and the operational response path.
6. Publish immutable version-specific HTTPS assets plus hashes, SBOM/provenance, signed update metadata, and rollback/revocation information.
7. Test the exact final signed candidate: install, launch, local scan, connected workspaces, report route, update, rollback, and uninstall on clean Windows 10 and 11.
8. Complete keyboard-only, Narrator, High Contrast, 200% scaling, reduced-motion, and final-candidate screenshot evidence.
9. Reconcile live privacy/support/report pages and Store disclosure fields with the exact signed build.
10. Upload, pass certification, submit with action-time confirmation, then independently verify the live Store install path. An upload or visible Submit button is not publication.

## Other platforms

Advertise only the currently configured targets: Windows x64, macOS arm64 and Linux x64. Windows arm64 and Intel macOS remain unsupported. Public-preview availability must not be described as publisher signing, notarization, Store approval or certification.

## Claims boundary

Allowed: desktop command center, deterministic on-demand selected-folder scanner, endpoint-security preview, aggregate local evidence.

Disallowed until shipped and independently supported: complete antivirus, real-time protection, ransomware protection, zero-day protection, certified/approved protection, telemetry-free absolute claims, detection percentages, or Microsoft/Apple approval.
