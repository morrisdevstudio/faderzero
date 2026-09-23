ALTER TABLE public.timeline_sections
  ADD COLUMN subdivision integer NOT NULL DEFAULT 1 CHECK (subdivision BETWEEN 1 AND 6),
  ADD COLUMN beat_sounds jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(beat_sounds) = 'array');
