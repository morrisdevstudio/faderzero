CREATE OR REPLACE FUNCTION public.consume_google_drive_oauth_state(p_state_hash text)
RETURNS TABLE(workspace_id uuid, user_id uuid, pkce_verifier text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN QUERY
  UPDATE private.google_drive_oauth_states AS states
  SET consumed_at = now()
  WHERE states.state_hash = p_state_hash
    AND states.user_id = auth.uid()
    AND states.consumed_at IS NULL
    AND states.expires_at > now()
  RETURNING states.workspace_id, states.user_id, states.pkce_verifier;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_google_drive_connection(
  p_workspace_id uuid, p_connected_by uuid, p_root_identifier text, p_display_name text,
  p_provider_metadata jsonb, p_encrypted_credentials text, p_encryption_key_version integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_connection_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members AS members
    WHERE members.workspace_id = p_workspace_id
      AND members.user_id = p_connected_by
      AND members.role IN ('owner', 'admin')
  ) THEN RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED' USING ERRCODE = '42501'; END IF;

  UPDATE public.workspace_storage_connections AS connections
  SET is_default = false, updated_at = now()
  WHERE connections.workspace_id = p_workspace_id AND connections.is_default;
  SELECT connections.id INTO v_connection_id
  FROM public.workspace_storage_connections AS connections
  WHERE connections.workspace_id = p_workspace_id AND connections.provider_id = 'google_drive'
  ORDER BY connections.created_at DESC LIMIT 1 FOR UPDATE;

  IF v_connection_id IS NULL THEN
    INSERT INTO public.workspace_storage_connections (
      workspace_id, provider_id, connected_by, root_identifier, display_name,
      provider_metadata, quota_used_bytes, quota_limit_bytes, status, is_default, last_health_check_at
    ) VALUES (
      p_workspace_id, 'google_drive', p_connected_by, p_root_identifier, p_display_name,
      COALESCE(p_provider_metadata, '{}'::jsonb),
      NULLIF(p_provider_metadata->>'quotaUsedBytes', '')::bigint,
      NULLIF(p_provider_metadata->>'quotaLimitBytes', '')::bigint,
      'connected', true, now()
    ) RETURNING id INTO v_connection_id;
  ELSE
    UPDATE public.workspace_storage_connections AS connections
    SET connected_by = p_connected_by, root_identifier = p_root_identifier,
      display_name = p_display_name, provider_metadata = COALESCE(p_provider_metadata, '{}'::jsonb),
      quota_used_bytes = NULLIF(p_provider_metadata->>'quotaUsedBytes', '')::bigint,
      quota_limit_bytes = NULLIF(p_provider_metadata->>'quotaLimitBytes', '')::bigint,
      status = 'connected', is_default = true, disconnected_at = NULL,
      last_health_check_at = now(), updated_at = now()
    WHERE connections.id = v_connection_id;
  END IF;

  INSERT INTO private.workspace_storage_connection_secrets AS secrets (
    connection_id, encrypted_credentials, encryption_key_version
  ) VALUES (v_connection_id, decode(p_encrypted_credentials, 'base64'), p_encryption_key_version)
  ON CONFLICT (connection_id) DO UPDATE SET
    encrypted_credentials = EXCLUDED.encrypted_credentials,
    encryption_key_version = EXCLUDED.encryption_key_version,
    updated_at = now();
  RETURN v_connection_id;
END;
$function$;
