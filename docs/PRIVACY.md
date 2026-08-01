# ZERO ONE desktop privacy disclosure draft

This draft must be published at a stable public URL and reviewed against the final binaries before store submission.

## Local app data

ZERO ONE stores user-chosen service URLs, model alias, media preference and launch-at-login preference in its operating-system application-data directory. An OpenZero API token is stored only when secure operating-system encryption is available. The app rejects Linux `basic_text` fallback storage.

The local diagnostics export is user-initiated and contains app/platform versions, bounded machine facts, service reachability and non-secret settings. It excludes API tokens, cookies, email, documents, notes, chat/call content, prompts and model responses.

## Connected services

ZMail, ZeroThink, OpenZero Public and CallChat are remote services displayed in isolated webview partitions. Their requests, authentication, cookies and content are handled by those services under their own published privacy terms. ZERO ONE does not merge their credentials or silently transfer content between them.

Local OpenZero requests are sent to the loopback URL selected by the user. If the user changes that URL to an allowlisted public OpenZero origin, prompts and responses follow that selected service boundary; the UI must continue to make that destination visible.

## Camera and microphone

Media is disabled by default. If the user enables it, access is restricted to the exact CallChat HTTPS origin and remains subject to operating-system permission controls.

## ZSEC Shield preview

The desktop reads only a bounded local status summary: engine version, platform label, definition label, last-scan timestamp, configured-rule match count and quarantine count. It does not upload file names, paths, hashes, samples or reports.

The separate ZSEC runtime scans only paths explicitly supplied to its command line in this preview. Its reports may contain local paths, hashes, match metadata and operational errors. Quarantine is opt-in and recoverable. Signed definition updates download declarative data-only rules; they do not accept commands or scripts.

Before any cloud lookup, telemetry, crash reporting or sample submission is added, this disclosure, consent flow, retention schedule and deletion controls must be updated first.
