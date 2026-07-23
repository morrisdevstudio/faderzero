-- Epic 5 cutover: bind R2 uploads to quota reservations, expose read-only
-- quota usage, enforce concurrency/rate limits and quarantine orphan keys.

ALTER TABLE private.audio_upload_reservations
    DROP CONSTRAINT IF EXISTS audio_upload_reservations_status_check;

ALTER TABLE private.audio_upload_reservations
    ADD CONSTRAINT audio_upload_reservations_status_check
    CHECK (status IN ('reserved', 'uploading', 'completed', 'released', 'expired'));

ALTER TABLE private.audio_upload_reservations
    ADD COLUMN IF NOT EXISTS upload_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ip_hash TEXT;

DROP INDEX IF EXISTS private.idx_audio_upload_reservations_active;
CREATE INDEX idx_audio_upload_reservations_active
    ON private.audio_upload_reservations(workspace_id, expires_at)
    WHERE status IN ('reserved', 'uploading', 'completed');

CREATE TABLE IF NOT EXISTS private.audio_upload_rate_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_hash TEXT NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audio_upload_rate_events_recent_user
    ON private.audio_upload_rate_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_upload_rate_events_recent_ip
    ON private.audio_upload_rate_events(ip_hash, created_at DESC);

REVOKE ALL ON TABLE private.audio_upload_rate_events FROM PUBLIC, anon, authenticated;

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
       OR p_requested_seconds IS NULL OR p_requested_seconds <= 0 THEN
        RAISE EXCEPTION 'invalid audio reservation request';
    END IF;

    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin', 'member']::TEXT[]) THEN
        RAISE EXCEPTION 'forbidden';
    END IF;

    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;
    SELECT workspace_type INTO STRICT workspace_kind
    FROM public.workspaces WHERE id = p_workspace_id;

    UPDATE private.audio_upload_reservations
    SET status = 'expired', released_at = now()
    WHERE workspace_id = p_workspace_id
      AND status IN ('reserved', 'uploading')
      AND expires_at <= now();

    UPDATE private.audio_upload_reservations AS reservations
    SET status = 'released', released_at = now()
    WHERE reservations.workspace_id = p_workspace_id
      AND reservations.status = 'completed'
      AND EXISTS (
          SELECT 1 FROM public.song_assets AS assets
          WHERE assets.workspace_id = reservations.workspace_id
            AND assets.storage_path = reservations.storage_path
      );

    IF workspace_kind = 'personal' THEN
        limit_amount := 3600;
        SELECT COALESCE(sum(COALESCE(duration_seconds, 0)), 0)
        INTO used_amount
        FROM public.song_assets
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

        SELECT COALESCE(sum(COALESCE(requested_seconds, 0)), 0)
        INTO reserved_amount
        FROM private.audio_upload_reservations
        WHERE workspace_id = p_workspace_id
          AND (status = 'completed' OR (status IN ('reserved', 'uploading') AND expires_at > now()));

        IF used_amount + reserved_amount + p_requested_seconds > limit_amount THEN
            RAISE EXCEPTION 'audio quota exceeded';
        END IF;
    ELSE
        limit_amount := 5368709120;
        SELECT COALESCE(sum(size_bytes), 0)
        INTO used_amount
        FROM public.song_assets
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

        SELECT COALESCE(sum(requested_bytes), 0)
        INTO reserved_amount
        FROM private.audio_upload_reservations
        WHERE workspace_id = p_workspace_id
          AND (status = 'completed' OR (status IN ('reserved', 'uploading') AND expires_at > now()));

        IF used_amount + reserved_amount + p_requested_bytes > limit_amount THEN
            RAISE EXCEPTION 'audio quota exceeded';
        END IF;
    END IF;

    INSERT INTO private.audio_upload_reservations (
        workspace_id, user_id, requested_bytes, requested_seconds
    ) VALUES (
        p_workspace_id, auth.uid(), p_requested_bytes, p_requested_seconds
    ) RETURNING id INTO reservation_id;

    RETURN reservation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.begin_audio_upload(
    p_reservation_id UUID,
    p_workspace_id UUID,
    p_requested_bytes BIGINT,
    p_ip_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_id UUID := auth.uid();
    reservation_record private.audio_upload_reservations%ROWTYPE;
    user_upload_count INTEGER;
    workspace_upload_count INTEGER;
    user_rate_count INTEGER;
    ip_rate_count INTEGER;
BEGIN
    IF current_user_id IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'invalid upload claim';
    END IF;

    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin', 'member']::TEXT[]) THEN
        RAISE EXCEPTION 'forbidden';
    END IF;

    -- User/IP advisory locks close races across different workspaces while the
    -- workspace row lock serializes the four-upload group limit.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(current_user_id::TEXT, 0)
    );
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_ip_hash, 1)
    );
    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

    UPDATE private.audio_upload_reservations
    SET status = 'expired', released_at = now()
    WHERE workspace_id = p_workspace_id
      AND status IN ('reserved', 'uploading')
      AND expires_at <= now();

    SELECT * INTO reservation_record
    FROM private.audio_upload_reservations
    WHERE id = p_reservation_id
      AND workspace_id = p_workspace_id
      AND user_id = current_user_id
      AND status = 'reserved'
      AND expires_at > now()
    FOR UPDATE;

    IF NOT FOUND OR reservation_record.requested_bytes <> p_requested_bytes THEN
        RAISE EXCEPTION 'audio reservation mismatch';
    END IF;

    SELECT count(*) INTO user_upload_count
    FROM private.audio_upload_reservations
    WHERE user_id = current_user_id AND status = 'uploading' AND expires_at > now();

    SELECT count(*) INTO workspace_upload_count
    FROM private.audio_upload_reservations
    WHERE workspace_id = p_workspace_id AND status = 'uploading' AND expires_at > now();

    IF user_upload_count >= 2 OR workspace_upload_count >= 4 THEN
        RAISE EXCEPTION 'audio upload concurrency exceeded';
    END IF;

    DELETE FROM private.audio_upload_rate_events
    WHERE created_at < now() - interval '10 minutes';

    SELECT count(*) INTO user_rate_count
    FROM private.audio_upload_rate_events
    WHERE user_id = current_user_id AND created_at >= now() - interval '1 minute';

    SELECT count(*) INTO ip_rate_count
    FROM private.audio_upload_rate_events
    WHERE ip_hash = p_ip_hash AND created_at >= now() - interval '1 minute';

    IF user_rate_count >= 10 OR ip_rate_count >= 20 THEN
        RAISE EXCEPTION 'audio upload rate exceeded';
    END IF;

    UPDATE private.audio_upload_reservations
    SET status = 'uploading', upload_started_at = now(), ip_hash = p_ip_hash
    WHERE id = p_reservation_id;

    INSERT INTO private.audio_upload_rate_events (workspace_id, user_id, ip_hash)
    VALUES (p_workspace_id, current_user_id, p_ip_hash);
