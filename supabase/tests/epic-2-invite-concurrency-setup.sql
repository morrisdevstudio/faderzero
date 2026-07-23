DO $setup$
BEGIN
    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
        ('00000000-0000-0000-0000-000000000000', '12000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'epic2-concurrency-admin@example.test', '{}', '{}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', '12000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'epic2-concurrency-a@example.test', '{}', '{}', now(), now()),
        ('00000000-0000-0000-0000-000000000000', '12000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'epic2-concurrency-b@example.test', '{}', '{}', now(), now());

    INSERT INTO public.workspaces (id, name, created_by)
    VALUES (
        '22000000-0000-4000-8000-000000000002',
        'Epic 2 invite concurrency',
        '12000000-0000-4000-8000-000000000004'
    );

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (
        '22000000-0000-4000-8000-000000000002',
        '12000000-0000-4000-8000-000000000004',
        'admin'
    );

    INSERT INTO public.workspace_invites (
        id, workspace_id, email, token, token_hash, role,
        status, created_by, expires_at
    ) VALUES (
        '42000000-0000-4000-8000-000000000002',
        '22000000-0000-4000-8000-000000000002',
        '',
        NULL,
        encode(extensions.digest('epic-2-concurrent-token', 'sha256'), 'hex'),
        'guest',
        'pending',
        '12000000-0000-4000-8000-000000000004',
        now() + interval '1 hour'
    );
END;
$setup$;
