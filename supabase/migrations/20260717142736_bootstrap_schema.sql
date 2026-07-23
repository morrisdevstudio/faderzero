-- =====================================================================
-- 01_SCHEMA.SQL
-- DÃ©finition du schÃ©ma, des index et des triggers de versionnement.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SÃ‰QUENCE GLOBALE DE VERSIONNEMENT
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS global_server_version_seq START WITH 1;

-- ---------------------------------------------------------------------
-- TABLE PROFILES (LiÃ©e Ã  auth.users de Supabase)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- TABLE WORKSPACES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- TABLE WORKSPACE_MEMBERS (Appartenance et rÃ´les)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_id)
);

-- ---------------------------------------------------------------------
-- TABLE WORKSPACE_INVITES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- TABLE SONGS (MÃ©tier)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.songs (
    id TEXT PRIMARY KEY, -- Dexie-compatible text ID
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    artist TEXT,
    lyrics TEXT NOT NULL DEFAULT '',
    key TEXT,
    bpm INTEGER,
    status TEXT NOT NULL CHECK (status IN ('Idee', 'En cours', 'Pret')),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    server_version BIGINT NOT NULL DEFAULT 1,
    last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- TABLE SETLISTS (MÃ©tier)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.setlists (
    id TEXT PRIMARY KEY, -- Dexie-compatible text ID
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date TEXT,
    notes TEXT,
    closing_annotation TEXT,
    bpm_display_mode TEXT NOT NULL DEFAULT 'per-song' CHECK (bpm_display_mode IN ('all', 'none', 'per-song')),
    key_display_mode TEXT NOT NULL DEFAULT 'per-song' CHECK (key_display_mode IN ('all', 'none', 'per-song')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    server_version BIGINT NOT NULL DEFAULT 1,
    last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- TABLE SETLIST_SONGS (MÃ©tier - L'ordre des morceaux dans les setlists)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.setlist_songs (
    id TEXT PRIMARY KEY, -- Dexie-compatible text ID
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    setlist_id TEXT NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
    song_id TEXT REFERENCES public.songs(id) ON DELETE SET NULL,
    position INTEGER NOT NULL,
    annotation TEXT,
    note_show_bpm BOOLEAN NOT NULL DEFAULT FALSE,
    note_show_key BOOLEAN NOT NULL DEFAULT FALSE,
    is_direct_segue BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    server_version BIGINT NOT NULL DEFAULT 1,
    last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- TABLE SONG_ASSETS (MÃ©tadonnÃ©es des audios stockÃ©s)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.song_assets (
    id TEXT PRIMARY KEY, -- Dexie-compatible text ID
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    server_version BIGINT NOT NULL DEFAULT 1,
    last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- INDEXES DE PERFORMANCE & SYNC
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_songs_workspace_updated ON public.songs(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_songs_workspace_deleted ON public.songs(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_setlists_workspace_updated ON public.setlists(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_setlists_workspace_deleted ON public.setlists(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_setlist_songs_workspace_setlist_pos ON public.setlist_songs(workspace_id, setlist_id, position);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_workspace_updated ON public.setlist_songs(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_workspace_deleted ON public.setlist_songs(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_song_assets_workspace_song ON public.song_assets(workspace_id, song_id);
CREATE INDEX IF NOT EXISTS idx_song_assets_workspace_updated ON public.song_assets(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_song_assets_workspace_deleted ON public.song_assets(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- FONCTIONS ET TRIGGERS AUTOMATIQUES
-- ---------------------------------------------------------------------

-- Trigger function pour incrÃ©menter server_version et timestamp
CREATE OR REPLACE FUNCTION public.bump_server_version()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.client_updated_at := COALESCE(NEW.client_updated_at, NEW.updated_at, now());
    ELSE
        NEW.client_updated_at := COALESCE(NEW.client_updated_at, NEW.updated_at, OLD.client_updated_at, now());
    END IF;
    NEW.server_version := nextval('public.global_server_version_seq');
    NEW.updated_at := now();
    IF auth.uid() IS NOT NULL THEN
        NEW.last_modified_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Attachement des triggers aux tables mÃ©tier
CREATE TRIGGER trigger_bump_songs_version
    BEFORE INSERT OR UPDATE ON public.songs
    FOR EACH ROW EXECUTE FUNCTION public.bump_server_version();

CREATE TRIGGER trigger_bump_setlists_version
    BEFORE INSERT OR UPDATE ON public.setlists
    FOR EACH ROW EXECUTE FUNCTION public.bump_server_version();

CREATE TRIGGER trigger_bump_setlist_songs_version
    BEFORE INSERT OR UPDATE ON public.setlist_songs
    FOR EACH ROW EXECUTE FUNCTION public.bump_server_version();

CREATE TRIGGER trigger_bump_song_assets_version
    BEFORE INSERT OR UPDATE ON public.song_assets
    FOR EACH ROW EXECUTE FUNCTION public.bump_server_version();

-- Trigger automatique pour la crÃ©ation de profil Ã  l'inscription auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SÃ©curisation du trigger de profil
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
;
