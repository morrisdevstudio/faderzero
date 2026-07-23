BEGIN;

DO $test$
DECLARE
    deleting_user UUID := '35000000-0000-4000-8000-000000000001';
    replacement_user UUID := '35000000-0000-4000-8000-000000000002';
    blocked_user UUID := '35000000-0000-4000-8000-000000000003';
    shared_workspace UUID := '35100000-0000-4000-8000-000000000001';
    blocked_workspace UUID := '35100000-0000-4000-8000-000000000002';
    raw_token TEXT;
BEGIN
    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
        ('00000000-0000-0000-0000-000000000000', deleting_user, 'authenticated', 'authenticated', 'delete@example.test', '{}'::JSONB, '{"display_name":"Delete Test"}'::JSONB, now(), now()),
        ('00000000-0000-0000-0000-000000000000', replacement_user, 'authenticated', 'authenticated', 'replacement@example.test', '{}'::JSONB, '{"display_name":"Replacement"}'::JSONB, now(), now()),
        ('00000000-0000-0000-0000-000000000000', blocked_user, 'authenticated', 'authenticated', 'blocked@example.test', '{}'::JSONB, '{"display_name":"Blocked Test"}'::JSONB, now(), now());

    INSERT INTO public.workspaces (id, name, created_by, workspace_type)
    VALUES
        (shared_workspace, 'Shared preserved group', deleting_user, 'group'),
        (blocked_workspace, 'Last admin group', blocked_user, 'group');

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES
        (shared_workspace, deleting_user, 'admin'),
        (shared_workspace, replacement_user, 'admin'),
        (blocked_workspace, blocked_user, 'admin');

    INSERT INTO public.songs (id, workspace_id, title, status, last_modified_by)
    VALUES ('epic-3-5-preserved-song', shared_workspace, 'Preserved', 'En cours', deleting_user);

    INSERT INTO public.workspace_invites (
        workspace_id, email, token, status, created_by, expires_at
    ) VALUES (
        shared_workspace, '', 'epic-3-5-preserved-invite', 'pending', deleting_user, now() + interval '1 hour'
    );

    PERFORM set_config('request.jwt.claim.sub', blocked_user::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
        'sub', blocked_user,
        'role', 'authenticated',
        'amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())::BIGINT))
    )::TEXT, true);

    BEGIN
        PERFORM public.create_account_deletion_request();
        RAISE EXCEPTION 'LAST_ADMIN_DELETION_REQUEST_ACCEPTED';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;

    PERFORM set_config('request.jwt.claim.sub', deleting_user::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
        'sub', deleting_user,
        'role', 'authenticated',
        'amr', jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())::BIGINT))
    )::TEXT, true);

    SELECT request.token INTO raw_token
    FROM public.create_account_deletion_request() AS request;

    IF raw_token IS NULL OR raw_token !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'SERVER_DELETION_TOKEN_INVALID';
    END IF;

    BEGIN
        PERFORM public.delete_current_account(raw_token);
        RAISE EXCEPTION 'PASSWORD_SESSION_DELETION_ACCEPTED';
    EXCEPTION
        WHEN insufficient_privilege THEN NULL;
    END;

    PERFORM set_config('request.jwt.claims', jsonb_build_object(
        'sub', deleting_user,
        'role', 'authenticated',
        'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', extract(epoch from now())::BIGINT))
    )::TEXT, true);

    IF NOT public.delete_current_account(raw_token) THEN
        RAISE EXCEPTION 'ACCOUNT_DELETION_DID_NOT_RETURN_SUCCESS';
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE id = deleting_user)
       OR EXISTS (SELECT 1 FROM public.profiles WHERE id = deleting_user)
       OR EXISTS (SELECT 1 FROM public.workspaces WHERE workspace_type = 'personal' AND created_by = deleting_user) THEN
        RAISE EXCEPTION 'PERSONAL_ACCOUNT_DATA_NOT_DELETED';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = shared_workspace AND created_by = replacement_user AND workspace_type = 'group'
    ) OR NOT EXISTS (
        SELECT 1 FROM public.songs
        WHERE id = 'epic-3-5-preserved-song' AND workspace_id = shared_workspace
    ) OR NOT EXISTS (
        SELECT 1 FROM public.workspace_invites
        WHERE workspace_id = shared_workspace AND created_by = replacement_user
    ) THEN
        RAISE EXCEPTION 'SHARED_DATA_NOT_PRESERVED';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM private.account_deletion_archive
        WHERE user_id = deleting_user
          AND transferred_workspaces <> '[]'::JSONB
          AND request_snapshot IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'ACCOUNT_DELETION_ARCHIVE_MISSING';
    END IF;
END;
$test$;

ROLLBACK;
