-- Story 3.5 follow-up: generate deletion secrets in PostgreSQL so the browser
-- never depends on Web Crypto when the local PWA is served over plain HTTP.

REVOKE ALL ON FUNCTION public.create_account_deletion_request(TEXT)
FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION public.create_account_deletion_request(TEXT);

CREATE FUNCTION public.create_account_deletion_request()
RETURNS TABLE (token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_id UUID := (SELECT auth.uid());
    raw_token TEXT := encode(extensions.gen_random_bytes(32), 'hex');
    token_digest TEXT := encode(extensions.digest(raw_token, 'sha256'), 'hex');
    expiration TIMESTAMPTZ := now() + interval '1 hour';
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM private.account_deletion_blockers(current_user_id)) THEN
        RAISE EXCEPTION 'LAST_ADMIN_BLOCKS_ACCOUNT_DELETION' USING ERRCODE = '23514';
    END IF;

    INSERT INTO private.account_deletion_requests (
        user_id, token_hash, requested_at, expires_at, consumed_at
    ) VALUES (
        current_user_id, token_digest, now(), expiration, NULL
    )
    ON CONFLICT (user_id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash,
        requested_at = EXCLUDED.requested_at,
        expires_at = EXCLUDED.expires_at,
        consumed_at = NULL;

    RETURN QUERY SELECT raw_token, expiration;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_account_deletion_request()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_account_deletion_request() TO authenticated;

DO $verification$
BEGIN
    IF to_regprocedure('public.create_account_deletion_request()') IS NULL
       OR to_regprocedure('public.create_account_deletion_request(text)') IS NOT NULL THEN
        RAISE EXCEPTION 'ACCOUNT_DELETION_SERVER_TOKEN_MIGRATION_INCOMPLETE';
    END IF;
END;
$verification$;
