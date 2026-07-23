-- Story 1.4: all membership mutations are serialized on the workspace row.

CREATE OR REPLACE FUNCTION public.set_workspace_member_role(
    p_workspace_id UUID,
    p_user_id UUID,
    p_role TEXT
)
RETURNS public.workspace_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    target_member public.workspace_members%ROWTYPE;
    updated_member public.workspace_members%ROWTYPE;
    admin_count BIGINT;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.workspaces
    WHERE id = p_workspace_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin']::TEXT[]) THEN
        RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
    END IF;

    IF p_role NOT IN ('admin', 'member', 'guest') THEN
        RAISE EXCEPTION 'INVALID_WORKSPACE_ROLE' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO target_member
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF target_member.role IN ('owner', 'admin') AND p_role <> 'admin' THEN
        SELECT count(*)
        INTO admin_count
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND role IN ('owner', 'admin');

        IF admin_count <= 1 THEN
            RAISE EXCEPTION 'LAST_ADMIN_REQUIRED' USING ERRCODE = '23514';
        END IF;
    END IF;

    UPDATE public.workspace_members
    SET role = p_role, updated_at = now()
    WHERE id = target_member.id
    RETURNING * INTO updated_member;

    RETURN updated_member;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_workspace_member(
    p_workspace_id UUID,
    p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    target_member public.workspace_members%ROWTYPE;
    admin_count BIGINT;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.workspaces
    WHERE id = p_workspace_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin']::TEXT[]) THEN
        RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
    END IF;

    IF p_user_id = (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'USE_LEAVE_WORKSPACE' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO target_member
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF target_member.role IN ('owner', 'admin') THEN
        SELECT count(*)
        INTO admin_count
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND role IN ('owner', 'admin');

        IF admin_count <= 1 THEN
            RAISE EXCEPTION 'LAST_ADMIN_REQUIRED' USING ERRCODE = '23514';
        END IF;
    END IF;

    DELETE FROM public.workspace_members WHERE id = target_member.id;
    RETURN target_member.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_workspace(p_workspace_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    target_member public.workspace_members%ROWTYPE;
    admin_count BIGINT;
BEGIN
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.workspaces
    WHERE id = p_workspace_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO target_member
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = (SELECT auth.uid())
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF target_member.role IN ('owner', 'admin') THEN
        SELECT count(*)
        INTO admin_count
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND role IN ('owner', 'admin');

        IF admin_count <= 1 THEN
            RAISE EXCEPTION 'LAST_ADMIN_REQUIRED' USING ERRCODE = '23514';
        END IF;
    END IF;

    DELETE FROM public.workspace_members WHERE id = target_member.id;
    RETURN target_member.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_workspace_member_role(UUID, UUID, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.remove_workspace_member(UUID, UUID)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.leave_workspace(UUID)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.set_workspace_member_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_workspace(UUID) TO authenticated;
