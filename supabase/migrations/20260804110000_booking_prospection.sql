-- Prospection concerts: private address book and workspace booking pipeline.
CREATE TABLE public.personal_contacts (
  id text PRIMARY KEY, owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, organization text, role text, city text, website text, email text, phone text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz, deleted_at timestamptz, server_version bigint NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX personal_contacts_owner_version_idx ON public.personal_contacts (owner_id, server_version);

CREATE TABLE public.workspace_contacts (
  id text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL, organization text, role text, city text, website text, email text, phone text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz, deleted_at timestamptz, server_version bigint NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.booking_leads (
  id text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  venue_name text NOT NULL, city text, stage text NOT NULL CHECK (stage IN ('to_contact','contacted','in_discussion','option','confirmed','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  target_date date, target_period_start date, target_period_end date, owner_id uuid NOT NULL REFERENCES auth.users(id),
  next_action text, next_action_at timestamptz, fee_amount numeric, fee_currency text, summary text, close_reason text,
  event_id text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz, deleted_at timestamptz, server_version bigint NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (target_date IS NOT NULL OR target_period_start IS NOT NULL),
  CHECK (stage NOT IN ('to_contact','contacted','in_discussion','option','confirmed') OR (next_action IS NOT NULL AND next_action_at IS NOT NULL)),
  CHECK (stage <> 'closed' OR close_reason IS NOT NULL)
);
CREATE TABLE public.booking_notes (
  id text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id text NOT NULL REFERENCES public.booking_leads(id) ON DELETE CASCADE, author_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('email_sent','call','message_sent','reply_received','internal_decision','free_note')),
  occurred_at timestamptz NOT NULL, summary text NOT NULL, result text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz, deleted_at timestamptz, server_version bigint NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE public.booking_lead_contacts (
  id text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id text NOT NULL REFERENCES public.booking_leads(id) ON DELETE CASCADE,
  contact_id text NOT NULL REFERENCES public.workspace_contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz, deleted_at timestamptz, server_version bigint NOT NULL DEFAULT 1,
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, UNIQUE (lead_id, contact_id)
);
CREATE INDEX workspace_contacts_workspace_version_idx ON public.workspace_contacts (workspace_id, server_version);
CREATE INDEX booking_leads_workspace_due_idx ON public.booking_leads (workspace_id, next_action_at) WHERE deleted_at IS NULL;
CREATE INDEX booking_notes_workspace_version_idx ON public.booking_notes (workspace_id, server_version);
CREATE INDEX booking_lead_contacts_workspace_version_idx ON public.booking_lead_contacts (workspace_id, server_version);

CREATE OR REPLACE FUNCTION private.validate_booking_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = NEW.workspace_id AND user_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'booking lead owner must be a workspace member';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.validate_booking_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.author_id := auth.uid();
  ELSIF NEW.author_id <> OLD.author_id THEN RAISE EXCEPTION 'booking note author is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.booking_leads WHERE id = NEW.lead_id AND workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'booking note lead must belong to the workspace';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.validate_booking_lead_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.booking_leads WHERE id = NEW.lead_id AND workspace_id = NEW.workspace_id)
    OR NOT EXISTS (SELECT 1 FROM public.workspace_contacts WHERE id = NEW.contact_id AND workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'booking relation must stay inside its workspace';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_booking_lead() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.validate_booking_note() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.validate_booking_lead_contact() FROM PUBLIC;
CREATE TRIGGER validate_booking_lead BEFORE INSERT OR UPDATE ON public.booking_leads FOR EACH ROW EXECUTE FUNCTION private.validate_booking_lead();
CREATE TRIGGER validate_booking_note BEFORE INSERT OR UPDATE ON public.booking_notes FOR EACH ROW EXECUTE FUNCTION private.validate_booking_note();
CREATE TRIGGER validate_booking_lead_contact BEFORE INSERT OR UPDATE ON public.booking_lead_contacts FOR EACH ROW EXECUTE FUNCTION private.validate_booking_lead_contact();

ALTER TABLE public.personal_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_lead_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY personal_contacts_owner ON public.personal_contacts FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = owner_id) WITH CHECK ((SELECT auth.uid()) = owner_id);

DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['workspace_contacts','booking_leads','booking_notes','booking_lead_contacts'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT private.is_workspace_member(workspace_id)))', target || '_select', target);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY[''admin'',''member'']::text[])))', target || '_insert', target);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT private.has_workspace_role(workspace_id, ARRAY[''admin'',''member'']::text[]))) WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY[''admin'',''member'']::text[])))', target || '_update', target);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT private.has_workspace_role(workspace_id, ARRAY[''admin'']::text[])))', target || '_delete', target);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', target);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bump_server_version()', 'bump_' || target || '_version', target);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_contacts TO authenticated, service_role;
CREATE TRIGGER bump_personal_contacts_version BEFORE INSERT OR UPDATE ON public.personal_contacts FOR EACH ROW EXECUTE FUNCTION public.bump_server_version();
