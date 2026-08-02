# ZERO ONE Desktop

ZERO ONE is a proprietary desktop command center for OpenZero, ZeroThink, ZMail, CallChat, and an evidence-bound ZSEC Shield preview. Version 0.3.1 is deliberately limited to Windows x64 while native payloads, signing, and host validation for other platforms remain unfinished.

Connected workspaces:

- **OpenZero** — a user-configured allowed model endpoint, agent orchestration, tools, voice, and browser control.
- **ZeroThink** — research, reasoning, knowledge, and quantum workspaces.
- **ZMail** — secure mail, Workspace, ZNotes, Calendar, Campaigns, and zSign.
- **CallChat** — Matrix messaging plus MatrixRTC/LiveKit voice and video.
- **ZSEC Shield preview** — an explicit user-selected-folder scan and versioned local status surface.

The app is a separate desktop policy boundary. It does not copy production backends, expose remote pages to Node.js, merge product credentials, or silently pass private content between services.

## Verified preview boundary

- React/TypeScript command center, command palette, responsive 1000-pixel minimum layout, and higher-contrast dark-theme text.
- Four isolated persistent Electron webview partitions with no preload, no Node integration, and an owned-origin navigation allowlist.
- Health detection and an OpenAI-compatible chat client for the user-configured allowed OpenZero endpoint, defaulting to `openzerogemma:latest`.
- OpenZero tokens encrypted with Electron `safeStorage`; insecure Linux `basic_text` fallback storage is rejected.
- A 16-slot orchestration view that reports measured endpoint reachability without inventing worker-pool telemetry.
- CallChat camera and microphone denied by default and restricted to the exact CallChat origin when enabled.
- Redacted diagnostics export and no generic renderer filesystem, process, shell, or HTTP-proxy primitive.
- Windows x64 bundles ZSEC Shield 0.1.2 from its exact immutable GitHub release. Packaging verifies the complete 89-file manifest, all hashes, 60 AMD64 PE files, required licences, source revision, and status/scan contracts.
- ZSEC status contract v2 fails closed: only an exact clean outcome with zero findings and zero errors can display `LAST SCAN CLEAR`. Incomplete, legacy, malformed, or contradictory evidence never displays clean.
- Packaged smoke covers launch, DOM, preload IPC, ZSEC identity, clean scan, and persisted incomplete scan.

ZSEC remains on-demand only: no real-time driver, background monitoring, automatic deletion, automatic quarantine, sample upload, or certified detection claim.

## Development and validation

```powershell
npm ci
npm run check
```

A fresh private checkout does not contain ignored ZSEC binaries. Stage the exact public dependency before Windows packaging:

```powershell
npm run stage:zsec
npm run verify:zsec
npm run pack:win
npm run dist:win
```

The stager downloads only the locked v0.1.2 Windows x86_64 asset, checks the immutable release and attestation boundary, rejects unsafe ZIP entries, verifies every extracted file, and runs local contract smokes before moving it into `vendor/zsec-shield`. Packaging independently repeats the embedded identity and inventory checks.

Release documentation:

- `docs/SECURITY_ARCHITECTURE.md`
- `docs/PRIVACY.md`
- `docs/STORE_READINESS.md`
- `store/README.md`
- `store/SOURCE_POLICY.md`

## Security boundaries

- `nodeIntegration: false`, `contextIsolation: true`, and Chromium sandboxing remain enabled.
- Remote services receive no preload or desktop IPC and use separate persistent partitions.
- IPC calls are accepted only from the main local renderer and its main frame.
- Packaged Electron binaries disable RunAsNode, `NODE_OPTIONS`, CLI inspection, and the unavailable browser-specific V8 snapshot; ASAR-only loading and embedded-ASAR integrity remain enabled.
- File-protocol privileges remain enabled only because the trusted packaged renderer currently uses `loadFile`; remote service webviews are separate HTTPS contexts with no preload.
- AI output never sends mail, messages, calls, or reports automatically.

## Source and release boundary

ZERO ONE source and CI stay private. ZSEC Shield is a deliberately public Apache-2.0 dependency whose licence and third-party notices ship in the bundle. A private repository prevents accidental source publication but cannot make Electron JavaScript impossible to inspect; credentials and signing secrets must never be compiled into the client.

Version 0.3.1 remains an unsigned internal candidate, not a public Store release and not a certified antivirus. Windows x64 is the only configured package target. Public distribution remains blocked on trusted signing of the installer and every shipped PE, an approved EULA/customer licence, AI safety and governance controls beyond the reporting link, a final signed candidate and clean Windows 10/11 testing, a verified support route, exact privacy/report disclosure reconciliation, immutable signed app hosting/update metadata, connected-service disclosure review, and Store approval.
