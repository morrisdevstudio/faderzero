-- =====================================================================
-- 05_FIX_WORKSPACE_PERMISSIONS.SQL
-- Correctif incrementiel pour les instances deja initialisees.
-- - Expose les tables a la Data API via des GRANT explicites
-- - Permet au createur de voir son workspace avant l'ajout du membership
-- =====================================================================

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspaces TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_members TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_invites TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.songs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.setlists TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.setlist_songs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.song_assets TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public.global_server_version_seq TO authenticated, service_role;

DROP POLICY IF EXISTS "Les workspaces sont visibles par leurs membres" ON public.workspaces;
CREATE POLICY "Les workspaces sont visibles par leurs membres"
    ON public.workspaces FOR SELECT
    TO authenticated
    USING (created_by = auth.uid() OR public.check_is_workspace_member(id));

DROP POLICY IF EXISTS "Les membres du workspace peuvent le modifier" ON public.workspaces;
CREATE POLICY "Les membres du workspace peuvent le modifier"
    ON public.workspaces FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid() OR public.check_is_workspace_member(id))
    WITH CHECK (created_by = auth.uid() OR public.check_is_workspace_member(id));

DROP POLICY IF EXISTS "Les membres du workspace peuvent le supprimer" ON public.workspaces;
CREATE POLICY "Les membres du workspace peuvent le supprimer"
    ON public.workspaces FOR DELETE
    TO authenticated
    USING (created_by = auth.uid() OR public.check_is_workspace_member(id));

;
