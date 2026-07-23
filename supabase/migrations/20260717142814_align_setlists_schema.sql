-- Align setlists and setlist_songs schema with the PWA data model.

ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS closing_annotation TEXT;

ALTER TABLE public.setlist_songs
  ADD COLUMN IF NOT EXISTS annotation TEXT,
  ADD COLUMN IF NOT EXISTS note_show_bpm BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS note_show_key BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_direct_segue BOOLEAN NOT NULL DEFAULT FALSE;

;
