-- Story 2.1: expand invitations without deleting or invalidating historical rows.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.workspace_invite_migration_journal (
    migration_key TEXT NOT NULL,
    invite_id UUID NOT NULL,
    previous_status TEXT NOT NULL,
    previous_expires_at TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (migration_key, invite_id)
);

REVOKE ALL ON TABLE private.workspace_invite_migration_journal
FROM PUBLIC, anon, authenticated;

ALTER TABLE public.workspace_invites
    ADD COLUMN IF NOT EXISTS token_hash TEXT,
    ADD COLUMN IF NOT EXISTS role TEXT,
    ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION private.prepare_workspace_invite_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
    IF NEW.token IS NOT NULL
       AND (
           NEW.token_hash IS NULL
           OR TG_OP = 'INSERT'
           OR NEW.token IS DISTINCT FROM OLD.token
       ) THEN
        NEW.token_hash := encode(extensions.digest(NEW.token, 'sha256'), 'hex');
    END IF;

    NEW.role := COALESCE(NEW.role, 'member');

    IF NEW.status = 'pending'
       AND NEW.revoked_at IS NULL
       AND (NEW.expires_at IS NULL OR NEW.expires_at > now() + interval '24 hours') THEN
        NEW.expires_at := now() + interval '24 hours';
    END IF;

    IF NEW.status = 'accepted' AND NEW.consumed_at IS NULL THEN
        NEW.consumed_at := COALESCE(NEW.updated_at, NEW.created_at, now());
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.prepare_workspace_invite_token()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prepare_workspace_invite_token ON public.workspace_invites;
CREATE TRIGGER prepare_workspace_invite_token
    BEFORE INSERT OR UPDATE OF token, token_hash, role
    ON public.workspace_invites
    FOR EACH ROW
    EXECUTE FUNCTION private.prepare_workspace_invite_token();

DO $migration$
DECLARE
    before_count BIGINT;
    after_count BIGINT;
BEGIN
    SELECT count(*) INTO before_count FROM public.workspace_invites;

    INSERT INTO private.workspace_invite_migration_journal (
        migration_key,
        invite_id,
        previous_status,
        previous_expires_at
    )
    SELECT
        '20260722100000_expand_workspace_invites',
        invites.id,
        invites.status,
        invites.expires_at
    FROM public.workspace_invites AS invites
    ON CONFLICT (migration_key, invite_id) DO NOTHING;

    UPDATE public.workspace_invites
    SET
        token_hash = encode(extensions.digest(token, 'sha256'), 'hex'),
        role = COALESCE(role, 'member'),
        consumed_at = CASE
            WHEN status = 'accepted' THEN COALESCE(consumed_at, updated_at, created_at, now())
            ELSE consumed_at
        END,
        expires_at = CASE
            WHEN status = 'pending'
             AND revoked_at IS NULL
             AND (expires_at IS NULL OR expires_at > now() + interval '24 hours')
                THEN now() + interval '24 hours'
            ELSE expires_at
        END;

    SELECT count(*) INTO after_count FROM public.workspace_invites;
    IF after_count <> before_count THEN
        RAISE EXCEPTION 'WORKSPACE_INVITE_COUNT_CHANGED: before=%, after=%', before_count, after_count;
    END IF;
END;
$migration$;

ALTER TABLE public.workspace_invites
    ADD CONSTRAINT workspace_invites_role_check
    CHECK (role IN ('admin', 'member', 'guest')) NOT VALID;

ALTER TABLE public.workspace_invites
    VALIDATE CONSTRAINT workspace_invites_role_check;

ALTER TABLE public.workspace_invites
    ALTER COLUMN role SET DEFAULT 'member',
    ALTER COLUMN role SET NOT NULL,
    ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_token_hash_key
    ON public.workspace_invites (token_hash);

COMMENT ON COLUMN public.workspace_invites.token IS
    'Legacy plaintext token retained for two versions and at least 30 days; new invitations store only token_hash.';
COMMENT ON COLUMN public.workspace_invites.token_hash IS
    'Lowercase hexadecimal SHA-256 digest used for invitation lookup.';
