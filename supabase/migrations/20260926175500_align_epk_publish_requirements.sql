-- Publishing only requires a public name (see public.publish_epk, rewritten in
-- 20260903210214: "A missing featured visual, city, genre or contact no longer
-- blocks publication"). The row trigger on epks kept the older, stricter gate,
-- so any EPK without a genre, a city, a banner or a contact could never switch
-- to PUBLISHED: publish_epk updates the row, the trigger raised
-- EPK_PUBLISH_REQUIREMENTS_MISSING, and the app surfaced the rejection as the
-- generic "Publication impossible." This aligns the trigger with the rule the
-- public renderer already handles, while keeping every other validation intact.

CREATE OR REPLACE FUNCTION public.validate_epk()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = NEW.workspace_id AND workspace_type = 'group') THEN RAISE EXCEPTION 'EPK_WORKSPACE_MUST_BE_GROUP'; END IF;
  NEW.slug := public.normalize_epk_slug(NEW.slug);
  IF NEW.slug = '' OR NEW.slug IN ('home','calendar','booking','songs','setlists','prompter','sync','metronome','account','api','assets','media','preview','internal') THEN RAISE EXCEPTION 'EPK_SLUG_INVALID'; END IF;
  IF cardinality(NEW.genres) > 5 OR EXISTS (SELECT 1 FROM unnest(NEW.genres) AS genre WHERE length(trim(genre)) = 0 OR length(trim(genre)) > 40) THEN RAISE EXCEPTION 'EPK_GENRES_INVALID'; END IF;
  IF NEW.status = 'PUBLISHED' AND trim(NEW.display_name) = '' THEN RAISE EXCEPTION 'EPK_PUBLISH_NAME_MISSING'; END IF;
  NEW.updated_at := now(); NEW.server_version := nextval('public.global_server_version_seq');
  IF NEW.status = 'PUBLISHED' AND NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
  RETURN NEW;
END;
$$;
