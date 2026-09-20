ALTER TABLE public.song_assets
  ADD COLUMN IF NOT EXISTS asset_type TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS recorded_at DATE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE public.song_assets
  DROP CONSTRAINT IF EXISTS song_assets_asset_type_check;

ALTER TABLE public.song_assets
  ADD CONSTRAINT song_assets_asset_type_check
  CHECK (asset_type IN ('demo', 'rehearsal', 'mix', 'master', 'live', 'other'));

CREATE INDEX IF NOT EXISTS idx_song_assets_workspace_content_hash
  ON public.song_assets(workspace_id, content_hash)
  WHERE deleted_at IS NULL AND content_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION private.workspace_audio_used_seconds(p_workspace_id UUID)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $function$
  SELECT COALESCE(sum(item.duration_seconds), 0)::BIGINT
  FROM (
    SELECT max(COALESCE(assets.duration_seconds, 0)) AS duration_seconds
    FROM public.song_assets AS assets
    WHERE assets.workspace_id = p_workspace_id AND assets.deleted_at IS NULL
    GROUP BY COALESCE(assets.audio_file_id::TEXT, assets.content_hash, assets.id)
  ) AS item;
$function$;

REVOKE ALL ON FUNCTION private.workspace_audio_used_seconds(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_audio_upload(
    p_workspace_id UUID,
    p_requested_bytes BIGINT,
    p_requested_seconds INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    workspace_kind TEXT;
    used_amount BIGINT;
    reserved_amount BIGINT;
    limit_amount BIGINT;
    reservation_id UUID;
BEGIN
    IF p_requested_bytes <= 0 OR p_requested_bytes > 52428800
       OR p_requested_seconds IS NULL OR p_requested_seconds < 0 THEN
        RAISE EXCEPTION 'invalid audio reservation request';
    END IF;
    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin', 'member']::TEXT[]) THEN
        RAISE EXCEPTION 'forbidden';
    END IF;
    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;
    SELECT workspace_type INTO STRICT workspace_kind FROM public.workspaces WHERE id = p_workspace_id;
    UPDATE private.audio_upload_reservations SET status = 'expired', released_at = now()
    WHERE workspace_id = p_workspace_id AND status = 'reserved' AND expires_at <= now();
    UPDATE private.audio_upload_reservations AS reservations SET status = 'released', released_at = now()
    WHERE reservations.workspace_id = p_workspace_id AND reservations.status = 'completed'
      AND EXISTS (SELECT 1 FROM public.song_assets AS assets WHERE assets.workspace_id = reservations.workspace_id AND assets.storage_path = reservations.storage_path);
    limit_amount := CASE WHEN workspace_kind = 'personal' THEN 3600 ELSE 144000 END;
    used_amount := private.workspace_audio_used_seconds(p_workspace_id);
    SELECT COALESCE(sum(COALESCE(requested_seconds, 0)), 0) INTO reserved_amount
    FROM private.audio_upload_reservations
    WHERE workspace_id = p_workspace_id AND (status = 'completed' OR (status = 'reserved' AND expires_at > now()));
    IF used_amount + reserved_amount + p_requested_seconds > limit_amount THEN RAISE EXCEPTION 'audio quota exceeded'; END IF;
    INSERT INTO private.audio_upload_reservations (workspace_id, user_id, requested_bytes, requested_seconds)
    VALUES (p_workspace_id, auth.uid(), p_requested_bytes, p_requested_seconds)
    RETURNING id INTO reservation_id;
    RETURN reservation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_audio_quota(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $function$
DECLARE
    workspace_kind TEXT;
    used_amount BIGINT;
    reserved_amount BIGINT;
    limit_amount BIGINT;
BEGIN
    IF NOT private.has_workspace_role(p_workspace_id, ARRAY['admin', 'member']::TEXT[]) THEN RAISE EXCEPTION 'forbidden'; END IF;
    SELECT workspace_type INTO STRICT workspace_kind FROM public.workspaces WHERE id = p_workspace_id;
    limit_amount := CASE WHEN workspace_kind = 'personal' THEN 3600 ELSE 144000 END;
    used_amount := private.workspace_audio_used_seconds(p_workspace_id);
    SELECT COALESCE(sum(COALESCE(requested_seconds, 0)), 0) INTO reserved_amount
    FROM private.audio_upload_reservations AS reservations
    WHERE reservations.workspace_id = p_workspace_id
      AND ((reservations.status IN ('reserved', 'uploading') AND reservations.expires_at > now())
        OR (reservations.status = 'completed' AND NOT EXISTS (
          SELECT 1 FROM public.song_assets AS assets WHERE assets.workspace_id = reservations.workspace_id AND assets.storage_path = reservations.storage_path)));
    RETURN jsonb_build_object(
      'unit', 'seconds', 'usedAmount', used_amount, 'reservedAmount', reserved_amount,
      'limitAmount', limit_amount, 'remainingAmount', greatest(limit_amount - used_amount - reserved_amount, 0),
      'percentUsed', round(((used_amount + reserved_amount)::NUMERIC * 100) / limit_amount, 1));
END;
$function$;
