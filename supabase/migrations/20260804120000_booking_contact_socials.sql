ALTER TABLE public.personal_contacts
  ADD COLUMN instagram_url text,
  ADD COLUMN facebook_url text;

ALTER TABLE public.workspace_contacts
  ADD COLUMN instagram_url text,
  ADD COLUMN facebook_url text;
