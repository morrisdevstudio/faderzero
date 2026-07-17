param(
  [int]$DebounceMs = 1500,
  [int]$PollMs = 1000,
  [switch]$SkipInitialDeploy
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pwaDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
$deployScript = Join-Path $scriptDir "deploy-pwa.ps1"

$watchPaths = @(
  (Join-Path $pwaDir "src"),
  (Join-Path $pwaDir "public"),
  (Join-Path $pwaDir "index.html"),
  (Join-Path $pwaDir "vite.config.ts"),
  (Join-Path $pwaDir "package.json"),
  (Join-Path $pwaDir "tsconfig.json"),
  (Join-Path $pwaDir "tsconfig.app.json"),
  (Join-Path $pwaDir ".env.deploy"),
  (Join-Path $pwaDir ".env.deploy.local")
)

function Get-WatchSnapshot {
  $entries = New-Object System.Collections.Generic.List[string]

  foreach ($path in $watchPaths) {
    if (-not (Test-Path $path)) {
      continue
    }

    $item = Get-Item -LiteralPath $path
    if ($item.PSIsContainer) {
      foreach ($file in Get-ChildItem -LiteralPath $path -Recurse -File) {
        $entries.Add("$($file.FullName)|$($file.LastWriteTimeUtc.Ticks)|$($file.Length)") | Out-Null
      }
      continue
    }

    $entries.Add("$($item.FullName)|$($item.LastWriteTimeUtc.Ticks)|$($item.Length)") | Out-Null
  }

  return (($entries | Sort-Object) -join "`n")
}

function Invoke-Deploy {
  & $deployScript
}

$lastSnapshot = Get-WatchSnapshot
$pendingChangeSince = $null

Write-Host "Watch deploy actif pour $pwaDir"
Write-Host "Ctrl+C pour arreter."

if (-not $SkipInitialDeploy) {
  Invoke-Deploy
}

while ($true) {
  Start-Sleep -Milliseconds $PollMs

  $currentSnapshot = Get-WatchSnapshot
  if ($currentSnapshot -ne $lastSnapshot) {
    $lastSnapshot = $currentSnapshot
    $pendingChangeSince = Get-Date
    continue
  }

  if ($null -eq $pendingChangeSince) {
    continue
  }

  $elapsedMs = ((Get-Date) - $pendingChangeSince).TotalMilliseconds
  if ($elapsedMs -lt $DebounceMs) {
    continue
  }

  $pendingChangeSince = $null
  Invoke-Deploy
}
