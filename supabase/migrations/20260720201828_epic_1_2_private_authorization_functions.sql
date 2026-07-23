-- Story 1.2: authorization helpers live outside exposed API schemas.
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.has_workspace_role(
    p_workspace_id UUID,
    p_roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        (SELECT auth.uid()) IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.workspace_members AS members
            WHERE members.workspace_id = p_workspace_id
              AND members.user_id = (SELECT auth.uid())
              AND CASE
                    WHEN members.role = 'owner' THEN 'admin'
                    ELSE members.role
                  END = ANY (COALESCE(p_roles, ARRAY[]::TEXT[]))
        );
$function$;

CREATE OR REPLACE FUNCTION private.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT private.has_workspace_role(
        p_workspace_id,
        ARRAY['admin', 'member', 'guest']::TEXT[]
    );
$function$;

REVOKE ALL ON FUNCTION private.has_workspace_role(UUID, TEXT[])
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.is_workspace_member(UUID)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.has_workspace_role(UUID, TEXT[])
TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_workspace_member(UUID)
TO authenticated, service_role;

-- Compatibility wrapper retained for two versions and at least thirty days.
CREATE OR REPLACE FUNCTION public.check_is_workspace_member(w_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT private.is_workspace_member(w_id);
$function$;

REVOKE ALL ON FUNCTION public.check_is_workspace_member(UUID)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_is_workspace_member(UUID)
TO authenticated, service_role;

COMMENT ON FUNCTION public.check_is_workspace_member(UUID) IS
    'Legacy compatibility wrapper; retire only after two versions and at least 30 days';
