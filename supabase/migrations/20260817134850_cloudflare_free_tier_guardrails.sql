-- Conservative Cloudflare R2 guardrails. They stop application traffic at
-- 80% of the free allowance and never delete remote objects.

CREATE TABLE private.cloudflare_free_tier_guardrail (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    storage_limit_bytes BIGINT NOT NULL CHECK (storage_limit_bytes > 0),
    class_a_limit BIGINT NOT NULL CHECK (class_a_limit > 0),
    class_b_limit BIGINT NOT NULL CHECK (class_b_limit > 0),
    external_storage_bytes BIGINT NOT NULL DEFAULT 0 CHECK (external_storage_bytes >= 0),
    observed_storage_bytes BIGINT NOT NULL DEFAULT 0 CHECK (observed_storage_bytes >= 0),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE private.cloudflare_free_tier_guardrail ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.cloudflare_free_tier_guardrail FROM PUBLIC, anon, authenticated;

INSERT INTO private.cloudflare_free_tier_guardrail (
    singleton,
    storage_limit_bytes,
    class_a_limit,
    class_b_limit,
    external_storage_bytes,
    observed_storage_bytes,
    observed_at
) VALUES (
    TRUE,
    8000000000,
    800000,
    8000000,
    60761811,
    181248562,
    '2026-08-17T12:50:00Z'
)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE private.r2_monthly_operation_usage (
    period_start DATE NOT NULL,
    operation_class TEXT NOT NULL CHECK (operation_class IN ('A', 'B')),
    operation_count BIGINT NOT NULL DEFAULT 0 CHECK (operation_count >= 0),
    PRIMARY KEY (period_start, operation_class)
);

ALTER TABLE private.r2_monthly_operation_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.r2_monthly_operation_usage FROM PUBLIC, anon, authenticated;

-- Seed the read-only Cloudflare analytics snapshot for the current billing
-- month. Future operations are reserved atomically before touching R2.
INSERT INTO private.r2_monthly_operation_usage (period_start, operation_class, operation_count)
VALUES ('2026-08-01', 'B', 10)
ON CONFLICT (period_start, operation_class) DO NOTHING;

CREATE OR REPLACE FUNCTION private.enforce_r2_storage_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
    guardrail private.cloudflare_free_tier_guardrail%ROWTYPE;
    tracked_bytes BIGINT;
    outstanding_bytes BIGINT;
    projected_bytes BIGINT;
BEGIN
    SELECT * INTO STRICT guardrail
    FROM private.cloudflare_free_tier_guardrail
    WHERE singleton
    FOR UPDATE;

    SELECT COALESCE(sum(files.size_bytes), 0)
    INTO tracked_bytes
    FROM public.audio_files AS files;

    SELECT COALESCE(sum(reservations.requested_bytes), 0)
    INTO outstanding_bytes
    FROM private.audio_upload_reservations AS reservations
    WHERE (
        reservations.status IN ('reserved', 'uploading')
        AND reservations.expires_at > now()
    ) OR (
        reservations.status = 'completed'
        AND NOT EXISTS (
            SELECT 1
            FROM public.song_assets AS assets
            WHERE assets.workspace_id = reservations.workspace_id
              AND assets.storage_path = reservations.storage_path
        )
    );

    projected_bytes := greatest(
        guardrail.observed_storage_bytes,
        guardrail.external_storage_bytes + tracked_bytes
    ) + outstanding_bytes + NEW.requested_bytes;

    IF projected_bytes > guardrail.storage_limit_bytes THEN
        RAISE EXCEPTION 'R2_FREE_TIER_STORAGE_GUARDRAIL';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enforce_r2_storage_budget() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_r2_storage_budget ON private.audio_upload_reservations;
CREATE TRIGGER enforce_r2_storage_budget
    BEFORE INSERT ON private.audio_upload_reservations
    FOR EACH ROW
    EXECUTE FUNCTION private.enforce_r2_storage_budget();

CREATE OR REPLACE FUNCTION public.reserve_r2_operation_budget(
    p_operation_class TEXT,
    p_operation_count BIGINT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    current_period DATE := date_trunc('month', now() AT TIME ZONE 'UTC')::DATE;
    configured_limit BIGINT;
    used_count BIGINT;
BEGIN
    IF p_operation_class NOT IN ('A', 'B') OR p_operation_count <= 0 THEN
        RAISE EXCEPTION 'invalid R2 operation reservation';
    END IF;

    SELECT CASE p_operation_class
        WHEN 'A' THEN class_a_limit
        ELSE class_b_limit
    END
    INTO STRICT configured_limit
    FROM private.cloudflare_free_tier_guardrail
    WHERE singleton;

    INSERT INTO private.r2_monthly_operation_usage (
        period_start,
        operation_class,
        operation_count
    ) VALUES (
        current_period,
        p_operation_class,
        0
    )
    ON CONFLICT (period_start, operation_class) DO NOTHING;

    SELECT operation_count INTO STRICT used_count
    FROM private.r2_monthly_operation_usage
    WHERE period_start = current_period
      AND operation_class = p_operation_class
    FOR UPDATE;

    IF used_count + p_operation_count > configured_limit THEN
        RAISE EXCEPTION 'R2_FREE_TIER_OPERATION_GUARDRAIL';
    END IF;

    UPDATE private.r2_monthly_operation_usage
    SET operation_count = operation_count + p_operation_count
    WHERE period_start = current_period
      AND operation_class = p_operation_class;

    RETURN jsonb_build_object(
        'operationClass', p_operation_class,
        'used', used_count + p_operation_count,
        'limit', configured_limit,
        'remaining', configured_limit - used_count - p_operation_count,
        'periodStart', current_period
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_r2_storage_observation(
    p_primary_storage_bytes BIGINT,
    p_external_storage_bytes BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF p_primary_storage_bytes < 0 OR p_external_storage_bytes < 0 THEN
        RAISE EXCEPTION 'invalid R2 storage observation';
    END IF;

    UPDATE private.cloudflare_free_tier_guardrail
    SET external_storage_bytes = p_external_storage_bytes,
        observed_storage_bytes = p_external_storage_bytes + p_primary_storage_bytes,
        observed_at = now()
    WHERE singleton;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_r2_operation_budget(TEXT, BIGINT)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_r2_storage_observation(BIGINT, BIGINT)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_r2_operation_budget(TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_r2_storage_observation(BIGINT, BIGINT) TO service_role;
