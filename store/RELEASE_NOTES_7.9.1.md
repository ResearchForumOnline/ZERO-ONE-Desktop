# ZERO ONE 7.9.1

- Makes ZMail a first-class workspace: opening Assistant mounts ZMail so inbox actions are available without losing the current view, and the ZMail Home control returns to the mailbox cleanly.
- Keeps the one-time zSign sign-on handoff inside the isolated ZMail session partition and allows only the reviewed zSign origin through the desktop boundary.
- Restricts saved-login injection to ordinary sign-in forms, excluding password-reset, password-change and multi-password forms.
- Limits inbox inspection to the messages already rendered in the ZMail workspace; it does not add background mailbox scraping or automatic sending.
- Fixes the explicit resource-safety action so it unloads every running published OpenZero model plus a currently selected custom local model, while leaving unrelated Ollama workloads alone.
- Preserves model separation: OpenZero Gemma4 E2B Agentic Q4_K_M remains the recommended lightweight local Assistant, and OpenZero Ministral 8B Runtime Agent remains the separate full OpenZero default. The selector blocks the quality-rejected Fusion model and Qwen3 1.7B release.
- Adds regression coverage for the ZMail/zSign partition boundary, login-form exclusions, workspace actions and all-model unload behavior.

Packages remain unsigned public previews until Authenticode, Apple notarization and Linux repository signing are available. Windows SmartScreen or macOS Gatekeeper may warn. Download only from this authenticated GitHub release and verify the package against `SHA256SUMS.txt`.

Direct local Ollama chat generates text on this computer. It cannot independently use OpenZero tools. Full OpenZero, zSign and Tab Pilot remain separately permission-gated surfaces.
