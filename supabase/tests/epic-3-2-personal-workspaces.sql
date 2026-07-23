BEGIN;

DO $test$
DECLARE
    migration_snapshot private.personal_workspace_migration_run%ROWTYPE;
    test_user_id UUID := '30000000-0000-4000-8000-000000000032';
    test_workspace_id UUID;
BEGIN
    SELECT * INTO STRICT migration_snapshot
    FROM private.personal_workspace_migration_run
    WHERE migration_key = 'epic-3-2-before';

    IF (SELECT count(*) FROM public.workspaces WHERE workspace_type = 'group')
       <> migration_snapshot.workspace_count THEN
        RAISE EXCEPTION 'HISTORICAL_WORKSPACE_COUNT_CHANGED';
    END IF;

    IF (SELECT count(*) FROM public.workspace_members)
       <> migration_snapshot.membership_count + migration_snapshot.auth_user_count THEN
        RAISE EXCEPTION 'UNEXPECTED_MEMBERSHIP_COUNT_AFTER_PERSONAL_BACKFILL';
    END IF;

    IF (SELECT count(*) FROM public.songs) <> migration_snapshot.song_count
       OR (SELECT count(*) FROM public.setlists) <> migration_snapshot.setlist_count
       OR (SELECT count(*) FROM public.setlist_songs) <> migration_snapshot.setlist_song_count
       OR (SELECT count(*) FROM public.song_assets) <> migration_snapshot.song_asset_count THEN
        RAISE EXCEPTION 'HISTORICAL_CONTENT_COUNT_CHANGED';
    END IF;

    IF EXISTS (
        SELECT users.id
        FROM auth.users AS users
        LEFT JOIN public.workspaces AS workspaces
            ON workspaces.created_by = users.id
           AND workspaces.workspace_type = 'personal'
        GROUP BY users.id
        HAVING count(workspaces.id) <> 1
    ) THEN
        RAISE EXCEPTION 'PERSONAL_WORKSPACE_CARDINALITY_INVALID';
    END IF;

    IF EXISTS (
        SELECT workspaces.id
        FROM public.workspaces AS workspaces
        LEFT JOIN public.workspace_members AS members ON members.workspace_id = workspaces.id
        WHERE workspaces.workspace_type = 'personal'
        GROUP BY workspaces.id, workspaces.created_by, workspaces.name
        HAVING workspaces.name <> 'Mon espace'
            OR count(members.id) <> 1
            OR bool_or(members.user_id <> workspaces.created_by)
            OR bool_or(members.role NOT IN ('admin', 'owner'))
    ) THEN
        RAISE EXCEPTION 'PERSONAL_WORKSPACE_PRIVACY_INVALID';
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
        'epic32-personal@example.test',
        '{}'::JSONB,
        '{"display_name":"Compte test"}'::JSONB,
        now(),
        now()
    );

    SELECT id INTO STRICT test_workspace_id
    FROM public.workspaces
    WHERE created_by = test_user_id
      AND workspace_type = 'personal';

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id)
       OR NOT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = test_workspace_id
              AND user_id = test_user_id
              AND role = 'admin'
       ) THEN
        RAISE EXCEPTION 'NEW_ACCOUNT_PERSONAL_BOOTSTRAP_FAILED';
    END IF;

    BEGIN
        UPDATE public.workspaces SET name = 'Nom interdit' WHERE id = test_workspace_id;
        RAISE EXCEPTION 'PERSONAL_WORKSPACE_RENAME_ACCEPTED';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (test_workspace_id, extensions.gen_random_uuid(), 'guest');
        RAISE EXCEPTION 'SECOND_PERSONAL_MEMBER_ACCEPTED';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO public.workspace_invites (
            workspace_id, email, token, status, created_by, expires_at
        ) VALUES (
            test_workspace_id, '', 'epic32-forbidden-invite', 'pending', test_user_id, now() + interval '1 hour'
        );
        RAISE EXCEPTION 'PERSONAL_INVITATION_ACCEPTED';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    DELETE FROM public.workspaces WHERE id = test_workspace_id;
    DELETE FROM public.profiles WHERE id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;
END;
$test$;

ROLLBACK;
