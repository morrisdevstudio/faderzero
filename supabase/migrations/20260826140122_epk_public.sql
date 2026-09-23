-- EPK public V1. This migration deliberately keeps public EPK data private to
-- Supabase clients: the Cloudflare Worker is the only anonymous read surface.

CREATE TABLE IF NOT EXISTS public.epks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE DEFAULT '',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  genres text[] NOT NULL DEFAULT '{}',
  city text,
  country text,
  tagline text,
  short_bio text,
  full_bio text,
  hero_asset_id uuid,
  logo_asset_id uuid,
  featured_type text CHECK (featured_type IN ('VIDEO', 'AUDIO', 'IMAGE')),
  featured_id uuid,
  status_before_workspace_delete text CHECK (status_before_workspace_delete IN ('DRAFT', 'PUBLISHED')),
  theme text NOT NULL DEFAULT 'stage-dark' CHECK (theme IN ('stage-dark', 'midnight-blue', 'press-ivory', 'fader-red')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz NOT NULL DEFAULT now(),
  server_version bigint NOT NULL DEFAULT nextval('public.global_server_version_seq')
);

CREATE TABLE IF NOT EXISTS public.epk_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epk_id uuid NOT NULL REFERENCES public.epks(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  kind text NOT NULL CHECK (kind IN ('image_preview', 'image_original', 'logo', 'audio', 'artwork', 'document')),
  original_filename text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz NOT NULL DEFAULT now(),
  server_version bigint NOT NULL DEFAULT nextval('public.global_server_version_seq')
);

