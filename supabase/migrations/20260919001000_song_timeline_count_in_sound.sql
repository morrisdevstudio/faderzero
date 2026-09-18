ALTER TABLE public.song_timelines
  ADD COLUMN count_in_sound text NOT NULL DEFAULT 'click';

ALTER TABLE public.song_timelines
  ADD CONSTRAINT song_timelines_count_in_sound_check
  CHECK (count_in_sound IN ('click', 'voice'));

CREATE OR REPLACE FUNCTION public.copy_song_timeline_after_song_copy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  source_timeline public.song_timelines%ROWTYPE;
  new_timeline_id text;
BEGIN
  IF NEW.copied_from_song_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO source_timeline
  FROM public.song_timelines
  WHERE song_id = NEW.copied_from_song_id AND deleted_at IS NULL;
  IF source_timeline.id IS NULL THEN RETURN NEW; END IF;

  new_timeline_id := extensions.gen_random_uuid()::text;
  INSERT INTO public.song_timelines (id, workspace_id, song_id, start_count_in_bars, volume, enabled, count_in_sound)
  VALUES (
    new_timeline_id,
    NEW.workspace_id,
    NEW.id,
    source_timeline.start_count_in_bars,
    source_timeline.volume,
    source_timeline.enabled,
    source_timeline.count_in_sound
  );

  INSERT INTO public.timeline_sections (
    id, workspace_id, timeline_id, position, name, bars, tempo, numerator, denominator,
    tempo_unit, click_enabled, accent_first_beat, click_resolution, subdivision, beat_sounds,
    count_in_mode, count_in_bars, color
  )
  SELECT extensions.gen_random_uuid()::text, NEW.workspace_id, new_timeline_id, position, name,
    bars, tempo, numerator, denominator, tempo_unit, click_enabled, accent_first_beat,
    click_resolution, subdivision, beat_sounds, count_in_mode, count_in_bars, color
  FROM public.timeline_sections
  WHERE timeline_id = source_timeline.id AND deleted_at IS NULL;
  RETURN NEW;
END;
$function$;
