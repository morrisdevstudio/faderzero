-- Group workspaces use the same duration-based accounting as personal workspaces.
-- Uploads are normalized to MP3 192 kb/s, so the quota is expressed consistently
-- as listening time instead of storage bytes.

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
       OR p_requested_seconds IS NULL OR p_requested_seconds < 0 THEN
        RAISE EXCEPTION 'invalid audio reservation request';
    END IF;

    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin', 'member']::TEXT[]) THEN
        RAISE EXCEPTION 'forbidden';
    END IF;

    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;
    SELECT workspace_type INTO STRICT workspace_kind FROM public.workspaces WHERE id = p_workspace_id;

    UPDATE private.audio_upload_reservations
    SET status = 'expired', released_at = now()
    WHERE workspace_id = p_workspace_id AND status = 'reserved' AND expires_at <= now();

    UPDATE private.audio_upload_reservations AS reservations
    SET status = 'released', released_at = now()
    WHERE reservations.workspace_id = p_workspace_id
      AND reservations.status = 'completed'
      AND EXISTS (
          SELECT 1 FROM public.song_assets AS assets
          WHERE assets.workspace_id = reservations.workspace_id
            AND assets.storage_path = reservations.storage_path
      );

    limit_amount := CASE WHEN workspace_kind = 'personal' THEN 3600 ELSE 144000 END;
    SELECT COALESCE(sum(COALESCE(duration_seconds, 0)), 0) INTO used_amount
    FROM public.song_assets WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;
    SELECT COALESCE(sum(COALESCE(requested_seconds, 0)), 0) INTO reserved_amount
    FROM private.audio_upload_reservations
    WHERE workspace_id = p_workspace_id
      AND (status = 'completed' OR (status = 'reserved' AND expires_at > now()));

    IF used_amount + reserved_amount + p_requested_seconds > limit_amount THEN
        RAISE EXCEPTION 'audio quota exceeded';
    END IF;

    INSERT INTO private.audio_upload_reservations (workspace_id, user_id, requested_bytes, requested_seconds)
    VALUES (p_workspace_id, auth.uid(), p_requested_bytes, p_requested_seconds)
    RETURNING id INTO reservation_id;
    RETURN reservation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.copy_song_to_workspace(
  p_song_id TEXT,
  p_target_workspace_id UUID,
  p_include_audio BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_caller_id UUID := auth.uid();
  v_source_song RECORD;
  v_source_role TEXT;
  v_target_role TEXT;
  v_target_workspace_kind TEXT;
  v_target_used_seconds BIGINT;
  v_target_reserved_seconds BIGINT;
  v_source_duration_seconds BIGINT;
  v_target_limit_seconds BIGINT;
  v_new_song_id TEXT;
  v_target_title TEXT;
  v_copy_counter INTEGER := 1;
  v_asset RECORD;
  v_original_author_name TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_source_song
  FROM public.songs
  WHERE id = p_song_id AND deleted_at IS NULL;
  IF v_source_song.id IS NULL THEN
    RAISE EXCEPTION 'SONG_NOT_FOUND';
  END IF;

  SELECT role INTO v_source_role
  FROM public.workspace_members
  WHERE workspace_id = v_source_song.workspace_id AND user_id = v_caller_id;
  IF v_source_role IS NULL THEN
    RAISE EXCEPTION 'SOURCE_WORKSPACE_ACCESS_DENIED';
  END IF;

  SELECT role INTO v_target_role
  FROM public.workspace_members
  WHERE workspace_id = p_target_workspace_id AND user_id = v_caller_id;
  IF v_target_role IS NULL OR v_target_role = 'guest' THEN
    RAISE EXCEPTION 'TARGET_WORKSPACE_WRITE_DENIED';
  END IF;

  IF p_include_audio THEN
    PERFORM 1 FROM public.workspaces WHERE id = p_target_workspace_id FOR UPDATE;
    SELECT workspace_type INTO STRICT v_target_workspace_kind
    FROM public.workspaces WHERE id = p_target_workspace_id;
    v_target_limit_seconds := CASE WHEN v_target_workspace_kind = 'personal' THEN 3600 ELSE 144000 END;

    SELECT COALESCE(sum(COALESCE(duration_seconds, 0)), 0)
    INTO v_target_used_seconds
    FROM public.song_assets
    WHERE workspace_id = p_target_workspace_id AND deleted_at IS NULL;
    SELECT COALESCE(sum(COALESCE(requested_seconds, 0)), 0)
    INTO v_target_reserved_seconds
    FROM private.audio_upload_reservations AS reservations
    WHERE reservations.workspace_id = p_target_workspace_id
      AND (
        (reservations.status IN ('reserved', 'uploading') AND reservations.expires_at > now())
        OR (reservations.status = 'completed' AND NOT EXISTS (
          SELECT 1 FROM public.song_assets AS assets
          WHERE assets.workspace_id = reservations.workspace_id
            AND assets.storage_path = reservations.storage_path
        ))
      );
    SELECT COALESCE(sum(COALESCE(duration_seconds, 0)), 0)
    INTO v_source_duration_seconds
    FROM public.song_assets
    WHERE song_id = p_song_id AND deleted_at IS NULL;

    IF v_target_used_seconds + v_target_reserved_seconds + v_source_duration_seconds > v_target_limit_seconds THEN
      RAISE EXCEPTION 'TARGET_AUDIO_QUOTA_EXCEEDED';
    END IF;
  END IF;

  v_target_title := v_source_song.title;
  WHILE EXISTS (
    SELECT 1
    FROM public.songs
    WHERE workspace_id = p_target_workspace_id
      AND lower(title) = lower(v_target_title)
      AND deleted_at IS NULL
  ) LOOP
    v_target_title := v_source_song.title || ' (copie ' || v_copy_counter || ')';
    v_copy_counter := v_copy_counter + 1;
  END LOOP;

  IF v_source_song.original_author IS NOT NULL THEN
    v_original_author_name := v_source_song.original_author;
  ELSE
    SELECT display_name INTO v_original_author_name
    FROM public.profiles
    WHERE id = COALESCE(v_source_song.last_modified_by, v_caller_id);
    v_original_author_name := COALESCE(v_original_author_name, 'Auteur d''origine');
  END IF;

  v_new_song_id := extensions.gen_random_uuid()::TEXT;
  INSERT INTO public.songs (
    id, workspace_id, title, artist, lyrics, lyrics_document, lyrics_document_version,
    key, bpm, status, duration_seconds, notes, last_modified_by, created_at, updated_at,
    copied_from_song_id, original_author, original_created_at
  ) VALUES (
    v_new_song_id, p_target_workspace_id, v_target_title, v_source_song.artist,
    v_source_song.lyrics, v_source_song.lyrics_document, v_source_song.lyrics_document_version,
    v_source_song.key, v_source_song.bpm, v_source_song.status, v_source_song.duration_seconds,
    v_source_song.notes, v_caller_id, now(), now(), v_source_song.id, v_original_author_name,
    COALESCE(v_source_song.original_created_at, v_source_song.created_at)
  );

  IF p_include_audio THEN
    FOR v_asset IN
      SELECT * FROM public.song_assets
      WHERE song_id = p_song_id AND deleted_at IS NULL
    LOOP
      INSERT INTO public.song_assets (
        id, workspace_id, song_id, audio_file_id, storage_path, filename, mime_type,
        size_bytes, duration_seconds, last_modified_by, created_at, updated_at
      ) VALUES (
        extensions.gen_random_uuid()::TEXT, p_target_workspace_id, v_new_song_id,
        v_asset.audio_file_id, v_asset.storage_path, v_asset.filename, v_asset.mime_type,
        v_asset.size_bytes, v_asset.duration_seconds, v_caller_id, now(), now()
      );
    END LOOP;
  END IF;

  RETURN json_build_object(
    'song_id', v_new_song_id,
    'title', v_target_title,
    'target_workspace_id', p_target_workspace_id,
    'include_audio', p_include_audio
  );
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

    limit_amount := CASE WHEN workspace_kind = 'personal' THEN 3600 ELSE 144000 END;
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

    RETURN jsonb_build_object(
        'unit', 'seconds',
        'usedAmount', used_amount,
        'reservedAmount', reserved_amount,
        'limitAmount', limit_amount,
        'remainingAmount', greatest(limit_amount - used_amount - reserved_amount, 0),
        'percentUsed', round(((used_amount + reserved_amount)::NUMERIC * 100) / limit_amount, 1)
    );
END;
$function$;
