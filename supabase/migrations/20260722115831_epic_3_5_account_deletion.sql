-- Story 3.5: e-mail-confirmed, transactional account deletion.

CREATE TABLE IF NOT EXISTS private.account_deletion_requests (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS private.account_deletion_archive (
    user_id UUID PRIMARY KEY,
    profile_snapshot JSONB,
    personal_workspace_snapshot JSONB,
    transferred_workspaces JSONB NOT NULL DEFAULT '[]'::JSONB,
    transferred_invitations JSONB NOT NULL DEFAULT '[]'::JSONB,
    request_snapshot JSONB NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE
    private.account_deletion_requests,
    private.account_deletion_archive
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.account_deletion_blockers(p_user_id UUID)
RETURNS TABLE (workspace_id UUID, workspace_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT workspaces.id, workspaces.name
    FROM public.workspaces AS workspaces
    WHERE workspaces.workspace_type = 'group'
      AND (
          EXISTS (
              SELECT 1
              FROM public.workspace_members AS current_membership
              WHERE current_membership.workspace_id = workspaces.id
                AND current_membership.user_id = p_user_id
                AND current_membership.role IN ('owner', 'admin')
          )
          OR workspaces.created_by = p_user_id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.workspace_members AS replacement
          WHERE replacement.workspace_id = workspaces.id
            AND replacement.user_id <> p_user_id
            AND replacement.role IN ('owner', 'admin')
      )
    ORDER BY workspaces.name, workspaces.id;
$function$;

REVOKE ALL ON FUNCTION private.account_deletion_blockers(UUID)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_account_deletion_blockers()
RETURNS TABLE (workspace_id UUID, workspace_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT blockers.workspace_id, blockers.workspace_name
    FROM private.account_deletion_blockers((SELECT auth.uid())) AS blockers
    WHERE (SELECT auth.uid()) IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.get_account_deletion_blockers()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_account_deletion_blockers() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_account_deletion_request(p_token_hash TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_id UUID := (SELECT auth.uid());
    expiration TIMESTAMPTZ := now() + interval '1 hour';
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'INVALID_DELETION_TOKEN' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM private.account_deletion_blockers(current_user_id)) THEN
        RAISE EXCEPTION 'LAST_ADMIN_BLOCKS_ACCOUNT_DELETION' USING ERRCODE = '23514';
    END IF;

    INSERT INTO private.account_deletion_requests (
        user_id, token_hash, requested_at, expires_at, consumed_at
    ) VALUES (
        current_user_id, p_token_hash, now(), expiration, NULL
    )
    ON CONFLICT (user_id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash,
        requested_at = EXCLUDED.requested_at,
        expires_at = EXCLUDED.expires_at,
        consumed_at = NULL;

    RETURN expiration;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_account_deletion_request(TEXT)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_account_deletion_request(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_current_account(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_id UUID := (SELECT auth.uid());
    deletion_request private.account_deletion_requests%ROWTYPE;
    jwt_amr JSONB := COALESCE((SELECT auth.jwt()) -> 'amr', '[]'::JSONB);
    personal_workspace_id UUID;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(jwt_amr) AS methods(method)
        WHERE methods.method ->> 'method' IN ('otp', 'magiclink')
    ) THEN
        RAISE EXCEPTION 'EMAIL_CONFIRMATION_REQUIRED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO deletion_request
    FROM private.account_deletion_requests
    WHERE user_id = current_user_id
    FOR UPDATE;

    IF deletion_request.user_id IS NULL
       OR deletion_request.consumed_at IS NOT NULL
       OR deletion_request.expires_at <= now()
       OR deletion_request.token_hash <> encode(extensions.digest(COALESCE(p_token, ''), 'sha256'), 'hex') THEN
        RAISE EXCEPTION 'ACCOUNT_DELETION_LINK_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1 FROM auth.users WHERE id = current_user_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM private.account_deletion_blockers(current_user_id)) THEN
        RAISE EXCEPTION 'LAST_ADMIN_BLOCKS_ACCOUNT_DELETION' USING ERRCODE = '23514';
    END IF;

    INSERT INTO private.account_deletion_archive (
        user_id,
        profile_snapshot,
        personal_workspace_snapshot,
        transferred_workspaces,
        transferred_invitations,
        request_snapshot
    )
    SELECT
        current_user_id,
        (SELECT to_jsonb(profiles) FROM public.profiles AS profiles WHERE profiles.id = current_user_id),
        (
            SELECT jsonb_build_object(
                'workspace', to_jsonb(workspaces),
                'song_count', (SELECT count(*) FROM public.songs WHERE workspace_id = workspaces.id),
                'setlist_count', (SELECT count(*) FROM public.setlists WHERE workspace_id = workspaces.id),
                'setlist_song_count', (SELECT count(*) FROM public.setlist_songs WHERE workspace_id = workspaces.id),
                'song_asset_count', (SELECT count(*) FROM public.song_assets WHERE workspace_id = workspaces.id)
            )
            FROM public.workspaces AS workspaces
            WHERE workspaces.created_by = current_user_id
              AND workspaces.workspace_type = 'personal'
        ),
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'workspace_id', workspaces.id,
                'previous_created_by', current_user_id,
                'new_created_by', replacement.user_id
            ))
            FROM public.workspaces AS workspaces
            CROSS JOIN LATERAL (
                SELECT members.user_id
                FROM public.workspace_members AS members
                WHERE members.workspace_id = workspaces.id
                  AND members.user_id <> current_user_id
                  AND members.role IN ('owner', 'admin')
                ORDER BY CASE WHEN members.role = 'owner' THEN 0 ELSE 1 END, members.created_at, members.user_id
                LIMIT 1
            ) AS replacement
            WHERE workspaces.workspace_type = 'group'
              AND workspaces.created_by = current_user_id
        ), '[]'::JSONB),
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'invite_id', invites.id,
                'workspace_id', invites.workspace_id,
                'previous_created_by', current_user_id,
                'new_created_by', replacement.user_id
            ))
            FROM public.workspace_invites AS invites
            CROSS JOIN LATERAL (
                SELECT members.user_id
                FROM public.workspace_members AS members
                WHERE members.workspace_id = invites.workspace_id
                  AND members.user_id <> current_user_id
                  AND members.role IN ('owner', 'admin')
                ORDER BY CASE WHEN members.role = 'owner' THEN 0 ELSE 1 END, members.created_at, members.user_id
                LIMIT 1
            ) AS replacement
            WHERE invites.created_by = current_user_id
        ), '[]'::JSONB),
        to_jsonb(deletion_request)
    ON CONFLICT (user_id) DO UPDATE
    SET profile_snapshot = EXCLUDED.profile_snapshot,
        personal_workspace_snapshot = EXCLUDED.personal_workspace_snapshot,
        transferred_workspaces = EXCLUDED.transferred_workspaces,
        transferred_invitations = EXCLUDED.transferred_invitations,
        request_snapshot = EXCLUDED.request_snapshot,
        deleted_at = now();

    UPDATE public.workspaces AS workspaces
    SET created_by = (
        SELECT members.user_id
        FROM public.workspace_members AS members
        WHERE members.workspace_id = workspaces.id
          AND members.user_id <> current_user_id
          AND members.role IN ('owner', 'admin')
        ORDER BY CASE WHEN members.role = 'owner' THEN 0 ELSE 1 END, members.created_at, members.user_id
        LIMIT 1
    )
    WHERE workspaces.workspace_type = 'group'
      AND workspaces.created_by = current_user_id;

    UPDATE public.workspace_invites AS invites
    SET created_by = (
        SELECT members.user_id
        FROM public.workspace_members AS members
        WHERE members.workspace_id = invites.workspace_id
          AND members.user_id <> current_user_id
          AND members.role IN ('owner', 'admin')
        ORDER BY CASE WHEN members.role = 'owner' THEN 0 ELSE 1 END, members.created_at, members.user_id
        LIMIT 1
    )
    WHERE invites.created_by = current_user_id;

    SELECT id INTO personal_workspace_id
    FROM public.workspaces
    WHERE created_by = current_user_id
      AND workspace_type = 'personal';

    DELETE FROM private.profile_migration_journal WHERE profile_id = current_user_id;
    DELETE FROM private.personal_workspace_migration_journal WHERE user_id = current_user_id;
    DELETE FROM public.workspaces WHERE id = personal_workspace_id;

    UPDATE private.account_deletion_requests
    SET consumed_at = now()
    WHERE user_id = current_user_id;

    -- Foreign-key SET NULL updates fire the content versioning triggers. Clear
    -- the request identity so they do not write the user being deleted back.
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', (COALESCE((SELECT auth.jwt()), '{}'::JSONB) - 'sub')::TEXT, true);

    DELETE FROM auth.users WHERE id = current_user_id;
    RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_current_account(TEXT)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_current_account(TEXT) TO authenticated;
