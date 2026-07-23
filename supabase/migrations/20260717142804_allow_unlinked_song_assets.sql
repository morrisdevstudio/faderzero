-- Allow imported audio files to exist before they are linked to a song.
ALTER TABLE public.song_assets
  ALTER COLUMN song_id DROP NOT NULL;

ALTER TABLE public.song_assets
  DROP CONSTRAINT IF EXISTS song_assets_song_id_fkey;

ALTER TABLE public.song_assets
  ADD CONSTRAINT song_assets_song_id_fkey
  FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE SET NULL;

;
