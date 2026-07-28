ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS lyrics_document JSONB,
  ADD COLUMN IF NOT EXISTS lyrics_document_version SMALLINT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION private.legacy_lyrics_to_document(p_lyrics TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_line TEXT;
  v_header TEXT;
  v_type TEXT := 'free';
  v_label TEXT := '';
  v_sections JSONB := '[]'::JSONB;
  v_paragraphs JSONB := '[]'::JSONB;
  v_has_section BOOLEAN := FALSE;
BEGIN
  FOREACH v_line IN ARRAY regexp_split_to_array(COALESCE(p_lyrics, ''), E'\\r?\\n')
  LOOP
    v_header := lower(trim(both '[] ' from v_line));

    IF v_header ~ '^(couplet|verse)( [0-9]+)?$'
      OR v_header ~ '^(pré-refrain|pre-refrain|prechorus)$'
      OR v_header ~ '^(refrain|chorus)$'
      OR v_header ~ '^(pont|bridge)$'
      OR v_header ~ '^(intro|outro|solo)$'
    THEN
      IF v_has_section THEN
        IF jsonb_array_length(v_paragraphs) = 0 THEN
          v_paragraphs := jsonb_build_array(
            jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', extensions.gen_random_uuid()::TEXT))
          );
        END IF;

        v_sections := v_sections || jsonb_build_array(
          jsonb_build_object(
            'type', 'songSection',
            'attrs', jsonb_build_object(
              'id', extensions.gen_random_uuid()::TEXT,
              'sectionType', v_type,
              'label', v_label
            ),
            'content', v_paragraphs
          )
        );
      END IF;

      v_has_section := TRUE;
      v_paragraphs := '[]'::JSONB;

      IF v_header ~ '^(couplet|verse)' THEN
        v_type := 'verse';
        v_label := initcap(replace(v_header, 'verse', 'couplet'));
      ELSIF v_header ~ '^(pré-refrain|pre-refrain|prechorus)$' THEN
        v_type := 'prechorus';
        v_label := 'Pré-refrain';
      ELSIF v_header ~ '^(refrain|chorus)$' THEN
        v_type := 'chorus';
        v_label := 'Refrain';
      ELSIF v_header ~ '^(pont|bridge)$' THEN
        v_type := 'bridge';
        v_label := 'Pont';
      ELSE
        v_type := v_header;
        v_label := initcap(v_header);
      END IF;
    ELSE
      IF NOT v_has_section THEN
        v_has_section := TRUE;
        v_type := 'free';
        v_label := '';
      END IF;

      v_paragraphs := v_paragraphs || jsonb_build_array(
        CASE
          WHEN v_line = '' THEN
            jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', extensions.gen_random_uuid()::TEXT))
          ELSE
            jsonb_build_object(
              'type', 'paragraph',
              'attrs', jsonb_build_object('id', extensions.gen_random_uuid()::TEXT),
              'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_line))
            )
        END
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_paragraphs) = 0 THEN
    v_paragraphs := jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'attrs', jsonb_build_object('id', extensions.gen_random_uuid()::TEXT))
    );
  END IF;

  v_sections := v_sections || jsonb_build_array(
    jsonb_build_object(
      'type', 'songSection',
      'attrs', jsonb_build_object(
        'id', extensions.gen_random_uuid()::TEXT,
        'sectionType', v_type,
        'label', v_label
      ),
      'content', v_paragraphs
    )
  );

  RETURN jsonb_build_object('type', 'doc', 'content', v_sections);
END;
$$;

UPDATE public.songs
SET
  lyrics_document = private.legacy_lyrics_to_document(lyrics),
  lyrics_document_version = 1
WHERE lyrics_document IS NULL;

ALTER TABLE public.songs
  ALTER COLUMN lyrics_document SET NOT NULL,
  ADD CONSTRAINT songs_lyrics_document_shape
    CHECK (
      jsonb_typeof(lyrics_document) = 'object'
      AND lyrics_document ->> 'type' = 'doc'
      AND jsonb_typeof(lyrics_document -> 'content') = 'array'
    );

CREATE OR REPLACE FUNCTION private.ensure_song_lyrics_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.lyrics_document IS NULL
    OR (
      TG_OP = 'UPDATE'
      AND NEW.lyrics IS DISTINCT FROM OLD.lyrics
      AND NEW.lyrics_document IS NOT DISTINCT FROM OLD.lyrics_document
    )
  THEN
    NEW.lyrics_document := private.legacy_lyrics_to_document(NEW.lyrics);
    NEW.lyrics_document_version := 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_song_lyrics_document ON public.songs;

CREATE TRIGGER ensure_song_lyrics_document
BEFORE INSERT OR UPDATE OF lyrics, lyrics_document ON public.songs
FOR EACH ROW
EXECUTE FUNCTION private.ensure_song_lyrics_document();

CREATE OR REPLACE FUNCTION public.copy_song_to_workspace(
  p_song_id TEXT,
  p_target_workspace_id UUID,
  p_include_audio BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_source_song RECORD;
  v_source_role TEXT;
  v_target_role TEXT;
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
    id,
    workspace_id,
    title,
    artist,
    lyrics,
    lyrics_document,
    lyrics_document_version,
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
    v_source_song.lyrics_document,
    v_source_song.lyrics_document_version,
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

  IF p_include_audio THEN
    FOR v_asset IN
      SELECT *
      FROM public.song_assets
      WHERE song_id = p_song_id AND deleted_at IS NULL
    LOOP
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
        extensions.gen_random_uuid()::TEXT,
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
