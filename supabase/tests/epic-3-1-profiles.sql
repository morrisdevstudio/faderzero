BEGIN;

DO $test$
DECLARE
    before_profiles BIGINT;
    before_workspaces BIGINT;
    before_memberships BIGINT;
    before_contents BIGINT;
    test_user_id UUID := '30000000-0000-4000-8000-000000000031';
    created_profile public.profiles%ROWTYPE;
BEGIN
    SELECT count(*) INTO before_profiles FROM public.profiles;
    SELECT count(*) INTO before_workspaces FROM public.workspaces;
    SELECT count(*) INTO before_memberships FROM public.workspace_members;
    SELECT
        (SELECT count(*) FROM public.songs)
        + (SELECT count(*) FROM public.setlists)
        + (SELECT count(*) FROM public.setlist_songs)
        + (SELECT count(*) FROM public.song_assets)
    INTO before_contents;

    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE display_name IS NULL
           OR btrim(display_name) = ''
           OR char_length(btrim(display_name)) NOT BETWEEN 2 AND 30
    ) THEN
        RAISE EXCEPTION 'INVALID_PROFILE_PSEUDO_AFTER_MIGRATION';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'email'
    ) THEN
        RAISE EXCEPTION 'EMAIL_EXPOSED_IN_PUBLIC_PROFILES';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_path'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_updated_at'
    ) THEN
        RAISE EXCEPTION 'AVATAR_COLUMNS_MISSING';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM private.profile_migration_journal AS journal
        JOIN public.profiles AS profiles ON profiles.id = journal.profile_id
        WHERE COALESCE(btrim(journal.previous_display_name), '') <> ''
           OR profiles.display_name <> journal.backfilled_display_name
    ) THEN
        RAISE EXCEPTION 'PROFILE_BACKFILL_CHANGED_NON_EMPTY_PSEUDO';
    END IF;

    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        test_user_id,
        'authenticated',
        'authenticated',
        'epic31-profile@example.test',
        '{}'::JSONB,
        '{"display_name":"  Élodie !  "}'::JSONB,
        now(),
        now()
    );

    SELECT * INTO STRICT created_profile
    FROM public.profiles
    WHERE id = test_user_id;

    IF created_profile.display_name <> 'Élodie !'
       OR created_profile.avatar_path IS NOT NULL
       OR to_jsonb(created_profile) ? 'email' THEN
        RAISE EXCEPTION 'NEW_PROFILE_CREATION_INVALID';
    END IF;

    BEGIN
        UPDATE public.profiles
        SET display_name = 'x'
        WHERE id = test_user_id;
        RAISE EXCEPTION 'INVALID_PSEUDO_ACCEPTED';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;

    DELETE FROM auth.users WHERE id = test_user_id;

    IF (SELECT count(*) FROM public.profiles) <> before_profiles
       OR (SELECT count(*) FROM public.workspaces) <> before_workspaces
       OR (SELECT count(*) FROM public.workspace_members) <> before_memberships
       OR (
            (SELECT count(*) FROM public.songs)
            + (SELECT count(*) FROM public.setlists)
            + (SELECT count(*) FROM public.setlist_songs)
            + (SELECT count(*) FROM public.song_assets)
       ) <> before_contents THEN
        RAISE EXCEPTION 'PROTECTED_COUNT_CHANGED_DURING_PROFILE_TEST';
    END IF;
END;
$test$;

ROLLBACK;
