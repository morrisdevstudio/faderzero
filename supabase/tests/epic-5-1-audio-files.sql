-- Story 5.1 post-migration integrity checks. This script is read-only.

DO $$
DECLARE
    asset_count BIGINT;
    linked_count BIGINT;
    missing_link_count BIGINT;
    duplicate_key_count BIGINT;
BEGIN
    SELECT count(*) INTO asset_count FROM public.song_assets;
    SELECT count(*) INTO linked_count FROM public.song_assets WHERE audio_file_id IS NOT NULL;
    SELECT count(*) INTO missing_link_count FROM public.song_assets WHERE audio_file_id IS NULL;
    SELECT count(*) - count(DISTINCT r2_key) INTO duplicate_key_count FROM public.audio_files;

    IF missing_link_count <> 0 THEN
        RAISE EXCEPTION 'Story 5.1 failed: % song_assets without audio_file_id', missing_link_count;
    END IF;

    IF asset_count <> linked_count THEN
        RAISE EXCEPTION 'Story 5.1 failed: asset/link count mismatch (%/%).', asset_count, linked_count;
    END IF;

    IF duplicate_key_count <> 0 THEN
        RAISE EXCEPTION 'Story 5.1 failed: duplicate physical R2 keys found.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.song_assets AS assets
        JOIN public.audio_files AS files ON files.id = assets.audio_file_id
        WHERE assets.storage_path <> files.r2_key
    ) THEN
        RAISE EXCEPTION 'Story 5.1 failed: storage_path changed during backfill.';
    END IF;
END;
$$;
