-- Story 2.2: server-generated, role-scoped, single-use invitation links.
ALTER TABLE public.workspace_invites ALTER COLUMN token DROP NOT NULL;

DROP FUNCTION IF EXISTS public.get_workspace_invite_by_token(TEXT);
DROP FUNCTION IF EXISTS public.accept_workspace_invite(TEXT);

CREATE FUNCTION public.create_workspace_invite(p_workspace_id UUID, p_role TEXT)
RETURNS TABLE (invite_id UUID, token TEXT, role TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_id UUID := (SELECT auth.uid());
    raw_token TEXT;
    raw_token_hash TEXT;
    new_invite_id UUID;
    new_expires_at TIMESTAMPTZ := now() + interval '24 hours';
    active_count INTEGER;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF p_role IS NULL OR p_role NOT IN ('admin', 'member', 'guest') THEN
        RAISE EXCEPTION 'INVALID_INVITE_ROLE' USING ERRCODE = '22023';
    END IF;
    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin']::TEXT[]) THEN
        RAISE EXCEPTION 'WORKSPACE_ADMIN_REQUIRED' USING ERRCODE = '42501';
    END IF;

    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

    SELECT count(*) INTO active_count
    FROM public.workspace_invites AS invites
    WHERE invites.workspace_id = p_workspace_id
      AND invites.role = p_role
      AND invites.status = 'pending'
      AND invites.consumed_at IS NULL
      AND invites.revoked_at IS NULL
      AND invites.expires_at > now();

    IF active_count >= 5 THEN
        RAISE EXCEPTION 'INVITE_ROLE_LIMIT_REACHED' USING ERRCODE = '23514';
    END IF;

    raw_token := encode(extensions.gen_random_bytes(32), 'hex');
    raw_token_hash := encode(extensions.digest(raw_token, 'sha256'), 'hex');
    new_invite_id := extensions.gen_random_uuid();

    INSERT INTO public.workspace_invites (
        id, workspace_id, email, token, token_hash, role,
        status, created_by, expires_at
    ) VALUES (
        new_invite_id, p_workspace_id, COALESCE(auth.jwt() ->> 'email', ''),
        NULL, raw_token_hash, p_role, 'pending', current_user_id, new_expires_at
    );

    RETURN QUERY SELECT new_invite_id, raw_token, p_role, new_expires_at;
END;
$function$;

CREATE FUNCTION public.list_workspace_invites(p_workspace_id UUID)
RETURNS TABLE (invite_id UUID, role TEXT, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
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
    SELECT invites.id, invites.role, invites.created_at, invites.expires_at
    FROM public.workspace_invites AS invites
    WHERE invites.workspace_id = p_workspace_id
      AND invites.status = 'pending'
      AND invites.consumed_at IS NULL
      AND invites.revoked_at IS NULL
      AND invites.expires_at > now()
    ORDER BY invites.created_at DESC;
END;
$function$;

CREATE FUNCTION public.revoke_workspace_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    target_workspace_id UUID;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;

    SELECT invites.workspace_id INTO target_workspace_id
    FROM public.workspace_invites AS invites
    WHERE invites.id = p_invite_id
    FOR UPDATE;

    IF target_workspace_id IS NULL
       OR NOT private.has_workspace_role(target_workspace_id, ARRAY['admin']::TEXT[]) THEN
        RAISE EXCEPTION 'INVITE_UNAVAILABLE' USING ERRCODE = '42501';
    END IF;

    UPDATE public.workspace_invites AS invites
    SET revoked_at = now(), updated_at = now()
    WHERE invites.id = p_invite_id
      AND invites.status = 'pending'
      AND invites.consumed_at IS NULL
      AND invites.revoked_at IS NULL
      AND invites.expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVITE_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN p_invite_id;
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
      AND invites.consumed_at IS NULL
      AND invites.revoked_at IS NULL
      AND invites.expires_at > now()
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
       OR invite_row.consumed_at IS NOT NULL
       OR invite_row.revoked_at IS NOT NULL
       OR invite_row.expires_at <= now() THEN
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

    UPDATE public.workspace_invites AS accepted_invite
    SET status = 'accepted', consumed_at = now(), updated_at = now()
    WHERE accepted_invite.id = invite_row.id;

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
    'Creates a 24-hour role-scoped invite; the raw token is returned once and never stored.';
