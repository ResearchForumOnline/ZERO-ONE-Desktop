# ZERO ONE 0.3.0 local release evidence

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

These 1280×720 preview captures document the reviewed UI but do not meet Microsoft’s minimum listing dimensions and are not macOS/Linux evidence.