-- Story 9.4: align events with the centralized role helpers introduced in Epic 1.

DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
DROP POLICY IF EXISTS "events_update" ON public.events;
DROP POLICY IF EXISTS "events_delete" ON public.events;

CREATE POLICY events_select ON public.events
    FOR SELECT TO authenticated
    USING ((SELECT private.is_workspace_member(workspace_id)));

CREATE POLICY events_insert ON public.events
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY events_update ON public.events
    FOR UPDATE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])))
    WITH CHECK ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin', 'member']::TEXT[])));

CREATE POLICY events_delete ON public.events
    FOR DELETE TO authenticated
    USING ((SELECT private.has_workspace_role(workspace_id, ARRAY['admin']::TEXT[])));
