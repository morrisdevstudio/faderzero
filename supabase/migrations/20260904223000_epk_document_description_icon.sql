ALTER TABLE public.epk_documents
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'folder';

ALTER TABLE public.epk_documents DROP CONSTRAINT IF EXISTS epk_documents_icon_check;
ALTER TABLE public.epk_documents
  ADD CONSTRAINT epk_documents_icon_check CHECK (icon IN ('folder', 'download', 'music', 'calendar', 'users', 'star'));

ALTER TABLE public.epk_documents ALTER COLUMN document_type SET DEFAULT 'OTHER';

CREATE OR REPLACE FUNCTION public.publish_epk(p_epk_id uuid, p_expected_revision bigint)
RETURNS SETOF public.epks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_epk public.epks%ROWTYPE; v_snapshot jsonb;
BEGIN
  SELECT * INTO v_epk FROM public.epks WHERE id = p_epk_id FOR UPDATE;
  IF NOT FOUND OR NOT private.is_epk_admin(v_epk.workspace_id) THEN RAISE EXCEPTION 'EPK_FORBIDDEN'; END IF;
  IF v_epk.draft_revision <> p_expected_revision THEN RAISE EXCEPTION 'EPK_DRAFT_CONFLICT'; END IF;
  IF coalesce(trim(v_epk.display_name), '') = '' THEN RAISE EXCEPTION 'EPK_PUBLISH_NAME_MISSING'; END IF;
  SELECT jsonb_build_object('version',2,'revision',v_epk.draft_revision,'publishedAt',now(),'name',v_epk.display_name,'slug',v_epk.slug,'tagline',v_epk.tagline,'shortBio',v_epk.short_bio,'fullBio',v_epk.full_bio,'city',v_epk.city,'country',v_epk.country,'genres',to_jsonb(v_epk.genres),'accentColor',v_epk.accent_color,'sectionOrder',to_jsonb(v_epk.section_order),'hiddenSections',to_jsonb(v_epk.hidden_sections),'editorial',v_epk.editorial_content,
    'videos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'provider',provider,'providerVideoId',provider_video_id) ORDER BY position),'[]') FROM public.epk_videos WHERE epk_id=v_epk.id),
    'tracks',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'description',description) ORDER BY position) FILTER (WHERE visibility='PUBLIC'),'[]') FROM public.epk_tracks WHERE epk_id=v_epk.id),
    'photos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'previewAssetId',preview_asset_id,'caption',caption,'credit',credit) ORDER BY position),'[]') FROM public.epk_photos WHERE epk_id=v_epk.id),
    'documents',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'assetId',asset_id,'title',title,'description',description,'icon',icon,'updatedAt',document_updated_at) ORDER BY position),'[]') FROM public.epk_documents WHERE epk_id=v_epk.id),
    'contacts',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'role',role,'email',email,'phone',phone,'whatsapp',whatsapp) ORDER BY position),'[]') FROM public.epk_contacts WHERE epk_id=v_epk.id),
    'links',(SELECT coalesce(jsonb_agg(jsonb_build_object('label',coalesce(label,kind),'url',url) ORDER BY position),'[]') FROM public.epk_links WHERE epk_id=v_epk.id)) INTO v_snapshot;
  UPDATE public.epks SET status='PUBLISHED', published_snapshot=v_snapshot, published_revision=draft_revision, published_at=now() WHERE id=p_epk_id RETURNING * INTO v_epk;
  RETURN NEXT v_epk;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_epk(uuid,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_epk(uuid,bigint) TO authenticated;
