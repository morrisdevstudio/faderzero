\set ON_ERROR_STOP on
BEGIN READ ONLY;

SELECT metric, value
FROM (
    SELECT 'observed_clients'::TEXT AS metric, count(*)::BIGINT AS value
    FROM private.client_compatibility_observations

    UNION ALL
    SELECT 'observed_versions', count(DISTINCT app_version)
    FROM private.client_compatibility_observations

    UNION ALL
    SELECT 'users_without_observation', count(*)
    FROM auth.users AS users
    WHERE NOT EXISTS (
        SELECT 1
        FROM private.client_compatibility_observations AS observations
        WHERE observations.user_id = users.id
    )

    UNION ALL
    SELECT 'stale_observed_clients', count(*)
    FROM private.client_compatibility_observations
    WHERE last_seen_at < now() - interval '30 days'

    UNION ALL
    SELECT 'clients_recovery_required', count(*)
    FROM private.client_compatibility_observations
    WHERE migration_status <> 'completed' OR recovery_item_count > 0

    UNION ALL
    SELECT 'owner_roles', count(*)
    FROM public.workspace_members
    WHERE role = 'owner'

    UNION ALL
    SELECT 'plaintext_invite_tokens', count(*)
    FROM public.workspace_invites
    WHERE token IS NOT NULL AND token <> ''

    UNION ALL
    SELECT 'assets_without_audio_file', count(*)
    FROM public.song_assets
    WHERE audio_file_id IS NULL

    UNION ALL
    SELECT 'workspace_integrity_quarantine_unresolved', count(*)
    FROM private.workspace_integrity_quarantine
    WHERE resolved_at IS NULL

    UNION ALL
    SELECT 'audio_quarantine_unresolved', count(*)
    FROM private.audio_file_migration_quarantine
    WHERE resolved_at IS NULL
) AS observations
ORDER BY metric;

SELECT
    app_version,
    min(first_seen_at) AS first_seen_at,
    max(last_seen_at) AS last_seen_at,
    count(*) AS clients,
    count(*) FILTER (
        WHERE migration_status <> 'completed' OR recovery_item_count > 0
    ) AS clients_requiring_recovery
FROM private.client_compatibility_observations
GROUP BY app_version
ORDER BY first_seen_at;

ROLLBACK;
