-- Programmable song timelines: normalized, syncable, workspace-safe.

CREATE TABLE public.song_timelines (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  song_id text NOT NULL,
  start_count_in_bars integer NOT NULL DEFAULT 1 CHECK (start_count_in_bars BETWEEN 0 AND 8),
  volume double precision NOT NULL DEFAULT 0.75 CHECK (volume BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz,
  deleted_at timestamptz,
  server_version bigint NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT song_timelines_one_per_song UNIQUE (song_id),
  CONSTRAINT song_timelines_id_workspace_unique UNIQUE (id, workspace_id)
);

CREATE TABLE public.timeline_sections (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  timeline_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 512),
  bars integer NOT NULL CHECK (bars BETWEEN 1 AND 999),
  tempo integer NOT NULL CHECK (tempo BETWEEN 20 AND 400),
  numerator integer NOT NULL CHECK (numerator BETWEEN 1 AND 32),
  denominator integer NOT NULL CHECK (denominator IN (1, 2, 4, 8, 16, 32)),
  tempo_unit text NOT NULL CHECK (tempo_unit IN ('quarter', 'eighth', 'dottedQuarter', 'half')),
  click_enabled boolean NOT NULL DEFAULT true,
  accent_first_beat boolean NOT NULL DEFAULT true,
  click_resolution text NOT NULL DEFAULT 'denominator' CHECK (click_resolution IN ('tempoUnit', 'denominator')),
  count_in_mode text NOT NULL DEFAULT 'none' CHECK (count_in_mode IN ('none', 'inserted', 'overlay')),
  count_in_bars integer NOT NULL DEFAULT 0 CHECK (count_in_bars BETWEEN 0 AND 8),
  color text CHECK (color IS NULL OR length(color) <= 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz,
  deleted_at timestamptz,
  server_version bigint NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.songs ADD CONSTRAINT songs_id_workspace_unique UNIQUE (id, workspace_id);
ALTER TABLE public.song_timelines
  ADD CONSTRAINT song_timelines_song_workspace_fk
  FOREIGN KEY (song_id, workspace_id) REFERENCES public.songs(id, workspace_id) ON DELETE CASCADE;
ALTER TABLE public.timeline_sections
  ADD CONSTRAINT timeline_sections_timeline_workspace_fk
  FOREIGN KEY (timeline_id, workspace_id) REFERENCES public.song_timelines(id, workspace_id) ON DELETE CASCADE;

CREATE INDEX song_timelines_workspace_updated_idx ON public.song_timelines(workspace_id, updated_at);
CREATE INDEX song_timelines_workspace_deleted_idx ON public.song_timelines(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX timeline_sections_timeline_position_idx ON public.timeline_sections(timeline_id, position);
CREATE INDEX timeline_sections_workspace_updated_idx ON public.timeline_sections(workspace_id, updated_at);
CREATE INDEX timeline_sections_workspace_deleted_idx ON public.timeline_sections(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER trigger_bump_song_timelines_version
  BEFORE INSERT OR UPDATE ON public.song_timelines
  FOR EACH ROW EXECUTE FUNCTION public.bump_server_version();
CREATE TRIGGER trigger_bump_timeline_sections_version
  BEFORE INSERT OR UPDATE ON public.timeline_sections
  FOR EACH ROW EXECUTE FUNCTION public.bump_server_version();

ALTER TABLE public.song_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY song_timelines_select_member ON public.song_timelines FOR SELECT TO authenticated
  USING ((SELECT private.is_workspace_member(workspace_id)));
CREATE POLICY song_timelines_insert_writer ON public.song_timelines FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])));
CREATE POLICY song_timelines_update_writer ON public.song_timelines FOR UPDATE TO authenticated
  USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])))
  WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])));
CREATE POLICY song_timelines_delete_writer ON public.song_timelines FOR DELETE TO authenticated
  USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])));

CREATE POLICY timeline_sections_select_member ON public.timeline_sections FOR SELECT TO authenticated
  USING ((SELECT private.is_workspace_member(workspace_id)));
CREATE POLICY timeline_sections_insert_writer ON public.timeline_sections FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])));
CREATE POLICY timeline_sections_update_writer ON public.timeline_sections FOR UPDATE TO authenticated
  USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])))
  WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])));
CREATE POLICY timeline_sections_delete_writer ON public.timeline_sections FOR DELETE TO authenticated
  USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::text[])));

REVOKE ALL ON public.song_timelines, public.timeline_sections FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_timelines, public.timeline_sections TO authenticated;

-- The existing copy RPC inserts copied_from_song_id. This trigger carries the
-- timeline into the target workspace without changing that stable RPC contract.
CREATE OR REPLACE FUNCTION public.copy_song_timeline_after_song_copy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  source_timeline public.song_timelines%ROWTYPE;
  new_timeline_id text;
BEGIN
  IF NEW.copied_from_song_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO source_timeline
  FROM public.song_timelines
  WHERE song_id = NEW.copied_from_song_id AND deleted_at IS NULL;
  IF source_timeline.id IS NULL THEN RETURN NEW; END IF;

  new_timeline_id := extensions.gen_random_uuid()::text;
  INSERT INTO public.song_timelines (id, workspace_id, song_id, start_count_in_bars, volume)
  VALUES (new_timeline_id, NEW.workspace_id, NEW.id, source_timeline.start_count_in_bars, source_timeline.volume);

  INSERT INTO public.timeline_sections (
    id, workspace_id, timeline_id, position, name, bars, tempo, numerator, denominator,
    tempo_unit, click_enabled, accent_first_beat, click_resolution, count_in_mode, count_in_bars, color
  )
  SELECT extensions.gen_random_uuid()::text, NEW.workspace_id, new_timeline_id, position, name,
    bars, tempo, numerator, denominator, tempo_unit, click_enabled, accent_first_beat,
    click_resolution, count_in_mode, count_in_bars, color
  FROM public.timeline_sections
  WHERE timeline_id = source_timeline.id AND deleted_at IS NULL;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.copy_song_timeline_after_song_copy() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trigger_copy_song_timeline
  AFTER INSERT ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.copy_song_timeline_after_song_copy();
