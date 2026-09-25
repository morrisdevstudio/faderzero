-- Keep the former three-argument RPC safe for already deployed PWAs. Newer
-- clients opt into physical audio duplication through the fourth argument.
ALTER FUNCTION public.copy_song_to_workspace(text, uuid, boolean)
  RENAME TO copy_song_to_workspace_without_audio_links;

CREATE OR REPLACE FUNCTION public.copy_song_to_workspace(
  p_song_id text,
  p_target_workspace_id uuid,
  p_include_audio boolean,
  p_duplicate_audio boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_result json;
  v_new_song_id text;
  v_asset record;
  v_caller_id uuid := auth.uid();
BEGIN
  v_result := public.copy_song_to_workspace_without_audio_links(
    p_song_id,
    p_target_workspace_id,
    p_include_audio
  );

  IF p_include_audio AND NOT p_duplicate_audio THEN
    v_new_song_id := v_result ->> 'song_id';
    FOR v_asset IN
      SELECT * FROM public.song_assets
      WHERE song_id = p_song_id AND deleted_at IS NULL
    LOOP
      INSERT INTO public.song_assets (
        id, workspace_id, song_id, audio_file_id, storage_path, filename, mime_type,
        size_bytes, duration_seconds, last_modified_by, created_at, updated_at
      ) VALUES (
        extensions.gen_random_uuid()::text, p_target_workspace_id, v_new_song_id,
        v_asset.audio_file_id, v_asset.storage_path, v_asset.filename, v_asset.mime_type,
        v_asset.size_bytes, v_asset.duration_seconds, v_caller_id, now(), now()
      );
    END LOOP;
  END IF;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.copy_song_to_workspace(
  p_song_id text,
  p_target_workspace_id uuid,
  p_include_audio boolean DEFAULT false
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.copy_song_to_workspace($1, $2, $3, false);
$function$;

REVOKE ALL ON FUNCTION public.copy_song_to_workspace(text, uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.copy_song_to_workspace(text, uuid, boolean, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copy_song_to_workspace(text, uuid, boolean)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copy_song_to_workspace(text, uuid, boolean, boolean)
  TO authenticated, service_role;
