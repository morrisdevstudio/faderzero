-- Keep the theme in the immutable snapshot; later draft edits must not affect the public page.
CREATE OR REPLACE FUNCTION public.publish_epk_with_media(p_epk_id uuid, p_expected_revision bigint, p_public_media jsonb)
RETURNS SETOF public.epks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp AS $$
DECLARE v_epk public.epks%ROWTYPE; v_snapshot jsonb;
BEGIN
  PERFORM public.publish_epk(p_epk_id, p_expected_revision);
  SELECT * INTO v_epk FROM public.epks WHERE id = p_epk_id FOR UPDATE;
  v_snapshot := v_epk.published_snapshot || jsonb_build_object('theme', v_epk.theme);
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
