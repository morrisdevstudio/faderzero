DO $test$
DECLARE
    before_count BIGINT;
    historical_ids UUID[];
    test_invite_id UUID := extensions.gen_random_uuid();
    target_workspace_id UUID;
    target_creator_id UUID;
    legacy_row public.workspace_invites%ROWTYPE;
BEGIN
    SELECT count(*), COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO before_count, historical_ids
    FROM public.workspace_invites;

    SELECT id, created_by
    INTO target_workspace_id, target_creator_id
    FROM public.workspaces
    ORDER BY created_at
    LIMIT 1;

    IF target_workspace_id IS NULL THEN
        RAISE EXCEPTION 'TEST_REQUIRES_A_WORKSPACE';
    END IF;

    INSERT INTO public.workspace_invites (
        id, workspace_id, email, token, status, created_by, expires_at
    ) VALUES (
        test_invite_id,
        target_workspace_id,
        'legacy-invite@example.test',
        'epic-2-legacy-token',
        'pending',
        target_creator_id,
        now() + interval '30 days'
    );

    IF (SELECT count(*) FROM public.workspace_invites) <> before_count + 1 THEN
        RAISE EXCEPTION 'HISTORICAL_INVITE_COUNT_CHANGED';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(historical_ids) AS previous(id)
        LEFT JOIN public.workspace_invites AS current USING (id)
        WHERE current.id IS NULL
    ) THEN
        RAISE EXCEPTION 'HISTORICAL_INVITE_ID_REMOVED';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.workspace_invites
        WHERE token_hash IS NULL
           OR token_hash !~ '^[0-9a-f]{64}$'
           OR role NOT IN ('admin', 'member', 'guest')
    ) THEN
        RAISE EXCEPTION 'INVALID_INVITE_BACKFILL';
    END IF;

    IF EXISTS (
        SELECT token_hash FROM public.workspace_invites
        GROUP BY token_hash HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'DUPLICATE_INVITE_HASH';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.workspace_invites
        WHERE status = 'accepted' AND consumed_at IS NULL
    ) THEN
        RAISE EXCEPTION 'ACCEPTED_INVITE_NOT_CONSUMED';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.workspace_invites
        WHERE status = 'pending'
          AND revoked_at IS NULL
          AND expires_at > now() + interval '24 hours 1 minute'
    ) THEN
        RAISE EXCEPTION 'ACTIVE_INVITE_EXCEEDS_24_HOURS';
    END IF;

    SELECT * INTO STRICT legacy_row
    FROM public.workspace_invites
    WHERE id = test_invite_id;

    IF legacy_row.token_hash <> encode(extensions.digest('epic-2-legacy-token', 'sha256'), 'hex')
       OR legacy_row.role <> 'member' THEN
        RAISE EXCEPTION 'LEGACY_INSERT_COMPATIBILITY_FAILED';
    END IF;

    DELETE FROM public.workspace_invites WHERE id = test_invite_id;

    IF (SELECT count(*) FROM public.workspace_invites) <> before_count THEN
        RAISE EXCEPTION 'TEST_CLEANUP_CHANGED_INVITE_COUNT';
    END IF;
END;
$test$;
