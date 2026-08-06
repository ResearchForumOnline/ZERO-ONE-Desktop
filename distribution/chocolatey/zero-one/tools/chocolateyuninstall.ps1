$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = 'zero-one'
  softwareName   = 'ZERO ONE*'
  fileType       = 'exe'
  silentArgs     = '/S'
  validExitCodes = @(0)
}

[array]$keys = Get-UninstallRegistryKey -SoftwareName $packageArgs['softwareName']

if ($keys.Count -eq 1) {
  $packageArgs['file'] = $keys[0].UninstallString -replace '"', ''
  # electron-builder NSIS uninstallers typically accept /S
  Uninstall-ChocolateyPackage @packageArgs
} elseif ($keys.Count -eq 0) {
  Write-Warning "$($packageArgs.packageName) has already been uninstalled by other means."
} else {
  Write-Warning "$($keys.Count) matches found for $($packageArgs.packageName)!"
  Write-Warning "Please alert package maintainer the following keys were matched:"
  $keys | ForEach-Object { Write-Warning "- $($_.DisplayName)" }
}
