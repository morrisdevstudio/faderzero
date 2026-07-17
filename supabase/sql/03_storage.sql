-- =====================================================================
-- 03_STORAGE.SQL
-- Création du bucket de stockage audio privé et règles de sécurité.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENREGISTREMENT DU BUCKET PRIVATE 'faderzero-audio'
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'faderzero-audio', 
    'faderzero-audio', 
    FALSE,              -- Bucket privé (nécessite des URLs signées)
    52428800,           -- Limite de 50 Mo par fichier audio
    ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/flac']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------
-- POLICIES DE SECURITÉ SUR LES OBJETS DU BUCKET 'faderzero-audio'
-- ---------------------------------------------------------------------

-- Chemins attendus : workspaces/{workspaceId}/songs/{songId}/{assetId}.{ext}
-- ou workspaces/{workspaceId}/imports/{assetId}.{ext} pour une musique non liee.
-- On extrait le workspaceId de l'objet via split_part(name, '/', 2).

CREATE POLICY "Les membres du workspace peuvent lire les fichiers audio"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'faderzero-audio'
        AND split_part(name, '/', 1) = 'workspaces'
        AND split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.check_is_workspace_member(cast(split_part(name, '/', 2) AS UUID))
    );

CREATE POLICY "Les membres du workspace peuvent uploader des fichiers audio"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'faderzero-audio'
        AND split_part(name, '/', 1) = 'workspaces'
        AND split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.check_is_workspace_member(cast(split_part(name, '/', 2) AS UUID))
    );

CREATE POLICY "Les membres du workspace peuvent modifier les fichiers audio"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'faderzero-audio'
        AND split_part(name, '/', 1) = 'workspaces'
        AND split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.check_is_workspace_member(cast(split_part(name, '/', 2) AS UUID))
    )
    WITH CHECK (
        bucket_id = 'faderzero-audio'
        AND split_part(name, '/', 1) = 'workspaces'
        AND split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.check_is_workspace_member(cast(split_part(name, '/', 2) AS UUID))
    );

CREATE POLICY "Les membres du workspace peuvent supprimer les fichiers audio"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'faderzero-audio'
        AND split_part(name, '/', 1) = 'workspaces'
        AND split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.check_is_workspace_member(cast(split_part(name, '/', 2) AS UUID))
    );
