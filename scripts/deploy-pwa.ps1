param(
  [string]$RemoteHost = $(if ($env:FADERZERO_DEPLOY_HOST) { $env:FADERZERO_DEPLOY_HOST } else { "192.168.1.71" }),
  [string]$RemoteUser = $(if ($env:FADERZERO_DEPLOY_USER) { $env:FADERZERO_DEPLOY_USER } else { "docker-yapi" }),
  [string]$RemoteBaseDir = $(if ($env:FADERZERO_DEPLOY_BASE_DIR) { $env:FADERZERO_DEPLOY_BASE_DIR } else { "/home/docker-yapi/appGroup/faderzero-pwa" }),
  [string]$BuildScript = $(if ($env:FADERZERO_DEPLOY_BUILD_SCRIPT) { $env:FADERZERO_DEPLOY_BUILD_SCRIPT } else { "build:deploy" })
)

$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Commande requise introuvable: $Name"
  }
}

function Assert-LastExitCode {
  param([string]$Context)

  if ($LASTEXITCODE -ne 0) {
    throw "$Context a echoue avec le code $LASTEXITCODE."
  }
}

function Get-EnvValueFromFile {
  param(
    [string]$FilePath,
    [string]$Key
  )

  if (-not (Test-Path $FilePath)) {
    return $null
  }

  foreach ($line in Get-Content -LiteralPath $FilePath) {
    if ($line -match "^\s*$Key\s*=\s*(.+?)\s*$") {
      return $matches[1].Trim('"').Trim("'")
    }
  }

  return $null
}

Require-Command "npm"
Require-Command "ssh"
Require-Command "scp"
Require-Command "tar"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pwaDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
$remoteTarget = "$RemoteUser@$RemoteHost"
$remoteArchive = "/tmp/faderzero-pwa-dist.tar.gz"
$releaseId = "release-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$archivePath = Join-Path $env:TEMP "faderzero-pwa-$releaseId.tar.gz"
$remoteDeployScriptPath = $null
$deployEnvFiles = @(
  (Join-Path $pwaDir ".env.deploy.local"),
  (Join-Path $pwaDir ".env.deploy")
)

$deploySupabaseUrl = $null
foreach ($envFile in $deployEnvFiles) {
  $deploySupabaseUrl = Get-EnvValueFromFile -FilePath $envFile -Key "VITE_SUPABASE_URL"
  if ($deploySupabaseUrl) {
    break
  }
}

if (-not $deploySupabaseUrl) {
  throw "Aucune URL Supabase de deploiement trouvee. Creez pwa/.env.deploy.local a partir de pwa/.env.deploy.example."
}

if (-not $deploySupabaseUrl.StartsWith("https://")) {
  throw "VITE_SUPABASE_URL doit etre en HTTPS pour le deploiement Android. Valeur actuelle: $deploySupabaseUrl"
}

Write-Host "Build PWA via npm run $BuildScript"

Push-Location $pwaDir
try {
  npm run $BuildScript
  Assert-LastExitCode "Le build PWA"

  if (-not (Test-Path (Join-Path $pwaDir "dist"))) {
    throw "Le dossier dist est introuvable apres le build."
  }

  if (Test-Path $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }

  Write-Host "Archive dist -> $archivePath"
  tar -czf $archivePath -C dist .
  Assert-LastExitCode "La creation de l'archive dist"

  Write-Host "Upload -> $remoteTarget"
  scp $archivePath "${remoteTarget}:${remoteArchive}" | Out-Null
  Assert-LastExitCode "L'envoi de l'archive vers le serveur"

  $remoteDeployScriptPath = Join-Path $env:TEMP "faderzero-pwa-remote-$releaseId.sh"
  $remoteDeployScript = @"
#!/usr/bin/env bash
set -eu
base_dir='$RemoteBaseDir'
mkdir -p "`$base_dir/releases"
release_dir="`$base_dir/releases/$releaseId"
mkdir -p "`$release_dir"
tar -xzf '$remoteArchive' -C "`$release_dir"
rm -rf "`$base_dir/current"
ln -sfn "`$release_dir" "`$base_dir/current"
rm -f '$remoteArchive'
if command -v docker >/dev/null 2>&1; then
  docker compose -f /home/docker-yapi/appGroup/docker-compose.remote.yml up -d --force-recreate >/dev/null 2>&1 || true
fi
printf 'Release active: %s\n' "`$release_dir"
"@

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $remoteDeployScript = $remoteDeployScript -replace "`r`n", "`n"
  [System.IO.File]::WriteAllText($remoteDeployScriptPath, $remoteDeployScript, $utf8NoBom)

  Write-Host "Activation release on remote host"
  scp $remoteDeployScriptPath "${remoteTarget}:/tmp/faderzero-pwa-deploy.sh" | Out-Null
  Assert-LastExitCode "L'envoi du script d'activation remote"
  ssh $remoteTarget "chmod +x /tmp/faderzero-pwa-deploy.sh && /tmp/faderzero-pwa-deploy.sh && rm -f /tmp/faderzero-pwa-deploy.sh"
  Assert-LastExitCode "L'activation de la release sur le serveur"

  Write-Host "Deploy termine."
}
finally {
  Pop-Location

  if (Test-Path $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }

  if (Test-Path $remoteDeployScriptPath) {
    Remove-Item -LiteralPath $remoteDeployScriptPath -Force
  }
}
