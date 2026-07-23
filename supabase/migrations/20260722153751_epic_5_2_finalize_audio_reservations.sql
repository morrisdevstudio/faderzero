-- Additive finalization: a completed reservation remains counted until the
-- corresponding song_asset is synchronized. No historical asset is changed.
ALTER TABLE private.audio_upload_reservations
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_audio_upload_reservations_storage_path
  ON private.audio_upload_reservations(storage_path)
  WHERE storage_path IS NOT NULL;

CREATE OR REPLACE FUNCTION public.complete_audio_upload_reservation(
  p_reservation_id UUID,
  p_storage_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  reservation_workspace_id UUID;
BEGIN
  SELECT workspace_id
  INTO reservation_workspace_id
  FROM private.audio_upload_reservations
  WHERE id = p_reservation_id
    AND user_id = auth.uid()
    AND status = 'reserved'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'audio reservation unavailable';
  END IF;

  IF p_storage_path NOT LIKE 'workspaces/' || reservation_workspace_id::TEXT || '/songs/%'
     AND p_storage_path NOT LIKE 'workspaces/' || reservation_workspace_id::TEXT || '/imports/%' THEN
    RAISE EXCEPTION 'invalid audio storage path';
  END IF;

  UPDATE private.audio_upload_reservations
  SET status = 'completed', storage_path = p_storage_path, completed_at = now()
  WHERE id = p_reservation_id
    AND user_id = auth.uid()
    AND status = 'reserved';
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_audio_upload_reservation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_audio_upload_reservation(UUID, TEXT) TO authenticated;
