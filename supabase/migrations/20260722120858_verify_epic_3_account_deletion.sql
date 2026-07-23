-- Deployment gate for Story 3.5. Synthetic rows are removed before commit.
DO $verify$
DECLARE
    deleting_user UUID := '36000000-0000-4000-8000-000000000001';
    replacement_user UUID := '36000000-0000-4000-8000-000000000002';
    blocked_user UUID := '36000000-0000-4000-8000-000000000003';
    shared_workspace UUID := '36100000-0000-4000-8000-000000000001';
    blocked_workspace UUID := '36100000-0000-4000-8000-000000000002';
    raw_token TEXT := repeat('c', 64);
    before_workspace_count BIGINT := (SELECT count(*) FROM public.workspaces);
    before_song_count BIGINT := (SELECT count(*) FROM public.songs);
BEGIN
    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
        ('00000000-0000-0000-0000-000000000000', deleting_user, 'authenticated', 'authenticated', 'verify-delete@example.test', '{}'::JSONB, '{"display_name":"Verify Delete"}'::JSONB, now(), now()),
        ('00000000-0000-0000-0000-000000000000', replacement_user, 'authenticated', 'authenticated', 'verify-replacement@example.test', '{}'::JSONB, '{"display_name":"Verify Replacement"}'::JSONB, now(), now()),
        ('00000000-0000-0000-0000-000000000000', blocked_user, 'authenticated', 'authenticated', 'verify-blocked@example.test', '{}'::JSONB, '{"display_name":"Verify Blocked"}'::JSONB, now(), now());

    INSERT INTO public.workspaces (id, name, created_by, workspace_type)
    VALUES
        (shared_workspace, 'Verification shared group', deleting_user, 'group'),
        (blocked_workspace, 'Verification blocked group', blocked_user, 'group');

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES
        (shared_workspace, deleting_user, 'admin'),
        (shared_workspace, replacement_user, 'admin'),
        (blocked_workspace, blocked_user, 'admin');

    INSERT INTO public.songs (id, workspace_id, title, status, last_modified_by)
    VALUES ('epic-3-verification-song', shared_workspace, 'Preserved verification', 'En cours', deleting_user);

    INSERT INTO public.workspace_invites (workspace_id, email, token, status, created_by, expires_at)
    VALUES (shared_workspace, '', 'epic-3-verification-invite', 'pending', deleting_user, now() + interval '1 hour');

    PERFORM set_config('request.jwt.claim.sub', blocked_user::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
        'sub', blocked_user, 'role', 'authenticated',
        'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::TEXT, true);
    BEGIN
        PERFORM public.create_account_deletion_request(encode(extensions.digest(repeat('d', 64), 'sha256'), 'hex'));
        RAISE EXCEPTION 'VERIFY_LAST_ADMIN_REQUEST_WAS_ACCEPTED';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    PERFORM set_config('request.jwt.claim.sub', deleting_user::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
        'sub', deleting_user, 'role', 'authenticated',
        'amr', jsonb_build_array(jsonb_build_object('method', 'otp'))
    )::TEXT, true);
    PERFORM public.create_account_deletion_request(encode(extensions.digest(raw_token, 'sha256'), 'hex'));
    PERFORM public.delete_current_account(raw_token);

    IF EXISTS (SELECT 1 FROM auth.users WHERE id = deleting_user)
       OR NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = shared_workspace AND created_by = replacement_user)
       OR NOT EXISTS (SELECT 1 FROM public.songs WHERE id = 'epic-3-verification-song')
       OR NOT EXISTS (SELECT 1 FROM public.workspace_invites WHERE workspace_id = shared_workspace AND created_by = replacement_user)
       OR NOT EXISTS (SELECT 1 FROM private.account_deletion_archive WHERE user_id = deleting_user) THEN
        RAISE EXCEPTION 'VERIFY_ACCOUNT_DELETION_OR_PRESERVATION_FAILED';
    END IF;

    DELETE FROM public.workspaces WHERE id IN (shared_workspace, blocked_workspace);
    DELETE FROM public.workspaces
    WHERE workspace_type = 'personal' AND created_by IN (replacement_user, blocked_user);
    DELETE FROM public.profiles WHERE id IN (replacement_user, blocked_user);
    DELETE FROM auth.users WHERE id IN (replacement_user, blocked_user);
    DELETE FROM private.account_deletion_archive WHERE user_id = deleting_user;

    IF (SELECT count(*) FROM public.workspaces) <> before_workspace_count
       OR (SELECT count(*) FROM public.songs) <> before_song_count THEN
        RAISE EXCEPTION 'VERIFY_ACCOUNT_DELETION_CLEANUP_FAILED';
    END IF;
END;
$verify$;
