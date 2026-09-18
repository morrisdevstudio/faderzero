ALTER TABLE public.timeline_sections
  DROP CONSTRAINT IF EXISTS timeline_sections_bars_check;

ALTER TABLE public.timeline_sections
  ADD CONSTRAINT timeline_sections_bars_check CHECK (bars BETWEEN 0 AND 999);
