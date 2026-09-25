-- Names and avatars stay visible to yourself and to people who share a group.
-- A signed-in stranger can no longer list every profile or every avatar.
-- Version matches the migration already applied on the remote project.
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_shared_workspace
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.workspace_members AS mine
            JOIN public.workspace_members AS theirs
              ON theirs.workspace_id = mine.workspace_id
            WHERE mine.user_id = (SELECT auth.uid())
              AND theirs.user_id = profiles.id
        )
    );

DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;
CREATE POLICY "Members can read shared avatars"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (
            (storage.foldername(name))[1] = (SELECT auth.uid())::text
            OR EXISTS (
                SELECT 1
                FROM public.workspace_members AS mine
                JOIN public.workspace_members AS theirs
                  ON theirs.workspace_id = mine.workspace_id
                WHERE mine.user_id = (SELECT auth.uid())
                  AND theirs.user_id::text = (storage.foldername(objects.name))[1]
            )
        )
    );
