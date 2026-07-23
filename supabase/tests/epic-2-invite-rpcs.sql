DO $test$
DECLARE
    historical_count BIGINT;
    historical_ids UUID[];
    generated RECORD;
    member_tokens TEXT[] := ARRAY[]::TEXT[];
    member_invite_ids UUID[] := ARRAY[]::UUID[];
    guest_invite_id UUID;
    test_workspace_id UUID := '22000000-0000-4000-8000-000000000001';
    admin_user_id UUID := '12000000-0000-4000-8000-000000000001';
    member_user_id UUID := '12000000-0000-4000-8000-000000000002';
    joiner_user_id UUID := '12000000-0000-4000-8000-000000000003';
BEGIN
    SELECT count(*), COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO historical_count, historical_ids
    FROM public.workspace_invites;

    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
        ('00000000-0000-0000-0000-000000000000', admin_user_id, 'authenticated', 'authenticated', 'epic2-admin@example.test', '{}', '{}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', member_user_id, 'authenticated', 'authenticated', 'epic2-member@example.test', '{}', '{}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', joiner_user_id, 'authenticated', 'authenticated', 'epic2-joiner@example.test', '{}', '{}', now(), now());

    INSERT INTO public.workspaces (id, name, created_by)
    VALUES (test_workspace_id, 'Epic 2 invitations', admin_user_id);

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES
        (test_workspace_id, admin_user_id, 'admin'),
        (test_workspace_id, member_user_id, 'member');

    PERFORM set_config('request.jwt.claim.sub', admin_user_id::TEXT, true);
    PERFORM set_config('request.jwt.claim.email', 'epic2-admin@example.test', true);

    FOR invite_number IN 1..5 LOOP
        SELECT * INTO STRICT generated
        FROM public.create_workspace_invite(test_workspace_id, 'member');
        member_tokens := array_append(member_tokens, generated.token);
        member_invite_ids := array_append(member_invite_ids, generated.invite_id);
    END LOOP;

    BEGIN
        PERFORM public.create_workspace_invite(test_workspace_id, 'member');
        RAISE EXCEPTION 'SIXTH_INVITE_WAS_ACCEPTED';
    EXCEPTION WHEN SQLSTATE '23514' THEN
        NULL;
    END;

    SELECT * INTO STRICT generated
    FROM public.create_workspace_invite(test_workspace_id, 'guest');
    guest_invite_id := generated.invite_id;

    PERFORM public.create_workspace_invite(test_workspace_id, 'admin');

    IF EXISTS (
        SELECT 1 FROM public.workspace_invites
        WHERE workspace_id = test_workspace_id
          AND token IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'NEW_RAW_TOKEN_STORED';
    END IF;

    IF (SELECT count(*) FROM public.list_workspace_invites(test_workspace_id)) <> 7 THEN
        RAISE EXCEPTION 'ACTIVE_INVITE_LIST_INCORRECT';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.workspace_invites
        WHERE workspace_id = test_workspace_id
          AND expires_at > now() + interval '24 hours 1 minute'
    ) THEN
        RAISE EXCEPTION 'NEW_INVITE_EXCEEDS_24_HOURS';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', member_user_id::TEXT, true);
    BEGIN
        PERFORM public.create_workspace_invite(test_workspace_id, 'guest');
        RAISE EXCEPTION 'MEMBER_CREATED_INVITE';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
    BEGIN
        PERFORM public.list_workspace_invites(test_workspace_id);
        RAISE EXCEPTION 'MEMBER_LISTED_INVITES';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    PERFORM set_config('request.jwt.claim.sub', joiner_user_id::TEXT, true);
    PERFORM public.accept_workspace_invite(member_tokens[1]);

    BEGIN
        PERFORM public.accept_workspace_invite(member_tokens[1]);
        RAISE EXCEPTION 'INVITE_REUSED';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = test_workspace_id
          AND user_id = joiner_user_id
          AND role = 'member'
    ) THEN
        RAISE EXCEPTION 'INVITE_ROLE_NOT_ASSIGNED';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', admin_user_id::TEXT, true);
    PERFORM public.revoke_workspace_invite(guest_invite_id);

    IF EXISTS (
        SELECT 1 FROM public.list_workspace_invites(test_workspace_id)
        WHERE invite_id = guest_invite_id
    ) THEN
        RAISE EXCEPTION 'REVOKED_INVITE_STILL_ACTIVE';
    END IF;

    IF has_table_privilege('authenticated', 'public.workspace_invites', 'INSERT')
       OR has_table_privilege('authenticated', 'public.workspace_invites', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.workspace_invites', 'DELETE') THEN
        RAISE EXCEPTION 'DIRECT_INVITE_WRITE_PRIVILEGE_REMAINS';
    END IF;

    DELETE FROM public.workspaces WHERE id = test_workspace_id;
    DELETE FROM auth.users WHERE id IN (admin_user_id, member_user_id, joiner_user_id);

    IF (SELECT count(*) FROM public.workspace_invites) <> historical_count THEN
        RAISE EXCEPTION 'TEST_CLEANUP_CHANGED_INVITE_COUNT';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(historical_ids) AS previous(id)
        LEFT JOIN public.workspace_invites AS current USING (id)
        WHERE current.id IS NULL
    ) THEN
        RAISE EXCEPTION 'HISTORICAL_INVITE_REMOVED';
    END IF;
END;
$test$;
