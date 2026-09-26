-- The EPK section vocabulary was renamed in 20260828110000_epk_demo_editorial_content,
-- which replaced the CHECK constraint but left section_order's DEFAULT on the previous
-- vocabulary. Any insert that omitted section_order therefore failed the constraint with
-- 23514, and EPK creation was impossible from the app. Align the default with the active
-- constraint and with DEFAULT_EPK_SECTION_ORDER in the client.
ALTER TABLE public.epks
  ALTER COLUMN section_order
  SET DEFAULT ARRAY['banniere', 'bio', 'musique', 'medias', 'espacePro', 'contact'];
