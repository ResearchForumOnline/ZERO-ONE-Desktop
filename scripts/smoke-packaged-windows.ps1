param(
  [Parameter(Mandatory = $true)]
  [string]$AppPath,

  [ValidateRange(5, 60)]
  [int]$WaitSeconds = 12,

  [switch]$TestLocalChat
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-CdpExpression {
  param(
    [string]$WebSocketUrl,
    [string]$Expression
  )
  $env:ZERO_ONE_SMOKE_WS = $WebSocketUrl
  $env:ZERO_ONE_SMOKE_EXPR = $Expression
  $probe = & node -e 'const w=new WebSocket(process.env.ZERO_ONE_SMOKE_WS);const t=setTimeout(()=>process.exit(2),20000);w.onopen=()=>w.send(JSON.stringify({id:1,method:"Runtime.evaluate",params:{expression:process.env.ZERO_ONE_SMOKE_EXPR,awaitPromise:true,returnByValue:true}}));w.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===1){clearTimeout(t);if(m.exceptionDetails||m.result?.exceptionDetails){console.error(JSON.stringify(m));process.exit(3)}console.log(m.result.result.value);w.close()}}'
  if ($LASTEXITCODE -ne 0 -or -not $probe) {
    throw "Packaged app CDP probe failed."
  }
  return $probe | ConvertFrom-Json
}

$resolvedAppPath = (Resolve-Path -LiteralPath $AppPath -ErrorAction Stop).Path
$appDirectory = Split-Path -Parent $resolvedAppPath
$resourcesPath = Join-Path $appDirectory "resources"
$zsecRoot = Join-Path $resourcesPath "zsec-shield"
$zsecExecutable = Join-Path $zsecRoot "zsec-shield.exe"
$zsecProvenance = Join-Path $resourcesPath "zsec-shield-provenance.json"
$projectRoot = Split-Path -Parent $PSScriptRoot
$vendorVerifier = Join-Path $projectRoot "build\zsec-vendor-verifier.cjs"

foreach ($requiredPath in @($zsecExecutable, $zsecProvenance, $vendorVerifier)) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Required packaged verification input is missing: $requiredPath"
  }
}

& node $vendorVerifier $zsecRoot $zsecProvenance
if ($LASTEXITCODE -ne 0) {
  throw "Packaged ZSEC payload verification failed."
}

