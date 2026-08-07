REVOKE ALL ON FUNCTION public.design_icon_prepare_build(TEXT, JSONB, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.design_icon_complete_build(TEXT, UUID, TEXT, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.design_icon_prepare_build(TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.design_icon_complete_build(TEXT, UUID, TEXT, TEXT, TEXT) TO service_role;
