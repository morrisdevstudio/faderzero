ALTER TABLE public.epk_contacts DROP CONSTRAINT IF EXISTS epk_contacts_role_check;
ALTER TABLE public.epk_contacts ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.epk_contacts ALTER COLUMN role DROP DEFAULT;
