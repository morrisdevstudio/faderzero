-- The CHECK constraints on epks execute this immutable helper as the caller.
-- Authenticated EPK editors therefore need execution rights without exposing it
-- to anon or PUBLIC.
GRANT EXECUTE ON FUNCTION private.epk_sections_are_unique(text[]) TO authenticated;
