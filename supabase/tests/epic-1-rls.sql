\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_count(p_sql TEXT, p_expected BIGINT, p_label TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
    actual BIGINT;
BEGIN
    EXECUTE p_sql INTO actual;
    IF actual <> p_expected THEN
        RAISE EXCEPTION 'ASSERT_COUNT_FAILED: %, expected %, got %', p_label, p_expected, actual;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.assert_affected(p_sql TEXT, p_expected BIGINT, p_label TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
    actual BIGINT;
BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS actual = ROW_COUNT;
    IF actual <> p_expected THEN
        RAISE EXCEPTION 'ASSERT_AFFECTED_FAILED: %, expected %, got %', p_label, p_expected, actual;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.assert_denied(p_sql TEXT, p_label TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION
        WHEN insufficient_privilege THEN
            RETURN;
    END;
    RAISE EXCEPTION 'ASSERT_DENIED_FAILED: %', p_label;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.assert_sqlstate(p_sql TEXT, p_expected TEXT, p_label TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLSTATE = p_expected THEN
                RETURN;
            END IF;
            RAISE EXCEPTION 'ASSERT_SQLSTATE_FAILED: %, expected %, got %', p_label, p_expected, SQLSTATE;
    END;
    RAISE EXCEPTION 'ASSERT_SQLSTATE_FAILED: %, statement succeeded', p_label;
END;
$function$;

INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'epic1-admin@example.test', '{}'::JSONB, '{"display_name":"Admin"}'::JSONB, now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'epic1-member@example.test', '{}'::JSONB, '{"display_name":"Member"}'::JSONB, now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'epic1-guest@example.test', '{}'::JSONB, '{"display_name":"Guest"}'::JSONB, now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'epic1-outsider@example.test', '{}'::JSONB, '{"display_name":"Outsider"}'::JSONB, now(), now());

INSERT INTO public.workspaces (id, name, created_by)
VALUES ('20000000-0000-4000-8000-000000000001', 'Epic 1 RLS', '10000000-0000-4000-8000-000000000001');

INSERT INTO public.workspaces (id, name, created_by)
VALUES ('20000000-0000-4000-8000-000000000003', 'Epic 1 foreign workspace', '10000000-0000-4000-8000-000000000004');

INSERT INTO public.workspace_members (id, workspace_id, user_id, role)
VALUES
    ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'admin'),
    ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'member'),
    ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'guest');

INSERT INTO public.songs (id, workspace_id, title, status)
VALUES ('epic-1-song', '20000000-0000-4000-8000-000000000001', 'Role matrix', 'En cours');

INSERT INTO public.songs (id, workspace_id, title, status)
VALUES ('epic-1-foreign-song', '20000000-0000-4000-8000-000000000003', 'Foreign song', 'En cours');

