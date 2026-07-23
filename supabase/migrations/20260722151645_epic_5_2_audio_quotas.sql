-- Story 5.2 expand phase: quota reservations are additive. Existing audio is
-- counted from song_assets; no historical record or R2 object is rewritten.

CREATE TABLE IF NOT EXISTS private.audio_upload_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    requested_bytes BIGINT NOT NULL CHECK (requested_bytes > 0),
    requested_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'reserved'
        CHECK (status IN ('reserved', 'completed', 'released', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audio_upload_reservations_active
    ON private.audio_upload_reservations(workspace_id, expires_at)
    WHERE status IN ('reserved', 'completed');

REVOKE ALL ON TABLE private.audio_upload_reservations FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_audio_upload(
    p_workspace_id UUID,
    p_requested_bytes BIGINT,
    p_requested_seconds INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    workspace_kind TEXT;
    used_amount BIGINT;
    reserved_amount BIGINT;
    limit_amount BIGINT;
    reservation_id UUID;
BEGIN
    IF p_requested_bytes <= 0 OR p_requested_bytes > 52428800
       OR (p_requested_seconds IS NOT NULL AND p_requested_seconds < 0) THEN
        RAISE EXCEPTION 'invalid audio reservation request';
    END IF;

    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin', 'member']::TEXT[]) THEN
        RAISE EXCEPTION 'forbidden';
    END IF;

    -- Serialize concurrent reservations per workspace without locking audio rows.
    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;
    SELECT workspace_type INTO STRICT workspace_kind FROM public.workspaces WHERE id = p_workspace_id;

    UPDATE private.audio_upload_reservations
    SET status = 'expired', released_at = now()
    WHERE workspace_id = p_workspace_id AND status = 'reserved' AND expires_at <= now();

    -- A completed reservation bridges the gap between the R2 upload and the
    -- offline-first song_asset sync. Release it as soon as that logical record
    -- is visible so the same audio is never counted twice.
    UPDATE private.audio_upload_reservations AS reservations
    SET status = 'released', released_at = now()
    WHERE reservations.workspace_id = p_workspace_id
      AND reservations.status = 'completed'
      AND EXISTS (
          SELECT 1
          FROM public.song_assets AS assets
          WHERE assets.workspace_id = reservations.workspace_id
            AND assets.storage_path = reservations.storage_path
      );

    IF workspace_kind = 'personal' THEN
        IF p_requested_seconds IS NULL THEN
            RAISE EXCEPTION 'audio duration required for personal workspace';
        END IF;
        limit_amount := 3600;
        SELECT COALESCE(sum(COALESCE(duration_seconds, 0)), 0) INTO used_amount
        FROM public.song_assets WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;
        SELECT COALESCE(sum(COALESCE(requested_seconds, 0)), 0) INTO reserved_amount
        FROM private.audio_upload_reservations
        WHERE workspace_id = p_workspace_id
          AND (status = 'completed' OR (status = 'reserved' AND expires_at > now()));
        IF used_amount + reserved_amount + COALESCE(p_requested_seconds, 0) > limit_amount THEN
            RAISE EXCEPTION 'audio quota exceeded';
        END IF;
    ELSE
        limit_amount := 5368709120;
        SELECT COALESCE(sum(size_bytes), 0) INTO used_amount
        FROM public.song_assets WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;
        SELECT COALESCE(sum(requested_bytes), 0) INTO reserved_amount
        FROM private.audio_upload_reservations
        WHERE workspace_id = p_workspace_id
          AND (status = 'completed' OR (status = 'reserved' AND expires_at > now()));
        IF used_amount + reserved_amount + p_requested_bytes > limit_amount THEN
            RAISE EXCEPTION 'audio quota exceeded';
        END IF;
    END IF;

    INSERT INTO private.audio_upload_reservations (workspace_id, user_id, requested_bytes, requested_seconds)
    VALUES (p_workspace_id, auth.uid(), p_requested_bytes, p_requested_seconds)
    RETURNING id INTO reservation_id;
    RETURN reservation_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_audio_upload(UUID, BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_audio_upload(UUID, BIGINT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_audio_upload_reservation(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    UPDATE private.audio_upload_reservations
    SET status = 'released', released_at = now()
    WHERE id = p_reservation_id
      AND user_id = auth.uid()
      AND status = 'reserved';
END;
$function$;

REVOKE ALL ON FUNCTION public.release_audio_upload_reservation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_audio_upload_reservation(UUID) TO authenticated;
