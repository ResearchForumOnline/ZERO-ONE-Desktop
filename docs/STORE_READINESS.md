# ZERO ONE store-readiness gate

Status: validated unsigned preview candidate. It has not been submitted or approved by any store.

## Verified now

- Eight desktop tests, TypeScript checking and the production Vite build pass on Windows.
- A one-click Windows x64 NSIS installer was built, silently installed and cleanly uninstalled from a disposable path.
- The candidate bundles the complete ZSEC Shield 0.1.0 Windows x86_64 PyInstaller onedir payload, including its `_internal` runtime.
- The packaged ZSEC runtime returned `zsec.shield.report.v1`, hashed nine synthetic/store-metadata files, reported zero configured-rule matches and zero errors, and exited successfully.
- The ZSEC bridge validates versioned status and scan contracts, scans only one folder explicitly chosen through the operating-system picker, uses a fixed argument vector and returns only aggregate results to the renderer.
- BrowserWindow sandboxing, context isolation, Node isolation, exact packaged-renderer navigation and hardened Electron fuses are enabled.
- Remote webviews have separate partitions, no preload and an owned-origin allowlist. CallChat media is denied by default and limited to its exact HTTPS origin when enabled.
- Production dependency audit reports zero known vulnerabilities.

## Current release evidence

| Item | Evidence |
|---|---|
| ZERO ONE version | `0.3.0` |
| Windows installer | `ZERO-ONE-0.3.0-win-x64.exe` |
| Installer SHA-256 | `43ed42df1d92232f87b979d3917c438228896d2e99561a4eca5a3c9e2ffa78a2` |
| Bundled ZSEC version | `0.1.0` |
| Bundled ZSEC EXE SHA-256 | `435f0a9e63490f213398c31095e29e77bf546e7be16ec081f2145ac69b21e4a1` |
| Signature state | Installer, app EXE and ZSEC EXE are `NotSigned` |
| Runtime policy | On-demand; no real-time protection; no telemetry; zero production trust keys |

These hashes identify the local candidate only. They are not a public release or publisher signature.

## Blocking release gates

| Gate | Windows | macOS | Linux |
|---|---|---|---|
| Native package built on target OS | x64 candidate verified; arm64 definition present but unverified | Not verified | Not verified |
| Publisher signature | Authenticode absent from installer and nested PEs | Developer ID absent | Package/repository signing absent |
| Store identity | Partner Center session/identity unavailable | App Store Connect session/identity unavailable | Distribution accounts not configured |
| Compliance test | Clean VM, WACK and Narrator/200% scaling pending | Notarization, Gatekeeper and VoiceOver pending | Clean VM, package-manager and Orca testing pending |
| Legal metadata | Public endpoint-specific privacy/support URLs, approved licence/EULA and third-party rights review pending on all platforms |
| ZSEC runtime | Bundled x86_64 payload verified but unsigned; arm64 combination unverified | No host-native payload staged | No host-native payload staged |
| ZSEC rule trust | Zero production trust keys; signed production definition channel is not commissioned | Same | Same |
| Updates | Signed app-update metadata and rollback channel are not implemented | Same | Same |

Do not upload this unsigned EXE/MSI route to Microsoft Store or present it as signed, certified, complete antivirus or real-time protection.

## Windows release sequence

1. Sign in to Partner Center, reserve the exact identity and choose MSIX or the Store-listed signed EXE/MSI route.
2. Obtain a trusted Authenticode or Microsoft Trusted Signing identity matching the public publisher.
3. Reproducibly stage the complete ZSEC onedir runtime and sign every shipped PE, including EXE, DLL and PYD files.
4. Build immutable x64 and arm64 artifacts; provide a native arm64 ZSEC runtime or prove the x86_64 runtime under the advertised emulation path.
5. Verify install, launch, scan, update, rollback and clean uninstall on clean Windows 10 and 11 VMs; run WACK where applicable.
6. Complete keyboard-only, 200% scaling, Narrator, High Contrast and reduced-motion evidence.
7. Publish stable Privacy, Terms, Support and Security URLs and accurate connected-service disclosures.
8. Record hashes, SBOM/provenance, package inventory and versioned status/scan contract tests, then submit.

## macOS release sequence

1. Stage and test a host-native signed ZSEC payload or explicitly exclude ZSEC scanning.
2. Build x64 and arm64 on macOS, review `.icns` artwork, helpers, purpose strings and entitlements.
3. Sign with Developer ID, submit with `notarytool`, staple and validate offline Gatekeeper behaviour.
4. Prefer a notarized direct-download build first. A later Mac App Store build must be final rather than preview, use App Sandbox/user-selected-file entitlements and provide app-like utility beyond a web wrapper.
5. Do not claim real-time endpoint monitoring without an approved EndpointSecurity entitlement and user-approved system extension.

## Linux release sequence

1. Stage and test a matching native ZSEC payload for every advertised architecture or explicitly exclude scanning.
2. Build AppImage and DEB on clean x64/arm64 Linux runners.
3. Sign repository metadata with a dedicated offline-managed release key and publish an SBOM plus hashes.
4. Test install, update, rollback, permissions and uninstall on supported distributions.
5. Keep Flathub submission on hold pending licensing and policy review; host-wide scanning does not fit ordinary sandbox confinement.

## Evidence required before the word antivirus

The desktop may say deterministic on-demand scanner or endpoint-security preview. It must not say complete antivirus, real-time protection, ransomware protection, zero-day protection, certified, Microsoft/Apple approved, or publish detection percentages until those exact capabilities are shipped, independently tested and supported.

## Store metadata pack

The `store/` directory contains draft listing copy, a platform metadata/assets matrix, privacy boundaries, screenshot requirements, an asset inventory and submission checklists. Placeholders remain intentionally unresolved until public URLs, support contacts, legal terms, publisher identities and final signed artifacts exist.