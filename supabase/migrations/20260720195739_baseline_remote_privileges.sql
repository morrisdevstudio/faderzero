-- Baseline only: reproduce privileges already present on production as of 2026-07-20.
-- This migration is marked applied remotely without execution. Epic 1 will replace
-- these broad legacy privileges with explicit least-privilege grants and RLS.
SET check_function_bodies = false;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

GRANT SELECT, USAGE ON SEQUENCE public.global_server_version_seq TO anon;
GRANT ALL ON FUNCTION public.accept_workspace_invite(text) TO anon;
GRANT ALL ON FUNCTION public.bump_server_version() TO anon;
GRANT ALL ON FUNCTION public.bump_server_version() TO authenticated;
GRANT ALL ON FUNCTION public.bump_server_version() TO service_role;
GRANT ALL ON FUNCTION public.check_is_workspace_member(uuid) TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.profiles TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.setlist_songs TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.setlists TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.song_assets TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.songs TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.workspace_invites TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.workspace_members TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.workspaces TO anon;
