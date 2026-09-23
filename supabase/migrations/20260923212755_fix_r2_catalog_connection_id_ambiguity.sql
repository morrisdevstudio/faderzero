CREATE OR REPLACE FUNCTION private.catalog_r2_asset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_connection_id uuid;
  object_id uuid;
  object_workspace_id uuid;
  object_kind text;
  object_content_hash text;
BEGIN
  IF NEW.storage_object_id IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'song_assets' THEN
    object_workspace_id := NEW.workspace_id;
    object_kind := 'audio';
    object_content_hash := NEW.content_hash;
  ELSE
    SELECT workspace_id INTO object_workspace_id FROM public.epks WHERE id = NEW.epk_id;
    object_kind := CASE WHEN NEW.kind = 'document' THEN 'document' ELSE 'epk_media' END;
  END IF;
  SELECT id INTO v_connection_id FROM public.workspace_storage_connections
  WHERE workspace_id = object_workspace_id AND provider_id = 'faderzero_r2'
    AND status = 'connected' ORDER BY created_at LIMIT 1;
  IF v_connection_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.storage_objects (workspace_id, logical_key, object_kind, mime_type, size_bytes, content_hash)
  VALUES (object_workspace_id, NEW.storage_path, object_kind, NEW.mime_type, NEW.size_bytes, object_content_hash)
  ON CONFLICT (workspace_id, logical_key) DO UPDATE SET
    mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes,
    content_hash = COALESCE(EXCLUDED.content_hash, public.storage_objects.content_hash), updated_at = now()
  RETURNING id INTO object_id;
  INSERT INTO public.storage_object_locations (
    storage_object_id, connection_id, provider_id, physical_identifier, is_primary, verification_status, verified_at
  ) VALUES (object_id, v_connection_id, 'faderzero_r2', NEW.storage_path, true, 'verified', now())
  ON CONFLICT (connection_id, physical_identifier) DO UPDATE SET
    storage_object_id = EXCLUDED.storage_object_id, is_primary = true,
    verification_status = 'verified', verified_at = now(), updated_at = now();
  NEW.storage_object_id := object_id;
  RETURN NEW;
END;
$function$;
