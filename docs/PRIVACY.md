# ZERO ONE privacy boundary

This document describes the reviewed desktop source boundary. Store answers and public promises must still be reconciled with the exact signed binary and the live data practices of every connected service.

## Local desktop data

ZERO ONE stores user-chosen service URLs, model alias, media preference, and launch-at-login preference in its operating-system application-data directory. An OpenZero API token is stored only when secure operating-system encryption is available. The app rejects Linux `basic_text` fallback storage.

The desktop does not merge service credentials. ZMail, ZeroThink, OpenZero, CallChat, and the built-in Browser Pilot keep separate persistent Electron partitions and remain governed by their own account, server, cookie, content, logging, retention, and privacy behavior. Those partitions retain cookies, cache, authentication state, and site storage across app restarts.

On launch and every 30 seconds while the main interface is mounted, the desktop sends one bounded HTTP `GET` probe to each configured ZMail, ZeroThink, OpenZero, and CallChat URL. A manual refresh and a diagnostics export also run the four probes. Each request follows redirects, uses a `ZERO-ONE/<version>` user agent, and times out after 6.5 seconds. The destination service can therefore receive the user's network address and request metadata even if its workspace is not opened.

Camera and microphone are denied by default. When the user explicitly enables CallChat media, permission is limited to the exact CallChat HTTPS origin. Other embedded services remain denied.

## Browser Pilot

Browser Pilot is off until the user opens its dedicated workspace, describes one bounded task and grants that exact isolated tab. The page-side bridge builds a compact snapshot of visible page text, headings and interactive-control metadata. It omits input, textarea, select and editable-region values; removes URL queries and fragments; redacts long token-like path segments; does not return passwords, payment details, secret fields, file selections or CAPTCHA values; and sends the bounded snapshot only to the configured OpenZero endpoint. A remote OpenZero endpoint therefore receives this page context under that server's own logging, retention and privacy practices.

The pilot does not persist snapshots or task history to disk. The main process retains only the current in-memory run, at most eight short step results and the pending approval preview. A run ends when it finishes, is stopped, errors, reaches 12 steps, the workspace is left, or the app closes. Browser cookies and site storage in the dedicated pilot partition persist until the user invokes Clear desktop data.

## ZSEC selected-folder scans

The Windows x64 package bundles ZSEC Shield 0.1.2 from an immutable public release. The user must press the scan button and choose exactly one folder through the operating-system picker. The desktop invokes a fixed runtime with bounded arguments. It does not start background scanning, sample upload, automatic deletion, or automatic quarantine.

The trusted renderer receives only aggregate outcome, files/bytes read, configured-rule match count, error count, engine/definition labels, scan timestamp, and quarantine count. Local ZSEC CLI reports may contain paths, hashes, matches, and operational errors; those reports stay under the user's local ZSEC state directory unless the user separately shares them.

The bundle declares on-demand mode, no telemetry, no real-time protection, and zero production feed trust keys. Before any cloud lookup, telemetry, crash reporting, sample submission, or signed definition feed is activated, disclosure, consent, retention, and deletion controls must be updated first.

## Diagnostics and AI output

Diagnostics export is user-initiated. The JSON contains its generation time; app version and platform; operating-system release, logical-core count, and total memory bytes; and, for each of the four service probes, the service name, state, HTTP status, latency, and origin. An offline probe can also contain the fixed message `Timed out` or `Unavailable`. It records the configured service origins, media-enabled and launch-at-login booleans, and whether an OpenZero token exists.

The export excludes the operating-system hostname, API-token value, URL credentials, URL paths, queries and fragments, cookies, mail, notes, chat/call content, prompts, and model responses. The user chooses the local JSON destination and controls how long that saved file is retained. ZERO ONE does not automatically upload or delete it. This schema and redaction boundary must be reconfirmed against the final signed package.

OpenZero model requests go to the user-configured allowed OpenZero endpoint. ZERO ONE does not automatically send model output as mail, chat, calls, or reports. The current interface links visibly to `https://talktoai.org/report-ai/`; users should not include passwords, tokens, private prompts, or unrelated personal data in a report. Reporting is one control only and does not replace model/output safety, moderation, governance, incident response, and policy-compliance testing required before Store submission.

## Retention and deletion

`Clear desktop data` requires confirmation, clears storage, cache, and authentication cache for all five persistent service partitions, deletes the local settings file and encrypted OpenZero token, disables launch at login, and restarts ZERO ONE. It does not delete connected-service accounts or server-side data, ZSEC state/reports, or diagnostics JSON files the user saved elsewhere.

The current NSIS configuration deliberately uses `deleteAppDataOnUninstall: false`. Uninstall removes program files and shortcuts but does not promise removal of ZERO ONE application data, service partitions, settings, or the encrypted token. Users should use `Clear desktop data` before uninstalling when they want those desktop-held settings and sessions removed. Final Store disclosures and uninstall testing must match the exact signed installer.

## Platform limits

ZERO ONE 7.9.2 publishes preview packages for Windows 10/11 x64, macOS Apple silicon and Linux x64. Each package carries the matching native ZSEC Shield runtime. Linux refuses to save an OpenZero token when Electron exposes only the insecure `basic_text` backend. Windows arm64 and Intel macOS are not published targets.

The packages are not yet publisher-signed, notarized or Store-approved. Distribution status does not change the data-handling boundary described above.

## Public policy gate

The public policy target is `https://talktoai.org/privacy`. Before Store submission it must explicitly cover ZERO ONE Desktop, connected ZMail/ZeroThink/OpenZero/CallChat surfaces, local ZSEC selected-folder processing, support/reporting contacts, controller identity, user rights, retention/deletion ownership, processors, transfers, and the exact production build. Do not select “no data collected” merely because the desktop shell itself minimizes data.
