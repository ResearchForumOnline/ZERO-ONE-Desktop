# ZERO ONE 0.6.1

ZERO ONE 0.6.1 is the first stable cross-platform release of the unified desktop command centre.

## Fixed interface and scrolling

- Restores reliable page scrolling at compact window sizes, high interface zoom and short desktop resolutions.
- Uses one explicit native-page scroll surface with a visible Chromium scrollbar.
- Prevents unused responsive grid rows from covering or cutting off application content.
- Preserves embedded-workspace scrolling separately from ZERO ONE navigation.

## A useful, honest ZSEC workspace

- Adds one clear **Choose folder and scan** action backed by the bundled deterministic ZSEC scanner.
- Adds **Protection at a glance**, separating ZSEC on-demand scanning from operating-system-owned live protection.
- Shows verified engine, rule-feed, last-check, scan-error and evidence counters.
- Explains the automatic safety defaults: local-only scanning, no upload, and no automatic deletion or quarantine.
- Scanner animation now runs only while a user-requested scan is actually running.
- Keeps the security boundary explicit: ZSEC 0.1.2 is an on-demand companion, not certified real-time antivirus.

## OpenZero and local assistance

- Opens the configured full OpenZero panel inside ZERO ONE.
- Clearly separates the quick Assistant, full OpenZero workspace and Brave Tab Pilot.
- Uses Qwen 3 1.7B as the responsive local first-run model; larger branded models remain optional.
- Supports secure desktop-token pairing for OpenZero servers.

## Desktop usability

- Minimises to the system tray when configured.
- Includes interface zoom controls and compact responsive layouts.
- Improves ZeroThink desktop sign-in, loading recovery and workspace navigation.

## Platforms

- Windows 10/11 x64 installer.
- macOS Apple-silicon DMG and ZIP.
- Linux x64 AppImage and Debian/Ubuntu package.

Packages remain unsigned. Windows SmartScreen or macOS Gatekeeper may display an unknown-publisher warning. Verify downloads using the included `SHA256SUMS.txt`.
