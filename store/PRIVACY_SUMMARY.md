# Privacy summary for store preparation

Status: **disclosure draft, not a published privacy policy or legal advice**

## Desktop processing verified from source

| Data or capability | Desktop behaviour | Disclosure treatment |
|---|---|---|
| Service URLs/preferences | Stored in OS app data; current uninstaller preserves app data | Explain persistence, in-app clearing, retention and deletion |
| OpenZero API token | Saved only with secure OS credential encryption; Linux `basic_text` is rejected | Sensitive credential; excluded from diagnostics/screenshots |
| Connected-service sessions | Separate persistent Electron partitions retain cookies/cache/auth/site storage across restarts | Audit and disclose each remote service; isolation is not no collection; in-app clear-data removes all four partitions |
| Automatic service probes | Four configured URLs receive a `GET` on launch and every 30 seconds while the interface is mounted; also on manual refresh and before diagnostics export | Disclose destination-service receipt of network/request metadata, redirects, 6.5-second timeout and `ZERO-ONE/<version>` user agent |
| OpenZero prompts/responses | Sent to the user-selected allowed local/public destination | Disclose destination and service handling |
| Camera/microphone | Disabled by default; exact CallChat origin after opt-in and OS permission | Explain purpose, revocation and CallChat handling |
| Diagnostics | User-initiated JSON: time; app version/platform; OS release, logical cores, total memory; service name/state/status/latency/origin/fixed offline message; origins, three booleans and a fixed privacy notice | Excludes OS hostname, secret value, URL path/query/fragment, cookies and content; user chooses destination and retention; verify final signed binary |
| ZSEC status | Aggregate local summary from bundled-or-installed runtime | No file/path/hash/sample upload in reviewed status bridge |
| ZSEC selected-folder scan | OS folder picker, then fixed runtime with chosen path and bounded arguments | No background scan, upload, automatic deletion or quarantine; verify signed package/network trace before absolute claim |
| ZSEC scan report | Runtime processes the explicitly selected folder; CLI report may contain paths, hashes, matches and errors | Desktop renderer receives aggregate counts; disclose local retention/quarantine policy |
| Rule updates | Preview has zero production trust keys | Do not claim an active signed production update channel |
| Clear data/uninstall | Confirmed clear-data removes settings/token and four partitions, then restarts; uninstall removes program files/shortcuts but has `deleteAppDataOnUninstall: false` | State that server-side accounts, ZSEC state, saved diagnostics and uninstaller-preserved app data require separate handling |

## Store answers that remain unresolved

Do not select "no data collected" merely because the shell does not merge credentials. The app presents authenticated remote services that may transmit and retain email, chat, call, account, diagnostic, prompt, model-response or device/network data. Audit ZMail, ZeroThink, OpenZero and CallChat, including production SDKs and server logs, before answering Microsoft or Apple privacy questions.

Determine for each data type whether it leaves the device, retention, purpose, account linkage, tracking use, controller/processor, user rights and deletion/export controls.

## Public policy requirements

The live policy at `https://talktoai.org/privacy` must be reconciled with the exact final signed build and must:

- identify the publisher and working privacy contact;
- enumerate desktop-local data and every connected-service boundary;
- explain cookies/session partitions, purposes, recipients, retention and deletion;
- explain automatic 30-second probes and the request metadata destinations can receive;
- explain media permission and OpenZero local versus public destinations;
- explain that scanning requires explicit user action and one-folder selection;
- explain local ZSEC reports, quarantine, rule-update state and deletion;
- state whether crash reporting, analytics, cloud lookup or sample submission exists;
- link the actual service-specific policies;
- carry an effective date and be reachable without login.

## Evidence needed before portal answers

- Exact signed build hash/version and publisher identity
- Production configuration/default URLs
- Dependency/SDK and network-endpoint inventory
- Connected-service privacy policies and retention schedules
- Clean-profile network capture for every screen and opt-in flow
- Diagnostics and ZSEC schema/deletion tests
- Clear-data and uninstall-retention tests against the exact final signed installer
- Verified in-app privacy link and legal review

Store submission remains blocked on trusted signing, an approved EULA/customer licence, AI safety/governance, and exact final signed-candidate privacy and deletion testing.