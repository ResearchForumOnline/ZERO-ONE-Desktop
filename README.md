# ZERO ONE Desktop

ZERO ONE is a Windows command center for four existing products:

- **OpenZero** - local models, agent orchestration, tools, voice, and browser control.
- **ZeroThink** - research, reasoning, knowledge, and quantum workspaces.
- **ZMail** - secure mail, Workspace, ZNotes, Calendar, Campaigns, and zSign.
- **CallChat** - Matrix messaging plus MatrixRTC/LiveKit voice and video.

The app is a separate desktop policy boundary. It does not copy production backends, expose remote pages to Node.js, merge product credentials, or silently pass private content between services.

## Current alpha

- Bundled React/TypeScript command center and command palette.
- Four isolated persistent Electron webview partitions.
- Owned-origin navigation allowlist.
- Local OpenZero health detection and OpenAI-compatible chat client.
- OpenZero tokens encrypted with Electron `safeStorage` for the current Windows user.
- 16-slot agent lattice that distinguishes a ready worker from sleeping logical slots.
- Live service and machine health.
- CallChat camera/microphone denied by default and limited to the exact CallChat origin when enabled.
- Redacted diagnostics export.
- NSIS installer configuration.

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

## Security boundaries

- `nodeIntegration: false`, `contextIsolation: true`, and Chromium sandboxing stay enabled.
- Remote services receive no preload and no desktop IPC.
- Each product has a separate persistent partition.
- Only allowlisted owned origins can be embedded or opened through the bridge.
- The renderer has no generic filesystem, process, shell-command, or HTTP-proxy primitive.
- Local API credentials are never returned to the renderer after storage.
- Diagnostics exclude secrets, cookies, mail, notes, chat messages, call data, and agent prompts.
- AI output never sends mail, messages, or calls automatically.

## Release boundary

The current build is an internal alpha. Public distribution still requires an Authenticode certificate, signed update metadata, clean-machine installer testing, Matrix/Element licensing review, CallChat media testing, and an auditable updater/rollback channel.