ALTER TABLE public.epks
  ADD CONSTRAINT epks_hero_asset_fkey FOREIGN KEY (hero_asset_id) REFERENCES public.epk_assets(id) ON DELETE SET NULL,
  ADD CONSTRAINT epks_logo_asset_fkey FOREIGN KEY (logo_asset_id) REFERENCES public.epk_assets(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.epk_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), epk_id uuid NOT NULL REFERENCES public.epks(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('YOUTUBE', 'VIMEO')), provider_video_id text NOT NULL,
  title text, video_type text NOT NULL DEFAULT 'OTHER' CHECK (video_type IN ('LIVE', 'LIVE_SESSION', 'MUSIC_VIDEO', 'INTERVIEW', 'OTHER')),
  position integer NOT NULL CHECK (position >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), client_updated_at timestamptz NOT NULL DEFAULT now(), server_version bigint NOT NULL DEFAULT nextval('public.global_server_version_seq'),
  UNIQUE (epk_id, position)
);
CREATE TABLE IF NOT EXISTS public.epk_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), epk_id uuid NOT NULL REFERENCES public.epks(id) ON DELETE CASCADE,
  title text NOT NULL, description text, visibility text NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'UNLISTED')),
  position integer NOT NULL CHECK (position >= 0), source_type text NOT NULL CHECK (source_type IN ('EPK_ASSET', 'SONG_ASSET')),
  audio_asset_id uuid REFERENCES public.epk_assets(id) ON DELETE SET NULL,
  song_asset_id text REFERENCES public.song_assets(id) ON DELETE SET NULL,
  artwork_asset_id uuid REFERENCES public.epk_assets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), client_updated_at timestamptz NOT NULL DEFAULT now(), server_version bigint NOT NULL DEFAULT nextval('public.global_server_version_seq'),
  UNIQUE (epk_id, position),
  CHECK ((source_type = 'EPK_ASSET' AND audio_asset_id IS NOT NULL AND song_asset_id IS NULL) OR (source_type = 'SONG_ASSET' AND song_asset_id IS NOT NULL AND audio_asset_id IS NULL))
);
CREATE TABLE IF NOT EXISTS public.epk_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), epk_id uuid NOT NULL REFERENCES public.epks(id) ON DELETE CASCADE,
  preview_asset_id uuid NOT NULL REFERENCES public.epk_assets(id) ON DELETE RESTRICT,
  original_asset_id uuid NOT NULL REFERENCES public.epk_assets(id) ON DELETE RESTRICT,
  credit text, caption text, position integer NOT NULL CHECK (position >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), client_updated_at timestamptz NOT NULL DEFAULT now(), server_version bigint NOT NULL DEFAULT nextval('public.global_server_version_seq'), UNIQUE (epk_id, position)
);
CREATE TABLE IF NOT EXISTS public.epk_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), epk_id uuid NOT NULL REFERENCES public.epks(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.epk_assets(id) ON DELETE RESTRICT, title text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('TECH_RIDER', 'STAGE_PLOT', 'HOSPITALITY_RIDER', 'PRESS_KIT', 'LOGO', 'OTHER')),
  document_updated_at date NOT NULL DEFAULT current_date, position integer NOT NULL CHECK (position >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), client_updated_at timestamptz NOT NULL DEFAULT now(), server_version bigint NOT NULL DEFAULT nextval('public.global_server_version_seq'), UNIQUE (epk_id, position)
);
CREATE TABLE IF NOT EXISTS public.epk_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), epk_id uuid NOT NULL REFERENCES public.epks(id) ON DELETE CASCADE,
  name text NOT NULL, role text NOT NULL DEFAULT 'OTHER' CHECK (role IN ('BAND', 'BOOKING', 'MANAGEMENT', 'TECH', 'PRESS', 'PRODUCTION', 'OTHER')),
  organisation text, email text, phone text, whatsapp text, position integer NOT NULL CHECK (position >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), client_updated_at timestamptz NOT NULL DEFAULT now(), server_version bigint NOT NULL DEFAULT nextval('public.global_server_version_seq'), UNIQUE (epk_id, position), CHECK (email IS NOT NULL OR phone IS NOT NULL OR whatsapp IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.epk_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), epk_id uuid NOT NULL REFERENCES public.epks(id) ON DELETE CASCADE,
  kind text NOT NULL, label text, url text NOT NULL, position integer NOT NULL CHECK (position >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), client_updated_at timestamptz NOT NULL DEFAULT now(), server_version bigint NOT NULL DEFAULT nextval('public.global_server_version_seq'), UNIQUE (epk_id, position)
);
CREATE TABLE IF NOT EXISTS private.epk_asset_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), storage_path text NOT NULL UNIQUE, reason text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0, last_error text, next_attempt_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.is_epk_admin(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspaces w JOIN public.workspace_members m ON m.workspace_id = w.id WHERE w.id = p_workspace_id AND w.workspace_type = 'group' AND w.deleted_at IS NULL AND m.user_id = (select auth.uid()) AND m.role = 'admin');
$$;
REVOKE ALL ON FUNCTION private.is_epk_admin(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.normalize_epk_slug(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(translate(coalesce(p_value, ''), 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝŸàáâãäåæçèéêëìíîïðñòóôõöøùúûüýÿ', 'AAAAAAACEEEEIIIIDNOOOOOOUUUUYYaaaaaaaceeeeiiiidnoooooouuuuyy')), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.validate_epk()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = NEW.workspace_id AND workspace_type = 'group') THEN RAISE EXCEPTION 'EPK_WORKSPACE_MUST_BE_GROUP'; END IF;
  NEW.slug := public.normalize_epk_slug(NEW.slug);
  IF NEW.slug = '' OR NEW.slug IN ('home','calendar','booking','songs','setlists','prompter','sync','metronome','account','api','assets','media','preview','internal') THEN RAISE EXCEPTION 'EPK_SLUG_INVALID'; END IF;
  IF cardinality(NEW.genres) > 5 OR EXISTS (SELECT 1 FROM unnest(NEW.genres) AS genre WHERE length(trim(genre)) = 0 OR length(trim(genre)) > 40) THEN RAISE EXCEPTION 'EPK_GENRES_INVALID'; END IF;
  IF NEW.status = 'PUBLISHED' AND (trim(NEW.display_name) = '' OR cardinality(NEW.genres) = 0 OR coalesce(nullif(trim(NEW.city), ''), '') = '' OR (NEW.hero_asset_id IS NULL AND NEW.featured_id IS NULL) OR NOT EXISTS (SELECT 1 FROM public.epk_contacts c WHERE c.epk_id = NEW.id AND (nullif(trim(c.email), '') IS NOT NULL OR nullif(trim(c.phone), '') IS NOT NULL OR nullif(trim(c.whatsapp), '') IS NOT NULL))) THEN RAISE EXCEPTION 'EPK_PUBLISH_REQUIREMENTS_MISSING'; END IF;
  NEW.updated_at := now(); NEW.server_version := nextval('public.global_server_version_seq');
  IF NEW.status = 'PUBLISHED' AND NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER epks_validate BEFORE INSERT OR UPDATE ON public.epks FOR EACH ROW EXECUTE FUNCTION public.validate_epk();

CREATE OR REPLACE FUNCTION public.unpublish_epk_when_workspace_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.epks SET status_before_workspace_delete = status, status = 'DRAFT' WHERE workspace_id = NEW.id;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    UPDATE public.epks SET status = status_before_workspace_delete, status_before_workspace_delete = NULL WHERE workspace_id = NEW.id AND status_before_workspace_delete IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER workspaces_unpublish_epk AFTER UPDATE OF deleted_at ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.unpublish_epk_when_workspace_deleted();

CREATE OR REPLACE FUNCTION public.enforce_epk_collection_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE item_count integer;
DECLARE maximum integer;
BEGIN
  maximum := CASE TG_TABLE_NAME WHEN 'epk_videos' THEN 5 WHEN 'epk_tracks' THEN 5 WHEN 'epk_photos' THEN 10 WHEN 'epk_documents' THEN 5 END;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE epk_id = $1', TG_TABLE_NAME) INTO item_count USING NEW.epk_id;
  IF item_count >= maximum THEN RAISE EXCEPTION 'EPK_COLLECTION_LIMIT_REACHED'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER epk_videos_limit BEFORE INSERT ON public.epk_videos FOR EACH ROW EXECUTE FUNCTION public.enforce_epk_collection_limit();
CREATE TRIGGER epk_tracks_limit BEFORE INSERT ON public.epk_tracks FOR EACH ROW EXECUTE FUNCTION public.enforce_epk_collection_limit();
CREATE TRIGGER epk_photos_limit BEFORE INSERT ON public.epk_photos FOR EACH ROW EXECUTE FUNCTION public.enforce_epk_collection_limit();
CREATE TRIGGER epk_documents_limit BEFORE INSERT ON public.epk_documents FOR EACH ROW EXECUTE FUNCTION public.enforce_epk_collection_limit();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.epks, public.epk_assets, public.epk_videos, public.epk_tracks, public.epk_photos, public.epk_documents, public.epk_contacts, public.epk_links TO authenticated;
ALTER TABLE public.epks ENABLE ROW LEVEL SECURITY; ALTER TABLE public.epk_assets ENABLE ROW LEVEL SECURITY; ALTER TABLE public.epk_videos ENABLE ROW LEVEL SECURITY; ALTER TABLE public.epk_tracks ENABLE ROW LEVEL SECURITY; ALTER TABLE public.epk_photos ENABLE ROW LEVEL SECURITY; ALTER TABLE public.epk_documents ENABLE ROW LEVEL SECURITY; ALTER TABLE public.epk_contacts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.epk_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.epk_asset_cleanup_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY epks_admin_all ON public.epks FOR ALL TO authenticated USING (private.is_epk_admin(workspace_id)) WITH CHECK (private.is_epk_admin(workspace_id));
CREATE POLICY epk_assets_admin_all ON public.epk_assets FOR ALL TO authenticated USING (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id))) WITH CHECK (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id)));
CREATE POLICY epk_videos_admin_all ON public.epk_videos FOR ALL TO authenticated USING (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id))) WITH CHECK (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id)));
CREATE POLICY epk_tracks_admin_all ON public.epk_tracks FOR ALL TO authenticated USING (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id))) WITH CHECK (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id)));
CREATE POLICY epk_photos_admin_all ON public.epk_photos FOR ALL TO authenticated USING (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id))) WITH CHECK (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id)));
CREATE POLICY epk_documents_admin_all ON public.epk_documents FOR ALL TO authenticated USING (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id))) WITH CHECK (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id)));
CREATE POLICY epk_contacts_admin_all ON public.epk_contacts FOR ALL TO authenticated USING (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id))) WITH CHECK (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id)));
CREATE POLICY epk_links_admin_all ON public.epk_links FOR ALL TO authenticated USING (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id))) WITH CHECK (private.is_epk_admin((SELECT workspace_id FROM public.epks WHERE id = epk_id)));
