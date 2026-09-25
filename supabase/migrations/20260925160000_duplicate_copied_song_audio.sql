-- A copied song keeps its database metadata, but each selected audio file must
-- be physically copied into the target workspace's storage connection.
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
    SELECT 1 FROM public.songs
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

  RETURN json_build_object(
    'song_id', v_new_song_id,
    'title', v_target_title,
    'target_workspace_id', p_target_workspace_id,
    'include_audio', p_include_audio
  );
END;
$function$;
