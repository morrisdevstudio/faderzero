-- =====================================================================
-- 02_RLS.SQL
-- Activation de RLS, fonctions utilitaires sécurisées et policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ACTIVATION DE RLS SUR TOUTES LES TABLES
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_assets ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- GRANTS DATA API
-- Necessaires pour exposer explicitement les tables a PostgREST.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- FONCTION SECURISÉE POUR EVITER LA RECURSION SUR WORKSPACE_MEMBERS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_is_workspace_member(w_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_members.workspace_id = w_id 
          AND workspace_members.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

-- Réduire les privilèges d'exécution au strict minimum
REVOKE EXECUTE ON FUNCTION public.check_is_workspace_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_is_workspace_member(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- POLICIES POUR LA TABLE PROFILES
-- ---------------------------------------------------------------------
CREATE POLICY "Les profils sont visibles par tous les utilisateurs connectés"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Les utilisateurs peuvent insérer leur propre profil"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------
-- POLICIES POUR LA TABLE WORKSPACES
-- ---------------------------------------------------------------------
CREATE POLICY "Les workspaces sont visibles par leurs membres"
    ON public.workspaces FOR SELECT
    TO authenticated
    USING (created_by = auth.uid() OR public.check_is_workspace_member(id));

CREATE POLICY "Tout utilisateur connecté peut créer un workspace"
    ON public.workspaces FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Les membres du workspace peuvent le modifier"
    ON public.workspaces FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid() OR public.check_is_workspace_member(id))
    WITH CHECK (created_by = auth.uid() OR public.check_is_workspace_member(id));

CREATE POLICY "Les membres du workspace peuvent le supprimer"
    ON public.workspaces FOR DELETE
    TO authenticated
    USING (created_by = auth.uid() OR public.check_is_workspace_member(id));

-- ---------------------------------------------------------------------
-- POLICIES POUR LA TABLE WORKSPACE_MEMBERS
-- ---------------------------------------------------------------------
CREATE POLICY "Les membres de workspace sont visibles par l'utilisateur ou les autres membres"
    ON public.workspace_members FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.check_is_workspace_member(workspace_id));

CREATE POLICY "Le créateur du workspace ou un membre existant peut ajouter des membres"
    ON public.workspace_members FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() 
        AND (
            public.check_is_workspace_member(workspace_id) 
            OR (SELECT created_by FROM public.workspaces WHERE id = workspace_id) = auth.uid()
        )
    );

CREATE POLICY "Les membres peuvent être modifiés par le groupe"
    ON public.workspace_members FOR UPDATE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id))
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les membres peuvent être supprimés par le groupe"
    ON public.workspace_members FOR DELETE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------
-- POLICIES POUR LA TABLE WORKSPACE_INVITES
-- ---------------------------------------------------------------------
CREATE POLICY "Les invitations sont visibles par les membres"
    ON public.workspace_invites FOR SELECT
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les invitations peuvent être créées par les membres"
    ON public.workspace_invites FOR INSERT
    TO authenticated
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les invitations peuvent être mises à jour par les membres"
    ON public.workspace_invites FOR UPDATE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id))
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les invitations peuvent être supprimées par les membres"
    ON public.workspace_invites FOR DELETE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------
-- POLICIES POUR LA TABLE SONGS
-- ---------------------------------------------------------------------
CREATE POLICY "Les morceaux sont visibles par les membres du workspace"
    ON public.songs FOR SELECT
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les morceaux peuvent être créés par les membres du workspace"
    ON public.songs FOR INSERT
    TO authenticated
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les morceaux peuvent être modifiés par les membres du workspace"
    ON public.songs FOR UPDATE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id))
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les morceaux peuvent être supprimés par les membres du workspace"
    ON public.songs FOR DELETE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------
-- POLICIES POUR LA TABLE SETLISTS
-- ---------------------------------------------------------------------
CREATE POLICY "Les setlists sont visibles par les membres du workspace"
    ON public.setlists FOR SELECT
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les setlists peuvent être créées par les membres du workspace"
    ON public.setlists FOR INSERT
    TO authenticated
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les setlists peuvent être modifiées par les membres du workspace"
    ON public.setlists FOR UPDATE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id))
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les setlists peuvent être supprimées par les membres du workspace"
    ON public.setlists FOR DELETE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------
-- POLICIES POUR LA TABLE SETLIST_SONGS
-- ---------------------------------------------------------------------
CREATE POLICY "Les liaisons setlist_songs sont visibles par les membres du workspace"
    ON public.setlist_songs FOR SELECT
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les liaisons setlist_songs peuvent être créées par les membres du workspace"
    ON public.setlist_songs FOR INSERT
    TO authenticated
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les liaisons setlist_songs peuvent être modifiées par les membres"
    ON public.setlist_songs FOR UPDATE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id))
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les liaisons setlist_songs peuvent être supprimées par les membres"
    ON public.setlist_songs FOR DELETE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------
-- POLICIES POUR LA TABLE SONG_ASSETS
-- ---------------------------------------------------------------------
CREATE POLICY "Les assets song_assets sont visibles par les membres du workspace"
    ON public.song_assets FOR SELECT
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les assets song_assets peuvent être créés par les membres du workspace"
    ON public.song_assets FOR INSERT
    TO authenticated
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les assets song_assets peuvent être modifiés par les membres"
    ON public.song_assets FOR UPDATE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id))
    WITH CHECK (public.check_is_workspace_member(workspace_id));

CREATE POLICY "Les assets song_assets peuvent être supprimés par les membres"
    ON public.song_assets FOR DELETE
    TO authenticated
    USING (public.check_is_workspace_member(workspace_id));
