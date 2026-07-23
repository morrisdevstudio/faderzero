CREATE TABLE private.client_compatibility_observations (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    app_version TEXT NOT NULL CHECK (
        length(app_version) BETWEEN 1 AND 64
        AND app_version ~ '^[A-Za-z0-9._-]+$'
    ),
    local_schema_version INTEGER NOT NULL CHECK (local_schema_version BETWEEN 1 AND 10000),
    migration_status TEXT NOT NULL CHECK (
        migration_status IN ('completed', 'recovery_required')
    ),
    legacy_record_count INTEGER NOT NULL CHECK (legacy_record_count >= 0),
    recovery_item_count INTEGER NOT NULL CHECK (recovery_item_count >= 0),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, client_id)
);

ALTER TABLE private.client_compatibility_observations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.client_compatibility_observations
    FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private.client_compatibility_observations
    TO service_role;

CREATE INDEX client_compatibility_observations_last_seen_idx
    ON private.client_compatibility_observations (last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.report_client_compatibility(
    p_client_id UUID,
    p_app_version TEXT,
    p_local_schema_version INTEGER,
    p_migration_status TEXT,
    p_legacy_record_count INTEGER,
    p_recovery_item_count INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
    END IF;

    IF p_app_version IS NULL
       OR length(p_app_version) NOT BETWEEN 1 AND 64
       OR p_app_version !~ '^[A-Za-z0-9._-]+$'
       OR p_local_schema_version NOT BETWEEN 1 AND 10000
       OR p_migration_status NOT IN ('completed', 'recovery_required')
       OR p_legacy_record_count < 0
       OR p_recovery_item_count < 0 THEN
        RAISE EXCEPTION 'INVALID_COMPATIBILITY_OBSERVATION' USING ERRCODE = '22023';
    END IF;

    INSERT INTO private.client_compatibility_observations (
        user_id,
        client_id,
        app_version,
        local_schema_version,
        migration_status,
        legacy_record_count,
        recovery_item_count
    )
    VALUES (
        current_user_id,
        p_client_id,
        p_app_version,
        p_local_schema_version,
        p_migration_status,
        p_legacy_record_count,
        p_recovery_item_count
    )
    ON CONFLICT (user_id, client_id) DO UPDATE SET
        app_version = EXCLUDED.app_version,
        local_schema_version = EXCLUDED.local_schema_version,
        migration_status = EXCLUDED.migration_status,
        legacy_record_count = EXCLUDED.legacy_record_count,
        recovery_item_count = EXCLUDED.recovery_item_count,
        last_seen_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.report_client_compatibility(UUID, TEXT, INTEGER, TEXT, INTEGER, INTEGER)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_client_compatibility(UUID, TEXT, INTEGER, TEXT, INTEGER, INTEGER)
    TO authenticated, service_role;

COMMENT ON TABLE private.client_compatibility_observations IS
    'Epic 10 compatibility evidence. Contains no token, email, content, or device fingerprint.';
COMMENT ON FUNCTION public.report_client_compatibility(UUID, TEXT, INTEGER, TEXT, INTEGER, INTEGER) IS
    'Records the authenticated client version and completed local migration state for the Epic 10 observation gate.';
