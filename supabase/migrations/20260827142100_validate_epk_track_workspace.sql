-- An EPK must never expose a song asset from another workspace, even when a
-- client forges the foreign-key value.
CREATE OR REPLACE FUNCTION public.validate_epk_track_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  epk_workspace_id UUID;
  song_workspace_id UUID;
BEGIN
  IF NEW.source_type <> 'SONG_ASSET' THEN
    RETURN NEW;
  END IF;

  SELECT workspace_id INTO epk_workspace_id
  FROM public.epks
  WHERE id = NEW.epk_id;

  SELECT workspace_id INTO song_workspace_id
  FROM public.song_assets
  WHERE id = NEW.song_asset_id
    AND deleted_at IS NULL;

  IF epk_workspace_id IS NULL
     OR song_workspace_id IS NULL
     OR epk_workspace_id <> song_workspace_id THEN
    RAISE EXCEPTION 'EPK_TRACK_WORKSPACE_MISMATCH';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS epk_tracks_validate_workspace ON public.epk_tracks;
CREATE TRIGGER epk_tracks_validate_workspace
  BEFORE INSERT OR UPDATE OF epk_id, source_type, song_asset_id ON public.epk_tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_epk_track_workspace();
