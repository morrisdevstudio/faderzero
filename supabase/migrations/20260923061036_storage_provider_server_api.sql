ALTER TABLE public.workspace_storage_connections
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quota_used_bytes bigint,
  ADD COLUMN IF NOT EXISTS quota_limit_bytes bigint,
  ADD COLUMN IF NOT EXISTS last_health_check_at timestamptz;

ALTER TABLE public.workspace_storage_connections
  ADD CONSTRAINT workspace_storage_connections_provider_metadata_object
  CHECK (jsonb_typeof(provider_metadata) = 'object');

CREATE TABLE private.storage_upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.workspace_storage_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logical_key text NOT NULL,
  object_kind text NOT NULL CHECK (object_kind IN ('audio', 'epk_media', 'document')),
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  provider_session_uri text NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'uploading', 'completed', 'failed', 'expired')),
  physical_identifier text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX storage_upload_sessions_one_active
  ON private.storage_upload_sessions (workspace_id, logical_key)
  WHERE status IN ('created', 'uploading');

CREATE INDEX storage_upload_sessions_workspace_idx
  ON private.storage_upload_sessions (workspace_id, status, expires_at);

CREATE TABLE private.storage_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_object_id uuid NOT NULL REFERENCES public.storage_objects(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.storage_object_locations(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

ALTER TABLE private.storage_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.storage_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.storage_upload_sessions, private.storage_cleanup_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.storage_upload_sessions, private.storage_cleanup_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.consume_google_drive_oauth_state_server(p_state_hash text)
RETURNS TABLE(workspace_id uuid, user_id uuid, pkce_verifier text)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $function$
  UPDATE private.google_drive_oauth_states SET consumed_at = now()
  WHERE state_hash = p_state_hash AND consumed_at IS NULL AND expires_at > now()
  RETURNING google_drive_oauth_states.workspace_id, google_drive_oauth_states.user_id,
    google_drive_oauth_states.pkce_verifier;
$function$;

CREATE OR REPLACE FUNCTION public.get_storage_connection_secret(p_connection_id uuid)
RETURNS TABLE(encrypted_credentials text, encryption_key_version integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT encode(secrets.encrypted_credentials, 'base64'), secrets.encryption_key_version
  FROM private.workspace_storage_connection_secrets AS secrets
  WHERE secrets.connection_id = p_connection_id;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_google_drive_connection(
  p_workspace_id uuid, p_connected_by uuid, p_root_identifier text, p_display_name text,
  p_provider_metadata jsonb, p_encrypted_credentials text, p_encryption_key_version integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE connection_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_connected_by AND role IN ('owner', 'admin')
  ) THEN RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED' USING ERRCODE = '42501'; END IF;

  UPDATE public.workspace_storage_connections SET is_default = false, updated_at = now()
  WHERE workspace_id = p_workspace_id AND is_default;
  SELECT id INTO connection_id FROM public.workspace_storage_connections
  WHERE workspace_id = p_workspace_id AND provider_id = 'google_drive'
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF connection_id IS NULL THEN
    INSERT INTO public.workspace_storage_connections (
      workspace_id, provider_id, connected_by, root_identifier, display_name,
      provider_metadata, status, is_default, last_health_check_at
    ) VALUES (
      p_workspace_id, 'google_drive', p_connected_by, p_root_identifier, p_display_name,
      COALESCE(p_provider_metadata, '{}'::jsonb), 'connected', true, now()
    ) RETURNING id INTO connection_id;
  ELSE
    UPDATE public.workspace_storage_connections SET connected_by = p_connected_by,
      root_identifier = p_root_identifier, display_name = p_display_name,
      provider_metadata = COALESCE(p_provider_metadata, '{}'::jsonb), status = 'connected',
      quota_used_bytes = NULLIF(p_provider_metadata->>'quotaUsedBytes', '')::bigint,
      quota_limit_bytes = NULLIF(p_provider_metadata->>'quotaLimitBytes', '')::bigint,
      is_default = true, disconnected_at = NULL, last_health_check_at = now(), updated_at = now()
    WHERE id = connection_id;
  END IF;

  UPDATE public.workspace_storage_connections SET
    quota_used_bytes = NULLIF(p_provider_metadata->>'quotaUsedBytes', '')::bigint,
    quota_limit_bytes = NULLIF(p_provider_metadata->>'quotaLimitBytes', '')::bigint
  WHERE id = connection_id;

  INSERT INTO private.workspace_storage_connection_secrets (
    connection_id, encrypted_credentials, encryption_key_version
  ) VALUES (connection_id, decode(p_encrypted_credentials, 'base64'), p_encryption_key_version)
  ON CONFLICT (connection_id) DO UPDATE SET encrypted_credentials = EXCLUDED.encrypted_credentials,
    encryption_key_version = EXCLUDED.encryption_key_version, updated_at = now();
  RETURN connection_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_storage_upload_session(
  p_workspace_id uuid, p_connection_id uuid, p_user_id uuid, p_logical_key text,
  p_object_kind text, p_mime_type text, p_size_bytes bigint,
  p_provider_session_uri text, p_expires_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE session_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND role IN ('owner', 'admin', 'member')
  ) THEN RAISE EXCEPTION 'WORKSPACE_WRITE_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_storage_connections
    WHERE id = p_connection_id AND workspace_id = p_workspace_id
      AND provider_id = 'google_drive' AND status = 'connected'
  ) THEN RAISE EXCEPTION 'STORAGE_CONNECTION_UNAVAILABLE'; END IF;

  UPDATE private.storage_upload_sessions SET status = 'expired', updated_at = now()
  WHERE workspace_id = p_workspace_id AND logical_key = p_logical_key
    AND status IN ('created', 'uploading');
  INSERT INTO private.storage_upload_sessions (
    workspace_id, connection_id, user_id, logical_key, object_kind,
    mime_type, size_bytes, provider_session_uri, expires_at
  ) VALUES (
    p_workspace_id, p_connection_id, p_user_id, p_logical_key, p_object_kind,
    p_mime_type, p_size_bytes, p_provider_session_uri, p_expires_at
  ) RETURNING id INTO session_id;
  RETURN session_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_storage_upload_session(p_session_id uuid)
RETURNS TABLE(id uuid, workspace_id uuid, connection_id uuid, user_id uuid,
  logical_key text, object_kind text, mime_type text, size_bytes bigint,
  provider_session_uri text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT sessions.id, sessions.workspace_id, sessions.connection_id, sessions.user_id,
    sessions.logical_key, sessions.object_kind, sessions.mime_type, sessions.size_bytes,
    sessions.provider_session_uri, sessions.status
  FROM private.storage_upload_sessions AS sessions
  WHERE sessions.id = p_session_id AND sessions.expires_at > now();
$function$;

CREATE OR REPLACE FUNCTION public.finalize_storage_upload(
  p_session_id uuid, p_physical_identifier text, p_content_hash text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE upload private.storage_upload_sessions%ROWTYPE; object_id uuid;
BEGIN
  SELECT * INTO upload FROM private.storage_upload_sessions WHERE id = p_session_id FOR UPDATE;
  IF upload.id IS NULL OR upload.status = 'expired' OR upload.expires_at <= now() THEN
    RAISE EXCEPTION 'UPLOAD_SESSION_UNAVAILABLE';
  END IF;
  IF upload.status = 'completed' THEN
    SELECT id INTO object_id FROM public.storage_objects
    WHERE workspace_id = upload.workspace_id AND logical_key = upload.logical_key;
    RETURN object_id;
  END IF;

  INSERT INTO public.storage_objects (
    workspace_id, logical_key, object_kind, mime_type, size_bytes, content_hash
  ) VALUES (
    upload.workspace_id, upload.logical_key, upload.object_kind,
    upload.mime_type, upload.size_bytes, p_content_hash
  ) ON CONFLICT (workspace_id, logical_key) DO UPDATE SET
    object_kind = EXCLUDED.object_kind, mime_type = EXCLUDED.mime_type,
    size_bytes = EXCLUDED.size_bytes,
    content_hash = COALESCE(EXCLUDED.content_hash, public.storage_objects.content_hash),
    updated_at = now()
  RETURNING id INTO object_id;

  UPDATE public.storage_object_locations SET is_primary = false, updated_at = now()
  WHERE storage_object_id = object_id AND is_primary;
  INSERT INTO public.storage_object_locations (
    storage_object_id, connection_id, provider_id, physical_identifier,
    is_primary, verification_status, verified_at
  ) VALUES (
    object_id, upload.connection_id, 'google_drive', p_physical_identifier,
    true, 'verified', now()
  ) ON CONFLICT (connection_id, physical_identifier) DO UPDATE SET
    storage_object_id = EXCLUDED.storage_object_id, is_primary = true,
    verification_status = 'verified', verified_at = now(), updated_at = now();
  UPDATE private.storage_upload_sessions SET status = 'completed',
    physical_identifier = p_physical_identifier, updated_at = now() WHERE id = p_session_id;
  RETURN object_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_storage_cleanup(
  p_storage_object_id uuid, p_location_id uuid, p_provider_id text, p_error text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  INSERT INTO private.storage_cleanup_jobs (
    storage_object_id, location_id, provider_id, last_error
  ) VALUES (
    p_storage_object_id, p_location_id, p_provider_id, left(p_error, 1000)
  ) ON CONFLICT (location_id) DO UPDATE SET
    attempt_count = private.storage_cleanup_jobs.attempt_count + 1,
    last_error = EXCLUDED.last_error,
    next_attempt_at = now() + interval '15 minutes';
  UPDATE public.storage_object_locations SET verification_status = 'unavailable', updated_at = now()
  WHERE id = p_location_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_storage_location_deletion(p_location_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE object_id uuid;
BEGIN
  DELETE FROM public.storage_object_locations WHERE id = p_location_id
  RETURNING storage_object_id INTO object_id;
  IF object_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.storage_object_locations WHERE storage_object_id = object_id
  ) THEN
    DELETE FROM public.storage_objects WHERE id = object_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_workspace_default_storage_connection(p_connection_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE target public.workspace_storage_connections%ROWTYPE;
BEGIN
  SELECT * INTO target FROM public.workspace_storage_connections WHERE id = p_connection_id;
  IF target.id IS NULL OR NOT private.has_workspace_role(target.workspace_id, ARRAY['admin']::text[]) THEN
    RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF target.status <> 'connected' THEN RAISE EXCEPTION 'STORAGE_CONNECTION_UNAVAILABLE'; END IF;
  UPDATE public.workspace_storage_connections SET is_default = false, updated_at = now()
  WHERE workspace_id = target.workspace_id AND is_default;
  UPDATE public.workspace_storage_connections SET is_default = true, updated_at = now()
  WHERE id = target.id;
END;
$function$;

CREATE OR REPLACE FUNCTION private.catalog_r2_asset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE connection_id uuid; object_id uuid; object_workspace_id uuid; object_kind text; object_content_hash text;
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
  SELECT id INTO connection_id FROM public.workspace_storage_connections
  WHERE workspace_id = object_workspace_id AND provider_id = 'faderzero_r2'
    AND status = 'connected' ORDER BY created_at LIMIT 1;
  IF connection_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.storage_objects (workspace_id, logical_key, object_kind, mime_type, size_bytes, content_hash)
  VALUES (object_workspace_id, NEW.storage_path, object_kind, NEW.mime_type, NEW.size_bytes, object_content_hash)
  ON CONFLICT (workspace_id, logical_key) DO UPDATE SET
    mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes,
    content_hash = COALESCE(EXCLUDED.content_hash, public.storage_objects.content_hash), updated_at = now()
  RETURNING id INTO object_id;
  INSERT INTO public.storage_object_locations (
    storage_object_id, connection_id, provider_id, physical_identifier, is_primary, verification_status, verified_at
  ) VALUES (object_id, connection_id, 'faderzero_r2', NEW.storage_path, true, 'verified', now())
  ON CONFLICT (connection_id, physical_identifier) DO UPDATE SET
    storage_object_id = EXCLUDED.storage_object_id, is_primary = true,
    verification_status = 'verified', verified_at = now(), updated_at = now();
  NEW.storage_object_id := object_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER catalog_song_asset_r2
  BEFORE INSERT OR UPDATE OF storage_path, storage_object_id ON public.song_assets
  FOR EACH ROW WHEN (NEW.deleted_at IS NULL) EXECUTE FUNCTION private.catalog_r2_asset();
CREATE TRIGGER catalog_epk_asset_r2
  BEFORE INSERT OR UPDATE OF storage_path, storage_object_id ON public.epk_assets
  FOR EACH ROW EXECUTE FUNCTION private.catalog_r2_asset();

CREATE OR REPLACE FUNCTION private.protect_storage_connector_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workspace_storage_connections
    WHERE workspace_id = OLD.workspace_id AND connected_by = OLD.user_id
      AND status = 'connected'
  ) AND (TG_OP = 'DELETE' OR NEW.role NOT IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'STORAGE_CONNECTOR_RECONNECT_REQUIRED' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

CREATE TRIGGER protect_storage_connector_membership
  BEFORE DELETE OR UPDATE OF role ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION private.protect_storage_connector_membership();

REVOKE ALL ON FUNCTION public.consume_google_drive_oauth_state_server(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_google_drive_connection(uuid, uuid, text, text, jsonb, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_storage_connection_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_storage_upload_session(uuid, uuid, uuid, text, text, text, bigint, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_storage_upload_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_storage_upload(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_storage_cleanup(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_storage_location_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_drive_oauth_state_server(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_google_drive_connection(uuid, uuid, text, text, jsonb, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_storage_connection_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_storage_upload_session(uuid, uuid, uuid, text, text, text, bigint, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_storage_upload_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_storage_upload(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_storage_cleanup(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_storage_location_deletion(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.set_workspace_default_storage_connection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_workspace_default_storage_connection(uuid) TO authenticated;
