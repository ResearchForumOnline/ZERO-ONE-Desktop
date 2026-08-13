param([Parameter(Mandatory = $true)][string]$AppPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$expectedDefaultModel = "hf.co/shafire/OpenZero-Gemma4-E2B-Agentic-GGUF:Q4_K_M"

function Invoke-CdpExpression([string]$WebSocketUrl, [string]$Expression) {
  $env:ZERO_ONE_SMOKE_WS = $WebSocketUrl
  $env:ZERO_ONE_SMOKE_EXPR = $Expression
  $value = & node -e 'const w=new WebSocket(process.env.ZERO_ONE_SMOKE_WS);const t=setTimeout(()=>process.exit(2),60000);w.onopen=()=>w.send(JSON.stringify({id:1,method:"Runtime.evaluate",params:{expression:process.env.ZERO_ONE_SMOKE_EXPR,awaitPromise:true,returnByValue:true}}));w.onmessage=e=>{const m=JSON.parse(e.data);if(m.id===1){clearTimeout(t);if(m.exceptionDetails||m.result?.exceptionDetails){console.error(JSON.stringify(m));process.exit(3)}console.log(m.result.result.value);w.close()}}'
  if ($LASTEXITCODE -ne 0 -or -not $value) { throw "Packaged local-chat CDP probe failed." }
  return $value | ConvertFrom-Json
}

$resolvedApp = (Resolve-Path -LiteralPath $AppPath).Path
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$profile = [IO.Path]::GetFullPath((Join-Path $tempBase ("zero-one-local-chat-" + [guid]::NewGuid().ToString("N"))))
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start(); $port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port; $listener.Stop()
$process = $null
try {
  New-Item -ItemType Directory -Path $profile -Force | Out-Null
  $process = Start-Process -FilePath $resolvedApp -ArgumentList @("--user-data-dir=$profile", "--remote-debugging-port=$port", "--disable-gpu") -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 8
  if ($process.HasExited -or -not $process.Responding) { throw "Packaged app did not remain responsive." }
  $page = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 5 | Where-Object { $_.type -eq "page" } | Select-Object -First 1
  if (-not $page.webSocketDebuggerUrl) { throw "Packaged renderer page was not available." }
  $dom = Invoke-CdpExpression $page.webSocketDebuggerUrl 'JSON.stringify({title:document.title,h1:document.querySelector("h1")?.textContent,rootChildren:document.querySelector("#root")?.childElementCount})'
  if ($dom.title -ne "ZERO ONE" -or $dom.h1 -ne "Command center" -or [int]$dom.rootChildren -lt 1) { throw "Packaged UI did not render." }
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $status = Invoke-CdpExpression $page.webSocketDebuggerUrl 'window.zeroOne.getLocalOpenZeroStatus().then(value=>JSON.stringify(value))'
  if ($status.defaultModel -ne $expectedDefaultModel) { throw "Packaged local Assistant exposed an unexpected default model: $($status.defaultModel)" }
  $chat = Invoke-CdpExpression $page.webSocketDebuggerUrl 'window.zeroOne.getLocalOpenZeroStatus().then(status=>window.zeroOne.chatLocalOpenZero({model:status.defaultModel,messages:[{role:"user",content:"Reply with exactly: ZERO ONE READY"}]})).then(value=>JSON.stringify(value))'
  $watch.Stop()
  if ($chat.model -ne $expectedDefaultModel -or $chat.content -notmatch "ZERO ONE READY") { throw "Packaged local Assistant returned an unexpected result." }
  [pscustomobject]@{ Ui = "rendered"; Model = $chat.model; Content = $chat.content; Seconds = [math]::Round($watch.Elapsed.TotalSeconds, 1) }
} finally {
  Remove-Item Env:ZERO_ONE_SMOKE_WS -ErrorAction SilentlyContinue
  Remove-Item Env:ZERO_ONE_SMOKE_EXPR -ErrorAction SilentlyContinue
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue; $process.WaitForExit(5000) | Out-Null }
  if ($profile.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $profile)) { Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue }
}
