-- Story 1.1: expand the workspace role model without removing any membership.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.workspace_role_migration_journal (
    migration_key TEXT NOT NULL,
    membership_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    user_id UUID NOT NULL,
    old_role TEXT NOT NULL,
    new_role TEXT NOT NULL,
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (migration_key, membership_id)
);

REVOKE ALL ON TABLE private.workspace_role_migration_journal
FROM PUBLIC, anon, authenticated;

ALTER TABLE public.workspace_members
    ADD CONSTRAINT workspace_members_role_check_v2
    CHECK (role IN ('owner', 'admin', 'member', 'guest')) NOT VALID;

ALTER TABLE public.workspace_members
    VALIDATE CONSTRAINT workspace_members_role_check_v2;

ALTER TABLE public.workspace_members
    DROP CONSTRAINT workspace_members_role_check;

DO $migration$
DECLARE
    before_count BIGINT;
    after_count BIGINT;
BEGIN
    SELECT count(*) INTO before_count FROM public.workspace_members;

    INSERT INTO private.workspace_role_migration_journal (
        migration_key,
        membership_id,
        workspace_id,
        user_id,
        old_role,
        new_role
    )
    SELECT
        '20260720201559_owner_to_admin',
        members.id,
        members.workspace_id,
        members.user_id,
        members.role,
        'admin'
    FROM public.workspace_members AS members
    WHERE members.role = 'owner'
    ON CONFLICT (migration_key, membership_id) DO NOTHING;

    UPDATE public.workspace_members
    SET role = 'admin', updated_at = now()
    WHERE role = 'owner';

    SELECT count(*) INTO after_count FROM public.workspace_members;
    IF after_count <> before_count THEN
        RAISE EXCEPTION 'WORKSPACE_MEMBER_COUNT_CHANGED: before=%, after=%', before_count, after_count;
    END IF;
END;
$migration$;

COMMENT ON CONSTRAINT workspace_members_role_check_v2 ON public.workspace_members IS
    'owner remains accepted for two versions and at least 30 days; new writes use admin/member/guest';
