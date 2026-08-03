# ZERO ONE 0.6.1 release evidence

- Local Windows build date: 3 August 2026 (Europe/London).
- Windows installer: `release/ZERO-ONE-0.6.1-win-x64.exe`.
- Local Windows SHA-256: `58E103CEE00DB83DD5652F26F7A7D52FE4DA295FE45C5A5ADE3F8E2995F0C904`.
- Automated application tests: 36 Vitest tests and 8 Node tests passed.
- TypeScript and Vite production build passed.
- Embedded ZSEC vendor identity verified against source revision `78efb1186c50efeeedf68bc14044cbc019fc0e8e`.
- Packaged Windows smoke passed after the required local Ollama runtime was started: launch, DOM, ZSEC identity, clean scan, fail-closed incomplete scan, and real local Assistant chat.
- Authenticode status: `NotSigned`; public packages may show an unknown-publisher warning until trusted platform signing is configured.
- GitHub Actions builds macOS and Linux packages on their native runners. The release-level `SHA256SUMS.txt` is generated from the actual workflow artifacts and is authoritative for public downloads.
