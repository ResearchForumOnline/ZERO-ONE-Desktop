# ZERO ONE

<p align="center">
  <img src="assets/zero-one-icon.png" width="112" alt="ZERO ONE orbit mark">
</p>

<p align="center"><strong>One private desktop command center for OpenZero, ZeroThink, ZMail, CallChat, ZSEC Shield, and ZMath Secure.</strong></p>

<p align="center">
  <a href="https://talktoai.org/ZeroOne/">Download</a> ·
  <a href="https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/latest">Latest release</a> ·
  <a href="docs/SECURITY_ARCHITECTURE.md">Security</a> ·
  <a href="docs/PRIVACY.md">Privacy</a>
</p>

![ZERO ONE command center](store/screenshots/01-command-center.png)

ZERO ONE is an open-source Electron desktop shell for the TalkToAI ecosystem. It keeps connected products in isolated workspace sessions, talks to a user-configured OpenZero endpoint, and surfaces explicit local security controls without pretending an AI response or a UI badge is proof of protection.

## Download and install

ZERO ONE adapts from full desktop layouts down to compact 720 × 520 windows. Use the header zoom controls or `Ctrl +`, `Ctrl -`, and `Ctrl 0` to adjust the interface from 75% to 150%; embedded workspaces follow the same scale.

Use the authenticated [latest ZERO ONE release](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/latest). No development tools are required.

| Platform | Package | Install |
|---|---|---|
| Windows 10/11 x64 | `ZERO-ONE-*-win-x64.exe` | Download the latest Windows installer from [Releases](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/latest) |
| macOS Apple silicon | `ZERO-ONE-*-mac-arm64.dmg` | Open the disk image and drag ZERO ONE to Applications |
| Linux x64 | `ZERO-ONE-*-linux-x86_64.AppImage` | Make executable and open |
| Debian/Ubuntu x64 | `ZERO-ONE-*-linux-amd64.deb` | Open with the software installer or use `sudo apt install ./ZERO-ONE-*-linux-amd64.deb` |

Current source version is **7.9.2**. Published installers are unsigned public builds until Authenticode/notarization ships. Windows SmartScreen or macOS Gatekeeper may show an unknown-publisher warning. ZERO ONE's in-app updater accepts only the exact stable package published by this repository when GitHub's asset digest and `SHA256SUMS.txt` agree.

## What is included

- Four isolated workspaces with strict owned-origin navigation.
- A built-in Browser Pilot: one isolated tab, one user-granted task, a 12-step limit, structural snapshots that omit form values, secret/payment/file/CAPTCHA blocking, cross-site and consequential approval pauses, and an immediate stop-and-revoke control.
- Guided Assistant setup with private local OpenZero Gemma4 E2B as the recommended lightweight default and optional OpenZero server, OpenAI or Groq providers.
- A truthful automation surface that reports real endpoint reachability and permissions, not invented worker telemetry.
- OS-protected credential storage; insecure Linux fallback storage is refused.
- The matching native ZSEC Shield 0.1.2 selected-folder scanner on every published platform.
- ZMath Secure status for HTTPS/loopback transport, credential storage, and optional Windows BitLocker.
- Redacted diagnostics and consent-based camera/microphone access.
- A visible update control that checks the official stable GitHub release, verifies the platform package against two matching SHA-256 records, and starts the installer only after the user approves.

![ZSEC Shield selected-folder scanning](store/screenshots/02-zsec-shield.png)

## First run

1. Open ZERO ONE and choose OpenZero, ZeroThink, ZMail or CallChat.
2. The default service addresses work without configuration. Add an OpenZero token in Settings only for authenticated copilot requests.
3. Open ZSEC Shield, choose one folder and review the local result. No background scan, deletion, upload or quarantine starts automatically.

## Browser Pilot

Browser Pilot is included in ZERO ONE 7.9.2; there is no browser extension to install for the in-app workflow. Open **Browser Pilot**, navigate its dedicated isolated tab, describe one bounded task, and grant that tab. OpenZero plans one strict action at a time using page labels and structure. Passwords, payment fields, secret inputs, file inputs and CAPTCHA values are never included in the snapshot and cannot be operated by the pilot. Cross-site navigation, personal-data typing and consequential actions pause for an explicit one-time approval. Every run stops after 12 steps and the page overlay has a persistent STOP control.

The optional [OpenZero Tab Pilot for Chrome and Brave](https://chromewebstore.google.com/detail/openzero-tab-pilot/cgaalobjjknalamgchppccbocnhonhbf) remains available for people who want governed control in an existing external browser. Browsers deliberately require the user or an administrator to approve extension installation; ZERO ONE does not bypass that platform security boundary.

## Updates

ZERO ONE checks the official stable GitHub release shortly after launch, every six hours while open, and whenever **Settings → Check for updates** is pressed. An available compatible package can be installed with **Install verified update**. ZERO ONE requires an exact platform filename, official repository download URL, declared byte size, GitHub SHA-256 asset digest and a matching entry in `SHA256SUMS.txt`; it downloads to a private temporary file and refuses installation if any check differs. On Windows the verified one-click installer preserves the current user's settings, sessions and downloaded model data.

## OpenZero: Local or Server

For most people, **Local** is the recommended mode. ZERO ONE connects to [Ollama](https://ollama.com/download) on this computer at its loopback API and recommends the behavior-tested `OpenZero-Gemma4-E2B-Agentic-Q4_K_M` model for lightweight everyday chat (`hf.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF:Q4_K_M`). The GGUF is approximately 3.4 GB and is run with thinking disabled for responsive chat. Prompts and responses stay between ZERO ONE and the local Ollama process unless the user deliberately opens or connects another service. Ollama is a separate runtime and model readiness must complete before local chat can work. See the official [Ollama quickstart](https://docs.ollama.com/quickstart), [chat API documentation](https://docs.ollama.com/api/chat), and the [verified OpenZero Gemma E2B model card](https://huggingface.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF).

The model selector also offers the OpenZero Ministral 8B runtime edition for capable computers and legacy Gemma E4B compatibility. The rejected Fusion and Qwen3 1.7B releases are deliberately excluded from ZERO ONE local chat after response-quality testing. These are explicit choices: ZERO ONE does not silently replace a user-selected custom model.

**Server** is the advanced mode for someone who already operates an OpenZero server. It requires that server's HTTPS address and desktop credential. Server mode uses the runtime model reported by that server—currently the OpenZero Ministral 8B runtime edition in the standard deployment—and can expose the orchestration, tools, skills and governed automation implemented by that OpenZero deployment. The server model setting is separate from the lightweight local Assistant selection.

OpenZero is the agent runtime; ZERO ONE is the desktop command centre. A current OpenZero server can expose its **Recursive Lab** through ZERO ONE: Agent Zero stages source changes in a persistent isolated workspace, shows exact diffs, runs only operator-approved test profiles, and requires a fresh confirmation before atomic promotion or rollback. Direct local Ollama chat does not gain filesystem or self-modification authority.

The distinction matters: direct local Ollama mode provides private **model chat**. It does not by itself reproduce OpenZero's full server orchestration, browser control, tools, multi-step agents or remote skills. ZERO ONE labels the active mode and does not claim those capabilities when only the local model API is connected.

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
