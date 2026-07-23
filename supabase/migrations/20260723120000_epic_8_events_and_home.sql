-- Migration Epic 8: Events table and RLS policies

CREATE TABLE IF NOT EXISTS public.events (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'rehearsal', -- 'rehearsal', 'concert', 'meeting', 'other'
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  client_updated_at timestamptz,
  server_version bigint NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS events_workspace_version_idx
  ON public.events (workspace_id, server_version);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON public.events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = events.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "events_insert" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = events.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'member')
    )
  );

CREATE POLICY "events_update" ON public.events
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = events.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = events.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'member')
    )
  );

CREATE POLICY "events_delete" ON public.events
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = events.workspace_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated, service_role;

CREATE TRIGGER trigger_bump_events_version
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.bump_server_version();
