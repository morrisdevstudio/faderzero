\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_count(p_sql TEXT, p_expected BIGINT, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $function$
DECLARE actual BIGINT;
BEGIN
    EXECUTE p_sql INTO actual;
    IF actual <> p_expected THEN
        RAISE EXCEPTION 'ASSERT_COUNT_FAILED: %, expected %, got %', p_label, p_expected, actual;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.assert_affected(p_sql TEXT, p_expected BIGINT, p_label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $function$
DECLARE actual BIGINT;
BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS actual = ROW_COUNT;
    IF actual <> p_expected THEN
        RAISE EXCEPTION 'ASSERT_AFFECTED_FAILED: %, expected %, got %', p_label, p_expected, actual;
    END IF;
END;
$function$;

INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'epic9-admin@example.test', '{}'::JSONB, '{}'::JSONB, now(), now()),
    ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'epic9-member@example.test', '{}'::JSONB, '{}'::JSONB, now(), now()),
    ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'epic9-guest@example.test', '{}'::JSONB, '{}'::JSONB, now(), now()),
    ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'epic9-outsider@example.test', '{}'::JSONB, '{}'::JSONB, now(), now());

INSERT INTO public.workspaces (id, name, created_by)
VALUES ('92000000-0000-4000-8000-000000000001', 'Epic 9 events RLS', '91000000-0000-4000-8000-000000000001');

INSERT INTO public.workspace_members (id, workspace_id, user_id, role)
VALUES
    ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'admin'),
    ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'member'),
    ('93000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', 'guest');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
INSERT INTO public.events (id, workspace_id, title, start_at)
VALUES ('epic-9-admin-event', '92000000-0000-4000-8000-000000000001', 'Admin event', now());
SELECT pg_temp.assert_affected($$DELETE FROM public.events WHERE id = 'epic-9-admin-event'$$, 1, 'admin deletes event');

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
INSERT INTO public.events (id, workspace_id, title, start_at)
VALUES ('epic-9-member-event', '92000000-0000-4000-8000-000000000001', 'Member event', now());
SELECT pg_temp.assert_affected($$UPDATE public.events SET title = 'Member edit' WHERE id = 'epic-9-member-event'$$, 1, 'member edits event');
SELECT pg_temp.assert_affected($$DELETE FROM public.events WHERE id = 'epic-9-member-event'$$, 0, 'member cannot delete event');

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.events WHERE id = 'epic-9-member-event'$$, 1, 'guest reads event');
SELECT pg_temp.assert_affected($$UPDATE public.events SET title = 'Guest edit' WHERE id = 'epic-9-member-event'$$, 0, 'guest cannot edit event');

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000004', true);
SELECT pg_temp.assert_count('SELECT count(*) FROM public.events', 0, 'outsider cannot read events');

ROLLBACK;
