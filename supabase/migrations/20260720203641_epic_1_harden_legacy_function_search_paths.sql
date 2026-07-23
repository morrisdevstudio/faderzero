-- Close the two legacy advisor findings and align historical RPCs with the
-- same immutable search path used by the Epic 1 authorization functions.
ALTER FUNCTION public.bump_server_version() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.get_workspace_invite_by_token(TEXT) SET search_path = '';
ALTER FUNCTION public.accept_workspace_invite(TEXT) SET search_path = '';
