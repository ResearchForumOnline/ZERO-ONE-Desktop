# ZERO ONE 7.9.2

- Adds Browser Pilot directly inside ZERO ONE. It controls only the isolated tab the user grants, works through OpenZero's dedicated browser planner, and never needs a silently installed browser extension.
- Sends compact page structure and labels to the planner without form values; blocks password, payment, secret, file and CAPTCHA controls.
- Pauses cross-site navigation, personal-data entry and consequential actions for explicit one-time approval, includes an in-page STOP control, and ends every run at a 12-step safety limit.
- Keeps the optional Chrome/Brave OpenZero Tab Pilot as a separate user-approved extension for external-browser workflows.
- Upgrades the visible Settings update control into a verified one-click path. ZERO ONE accepts only an exact official stable-release package whose GitHub asset digest, `SHA256SUMS.txt`, declared size and downloaded bytes all agree.
- Starts the verified Windows one-click installer only after confirmation and preserves existing settings, isolated workspace sessions and model data across the upgrade.
- Preserves model separation: OpenZero Gemma4 E2B remains the recommended lightweight local Assistant, OpenZero Ministral 8B remains the full OpenZero server default, and the quality-rejected Fusion model stays blocked.
- Adds unit and source-contract coverage for browser action boundaries, secret-field exclusions, tab partition isolation, blocked downloads and verified update supply-chain checks.

Packages remain unsigned public previews until Authenticode, Apple notarization and Linux repository signing are available. Windows SmartScreen or macOS Gatekeeper may warn. Download only from the authenticated GitHub release; the in-app updater verifies integrity but does not create a publisher signature.

Browser Pilot is governed browser assistance, not unrestricted autonomy. It cannot bypass authentication, CAPTCHA, payment, secret-entry or operating-system permissions, and it does not silently submit or publish consequential changes.
