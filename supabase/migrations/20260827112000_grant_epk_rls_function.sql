-- RLS policies invoke this internal authorization helper for authenticated
-- users. Keep it unavailable to PUBLIC/anon while allowing the policy call.
GRANT EXECUTE ON FUNCTION private.is_epk_admin(uuid) TO authenticated;
