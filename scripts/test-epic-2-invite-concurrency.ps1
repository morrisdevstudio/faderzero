param(
    [string]$SupabaseCli,
    [string]$Workdir = (Join-Path $PSScriptRoot '..')
)

$ErrorActionPreference = 'Stop'

if (-not $SupabaseCli) {
    $command = Get-Command supabase -ErrorAction SilentlyContinue
    if ($command) {
        $SupabaseCli = $command.Source
    } else {
        $SupabaseCli = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'npm-cache\_npx') -Recurse -Filter supabase.exe -ErrorAction SilentlyContinue |
            Where-Object FullName -Like '*@supabase\cli-windows-x64\bin\supabase.exe' |
            Select-Object -First 1 -ExpandProperty FullName
    }
}

if (-not $SupabaseCli -or -not (Test-Path -LiteralPath $SupabaseCli)) {
    throw 'Supabase CLI est introuvable.'
}

$setup = Join-Path $Workdir 'supabase\tests\epic-2-invite-concurrency-setup.sql'
$cleanup = Join-Path $Workdir 'supabase\tests\epic-2-invite-concurrency-cleanup.sql'
$users = @(
    '12000000-0000-4000-8000-000000000005',
    '12000000-0000-4000-8000-000000000006'
)

$env:SUPABASE_TELEMETRY_DISABLED = 'true'
$env:DO_NOT_TRACK = '1'

& $SupabaseCli db query --local --file $setup --workdir $Workdir
if ($LASTEXITCODE -ne 0) { throw 'Le setup du test concurrent a échoué.' }

try {
    $jobs = foreach ($userId in $users) {
        Start-Job -ScriptBlock {
            param($CliPath, $ProjectPath, $User)
            $env:SUPABASE_TELEMETRY_DISABLED = 'true'
            $env:DO_NOT_TRACK = '1'
            $sql = "SELECT accepted.* FROM (SELECT set_config('request.jwt.claim.sub', '$User', true)) AS claims CROSS JOIN LATERAL public.accept_workspace_invite('epic-2-concurrent-token') AS accepted"
            $output = & $CliPath db query --local $sql --workdir $ProjectPath 2>&1
            [pscustomobject]@{
                User = $User
                ExitCode = $LASTEXITCODE
                Output = ($output -join "`n")
            }
        } -ArgumentList $SupabaseCli, $Workdir, $userId
    }

    $results = $jobs | Wait-Job | Receive-Job
    $jobs | Remove-Job -Force

    $successes = @($results | Where-Object ExitCode -eq 0)
    $failures = @($results | Where-Object ExitCode -ne 0)
    if ($successes.Count -ne 1 -or $failures.Count -ne 1) {
        $results | Format-List | Out-String | Write-Host
        throw "Résultat concurrent inattendu : succès=$($successes.Count), échecs=$($failures.Count)."
    }
    if ($failures[0].Output -notmatch 'INVITE_UNAVAILABLE') {
        throw "L'échec concurrent n'est pas un refus d'invitation consommée : $($failures[0].Output)"
    }

    $verification = @'
DO $verify$
BEGIN
    IF (SELECT count(*) FROM public.workspace_members
        WHERE workspace_id = '22000000-0000-4000-8000-000000000002'
          AND user_id IN (
              '12000000-0000-4000-8000-000000000005',
              '12000000-0000-4000-8000-000000000006'
          )) <> 1 THEN
        RAISE EXCEPTION 'CONCURRENT_MEMBERSHIP_COUNT_INVALID';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.workspace_invites
        WHERE id = '42000000-0000-4000-8000-000000000002'
          AND status = 'accepted'
          AND consumed_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'CONCURRENT_INVITE_NOT_CONSUMED';
    END IF;
END;
$verify$
'@
    & $SupabaseCli db query --local $verification --workdir $Workdir
    if ($LASTEXITCODE -ne 0) { throw 'La vérification du test concurrent a échoué.' }

    Write-Host 'OK: une seule consommation concurrente réussit et un seul membre est créé.'
}
finally {
    & $SupabaseCli db query --local --file $cleanup --workdir $Workdir
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'Le nettoyage du test concurrent a échoué.'
    }
}
