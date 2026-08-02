# Store metadata and asset matrix

Status terms: **Present** means the repository contains a usable source item; **Draft** means text is prepared but must be reconciled with the release binary; **Missing** means an artifact or decision must be created; **Portal** means the value cannot be completed safely outside the publisher account.

## Identity and listing text

| Field | Microsoft Store — current MSI/EXE route | Apple — direct Mac / Mac App Store | Linux direct / AppStream | ZERO ONE status |
|---|---|---|---|---|
| Product name | Select a name already reserved in Partner Center | 2–30 characters in App Store Connect | AppStream `<name>` | **Draft:** `ZERO ONE`; reservation/availability is **Portal** |
| Publisher | Partner Center verified publisher and signing subject must be consistent | Apple developer seller identity | Package maintainer/vendor | **Present in package:** `QUANTUMENCRYPTION1 LTD`; account/signing match is **Portal** |
| Product identifier | Partner Center identity; EXE package URL/version configured separately | Bundle ID must match the uploaded build | Reverse-DNS desktop/AppStream ID | **Draft:** `org.talktoai.zeroone`; Microsoft identity is **Portal** |
| Version | Installer controls Win32 version | Build version and version string in uploaded binary | Package/AppStream release version | **Present in source:** `0.4.0`; final signed-artifact consistency is **Missing** |
| Category | Choose the closest Partner Center category | Primary category should match the build; current build declares Productivity | Valid desktop/AppStream category | **Draft:** Productivity; Linux package currently declares Utility |
| Short text | Short description optional, max 1,000 characters | Subtitle max 30 characters | One-sentence AppStream summary | **Draft:** see `LISTING_COPY.md` |
| Long description | Required, max 10,000 characters | Required, plain text, max 4,000 characters | AppStream description; Flathub recommends concise readable prose | **Draft:** see `LISTING_COPY.md` |
| Feature list | Up to 20; max 200 characters each | No equivalent separate feature list | May be represented in description/keywords | **Draft:** six verified features supplied |
| Keywords | Up to 7; max 40 characters each; no more than 21 unique words total | Required; max 100 bytes; do not duplicate app/company names or use other app/company names | AppStream `<keywords>` | **Draft:** channel-specific sets supplied |
| Release notes | “What’s new” max 1,500 characters | Not available for first version; later versions require up to 4,000 characters | AppStream `<release>` description / direct release notes | **Draft:** preview-candidate wording only; update per exact build |
| Copyright | Optional Store field, max 200 characters | Required; year followed by rights holder, with Apple adding the symbol | Package copyright/MetaInfo | **Draft:** `2026 QUANTUMENCRYPTION1 LTD`; legal approval required |
| Licence/EULA | Applicable licence terms required, max 10,000 characters | Apple standard EULA or approved custom EULA | Licence must permit the intended distribution and match package/MetaInfo | **Blocked:** `EULA_DRAFT.md` is non-operative legal-review text only; no approved/public customer licence |
| Age/content rating | Complete current Partner Center questionnaire accurately | Age rating required | Distribution-specific rating/content fields | **Portal:** do not infer a rating |
| Pricing/availability | Choose in Partner Center | Agreements, tax, price, territories in App Store Connect | Repository/site policy | **Portal:** no choice is recorded here |
| Support URL | Stable reachable support page strongly required for a reviewable product | Required and must expose real contact information | AppStream `<url type="help">` / package homepage | **Missing:** `[SUPPORT_URL]`; the AI-output report route is not a general support page |
| Privacy URL | Required where the app accesses/transmits personal information; required by this release boundary | Required for macOS; App Privacy answers also required | Strongly recommended and required by some repositories | **Present live:** `https://talktoai.org/privacy`; exact signed-build reconciliation and legal approval remain pending |
| Marketing/homepage URL | Store field where offered | Optional marketing URL | AppStream homepage URL | **Missing:** `[PRODUCT_URL]` |
| Reviewer access | Working demo accounts and functional servers when login is required | Non-expiring demo credentials, review contact and notes | Reproducible test instructions | **Missing:** separate least-privilege accounts for each connected service |

## Package and compliance evidence

