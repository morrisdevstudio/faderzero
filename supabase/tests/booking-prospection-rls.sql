BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, email) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'booking-owner@example.test'),
  ('b1000000-0000-4000-8000-000000000002', 'booking-member@example.test'),
  ('b1000000-0000-4000-8000-000000000003', 'booking-outsider@example.test');
INSERT INTO public.workspaces (id, name, created_by) VALUES ('b2000000-0000-4000-8000-000000000001', 'Booking group', 'b1000000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role) VALUES
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'admin'),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'member');

SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
INSERT INTO public.personal_contacts (id, owner_id, name) VALUES ('personal-contact', 'b1000000-0000-4000-8000-000000000001', 'Privé');
INSERT INTO public.booking_leads (id, workspace_id, venue_name, stage, owner_id, target_date, next_action, next_action_at)
VALUES ('booking-lead', 'b2000000-0000-4000-8000-000000000001', 'La Salle', 'to_contact', 'b1000000-0000-4000-8000-000000000001', current_date, 'Relancer', now());
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.booking_leads WHERE id = 'booking-lead'$$, 1, 'admin creates lead');

SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.booking_leads WHERE id = 'booking-lead'$$, 1, 'member reads group lead');
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.personal_contacts WHERE id = 'personal-contact'$$, 0, 'member cannot read personal contact');
SELECT pg_temp.assert_affected($$UPDATE public.booking_leads SET next_action = 'Appeler' WHERE id = 'booking-lead'$$, 1, 'member updates group lead');

SELECT set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true);
SELECT pg_temp.assert_count($$SELECT count(*) FROM public.booking_leads WHERE id = 'booking-lead'$$, 0, 'outsider cannot read group lead');
SELECT pg_temp.assert_affected($$UPDATE public.booking_leads SET next_action = 'Voler' WHERE id = 'booking-lead'$$, 0, 'outsider cannot update group lead');

SELECT * FROM finish();
ROLLBACK;
