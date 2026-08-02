# Screenshot and visual-asset requirements

Two reviewed 1280×720 Windows preview captures exist in store/screenshots/; they document UI quality but are below Microsoft's 1366×768 minimum and are not portal-ready. Capture final assets only from the exact signed candidate on its target operating system. Do not use Windows captures to represent macOS or Linux.

## Capture set

Use realistic synthetic/demo content with no personal mail, names, addresses, tokens, server details, private prompts, cookies, notifications or credentials.

| Order | Screen | Evidence shown | Caption draft |
|---:|---|---|---|
| 1 | Command center | Four connected workspaces plus optional ZSEC entry | Your connected workspaces in one command center |
| 2 | OpenZero workspace/coplay panel | Configured local-model destination and bounded chat surface | Work with the OpenZero model destination you choose |
| 3 | ZSEC Shield scan | Folder-selection workflow or completed synthetic test scan plus explicit limitation boundary | Choose one folder for an explicit on-demand security scan |
| 4 | Settings | Visible service destinations, media off by default, secure-token explanation | Control service destinations, media access and local preferences |
| 5 | Diagnostics flow | User-initiated export and redaction explanation, if the release UI visibly supports it | Export bounded diagnostics without message or credential content |

Do not capture a “protected,” clean, zero-findings or signed-definition state unless the exact packaged ZSEC runtime contract, selected synthetic folder and test fixture prove it. Do not expose the selected local path. Do not show unavailable connected services as online.

## Microsoft Store desktop

- Format: PNG
- Minimum: 1 screenshot
- Recommended: at least 4
- Maximum: 10 desktop screenshots
- Dimensions: 1366×768 or larger; 3840×2160 supported
- Orientation: landscape or portrait
- Maximum file size: 50 MB each
- Caption: up to 200 characters
- Composition: keep essential UI/text in the top three quarters because Store overlays may cover the bottom quarter
- Separate Store logo: 300×300 PNG, under 50 MB
- Recommended poster: 720×1080 or 1440×2160 PNG

Recommended capture size for this app: **1920×1080**, with Windows scaling at 100% and again at 200% for accessibility evidence. The 200% image is test evidence, not necessarily a listing screenshot.

## Apple macOS

- Count: 1–10 screenshots
- Formats: JPEG, JPG or PNG
- Alpha/transparency: not permitted
- Aspect ratio: 16:10
- Accepted Mac sizes: 1280×800, 1440×900, 2560×1600 or 2880×1800
- Use one consistent size across the listing/localizations
- Capture the signed/notarized or MAS candidate on macOS with native window chrome
- Current app icon source is 1000×1000; create/review the current Apple 1024×1024 icon layout and native `.icns`/Icon Composer output rather than upscaling blindly

Recommended capture size: **2880×1800**, exported without alpha. Confirm legibility after App Store downscaling.

## Linux direct / AppStream

- Capture the Linux build with the target desktop theme and window decoration
- Flathub quality guidance recommends a window at 1000×700 or smaller, or 2000×1400 for HiDPI, so text remains legible when reduced
- Put the best screenshot first and mark it as the default in MetaInfo
- Add one concise sentence caption per screenshot; Flathub recommends no final full stop
- Host final images on stable HTTPS URLs if referenced by AppStream metadata
- Provide a properly named installed SVG icon, or at least a 256×256 PNG

Do not submit to Flathub from this work. Its current AI-content policy and the unresolved `UNLICENSED` state require a separate eligibility decision.

## File naming

```text
store/assets/microsoft/01-command-center-1920x1080.png
store/assets/microsoft/02-openzero-1920x1080.png
store/assets/microsoft/03-zsec-status-1920x1080.png
store/assets/microsoft/04-settings-1920x1080.png
store/assets/apple/01-command-center-2880x1800.png
store/assets/apple/02-openzero-2880x1800.png
store/assets/apple/03-zsec-status-2880x1800.png
store/assets/apple/04-settings-2880x1800.png
store/assets/linux/01-command-center-2000x1400.png
store/assets/linux/02-openzero-2000x1400.png
store/assets/linux/03-zsec-status-2000x1400.png
store/assets/linux/04-settings-2000x1400.png
```

## Visual QA record

For each image retain: app version, artifact SHA-256, OS/build, architecture, display scaling, window size, demo-data source, capture date, reviewer, and confirmation that no private data or unsupported claims are visible.

## Sources checked 2026-08-02

- [Microsoft screenshots and images](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/pwa/screenshots-and-images)
- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple app icon guidance](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Flathub MetaInfo quality guidelines](https://docs.flathub.org/docs/for-app-authors/metainfo-guidelines/quality-guidelines)

