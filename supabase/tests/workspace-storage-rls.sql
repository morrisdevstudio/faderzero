\set ON_ERROR_STOP on
BEGIN;
SELECT plan(6);

CREATE OR REPLACE FUNCTION pg_temp.assert_count(p_sql text, p_expected bigint, p_label text)
RETURNS void LANGUAGE plpgsql AS $function$
DECLARE actual bigint;
BEGIN EXECUTE p_sql INTO actual;
  IF actual <> p_expected THEN RAISE EXCEPTION 'ASSERT_COUNT_FAILED: %, expected %, got %', p_label, p_expected, actual; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.assert_denied(p_sql text, p_label text)
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  BEGIN EXECUTE p_sql; EXCEPTION WHEN insufficient_privilege THEN RETURN; END;
  RAISE EXCEPTION 'ASSERT_DENIED_FAILED: %', p_label;
END;
$function$;

INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
('00000000-0000-0000-0000-000000000000', '51000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'storage-admin@example.test', '{}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000', '51000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'storage-member@example.test', '{}', '{}', now(), now()),
('00000000-0000-0000-0000-000000000000', '51000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'storage-guest@example.test', '{}', '{}', now(), now());
INSERT INTO public.workspaces (id, name, created_by) VALUES
('52000000-0000-4000-8000-000000000001', 'Storage RLS', '51000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role) VALUES
('53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'admin'),
('53000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002', 'member'),
('53000000-0000-4000-8000-000000000003', '52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000003', 'guest');
INSERT INTO public.workspace_storage_connections (id, workspace_id, provider_id, connected_by, root_identifier, display_name, status, is_default) VALUES
('54000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'google_drive', '51000000-0000-4000-8000-000000000001', 'drive-root', 'drive@example.test', 'connected', true);
INSERT INTO private.workspace_storage_connection_secrets (connection_id, encrypted_credentials, encryption_key_version) VALUES
('54000000-0000-4000-8000-000000000001', decode('AA==', 'base64'), 1);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.workspace_storage_connections$$, 1, 'admin reads connection');
SELECT pg_temp.assert_denied($$SELECT count(*) FROM private.workspace_storage_connection_secrets$$, 'admin cannot read credentials');

SELECT set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.workspace_storage_connections$$, 1, 'member reads active provider');

SELECT set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000003', true);
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.workspace_storage_connections$$, 0, 'guest cannot inspect provider connection');
SELECT pg_temp.assert_denied($$SELECT public.get_storage_connection_secret('54000000-0000-4000-8000-000000000001')$$, 'authenticated role cannot call server secret function');

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.get_storage_connection_secret('54000000-0000-4000-8000-000000000001')$$, 1, 'service role reads encrypted credential');

SELECT * FROM finish();
ROLLBACK;
