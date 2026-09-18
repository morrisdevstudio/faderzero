\set ON_ERROR_STOP on

BEGIN;

DO $test$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'song_timelines' AND rowsecurity) THEN
    RAISE EXCEPTION 'song_timelines must exist with RLS enabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'timeline_sections' AND rowsecurity) THEN
    RAISE EXCEPTION 'timeline_sections must exist with RLS enabled';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'song_timelines') <> 4 THEN
    RAISE EXCEPTION 'song_timelines must have four CRUD policies';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'timeline_sections') <> 4 THEN
    RAISE EXCEPTION 'timeline_sections must have four CRUD policies';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'song_timelines_workspace_updated_idx') THEN
    RAISE EXCEPTION 'song timeline sync index missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'timeline_sections_timeline_position_idx') THEN
    RAISE EXCEPTION 'timeline section order index missing';
  END IF;
END;
$test$;

ROLLBACK;