INSERT INTO public.setlists (id, workspace_id, name)
VALUES ('epic-1-foreign-setlist', '20000000-0000-4000-8000-000000000003', 'Foreign setlist');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.workspaces WHERE id = '20000000-0000-4000-8000-000000000001'$$, 1, 'admin reads workspace');
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.workspace_members WHERE workspace_id = '20000000-0000-4000-8000-000000000001'$$, 3, 'admin reads members');
SELECT pg_temp.assert_affected(
    $$UPDATE public.songs SET title = 'Admin edit' WHERE id = 'epic-1-song'$$,
    1,
    'admin edits content'
);
SELECT pg_temp.assert_denied(
    $$INSERT INTO public.workspace_invites (id, workspace_id, email, token, status, created_by, expires_at) VALUES ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'invite@example.test', 'epic-1-admin-token', 'pending', '10000000-0000-4000-8000-000000000001', now() + interval '1 day')$$,
    'direct invitation writes stay forbidden after Epic 2'
);
SELECT public.set_workspace_member_role(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'guest'
);
SELECT pg_temp.assert_count(
    $$SELECT count(*) FROM public.workspace_members WHERE user_id = '10000000-0000-4000-8000-000000000002' AND role = 'guest'$$,
    1,
    'admin changes member role through RPC'
);
SELECT public.set_workspace_member_role(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'member'
);
SELECT pg_temp.assert_sqlstate(
    $$SELECT public.set_workspace_member_role('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'member')$$,
    '23514',
    'last admin cannot demote itself'
);
SELECT pg_temp.assert_sqlstate(
    $$INSERT INTO public.setlist_songs (id, workspace_id, setlist_id, position) VALUES ('cross-space-link', '20000000-0000-4000-8000-000000000001', 'epic-1-foreign-setlist', 1)$$,
    '23503',
    'composite setlist relation blocks cross-space link'
);
SELECT pg_temp.assert_sqlstate(
    $$INSERT INTO public.song_assets (id, workspace_id, song_id, storage_path, filename, mime_type, size_bytes) VALUES ('cross-space-audio', '20000000-0000-4000-8000-000000000001', 'epic-1-foreign-song', 'workspaces/20000000-0000-4000-8000-000000000001/imports/cross.mp3', 'cross.mp3', 'audio/mpeg', 4)$$,
    '23503',
    'composite audio relation blocks cross-space link'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
SELECT pg_temp.assert_count('SELECT count(*) FROM public.songs', 1, 'member reads content');
SELECT pg_temp.assert_affected(
    $$UPDATE public.songs SET title = 'Member edit' WHERE id = 'epic-1-song'$$,
    1,
    'member edits content'
);
SELECT pg_temp.assert_denied(
    'SELECT count(*) FROM public.workspace_invites',
    'direct invitation reads stay forbidden after Epic 2'
);
SELECT pg_temp.assert_affected(
    $$UPDATE public.workspaces SET name = 'Forbidden member edit' WHERE id = '20000000-0000-4000-8000-000000000001'$$,
    0,
    'member cannot edit workspace'
);
SELECT pg_temp.assert_denied(
    $$UPDATE public.workspace_members SET role = 'admin' WHERE user_id = '10000000-0000-4000-8000-000000000002'$$,
    'member cannot promote itself directly'
);
SELECT pg_temp.assert_sqlstate(
    $$SELECT public.set_workspace_member_role('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'admin')$$,
    '42501',
    'member cannot promote itself through RPC'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
SELECT pg_temp.assert_count('SELECT count(*) FROM public.songs', 1, 'guest reads content');
SELECT pg_temp.assert_count('SELECT count(*) FROM public.song_assets', 0, 'guest can query media metadata');
SELECT pg_temp.assert_affected(
    $$UPDATE public.songs SET title = 'Forbidden guest edit' WHERE id = 'epic-1-song'$$,
    0,
    'guest cannot edit content'
);
SELECT public.leave_workspace('20000000-0000-4000-8000-000000000001');

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.workspaces WHERE id = '20000000-0000-4000-8000-000000000001'$$, 0, 'non-member cannot read workspace');
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.workspace_members WHERE workspace_id = '20000000-0000-4000-8000-000000000001'$$, 0, 'non-member cannot read members');
SELECT pg_temp.assert_count('SELECT count(*) FROM public.songs', 0, 'non-member cannot read content');
SELECT pg_temp.assert_denied(
    $$INSERT INTO public.songs (id, workspace_id, title, status) VALUES ('forbidden-song', '20000000-0000-4000-8000-000000000001', 'Forbidden', 'Idee')$$,
    'non-member cannot insert content'
);

RESET ROLE;

SELECT pg_temp.assert_count(
    $$SELECT count(*) FROM public.workspace_members WHERE workspace_id = '20000000-0000-4000-8000-000000000001'$$,
    2,
    'guest leaves voluntarily through RPC'
);
SELECT pg_temp.assert_sqlstate(
    $$UPDATE public.songs SET workspace_id = '20000000-0000-4000-8000-000000000003' WHERE id = 'epic-1-song'$$,
    '23514',
    'workspace id is immutable even for privileged maintenance'
);

DO $integrity$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname IN (
            'setlist_songs_workspace_setlist_fkey',
            'setlist_songs_workspace_song_fkey',
            'song_assets_workspace_song_fkey'
        )
          AND NOT convalidated
    ) THEN
        RAISE EXCEPTION 'COMPOSITE_CONSTRAINT_NOT_VALIDATED';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM private.workspace_integrity_quarantine
        WHERE resolved_at IS NULL
    ) THEN
        RAISE EXCEPTION 'UNEXPECTED_QUARANTINE_ENTRY';
    END IF;
END;
$integrity$;

DO $privileges$
BEGIN
    IF has_table_privilege('anon', 'public.songs', 'SELECT') THEN
        RAISE EXCEPTION 'ANON_TABLE_PRIVILEGE_REMAINS';
    END IF;
    IF has_table_privilege('authenticated', 'public.workspace_members', 'UPDATE') THEN
        RAISE EXCEPTION 'DIRECT_MEMBER_UPDATE_PRIVILEGE_REMAINS';
    END IF;
END;
$privileges$;

ROLLBACK;
