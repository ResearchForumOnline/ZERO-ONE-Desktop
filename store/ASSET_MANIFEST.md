# Store asset manifest

## Existing source asset

| Path | Dimensions | Format | Pixel format | Release use |
|---|---:|---|---|---|
| `assets/zero-one-icon.png` | 1000×1000 | PNG | 32-bit ARGB | Source reference only; not an exact Apple 1024×1024 icon and not the separate Microsoft 300×300 Store logo |

The source icon could not be visually inspected through the workspace image viewer because the Windows sandbox image helper failed. Dimensions and pixel format were read from the file. A human visual/design review is therefore still required.

## Required derivatives and captures

| ID | File | Specification | Status |
|---|---|---|---|
| MS-ICON-01 | `store/assets/microsoft/store-logo-300.png` | 300×300 PNG, under 50 MB | Missing |
| MS-ART-01 | `store/assets/microsoft/poster-720x1080.png` | 720×1080 PNG; 1440×2160 alternative | Missing |
| MS-SHOT-01..04 | See `SCREENSHOT_REQUIREMENTS.md` | 1920×1080 PNG proposed; minimum official size 1366×768 | Two reviewed 1280×720 previews exist; final portal captures missing |
| APPLE-ICON-01 | Native Mac app icon source/output | Current guidance uses 1024×1024 layout; reviewed native icon output | Missing |
| APPLE-SHOT-01..04 | See `SCREENSHOT_REQUIREMENTS.md` | 2880×1800 PNG/JPEG proposed, no alpha | Missing |
| LINUX-ICON-01 | `org.talktoai.zeroone.svg` | Preferred SVG, correctly named and installed | Missing |
| LINUX-ICON-02 | `org.talktoai.zeroone.png` | At least 256×256 fallback | Missing |
| LINUX-SHOT-01..04 | See `SCREENSHOT_REQUIREMENTS.md` | 2000×1400 proposed for HiDPI AppStream/website display | Missing |

## Asset production rules

- Return to the original design source; do not treat a blind upsample of the 1000×1000 PNG as an Apple master.
- Preserve a safe zone and test recognition at small sizes.
- Do not add Microsoft, Apple, Matrix, Element or other third-party marks without documented permission.
- Do not place unsupported protection, certification or cross-platform claims in artwork.
- Generate final screenshot and icon checksums and record their source release version.
- Run privacy review on every capture before portal upload.
- Keep localization-specific screenshots and captions paired.

