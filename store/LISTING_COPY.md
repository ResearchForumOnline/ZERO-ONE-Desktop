# ZERO ONE listing copy

Status: **draft — reconcile with the exact signed build and replace all placeholders before portal entry**

## Shared identity

- Product name: `ZERO ONE`
- Publisher: `QUANTUMENCRYPTION1 LTD`
- Version: `0.3.0`
- Suggested category: Productivity
- Secondary Apple category: Utilities
- Privacy URL: `[PRIVACY_URL]`
- Support URL: `[SUPPORT_URL]`
- Product URL: `[PRODUCT_URL]`
- Licence terms: `[EULA_OR_LICENCE_URL]`

## Microsoft Store

### Short description

> A desktop command center for ZMail, ZeroThink, OpenZero and CallChat, with an optional local ZSEC Shield on-demand scan preview.

### Description

> ZERO ONE brings four user-configured workspaces into one desktop command center: ZMail, ZeroThink, OpenZero and CallChat.
>
> Open each service in its own isolated desktop session, check service reachability, work with a configured OpenZero model, and export a bounded local diagnostics report. Camera and microphone access are disabled by default and can be enabled only for the CallChat origin.
>
> On supported Windows builds, you can choose one folder and start an explicit local scan through the bundled ZSEC Shield preview runtime. The panel reports aggregate local results and status without starting a background scan, upload, automatic deletion or automatic quarantine.
>
> Important limitations: the bundled ZSEC preview runtime is currently x86_64, unsigned and has no production rule-feed trust key. ZSEC Shield is not real-time protection or a certified antivirus, and ZERO ONE does not claim complete malware prevention. Remote workspaces require internet access and may require separate service accounts. Their content and account data remain subject to each service's privacy terms.

### Product features

1. Four connected workspaces in one desktop command center
2. Separate persistent sessions for each connected service
3. Local OpenZero reachability and configured-model access
4. Camera and microphone access disabled by default
5. User-initiated diagnostics with secrets and content excluded
6. Explicit local scan after choosing one folder through the operating-system picker

### Keywords

1. `workspace hub`
2. `local models`
3. `communication tools`
4. `research workspace`
5. `mail and chat`
6. `desktop command center`
7. `security scan`

### What's new

> Preview candidate 0.3.0 adds a simpler one-folder ZSEC scan flow, a bundled Windows x86_64 runtime, versioned status/scan contracts, accessibility improvements and hardened desktop boundaries.

## Apple macOS

### Subtitle

> Connected workspace hub

### Promotional text

> Bring configured communication, research, model and chat workspaces together in one privacy-conscious desktop command center.

### Description gate

Use the first two Microsoft-description paragraphs only after a native macOS build confirms them. Add the ZSEC paragraph only if that build contains a matching signed macOS runtime and the selected-folder flow passes native testing; otherwise omit the feature and state that ZSEC scanning is not included. Use a notarized direct download first. Do not submit to App Store Connect until a separate final MAS/App Sandbox build has passed review testing.

### Keywords

> workspace,local models,communication,research,mail,chat,security

### App Review notes draft

> ZERO ONE is a desktop command center for four separately authenticated services. Please use the supplied non-expiring reviewer accounts. The Windows preview includes a bundled on-demand ZSEC runtime. A scan begins only after the reviewer presses the scan control and chooses one folder through the operating-system picker. It does not start background monitoring, automatic deletion or automatic quarantine. Do not apply this claim to macOS until a matching native runtime and sandbox-safe selected-folder flow are verified. Camera and microphone are disabled by default. No purchase is required for review.
>
> Reviewer setup: [EXACT_TEST_STEPS]
>
> Demo credentials: [PRIVATE_PORTAL_FIELD_ONLY]
>
> Contact: [REVIEW_CONTACT]

## Linux direct / AppStream

### AppStream summary

> Desktop command center for connected workspaces and optional local scanning

### AppStream description draft

> ZERO ONE brings ZMail, ZeroThink, OpenZero and CallChat into separate desktop sessions. It provides service reachability, configured OpenZero access, opt-in CallChat media and user-initiated redacted diagnostics. Include the optional selected-folder ZSEC scan description only in packages containing a matching tested native runtime.

### Direct-download release note

> ZERO ONE 0.3.0 adds an explicit selected-folder ZSEC scan preview on supported packages containing a matching native runtime. Use only an artifact built for your architecture and verify its publisher signature and SHA-256 digest.

## Prohibited wording until separately evidenced

Do not use: `antivirus`, `complete protection`, `real-time protection`, `ransomware protection`, `zero-day protection`, `certified`, `Microsoft approved`, `Apple approved`, `telemetry-free`, `zero data collection`, `fully local`, detection percentages, or claims that macOS/Linux packages are available before signed artifacts are published and host-tested.