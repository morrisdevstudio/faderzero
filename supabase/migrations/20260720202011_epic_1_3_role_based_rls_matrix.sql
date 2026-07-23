-- Story 1.3: least-privilege Data API grants and role-based RLS matrix.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON ROUTINES FROM anon, authenticated;

REVOKE ALL ON TABLE
    public.profiles,
    public.workspaces,
    public.workspace_members,
    public.workspace_invites,
    public.songs,
    public.setlists,
    public.setlist_songs,
    public.song_assets
FROM anon, authenticated;

REVOKE ALL ON SEQUENCE public.global_server_version_seq FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspaces TO authenticated;
GRANT SELECT, INSERT ON TABLE public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.songs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.setlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.setlist_songs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.song_assets TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.global_server_version_seq TO authenticated;

REVOKE ALL ON FUNCTION public.accept_workspace_invite(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_server_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_workspace_invite_by_token(TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_invite_by_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.can_bootstrap_workspace_membership(
    p_workspace_id UUID,
    p_user_id UUID,
    p_role TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        (SELECT auth.uid()) IS NOT NULL
        AND p_user_id = (SELECT auth.uid())
        AND p_role IN ('admin', 'owner')
        AND EXISTS (
            SELECT 1
            FROM public.workspaces AS workspaces
            WHERE workspaces.id = p_workspace_id
              AND workspaces.created_by = (SELECT auth.uid())
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.workspace_members AS members
            WHERE members.workspace_id = p_workspace_id
        );
$function$;

REVOKE ALL ON FUNCTION private.can_bootstrap_workspace_membership(UUID, UUID, TEXT)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_bootstrap_workspace_membership(UUID, UUID, TEXT)
TO authenticated, service_role;

DO $policies$
DECLARE
    policy_row RECORD;
BEGIN
    FOR policy_row IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY (ARRAY[
              'profiles',
              'workspaces',
              'workspace_members',
              'workspace_invites',
              'songs',
              'setlists',
              'setlist_songs',
              'song_assets'
          ])
    LOOP
        EXECUTE format(
            'DROP POLICY %I ON %I.%I',
            policy_row.policyname,
            policy_row.schemaname,
            policy_row.tablename
        );
    END LOOP;
END;
$policies$;

CREATE POLICY profiles_select_authenticated
    ON public.profiles FOR SELECT TO authenticated
    USING (true);

CREATE POLICY profiles_insert_self
    ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_self
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY workspaces_select_member
    ON public.workspaces FOR SELECT TO authenticated
    USING ((SELECT private.is_workspace_member(id)));

CREATE POLICY workspaces_insert_self
    ON public.workspaces FOR INSERT TO authenticated
    WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY workspaces_update_admin
    ON public.workspaces FOR UPDATE TO authenticated
    USING ((SELECT private.has_workspace_role(id, ARRAY['admin']::TEXT[])))
    WITH CHECK ((SELECT private.has_workspace_role(id, ARRAY['admin']::TEXT[])));

CREATE POLICY workspaces_delete_admin
    ON public.workspaces FOR DELETE TO authenticated
    USING ((SELECT private.has_workspace_role(id, ARRAY['admin']::TEXT[])));

CREATE POLICY workspace_members_select_member
    ON public.workspace_members FOR SELECT TO authenticated
    USING ((SELECT private.is_workspace_member(workspace_id)));

CREATE POLICY workspace_members_insert_bootstrap
    ON public.workspace_members FOR INSERT TO authenticated
    WITH CHECK ((SELECT private.can_bootstrap_workspace_membership(workspace_id, user_id, role)));

CREATE POLICY workspace_invites_select_admin
    ON public.workspace_invites FOR SELECT TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin']::TEXT[])));

CREATE POLICY workspace_invites_insert_admin
    ON public.workspace_invites FOR INSERT TO authenticated
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin']::TEXT[])));

CREATE POLICY workspace_invites_update_admin
    ON public.workspace_invites FOR UPDATE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin']::TEXT[])))
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin']::TEXT[])));

CREATE POLICY workspace_invites_delete_admin
    ON public.workspace_invites FOR DELETE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin']::TEXT[])));

CREATE POLICY songs_select_member
    ON public.songs FOR SELECT TO authenticated
    USING ((SELECT private.is_workspace_member(workspace_id)));

CREATE POLICY songs_insert_writer
    ON public.songs FOR INSERT TO authenticated
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY songs_update_writer
    ON public.songs FOR UPDATE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])))
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY songs_delete_writer
    ON public.songs FOR DELETE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY setlists_select_member
    ON public.setlists FOR SELECT TO authenticated
    USING ((SELECT private.is_workspace_member(workspace_id)));

CREATE POLICY setlists_insert_writer
    ON public.setlists FOR INSERT TO authenticated
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY setlists_update_writer
    ON public.setlists FOR UPDATE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])))
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY setlists_delete_writer
    ON public.setlists FOR DELETE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY setlist_songs_select_member
    ON public.setlist_songs FOR SELECT TO authenticated
    USING ((SELECT private.is_workspace_member(workspace_id)));

CREATE POLICY setlist_songs_insert_writer
    ON public.setlist_songs FOR INSERT TO authenticated
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY setlist_songs_update_writer
    ON public.setlist_songs FOR UPDATE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])))
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY setlist_songs_delete_writer
    ON public.setlist_songs FOR DELETE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY song_assets_select_member
    ON public.song_assets FOR SELECT TO authenticated
    USING ((SELECT private.is_workspace_member(workspace_id)));

CREATE POLICY song_assets_insert_writer
    ON public.song_assets FOR INSERT TO authenticated
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY song_assets_update_writer
    ON public.song_assets FOR UPDATE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])))
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY song_assets_delete_writer
    ON public.song_assets FOR DELETE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));
