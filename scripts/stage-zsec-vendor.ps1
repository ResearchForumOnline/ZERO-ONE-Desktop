param(
  [string]$LockPath = (Join-Path (Split-Path -Parent $PSScriptRoot) "vendor\zsec-shield.lock.json"),
  [string]$Destination = (Join-Path (Split-Path -Parent $PSScriptRoot) "vendor\zsec-shield"),
  [string]$ArchivePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Condition {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) {
    throw "ZSEC vendor staging failed: $Message"
  }
}

function Get-Sha256 {
  param([string]$Path)
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$lockFullPath = [IO.Path]::GetFullPath($LockPath)
$destinationFullPath = [IO.Path]::GetFullPath($Destination)
$expectedLock = [IO.Path]::GetFullPath((Join-Path $projectRoot "vendor\zsec-shield.lock.json"))
$expectedDestination = [IO.Path]::GetFullPath((Join-Path $projectRoot "vendor\zsec-shield"))
Assert-Condition ($lockFullPath -eq $expectedLock) "the lock path must be the tracked project lock"
Assert-Condition ($destinationFullPath -eq $expectedDestination) "the destination must be vendor\zsec-shield"
Assert-Condition (-not (Test-Path -LiteralPath $destinationFullPath)) "the destination already exists; refusing to overwrite it"

$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content -Raw -LiteralPath $packageJsonPath | ConvertFrom-Json
$packageVersion = [string]$packageJson.version
Assert-Condition (-not [string]::IsNullOrWhiteSpace($packageVersion)) "package.json is missing version"

$lock = Get-Content -Raw -LiteralPath $lockFullPath | ConvertFrom-Json
Assert-Condition ($lock.schema -eq "zero-one.zsec-vendor-lock.v1") "unsupported lock schema"
Assert-Condition ($lock.consumer_version -eq $packageVersion) "lock consumer_version ($($lock.consumer_version)) must match package.json version ($packageVersion)"
Assert-Condition ($lock.repository -eq "ResearchForumOnline/ZSEC-Shield") "unexpected upstream repository"
Assert-Condition ($lock.release.immutable -eq $true) "the lock does not require an immutable release"
Assert-Condition ($lock.release.release_attestation_verified -eq $true) "the lock does not record release-attestation verification"
Assert-Condition ($lock.release.tag_signature_verified -eq $false) "the unsigned annotated tag boundary changed unexpectedly"

$headers = @{
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2026-03-10"
  "User-Agent" = "ZERO-ONE-ZSEC-Vendor-Stager/$packageVersion"
}
$releaseUri = "https://api.github.com/repos/$($lock.repository)/releases/tags/$($lock.release.tag)"
$release = Invoke-RestMethod -Uri $releaseUri -Headers $headers -TimeoutSec 30
Assert-Condition ([int64]$release.id -eq [int64]$lock.release.id) "release ID mismatch"
Assert-Condition ($release.tag_name -eq $lock.release.tag) "release tag mismatch"
Assert-Condition ($release.draft -eq $false) "release is still a draft"
Assert-Condition ($release.prerelease -eq $lock.release.prerelease) "prerelease state mismatch"
Assert-Condition ($release.immutable -eq $true) "release is not immutable"
Assert-Condition ($release.html_url -eq $lock.release.url) "release URL mismatch"

$matchingAssets = @($release.assets | Where-Object {
  [int64]$_.id -eq [int64]$lock.asset.id -and $_.name -eq $lock.asset.name
})
Assert-Condition ($matchingAssets.Count -eq 1) "expected exactly one locked release asset"
$asset = $matchingAssets[0]
Assert-Condition ($asset.state -eq "uploaded") "release asset is not uploaded"
Assert-Condition ([int64]$asset.size -eq [int64]$lock.asset.size) "release asset size mismatch"
Assert-Condition ($asset.digest -eq "sha256:$($lock.asset.sha256)") "release asset API digest mismatch"
Assert-Condition ($asset.browser_download_url -eq $lock.asset.url) "release asset URL mismatch"

$tagReference = Invoke-RestMethod -Uri "https://api.github.com/repos/$($lock.repository)/git/ref/tags/$($lock.release.tag)" -Headers $headers -TimeoutSec 30
Assert-Condition ($tagReference.object.type -eq "tag") "release tag is not the locked annotated tag"
Assert-Condition ($tagReference.object.sha -eq $lock.release.tag_object) "annotated tag object mismatch"
$tagObject = Invoke-RestMethod -Uri $tagReference.object.url -Headers $headers -TimeoutSec 30
Assert-Condition ($tagObject.object.type -eq "commit") "annotated tag does not target a commit"
Assert-Condition ($tagObject.object.sha -eq $lock.release.tag_commit) "tag commit mismatch"
Assert-Condition ($tagObject.verification.verified -eq $lock.release.tag_signature_verified) "tag signature state mismatch"

$downloadedArchive = $false
if ($ArchivePath) {
  $archiveFullPath = [IO.Path]::GetFullPath($ArchivePath)
  Assert-Condition (Test-Path -LiteralPath $archiveFullPath -PathType Leaf) "provided archive does not exist"
} else {
  $archiveFullPath = Join-Path ([IO.Path]::GetTempPath()) ("zsec-vendor-" + [guid]::NewGuid().ToString("N") + ".zip")
  Invoke-WebRequest -Uri $lock.asset.url -OutFile $archiveFullPath -Headers @{ "User-Agent" = $headers["User-Agent"] } -TimeoutSec 120
  $downloadedArchive = $true
}

$vendorParent = [IO.Path]::GetFullPath((Split-Path -Parent $destinationFullPath))
New-Item -ItemType Directory -Force -Path $vendorParent | Out-Null
$stagingContainer = [IO.Path]::GetFullPath((Join-Path $vendorParent (".zsec-staging-" + [guid]::NewGuid().ToString("N"))))
$vendorPrefix = $vendorParent.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
Assert-Condition ($stagingContainer.StartsWith($vendorPrefix, [StringComparison]::OrdinalIgnoreCase)) "staging directory escaped the vendor root"

try {
  $archiveInfo = Get-Item -LiteralPath $archiveFullPath
  Assert-Condition ($archiveInfo.Length -eq [int64]$lock.asset.size) "downloaded archive size mismatch"
  Assert-Condition ((Get-Sha256 $archiveFullPath) -eq $lock.asset.sha256) "downloaded archive digest mismatch"

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($archiveFullPath)
  try {
    Assert-Condition ($zip.Entries.Count -gt 0 -and $zip.Entries.Count -le 500) "ZIP entry count is outside the safe boundary"
    $caseNames = @{}
    $totalUncompressed = 0L
    foreach ($entry in $zip.Entries) {
      $name = $entry.FullName.Replace("\", "/")
      Assert-Condition (-not [string]::IsNullOrWhiteSpace($name)) "ZIP contains an empty path"
      Assert-Condition (-not [IO.Path]::IsPathRooted($name)) "ZIP contains a rooted path"
      Assert-Condition (-not $name.StartsWith("/") -and -not $name.StartsWith("//")) "ZIP contains an absolute path"
      Assert-Condition ($name -notmatch "^[A-Za-z]:" -and $name -notmatch ":") "ZIP contains a drive or alternate-data-stream path"
      $trimmed = $name.TrimEnd("/")
      $segments = @($trimmed -split "/")
      Assert-Condition ($segments.Count -gt 0 -and $segments[0] -eq $lock.asset.archive_root) "ZIP has an unexpected archive root"
      foreach ($segment in $segments) {
        Assert-Condition ($segment -and $segment -ne "." -and $segment -ne "..") "ZIP contains traversal segments"
        Assert-Condition (-not $segment.EndsWith(".") -and -not $segment.EndsWith(" ")) "ZIP contains a Windows-normalization collision"
        Assert-Condition ($segment -notmatch "^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$") "ZIP contains a reserved Windows name"
      }
      $caseKey = $trimmed.ToLowerInvariant()
      Assert-Condition (-not $caseNames.ContainsKey($caseKey)) "ZIP contains duplicate or case-colliding paths"
      $caseNames[$caseKey] = $true

      $unixType = ($entry.ExternalAttributes -shr 16) -band 0xF000
      Assert-Condition ($unixType -ne 0xA000) "ZIP contains a symbolic link"
      Assert-Condition ($entry.Length -le 100MB) "ZIP contains an oversized entry"
      if ($entry.Length -gt 0) {
        Assert-Condition ($entry.CompressedLength -gt 0) "ZIP contains an invalid compressed entry"
        Assert-Condition (($entry.Length / $entry.CompressedLength) -le 200) "ZIP compression ratio exceeds the safe boundary"
      }
      $totalUncompressed += $entry.Length
      Assert-Condition ($totalUncompressed -le 300MB) "ZIP exceeds the uncompressed-size boundary"
    }
  } finally {
    $zip.Dispose()
  }

  New-Item -ItemType Directory -Path $stagingContainer | Out-Null
  [IO.Compression.ZipFile]::ExtractToDirectory($archiveFullPath, $stagingContainer)
  $roots = @(Get-ChildItem -LiteralPath $stagingContainer -Directory)
  Assert-Condition ($roots.Count -eq 1 -and $roots[0].Name -eq $lock.asset.archive_root) "extracted archive root mismatch"
  $extractedRoot = $roots[0].FullName

  $verificationRaw = & node (Join-Path $projectRoot "build\zsec-vendor-verifier.cjs") $extractedRoot $lockFullPath
  Assert-Condition ($LASTEXITCODE -eq 0) "manifest or PE verification failed"
  $verification = $verificationRaw | ConvertFrom-Json
  Assert-Condition ($verification.version -eq $lock.manifest.version) "verified runtime version mismatch"
  Assert-Condition ([int]$verification.files -eq [int]$lock.manifest.file_count) "verified runtime file count mismatch"

  $executable = Join-Path $extractedRoot $lock.manifest.entrypoint
  $versionOutput = (& $executable --version | Out-String).Trim()
  Assert-Condition ($LASTEXITCODE -eq 0 -and $versionOutput -eq "zsec-shield $($lock.manifest.version)") "native runtime version smoke failed"

  $smokeState = Join-Path $stagingContainer "smoke-state"
  $smokeFixture = Join-Path $stagingContainer "smoke-fixture"
  New-Item -ItemType Directory -Path $smokeFixture | Out-Null
  [IO.File]::WriteAllText((Join-Path $smokeFixture "clean.txt"), "ordinary deterministic vendor smoke content", (New-Object Text.UTF8Encoding($false)))

  $fresh = (& $executable --state-dir $smokeState status --json | Out-String) | ConvertFrom-Json
  Assert-Condition ($LASTEXITCODE -eq 0) "fresh status smoke failed"
  Assert-Condition ($fresh.schema -eq $lock.contracts.status_schema -and [int]$fresh.contract_version -eq [int]$lock.contracts.status_version) "fresh status contract mismatch"
  Assert-Condition ($null -eq $fresh.last_scan -and $null -eq $fresh.last_scan_outcome) "fresh status is not idle"

  $cleanReport = (& $executable --state-dir $smokeState check $smokeFixture --json | Out-String) | ConvertFrom-Json
  Assert-Condition ($LASTEXITCODE -eq 0) "clean scan smoke failed"
  Assert-Condition ($cleanReport.schema -eq $lock.contracts.scan_schema -and $cleanReport.outcome -eq "no_configured_rule_matches") "clean scan report mismatch"
  Assert-Condition ([int]$cleanReport.scan.stats.errors -eq 0 -and [int]$cleanReport.scan.stats.findings -eq 0) "clean scan reported errors or findings"

  $cleanStatus = (& $executable --state-dir $smokeState status --json | Out-String) | ConvertFrom-Json
  Assert-Condition ($LASTEXITCODE -eq 0) "clean persisted status smoke failed"
  Assert-Condition ($cleanStatus.last_scan_outcome -eq "no_configured_rule_matches" -and [int]$cleanStatus.last_scan_errors -eq 0) "clean persisted status mismatch"

  $missingPath = Join-Path $stagingContainer "definitely-missing"
  $missingOutput = & $executable --state-dir $smokeState check $missingPath --json | Out-String
  $missingExit = $LASTEXITCODE
  $missingReport = $missingOutput | ConvertFrom-Json
  Assert-Condition ($missingExit -eq 2 -and $missingReport.outcome -eq "incomplete") "missing-path scan did not fail incomplete"

  $incompleteStatus = (& $executable --state-dir $smokeState status --json | Out-String) | ConvertFrom-Json
  Assert-Condition ($LASTEXITCODE -eq 0) "incomplete persisted status smoke failed"
  Assert-Condition ($incompleteStatus.last_scan_outcome -eq "incomplete" -and [int]$incompleteStatus.last_scan_errors -ge 1) "incomplete scan was not preserved"

  Remove-Item -LiteralPath $smokeState -Recurse -Force
  Remove-Item -LiteralPath $smokeFixture -Recurse -Force
  Move-Item -LiteralPath $extractedRoot -Destination $destinationFullPath
  Copy-Item -LiteralPath $lockFullPath -Destination (Join-Path $projectRoot "vendor\zsec-shield-provenance.json") -Force
  Write-Output "Staged verified ZSEC Shield $($lock.manifest.version) to $destinationFullPath"
  Write-Output ($verification | ConvertTo-Json -Compress)
} finally {
  if (Test-Path -LiteralPath $stagingContainer) {
    $resolvedStaging = [IO.Path]::GetFullPath($stagingContainer)
    Assert-Condition ($resolvedStaging.StartsWith($vendorPrefix, [StringComparison]::OrdinalIgnoreCase)) "refusing unsafe staging cleanup"
    Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
  }
  if ($downloadedArchive -and (Test-Path -LiteralPath $archiveFullPath)) {
    Remove-Item -LiteralPath $archiveFullPath -Force
  }
}
