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

On Windows, the preview package bundles the full ZSEC Shield 0.1.0 x86_64 onedir runtime. The user must press the scan button and choose exactly one folder through the operating-system picker. The desktop invokes the fixed runtime with the selected path and bounded arguments. It does not start a background scan, automatic deletion or automatic quarantine.

The reviewed bridge does not upload file names, paths, hashes, samples or reports. The trusted renderer receives only aggregate counts and a bounded outcome. The bundled runtime manifest declares no telemetry and no real-time protection, but this must still be confirmed against the exact signed package and a clean-profile network trace before an absolute public claim. Local CLI reports may contain paths, hashes, configured-rule matches and operational errors. The separate CLI supports opt-in recoverable quarantine, but the desktop scan button does not request it.

The desktop also reads a bounded local status summary: engine version, platform label, definition label, last-scan timestamp, configured-rule match count and quarantine count. The preview contains no production rule-feed trust key. A future signed definition update channel would download declarative data-only rules; it must not accept commands or scripts and must be added to this disclosure before activation.

macOS, Linux and Windows arm64 runtime/package behaviour has not been host-verified and must not inherit the Windows x64 disclosure without native testing.

Before any cloud lookup, telemetry, crash reporting or sample submission is added, this disclosure, consent flow, retention schedule and deletion controls must be updated first.

## Store disclosure gate

This local draft is not a sufficient Microsoft or Apple privacy URL. The final public policy must also cover the actual data practices of ZMail, ZeroThink, OpenZero and CallChat as reached through the submitted app. Do not select "no data collected" in a store portal until the exact production build, connected services, server retention and integrated partners have been audited.