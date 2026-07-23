$ErrorActionPreference = 'Stop'

$workspacePath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$workerPath = Join-Path $workspacePath 'cloudflare\audio-worker'
$configPath = Join-Path $workerPath 'wrangler.local.jsonc'
$envPath = Join-Path $workspacePath '.env'
$persistPath = Join-Path $workspacePath '.wrangler\audio-worker'

function Get-DotEnvValue {
  param([Parameter(Mandatory = $true)][string]$Name)

  $line = Get-Content -LiteralPath $envPath |
    Where-Object { $_ -match "^$([Regex]::Escape($Name))=" } |
    Select-Object -First 1

  if (-not $line) {
    throw "Variable $Name absente de $envPath"
  }

  return ($line -split '=', 2)[1].Trim()
}

$supabaseUrl = Get-DotEnvValue -Name 'VITE_SUPABASE_URL'
$supabasePublishableKey = Get-DotEnvValue -Name 'VITE_SUPABASE_ANON_KEY'
$supabaseHost = ([Uri]$supabaseUrl).Host
$allowedOrigins = @(
  'http://127.0.0.1:5173'
  'http://localhost:5173'
  "http://${supabaseHost}:5173"
) -join ','

$env:WRANGLER_LOG_PATH = Join-Path $workspacePath '.wrangler-local.log'

Write-Host "Worker audio local : http://${supabaseHost}:8787"
Write-Host "R2 local persistant : $persistPath"

& npx.cmd wrangler dev `
  --config $configPath `
  --cwd $workerPath `
  --local `
  --ip 0.0.0.0 `
  --port 8787 `
  --persist-to $persistPath `
  --var "SUPABASE_URL:$supabaseUrl" `
  --var "SUPABASE_PUBLISHABLE_KEY:$supabasePublishableKey" `
  --var "ALLOWED_ORIGINS:$allowedOrigins" `
  --var 'URL_SIGNING_SECRET:faderzero-local-development-only'

exit $LASTEXITCODE
