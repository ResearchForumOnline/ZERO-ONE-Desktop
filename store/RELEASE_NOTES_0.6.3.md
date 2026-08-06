# ZERO ONE 0.6.3

Stay signed in. This release fixes the desktop logout-on-close behavior users hit with ZeroThink and ZMail, hardens Windows packaging so version bumps cannot break CI again, and ships encrypted saved logins for workspace forms.

## Stay signed in (ZeroThink + ZMail)

- **ZeroThink**: PHP session cookies are stored with a 30-day expiry (not browser session cookies). On launch, ZERO ONE restores from partition cookies first, then the encrypted device token.
- **ZMail**: Keep-alive still runs while the app is open; session cookies are rewritten to multi-week cookies so closing the app does not wipe the login.
- Quit path flushes all workspace partition cookies to disk before exit.
- Warm restore of ZeroThink and ZMail starts a few seconds after launch, before you open those tabs.

## Saved workspace logins (autofill)

- When you submit a ZMail (or allowed workspace) login form inside ZERO ONE, the username and password are stored on this PC using Windows DPAPI via Electron `safeStorage` when available.
- Next visit autofills the form automatically.
- Settings → **Saved logins on this PC** lists usernames (never passwords), with remove / clear-all controls.
- Clearing desktop data also clears saved logins.
- Credentials are not written into console logs; the page only signals the main process, which reads a short-lived in-page payload.

## Packaging / CI integrity (Windows)

- Root cause of recent GitHub **package-windows** failures: hard-coded `0.6.1` / `0.6.2` pins in `beforePack` and staging scripts lagging `package.json`.
- `beforePack` now reads `consumer_version` from `vendor/zsec-shield.lock.json` and compares it to the app version (no hard-coded app version string).
- Windows ZSEC staging asserts lock `consumer_version` equals `package.json` version dynamically.
- Native ZSEC provenance `consumerVersion` is taken from `package.json` at stage time and verified the same way.

## Usability copy

- ZeroThink banner and welcome text explain “sign in once, stay signed in on this PC” in plain language.
- ZMail workspace banner documents remember-login + keep-alive clearly.

## Platforms

Same targets as 0.6.2:

- Windows 10/11 x64 installer
- macOS Apple-silicon DMG and ZIP
- Linux x64 AppImage and Debian/Ubuntu package

Packages remain unsigned public builds. Verify downloads with `SHA256SUMS.txt` when a release is published.
