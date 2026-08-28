-- Content needed by the visual EPK editor.  It is private until publish_epk
-- copies it into the immutable public snapshot.
ALTER TABLE public.epks
  ADD COLUMN IF NOT EXISTS editorial_content jsonb NOT NULL DEFAULT jsonb_build_object(
    'bioTitle', 'Biographie',
    'musicTitle', 'À écouter',
    'proTitle', 'Espace pro',
    'proDescription', 'Documents et ressources à destination des professionnels.',
    'contactTitle', 'Contact',
    'facts', '[]'::jsonb
  );

ALTER TABLE public.epks DROP CONSTRAINT IF EXISTS epks_section_order_valid;
ALTER TABLE public.epks DROP CONSTRAINT IF EXISTS epks_hidden_sections_valid;

UPDATE public.epks SET
  section_order = ARRAY['banniere','bio','musique','medias','espacePro','contact'],
  hidden_sections = array_remove(ARRAY[
    CASE WHEN 'presentation' = ANY(hidden_sections) THEN 'bio' END,
    CASE WHEN 'audio' = ANY(hidden_sections) AND 'links' = ANY(hidden_sections) THEN 'musique' END,
    CASE WHEN 'videos' = ANY(hidden_sections) AND 'photos' = ANY(hidden_sections) THEN 'medias' END,
    CASE WHEN 'documents' = ANY(hidden_sections) THEN 'espacePro' END
  ]::text[], NULL)
WHERE section_order <> ARRAY['banniere','bio','musique','medias','espacePro','contact'];

ALTER TABLE public.epks ADD CONSTRAINT epks_section_order_valid CHECK (
  section_order <@ ARRAY['banniere','bio','musique','medias','espacePro','contact']
  AND private.epk_sections_are_unique(section_order)
);
ALTER TABLE public.epks ADD CONSTRAINT epks_hidden_sections_valid CHECK (
  hidden_sections <@ ARRAY['bio','musique','medias','espacePro','contact']
);

CREATE OR REPLACE FUNCTION public.save_epk_draft(p_epk_id uuid, p_expected_revision bigint, p_patch jsonb)
RETURNS SETOF public.epks LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_epk public.epks%ROWTYPE;
BEGIN
  SELECT * INTO v_epk FROM public.epks WHERE id = p_epk_id FOR UPDATE;
  IF NOT FOUND OR NOT private.is_epk_admin(v_epk.workspace_id) THEN RAISE EXCEPTION 'EPK_FORBIDDEN'; END IF;
  IF v_epk.draft_revision <> p_expected_revision THEN RAISE EXCEPTION 'EPK_DRAFT_CONFLICT'; END IF;
  UPDATE public.epks SET
    display_name = coalesce(p_patch->>'display_name', display_name), slug = coalesce(p_patch->>'slug', slug),
    genres = coalesce(ARRAY(SELECT jsonb_array_elements_text(p_patch->'genres')), genres), city = p_patch->>'city', country = p_patch->>'country',
    tagline = p_patch->>'tagline', short_bio = p_patch->>'short_bio', full_bio = p_patch->>'full_bio', accent_color = coalesce(p_patch->>'accent_color', accent_color),
    section_order = coalesce(ARRAY(SELECT jsonb_array_elements_text(p_patch->'section_order')), section_order),
    hidden_sections = coalesce(ARRAY(SELECT jsonb_array_elements_text(p_patch->'hidden_sections')), hidden_sections),
    editorial_content = coalesce(p_patch->'editorial_content', editorial_content),
    featured_type = p_patch->>'featured_type', featured_id = nullif(p_patch->>'featured_id','')::uuid,
    draft_revision = draft_revision + 1, draft_updated_at = now()
  WHERE id = p_epk_id RETURNING * INTO v_epk;
  RETURN NEXT v_epk;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_epk(p_epk_id uuid, p_expected_revision bigint)
RETURNS SETOF public.epks LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_epk public.epks%ROWTYPE; v_snapshot jsonb;
BEGIN
  SELECT * INTO v_epk FROM public.epks WHERE id = p_epk_id FOR UPDATE;
  IF NOT FOUND OR NOT private.is_epk_admin(v_epk.workspace_id) THEN RAISE EXCEPTION 'EPK_FORBIDDEN'; END IF;
  IF v_epk.draft_revision <> p_expected_revision THEN RAISE EXCEPTION 'EPK_DRAFT_CONFLICT'; END IF;
  IF trim(v_epk.display_name) = '' OR cardinality(v_epk.genres) = 0 OR coalesce(nullif(trim(v_epk.city),''),'') = '' OR v_epk.featured_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.epk_contacts WHERE epk_id = v_epk.id) THEN RAISE EXCEPTION 'EPK_PUBLISH_REQUIREMENTS_MISSING'; END IF;
  SELECT jsonb_build_object('version',2,'revision',v_epk.draft_revision,'publishedAt',now(),'name',v_epk.display_name,'slug',v_epk.slug,'tagline',v_epk.tagline,'shortBio',v_epk.short_bio,'fullBio',v_epk.full_bio,'city',v_epk.city,'country',v_epk.country,'genres',to_jsonb(v_epk.genres),'accentColor',v_epk.accent_color,'sectionOrder',to_jsonb(v_epk.section_order),'hiddenSections',to_jsonb(v_epk.hidden_sections),'editorial',v_epk.editorial_content,
    'videos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'provider',provider,'providerVideoId',provider_video_id) ORDER BY position),'[]') FROM public.epk_videos WHERE epk_id=v_epk.id),
    'tracks',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description) ORDER BY position) FILTER (WHERE visibility='PUBLIC'),'[]') FROM public.epk_tracks WHERE epk_id=v_epk.id),
    'photos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'previewAssetId',preview_asset_id,'caption',caption,'credit',credit) ORDER BY position),'[]') FROM public.epk_photos WHERE epk_id=v_epk.id),
    'documents',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'assetId',asset_id,'title',title,'type',document_type,'updatedAt',document_updated_at) ORDER BY position),'[]') FROM public.epk_documents WHERE epk_id=v_epk.id),
    'contacts',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'role',role,'email',email,'phone',phone,'whatsapp',whatsapp) ORDER BY position),'[]') FROM public.epk_contacts WHERE epk_id=v_epk.id),
    'links',(SELECT coalesce(jsonb_agg(jsonb_build_object('label',coalesce(label,kind),'url',url) ORDER BY position),'[]') FROM public.epk_links WHERE epk_id=v_epk.id)) INTO v_snapshot;
  UPDATE public.epks SET status='PUBLISHED', published_snapshot=v_snapshot, published_revision=draft_revision, published_at=now() WHERE id=p_epk_id RETURNING * INTO v_epk;
  RETURN NEXT v_epk;
END;
$$;
