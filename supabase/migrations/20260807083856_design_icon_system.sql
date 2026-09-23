CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.design_icon_roles (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9-]{1,63}$'),
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 2 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  source_type TEXT NOT NULL DEFAULT 'lucide' CHECK (source_type IN ('lucide', 'custom')),
  icon_name TEXT NOT NULL CHECK (icon_name ~ '^[A-Za-z][A-Za-z0-9-]{0,127}$'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'deprecated')),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.design_icon_occurrences (
  usage_id TEXT PRIMARY KEY CHECK (char_length(usage_id) BETWEEN 2 AND 160),
  occurrence_id TEXT NOT NULL,
  default_role_key TEXT REFERENCES public.design_icon_roles(key) ON DELETE SET NULL,
  assigned_role_key TEXT REFERENCES public.design_icon_roles(key) ON DELETE SET NULL,
  override_source_type TEXT CHECK (override_source_type IN ('lucide', 'custom')),
  override_icon_name TEXT CHECK (override_icon_name IS NULL OR override_icon_name ~ '^[A-Za-z][A-Za-z0-9-]{0,127}$'),
  integration_state TEXT NOT NULL DEFAULT 'legacy' CHECK (integration_state IN ('legacy', 'registry', 'custom-kept', 'ignored', 'stale')),
  verification_state TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_state IN ('unverified', 'verified')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  scan_revision TEXT NOT NULL DEFAULT '',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((override_source_type IS NULL) = (override_icon_name IS NULL))
);

CREATE TABLE public.design_icon_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest JSONB NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'building', 'active', 'failed')),
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_revision TEXT NOT NULL DEFAULT '',
  build_sha TEXT,
  error_code TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX design_icon_publication_in_flight_idx
ON public.design_icon_publications ((true))
WHERE status IN ('queued', 'building');

CREATE INDEX design_icon_occurrences_role_idx ON public.design_icon_occurrences (assigned_role_key, default_role_key);
CREATE INDEX design_icon_occurrences_state_idx ON public.design_icon_occurrences (integration_state, verification_state);
CREATE INDEX design_icon_publications_status_idx ON public.design_icon_publications (status, requested_at DESC);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_icon_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_icon_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_icon_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_admins_read_self
ON public.platform_admins FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY design_icon_roles_admin_all
ON public.design_icon_roles FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = (SELECT auth.uid())));

CREATE POLICY design_icon_occurrences_admin_all
ON public.design_icon_occurrences FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = (SELECT auth.uid())));

CREATE POLICY design_icon_publications_admin_read
ON public.design_icon_publications FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = (SELECT auth.uid())));

REVOKE ALL ON public.platform_admins, public.design_icon_roles, public.design_icon_occurrences, public.design_icon_publications FROM anon;
REVOKE ALL ON public.platform_admins, public.design_icon_roles, public.design_icon_occurrences, public.design_icon_publications FROM authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_icon_roles, public.design_icon_occurrences TO authenticated;
GRANT SELECT ON public.design_icon_publications TO authenticated;
GRANT ALL ON public.platform_admins, public.design_icon_roles, public.design_icon_occurrences, public.design_icon_publications TO service_role;

INSERT INTO public.design_icon_roles (key, label, icon_name, status) VALUES
  ('add', 'Ajouter', 'plus', 'approved'),
  ('back', 'Retour', 'arrow-left', 'approved'),
  ('calendar', 'Calendrier', 'calendar-days', 'approved'),
  ('check', 'Valider', 'check', 'approved'),
  ('close', 'Fermer', 'x', 'approved'),
  ('delete', 'Supprimer', 'trash-2', 'approved'),
  ('download', 'Télécharger', 'cloud-download', 'approved'),
  ('edit', 'Modifier', 'pencil', 'approved'),
  ('fullscreen', 'Plein écran', 'maximize', 'approved'),
  ('home', 'Accueil', 'house', 'approved'),
  ('menu', 'Plus d’actions', 'ellipsis', 'approved'),
  ('metronome', 'Métronome', 'audio-waveform', 'approved'),
  ('pause', 'Pause', 'pause', 'approved'),
  ('play', 'Lecture', 'play', 'approved'),
  ('prompter', 'Prompteur', 'monitor-up', 'approved'),
  ('record', 'Enregistrer', 'mic', 'approved'),
  ('setlist', 'Setlist', 'list-music', 'approved'),
  ('settings', 'Réglages', 'settings', 'approved'),
  ('songs', 'Morceaux', 'library', 'approved'),
  ('stop', 'Arrêt', 'square', 'approved'),
  ('upload', 'Importer', 'upload', 'approved');

COMMENT ON TABLE public.platform_admins IS 'Global FaderZero administrators; bootstrap rows are inserted separately from migrations.';
COMMENT ON TABLE public.design_icon_publications IS 'Immutable icon manifests consumed only at build time.';
