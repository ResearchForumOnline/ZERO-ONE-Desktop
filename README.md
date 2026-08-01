# ZERO ONE Desktop

ZERO ONE is a desktop command center for four connected services plus an evidence-bound endpoint-security preview. Windows is the currently verified packaging target; macOS and Linux package definitions are present but require native signing and host validation.

Connected workspaces:

- **OpenZero** - local models, agent orchestration, tools, voice, and browser control.
- **ZeroThink** - research, reasoning, knowledge, and quantum workspaces.
- **ZMail** - secure mail, Workspace, ZNotes, Calendar, Campaigns, and zSign.
- **CallChat** - Matrix messaging plus MatrixRTC/LiveKit voice and video.
- **ZSEC Shield preview** - a local, versioned status bridge for the separately installed deterministic on-demand scanner.

The app is a separate desktop policy boundary. It does not copy production backends, expose remote pages to Node.js, merge product credentials, or silently pass private content between services.

## Current preview

- Bundled React/TypeScript command center and command palette.
- Four isolated persistent Electron webview partitions.
- Owned-origin navigation allowlist.
- Local OpenZero health detection and OpenAI-compatible chat client.
- OpenZero tokens encrypted with Electron `safeStorage`; insecure Linux `basic_text` fallback storage is rejected.
- 16-slot agent lattice that distinguishes a ready worker from sleeping logical slots.
- Live service and machine health.
- ZSEC Shield status contract v1 with explicit on-demand/real-time limitations.
- CallChat camera/microphone denied by default and limited to the exact CallChat origin when enabled.
- Redacted diagnostics export.
- Hardened Electron fuses and Windows NSIS, macOS DMG/ZIP, and Linux AppImage/DEB package definitions.

## Development

```powershell
npm install
npm run dev
```

Validation:

```powershell
npm run check
```

Build an unpacked Windows application:

```powershell
npm run pack:win
```

Build an NSIS installer:

```powershell
npm run dist:win
```

Native macOS or Linux packaging (run and sign on the matching operating system):

```bash
npm run dist:mac
npm run dist:linux
```

Release documentation:

- `docs/STORE_READINESS.md`
- `docs/SECURITY_ARCHITECTURE.md`
- `docs/PRIVACY.md`

## Security boundaries

- `nodeIntegration: false`, `contextIsolation: true`, and Chromium sandboxing stay enabled.
- Remote services receive no preload and no desktop IPC.
- Each product has a separate persistent partition.
- Only allowlisted owned origins can be embedded or opened through the bridge.
- IPC calls are accepted only from the main local renderer and its main frame.
- Packaged Electron binaries disable RunAsNode, NODE_OPTIONS, CLI inspect and broad file-protocol privileges, while enforcing ASAR-only loading and embedded-ASAR integrity.
- The renderer has no generic filesystem, process, shell-command, or HTTP-proxy primitive.
- Local API credentials are never returned to the renderer after storage.
- Diagnostics exclude secrets, cookies, mail, notes, chat messages, call data, and agent prompts.
- AI output never sends mail, messages, or calls automatically.

## Release boundary

Version 0.2.0 is an unsigned preview candidate, not a public-store release and not a certified antivirus. Public distribution still requires publisher signing identities, immutable hosted installers, native clean-machine testing, accessibility evidence, privacy/support URLs, Matrix/Element licensing review, ZSEC binary signing and installer integration, signed app-update metadata, notarization on macOS, and store review. ZSEC does not claim kernel interception, real-time protection, independent detection certification, or complete malware prevention.