END;
$function$;

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
      AND status IN ('reserved', 'uploading');
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_audio_upload_reservation(
    p_reservation_id UUID,
    p_storage_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    reservation_workspace_id UUID;
BEGIN
    SELECT workspace_id INTO reservation_workspace_id
    FROM private.audio_upload_reservations
    WHERE id = p_reservation_id
      AND user_id = auth.uid()
      AND status IN ('reserved', 'uploading')
      AND expires_at > now()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'audio reservation unavailable';
    END IF;

    IF p_storage_path NOT LIKE 'workspaces/' || reservation_workspace_id::TEXT || '/songs/%'
       AND p_storage_path NOT LIKE 'workspaces/' || reservation_workspace_id::TEXT || '/imports/%' THEN
        RAISE EXCEPTION 'invalid audio storage path';
    END IF;

    UPDATE private.audio_upload_reservations
    SET status = 'completed', storage_path = p_storage_path, completed_at = now()
    WHERE id = p_reservation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_audio_quota(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $function$
DECLARE
    workspace_kind TEXT;
    used_amount BIGINT;
    reserved_amount BIGINT;
    limit_amount BIGINT;
BEGIN
    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin', 'member']::TEXT[]) THEN
        RAISE EXCEPTION 'forbidden';
    END IF;

    SELECT workspace_type INTO STRICT workspace_kind
    FROM public.workspaces WHERE id = p_workspace_id;

    IF workspace_kind = 'personal' THEN
        limit_amount := 3600;
        SELECT COALESCE(sum(COALESCE(duration_seconds, 0)), 0)
        INTO used_amount
        FROM public.song_assets
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

        SELECT COALESCE(sum(COALESCE(requested_seconds, 0)), 0)
        INTO reserved_amount
        FROM private.audio_upload_reservations AS reservations
        WHERE reservations.workspace_id = p_workspace_id
          AND (
              (reservations.status IN ('reserved', 'uploading') AND reservations.expires_at > now())
              OR (reservations.status = 'completed' AND NOT EXISTS (
                  SELECT 1 FROM public.song_assets AS assets
                  WHERE assets.workspace_id = reservations.workspace_id
                    AND assets.storage_path = reservations.storage_path
              ))
          );
    ELSE
        limit_amount := 5368709120;
        SELECT COALESCE(sum(size_bytes), 0)
        INTO used_amount
        FROM public.song_assets
        WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

        SELECT COALESCE(sum(requested_bytes), 0)
        INTO reserved_amount
        FROM private.audio_upload_reservations AS reservations
        WHERE reservations.workspace_id = p_workspace_id
          AND (
              (reservations.status IN ('reserved', 'uploading') AND reservations.expires_at > now())
              OR (reservations.status = 'completed' AND NOT EXISTS (
                  SELECT 1 FROM public.song_assets AS assets
                  WHERE assets.workspace_id = reservations.workspace_id
                    AND assets.storage_path = reservations.storage_path
              ))
          );
    END IF;

    RETURN jsonb_build_object(
        'unit', CASE WHEN workspace_kind = 'personal' THEN 'seconds' ELSE 'bytes' END,
        'usedAmount', used_amount,
        'reservedAmount', reserved_amount,
        'limitAmount', limit_amount,
        'remainingAmount', greatest(limit_amount - used_amount - reserved_amount, 0),
        'percentUsed', round(((used_amount + reserved_amount)::NUMERIC * 100) / limit_amount, 1)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_audio_r2_keys(p_r2_keys TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    inserted_count INTEGER;
BEGIN
    IF cardinality(p_r2_keys) > 1000 THEN
        RAISE EXCEPTION 'too many R2 keys';
    END IF;

    INSERT INTO private.audio_file_migration_quarantine (r2_key, issue_type)
    SELECT DISTINCT keys.r2_key, 'orphaned_object'
    FROM unnest(COALESCE(p_r2_keys, ARRAY[]::TEXT[])) AS keys(r2_key)
    LEFT JOIN public.audio_files AS files ON files.r2_key = keys.r2_key
    WHERE files.id IS NULL
      AND keys.r2_key LIKE 'workspaces/%'
    ON CONFLICT (r2_key) DO UPDATE
    SET issue_type = 'orphaned_object', detected_at = now(), resolved_at = NULL, resolution = NULL;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_audio_upload(UUID, BIGINT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.begin_audio_upload(UUID, UUID, BIGINT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_audio_upload_reservation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_audio_upload_reservation(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_audio_quota(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_audio_r2_keys(TEXT[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_audio_upload(UUID, BIGINT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_audio_upload(UUID, UUID, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_audio_upload_reservation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_audio_upload_reservation(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audio_quota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_audio_r2_keys(TEXT[]) TO service_role;
