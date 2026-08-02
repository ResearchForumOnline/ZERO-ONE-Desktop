# ZERO ONE local release evidence

## 0.4.0 installable public preview

Status: **cross-platform package candidate; public prerelease only after native CI succeeds**.

Configured targets are Windows 10/11 x64 (NSIS), macOS Apple silicon (DMG/ZIP), and Linux x64 (AppImage/DEB). Each target bundles a matching immutable ZSEC Shield 0.1.2 runtime and verifies its platform, architecture, source revision, manifest, file hashes and entrypoint before packaging.

Local Windows validation on 2 August 2026:

| Artifact | Bytes | SHA-256 | Publisher signature |
|---|---:|---|---|
| `ZERO-ONE-0.4.0-win-x64.exe` | 110,830,400 | `36210f11d145c66b7349ade2a5b81de76355da5ae143bbb6b65e45c8ca8dfb46` | NotSigned |
| `ZERO-ONE-0.4.0-win-x64.exe.blockmap` | 117,268 | `35b1734bd4bf7dffbf2a9b1eeb787020ccb8699ab9bea5be02f7f09146ee7960` | Data file |

Passed locally: 14 tests, TypeScript, production Vite build, exact 89-file/60-PE ZSEC verification, packaged application launch, DOM/preload bridge, clean selected-folder scan, fail-closed incomplete scan, silent install exit 0, installed version 0.4.0 registration, Start Menu shortcut, desktop shortcut, and live installed-app inspection showing four reachable services and bundled ZSEC installed.

macOS and Linux artifact hashes remain CI-generated evidence and must not be copied into this file until the tag workflow publishes the exact bytes. None of the 0.4.0 packages is currently publisher-signed, notarized or Store-approved.

## 0.3.1 internal candidate — evidence pending

Status: **not a final release artifact; not submitted, approved, or public**.

The 0.3.1 source is configured only for Windows x64. Thirteen desktop security/contract tests, TypeScript checking, production Vite build, the exact immutable ZSEC 0.1.2 inventory verifier, and packaged smoke are the required candidate gates. Do not copy artifact sizes, hashes, signatures, screenshots, install results, or PE counts from 0.3.0 or from an earlier 0.3.1 rebuild into this section.

The final evidence row remains intentionally empty until one exact signed candidate is frozen and tested:

| Artifact | Bytes | SHA-256 | Trusted signature | Source commit | Test record |
|---|---:|---|---|---|---|
| Final 0.3.1 Windows x64 installer | Pending | Pending | Pending | Pending | Pending |

### Exact unsigned validation candidate — not for publication

Built and tested: 2026-08-02 (Europe/London). These records prove the current private candidate runs; they are not substitutes for a signed final release.

| Artifact | Bytes | SHA-256 | Signature |
|---|---:|---|---|
| `ZERO-ONE-0.3.1-win-x64.exe` | 110,829,105 | `2172a4683f2425d0f5801b4bc8a40a035c4654904e7f8d7a2dc8d64a6f41be47` | NotSigned |
| `ZERO-ONE-0.3.1-win-x64.exe.blockmap` | 117,328 | `49516a0c4e09a6133df0251ca7142c20084ea2d9e80157225cd2bbcc5245b74a` | Not applicable |
| unpacked `ZERO ONE.exe` | 225,674,240 | `33c872c7730150e7097d4aa04f79d9d16d75aa688cd8ac18c60b3d22fe2ac498` | NotSigned |
| `app.asar` | 8,588,267 | `4e531fa1496646ad61e0de81e13ec94588e88b38e4a57a9231628d5a0d7ec854` | Embedded-ASAR integrity enabled; not a publisher signature |
| bundled `zsec-shield.exe` | 2,082,501 | `6bc60026691fff00319e23c7ba9d49d1ab9f893715766177226062baa069d501` | NotSigned |
| bundled ZSEC provenance | 1,657 | `1eebb5e212b33b62af6668a3280eb8403f097ed8b416789f0af38caffc020cdf` | Data file |

