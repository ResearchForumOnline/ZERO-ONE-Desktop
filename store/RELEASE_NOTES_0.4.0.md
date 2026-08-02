# ZERO ONE 0.4.0 — installable preview

ZERO ONE now has direct packages for non-technical users:

- **Windows 10/11 x64:** one-click NSIS installer (`.exe`)
- **macOS Apple silicon:** drag-to-Applications disk image (`.dmg`) plus portable archive (`.zip`)
- **Linux x64:** AppImage and Debian/Ubuntu package (`.deb`)

All three builds bundle the matching immutable ZSEC Shield 0.1.2 on-demand scanner and expose the same isolated OpenZero, ZeroThink, ZMail and CallChat workspaces.

## Important preview trust notice

These packages are **not yet publisher-signed or Store-approved**. Windows SmartScreen and macOS Gatekeeper may therefore show an unknown-publisher warning. Verify the file against `SHA256SUMS.txt`, download only from this authenticated GitHub release, keep your operating system's built-in protection enabled, and test before wider deployment.

ZSEC Shield is deterministic, on-demand scanning—not certified antivirus, real-time interception or guaranteed malware prevention. ZERO ONE uses established TLS and operating-system credential protection; unpublished experimental ZMath cipher research is not embedded.

## First run

1. Install the package for your platform.
2. Open ZERO ONE and choose a workspace.
3. Use Settings only if you want to connect a local OpenZero token or change approved service endpoints.

See [the website](https://talktoai.org/ZeroOne/), [privacy details](https://talktoai.org/privacy) and [security architecture](https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/blob/main/docs/SECURITY_ARCHITECTURE.md).