| Evidence | Microsoft Store | Apple | Linux direct / Flathub | ZERO ONE status |
|---|---|---|---|---|
| Native build | Windows x64 NSIS preview | macOS arm64 DMG/ZIP preview | Linux x64 AppImage/DEB preview | Native CI and matching ZSEC payload verification configured; publisher signing and Store evidence remain missing |
| Signature | Installer and every shipped PE trusted-signed for MSI/EXE route | Sign all code/helpers, hardened runtime, notarize and staple direct build | Sign artifacts and DEB repository metadata | **Missing on all release channels** |
| Immutable delivery | Version-specific HTTPS installer URL; submitted bytes must never change | Notarized immutable DMG/ZIP or App Store upload | Versioned artifacts, hashes, signed repository metadata | **Missing** |
| Install behaviour | Silent standalone installer; verify install, launch, uninstall and update | Gatekeeper/notarization and clean-machine tests | Package-manager/AppImage install, update and removal tests | Prior unsigned x64 install/uninstall evidence exists; final signed candidate, clean VM, update and rollback remain pending; uninstall preserves app data by configuration |
| Accessibility | Keyboard, Narrator, 200% scaling, High Contrast | Keyboard, VoiceOver, Larger Text/contrast/reduced motion claims only after testing | Keyboard, scaling and Orca where supported | **Missing test record** |
| Privacy answers | Policy URL and accurate personal-data disclosure | Include app and integrated third-party/service practices | Published policy plus package permissions | **Blocked pending connected-service audit** |
| Third-party rights | Matrix/Element and all embedded-service names/assets reviewed | Same; Apple requires rights to third-party content | Licence/redistribution metadata must match | **Blocked pending rights review** |
| ZSEC runtime | Bundle/sign/test every PE and the versioned scan/status contracts | Sign every bundled helper; MAS needs a self-contained sandbox-safe selected-folder design | Use matching native payloads and document permissions/update ownership | Exact Windows x86_64 upstream payload verified but unsigned; release needs a separate authenticated upstream-to-post-sign manifest; other targets are not configured |
| ZSEC rules | Disclose exact on-demand limitation and production definition state | Same; no EndpointSecurity/real-time claim | Same | Zero bundled production trust keys; production signed-feed channel not commissioned |
| Live generative AI | Reporting route plus generated-content compliance, safety, governance and review evidence | App Review safety/content rules and reporting/support controls | Channel-specific safety and reporting requirements | Visible `https://talktoai.org/report-ai/` route is present; safety/governance and final-production abuse testing are **Blocked** |
| Review notes | Explain accounts, network dependency, optional ZSEC state, and no AV claim | Same plus exact Mac behaviour and demo access | Installation and limitation notes | **Draft:** see `SUBMISSION_CHECKLIST.md` |

## Visual assets

| Asset | Microsoft | Apple | Linux direct / AppStream | Status |
|---|---|---|---|---|
| Base icon | Separate Store logo required for MSI/EXE; package assets depend on route | Current HIG layout size is 1024×1024; direct Electron release should use reviewed `.icns`/native icon output | Prefer SVG; otherwise at least 256×256 PNG for Flathub | Only 1000×1000 ARGB PNG exists; **insufficient as final set** |
| Main Store logo | 300×300 PNG, under 50 MB | Extracted from uploaded build | Installed desktop icon named to match app ID | **Missing** |
| Poster/promotional art | 2:3 poster recommended; 720×1080 or 1440×2160; optional 16:9 promotional art where offered | Optional app preview; no poster requirement for Mac listing | Optional website/repository hero | **Missing** |
| Screenshots | 1 required; 4 recommended; max 10 desktop PNGs, at least 1366×768 | 1–10 images, no alpha; Mac uses accepted 16:10 size | AppStream captures/captions; first is default | Two 1366×768 Windows preview captures meet Microsoft minimum dimensions; exact signed-candidate and macOS/Linux captures remain |
| Captions | Up to 200 characters each | Product-page copy must match capture; captions are not a separate Mac field | One concise sentence per screenshot, no final full stop recommended by Flathub | **Draft:** see `SCREENSHOT_REQUIREMENTS.md` |

## Channel decision

1. **Microsoft Store:** current closest route is a Store-listed signed NSIS EXE. Submission remains blocked on trusted signing, an approved EULA/customer licence, AI safety/governance, the separate post-sign ZSEC manifest, and exact final signed-candidate testing. MSIX remains preferable but is not configured.
2. **macOS:** ship a Developer ID-signed and notarized direct DMG first. Do not treat the current DMG definition as a Mac App Store build; no MAS target or App Sandbox design is present.
3. **Linux:** direct signed AppImage and DEB are the credible first route. Do not prepare or submit a Flathub pull request from this work: Flathub’s current policy disallows AI-generated or AI-assisted application/submission content absent an exception, and the current `UNLICENSED` state is also unresolved.

## Sources checked 2026-08-02

- [Microsoft MSI/EXE submission fields](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/create-app-submission)
- [Microsoft listing images](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/pwa/screenshots-and-images)
- [Apple app information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- [Apple version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple app icon guidance](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Flathub requirements](https://docs.flathub.org/docs/for-app-authors/requirements)
- [Flathub MetaInfo quality guidance](https://docs.flathub.org/docs/for-app-authors/metainfo-guidelines/quality-guidelines)

