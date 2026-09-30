# ZERO ONE Desktop 8.0.0 Store privacy worksheet

Updated 30 September 2026. This worksheet documents the current Store candidate; it is not a substitute for the public policy at https://researchforumonline.github.io/OpenZero/zero-one-privacy.html.

| Data or capability | Current behavior | Store disclosure treatment |
|---|---|---|
| ZNotes | Titles, text and timestamps stay in an OS-encrypted local notebook; no automatic upload/sync | Describe local retention, secure-storage dependency and confirmed note deletion |
| ZeroThink | Explicitly selected file/ZNote sources and reports stay in session memory; offline retrieval needs no model or network. Optional model mode sends the question and retrieved excerpts only to the chosen provider; no fallback. Reports can be saved to encrypted ZNotes or plaintext Markdown/JSON | Disclose selected-provider processing, source retention, plaintext exports, cancellation limits and absence of automatic web browsing |
| Runtime/preferences | User-configured local/self-hosted OpenZero address, model, Assistant mode and layout saved locally | Explain local application-data storage and clear-data behavior |
| Credentials | OpenZero token and optional OpenAI/Groq keys saved using secure OS encryption; insecure basic_text backend refused | Keys accompany chosen endpoint requests; omitted from renderer settings and exported diagnostics |
| Embedded sessions | OpenZero and Browser Pilot have separate persistent partitions | Cookies/cache/site storage persist; visited sites/runtime have their own network practices |
| Service probes | Only configured OpenZero receives bounded GET on launch, every 30 seconds, manual refresh and diagnostics export | Remote destination receives network/request metadata; redirect following and 6.5-second timeout |
| Assistant | Prompts/recent chat and model settings sent to chosen OpenZero, OpenAI or Groq endpoint | User-selected third-party/self-hosted processing and retention; distinguish local/direct and Store editions |
| Browser Pilot | Granted tab sends task, compact visible page text/title/headings, redacted URLs, interactive metadata, viewport and recent short action history to configured OpenZero planner | Visible text/labels may contain personal data; form values omitted; no guarantee all sensitive page data is redacted |
| Browser action controls | Identified password/payment/secret/file/CAPTCHA fields blocked; personal/consequential/cross-site actions pause; stop/revoke and 12-step limit | Describe bounded tab control and structural detection accurately, rather than claiming unrestricted or infallible computer control |
| Media | Embedded runtime camera/microphone denied | Do not advertise retired calling/media integration |
| ZSEC | User-selected on-demand folder scan; aggregate desktop status; local CLI reports/state can hold paths/hashes/errors | No automatic sample upload, background scanning, deletion/quarantine or real-time protection |
| Diagnostics | User-selected local JSON with app/system statistics, runtime origin, one probe and preference/key-presence flags | Excludes note/page/chat contents and keys; runtime origins may identify a private server; user controls sharing/retention |
| Clear data | Confirmation clears settings/keys, saved logins, OpenZero/pilot partitions and Store-local ZSEC state; retains ZNotes and saved diagnostics | Do not promise note deletion or remote account/provider deletion through this action |
| Uninstall | Direct NSIS preserves app data; final Store-signed uninstall behavior requires Windows verification | Describe only observed installer behavior; no blanket purge promise |

Publisher: QUANTUMENCRYPTION1 LTD. Product: ZERO ONE Desktop, Store ID 9PMPR7PTW025, candidate 8.0.0.0. The current privacy URL is the product-specific URL above. Support/reporting links and their public practices need to remain reachable without login.

Do not answer "no data leaves the device" for workflows using a remote runtime/provider or Browser Pilot. Local notes are not automatically sent to Assistant, but user-copied text can leave the device in a chosen prompt/task. Separate app-local processing from optional remote processing and ordinary navigation to websites.

Store package identity, candidate hash, local checks and packaged notes smoke evidence are recorded in RELEASE_NOTES_8.0.0.md. Microsoft upload, certification, Store signing and public publication are separate outcomes. Older listing text and signing warnings for obsolete EXE/MSI routes should not be used as current MSIX privacy answers.
