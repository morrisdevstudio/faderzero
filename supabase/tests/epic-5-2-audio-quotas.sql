BEGIN;

DO $test$
DECLARE
    quota_user UUID := '52000000-0000-4000-8000-000000000001';
    personal_workspace UUID;
    group_workspace UUID := '52100000-0000-4000-8000-000000000001';
    personal_reservation UUID;
    reconciled_reservation UUID;
    group_reservation UUID;
    upload_slot_one UUID;
    upload_slot_two UUID;
    upload_slot_three UUID;
    quota_snapshot JSONB;
BEGIN
    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', quota_user,
        'authenticated', 'authenticated', 'quota@example.test',
        '{}'::JSONB, '{"display_name":"Quota Test"}'::JSONB, now(), now()
    );

    SELECT id INTO STRICT personal_workspace
    FROM public.workspaces
    WHERE workspace_type = 'personal' AND created_by = quota_user;

    INSERT INTO public.workspaces (id, name, created_by, workspace_type)
    VALUES (group_workspace, 'Quota group', quota_user, 'group');
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (group_workspace, quota_user, 'admin');

    PERFORM set_config('request.jwt.claim.sub', quota_user::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
        'sub', quota_user,
        'role', 'authenticated'
    )::TEXT, true);

    BEGIN
        PERFORM public.reserve_audio_upload(personal_workspace, 1, NULL);
        RAISE EXCEPTION 'PERSONAL_DURATION_BYPASS_ACCEPTED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'invalid audio reservation request' THEN
            RAISE;
        END IF;
    END;

    personal_reservation := public.reserve_audio_upload(personal_workspace, 1000, 3500);

    BEGIN
        PERFORM public.reserve_audio_upload(personal_workspace, 1000, 101);
        RAISE EXCEPTION 'PERSONAL_QUOTA_EXCEEDED_ACCEPTED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'audio quota exceeded' THEN
            RAISE;
        END IF;
    END;

    BEGIN
        PERFORM public.complete_audio_upload_reservation(
            personal_reservation,
            'workspaces/' || group_workspace::TEXT || '/imports/cross-workspace.mp3'
        );
        RAISE EXCEPTION 'CROSS_WORKSPACE_FINALIZATION_ACCEPTED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'invalid audio storage path' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.complete_audio_upload_reservation(
        personal_reservation,
        'workspaces/' || personal_workspace::TEXT || '/imports/personal.mp3'
    );

    BEGIN
        PERFORM public.reserve_audio_upload(personal_workspace, 1000, 101);
        RAISE EXCEPTION 'COMPLETED_RESERVATION_NOT_COUNTED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'audio quota exceeded' THEN
            RAISE;
        END IF;
    END;

    INSERT INTO public.song_assets (
        id, workspace_id, storage_path, filename, mime_type,
        size_bytes, duration_seconds, last_modified_by
    ) VALUES (
        'epic-5-2-personal-asset', personal_workspace,
        'workspaces/' || personal_workspace::TEXT || '/imports/personal.mp3',
        'personal.mp3', 'audio/mpeg', 1000, 3500, quota_user
    );

    reconciled_reservation := public.reserve_audio_upload(personal_workspace, 1000, 100);
    PERFORM public.release_audio_upload_reservation(reconciled_reservation);

    quota_snapshot := public.get_audio_quota(personal_workspace);
    IF quota_snapshot->>'unit' <> 'seconds'
       OR (quota_snapshot->>'usedAmount')::BIGINT <> 3500
       OR (quota_snapshot->>'limitAmount')::BIGINT <> 3600 THEN
        RAISE EXCEPTION 'PERSONAL_QUOTA_SNAPSHOT_INVALID';
    END IF;

    IF EXISTS (
        SELECT 1 FROM private.audio_upload_reservations
        WHERE id = personal_reservation AND status <> 'released'
    ) THEN
        RAISE EXCEPTION 'COMPLETED_RESERVATION_NOT_RECONCILED';
    END IF;

    upload_slot_one := public.reserve_audio_upload(group_workspace, 10, 60);
    upload_slot_two := public.reserve_audio_upload(group_workspace, 10, 60);
    upload_slot_three := public.reserve_audio_upload(group_workspace, 10, 60);

    PERFORM public.begin_audio_upload(
        upload_slot_one, group_workspace, 10,
        repeat('a', 64)
    );
    PERFORM public.begin_audio_upload(
        upload_slot_two, group_workspace, 10,
        repeat('a', 64)
    );

    BEGIN
        PERFORM public.begin_audio_upload(
            upload_slot_three, group_workspace, 10,
            repeat('a', 64)
        );
        RAISE EXCEPTION 'USER_CONCURRENCY_LIMIT_BYPASSED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'audio upload concurrency exceeded' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.release_audio_upload_reservation(upload_slot_one);
    PERFORM public.release_audio_upload_reservation(upload_slot_two);
    PERFORM public.release_audio_upload_reservation(upload_slot_three);

    INSERT INTO public.song_assets (
        id, workspace_id, storage_path, filename, mime_type,
        size_bytes, duration_seconds, last_modified_by
    ) VALUES (
        'epic-5-2-group-asset', group_workspace,
        'workspaces/' || group_workspace::TEXT || '/imports/existing.mp3',
        'existing.mp3', 'audio/mpeg', 5368709110, 60, quota_user
    );

    group_reservation := public.reserve_audio_upload(group_workspace, 10, 60);

    BEGIN
        PERFORM public.reserve_audio_upload(group_workspace, 1, 60);
        RAISE EXCEPTION 'GROUP_QUOTA_EXCEEDED_ACCEPTED';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM <> 'audio quota exceeded' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.release_audio_upload_reservation(group_reservation);

    PERFORM public.audit_audio_r2_keys(ARRAY[
        'workspaces/' || group_workspace::TEXT || '/imports/orphan.mp3'
    ]);
    IF NOT EXISTS (
        SELECT 1 FROM private.audio_file_migration_quarantine
        WHERE r2_key = 'workspaces/' || group_workspace::TEXT || '/imports/orphan.mp3'
          AND issue_type = 'orphaned_object'
    ) THEN
        RAISE EXCEPTION 'R2_ORPHAN_AUDIT_FAILED';
    END IF;
END;
$test$;

ROLLBACK;
