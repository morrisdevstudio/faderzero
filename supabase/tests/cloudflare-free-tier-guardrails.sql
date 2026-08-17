BEGIN;

DO $test$
DECLARE
    guardrail_user UUID := '81000000-0000-4000-8000-000000000001';
    personal_workspace UUID;
    current_period DATE := date_trunc('month', now() AT TIME ZONE 'UTC')::DATE;
    previous_period DATE := (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month')::DATE;
    usage_snapshot JSONB;
BEGIN
    UPDATE private.cloudflare_free_tier_guardrail
    SET observed_storage_bytes = 7999999999,
        external_storage_bytes = 0
    WHERE singleton;

    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', guardrail_user,
        'authenticated', 'authenticated', 'cloudflare-guardrail@example.test',
        '{}'::JSONB, '{}'::JSONB, now(), now()
    );

    SELECT id INTO STRICT personal_workspace
    FROM public.workspaces
    WHERE workspace_type = 'personal' AND created_by = guardrail_user;

    PERFORM set_config('request.jwt.claim.sub', guardrail_user::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
        'sub', guardrail_user,
        'role', 'authenticated'
    )::TEXT, true);

    BEGIN
        PERFORM public.reserve_audio_upload(personal_workspace, 2, 1);
        RAISE EXCEPTION 'R2_STORAGE_GUARDRAIL_BYPASSED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'R2_FREE_TIER_STORAGE_GUARDRAIL' THEN
            RAISE;
        END IF;
    END;

    INSERT INTO private.r2_monthly_operation_usage (
        period_start, operation_class, operation_count
    ) VALUES (
        current_period, 'B', 7999999
    )
    ON CONFLICT (period_start, operation_class) DO UPDATE
    SET operation_count = EXCLUDED.operation_count;

    usage_snapshot := public.reserve_r2_operation_budget('B', 1);
    IF (usage_snapshot->>'used')::BIGINT <> 8000000
       OR (usage_snapshot->>'remaining')::BIGINT <> 0 THEN
        RAISE EXCEPTION 'R2_CLASS_B_BOUNDARY_INVALID';
    END IF;

    BEGIN
        PERFORM public.reserve_r2_operation_budget('B', 1);
        RAISE EXCEPTION 'R2_CLASS_B_GUARDRAIL_BYPASSED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'R2_FREE_TIER_OPERATION_GUARDRAIL' THEN
            RAISE;
        END IF;
    END;

    INSERT INTO private.r2_monthly_operation_usage (
        period_start, operation_class, operation_count
    ) VALUES (
        previous_period, 'A', 800000
    )
    ON CONFLICT (period_start, operation_class) DO UPDATE
    SET operation_count = EXCLUDED.operation_count;

    usage_snapshot := public.reserve_r2_operation_budget('A', 1);
    IF (usage_snapshot->>'used')::BIGINT <> 1 THEN
        RAISE EXCEPTION 'R2_MONTHLY_RESET_INVALID';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM private.audio_upload_reservations
        WHERE user_id = guardrail_user
    ) THEN
        RAISE EXCEPTION 'REJECTED_STORAGE_RESERVATION_WAS_PERSISTED';
    END IF;
END;
$test$;

ROLLBACK;
