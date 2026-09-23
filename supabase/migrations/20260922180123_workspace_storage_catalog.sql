CREATE TABLE public.workspace_storage_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider_id text NOT NULL CHECK (provider_id IN ('faderzero_r2', 'google_drive', 'dropbox', 'onedrive', 'webdav')),
  connected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  root_identifier text,
  display_name text,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'authorization_expired', 'full', 'unavailable', 'disconnected')),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  UNIQUE (workspace_id, provider_id, root_identifier)
);

CREATE UNIQUE INDEX workspace_storage_connections_one_default
  ON public.workspace_storage_connections (workspace_id)
  WHERE is_default AND status = 'connected';
CREATE INDEX workspace_storage_connections_workspace_idx
  ON public.workspace_storage_connections (workspace_id, status);

CREATE TABLE private.workspace_storage_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.workspace_storage_connections(id) ON DELETE CASCADE,
  encrypted_credentials bytea NOT NULL,
  encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.storage_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  logical_key text NOT NULL,
  object_kind text NOT NULL CHECK (object_kind IN ('audio', 'epk_media', 'document')),
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, logical_key)
);

CREATE INDEX storage_objects_workspace_idx ON public.storage_objects (workspace_id, created_at DESC);

CREATE TABLE public.storage_object_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_object_id uuid NOT NULL REFERENCES public.storage_objects(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.workspace_storage_connections(id) ON DELETE RESTRICT,
  provider_id text NOT NULL CHECK (provider_id IN ('faderzero_r2', 'google_drive', 'dropbox', 'onedrive', 'webdav')),
  physical_identifier text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'mismatch', 'missing', 'unavailable')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, physical_identifier)
);

CREATE UNIQUE INDEX storage_object_locations_one_primary
  ON public.storage_object_locations (storage_object_id)
  WHERE is_primary;
CREATE INDEX storage_object_locations_connection_idx
  ON public.storage_object_locations (connection_id, verification_status);

ALTER TABLE public.song_assets ADD COLUMN IF NOT EXISTS storage_object_id uuid;
ALTER TABLE public.song_assets ADD CONSTRAINT song_assets_storage_object_fkey
  FOREIGN KEY (storage_object_id) REFERENCES public.storage_objects(id) ON DELETE RESTRICT NOT VALID;
CREATE INDEX IF NOT EXISTS song_assets_storage_object_idx ON public.song_assets (storage_object_id);

ALTER TABLE public.epk_assets ADD COLUMN IF NOT EXISTS storage_object_id uuid;
ALTER TABLE public.epk_assets ADD CONSTRAINT epk_assets_storage_object_fkey
  FOREIGN KEY (storage_object_id) REFERENCES public.storage_objects(id) ON DELETE RESTRICT NOT VALID;
CREATE INDEX IF NOT EXISTS epk_assets_storage_object_idx ON public.epk_assets (storage_object_id);

INSERT INTO public.workspace_storage_connections (workspace_id, provider_id, connected_by, root_identifier, display_name, status, is_default)
SELECT DISTINCT assets.workspace_id, 'faderzero_r2', workspaces.created_by, 'r2://faderzero', 'Faderzero Cloud', 'connected', true
FROM public.song_assets AS assets
JOIN public.workspaces AS workspaces ON workspaces.id = assets.workspace_id
UNION
SELECT DISTINCT epks.workspace_id, 'faderzero_r2', workspaces.created_by, 'r2://faderzero', 'Faderzero Cloud', 'connected', true
FROM public.epk_assets AS assets
JOIN public.epks ON epks.id = assets.epk_id
JOIN public.workspaces AS workspaces ON workspaces.id = epks.workspace_id
ON CONFLICT (workspace_id, provider_id, root_identifier) DO UPDATE
SET status = 'connected', is_default = true, updated_at = now();

INSERT INTO public.storage_objects (workspace_id, logical_key, object_kind, mime_type, size_bytes, content_hash)
SELECT workspace_id, storage_path, 'audio', mime_type, size_bytes, content_hash
FROM public.song_assets
WHERE deleted_at IS NULL
ON CONFLICT (workspace_id, logical_key) DO NOTHING;

UPDATE public.song_assets AS assets
SET storage_object_id = objects.id
FROM public.storage_objects AS objects
WHERE objects.workspace_id = assets.workspace_id
  AND objects.logical_key = assets.storage_path
  AND assets.storage_object_id IS NULL;

INSERT INTO public.storage_object_locations (storage_object_id, connection_id, provider_id, physical_identifier, is_primary, verification_status, verified_at)
SELECT objects.id, connections.id, 'faderzero_r2', objects.logical_key, true, 'verified', now()
FROM public.storage_objects AS objects
JOIN public.workspace_storage_connections AS connections
  ON connections.workspace_id = objects.workspace_id
 AND connections.provider_id = 'faderzero_r2'
 AND connections.root_identifier = 'r2://faderzero'
WHERE objects.object_kind = 'audio'
ON CONFLICT (connection_id, physical_identifier) DO NOTHING;

INSERT INTO public.storage_objects (workspace_id, logical_key, object_kind, mime_type, size_bytes)
SELECT epks.workspace_id, assets.storage_path,
  CASE WHEN assets.kind = 'document' THEN 'document' ELSE 'epk_media' END,
  assets.mime_type, assets.size_bytes
FROM public.epk_assets AS assets
JOIN public.epks ON epks.id = assets.epk_id
ON CONFLICT (workspace_id, logical_key) DO NOTHING;

UPDATE public.epk_assets AS assets
SET storage_object_id = objects.id
FROM public.epks AS epks, public.storage_objects AS objects
WHERE epks.id = assets.epk_id
  AND objects.workspace_id = epks.workspace_id
  AND objects.logical_key = assets.storage_path
  AND assets.storage_object_id IS NULL;

INSERT INTO public.storage_object_locations (storage_object_id, connection_id, provider_id, physical_identifier, is_primary, verification_status, verified_at)
SELECT objects.id, connections.id, 'faderzero_r2', objects.logical_key, true, 'verified', now()
FROM public.storage_objects AS objects
JOIN public.workspace_storage_connections AS connections
  ON connections.workspace_id = objects.workspace_id
 AND connections.provider_id = 'faderzero_r2'
 AND connections.root_identifier = 'r2://faderzero'
WHERE objects.object_kind IN ('epk_media', 'document')
ON CONFLICT (connection_id, physical_identifier) DO NOTHING;

REVOKE ALL ON TABLE private.workspace_storage_connection_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.workspace_storage_connection_secrets TO service_role;
GRANT SELECT ON TABLE public.workspace_storage_connections, public.storage_objects, public.storage_object_locations TO authenticated;
GRANT ALL ON TABLE public.workspace_storage_connections, public.storage_objects, public.storage_object_locations TO service_role;

ALTER TABLE public.workspace_storage_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_object_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.workspace_storage_connection_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_storage_connections_select_member
  ON public.workspace_storage_connections FOR SELECT TO authenticated
  USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])));
CREATE POLICY workspace_storage_connections_admin_write
  ON public.workspace_storage_connections FOR ALL TO authenticated
  USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin']::text[])))
  WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin']::text[])));
CREATE POLICY storage_objects_select_member
  ON public.storage_objects FOR SELECT TO authenticated
  USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])));
CREATE POLICY storage_object_locations_select_member
  ON public.storage_object_locations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.storage_objects AS objects
    WHERE objects.id = storage_object_id
      AND (SELECT private.has_workspace_role(objects.workspace_id, ARRAY['admin', 'member']::text[]))
  ));
