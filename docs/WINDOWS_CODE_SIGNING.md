# Windows Authenticode / SmartScreen

## Why SmartScreen still warns

Unsigned or newly signed public installers trigger Windows SmartScreen until reputation builds. **Removing the warning for all users requires:**

1. An **Authenticode code signing certificate** from a public CA (e.g. DigiCert, Sectigo, SSL.com) — typically **OV** or **EV** (EV gets reputation faster).
2. Signing every release installer (`ZERO-ONE-*-win-x64.exe`).
3. Time / download volume for reputation (or EV + consistent publisher name).

This cannot be finished with a free self-signed certificate (Windows will not trust it for SmartScreen).

## Recommended purchase path

1. Buy **Code Signing** (OV or EV) for **QUANTUMENCRYPTION1 LTD** matching legal entity docs.
2. Prefer a cert delivered as **.pfx** (or cloud HSM / Azure Trusted Signing / SignPath).
3. Store the PFX + password in a secrets manager — **never commit to git**.

## Local / CI signing (ready)

electron-builder uses these environment variables when set:

```powershell
$env:CSC_LINK = "C:\secure\zero-one-codesign.pfx"   # or base64 of pfx
$env:CSC_KEY_PASSWORD = "***"
# optional:
$env:CSC_IDENTITY_AUTO_DISCOVERY = "true"

cd ZERO-ONE-Desktop
npm run dist:win
```

GitHub Actions (release workflow) can receive the same secrets as repository secrets:

- `WINDOWS_CSC_LINK` (base64 of PFX)
- `WINDOWS_CSC_KEY_PASSWORD`

Then in the Windows job before `npm run dist:win`:

```yaml
env:
  CSC_LINK: ${{ secrets.WINDOWS_CSC_LINK }}
  CSC_KEY_PASSWORD: ${{ secrets.WINDOWS_CSC_KEY_PASSWORD }}
```

## Verify a signed build

```powershell
Get-AuthenticodeSignature ".\release\ZERO-ONE-*-win-x64.exe" | Format-List *
```

Expected after real cert: `Status = Valid`, publisher = your legal name.

## Current public builds

Until a paid cert is installed, installers remain **intentionally unsigned** (CI checks `NotSigned`). Users should download only from:

https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases  
https://talktoai.org/ZeroOne/
