-- Keep the public slug helper deterministic and immune to caller search_path changes.
ALTER FUNCTION public.normalize_epk_slug(text) SET search_path = public, pg_temp;
