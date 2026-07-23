BEGIN;

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
)
VALUES (
    'a1000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'epic-10-observation@example.test',
    '',
    now(),
    now(),
    now()
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

SELECT public.report_client_compatibility(
    'a2000000-0000-4000-8000-000000000001',
    'release-20260723-120000',
    10,
    'completed',
    8,
    0
);

RESET ROLE;

DO $test$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM private.client_compatibility_observations
        WHERE user_id = 'a1000000-0000-4000-8000-000000000001'
          AND client_id = 'a2000000-0000-4000-8000-000000000001'
          AND app_version = 'release-20260723-120000'
          AND local_schema_version = 10
          AND migration_status = 'completed'
          AND legacy_record_count = 8
          AND recovery_item_count = 0
    ) THEN
        RAISE EXCEPTION 'Valid compatibility observation was not stored';
    END IF;
END;
$test$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', true);

DO $test$
BEGIN
    BEGIN
        PERFORM public.report_client_compatibility(
            'a2000000-0000-4000-8000-000000000002',
            'release-invalid',
            10,
            'completed',
            0,
            0
        );
        RAISE EXCEPTION 'Unauthenticated observation unexpectedly succeeded';
    EXCEPTION
        WHEN insufficient_privilege THEN NULL;
    END;
END;
$test$;

ROLLBACK;
