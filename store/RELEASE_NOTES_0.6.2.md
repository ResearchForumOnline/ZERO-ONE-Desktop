# ZERO ONE 0.6.2

A focused desktop quality release for everyday use: private Assistant setup without API keys, longer ZMail sessions inside the app, and packaging locks that match the shipped version.

## Assistant — zero-config private chat

- Local OpenZero + Ollama remains the recommended path; no cloud key is required for everyday chat.
- If no OpenZero desktop token is stored, chat routes through the local model automatically.
- One-click **Download local model** from the Assistant drawer when `qwen3:1.7b` is missing.
- Clear conversation from the drawer (`Ctrl+L` when not typing in another field).
- Toggle Assistant with `Ctrl+J`.

## ZMail session reliability

- Server-side webmail session lifetime is aligned for multi-day desktop use (see host ops notes).
- ZERO ONE keeps the embedded ZMail partition warm with a soft keep-alive while the app is open.
- Workspace banner explains persistent sessions and isolated cookies.

## Desktop usability

- Restores your last workspace and Assistant open/closed state between launches.
- Discrete zoom steps in the header match main-process zoom levels.
- Offline banners for every connected workspace (not only OpenZero).
- Ignore harmless Chromium abort errors (`-3`) during webview navigation so false “failed to load” banners appear less often.
- Settings **About** panel shows the running version and source link.

## Packaging integrity

- Package version, ZSEC consumer lock, and `beforePack` gate are all pinned to **0.6.2** so Windows packaging does not fail closed after the version bump.

## Platforms

Same targets as 0.6.1:

- Windows 10/11 x64 installer
- macOS Apple-silicon DMG and ZIP
- Linux x64 AppImage and Debian/Ubuntu package

Packages remain unsigned public builds. Verify downloads with `SHA256SUMS.txt` when a release is published.