Validation passed: 13/13 tests, TypeScript, production Vite build, exact ZSEC 0.1.2 inventory (89 files, 60 AMD64 PEs), Electron fuse verification, packaged launch/DOM/IPC, clean-scan `LAST SCAN CLEAR`, fail-closed incomplete scan, silent install, installed-app smoke, and silent uninstall with install directory and shortcuts removed. The installed main executable was byte-identical to the unpacked candidate.

The PE inventory contains 71 files: 59 have valid Authenticode signatures and 12 are unsigned, including the installer, main app, bundled ZSEC executable, Electron DLLs, elevation helper, and two Python extensions. Public/Store distribution remains blocked. ASAR review found no source maps, environment/key files, or detected credential patterns, but distributed Electron JavaScript remains inspectable. The online advisory audit was not run because the environment blocked disclosure of private dependency metadata to npm; local production dependency-tree validation passed, so no online vulnerability-clean claim is made.

Public/Store release remains blocked on all of the following:

- trusted signing of the installer and every shipped PE;
- a separate authenticated manifest mapping verified immutable upstream ZSEC hashes to deployed post-sign hashes, signer identities, and timestamps;
- an approved and published EULA/customer licence;
- live-generative-AI safety/governance, moderation, abuse and incident-response evidence beyond the visible reporting link;
- clean Windows 10/11 install, launch, connected-service, ZSEC, accessibility, update/rollback, clear-data, uninstall-retention, and final screenshot testing of the exact signed bytes.

## 0.3.0 historical local candidate

Recorded: 2026-08-02 (Europe/London)
Candidate directory: `C:\tmp\zero-one-0.3.0-final3-20260802`

## Artifact identity

| Artifact | Bytes | SHA-256 | Signature |
|---|---:|---|---|
| `ZERO-ONE-0.3.0-win-x64.exe` | 110,215,992 | `43ed42df1d92232f87b979d3917c438228896d2e99561a4eca5a3c9e2ffa78a2` | NotSigned |
| unpacked `ZERO ONE.exe` | 225,674,240 | `2fe5dad8ddc205e475d0c1dc4c9473a3a88972d5752cad54928f119541487ef7` | NotSigned |
| bundled `zsec-shield.exe` | 2,014,346 | `435f0a9e63490f213398c31095e29e77bf546e7be16ec081f2145ac69b21e4a1` | NotSigned |
| ZSEC native source archive | 11,626,095 | `6cbbffdaf096bdca7f1438c4027be63e48acbf6ae7f5525c6060a1801f682c83` | SHA-256 sidecar only |

## Validation performed

- Desktop: 8 tests passed; TypeScript and production Vite build passed.
- Production dependency audit: 0 known vulnerabilities.
- UI: command center and ZSEC selected-folder flow inspected in a live local render; accessible names and status regions were present.
- ZSEC native packaging: 36 tests passed with 1 capability skip; Ruff and strict mypy passed; 48 manifest records produced zero hash mismatches.
- Packaged scan: `zsec.shield.report.v1`, outcome `no_configured_rule_matches`, 9 generated store-metadata files hashed, 0 findings, 0 errors.
- Installer: silent temp install exit 0; bundled runtime present; silent uninstall exit 0; install directory removed.
- Electron fuses were applied after packaging through the checked `afterPack` hook.

## Provenance and limitations

The bundled ZSEC local archive records source revision `8a5335be8278f597002529fde80246f452e10683` and `source_tree_state: modified`. This truthfully identifies a local working-tree candidate, not a clean tagged release.

The installer, main app and bundled ZSEC executable are unsigned. The candidate is not eligible for the Microsoft MSI/EXE Store route, public trusted distribution or an antivirus claim. Windows arm64, macOS and Linux artifacts are not verified. No Partner Center, App Store Connect or PyPI submission was completed because authenticated publisher sessions and signing identities were unavailable.

## Screenshots

- `store/screenshots/01-command-center.png`
- `store/screenshots/02-zsec-shield.png`

These 1366×768 captures meet Microsoft's minimum dimensions and document the reviewed UI. They are development-preview evidence, not exact signed-candidate, macOS, or Linux evidence.
