ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Existing accounts already have an established workspace and must not be sent
-- through the first-run flow after this migration.
UPDATE public.profiles
SET onboarding_completed_at = now()
WHERE onboarding_completed_at IS NULL;

ALTER TABLE private.google_drive_oauth_states
  ADD COLUMN IF NOT EXISTS return_to text NOT NULL DEFAULT 'settings'
  CHECK (return_to IN ('settings', 'onboarding'));

CREATE OR REPLACE FUNCTION public.create_google_drive_oauth_state(
  p_workspace_id uuid,
  p_state_hash text,
  p_pkce_verifier text,
  p_expires_at timestamptz,
  p_return_to text DEFAULT 'settings'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin']::text[]) THEN
    RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED';
  END IF;
  IF p_return_to NOT IN ('settings', 'onboarding') THEN RAISE EXCEPTION 'OAUTH_RETURN_INVALID'; END IF;

  INSERT INTO private.google_drive_oauth_states (state_hash, workspace_id, user_id, pkce_verifier, expires_at, return_to)
  VALUES (p_state_hash, p_workspace_id, auth.uid(), p_pkce_verifier, p_expires_at, p_return_to);
END;
$function$;

DROP FUNCTION public.consume_google_drive_oauth_state_server(text);

CREATE OR REPLACE FUNCTION public.consume_google_drive_oauth_state_server(p_state_hash text)
RETURNS TABLE(workspace_id uuid, user_id uuid, pkce_verifier text, return_to text)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $function$
  UPDATE private.google_drive_oauth_states SET consumed_at = now()
  WHERE state_hash = p_state_hash AND consumed_at IS NULL AND expires_at > now()
  RETURNING google_drive_oauth_states.workspace_id, google_drive_oauth_states.user_id,
    google_drive_oauth_states.pkce_verifier, google_drive_oauth_states.return_to;
$function$;

REVOKE ALL ON FUNCTION public.create_google_drive_oauth_state(uuid, text, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_google_drive_oauth_state(uuid, text, text, timestamptz, text) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_google_drive_oauth_state_server(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_drive_oauth_state_server(text) TO service_role;
