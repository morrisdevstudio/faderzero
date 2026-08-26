[CmdletBinding()]
param(
    [string]$CommitMessage,
    [int]$DockerStartTimeoutSeconds = 90
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$LogDirectory = Join-Path $RepoRoot '.cache\faderzero\push-cloudflare'
$LogFile = Join-Path $LogDirectory ("push-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$DockerStartedByScript = $false

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null

function Write-PushLog {
    param([Parameter(Mandatory)][string]$Message)

    $line = "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $Message
    Add-Content -LiteralPath $LogFile -Value $line -Encoding utf8
    Write-Host $Message
}

function Invoke-Git {
    param([Parameter(Mandatory)][string[]]$Arguments)

    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
}

function Test-DockerReady {
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & docker info --format '{{.ServerVersion}}' *> $null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Get-ChangedPaths {
    $paths = @(
        & git diff --name-only
        & git diff --cached --name-only
        & git ls-files --others --exclude-standard
    ) | Where-Object { $_ } | Sort-Object -Unique
    return $paths
}

function Find-SensitivePath {
    param([Parameter(Mandatory)][string[]]$Paths)

    return $Paths | Where-Object {
        $name = [IO.Path]::GetFileName($_)
        $name -eq '.env' -or ($name -like '.env.*' -and $name -ne '.env.deploy.example') -or $name -like '*.pem' -or $name -like '*.key'
    } | Select-Object -First 1
}

Push-Location $RepoRoot
try {
    $branch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') {
        throw "Publication cancelled: the current branch must be main (current: $branch)."
    }

    Write-PushLog "Log file: $LogFile"
    Write-PushLog 'Fetching origin/main before publication.'
    Invoke-Git -Arguments @('fetch', 'origin', 'main')
    $divergence = ((& git rev-list --left-right --count 'origin/main...main').Trim() -split '\s+')
    if ($LASTEXITCODE -ne 0 -or $divergence.Count -ne 2) { throw 'Unable to compare main with origin/main.' }
    if ([int]$divergence[0] -gt 0) {
        throw "Publication cancelled: origin/main is ahead by $($divergence[0]) commit(s). Integrate remote changes first."
    }

    $changedPaths = Get-ChangedPaths
    $sensitivePath = Find-SensitivePath -Paths $changedPaths
    if ($sensitivePath) {
        throw "Publication cancelled: non-ignored sensitive file detected: $sensitivePath"
    }

    Write-PushLog 'Running the repository secret scan.'
    & npm.cmd run security:secrets *>> $LogFile
    if ($LASTEXITCODE -ne 0) {
        Get-Content -LiteralPath $LogFile | Select-Object -Last 35
        throw "Publication cancelled: the secret scan failed (log: $LogFile)."
    }

    if (-not (Test-DockerReady)) {
        Write-PushLog 'Docker Desktop is stopped; starting it.'
        & docker desktop start *>> $LogFile
        if ($LASTEXITCODE -ne 0) { throw 'Unable to start Docker Desktop.' }
        $DockerStartedByScript = $true
        $deadline = (Get-Date).AddSeconds($DockerStartTimeoutSeconds)
        while (-not (Test-DockerReady)) {
            if ((Get-Date) -ge $deadline) {
                throw "Docker Desktop is unavailable after $DockerStartTimeoutSeconds seconds."
            }
            Start-Sleep -Seconds 3
        }
    }

    if ($changedPaths.Count -gt 0) {
        if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
            throw 'Publication cancelled: provide -CommitMessage for uncommitted changes.'
        }
        if ($CommitMessage.Length -gt 72 -or $CommitMessage -notmatch '^(feat|fix|test|docs|refactor|chore): .+') {
            throw 'Publication cancelled: the message must be a conventional commit of at most 72 characters.'
        }

        Invoke-Git -Arguments @('add', '-A')
        & git diff --cached --check
        if ($LASTEXITCODE -ne 0) { throw 'Publication cancelled: the staged diff has whitespace errors.' }
        Invoke-Git -Arguments @('commit', '-m', $CommitMessage)
    }

    $aheadCount = [int]((& git rev-list --count 'origin/main..main').Trim())
    if ($LASTEXITCODE -ne 0) { throw 'Unable to compare main with origin/main.' }
    if ($aheadCount -eq 0) {
        Write-PushLog 'No local changes or commits to publish.'
        exit 0
    }

    Write-PushLog 'Push in progress; the Cloudflare hook output follows in the log.'
    & git push origin main *>> $LogFile
    $pushExitCode = $LASTEXITCODE
    Get-Content -LiteralPath $LogFile
    if ($pushExitCode -ne 0) {
        throw "The push or Cloudflare check failed (log: $LogFile)."
    }

    $syncCounts = (& git rev-list --left-right --count 'origin/main...main').Trim()
    if ($LASTEXITCODE -ne 0 -or $syncCounts -ne "0`t0") {
        throw "The push completed but main and origin/main are not synchronized: $syncCounts"
    }
    Write-PushLog 'Publication completed: main and origin/main are synchronized.'
}
catch {
    Write-PushLog "FAILED: $($_.Exception.Message)"
    throw
}
finally {
    Pop-Location
    if ($DockerStartedByScript) {
        Write-PushLog 'Stopping Docker Desktop started by this script.'
        & docker desktop stop *>> $LogFile
    }
}
