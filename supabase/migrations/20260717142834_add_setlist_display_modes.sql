-- Modes d'affichage des metadonnees dans les notes de setlist.
ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS bpm_display_mode TEXT NOT NULL DEFAULT 'per-song',
  ADD COLUMN IF NOT EXISTS key_display_mode TEXT NOT NULL DEFAULT 'per-song';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'setlists_bpm_display_mode_check'
  ) THEN
    ALTER TABLE public.setlists
      ADD CONSTRAINT setlists_bpm_display_mode_check
      CHECK (bpm_display_mode IN ('all', 'none', 'per-song'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'setlists_key_display_mode_check'
  ) THEN
    ALTER TABLE public.setlists
      ADD CONSTRAINT setlists_key_display_mode_check
      CHECK (key_display_mode IN ('all', 'none', 'per-song'));
  END IF;
END $$;

;
