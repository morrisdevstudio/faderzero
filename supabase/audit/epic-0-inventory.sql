-- Epic 0 / Story 0.2 — inventaire strictement en lecture seule.
-- Exécuter avec un rôle d'audit SELECT-only sur une copie ou pendant une fenêtre figée.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name,
       current_setting('server_version') AS server_version,
       transaction_timestamp() AS inventory_started_at;

SELECT 'auth.users' AS relation, count(*) AS total, 0::bigint AS tombstones FROM auth.users
UNION ALL SELECT 'public.profiles', count(*), 0 FROM public.profiles
UNION ALL SELECT 'public.workspaces', count(*), 0 FROM public.workspaces
UNION ALL SELECT 'public.workspace_members', count(*), 0 FROM public.workspace_members
UNION ALL SELECT 'public.workspace_invites', count(*), 0 FROM public.workspace_invites
UNION ALL SELECT 'public.songs', count(*), count(*) FILTER (WHERE deleted_at IS NOT NULL) FROM public.songs
UNION ALL SELECT 'public.setlists', count(*), count(*) FILTER (WHERE deleted_at IS NOT NULL) FROM public.setlists
UNION ALL SELECT 'public.setlist_songs', count(*), count(*) FILTER (WHERE deleted_at IS NOT NULL) FROM public.setlist_songs
UNION ALL SELECT 'public.song_assets', count(*), count(*) FILTER (WHERE deleted_at IS NOT NULL) FROM public.song_assets
ORDER BY relation;

SELECT role, count(*) AS memberships
FROM public.workspace_members
GROUP BY role
ORDER BY role;

SELECT status, count(*) AS invitations
FROM public.workspace_invites
GROUP BY status
ORDER BY status;

-- Doublons et anomalies : une sortie vide est attendue.
SELECT 'duplicate_membership' AS anomaly, workspace_id::text AS parent_id, user_id::text AS child_id, count(*) AS occurrences
FROM public.workspace_members
GROUP BY workspace_id, user_id
HAVING count(*) > 1
UNION ALL
SELECT 'setlist_song_cross_workspace', ss.setlist_id, ss.id, 1
FROM public.setlist_songs ss
JOIN public.setlists sl ON sl.id = ss.setlist_id
WHERE sl.workspace_id <> ss.workspace_id
UNION ALL
SELECT 'song_asset_cross_workspace', sa.song_id, sa.id, 1
FROM public.song_assets sa
JOIN public.songs s ON s.id = sa.song_id
WHERE sa.song_id IS NOT NULL AND s.workspace_id <> sa.workspace_id
ORDER BY anomaly, parent_id, child_id;

SELECT lower(btrim(name)) AS normalized_name, count(*) AS occurrences,
       array_agg(id ORDER BY id) AS workspace_ids
FROM public.workspaces
GROUP BY lower(btrim(name))
HAVING count(*) > 1
ORDER BY normalized_name;

SELECT id, workspace_id, song_id, storage_path, size_bytes, mime_type, deleted_at
FROM public.song_assets
ORDER BY storage_path, id;

-- Empreinte logique stable pour comparer deux exécutions sur une source figée.
SELECT md5(string_agg(row_fingerprint, '' ORDER BY relation_name, row_fingerprint)) AS logical_inventory_md5
FROM (
    SELECT 'workspace_members' AS relation_name,
           md5(concat_ws('|', id, workspace_id, user_id, role, created_at, updated_at)) AS row_fingerprint
    FROM public.workspace_members
    UNION ALL
    SELECT 'songs', md5(concat_ws('|', id, workspace_id, title, artist, updated_at, deleted_at, server_version)) FROM public.songs
    UNION ALL
    SELECT 'setlists', md5(concat_ws('|', id, workspace_id, name, updated_at, deleted_at, server_version)) FROM public.setlists
    UNION ALL
    SELECT 'setlist_songs', md5(concat_ws('|', id, workspace_id, setlist_id, song_id, position, updated_at, deleted_at, server_version)) FROM public.setlist_songs
    UNION ALL
    SELECT 'song_assets', md5(concat_ws('|', id, workspace_id, song_id, storage_path, size_bytes, updated_at, deleted_at, server_version)) FROM public.song_assets
) fingerprints;

COMMIT;
