CREATE TABLE private.google_drive_oauth_states (
  state_hash text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pkce_verifier text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.google_drive_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.google_drive_oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.google_drive_oauth_states TO service_role;

CREATE OR REPLACE FUNCTION public.create_google_drive_oauth_state(
  p_workspace_id uuid, p_state_hash text, p_pkce_verifier text, p_expires_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin']::text[]) THEN RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED'; END IF;
  INSERT INTO private.google_drive_oauth_states (state_hash, workspace_id, user_id, pkce_verifier, expires_at)
  VALUES (p_state_hash, p_workspace_id, auth.uid(), p_pkce_verifier, p_expires_at);
END;
$$;
REVOKE ALL ON FUNCTION public.create_google_drive_oauth_state(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_google_drive_oauth_state(uuid, text, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_google_drive_oauth_state(p_state_hash text)
RETURNS TABLE(workspace_id uuid, user_id uuid, pkce_verifier text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN QUERY
  UPDATE private.google_drive_oauth_states
  SET consumed_at = now()
  WHERE state_hash = p_state_hash AND user_id = auth.uid() AND consumed_at IS NULL AND expires_at > now()
  RETURNING google_drive_oauth_states.workspace_id, google_drive_oauth_states.user_id, google_drive_oauth_states.pkce_verifier;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_google_drive_oauth_state(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_google_drive_oauth_state(text) TO authenticated;
