param(
    [switch]$Full
)

$ErrorActionPreference = "Continue"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ScriptName = if ($Full) { "verify:full" } else { "verify:fast" }
$SafeName = $ScriptName.Replace(":", "-")
$LogFile = Join-Path $env:TEMP "faderzero-$SafeName.log"
$ExitCode = 0

Push-Location $RepoRoot

try {
    Write-Host "RUN $ScriptName"
    & npm.cmd run --silent $ScriptName *> $LogFile
    $ExitCode = $LASTEXITCODE

    if ($ExitCode -eq 0) {
        Write-Host "PASS $ScriptName"
    }
    else {
        Write-Host "FAIL $ScriptName"
        Get-Content -LiteralPath $LogFile | Select-Object -Last 35
    }
}
finally {
    Pop-Location
}

exit $ExitCode
