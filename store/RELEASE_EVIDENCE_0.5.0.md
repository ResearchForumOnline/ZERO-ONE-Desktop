# ZERO ONE 0.5.0 release evidence

Status: **locally built, installed and smoke-tested on Windows 10 x64; public release and publisher signing remain pending.**

## Release identity

- Source state: working tree (no release commit recorded yet)
- Windows installer: `release/ZERO-ONE-0.5.0-win-x64.exe`
- Installer size: 110,845,838 bytes
- Installer SHA-256: `277707868FAD1E19AD56FF6908AA156395E654E26009527B06D67D2B3DF7D803`
- Authenticode: `NotSigned`
- Installed application: `%LOCALAPPDATA%\Programs\zero-one-desktop\ZERO ONE.exe`
- Installed version: `0.5.0.0`

## Verified local OpenZero proof

- Official Ollama Windows installer signature was valid and issued to Ollama Inc.
- Local Ollama `0.32.5` is reachable only through the fixed loopback app origin `http://127.0.0.1:11434`.
- Installed model: `hf.co/shafire/Zero-Gemma4-E4B-OpenZero-GGUF:latest`, 5.9 GB.
- The model pull completed its SHA-256 verification and wrote the Ollama manifest successfully.
- A real `/api/chat` request returned exactly `ZERO ONE LOCAL READY`; first-load wall time was 25.5 seconds.
- The installed settings migrated to the exact local model while preserving the existing encrypted Server token and storing no plaintext token.
- A normal installed launch produced a responsive visible `ZERO ONE` window after the window-reveal fallback fix.
- The UI and README distinguish local private model chat from full OpenZero Server orchestration, tools, browser control and agents.

## Automated and package gates

- Vitest: 27/27 passed.
- Electron Node boundary tests: 8/8 passed.
- TypeScript and Vite production build: passed.
- Locked ZSEC vendor verification: passed; 89 files, 60 PE files, x86_64, expected entrypoint SHA-256.
- NSIS Windows x64 build: passed.
- Silent install: exit code 0.
- Installed process and visible-window smoke: passed.

## Still required before a public signed release

- Commit and tag the intended release scope.
- Obtain a Windows code-signing certificate and rebuild/sign the installer.
- Exercise model cancellation and stopped-service recovery in the packaged UI.
- Capture final compact and desktop UI screenshots for store assets.
- Publish the verified artifact and update the public download target only after upload verification.

Official external references: [Ollama download](https://ollama.com/download), [Ollama quickstart](https://docs.ollama.com/quickstart), and [Ollama chat API](https://docs.ollama.com/api/chat).
