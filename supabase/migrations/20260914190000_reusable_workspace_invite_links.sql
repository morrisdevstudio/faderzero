-- Issue #15: one reusable workspace invite link, valid for 7 days.
ALTER TABLE public.workspace_invites
    ADD COLUMN IF NOT EXISTS is_reusable BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workspace_invites.is_reusable IS
    'Reusable links stay pending after accept and may add several accounts; historical rows remain single-use.';
COMMENT ON COLUMN public.workspace_invites.token IS
    'Plaintext token stored only for reusable links so a workspace admin can retrieve it through list_workspace_invites.';

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
    NEW.is_reusable := COALESCE(NEW.is_reusable, false);

    IF NEW.is_reusable AND NEW.role = 'admin' THEN
        RAISE EXCEPTION 'INVALID_INVITE_ROLE' USING ERRCODE = '22023';
    END IF;

    IF NEW.status = 'pending' AND NEW.revoked_at IS NULL THEN
        IF NEW.is_reusable THEN
            IF NEW.expires_at IS NULL OR NEW.expires_at > now() + interval '7 days' THEN
                NEW.expires_at := now() + interval '7 days';
            END IF;
        ELSIF NEW.expires_at IS NULL OR NEW.expires_at > now() + interval '24 hours' THEN
            NEW.expires_at := now() + interval '24 hours';
        END IF;
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
    BEFORE INSERT OR UPDATE OF token, token_hash, role, is_reusable
    ON public.workspace_invites
    FOR EACH ROW
    EXECUTE FUNCTION private.prepare_workspace_invite_token();

CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_one_active_reusable
    ON public.workspace_invites (workspace_id)
    WHERE is_reusable AND revoked_at IS NULL;

DROP FUNCTION IF EXISTS public.create_workspace_invite(UUID, TEXT);
DROP FUNCTION IF EXISTS public.list_workspace_invites(UUID);
DROP FUNCTION IF EXISTS public.get_workspace_invite_by_token(TEXT);
DROP FUNCTION IF EXISTS public.accept_workspace_invite(TEXT);

