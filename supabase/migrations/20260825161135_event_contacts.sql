CREATE TABLE public.event_contacts (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contact_id text NOT NULL REFERENCES public.workspace_contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz,
  deleted_at timestamptz,
  server_version bigint NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (event_id, contact_id)
);
CREATE INDEX event_contacts_workspace_version_idx ON public.event_contacts (workspace_id, server_version);

CREATE OR REPLACE FUNCTION private.validate_event_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = NEW.event_id AND workspace_id = NEW.workspace_id)
    OR NOT EXISTS (SELECT 1 FROM public.workspace_contacts WHERE id = NEW.contact_id AND workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'event relation must stay inside its workspace';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_event_contact() FROM PUBLIC;
CREATE TRIGGER validate_event_contact BEFORE INSERT OR UPDATE ON public.event_contacts FOR EACH ROW EXECUTE FUNCTION private.validate_event_contact();
CREATE TRIGGER bump_event_contacts_version BEFORE INSERT OR UPDATE ON public.event_contacts FOR EACH ROW EXECUTE FUNCTION public.bump_server_version();

ALTER TABLE public.event_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_contacts_select ON public.event_contacts FOR SELECT TO authenticated USING ((SELECT private.is_workspace_member(workspace_id)));
CREATE POLICY event_contacts_insert ON public.event_contacts FOR INSERT TO authenticated WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin','member']::text[])));
CREATE POLICY event_contacts_update ON public.event_contacts FOR UPDATE TO authenticated USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin','member']::text[]))) WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin','member']::text[])));
CREATE POLICY event_contacts_delete ON public.event_contacts FOR DELETE TO authenticated USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin']::text[])));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_contacts TO authenticated, service_role;
