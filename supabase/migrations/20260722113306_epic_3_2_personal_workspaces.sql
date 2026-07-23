-- Story 3.2: add one private personal workspace per account without moving content.

CREATE TABLE IF NOT EXISTS private.personal_workspace_migration_run (
    migration_key TEXT PRIMARY KEY,
    auth_user_count BIGINT NOT NULL,
    workspace_count BIGINT NOT NULL,
    membership_count BIGINT NOT NULL,
    song_count BIGINT NOT NULL,
    setlist_count BIGINT NOT NULL,
    setlist_song_count BIGINT NOT NULL,
    song_asset_count BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private.personal_workspace_migration_journal (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE
    private.personal_workspace_migration_run,
    private.personal_workspace_migration_journal
FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO private.personal_workspace_migration_run (
    migration_key,
    auth_user_count,
    workspace_count,
    membership_count,
    song_count,
    setlist_count,
    setlist_song_count,
    song_asset_count
)
SELECT
    'epic-3-2-before',
    (SELECT count(*) FROM auth.users),
    (SELECT count(*) FROM public.workspaces),
    (SELECT count(*) FROM public.workspace_members),
    (SELECT count(*) FROM public.songs),
    (SELECT count(*) FROM public.setlists),
    (SELECT count(*) FROM public.setlist_songs),
    (SELECT count(*) FROM public.song_assets)
ON CONFLICT (migration_key) DO NOTHING;

ALTER TABLE public.workspaces
    ADD COLUMN IF NOT EXISTS workspace_type TEXT NOT NULL DEFAULT 'group';

ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_type_check
    CHECK (workspace_type IN ('personal', 'group'))
    NOT VALID;

ALTER TABLE public.workspaces
    VALIDATE CONSTRAINT workspaces_type_check;

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_personal_per_owner
    ON public.workspaces (created_by)
    WHERE workspace_type = 'personal';

WITH inserted_workspaces AS (
    INSERT INTO public.workspaces (id, name, created_by, workspace_type)
    SELECT
        extensions.gen_random_uuid(),
        'Mon espace',
        users.id,
        'personal'
    FROM auth.users AS users
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.workspaces AS workspaces
        WHERE workspaces.created_by = users.id
          AND workspaces.workspace_type = 'personal'
    )
    RETURNING id, created_by
), journaled AS (
    INSERT INTO private.personal_workspace_migration_journal (user_id, workspace_id)
    SELECT created_by, id
    FROM inserted_workspaces
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id, workspace_id
)
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT workspace_id, user_id, 'admin'
FROM journaled
ON CONFLICT (workspace_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.enforce_workspace_kind()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.workspace_type IS DISTINCT FROM OLD.workspace_type THEN
        RAISE EXCEPTION 'WORKSPACE_TYPE_IMMUTABLE' USING ERRCODE = '23514';
    END IF;

    IF NEW.workspace_type = 'personal' AND NEW.name <> 'Mon espace' THEN
        RAISE EXCEPTION 'PERSONAL_WORKSPACE_NAME_FIXED' USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.workspace_type = 'personal'
       AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'PERSONAL_WORKSPACE_OWNER_IMMUTABLE' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enforce_workspace_kind()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_workspace_kind ON public.workspaces;
CREATE TRIGGER enforce_workspace_kind
    BEFORE INSERT OR UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION private.enforce_workspace_kind();

CREATE OR REPLACE FUNCTION private.enforce_personal_workspace_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
    target_type TEXT;
    target_owner UUID;
BEGIN
    SELECT workspace_type, created_by
    INTO target_type, target_owner
    FROM public.workspaces
    WHERE id = NEW.workspace_id;

    IF target_type = 'personal'
       AND (NEW.user_id <> target_owner OR NEW.role NOT IN ('admin', 'owner')) THEN
        RAISE EXCEPTION 'PERSONAL_WORKSPACE_PRIVATE' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enforce_personal_workspace_membership()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_personal_workspace_membership ON public.workspace_members;
CREATE TRIGGER enforce_personal_workspace_membership
    BEFORE INSERT OR UPDATE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION private.enforce_personal_workspace_membership();

CREATE OR REPLACE FUNCTION private.reject_personal_workspace_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = NEW.workspace_id
          AND workspace_type = 'personal'
    ) THEN
        RAISE EXCEPTION 'PERSONAL_WORKSPACE_PRIVATE' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.reject_personal_workspace_invitation()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS reject_personal_workspace_invitation ON public.workspace_invites;
CREATE TRIGGER reject_personal_workspace_invitation
    BEFORE INSERT OR UPDATE OF workspace_id ON public.workspace_invites
    FOR EACH ROW EXECUTE FUNCTION private.reject_personal_workspace_invitation();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    requested_display_name TEXT := btrim(COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
    email_display_name TEXT := btrim(COALESCE(split_part(NEW.email, '@', 1), ''));
    safe_display_name TEXT;
    personal_workspace_id UUID := extensions.gen_random_uuid();
BEGIN
    safe_display_name := CASE
        WHEN char_length(requested_display_name) BETWEEN 2 AND 30 THEN requested_display_name
        WHEN char_length(email_display_name) BETWEEN 2 AND 30 THEN email_display_name
        ELSE 'Utilisateur ' || left(NEW.id::TEXT, 8)
    END;

    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, safe_display_name);

    INSERT INTO public.workspaces (id, name, created_by, workspace_type)
    VALUES (personal_workspace_id, 'Mon espace', NEW.id, 'personal');

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (personal_workspace_id, NEW.id, 'admin');

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated, service_role;
