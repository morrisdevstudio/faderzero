-- Migration Epic 7: Cross-workspace song copy with shared audio references and provenance tracking

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS copied_from_song_id text REFERENCES public.songs(id) ON DELETE SET NULL;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS original_author text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS original_created_at timestamptz;
ALTER TABLE public.song_assets DROP CONSTRAINT IF EXISTS song_assets_storage_path_key;

-- Function to copy a song to another workspace with shared audio assets
CREATE OR REPLACE FUNCTION public.copy_song_to_workspace(
  p_song_id text,
  p_target_workspace_id uuid,
  p_include_audio boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_source_song record;
  v_source_role text;
  v_target_role text;
  v_new_song_id text;
  v_target_title text;
  v_copy_counter integer := 1;
  v_asset record;
  v_new_asset_id text;
  v_original_author_name text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  -- Read source song
  SELECT * INTO v_source_song
  FROM public.songs
  WHERE id = p_song_id AND deleted_at IS NULL;

  IF v_source_song.id IS NULL THEN
    RAISE EXCEPTION 'SONG_NOT_FOUND';
  END IF;

  -- Check source workspace membership
  SELECT role INTO v_source_role
  FROM public.workspace_members
  WHERE workspace_id = v_source_song.workspace_id AND user_id = v_caller_id;

  IF v_source_role IS NULL THEN
    RAISE EXCEPTION 'SOURCE_WORKSPACE_ACCESS_DENIED';
  END IF;

  -- Check target workspace membership & write permission
  SELECT role INTO v_target_role
  FROM public.workspace_members
  WHERE workspace_id = p_target_workspace_id AND user_id = v_caller_id;

  IF v_target_role IS NULL OR v_target_role = 'guest' THEN
    RAISE EXCEPTION 'TARGET_WORKSPACE_WRITE_DENIED';
  END IF;

  -- Determine unique title with (copie N) if name conflict exists
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

  -- Determine original author
  IF v_source_song.original_author IS NOT NULL THEN
    v_original_author_name := v_source_song.original_author;
  ELSE
    SELECT display_name INTO v_original_author_name
    FROM public.profiles
    WHERE id = COALESCE(v_source_song.last_modified_by, v_caller_id);
    IF v_original_author_name IS NULL THEN
      v_original_author_name := 'Auteur d''origine';
    END IF;
  END IF;

  -- Create copied song in target workspace
  v_new_song_id := extensions.gen_random_uuid()::text;
  INSERT INTO public.songs (
    id,
    workspace_id,
    title,
    artist,
    lyrics,
    key,
    bpm,
    status,
    duration_seconds,
    notes,
    last_modified_by,
    created_at,
    updated_at,
    copied_from_song_id,
    original_author,
    original_created_at
  ) VALUES (
    v_new_song_id,
    p_target_workspace_id,
    v_target_title,
    v_source_song.artist,
    v_source_song.lyrics,
    v_source_song.key,
    v_source_song.bpm,
    v_source_song.status,
    v_source_song.duration_seconds,
    v_source_song.notes,
    v_caller_id,
    now(),
    now(),
    v_source_song.id,
    v_original_author_name,
    COALESCE(v_source_song.original_created_at, v_source_song.created_at)
  );

  -- Copy audio assets if requested (shared physical reference, no R2 duplication)
  IF p_include_audio THEN
    FOR v_asset IN
      SELECT * FROM public.song_assets
      WHERE song_id = p_song_id AND deleted_at IS NULL
    LOOP
      v_new_asset_id := extensions.gen_random_uuid()::text;
      INSERT INTO public.song_assets (
        id,
        workspace_id,
        song_id,
        audio_file_id,
        storage_path,
        filename,
        mime_type,
        size_bytes,
        duration_seconds,
        last_modified_by,
        created_at,
        updated_at
      ) VALUES (
        v_new_asset_id,
        p_target_workspace_id,
        v_new_song_id,
        v_asset.audio_file_id,
        v_asset.storage_path,
        v_asset.filename,
        v_asset.mime_type,
        v_asset.size_bytes,
        v_asset.duration_seconds,
        v_caller_id,
        now(),
        now()
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
$$;

REVOKE ALL ON FUNCTION public.copy_song_to_workspace(text, uuid, boolean)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copy_song_to_workspace(text, uuid, boolean)
TO authenticated, service_role;
