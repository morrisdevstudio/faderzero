-- Create a group and its initial administrator atomically.
CREATE OR REPLACE FUNCTION public.create_workspace(p_name text)
RETURNS TABLE (
    id uuid,
    name text,
    created_by uuid,
    created_at timestamptz,
    updated_at timestamptz,
    workspace_type text,
    role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    caller_id uuid := (SELECT auth.uid());
    normalized_name text;
    new_workspace public.workspaces%ROWTYPE;
BEGIN
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;

    normalized_name := public.normalize_workspace_name(p_name);
    IF normalized_name IS NULL OR length(normalized_name) = 0 THEN
        RAISE EXCEPTION 'WORKSPACE_NAME_INVALID' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.workspaces AS workspaces
        WHERE lower(workspaces.name) = lower(normalized_name)
          AND (workspaces.deleted_at IS NULL OR workspaces.deleted_at > now() - interval '7 days')
    ) THEN
        RAISE EXCEPTION 'WORKSPACE_NAME_UNAVAILABLE' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.workspaces (name, created_by, workspace_type)
    VALUES (normalized_name, caller_id, 'group')
    RETURNING * INTO new_workspace;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace.id, caller_id, 'admin');

    RETURN QUERY
    SELECT
        new_workspace.id,
        new_workspace.name,
        new_workspace.created_by,
        new_workspace.created_at,
        new_workspace.updated_at,
        new_workspace.workspace_type,
        'admin'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_workspace(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_workspace(text) TO authenticated;
