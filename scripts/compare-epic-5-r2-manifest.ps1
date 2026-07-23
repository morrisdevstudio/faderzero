param(
    [string]$ManifestPath = ".\docs\reports\R2_MANIFEST_FADERZERO_2026-07-20.csv",
    [string]$OutputPath = ".\docs\reports\EPIC_5_1_R2_COMPARISON_2026-07-22.csv",
    [string]$DatabaseContainer = "supabase_db_pwa"
)

$ErrorActionPreference = "Stop"

if ($DatabaseContainer -ne "supabase_db_pwa") {
    throw "Ce script refuse toute cible autre que la base Supabase locale supabase_db_pwa."
}

$resolvedManifest = (Resolve-Path -LiteralPath $ManifestPath).Path
$workspace = (Resolve-Path -LiteralPath ".").Path
$resolvedOutput = [IO.Path]::GetFullPath((Join-Path $workspace $OutputPath))
if (-not $resolvedOutput.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar)) {
    throw "Le rapport doit rester dans le workspace."
}

$query = @"
SELECT
  files.r2_key,
  files.size_bytes,
  COALESCE(files.etag, '') AS etag,
  COALESCE(assets.storage_path, '') AS storage_path,
  files.verification_status
FROM public.audio_files AS files
LEFT JOIN public.song_assets AS assets ON assets.audio_file_id = files.id
ORDER BY files.r2_key
"@

$databaseCsv = & docker exec $DatabaseContainer psql -U postgres -d postgres -X --csv -c $query
if ($LASTEXITCODE -ne 0) {
    throw "Lecture de la base Supabase locale impossible."
}

$manifest = Import-Csv -LiteralPath $resolvedManifest
$database = $databaseCsv | ConvertFrom-Csv
$manifestByKey = @{}
$databaseByKey = @{}
$manifest | ForEach-Object { $manifestByKey[$_.key] = $_ }
$database | ForEach-Object { $databaseByKey[$_.r2_key] = $_ }

$allKeys = @($manifestByKey.Keys + $databaseByKey.Keys | Sort-Object -Unique)
$issues = foreach ($key in $allKeys) {
    $manifestRow = $manifestByKey[$key]
    $databaseRow = $databaseByKey[$key]

    if ($null -eq $manifestRow) {
        [pscustomobject]@{ key = $key; issue = "missing_r2_manifest_object"; manifest_size = ""; database_size = $databaseRow.size_bytes; manifest_etag = ""; database_etag = $databaseRow.etag }
        continue
    }
    if ($null -eq $databaseRow) {
        [pscustomobject]@{ key = $key; issue = "orphaned_r2_object"; manifest_size = $manifestRow.size; database_size = ""; manifest_etag = $manifestRow.etag; database_etag = "" }
        continue
    }
    if ([int64]$manifestRow.size -ne [int64]$databaseRow.size_bytes) {
        [pscustomobject]@{ key = $key; issue = "size_mismatch"; manifest_size = $manifestRow.size; database_size = $databaseRow.size_bytes; manifest_etag = $manifestRow.etag; database_etag = $databaseRow.etag }
    }
    if ([string]::IsNullOrWhiteSpace($databaseRow.etag)) {
        [pscustomobject]@{ key = $key; issue = "etag_unverified"; manifest_size = $manifestRow.size; database_size = $databaseRow.size_bytes; manifest_etag = $manifestRow.etag; database_etag = "" }
    } elseif ($manifestRow.etag.Trim('"') -ne $databaseRow.etag.Trim('"')) {
        [pscustomobject]@{ key = $key; issue = "etag_mismatch"; manifest_size = $manifestRow.size; database_size = $databaseRow.size_bytes; manifest_etag = $manifestRow.etag; database_etag = $databaseRow.etag }
    }
}

$outputDirectory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}
@($issues) | Export-Csv -LiteralPath $resolvedOutput -NoTypeInformation -Encoding utf8

Write-Output "Manifest objects: $($manifest.Count)"
Write-Output "Database audio_files: $($database.Count)"
Write-Output "Logged divergences: $(@($issues).Count)"
Write-Output "Report: $resolvedOutput"
