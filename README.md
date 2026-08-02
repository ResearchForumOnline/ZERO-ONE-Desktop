# ZERO ONE

<p align="center">
  <img src="assets/zero-one-icon.png" width="112" alt="ZERO ONE orbit mark">
</p>

<p align="center"><strong>One private desktop command center for OpenZero, ZeroThink, ZMail, CallChat, ZSEC Shield, and ZMath Secure.</strong></p>

<p align="center">
  <a href="https://talktoai.org/ZeroOne/">Website</a> ·
  <a href="docs/SECURITY_ARCHITECTURE.md">Security</a> ·
  <a href="docs/PRIVACY.md">Privacy</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

![ZERO ONE command center](store/screenshots/01-command-center.png)

ZERO ONE is an open-source Electron desktop shell for the TalkToAI ecosystem. It keeps connected products in isolated workspace sessions, talks to a user-configured OpenZero endpoint, and surfaces explicit local security controls without pretending an AI response or a UI badge is proof of protection.

## What is here

- Four isolated workspaces with strict owned-origin navigation.
- OpenZero chat with the default `openzerogemma:latest` model alias.
- A 16-slot agent control surface that reports real endpoint reachability, not invented worker telemetry.
- OS-protected credential storage; insecure Linux fallback storage is refused.
- ZSEC Shield selected-folder scanning with bounded, versioned evidence.
- ZMath Secure status for HTTPS/loopback transport, credential storage, and optional Windows BitLocker.
- Redacted diagnostics and consent-based camera/microphone access.

![ZSEC Shield selected-folder scanning](store/screenshots/02-zsec-shield.png)

## Start locally

Requirements: Windows 10/11 x64, Node.js 22+, and npm.

```powershell
git clone https://github.com/ResearchForumOnline/ZERO-ONE-Desktop.git
cd ZERO-ONE-Desktop
npm ci
npm run check
npm run dev
```

`npm run dev` uses preview data until the Electron bridge is available. An OpenZero token is optional for exploring the interface and required only for copilot requests.

## Open-core boundary

The desktop shell, security contracts, tests, and build configuration in this repository are Apache-2.0 licensed and can be inspected, changed, and redistributed under that licence.

Unpublished ZMath research, experimental cipher implementations, production secrets, signing keys, server infrastructure, and private datasets are **not in this repository or its release artifacts**. A public client cannot contain code that is genuinely impossible to inspect or modify. ZERO ONE therefore exposes a documented compatibility boundary while actual connection security uses established TLS and operating-system cryptography. See [the ZMath Secure boundary](docs/ZMATH_SECURE_BOUNDARY.md).

## Disk encryption

ZERO ONE reads Windows BitLocker status and can open the official Device encryption settings. It never silently enables encryption, stores a recovery key, or replaces BitLocker with a custom cipher. Initial encryption can take time; modern hardware usually has modest overhead, while older or storage-heavy systems may notice more.

## Security and release status

Version 0.3.1 is a source-available public preview for Windows x64. The repository is open source; public installer distribution is still blocked on trusted code signing and final clean-machine evidence. ZSEC Shield is an on-demand companion, not certified antivirus or real-time malware prevention.

Security architecture and the remaining release gates are documented in [`docs/`](docs/). Please report vulnerabilities privately using GitHub's security advisory flow instead of a public issue.

## Licence

Apache License 2.0. ZERO ONE names, logos, and product identity are not granted for confusing or impersonating distributions; see [TRADEMARKS.md](TRADEMARKS.md).
