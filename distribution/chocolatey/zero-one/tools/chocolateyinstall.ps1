$ErrorActionPreference = 'Stop'

$packageName = 'zero-one'
$toolsDir    = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"
$url64       = 'https://github.com/ResearchForumOnline/ZERO-ONE-Desktop/releases/download/v0.6.3/ZERO-ONE-0.6.3-win-x64.exe'
$checksum64  = '2352DA64394017D93DC6F9B7A486CF0DBD7ED26082EEB37B5CE69F1401A9259B'

# electron-builder NSIS oneClick installer — silent switch is /S
$packageArgs = @{
  packageName    = $packageName
  fileType       = 'exe'
  url64bit       = $url64
  softwareName   = 'ZERO ONE*'
  checksum64     = $checksum64
  checksumType64 = 'sha256'
  silentArgs     = '/S'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
