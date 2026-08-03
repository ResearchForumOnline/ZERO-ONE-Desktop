# ZERO ONE 0.6.0 release evidence

- Built: 3 August 2026 (Europe/London).
- Windows installer: `release/ZERO-ONE-0.6.0-win-x64.exe`.
- SHA-256: `FA46A023B1CFF2169E44508784D3AF4A2D121270D27CFAAF635D37322C1C2A17`.
- Installed executable: `%LOCALAPPDATA%/Programs/zero-one-desktop/ZERO ONE.exe`.
- Installed version: `0.6.0`.
- Automated application tests: 29 Vitest tests and 8 Node tests passed.
- TypeScript and Vite production build passed.
- Embedded ZSEC vendor identity verified against source revision `78efb1186c50efeeedf68bc14044cbc019fc0e8e`.
- Installed-path smoke passed: packaged launch, DOM, ZSEC identity, clean scan, fail-closed incomplete scan, and real local Assistant chat.
- Authenticode status: `NotSigned`; public distribution will still show an unknown-publisher warning until a trusted Windows code-signing certificate is configured.
- OpenZero Tab Pilot v0.3.0 automatic-pairing source passed its MV3 checks and 21 tests; browser-store publication is a separate release action.
