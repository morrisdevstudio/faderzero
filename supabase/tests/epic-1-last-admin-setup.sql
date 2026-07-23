\set ON_ERROR_STOP on

INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'epic1-concurrent-a@example.test', '{}'::JSONB, '{"display_name":"Concurrent A"}'::JSONB, now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'epic1-concurrent-b@example.test', '{}'::JSONB, '{"display_name":"Concurrent B"}'::JSONB, now(), now());

INSERT INTO public.workspaces (id, name, created_by)
VALUES ('20000000-0000-4000-8000-000000000002', 'Epic 1 concurrency', '10000000-0000-4000-8000-000000000005');

INSERT INTO public.workspace_members (id, workspace_id, user_id, role)
VALUES
    ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 'admin'),
    ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006', 'admin');
