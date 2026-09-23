-- The application treats group owners as administrators. Keep the database
-- authorization aligned so an owner can administer their group's EPK.
CREATE OR REPLACE FUNCTION private.is_epk_admin(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces AS w
    JOIN public.workspace_members AS m ON m.workspace_id = w.id
    WHERE w.id = p_workspace_id
      AND w.workspace_type = 'group'
      AND w.deleted_at IS NULL
      AND m.user_id = (SELECT auth.uid())
      AND m.role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION private.is_epk_admin(uuid) FROM PUBLIC;
