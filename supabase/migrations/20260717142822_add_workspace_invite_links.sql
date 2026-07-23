-- =====================================================================
-- 09_WORKSPACE_INVITE_LINKS.SQL
-- Fonctions pour consulter et accepter une invitation par lien partage.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_workspace_invite_by_token(invite_token TEXT)
RETURNS TABLE (
    workspace_id UUID,
    workspace_name TEXT,
    status TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        invites.workspace_id,
        workspaces.name,
        CASE
            WHEN invites.expires_at IS NOT NULL AND invites.expires_at < now() THEN 'expired'
            ELSE invites.status
        END,
        invites.expires_at
    FROM public.workspace_invites AS invites
    INNER JOIN public.workspaces AS workspaces ON workspaces.id = invites.workspace_id
    WHERE invites.token = invite_token
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(invite_token TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invite_row public.workspace_invites%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;

    SELECT *
    INTO invite_row
    FROM public.workspace_invites
    WHERE token = invite_token
    LIMIT 1;

    IF invite_row.id IS NULL THEN
        RAISE EXCEPTION 'INVITE_NOT_FOUND';
    END IF;

    IF invite_row.expires_at IS NOT NULL AND invite_row.expires_at < now() THEN
        UPDATE public.workspace_invites AS invites_to_expire
        SET status = 'expired', updated_at = now()
        WHERE invites_to_expire.id = invite_row.id;

        RAISE EXCEPTION 'INVITE_EXPIRED';
    END IF;

    IF invite_row.status NOT IN ('pending', 'accepted') THEN
        RAISE EXCEPTION 'INVITE_UNAVAILABLE';
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (invite_row.workspace_id, auth.uid(), 'member')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    UPDATE public.workspace_invites AS accepted_invite
    SET status = 'accepted', updated_at = now()
    WHERE accepted_invite.id = invite_row.id;

    RETURN QUERY
    SELECT
        workspaces.id,
        workspaces.name,
        workspaces.created_by,
        workspaces.created_at,
        workspaces.updated_at
    FROM public.workspaces AS workspaces
    WHERE workspaces.id = invite_row.workspace_id
    LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_workspace_invite_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_invite_by_token(TEXT) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) TO authenticated, service_role;;
