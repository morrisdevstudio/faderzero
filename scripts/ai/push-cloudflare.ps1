[CmdletBinding()]
param(
    [string]$CommitMessage,
    [switch]$GitPushOnly,
    [int]$DockerStartTimeoutSeconds = 90,
    [int]$DockerProbeTimeoutSeconds = 5,
    [int]$SmokeAttempts = 6,
    [int]$SmokeDelaySeconds = 5
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$LogDirectory = Join-Path $RepoRoot '.cache\faderzero\push-cloudflare'
$LogFile = Join-Path $LogDirectory ("push-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$DeployExamplePath = Join-Path $RepoRoot '.env.deploy.example'
$DockerStartedByScript = $false
$script:Gate = 'PREFLIGHT'
$script:LivePublished = $false
$script:SmokeApp = '-'
$script:SmokeAudio = '-'
$script:SmokeEpk = '-'
$WranglerPackage = 'wrangler@4.118.0'

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null

function Write-PushLog {
    param([Parameter(Mandatory)][string]$Message)

    $line = "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $Message
    Add-Content -LiteralPath $LogFile -Value $line -Encoding utf8
}

function Write-Score {
    param([Parameter(Mandatory)][string]$Message)

    Write-PushLog $Message
    Write-Host $Message
}

function Write-FailureScoreboard {
    Write-Host 'PUSH-CLOUDFLARE'
    Write-Host "LOG $LogFile"
    Write-Host "FAIL $script:Gate"
    if ($script:LivePublished) {
        Write-Host 'CRITICAL prod-ahead-of-git'
    }
    if (Test-Path -LiteralPath $LogFile) {
        Get-Content -LiteralPath $LogFile -Tail 20
    }
}

function Invoke-NativeLogged {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Command @Arguments *>> $LogFile
        return $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Invoke-NativeCapture {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & $Command @Arguments 2>> $LogFile
        $code = $LASTEXITCODE
        if ($null -ne $output) {
            Add-Content -LiteralPath $LogFile -Value ($output | Out-String) -Encoding utf8
        }
        return @{ Code = $code; Output = $output }
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Invoke-Git {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $code = Invoke-NativeLogged -Command 'git' -Arguments $Arguments
    if ($code -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
}

function Invoke-Wrangler {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $npx = (Get-Command npx.cmd -ErrorAction Stop).Source
    return Invoke-NativeLogged -Command $npx -Arguments (@('--yes', $WranglerPackage) + $Arguments)
}

function Invoke-WranglerCapture {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $npx = (Get-Command npx.cmd -ErrorAction Stop).Source
    return Invoke-NativeCapture -Command $npx -Arguments (@('--yes', $WranglerPackage) + $Arguments)
}

function Test-DockerReady {
    $dockerProcess = $null
    try {
        $dockerPath = (Get-Command docker -ErrorAction Stop).Source
        $dockerProcess = Start-Process `
            -FilePath $dockerPath `
            -ArgumentList @('info', '--format', '{{.ServerVersion}}') `
            -WindowStyle Hidden `
            -PassThru

        if (-not $dockerProcess.WaitForExit($DockerProbeTimeoutSeconds * 1000)) {
            Stop-Process -Id $dockerProcess.Id -Force -ErrorAction SilentlyContinue
            $dockerProcess.WaitForExit()
            return $false
        }

        return $dockerProcess.ExitCode -eq 0
    }
    catch {
        return $false
    }
    finally {
        if ($dockerProcess) { $dockerProcess.Dispose() }
    }
}

function Invoke-DockerDesktopCommand {
    param(
        [Parameter(Mandatory)][ValidateSet('start', 'restart', 'stop')][string]$Action,
        [int]$TimeoutSeconds = 20
    )

    $dockerProcess = $null
    try {
        $dockerPath = (Get-Command docker -ErrorAction Stop).Source
        $dockerProcess = Start-Process `
            -FilePath $dockerPath `
            -ArgumentList @('desktop', $Action) `
            -WindowStyle Hidden `
            -PassThru

        if (-not $dockerProcess.WaitForExit($TimeoutSeconds * 1000)) {
            Stop-Process -Id $dockerProcess.Id -Force -ErrorAction SilentlyContinue
            $dockerProcess.WaitForExit()
            return $null
        }

        return $dockerProcess.ExitCode
    }
    catch {
        return -1
    }
    finally {
        if ($dockerProcess) { $dockerProcess.Dispose() }
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

function Read-DeployExampleMap {
    $values = @{}
    foreach ($rawLine in Get-Content -LiteralPath $DeployExamplePath) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $separatorIndex = $line.IndexOf('=')
        if ($separatorIndex -lt 1) { continue }
        $values[$line.Substring(0, $separatorIndex).Trim()] = $line.Substring($separatorIndex + 1).Trim()
    }
    return $values
}

function Get-JsonPayload {
    param([Parameter(Mandatory)][string]$Text)

    $startArray = $Text.IndexOf('[')
    $startObject = $Text.IndexOf('{')
    if ($startArray -lt 0 -and $startObject -lt 0) {
        throw 'LIVE: wrangler output did not contain JSON.'
    }
    if ($startArray -lt 0) { $start = $startObject }
    elseif ($startObject -lt 0) { $start = $startArray }
    else { $start = [Math]::Min($startArray, $startObject) }
    return $Text.Substring($start) | ConvertFrom-Json
}

function Get-ProjectDomainText {
    param($Project)

    $parts = @()
    if ($Project.name) { $parts += [string]$Project.name }
    if ($Project.subdomain) { $parts += [string]$Project.subdomain }
    if ($Project.domains) { $parts += @($Project.domains | ForEach-Object { [string]$_ }) }
    if ($Project.canonical_preview) { $parts += [string]$Project.canonical_preview }
    return ($parts -join ' ')
}

function Get-PagesProjectName {
    if (-not [string]::IsNullOrWhiteSpace($env:CLOUDFLARE_PAGES_PROJECT)) {
        return $env:CLOUDFLARE_PAGES_PROJECT.Trim()
    }

    $result = Invoke-WranglerCapture -Arguments @('pages', 'project', 'list', '--json')
    if ($result.Code -ne 0) {
        throw 'LIVE: unable to list Pages projects. Set CLOUDFLARE_PAGES_PROJECT.'
    }

    $payload = Get-JsonPayload -Text ($result.Output | Out-String)
    $list = @()
    if ($payload.projects) { $list = @($payload.projects) }
    elseif ($payload -is [System.Array]) { $list = @($payload) }
    else { $list = @($payload) }

    $preferred = @('app.faderzero.com', 'faderzero.pages.dev', 'fader.pages.dev')
    foreach ($domain in $preferred) {
        foreach ($project in $list) {
            $haystack = Get-ProjectDomainText -Project $project
            if ($haystack -and $haystack.ToLowerInvariant().Contains($domain.ToLowerInvariant())) {
                return [string]$project.name
            }
        }
    }

    throw 'LIVE: no Pages project matched app.faderzero.com. Set CLOUDFLARE_PAGES_PROJECT.'
}

function Invoke-SmokeUrl {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Url
    )

    for ($attempt = 1; $attempt -le $SmokeAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 20
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-PushLog "Smoke $Name $($response.StatusCode) $Url"
                return [int]$response.StatusCode
            }
            Write-PushLog "Smoke $Name unexpected $($response.StatusCode) $Url"
        }
        catch {
            Write-PushLog "Smoke $Name attempt $attempt failed: $($_.Exception.Message)"
        }
        if ($attempt -lt $SmokeAttempts) {
            Start-Sleep -Seconds $SmokeDelaySeconds
        }
    }
    throw "LIVE: smoke $Name failed for $Url"
}

function Ensure-GitHooks {
    $hooks = Invoke-NativeCapture -Command 'git' -Arguments @('config', '--local', '--get', 'core.hooksPath')
    $current = ''
    if ($hooks.Output) { $current = ([string]$hooks.Output).Trim() }
    if ($current -eq '.githooks') { return }

    $node = (Get-Command node.exe -ErrorAction SilentlyContinue)
    if (-not $node) { $node = Get-Command node -ErrorAction Stop }
    $installer = Join-Path $RepoRoot 'scripts\install-git-hooks.mjs'
    $code = Invoke-NativeLogged -Command $node.Source -Arguments @($installer)
    if ($code -ne 0) {
        throw 'PREFLIGHT: unable to set core.hooksPath to .githooks.'
    }
}

function Ensure-DockerEngine {
    if (Test-DockerReady) { return }

    $dockerDesktopIsRunning = $null -ne (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)
    $dockerAction = if ($dockerDesktopIsRunning) { 'restart' } else { 'start' }
    $script:DockerStartedByScript = -not $dockerDesktopIsRunning
    Write-PushLog "Docker engine is unavailable; running Docker Desktop $dockerAction."
    $dockerActionExitCode = Invoke-DockerDesktopCommand -Action $dockerAction
    if ($null -ne $dockerActionExitCode -and $dockerActionExitCode -ne 0) {
        throw "Unable to $dockerAction Docker Desktop (exit code: $dockerActionExitCode)."
    }
    $deadline = (Get-Date).AddSeconds($DockerStartTimeoutSeconds)
    while (-not (Test-DockerReady)) {
        if ((Get-Date) -ge $deadline) {
            throw "Docker Desktop is unavailable after $DockerStartTimeoutSeconds seconds."
        }
        Start-Sleep -Seconds 3
    }
}

function Invoke-GitPush {
    $script:Gate = 'GIT'
    Write-Score 'GIT running'
    $pushExitCode = Invoke-NativeLogged -Command 'git' -Arguments @('push', 'origin', 'main')
    if ($pushExitCode -ne 0) {
        throw "The push or Cloudflare hook failed (log: $LogFile)."
    }

    $sync = Invoke-NativeCapture -Command 'git' -Arguments @('rev-list', '--left-right', '--count', 'origin/main...main')
    $syncCounts = ''
    if ($sync.Output) { $syncCounts = ([string]$sync.Output).Trim() }
    if ($sync.Code -ne 0 -or $syncCounts -ne "0`t0") {
        throw "The push completed but main and origin/main are not synchronized: $syncCounts"
    }
}

Push-Location $RepoRoot
try {
    if ($DockerStartTimeoutSeconds -lt 1 -or $DockerProbeTimeoutSeconds -lt 1 -or $SmokeAttempts -lt 1 -or $SmokeDelaySeconds -lt 1) {
        throw 'Timeout and retry values must be positive integers.'
    }

    Write-Score 'PUSH-CLOUDFLARE'
    Write-Score "LOG $LogFile"

    $branchResult = Invoke-NativeCapture -Command 'git' -Arguments @('branch', '--show-current')
    $branch = ''
    if ($branchResult.Output) { $branch = ([string]$branchResult.Output).Trim() }
    if ($branchResult.Code -ne 0 -or $branch -ne 'main') {
        throw "Publication cancelled: the current branch must be main (current: $branch)."
    }

    if ($GitPushOnly) {
        Invoke-GitPush
        $hash = ([string](Invoke-NativeCapture -Command 'git' -Arguments @('rev-parse', '--short', 'HEAD')).Output).Trim()
        Write-Score "GIT $hash synced"
        Write-Score 'SYNC origin/main'
        exit 0
    }

    Ensure-GitHooks

    Write-PushLog 'Fetching origin/main before publication.'
    Invoke-Git -Arguments @('fetch', 'origin', 'main')
    $divergenceResult = Invoke-NativeCapture -Command 'git' -Arguments @('rev-list', '--left-right', '--count', 'origin/main...main')
    $divergenceText = ''
    if ($divergenceResult.Output) { $divergenceText = ([string]$divergenceResult.Output).Trim() }
    $divergence = $divergenceText -split '\s+'
    if ($divergenceResult.Code -ne 0 -or $divergence.Count -ne 2) { throw 'Unable to compare main with origin/main.' }
    if ([int]$divergence[0] -gt 0) {
        throw "Publication cancelled: origin/main is ahead by $($divergence[0]) commit(s). Integrate remote changes first."
    }

    $changedPaths = @(Get-ChangedPaths)
    $sensitivePath = $null
    if ($changedPaths.Count -gt 0) {
        $sensitivePath = Find-SensitivePath -Paths $changedPaths
    }
    if ($sensitivePath) {
        throw "Publication cancelled: non-ignored sensitive file detected: $sensitivePath"
    }

    Write-PushLog 'Running the repository secret scan.'
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    $secretsCode = Invoke-NativeLogged -Command $npm -Arguments @('run', 'security:secrets')
    if ($secretsCode -ne 0) {
        throw "Publication cancelled: the secret scan failed (log: $LogFile)."
    }

    $aheadBefore = Invoke-NativeCapture -Command 'git' -Arguments @('rev-list', '--count', 'origin/main..main')
    $aheadCount = 0
    if ($aheadBefore.Output) { $aheadCount = [int]([string]$aheadBefore.Output).Trim() }
    if ($changedPaths.Count -eq 0 -and $aheadCount -eq 0) {
        Write-Score 'LOCAL SKIP'
        Write-Score 'LIVE SKIP'
        Write-Score 'GIT nothing-to-publish'
        exit 0
    }

    if ($changedPaths.Count -gt 0) {
        if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
            throw 'Publication cancelled: provide -CommitMessage for uncommitted changes.'
        }
        if ($CommitMessage.Length -gt 72 -or $CommitMessage -notmatch '^(feat|fix|test|docs|refactor|chore): .+') {
            throw 'Publication cancelled: the message must be a conventional commit of at most 72 characters.'
        }
    }

    Ensure-DockerEngine

    $script:Gate = 'LOCAL'
    Write-Score 'LOCAL running'
    $localCode = Invoke-NativeLogged -Command $npm -Arguments @('run', 'check:cloudflare')
    if ($localCode -ne 0) {
        throw "LOCAL: Cloudflare check failed (log: $LogFile)."
    }
    Write-Score 'LOCAL PASS'

    if ($changedPaths.Count -gt 0) {
        Invoke-Git -Arguments @('add', '-A')
        $whitespaceCode = Invoke-NativeLogged -Command 'git' -Arguments @('diff', '--cached', '--check')
        if ($whitespaceCode -ne 0) { throw 'Publication cancelled: the staged diff has whitespace errors.' }
        Invoke-Git -Arguments @('commit', '-m', $CommitMessage)
    }

    $aheadAfter = Invoke-NativeCapture -Command 'git' -Arguments @('rev-list', '--count', 'origin/main..main')
    $aheadCount = 0
    if ($aheadAfter.Output) { $aheadCount = [int]([string]$aheadAfter.Output).Trim() }
    if ($aheadCount -eq 0) {
        Write-Score 'LIVE SKIP'
        Write-Score 'GIT nothing-to-publish'
        exit 0
    }

    $script:Gate = 'LIVE'
    Write-Score 'LIVE running'
    $whoami = Invoke-Wrangler -Arguments @('whoami')
    if ($whoami -ne 0) {
        throw 'LIVE: wrangler whoami failed. Login or set CLOUDFLARE_API_TOKEN.'
    }

    $audioDeploy = Invoke-Wrangler -Arguments @('deploy', '--config', 'cloudflare/audio-worker/wrangler.jsonc')
    if ($audioDeploy -ne 0) { throw 'LIVE: audio worker deploy failed.' }
    $script:LivePublished = $true

    $epkDeploy = Invoke-Wrangler -Arguments @('deploy', '--config', 'cloudflare/epk-public/wrangler.jsonc')
    if ($epkDeploy -ne 0) { throw 'LIVE: EPK worker deploy failed.' }

    $distPath = Join-Path $RepoRoot 'dist'
    if (-not (Test-Path -LiteralPath $distPath)) {
        throw 'LIVE: dist is missing after the local Cloudflare check.'
    }

    $pagesProject = Get-PagesProjectName
    Write-PushLog "Pages project: $pagesProject"
    $pagesDeploy = Invoke-Wrangler -Arguments @(
        'pages', 'deploy', 'dist',
        '--project-name', $pagesProject,
        '--branch', 'main',
        '--commit-dirty=true'
    )
    if ($pagesDeploy -ne 0) { throw 'LIVE: Pages deploy failed.' }

    $deployEnv = Read-DeployExampleMap
    $audioBase = $deployEnv['VITE_AUDIO_API_URL']
    if ([string]::IsNullOrWhiteSpace($audioBase)) {
        throw 'LIVE: VITE_AUDIO_API_URL is missing from .env.deploy.example.'
    }
    $audioUrl = $audioBase.TrimEnd('/') + '/health'

    $script:SmokeApp = Invoke-SmokeUrl -Name 'app' -Url 'https://app.faderzero.com/'
    $script:SmokeAudio = Invoke-SmokeUrl -Name 'audio' -Url $audioUrl
    $script:SmokeEpk = Invoke-SmokeUrl -Name 'epk' -Url 'https://faderzero.com/fr'
    Write-Score "LIVE PASS app=$script:SmokeApp audio=$script:SmokeAudio epk=$script:SmokeEpk"

    Invoke-GitPush
    $hash = ([string](Invoke-NativeCapture -Command 'git' -Arguments @('rev-parse', '--short', 'HEAD')).Output).Trim()
    Write-Score "GIT $hash synced"
    Write-Score 'SYNC origin/main'
}
catch {
    Write-PushLog "FAILED: $($_.Exception.Message)"
    Write-FailureScoreboard
    exit 1
}
finally {
    Pop-Location
    if ($DockerStartedByScript) {
        Write-PushLog 'Stopping Docker Desktop started by this script.'
        $dockerStopExitCode = Invoke-DockerDesktopCommand -Action stop
        if ($null -eq $dockerStopExitCode) {
            Write-PushLog 'Docker Desktop stop command timed out; it may still be shutting down.'
        }
        elseif ($dockerStopExitCode -ne 0) {
            Write-PushLog "Docker Desktop stop failed with exit code $dockerStopExitCode."
        }
    }
}
