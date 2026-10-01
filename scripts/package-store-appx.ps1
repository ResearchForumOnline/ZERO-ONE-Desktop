param(
  [ValidatePattern('^[A-Za-z0-9.-]{3,50}$')]
  [string]$IdentityName,

  [string]$Publisher,

  [string]$PublisherDisplayName,

  [switch]$SkipChecks
)

$ErrorActionPreference = 'Stop'
if ($IdentityName) { $env:ZERO_ONE_STORE_IDENTITY_NAME = $IdentityName }
if ($Publisher) { $env:ZERO_ONE_STORE_PUBLISHER = $Publisher }
if ($PublisherDisplayName) { $env:ZERO_ONE_STORE_PUBLISHER_DISPLAY_NAME = $PublisherDisplayName }

if (-not $SkipChecks) {
  npm run check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  npm run verify:zsec
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

npm run stage:runtime
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run verify:runtime
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx electron-builder --config build/electron-builder.store.cjs --win appx --x64 --publish never
exit $LASTEXITCODE
