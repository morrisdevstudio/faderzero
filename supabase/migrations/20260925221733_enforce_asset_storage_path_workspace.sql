-- Public EPK media is served from the shared private bucket by storage_path.
-- Direct API writes (role authenticated/anon) may only point at keys owned by
-- the row's workspace. SECURITY DEFINER RPCs (e.g. the legacy shared-audio
-- copy) and service-role workers run as another current_user and are exempt.

CREATE OR REPLACE FUNCTION private.enforce_song_asset_storage_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.storage_path IS NOT DISTINCT FROM OLD.storage_path THEN
    RETURN NEW;
  END IF;
  IF starts_with(NEW.storage_path, 'workspaces/' || NEW.workspace_id::text || '/') THEN
    RETURN NEW;
  END IF;
  -- Legacy shared-audio copies and archive re-imports reuse a key already
  -- referenced inside the same workspace.
  IF EXISTS (
    SELECT 1 FROM public.song_assets AS existing
    WHERE existing.workspace_id = NEW.workspace_id
      AND existing.storage_path = NEW.storage_path
      AND existing.id <> NEW.id
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'STORAGE_PATH_WORKSPACE_MISMATCH' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION private.enforce_epk_asset_storage_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
    AND NEW.storage_path IS NOT DISTINCT FROM OLD.storage_path
    AND NEW.epk_id IS NOT DISTINCT FROM OLD.epk_id THEN
    RETURN NEW;
  END IF;
  SELECT epks.workspace_id INTO v_workspace_id FROM public.epks WHERE epks.id = NEW.epk_id;
  IF v_workspace_id IS NOT NULL
    AND starts_with(NEW.storage_path, 'workspaces/' || v_workspace_id::text || '/') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'STORAGE_PATH_WORKSPACE_MISMATCH' USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS song_assets_enforce_storage_path ON public.song_assets;
CREATE TRIGGER song_assets_enforce_storage_path
  BEFORE INSERT OR UPDATE OF storage_path ON public.song_assets
  FOR EACH ROW EXECUTE FUNCTION private.enforce_song_asset_storage_path();

DROP TRIGGER IF EXISTS epk_assets_enforce_storage_path ON public.epk_assets;
CREATE TRIGGER epk_assets_enforce_storage_path
  BEFORE INSERT OR UPDATE OF storage_path, epk_id ON public.epk_assets
  FOR EACH ROW EXECUTE FUNCTION private.enforce_epk_asset_storage_path();
