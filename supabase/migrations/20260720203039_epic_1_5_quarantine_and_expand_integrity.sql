-- Story 1.5 expand phase: record anomalies, repair only unambiguous links,
-- then add composite foreign keys without validating them yet.

CREATE TABLE IF NOT EXISTS private.workspace_integrity_quarantine (
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolution TEXT,
    PRIMARY KEY (entity_table, entity_id, issue_type)
);

CREATE TABLE IF NOT EXISTS private.workspace_integrity_repair_journal (
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_workspace_id UUID NOT NULL,
    new_workspace_id UUID NOT NULL,
    reason TEXT NOT NULL,
    repaired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (entity_table, entity_id)
);

REVOKE ALL ON TABLE
    private.workspace_integrity_quarantine,
    private.workspace_integrity_repair_journal
FROM PUBLIC, anon, authenticated;

-- A setlist item is repairable only when its setlist and optional song agree.
INSERT INTO private.workspace_integrity_quarantine (
    entity_table,
    entity_id,
    issue_type,
    snapshot
)
SELECT
    'setlist_songs',
    links.id,
    'parents_in_different_workspaces',
    jsonb_build_object(
        'row', to_jsonb(links),
        'setlist_workspace_id', setlists.workspace_id,
        'song_workspace_id', songs.workspace_id
    )
FROM public.setlist_songs AS links
JOIN public.setlists AS setlists ON setlists.id = links.setlist_id
JOIN public.songs AS songs ON songs.id = links.song_id
WHERE setlists.workspace_id <> songs.workspace_id
ON CONFLICT (entity_table, entity_id, issue_type) DO UPDATE
SET snapshot = EXCLUDED.snapshot, detected_at = now();

WITH repairable AS (
    SELECT
        links.id,
        links.workspace_id AS old_workspace_id,
        setlists.workspace_id AS new_workspace_id
    FROM public.setlist_songs AS links
    JOIN public.setlists AS setlists ON setlists.id = links.setlist_id
    LEFT JOIN public.songs AS songs ON songs.id = links.song_id
    WHERE links.workspace_id <> setlists.workspace_id
      AND (links.song_id IS NULL OR songs.workspace_id = setlists.workspace_id)
), journaled AS (
    INSERT INTO private.workspace_integrity_repair_journal (
        entity_table,
        entity_id,
        old_workspace_id,
        new_workspace_id,
        reason
    )
    SELECT
        'setlist_songs',
        repairable.id,
        repairable.old_workspace_id,
        repairable.new_workspace_id,
        'setlist and optional song agree on workspace'
    FROM repairable
    ON CONFLICT (entity_table, entity_id) DO NOTHING
    RETURNING entity_id, new_workspace_id
)
UPDATE public.setlist_songs AS links
SET workspace_id = journaled.new_workspace_id
FROM journaled
WHERE links.id = journaled.entity_id;

-- Audio links are repaired only when the existing R2 key already names the
-- song workspace. Otherwise both interpretations are retained for review.
INSERT INTO private.workspace_integrity_quarantine (
    entity_table,
    entity_id,
    issue_type,
    snapshot
)
SELECT
    'song_assets',
    assets.id,
    'workspace_differs_from_song',
    jsonb_build_object(
        'row', to_jsonb(assets),
        'song_workspace_id', songs.workspace_id
    )
FROM public.song_assets AS assets
JOIN public.songs AS songs ON songs.id = assets.song_id
WHERE assets.workspace_id <> songs.workspace_id
  AND assets.storage_path NOT LIKE 'workspaces/' || songs.workspace_id::TEXT || '/%'
ON CONFLICT (entity_table, entity_id, issue_type) DO UPDATE
SET snapshot = EXCLUDED.snapshot, detected_at = now();

WITH repairable AS (
    SELECT
        assets.id,
        assets.workspace_id AS old_workspace_id,
        songs.workspace_id AS new_workspace_id
    FROM public.song_assets AS assets
    JOIN public.songs AS songs ON songs.id = assets.song_id
    WHERE assets.workspace_id <> songs.workspace_id
      AND assets.storage_path LIKE 'workspaces/' || songs.workspace_id::TEXT || '/%'
), journaled AS (
    INSERT INTO private.workspace_integrity_repair_journal (
        entity_table,
        entity_id,
        old_workspace_id,
        new_workspace_id,
        reason
    )
    SELECT
        'song_assets',
        repairable.id,
        repairable.old_workspace_id,
        repairable.new_workspace_id,
        'song relation and R2 key agree on workspace'
    FROM repairable
    ON CONFLICT (entity_table, entity_id) DO NOTHING
    RETURNING entity_id, new_workspace_id
)
UPDATE public.song_assets AS assets
SET workspace_id = journaled.new_workspace_id
FROM journaled
WHERE assets.id = journaled.entity_id;

CREATE UNIQUE INDEX IF NOT EXISTS songs_workspace_id_id_unique
    ON public.songs (workspace_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS setlists_workspace_id_id_unique
    ON public.setlists (workspace_id, id);

ALTER TABLE public.setlist_songs
    ADD CONSTRAINT setlist_songs_workspace_setlist_fkey
    FOREIGN KEY (workspace_id, setlist_id)
    REFERENCES public.setlists (workspace_id, id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.setlist_songs
    ADD CONSTRAINT setlist_songs_workspace_song_fkey
    FOREIGN KEY (workspace_id, song_id)
    REFERENCES public.songs (workspace_id, id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL (song_id)
    NOT VALID;

ALTER TABLE public.song_assets
    ADD CONSTRAINT song_assets_workspace_song_fkey
    FOREIGN KEY (workspace_id, song_id)
    REFERENCES public.songs (workspace_id, id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL (song_id)
    NOT VALID;
