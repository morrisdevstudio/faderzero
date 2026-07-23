[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$requiredFiles = @(
    'docs/PLAN_IMPLEMENTATION_GLOBAL_FADERZERO.md',
    'docs/SPRINT_STATUS_FADERZERO.yaml',
    'docs/stories/_TEMPLATE.md',
    'docs/AUDIT_SECURITE_FADERZERO.md',
    'docs/FONCTIONNALITES_FADERZERO.md',
    'docs/VALIDATION_COMMANDS_FADERZERO.md'
)

foreach ($relativePath in $requiredFiles) {
    $absolutePath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        throw "Artefact manquant : $relativePath"
    }
}

$statusPath = Join-Path $repoRoot 'docs/SPRINT_STATUS_FADERZERO.yaml'
$status = Get-Content -Raw -LiteralPath $statusPath

foreach ($epic in 0..10) {
    if ($status -notmatch "(?m)^\s*- id: $epic\s*$") {
        throw "Epic absent du sprint status : $epic"
    }
}

$expectedStories = @(
    '0.1','0.2','0.3','0.4',
    '1.1','1.2','1.3','1.4','1.5',
    '2.1','2.2','2.3','2.4',
    '3.1','3.2','3.3','3.4','3.5',
    '4.1','4.2','4.3','4.4',
    '5.1','5.2','5.3','5.4','5.5',
    '6.1','6.2','6.3','6.4',
    '7.1','7.2','7.3','7.4',
    '8.1','8.2','8.3','8.4','8.5',
    '9.1','9.2','9.3','9.4',
    '10.1','10.2','10.3'
)

foreach ($story in $expectedStories) {
    $escapedStory = [regex]::Escape($story)
    if ($status -notmatch "id:\s*`"$escapedStory`"") {
        throw "Story absente du sprint status : $story"
    }
}

$allowedStatuses = @('backlog','ready','in-progress','review','user-validation','done')
$declaredStatuses = [regex]::Matches($status, 'status:\s*([a-z-]+)') |
    ForEach-Object { $_.Groups[1].Value } |
    Select-Object -Unique

foreach ($declaredStatus in $declaredStatuses) {
    if ($declaredStatus -notin $allowedStatuses) {
        throw "Statut non autorisé : $declaredStatus"
    }
}

$planPath = Join-Path $repoRoot 'docs/PLAN_IMPLEMENTATION_GLOBAL_FADERZERO.md'
$plan = Get-Content -Raw -LiteralPath $planPath
foreach ($sourceLink in @('./AUDIT_SECURITE_FADERZERO.md', './FONCTIONNALITES_FADERZERO.md')) {
    if (-not $plan.Contains($sourceLink)) {
        throw "Lien source absent du plan : $sourceLink"
    }
}

Write-Output "OK - 11 epics, $($expectedStories.Count) stories et liens sources validés."