CREATE FUNCTION public.create_workspace_invite(p_workspace_id UUID, p_role TEXT)
RETURNS TABLE (invite_id UUID, token TEXT, role TEXT, expires_at TIMESTAMPTZ, is_reusable BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_id UUID := (SELECT auth.uid());
    raw_token TEXT;
    raw_token_hash TEXT;
    new_invite_id UUID;
    new_expires_at TIMESTAMPTZ := now() + interval '7 days';
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF p_role IS NULL OR p_role NOT IN ('member', 'guest') THEN
        RAISE EXCEPTION 'INVALID_INVITE_ROLE' USING ERRCODE = '22023';
    END IF;
    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin']::TEXT[]) THEN
        RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED' USING ERRCODE = '42501';
    END IF;

    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

    UPDATE public.workspace_invites AS invites
    SET revoked_at = now(), updated_at = now()
    WHERE invites.workspace_id = p_workspace_id
      AND invites.is_reusable
      AND invites.revoked_at IS NULL;

    raw_token := encode(extensions.gen_random_bytes(32), 'hex');
    raw_token_hash := encode(extensions.digest(raw_token, 'sha256'), 'hex');
    new_invite_id := extensions.gen_random_uuid();

    INSERT INTO public.workspace_invites (
        id, workspace_id, email, token, token_hash, role,
        status, created_by, expires_at, is_reusable
    ) VALUES (
        new_invite_id, p_workspace_id, COALESCE(auth.jwt() ->> 'email', ''),
        raw_token, raw_token_hash, p_role, 'pending', current_user_id, new_expires_at, true
    );

    RETURN QUERY SELECT new_invite_id, raw_token, p_role, new_expires_at, true;
END;
$function$;

CREATE FUNCTION public.list_workspace_invites(p_workspace_id UUID)
RETURNS TABLE (
    invite_id UUID,
    role TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_reusable BOOLEAN,
    token TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin']::TEXT[]) THEN
        RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        invites.id,
        invites.role,
        invites.created_at,
        invites.expires_at,
        invites.is_reusable,
        CASE WHEN invites.is_reusable THEN invites.token ELSE NULL END
    FROM public.workspace_invites AS invites
    WHERE invites.workspace_id = p_workspace_id
      AND invites.status = 'pending'
      AND invites.revoked_at IS NULL
      AND invites.expires_at > now()
      AND (invites.is_reusable OR invites.consumed_at IS NULL)
    ORDER BY invites.is_reusable DESC, invites.created_at DESC;
END;
$function$;

CREATE FUNCTION public.get_workspace_invite_by_token(invite_token TEXT)
RETURNS TABLE (
    workspace_id UUID, workspace_name TEXT, status TEXT,
    role TEXT, expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT invites.workspace_id, workspaces.name, invites.status, invites.role, invites.expires_at
    FROM public.workspace_invites AS invites
    INNER JOIN public.workspaces AS workspaces ON workspaces.id = invites.workspace_id
    WHERE invite_token IS NOT NULL
      AND invite_token <> ''
      AND (
          invites.token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
          OR invites.token = invite_token
      )
      AND invites.status = 'pending'
      AND invites.revoked_at IS NULL
      AND invites.expires_at > now()
      AND (invites.is_reusable OR invites.consumed_at IS NULL)
    LIMIT 1;
$function$;

CREATE FUNCTION public.accept_workspace_invite(invite_token TEXT)
RETURNS TABLE (
    id UUID, name TEXT, created_by UUID, created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ, role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_id UUID := (SELECT auth.uid());
    invite_row public.workspace_invites%ROWTYPE;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;

    SELECT invites.* INTO invite_row
    FROM public.workspace_invites AS invites
    WHERE invite_token IS NOT NULL
      AND invite_token <> ''
      AND (
          invites.token_hash = encode(extensions.digest(invite_token, 'sha256'), 'hex')
          OR invites.token = invite_token
      )
    LIMIT 1
    FOR UPDATE;

    IF invite_row.id IS NULL
       OR invite_row.status <> 'pending'
       OR invite_row.revoked_at IS NOT NULL
       OR invite_row.expires_at <= now()
       OR (NOT invite_row.is_reusable AND invite_row.consumed_at IS NOT NULL) THEN
        RAISE EXCEPTION 'INVITE_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.workspace_members AS memberships (workspace_id, user_id, role)
    VALUES (invite_row.workspace_id, current_user_id, invite_row.role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET
        role = CASE
            WHEN memberships.role IN ('owner', 'admin') THEN memberships.role
            WHEN memberships.role = 'member' AND EXCLUDED.role = 'guest' THEN memberships.role
            ELSE EXCLUDED.role
        END,
        updated_at = now();

    IF NOT invite_row.is_reusable THEN
        UPDATE public.workspace_invites AS accepted_invite
        SET status = 'accepted', consumed_at = now(), updated_at = now()
        WHERE accepted_invite.id = invite_row.id;
    END IF;

    RETURN QUERY
    SELECT workspaces.id, workspaces.name, workspaces.created_by,
           workspaces.created_at, workspaces.updated_at,
           CASE WHEN members.role = 'owner' THEN 'admin' ELSE members.role END
    FROM public.workspaces AS workspaces
    INNER JOIN public.workspace_members AS members
        ON members.workspace_id = workspaces.id
       AND members.user_id = current_user_id
    WHERE workspaces.id = invite_row.workspace_id
    LIMIT 1;
END;
$function$;

REVOKE ALL ON TABLE public.workspace_invites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_workspace_invite(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_workspace_invites(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.revoke_workspace_invite(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_workspace_invite_by_token(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accept_workspace_invite(TEXT) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_workspace_invite(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_workspace_invites(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invite(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_invite_by_token(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_workspace_invite(UUID, TEXT) IS
    'Creates or atomically replaces the reusable 7-day invite for a workspace; admin role is refused.';
COMMENT ON FUNCTION public.list_workspace_invites(UUID) IS
    'Returns the active reusable invite token to workspace admins, plus remaining single-use historical invites.';
