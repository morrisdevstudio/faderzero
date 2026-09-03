-- These four functions kept PostgreSQL's default PUBLIC EXECUTE grant, which
-- 20260723100000_epic_6_group_admin_trash.sql never revoked when it granted
-- them to authenticated and service_role. PUBLIC includes `anon`, so all four
-- were reachable through /rest/v1/rpc with the publishable anon key.
--
-- purge_expired_workspaces is the only exploitable one: it performs a hard
-- DELETE with no auth.uid() and no role check, so any caller could permanently
-- destroy workspaces that restore_workspace could still have recovered, since
-- restoring has no time limit. It is a maintenance job with no caller in the
-- app and no pg_cron schedule, so it becomes service_role only.
REVOKE ALL ON FUNCTION public.purge_expired_workspaces(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_workspaces(boolean) TO service_role;

-- soft_delete_workspace and restore_workspace already raise AUTH_REQUIRED for
-- anonymous callers and then demand the workspace admin role, so dropping
-- PUBLIC is defense in depth and changes no behaviour.
-- check_workspace_name_available is read-only, but PUBLIC access allowed anyone
-- to enumerate existing group names. It is only called from the authenticated
-- account screen.
REVOKE ALL ON FUNCTION public.soft_delete_workspace(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_workspace(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_workspace_name_available(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.soft_delete_workspace(uuid),
  public.restore_workspace(uuid),
  public.check_workspace_name_available(text, uuid)
TO authenticated, service_role;
