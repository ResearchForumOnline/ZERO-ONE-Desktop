# ZERO ONE

<p align="center">
  <img src="assets/zero-one-icon.png" width="112" alt="ZERO ONE orbit mark">
</p>

<p align="center"><strong>One private desktop command center for OpenZero, ZeroThink, ZMail, CallChat, ZSEC Shield, and ZMath Secure.</strong></p>

<p align="center">
  <a href="https://talktoai.org/ZeroOne/">Download</a> ·
  <a href="https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v0.4.0">Release</a> ·
  <a href="docs/SECURITY_ARCHITECTURE.md">Security</a> ·
  <a href="docs/PRIVACY.md">Privacy</a>
</p>

![ZERO ONE command center](store/screenshots/01-command-center.png)

ZERO ONE is an open-source Electron desktop shell for the TalkToAI ecosystem. It keeps connected products in isolated workspace sessions, talks to a user-configured OpenZero endpoint, and surfaces explicit local security controls without pretending an AI response or a UI badge is proof of protection.

## Download and install

Use the authenticated [ZERO ONE 0.4.0 release](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/tag/v0.4.0). No development tools are required.

| Platform | Package | Install |
|---|---|---|
| Windows 10/11 x64 | `ZERO-ONE-0.4.0-win-x64.exe` | Download, double-click and follow the one-click installer |
| macOS Apple silicon | `ZERO-ONE-0.4.0-mac-arm64.dmg` | Open the disk image and drag ZERO ONE to Applications |
| Linux x64 | `ZERO-ONE-0.4.0-linux-x64.AppImage` | Make executable and open |
| Debian/Ubuntu x64 | `ZERO-ONE-0.4.0-linux-x64.deb` | Open with the software installer or use `sudo apt install ./ZERO-ONE-0.4.0-linux-x64.deb` |

The 0.4.0 packages are unsigned public previews. Windows SmartScreen or macOS Gatekeeper may show an unknown-publisher warning. Verify downloads against `SHA256SUMS.txt`; publisher signing and Store approval are still in progress.

## What is included

- Four isolated workspaces with strict owned-origin navigation.
- OpenZero chat with the default `openzerogemma:latest` model alias.
- A 16-slot agent-control surface that reports real endpoint reachability, not invented worker telemetry.
- OS-protected credential storage; insecure Linux fallback storage is refused.
- The matching native ZSEC Shield 0.1.2 selected-folder scanner on every published platform.
- ZMath Secure status for HTTPS/loopback transport, credential storage, and optional Windows BitLocker.
- Redacted diagnostics and consent-based camera/microphone access.

![ZSEC Shield selected-folder scanning](store/screenshots/02-zsec-shield.png)

## First run

1. Open ZERO ONE and choose OpenZero, ZeroThink, ZMail or CallChat.
2. The default service addresses work without configuration. Add an OpenZero token in Settings only for authenticated copilot requests.
3. Open ZSEC Shield, choose one folder and review the local result. No background scan, deletion, upload or quarantine starts automatically.

## Build from source

Requirements: Node.js 24 and npm.

```bash
git clone https://github.com/ResearchForumOnline/ZERO-ONE-Desktop.git
cd ZERO-ONE-Desktop
npm ci
npm run check
npm run dev
```

Platform packages are produced on their native operating systems by the pinned [release workflow](.github/workflows/release.yml).

## Open-core and security boundary

The desktop shell, security contracts, tests and build configuration are Apache-2.0 licensed. Unpublished ZMath research, experimental cipher implementations, production secrets, signing keys, server infrastructure and private datasets are not included.

ZERO ONE uses established TLS and operating-system cryptography. It reads Windows BitLocker status but never silently enables disk encryption or stores a recovery key. ZSEC Shield is an on-demand security companion—not certified antivirus, real-time prevention or guaranteed malware detection. Keep the operating system's built-in protection enabled.

See [ZMath Secure](docs/ZMATH_SECURE_BOUNDARY.md), [privacy](docs/PRIVACY.md), [security architecture](docs/SECURITY_ARCHITECTURE.md) and [release evidence](store/RELEASE_EVIDENCE.md).

## Licence

Apache License 2.0. ZERO ONE names, logos and product identity are not granted for confusing or impersonating distributions; see [TRADEMARKS.md](TRADEMARKS.md).
