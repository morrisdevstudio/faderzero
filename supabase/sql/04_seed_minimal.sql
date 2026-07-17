-- =====================================================================
-- 04_SEED_MINIMAL.SQL
-- Jeu de données minimal pour test d'intégration local-first.
-- Ce script associe le seed au premier utilisateur trouvé dans auth.users.
-- =====================================================================

DO $$
DECLARE
    target_user_id UUID;
    new_workspace_id UUID := '8f3b610c-550a-4bf4-9957-afa5a74cf1bc'; -- UUID fixe pour faciliter les tests répétables
BEGIN
    -- 1. Récupération du premier utilisateur de la table auth.users
    SELECT id INTO target_user_id FROM auth.users LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'Aucun utilisateur trouvé dans auth.users. Veuillez d''abord créer un utilisateur via l''Auth de l''application pour exécuter le seed.';
    ELSE
        -- 2. Création du workspace de test (si non existant)
        INSERT INTO public.workspaces (id, name, created_by)
        VALUES (new_workspace_id, 'Mon Workspace de Test', target_user_id)
        ON CONFLICT (id) DO NOTHING;

        -- 3. Association de l'utilisateur au workspace comme owner (si non existant)
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (new_workspace_id, target_user_id, 'owner')
        ON CONFLICT (workspace_id, user_id) DO NOTHING;

        -- 4. Insertion de morceaux de musique de démonstration (si non existant)
        INSERT INTO public.songs (id, workspace_id, title, artist, lyrics, status, bpm, duration_seconds)
        VALUES 
            (
                'song-demo-1', 
                new_workspace_id, 
                'Bohemian Rhapsody', 
                'Queen', 
                'Is this the real life? Is this just fantasy?...', 
                'Pret', 
                72, 
                    355
            ),
            (
                'song-demo-2', 
                new_workspace_id, 
                'Hotel California', 
                'Eagles', 
                'On a dark desert highway, cool wind in my hair...', 
                'En cours', 
                74, 
                390
            )
        ON CONFLICT (id) DO NOTHING;

        -- 5. Insertion d'une setlist de démonstration (si non existant)
        INSERT INTO public.setlists (id, workspace_id, name, date, notes)
        VALUES (
            'setlist-demo-1', 
            new_workspace_id, 
            'Concert d''été', 
            '2026-07-15', 
            'Setlist d''échauffement pour la tournée'
        )
        ON CONFLICT (id) DO NOTHING;

        -- 6. Association des morceaux à la setlist (si non existant)
        INSERT INTO public.setlist_songs (id, workspace_id, setlist_id, song_id, position)
        VALUES 
            ('link-demo-1', new_workspace_id, 'setlist-demo-1', 'song-demo-1', 1),
            ('link-demo-2', new_workspace_id, 'setlist-demo-1', 'song-demo-2', 2)
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Seed minimal injecté avec succès pour l''utilisateur % !', target_user_id;
    END IF;
END $$;
