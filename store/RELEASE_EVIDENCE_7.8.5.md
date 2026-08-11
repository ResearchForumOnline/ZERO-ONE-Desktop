# ZERO ONE 7.8.5 local installation evidence

Date: 2026-08-11 (Europe/London)

## Build gates

- Vitest: 41 passed.
- Node integration tests: 19 passed.
- TypeScript: `tsc --noEmit` passed.
- Vite production build passed.
- Bundled ZSEC payload verification passed: 89 files, 60 PE files, AMD64, pinned source revision `78efb1186c50efeeedf68bc14044cbc019fc0e8e`.
- NSIS Windows x64 packaging passed.

## Artifact

- File: `ZERO-ONE-7.8.5-win-x64.exe`
- Bytes: 110,860,333
- SHA-256: `62d198359e756d9d0028981359305e60f8f1fa55e9be9bda974a8dd7f249c479`
- Authenticode: not signed; this evidence covers the locally built artifact only and is not a public release claim.

## Installation proof

- Silent installer exit code: 0.
- Windows uninstall registry reports `ZERO ONE 7.8.5` / version `7.8.5`.
- Installed `app.asar` SHA-256 matches the tested unpacked build: `6a84fcf20cdef0e4f49d1d742a7c8223542952c70320b3dc7c47b8cb6e0e0cee`.
- Installed application archive reports version `7.8.5` and contains the sovereign-research-ethics and credential-boundary prompt changes.
- Desktop shortcut resolves to the installed `ZERO ONE.exe`.
- Existing settings and encrypted workspace-login files were preserved byte-for-byte across installation.
- Rollback snapshot: `C:\Users\Administrator\Documents\Codex\2026-08-09\i\work\runtime-qa-backups\20260811-124111-zero-one-7.8.4`.

## Runtime check

- The installed application opened as the `org.talktoai.zeroone` desktop window.
- No chat message or external action was sent.
- ZERO ONE and all local Ollama/llama processes were stopped after the check to return the PC to an idle state.