$tempBasePath = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$smokeRoot = [IO.Path]::GetFullPath((Join-Path $tempBasePath ("zero-one-smoke-" + [guid]::NewGuid().ToString("N"))))
if (-not $smokeRoot.StartsWith($tempBasePath, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to create the smoke-test profile outside the operating-system temp directory."
}

$profilePath = Join-Path $smokeRoot "profile"
$zsecStatePath = Join-Path $smokeRoot "zsec-state"
$fixturePath = Join-Path $smokeRoot "fixture"
$stdoutPath = Join-Path $smokeRoot "stdout.log"
$stderrPath = Join-Path $smokeRoot "stderr.log"
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$debugPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$process = $null
$env:ZSEC_SHIELD_HOME = $zsecStatePath

try {
  New-Item -ItemType Directory -Path $profilePath, $fixturePath -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $fixturePath "clean.txt"), "ordinary deterministic packaged smoke content", (New-Object Text.UTF8Encoding($false)))

  $zsecVersion = (& $zsecExecutable --version | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $zsecVersion -ne "zsec-shield 0.1.2") {
    throw "Packaged ZSEC version smoke failed: $zsecVersion"
  }
  $freshStatus = ((& $zsecExecutable status --json | Out-String) | ConvertFrom-Json)
  if ($LASTEXITCODE -ne 0 -or $freshStatus.schema -ne "zsec.shield.status.v2" -or $freshStatus.contract_version -ne 2 -or $null -ne $freshStatus.last_scan) {
    throw "Packaged ZSEC fresh status is not contract-v2 idle."
  }

  $arguments = @(
    "--user-data-dir=$profilePath",
    "--remote-debugging-port=$debugPort",
    "--disable-gpu"
  )
  $process = Start-Process -FilePath $resolvedAppPath -ArgumentList $arguments -WorkingDirectory $appDirectory -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  Start-Sleep -Seconds $WaitSeconds
  $process.Refresh()

  if ($process.HasExited) {
    throw "Packaged app exited during startup with code $($process.ExitCode)."
  }
  if (-not $process.Responding) {
    throw "Packaged app process is not responding after $WaitSeconds seconds."
  }

  $stderrText = if (Test-Path -LiteralPath $stderrPath) {
    Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue
  } else {
    ""
  }
  if ($stderrText -match "(?i)(FATAL:|ERR_FILE_NOT_FOUND|Failed to load URL|UnhandledPromiseRejection)") {
    throw "Packaged app emitted a fatal renderer/startup error: $($Matches[0])"
  }

  $pages = Invoke-RestMethod -Uri "http://127.0.0.1:$debugPort/json/list" -TimeoutSec 5
  $page = $pages | Where-Object { $_.type -eq "page" } | Select-Object -First 1
  if (-not $page -or -not $page.webSocketDebuggerUrl) {
    throw "Packaged app did not expose a rendered page for the startup probe."
  }

  $dom = Invoke-CdpExpression -WebSocketUrl $page.webSocketDebuggerUrl -Expression 'JSON.stringify({title:document.title,h1:document.querySelector("h1")?.textContent,rootChildren:document.querySelector("#root")?.childElementCount})'
  if ($dom.title -ne "ZERO ONE" -or $dom.h1 -ne "Command center" -or [int]$dom.rootChildren -lt 1) {
    throw "Packaged app rendered an unexpected DOM: $($dom | ConvertTo-Json -Compress)"
  }

  if ($TestLocalChat) {
    $chat = Invoke-CdpExpression -WebSocketUrl $page.webSocketDebuggerUrl -Expression 'window.zeroOne.chatLocalOpenZero({model:"hf.co/shafire/OpenZero-Qwen3-1.7B-Agentic-GGUF:Q4_K_M",messages:[{role:"user",content:"Reply with exactly: ZERO ONE FAST READY"}]}).then(value=>JSON.stringify(value))'
    if ($chat.model -ne "hf.co/shafire/OpenZero-Qwen3-1.7B-Agentic-GGUF:Q4_K_M" -or $chat.content -notmatch "ZERO ONE FAST READY") {
      throw "Packaged local Assistant chat failed: $($chat | ConvertTo-Json -Compress)"
    }
  }

  $idleSnapshot = Invoke-CdpExpression -WebSocketUrl $page.webSocketDebuggerUrl -Expression 'window.zeroOne.getZsecStatus().then(value=>JSON.stringify(value))'
  if (-not $idleSnapshot.installed -or $idleSnapshot.version -ne "0.1.2" -or $idleSnapshot.state -ne "idle") {
    throw "Packaged IPC did not identify the bundled ZSEC 0.1.2 idle runtime: $($idleSnapshot | ConvertTo-Json -Compress)"
  }

  $cleanReport = ((& $zsecExecutable check $fixturePath --json | Out-String) | ConvertFrom-Json)
  if ($LASTEXITCODE -ne 0 -or $cleanReport.outcome -ne "no_configured_rule_matches" -or [int]$cleanReport.scan.stats.errors -ne 0) {
    throw "Packaged ZSEC clean scan failed."
  }
  $readySnapshot = Invoke-CdpExpression -WebSocketUrl $page.webSocketDebuggerUrl -Expression 'window.zeroOne.getZsecStatus().then(value=>JSON.stringify(value))'
  if ($readySnapshot.state -ne "ready" -or $readySnapshot.outcome -ne "no_configured_rule_matches" -or [int]$readySnapshot.errors -ne 0 -or [int]$readySnapshot.filesHashed -lt 1) {
    throw "Packaged IPC did not map exact clean evidence to ready: $($readySnapshot | ConvertTo-Json -Compress)"
  }
  $readyUi = Invoke-CdpExpression -WebSocketUrl $page.webSocketDebuggerUrl -Expression 'new Promise(resolve=>{document.querySelector("button[aria-label=\"Refresh status\"]")?.click();setTimeout(()=>resolve(JSON.stringify({cleanLabel:document.body.innerText.includes("LAST SCAN CLEAR")})),7500)})'
  if (-not $readyUi.cleanLabel) {
    throw "Packaged UI did not render the exact clean-scan state."
  }

  $missingPath = Join-Path $smokeRoot "definitely-missing"
  $missingOutput = & $zsecExecutable check $missingPath --json | Out-String
  $missingExit = $LASTEXITCODE
  $missingReport = $missingOutput | ConvertFrom-Json
  if ($missingExit -ne 2 -or $missingReport.outcome -ne "incomplete") {
    throw "Packaged ZSEC missing-path scan did not exit incomplete."
  }
  $incompleteSnapshot = Invoke-CdpExpression -WebSocketUrl $page.webSocketDebuggerUrl -Expression 'window.zeroOne.getZsecStatus().then(value=>JSON.stringify(value))'
  if ($incompleteSnapshot.state -eq "ready" -or $incompleteSnapshot.state -ne "attention" -or $incompleteSnapshot.outcome -ne "incomplete" -or [int]$incompleteSnapshot.errors -lt 1) {
    throw "Packaged IPC did not fail closed on incomplete evidence: $($incompleteSnapshot | ConvertTo-Json -Compress)"
  }
  $incompleteUi = Invoke-CdpExpression -WebSocketUrl $page.webSocketDebuggerUrl -Expression 'new Promise(resolve=>{document.querySelector("button[aria-label=\"Refresh status\"]")?.click();setTimeout(()=>resolve(JSON.stringify({cleanLabel:document.body.innerText.includes("LAST SCAN CLEAR"),review:document.body.innerText.includes("REVIEW")})),7500)})'
  if ($incompleteUi.cleanLabel -or -not $incompleteUi.review) {
    throw "Packaged UI did not remove the clean label after incomplete evidence."
  }

  Write-Output "Packaged launch, DOM, ZSEC identity, clean-scan, fail-closed incomplete-scan$(if ($TestLocalChat) { ', and local Assistant chat' }) smoke passed for PID $($process.Id)."
} finally {
  Remove-Item Env:ZERO_ONE_SMOKE_WS -ErrorAction SilentlyContinue
  Remove-Item Env:ZERO_ONE_SMOKE_EXPR -ErrorAction SilentlyContinue
  Remove-Item Env:ZSEC_SHIELD_HOME -ErrorAction SilentlyContinue
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    $process.WaitForExit(5000) | Out-Null
  }
  if (Test-Path -LiteralPath $smokeRoot) {
    $resolvedSmoke = [IO.Path]::GetFullPath($smokeRoot)
    if (-not $resolvedSmoke.StartsWith($tempBasePath, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing unsafe smoke-test cleanup."
    }
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and $_.CommandLine.Contains($resolvedSmoke, [StringComparison]::OrdinalIgnoreCase) } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $removed = $false
    for ($attempt = 1; $attempt -le 12; $attempt++) {
      try {
        Remove-Item -LiteralPath $resolvedSmoke -Recurse -Force -ErrorAction Stop
        $removed = $true
        break
      } catch {
        if ($attempt -lt 12) { Start-Sleep -Milliseconds 250 }
      }
    }
    if (-not $removed -and (Test-Path -LiteralPath $resolvedSmoke)) {
      Write-Warning "The smoke passed, but Windows still held a disposable profile file: $resolvedSmoke"
    }
  }
}
