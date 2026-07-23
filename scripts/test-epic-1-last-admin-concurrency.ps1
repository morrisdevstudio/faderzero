param(
    [string]$Container = 'supabase_db_pwa',
    [string]$Database = 'postgres'
)

$ErrorActionPreference = 'Stop'
$docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path -LiteralPath $docker)) {
    $docker = (Get-Command docker -ErrorAction Stop).Source
}

$setup = Join-Path $PSScriptRoot '..\supabase\tests\epic-1-last-admin-setup.sql'
$cleanup = Join-Path $PSScriptRoot '..\supabase\tests\epic-1-last-admin-cleanup.sql'

& $docker cp $setup "${Container}:/tmp/epic-1-last-admin-setup.sql"
if ($LASTEXITCODE -ne 0) { throw 'Impossible de copier le setup de concurrence.' }
& $docker cp $cleanup "${Container}:/tmp/epic-1-last-admin-cleanup.sql"
if ($LASTEXITCODE -ne 0) { throw 'Impossible de copier le cleanup de concurrence.' }

try {
    & $docker exec $Container psql -U postgres -d $Database -X -v ON_ERROR_STOP=1 -f /tmp/epic-1-last-admin-setup.sql
    if ($LASTEXITCODE -ne 0) { throw 'Le setup de concurrence a échoué.' }

    $workspaceId = '20000000-0000-4000-8000-000000000002'
    $users = @(
        '10000000-0000-4000-8000-000000000005',
        '10000000-0000-4000-8000-000000000006'
    )

    $jobs = foreach ($userId in $users) {
        Start-Job -ScriptBlock {
            param($DockerPath, $ContainerName, $DatabaseName, $Workspace, $User)
            $sql = "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '$User', true); SELECT public.set_workspace_member_role('$Workspace', '$User', 'member'); COMMIT;"
            $output = & $DockerPath exec $ContainerName psql -U postgres -d $DatabaseName -X -v ON_ERROR_STOP=1 -Atc $sql 2>&1
            [pscustomobject]@{
                User = $User
                ExitCode = $LASTEXITCODE
                Output = ($output -join "`n")
            }
        } -ArgumentList $docker, $Container, $Database, $workspaceId, $userId
    }

    $results = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job -Force

    $successes = @($results | Where-Object ExitCode -eq 0)
    $failures = @($results | Where-Object ExitCode -ne 0)
    if ($successes.Count -ne 1 -or $failures.Count -ne 1) {
        $results | Format-List | Out-String | Write-Host
        throw "Résultat concurrent inattendu : succès=$($successes.Count), échecs=$($failures.Count)."
    }
    if ($failures[0].Output -notmatch 'LAST_ADMIN_REQUIRED') {
        throw "L'échec concurrent ne protège pas le dernier admin : $($failures[0].Output)"
    }

    $counts = & $docker exec $Container psql -U postgres -d $Database -X -Atc "SELECT count(*) FILTER (WHERE role IN ('owner','admin')) || ',' || count(*) FILTER (WHERE role = 'member') FROM public.workspace_members WHERE workspace_id = '$workspaceId';"
    if ($LASTEXITCODE -ne 0 -or $counts.Trim() -ne '1,1') {
        throw "Comptage final inattendu : $counts"
    }

    Write-Host 'OK: une rétrogradation réussit, la seconde est refusée, il reste 1 admin et 1 membre.'
}
finally {
    & $docker exec $Container psql -U postgres -d $Database -X -v ON_ERROR_STOP=1 -f /tmp/epic-1-last-admin-cleanup.sql
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'Le nettoyage des données de test de concurrence a échoué.'
    }
}
