# ZERO ONE 0.6.4

This release keeps opened workspaces alive while you move between OpenZero, ZeroThink, ZMail and CallChat, so switching services no longer destroys the current page state or signs users out unnecessarily.

## What changed

- Opened service workspaces remain mounted and keep their navigation, scroll and session state while switching.
- The sidebar clearly indicates which workspaces are already open.
- Saved-login behavior is explicit and restricted to secure operating-system credential storage.
- Session cookies follow each service's own expiry and logout policy.
- A non-blocking update notice helps users reach newer verified GitHub releases.
- The local development dependency advisory for `nanoid` is resolved.
- Download wording and checksums now distinguish available installers, sideloaded Android builds and package-manager work still awaiting publication.

## Packages

- Windows 10/11 x64 installer
- macOS Apple silicon DMG and ZIP
- Linux x64 AppImage and Debian/Ubuntu DEB

Windows Authenticode and Apple notarization depend on release signing credentials. Verify downloads with the published `SHA256SUMS.txt` file.
