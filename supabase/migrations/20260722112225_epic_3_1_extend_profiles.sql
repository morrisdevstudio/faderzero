-- Story 3.1: expand profiles without changing an existing non-empty pseudo.

CREATE TABLE IF NOT EXISTS private.profile_migration_journal (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE RESTRICT,
    previous_display_name TEXT,
    backfilled_display_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.profile_migration_journal
FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS avatar_path TEXT,
    ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

WITH missing_profiles AS (
    SELECT
        profiles.id,
        profiles.display_name AS previous_display_name,
        CASE
            WHEN char_length(btrim(COALESCE(users.raw_user_meta_data->>'display_name', ''))) BETWEEN 2 AND 30
                THEN btrim(users.raw_user_meta_data->>'display_name')
            WHEN char_length(btrim(COALESCE(split_part(users.email, '@', 1), ''))) BETWEEN 2 AND 30
                THEN btrim(split_part(users.email, '@', 1))
            ELSE 'Utilisateur ' || left(profiles.id::TEXT, 8)
        END AS backfilled_display_name
    FROM public.profiles AS profiles
    LEFT JOIN auth.users AS users ON users.id = profiles.id
    WHERE profiles.display_name IS NULL OR btrim(profiles.display_name) = ''
), journaled AS (
    INSERT INTO private.profile_migration_journal (
        profile_id,
        previous_display_name,
        backfilled_display_name,
        reason
    )
    SELECT
        missing_profiles.id,
        missing_profiles.previous_display_name,
        missing_profiles.backfilled_display_name,
        'missing pseudo backfill'
    FROM missing_profiles
    ON CONFLICT (profile_id) DO NOTHING
    RETURNING profile_id, backfilled_display_name
)
UPDATE public.profiles AS profiles
SET display_name = journaled.backfilled_display_name
FROM journaled
WHERE profiles.id = journaled.profile_id
  AND (profiles.display_name IS NULL OR btrim(profiles.display_name) = '');

ALTER TABLE public.profiles
    ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_display_name_length_check
    CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 30)
    NOT VALID;

ALTER TABLE public.profiles
    VALIDATE CONSTRAINT profiles_display_name_length_check;

CREATE OR REPLACE FUNCTION private.normalize_profile_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
    NEW.display_name := btrim(NEW.display_name);
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.normalize_profile_display_name()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS normalize_profile_display_name ON public.profiles;
CREATE TRIGGER normalize_profile_display_name
    BEFORE INSERT OR UPDATE OF display_name ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION private.normalize_profile_display_name();

CREATE OR REPLACE FUNCTION private.touch_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at := now();
    IF NEW.avatar_path IS DISTINCT FROM OLD.avatar_path THEN
        NEW.avatar_updated_at := now();
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.touch_profile_updated_at()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS touch_profile_updated_at ON public.profiles;
CREATE TRIGGER touch_profile_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION private.touch_profile_updated_at();

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
BEGIN
    safe_display_name := CASE
        WHEN char_length(requested_display_name) BETWEEN 2 AND 30 THEN requested_display_name
        WHEN char_length(email_display_name) BETWEEN 2 AND 30 THEN email_display_name
        ELSE 'Utilisateur ' || left(NEW.id::TEXT, 8)
    END;

    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, safe_display_name);

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated, service_role;
