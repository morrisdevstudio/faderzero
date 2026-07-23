-- Story 1.5 cutover: validation is deliberately separate from expansion so
-- anomaly evidence survives if this deployment gate blocks.

DO $gate$
DECLARE
    unresolved_count BIGINT;
BEGIN
    SELECT count(*)
    INTO unresolved_count
    FROM private.workspace_integrity_quarantine
    WHERE resolved_at IS NULL;

    IF unresolved_count > 0 THEN
        RAISE EXCEPTION 'UNRESOLVED_WORKSPACE_INTEGRITY_ANOMALIES: %', unresolved_count;
    END IF;
END;
$gate$;

ALTER TABLE public.setlist_songs
    VALIDATE CONSTRAINT setlist_songs_workspace_setlist_fkey;
ALTER TABLE public.setlist_songs
    VALIDATE CONSTRAINT setlist_songs_workspace_song_fkey;
ALTER TABLE public.song_assets
    VALIDATE CONSTRAINT song_assets_workspace_song_fkey;

CREATE OR REPLACE FUNCTION private.reject_workspace_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
        RAISE EXCEPTION 'WORKSPACE_ID_IMMUTABLE'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.reject_workspace_id_change()
FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER songs_reject_workspace_id_change
    BEFORE UPDATE OF workspace_id ON public.songs
    FOR EACH ROW EXECUTE FUNCTION private.reject_workspace_id_change();

CREATE TRIGGER setlists_reject_workspace_id_change
    BEFORE UPDATE OF workspace_id ON public.setlists
    FOR EACH ROW EXECUTE FUNCTION private.reject_workspace_id_change();

CREATE TRIGGER setlist_songs_reject_workspace_id_change
    BEFORE UPDATE OF workspace_id ON public.setlist_songs
    FOR EACH ROW EXECUTE FUNCTION private.reject_workspace_id_change();

CREATE TRIGGER song_assets_reject_workspace_id_change
    BEFORE UPDATE OF workspace_id ON public.song_assets
    FOR EACH ROW EXECUTE FUNCTION private.reject_workspace_id_change();
