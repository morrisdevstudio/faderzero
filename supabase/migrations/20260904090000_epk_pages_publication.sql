-- The public Pages Function reads only this immutable, sanitized snapshot with
-- its server secret. Anonymous clients never receive table access.
CREATE TABLE IF NOT EXISTS private.epk_slug_reservations (
  slug text PRIMARY KEY,
  epk_id uuid NOT NULL REFERENCES public.epks(id) ON DELETE CASCADE,
  reserved_until timestamptz NOT NULL
);
ALTER TABLE private.epk_slug_reservations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.unpublish_epk(p_epk_id uuid)
RETURNS SETOF public.epks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_epk public.epks%ROWTYPE;
BEGIN
  SELECT * INTO v_epk FROM public.epks WHERE id = p_epk_id FOR UPDATE;
  IF NOT FOUND OR NOT private.is_epk_admin(v_epk.workspace_id) THEN RAISE EXCEPTION 'EPK_FORBIDDEN'; END IF;
  UPDATE public.epks SET status = 'DRAFT' WHERE id = p_epk_id RETURNING * INTO v_epk;
  RETURN NEXT v_epk;
END;
$$;
REVOKE ALL ON FUNCTION public.unpublish_epk(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unpublish_epk(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_epk_with_media(p_epk_id uuid, p_expected_revision bigint, p_public_media jsonb)
RETURNS SETOF public.epks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_epk public.epks%ROWTYPE; v_snapshot jsonb;
BEGIN
  PERFORM public.publish_epk(p_epk_id, p_expected_revision);
  SELECT * INTO v_epk FROM public.epks WHERE id = p_epk_id FOR UPDATE;
  v_snapshot := v_epk.published_snapshot;
  IF coalesce(p_public_media->>'heroPublicKey', '') <> '' THEN
    v_snapshot := jsonb_set(v_snapshot, '{heroPublicKey}', to_jsonb(p_public_media->>'heroPublicKey'));
  END IF;
  v_snapshot := jsonb_set(v_snapshot, '{photos}', coalesce((SELECT jsonb_agg(item || jsonb_build_object('publicKey', media->>'publicKey')) FROM jsonb_array_elements(v_snapshot->'photos') item LEFT JOIN jsonb_array_elements(coalesce(p_public_media->'photos','[]')) media ON media->>'id' = item->>'id'), '[]'));
  v_snapshot := jsonb_set(v_snapshot, '{documents}', coalesce((SELECT jsonb_agg(item || jsonb_build_object('publicKey', media->>'publicKey')) FROM jsonb_array_elements(v_snapshot->'documents') item LEFT JOIN jsonb_array_elements(coalesce(p_public_media->'documents','[]')) media ON media->>'id' = item->>'id'), '[]'));
  v_snapshot := jsonb_set(v_snapshot, '{tracks}', coalesce((SELECT jsonb_agg(item || jsonb_build_object('publicKey', media->>'publicKey')) FROM jsonb_array_elements(v_snapshot->'tracks') item LEFT JOIN jsonb_array_elements(coalesce(p_public_media->'tracks','[]')) media ON media->>'id' = item->>'id'), '[]'));
  UPDATE public.epks SET published_snapshot = v_snapshot WHERE id = p_epk_id RETURNING * INTO v_epk;
  RETURN NEXT v_epk;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_epk_with_media(uuid,bigint,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_epk_with_media(uuid,bigint,jsonb) TO authenticated;
