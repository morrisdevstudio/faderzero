-- Story 5.1 expand phase: establish one physical R2-file record per
-- historical key. Existing song_assets.storage_path remains authoritative for
-- legacy clients throughout the compatibility window.

CREATE TABLE IF NOT EXISTS public.audio_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    r2_key TEXT NOT NULL UNIQUE,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    mime_type TEXT NOT NULL,
    etag TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'mismatch', 'missing', 'orphaned')),
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audio_files FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.audio_file_migration_quarantine (
    r2_key TEXT PRIMARY KEY,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('missing_manifest', 'size_mismatch', 'etag_mismatch', 'orphaned_object')),
    expected_size_bytes BIGINT,
    actual_size_bytes BIGINT,
    expected_etag TEXT,
    actual_etag TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolution TEXT
);

REVOKE ALL ON TABLE private.audio_file_migration_quarantine FROM PUBLIC, anon, authenticated;

ALTER TABLE public.song_assets
    ADD COLUMN IF NOT EXISTS audio_file_id UUID;

ALTER TABLE public.song_assets
    ADD CONSTRAINT song_assets_audio_file_fkey
    FOREIGN KEY (audio_file_id)
    REFERENCES public.audio_files(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    NOT VALID;

CREATE INDEX IF NOT EXISTS idx_song_assets_audio_file_id
    ON public.song_assets(audio_file_id);

-- This insert is idempotent and preserves every historical R2 key exactly as
-- it is. It deliberately includes tombstones so restoring an old asset never
-- requires recreating or moving its physical object.
INSERT INTO public.audio_files (r2_key, size_bytes, mime_type)
SELECT storage_path, size_bytes, mime_type
FROM public.song_assets
ON CONFLICT (r2_key) DO NOTHING;

-- The compatibility column storage_path is intentionally retained. A missing
-- audio_file_id is therefore recoverable and does not interrupt legacy reads.
UPDATE public.song_assets AS assets
SET audio_file_id = files.id
FROM public.audio_files AS files
WHERE assets.storage_path = files.r2_key
  AND assets.audio_file_id IS NULL;

-- Any unexpected gap is recorded for review rather than deleted or guessed.
INSERT INTO private.audio_file_migration_quarantine (r2_key, issue_type)
SELECT assets.storage_path, 'missing_manifest'
FROM public.song_assets AS assets
LEFT JOIN public.audio_files AS files ON files.id = assets.audio_file_id
WHERE files.id IS NULL
ON CONFLICT (r2_key) DO UPDATE
SET detected_at = now(), resolved_at = NULL, resolution = NULL;
