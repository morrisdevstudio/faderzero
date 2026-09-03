-- personal_contacts is created by the later booking_prospection migration.
-- Keep this historical migration replayable on a fresh database; the columns
-- are added idempotently by repair_booking_contact_socials_order afterwards.
ALTER TABLE IF EXISTS public.personal_contacts
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text;

ALTER TABLE public.workspace_contacts
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text;
