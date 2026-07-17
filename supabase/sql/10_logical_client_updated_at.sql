ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;

UPDATE public.songs
SET client_updated_at = COALESCE(client_updated_at, updated_at, now())
WHERE client_updated_at IS NULL;

ALTER TABLE public.songs
  ALTER COLUMN client_updated_at SET DEFAULT now();

ALTER TABLE public.songs
  ALTER COLUMN client_updated_at SET NOT NULL;

ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;

UPDATE public.setlists
SET client_updated_at = COALESCE(client_updated_at, updated_at, now())
WHERE client_updated_at IS NULL;

ALTER TABLE public.setlists
  ALTER COLUMN client_updated_at SET DEFAULT now();

ALTER TABLE public.setlists
  ALTER COLUMN client_updated_at SET NOT NULL;

ALTER TABLE public.setlist_songs
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;

UPDATE public.setlist_songs
SET client_updated_at = COALESCE(client_updated_at, updated_at, now())
WHERE client_updated_at IS NULL;

ALTER TABLE public.setlist_songs
  ALTER COLUMN client_updated_at SET DEFAULT now();

ALTER TABLE public.setlist_songs
  ALTER COLUMN client_updated_at SET NOT NULL;

ALTER TABLE public.song_assets
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;

UPDATE public.song_assets
SET client_updated_at = COALESCE(client_updated_at, updated_at, now())
WHERE client_updated_at IS NULL;

ALTER TABLE public.song_assets
  ALTER COLUMN client_updated_at SET DEFAULT now();

ALTER TABLE public.song_assets
  ALTER COLUMN client_updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.bump_server_version()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.client_updated_at := COALESCE(NEW.client_updated_at, NEW.updated_at, now());
    ELSE
        NEW.client_updated_at := COALESCE(NEW.client_updated_at, NEW.updated_at, OLD.client_updated_at, now());
    END IF;
    NEW.server_version := nextval('public.global_server_version_seq');
    NEW.updated_at := now();
    IF auth.uid() IS NOT NULL THEN
        NEW.last_modified_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
