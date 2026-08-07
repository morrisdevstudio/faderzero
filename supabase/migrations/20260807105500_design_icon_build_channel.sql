CREATE TABLE public.design_icon_build_tokens (
  token_hash TEXT PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE public.design_icon_build_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.design_icon_build_tokens FROM anon, authenticated;
GRANT ALL ON public.design_icon_build_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.design_icon_prepare_build(
  p_token TEXT,
  p_inventory JSONB,
  p_revision TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  icon JSONB;
  publication public.design_icon_publications%ROWTYPE;
  token_digest TEXT := encode(extensions.digest(p_token, 'sha256'), 'hex');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.design_icon_build_tokens WHERE token_hash = token_digest) THEN
    RAISE EXCEPTION 'invalid build token' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_inventory) <> 'array' OR jsonb_array_length(p_inventory) > 2000 THEN
    RAISE EXCEPTION 'invalid inventory' USING ERRCODE = '22023';
  END IF;

  UPDATE public.design_icon_build_tokens SET last_used_at = now() WHERE token_hash = token_digest;
  FOR icon IN SELECT value FROM jsonb_array_elements(p_inventory)
  LOOP
    INSERT INTO public.design_icon_occurrences (usage_id, occurrence_id, scan_revision, last_seen_at, metadata)
    VALUES (
      left(icon->>'usageId', 160),
      left(icon->>'occurrenceId', 160),
      left(coalesce(p_revision, ''), 160),
      now(),
      coalesce(icon->'metadata', '{}'::jsonb)
    )
    ON CONFLICT (usage_id) DO UPDATE SET
      occurrence_id = EXCLUDED.occurrence_id,
      scan_revision = EXCLUDED.scan_revision,
      last_seen_at = EXCLUDED.last_seen_at,
      metadata = EXCLUDED.metadata;
  END LOOP;

  SELECT * INTO publication
  FROM public.design_icon_publications
  WHERE status = 'queued'
  ORDER BY requested_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF publication.id IS NULL THEN
    RETURN jsonb_build_object('publication', NULL);
  END IF;
  UPDATE public.design_icon_publications SET status = 'building', started_at = now() WHERE id = publication.id;
  RETURN jsonb_build_object('publication', jsonb_build_object('id', publication.id, 'manifest', publication.manifest));
END;
$$;

CREATE OR REPLACE FUNCTION public.design_icon_complete_build(
  p_token TEXT,
  p_publication_id UUID,
  p_status TEXT,
  p_build_sha TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  token_digest TEXT := encode(extensions.digest(p_token, 'sha256'), 'hex');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.design_icon_build_tokens WHERE token_hash = token_digest) THEN
    RAISE EXCEPTION 'invalid build token' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'failed') THEN
    RAISE EXCEPTION 'invalid publication status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.design_icon_publications
  SET status = p_status,
      build_sha = left(p_build_sha, 160),
      error_code = left(p_error_code, 80),
      completed_at = now()
  WHERE id = p_publication_id AND status = 'building';
END;
$$;

CREATE OR REPLACE FUNCTION public.design_icon_deploy_hook() RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cloudflare_icon_deploy_hook'
  ORDER BY created_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.design_icon_prepare_build(TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.design_icon_complete_build(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.design_icon_deploy_hook() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.design_icon_prepare_build(TEXT, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.design_icon_complete_build(TEXT, UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.design_icon_deploy_hook() TO service_role;

COMMENT ON TABLE public.design_icon_build_tokens IS 'Hashed, narrowly scoped Cloudflare build credentials; never contains service-role keys.';
