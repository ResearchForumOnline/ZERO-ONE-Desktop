# ZERO ONE 0.6.5

This release completes the OpenZero and Tab Pilot connection path:

- fixes ZERO ONE local pairing to use OpenZero's real `/api/openzero/key` endpoint;
- adds a direct, allowlisted Chrome Web Store button for OpenZero Tab Pilot;
- keeps Tab Pilot browser authority separate from the full Assistant API credential;
- retains persistent mounted workspaces when switching between OpenZero, ZeroThink, ZMail and CallChat;
- preserves consent-first login assistance and server-controlled session expiry;
- includes the responsive scrolling, ZSEC clarity, tray and update-notification improvements from the current desktop line.

Packages are unsigned until Authenticode and Apple notarization are configured. Verify `SHA256SUMS.txt` before installing.
