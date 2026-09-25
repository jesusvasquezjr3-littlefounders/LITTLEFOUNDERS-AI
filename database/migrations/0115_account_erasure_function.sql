-- account_erasure_function — Product 10 E.6: the database half of an
-- account erasure, in one transaction.
-- @phase: contract
-- @after-release: none — this file only DEFINES erase_account_data(); applying it deletes nothing. The phase classifier flags the DELETE statements inside the function body, so it is declared contract and applied by hand. Apply it right after account_deletion_requests and BEFORE the Core release that calls it: without it Core's erasure step fails closed (the request stays 'processing', nothing is deleted, the sweep retries daily).
--
-- WHAT IT DOES, for one request Core has claimed ('processing'):
--
-- 1. Refuses a staff account (the floor under Core's own refusal) and is
--    idempotent: a request whose core step is recorded returns that record.
-- 2. Takes the inventory the other services need BEFORE the rows that point
--    at it disappear, and stores it on the request in this same transaction:
--      depot_paths  every Depot object this account's rows reference — the
--                   Mentor's synthesized audio of its sessions, task evidence
--                   photos of tasks it was assigned or assigned, and legacy
--                   badge images of shares about or by it
--      anon_ids     the pre-signup first-party visitor ids converted into it,
--                   so the warehouse can drop those events too
-- 3. Deletes the rows about this person that do NOT cascade from auth.users:
--    the Mentor memory ledger (no foreign key by design), the converted
--    anonymous visitor rows (their events cascade), and email delivery logs
--    (addressed by user id or by the account's own address).
-- 4. Removes, while the account still exists, the rows whose delete or
--    update triggers write audit entries: follows and blocks, guardian links
--    (0110 suspends a child who lost their last Tutor — the A.1 cascade),
--    staff grants the account made (provenance cleared), its own roles and
--    permissions. Voice consent it granted to a child stops being in force.
-- 5. Deletes GoTrue's own audit entries for the account when the migration
--    role may (reported as -1 when it may not, never silently skipped), then
--    the auth.users row itself. Everything else cascades or clears its
--    provenance (migration account_deletion_requests).
-- 6. Keeps from the Depot list any object still referenced by a surviving row
--    (Depot is content-addressed; an identical file can belong to someone
--    else), records the core step with its counts, and audits the erasure.
--
-- Nothing here reaches another service. Core runs Oracle, Depot and the
-- warehouse steps around this call and completes the request only when every
-- step is recorded (complete_account_deletion).

CREATE OR REPLACE FUNCTION public.erase_account_data(p_request uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_req public.account_deletion_requests%ROWTYPE;
    v_subject uuid;
    v_email text;
    v_candidates text[];
    v_remaining text[];
    v_anon uuid[];
    v_counts jsonb := '{}'::jsonb;
    v_n bigint;
    v_gotrue_audit bigint;
BEGIN
    SELECT * INTO v_req FROM public.account_deletion_requests WHERE id = p_request FOR UPDATE;
    IF NOT FOUND OR v_req.status <> 'processing' THEN
        RAISE EXCEPTION 'ERASURE_NOT_CLAIMED' USING ERRCODE = 'P0001';
    END IF;
    IF v_req.steps ? 'core' THEN
        RETURN v_req.steps -> 'core';
    END IF;
    v_subject := v_req.subject_id;

    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_subject;
    IF NOT FOUND THEN
        -- Already gone (for example removed by an operator through GoTrue):
        -- nothing left here, and the other services still run their steps.
        v_counts := jsonb_build_object('account', 0);
        UPDATE public.account_deletion_requests
            SET steps = steps || jsonb_build_object('core', v_counts), last_error = NULL
            WHERE id = p_request;
        RETURN v_counts;
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_subject AND role IN ('admin', 'superadmin')) THEN
        RAISE EXCEPTION 'STAFF_ACCOUNT' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Inventory.
    SELECT COALESCE(array_agg(DISTINCT x.path), ARRAY[]::text[]) INTO v_candidates FROM (
        SELECT t.audio_path AS path
            FROM public.tutor_turns t JOIN public.tutor_sessions s ON s.id = t.session_id
            WHERE s.user_id = v_subject AND t.audio_path IS NOT NULL
        UNION ALL
        SELECT k.evidence_bucket || '/' || k.evidence_hash || '.' || k.evidence_ext
            FROM public.tasks k
            WHERE (k.assigned_to = v_subject OR k.assigned_by = v_subject)
              AND k.evidence_bucket IS NOT NULL AND k.evidence_hash IS NOT NULL AND k.evidence_ext IS NOT NULL
        UNION ALL
        SELECT b.image_bucket || '/' || b.image_hash || '.' || b.image_ext
            FROM public.badge_shares b
            WHERE b.kid_user_id = v_subject OR b.created_by = v_subject
    ) x;
    SELECT COALESCE(array_agg(v.anon_id), ARRAY[]::uuid[]) INTO v_anon
        FROM public.anon_visitors v WHERE v.converted_user_id = v_subject;

    -- 3. Rows about this person that do not cascade.
    DELETE FROM public.learner_memory_ledger WHERE user_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('learner_memory_ledger', v_n);
    DELETE FROM public.anon_visitors WHERE converted_user_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('anon_visitors', v_n);
    DELETE FROM public.email_logs
        WHERE user_id = v_subject
           OR (v_email IS NOT NULL AND lower(to_address) = lower(v_email));
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('email_logs', v_n);

    -- 4. Trigger-bearing rows, while the account still exists.
    DELETE FROM public.follows WHERE follower_id = v_subject OR followed_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('follows', v_n);
    DELETE FROM public.blocks WHERE blocker_id = v_subject OR blocked_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('blocks', v_n);
    DELETE FROM public.guardian_links WHERE parent_user_id = v_subject OR kid_user_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('guardian_links', v_n);
    UPDATE public.tutor_voice_consent SET revoked_at = now()
        WHERE granted_by = v_subject AND user_id <> v_subject AND revoked_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('voice_consents_ended', v_n);
    UPDATE public.user_roles SET granted_by = NULL WHERE granted_by = v_subject AND user_id <> v_subject;
    UPDATE public.admin_permissions SET granted_by = NULL WHERE granted_by = v_subject AND user_id <> v_subject;
    DELETE FROM public.admin_permissions WHERE user_id = v_subject;
    DELETE FROM public.user_roles WHERE user_id = v_subject;

    -- 5. GoTrue's audit trail, then the account.
    BEGIN
        DELETE FROM auth.audit_log_entries WHERE payload ->> 'actor_id' = v_subject::text;
        GET DIAGNOSTICS v_gotrue_audit = ROW_COUNT;
    EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
        v_gotrue_audit := -1;
    END;
    v_counts := v_counts || jsonb_build_object('gotrue_audit_entries', v_gotrue_audit);

    DELETE FROM auth.users WHERE id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN
        RAISE EXCEPTION 'ERASURE_ACCOUNT_NOT_DELETED' USING ERRCODE = 'P0001';
    END IF;
    v_counts := v_counts || jsonb_build_object('account', 1);

    -- 6. Depot objects nobody else still references.
    SELECT COALESCE(array_agg(c.path ORDER BY c.path), ARRAY[]::text[]) INTO v_remaining
        FROM unnest(v_candidates) AS c(path)
        WHERE NOT EXISTS (SELECT 1 FROM public.tutor_turns t WHERE t.audio_path = c.path)
          AND NOT EXISTS (SELECT 1 FROM public.tasks k
                WHERE k.evidence_bucket || '/' || k.evidence_hash || '.' || k.evidence_ext = c.path)
          AND NOT EXISTS (SELECT 1 FROM public.badge_shares b
                WHERE b.image_bucket || '/' || b.image_hash || '.' || b.image_ext = c.path);
    v_counts := v_counts || jsonb_build_object(
        'depot_objects', COALESCE(array_length(v_remaining, 1), 0),
        'depot_shared_kept', COALESCE(array_length(v_candidates, 1), 0) - COALESCE(array_length(v_remaining, 1), 0),
        'anon_ids', COALESCE(array_length(v_anon, 1), 0));

    UPDATE public.account_deletion_requests
        SET steps = steps || jsonb_build_object('core', v_counts),
            depot_paths = to_jsonb(v_remaining),
            anon_ids = to_jsonb(v_anon),
            last_error = NULL
        WHERE id = p_request;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'account.erased', v_subject::text,
            jsonb_build_object('request_id', p_request, 'population', v_req.population, 'counts', v_counts));
    RETURN v_counts;
END;
$$;
REVOKE ALL ON FUNCTION public.erase_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_account_data(uuid) TO service_role;

SELECT 'migration_account_erasure_function_ok' AS sentinel;
