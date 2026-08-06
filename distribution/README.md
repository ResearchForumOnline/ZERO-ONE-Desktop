# ZERO ONE Desktop — package manager distribution

Version **0.6.3** manifests for **winget**, **Scoop**, and **Chocolatey**.

| Field | Value |
| --- | --- |
| Product | ZERO ONE Desktop |
| Version | 0.6.3 |
| Publisher | QUANTUMENCRYPTION1 LTD / ResearchForumOnline |
| Package ID (winget) | `TalkToAI.ZeroOne` |
| Package ID (Scoop/Chocolatey) | `zero-one` |
| License | Apache-2.0 |
| Homepage | https://talktoai.org/ZeroOne/ |
| Source | https://github.com/ResearchForumOnline/ZERO-ONE-Desktop |
| Installer URL | https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v0.6.3/ZERO-ONE-0.6.3-win-x64.exe |
| SHA256 | `2352DA64394017D93DC6F9B7A486CF0DBD7ED26082EEB37B5CE69F1401A9259B` |
| Installer type | electron-builder NSIS (`oneClick`) |
| Silent switch | `/S` |

SHA256 was computed from the local build:

`C:\Users\Administrator\ZERO-ONE-Desktop\release\ZERO-ONE-0.6.3-win-x64.exe` (110 853 743 bytes).

**Re-hash after any rebuild, re-sign, or re-upload to GitHub Releases before publishing package updates.**

```powershell
Get-FileHash -Algorithm SHA256 .\release\ZERO-ONE-0.6.3-win-x64.exe
```

---

## Layout

```
distribution/
  README.md
  winget/
    TalkToAI.ZeroOne/0.6.3/
      TalkToAI.ZeroOne.yaml
      TalkToAI.ZeroOne.installer.yaml
      TalkToAI.ZeroOne.locale.en-US.yaml
  scoop/
    zero-one.json
  chocolatey/
    zero-one/
      zero-one.nuspec
      tools/
        chocolateyinstall.ps1
        chocolateyuninstall.ps1
```

Alternate winget publisher id (`QUANTUMENCRYPTION1.ZeroOne`) is possible if community review prefers a legal-entity identifier; current choice matches `appId` `org.talktoai.zeroone` and the TalkToAI product site.

---

## 1. Winget (`winget-pkgs`)

### Prerequisites

- GitHub account with CLA accepted for [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)
- Release asset must be **public** at the installer URL
- Installer SHA256 must match the published binary exactly

### Local validation (optional)

```powershell
# Enable local manifest installs (admin once)
winget settings --enable LocalManifestFiles

# Validate multi-file folder
winget validate --manifest .\distribution\winget\TalkToAI.ZeroOne\0.6.3

# Install from local manifests
winget install --manifest .\distribution\winget\TalkToAI.ZeroOne\0.6.3
```

### Submit PR

1. Fork https://github.com/microsoft/winget-pkgs
2. Copy the version folder into the repo path:

   ```
   manifests/t/TalkToAI/ZeroOne/0.6.3/
     TalkToAI.ZeroOne.yaml
     TalkToAI.ZeroOne.installer.yaml
     TalkToAI.ZeroOne.locale.en-US.yaml
   ```

   (First letter of package id → `t` for `TalkToAI`.)

3. Open a PR titled roughly: `New package: TalkToAI.ZeroOne version 0.6.3` (or `Update …` for later versions).
4. Wait for automation (`WinGet-Validate`, download checks). Fix CI comments if the SHA or URL fails.
5. After merge, install with:

   ```powershell
   winget install --id TalkToAI.ZeroOne -e
   ```

### Notes

- Schema used: ManifestVersion **1.9.0** (widely accepted; bump if winget-pkgs CI requests a newer schema).
- Silent install switches: `/S` (Nullsoft / electron-builder NSIS).
- Scope is **user** (typical for electron-builder oneClick NSIS without elevation).

---

## 2. Scoop

Scoop expects a **bucket** (Git repo of JSON manifests). You can use a personal/org bucket or request inclusion in a community bucket.

### Personal / org bucket

1. Create a bucket repo, e.g. `ResearchForumOnline/scoop-bucket`.
2. Commit `distribution/scoop/zero-one.json` as `bucket/zero-one.json` (or repo root per your bucket layout).
3. Users add the bucket and install:

   ```powershell
   scoop bucket add talktoai https://github.com/ResearchForumOnline/scoop-bucket
   scoop install zero-one
   ```

### How this manifest works

- URL uses `#/dl.7z` so Scoop extracts the NSIS installer as a 7-Zip-compatible archive (common Electron pattern). If extraction fails for a future build, switch to an `installer` + `innosetup`/`nsis` style scripted install or ship a portable zip release.
- `checkver` / `autoupdate` track GitHub tags under `ResearchForumOnline/ZERO-ONE-Desktop`.
- After each release, update `hash` (or let `scoop update` + autoupdate tooling recompute).

### Verify hash

```powershell
scoop hash https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v0.6.3/ZERO-ONE-0.6.3-win-x64.exe
```

---

## 3. Chocolatey

### Local pack & test

```powershell
cd distribution\chocolatey\zero-one
choco pack
# Produces zero-one.0.6.3.nupkg

# Test install (admin / elevated recommended for system-wide Chocolatey)
choco install zero-one -s . -y --pre
```

### Publish (community.chocolatey.org)

1. Create an account and obtain an API key (do **not** commit the key).
2. Optional: request package maintainership if the `zero-one` id is already taken.
3. Push:

   ```powershell
   choco apikey --key <YOUR_API_KEY> --source https://push.chocolatey.org/
   choco push zero-one.0.6.3.nupkg --source https://push.chocolatey.org/
   ```

4. Wait for moderation on first publish. Subsequent versions from the same maintainer are usually faster.

### Secrets

- Never commit `chocolatey.config`, API keys, tokens, or `.nupkg` credentials.
- Prefer environment variables / CI secrets for `CHOCO_API_KEY`.

---

## Version bump checklist

When releasing **0.6.x+**:

1. Publish GitHub Release asset `ZERO-ONE-<ver>-win-x64.exe`.
2. Compute SHA256 of the **exact** uploaded file.
3. Update:
   - `winget/.../<ver>/` (new version folder; update PackageVersion, InstallerUrl, InstallerSha256, ReleaseDate, ReleaseNotes)
   - `scoop/zero-one.json` (`version`, `url`, `hash`)
   - `chocolatey/zero-one/zero-one.nuspec` + `tools/chocolateyinstall.ps1` (`version`, URL, checksum)
4. Re-run local validate / pack tests.
5. Submit winget PR, push Scoop bucket commit, `choco push`.

---

## Related product metadata

- Electron `appId`: `org.talktoai.zeroone`
- Product name: `ZERO ONE`
- Author: QUANTUMENCRYPTION1 LTD
- License file: repository root `LICENSE` (Apache-2.0)
