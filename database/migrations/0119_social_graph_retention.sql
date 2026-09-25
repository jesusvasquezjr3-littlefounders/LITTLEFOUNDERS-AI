-- social_graph_retention — Product 10 E.11: the sweep that enforces the
-- written social-graph retention policy (docs/rebuild/policies/SOCIAL-GOVERNANCE.md §3).
-- @phase: contract
-- @after-release: none — this file only DEFINES run_social_graph_retention(); applying it deletes nothing. The phase classifier flags the DELETE statements inside the function body, so it is declared contract and applied by hand. Apply it after social_standing_guardrails (it reads that file's windows and consent rule) and before the first scheduled run of .github/workflows/social-retention.yml: without it Core's sweep route answers 502 and the workflow fails loudly, deleting nothing.
--
-- WHAT ONE RUN DOES, each class bounded by p_limit rows, all in one
-- transaction with one summary audit row:
--
--  1. A teen's connection request nobody answered in 30 days expires: the row
--     goes and `social.connection_expired` (tier teen) is audited, so the
--     requester may ask again and the teen's queue does not grow forever.
--  2. A child's connection request no guardian answered in 30 days expires the
--     same way (tier guardian). An unanswered request is not consent.
--  3. Closed requests (declined, withdrawn, removed, denied, revoked) are
--     deleted 30 days after the decision. The 30 days are the teen decline
--     cooldown (social_age_tiers), which reads these rows; the decision itself
--     stays in the audit log.
--  4. A resolved report's free-text note is cleared 90 days after resolution
--     and the report deleted after 365 days. Open reports are never touched:
--     they are the E.3 evidence, and the E.3 pattern window is 30 days.
--  5. A resolved review case is deleted 365 days after resolution.
--  6. A guardian's safety notice is deleted 90 days after it was read, or 365
--     days after it was written if never read.
--  7. An edge that exposes a child (social_child_account: the guardian tier
--     or an under-13 origin no guardian has linked) without a current
--     guardian's approval (a follow made before E.1 or the S08.6 tiers
--     existed, or one whose approving guardian is no longer current) is
--     removed. The
--     follows trigger audits the unfollow; `social.retention_removed` records
--     why. Rows are re-checked under the same pair lock every social
--     transition takes, so a concurrent approval is never undone.
--  8. Nothing is ever deleted from public.audit_logs: it is append-only. The
--     run only adds its own rows (expiries, removals, the run summary).
--
-- Blocks and live follows have no expiry: they last while they are in force,
-- and go with either account (the S08.5 erasure).

CREATE OR REPLACE FUNCTION public.run_social_graph_retention(p_limit integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    w jsonb := public.social_retention_windows();
    pending_cutoff timestamptz;
    closed_cutoff timestamptz;
    item record;
    counts jsonb := '{}'::jsonb;
    n integer;
    edges integer := 0;
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 5000 THEN
        RAISE EXCEPTION 'INVALID_RETENTION_LIMIT' USING ERRCODE = 'P0001';
    END IF;
    pending_cutoff := now() - make_interval(days => (w ->> 'pendingRequestDays')::integer);
    closed_cutoff := now() - make_interval(days => (w ->> 'closedRequestDays')::integer);

    -- 1. Unanswered teen requests.
    n := 0;
    FOR item IN SELECT id, requester_id, subject_id FROM public.social_consent_requests
        WHERE status = 'pending' AND requested_at < pending_cutoff
        ORDER BY requested_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED
    LOOP
        DELETE FROM public.social_consent_requests WHERE id = item.id;
        INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'social.connection_expired', item.subject_id::text, jsonb_build_object(
            'request_id', item.id, 'requester_id', item.requester_id, 'subject_id', item.subject_id,
            'tier', 'teen', 'origin', 'retention'));
        n := n + 1;
    END LOOP;
    counts := counts || jsonb_build_object('teenPendingExpired', n);

    -- 2. Unanswered requests to a child.
    n := 0;
    FOR item IN SELECT id, requester_id, kid_user_id FROM public.social_connection_requests
        WHERE status = 'pending' AND requested_at < pending_cutoff
        ORDER BY requested_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED
    LOOP
        DELETE FROM public.social_connection_requests WHERE id = item.id;
        INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'social.connection_expired', item.kid_user_id::text, jsonb_build_object(
            'request_id', item.id, 'requester_id', item.requester_id, 'kid_user_id', item.kid_user_id,
            'tier', 'guardian', 'origin', 'retention'));
        n := n + 1;
    END LOOP;
    counts := counts || jsonb_build_object('guardianPendingExpired', n);

    -- 3. Closed requests, once their decision no longer has an effect.
    DELETE FROM public.social_consent_requests WHERE id IN (
        SELECT id FROM public.social_consent_requests
        WHERE status IN ('declined', 'withdrawn', 'removed') AND coalesce(decided_at, requested_at) < closed_cutoff
        ORDER BY coalesce(decided_at, requested_at), id LIMIT p_limit FOR UPDATE SKIP LOCKED);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('teenClosedDeleted', n);
    DELETE FROM public.social_connection_requests WHERE id IN (
        SELECT id FROM public.social_connection_requests
        WHERE status IN ('denied', 'revoked') AND coalesce(decided_at, requested_at) < closed_cutoff
        ORDER BY coalesce(decided_at, requested_at), id LIMIT p_limit FOR UPDATE SKIP LOCKED);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('guardianClosedDeleted', n);

    -- 4. Resolved reports: the note first, then the report.
    UPDATE public.social_reports SET note = NULL WHERE id IN (
        SELECT id FROM public.social_reports
        WHERE status = 'resolved' AND note IS NOT NULL
          AND resolved_at < now() - make_interval(days => (w ->> 'reportNoteDays')::integer)
        ORDER BY resolved_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('reportNotesCleared', n);
    DELETE FROM public.social_reports WHERE id IN (
        SELECT id FROM public.social_reports
        WHERE status = 'resolved' AND resolved_at < now() - make_interval(days => (w ->> 'resolvedReportDays')::integer)
        ORDER BY resolved_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('resolvedReportsDeleted', n);

    -- 5. Resolved review cases.
    DELETE FROM public.social_review_cases WHERE subject_id IN (
        SELECT subject_id FROM public.social_review_cases
        WHERE status = 'resolved' AND resolved_at < now() - make_interval(days => (w ->> 'resolvedCaseDays')::integer)
        ORDER BY resolved_at, subject_id LIMIT p_limit FOR UPDATE SKIP LOCKED);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('resolvedCasesDeleted', n);

    -- 6. Guardian safety notices.
    DELETE FROM public.social_safety_notices WHERE id IN (
        SELECT id FROM public.social_safety_notices
        WHERE read_at < now() - make_interval(days => (w ->> 'readNoticeDays')::integer)
           OR created_at < now() - make_interval(days => (w ->> 'unreadNoticeDays')::integer)
        ORDER BY created_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('noticesDeleted', n);

    -- 7. Edges that expose a child without a guardian decision.
    FOR item IN SELECT f.follower_id, f.followed_id FROM public.follows f
        WHERE (public.social_child_account(f.follower_id) OR public.social_child_account(f.followed_id))
          AND NOT public.social_edge_consented(f.follower_id, f.followed_id)
        ORDER BY f.created_at, f.follower_id, f.followed_id LIMIT p_limit
    LOOP
        PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
            'social-request:' || item.follower_id::text || ':' || item.followed_id::text, 0));
        IF public.social_edge_consented(item.follower_id, item.followed_id) THEN
            CONTINUE;
        END IF;
        DELETE FROM public.follows WHERE follower_id = item.follower_id AND followed_id = item.followed_id;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN
            INSERT INTO public.audit_logs (actor_id, action, subject, detail)
            VALUES (NULL, 'social.retention_removed', item.followed_id::text, jsonb_build_object(
                'follower_id', item.follower_id, 'followed_id', item.followed_id,
                'reason', 'no_guardian_decision', 'origin', 'retention'));
            edges := edges + 1;
        END IF;
    END LOOP;
    counts := counts || jsonb_build_object('unconsentedEdgesRemoved', edges);


    -- A class that filled its page may have more due: the caller runs again.
    counts := counts || jsonb_build_object(
        'limit', p_limit,
        'complete', NOT EXISTS (SELECT 1 FROM jsonb_each_text(counts) c WHERE c.value::integer >= p_limit));
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (NULL, 'social_retention.sweep_ran', 'social_graph', counts || jsonb_build_object('windows', w));
    RETURN counts;
END;
$$;
REVOKE ALL ON FUNCTION public.run_social_graph_retention(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_social_graph_retention(integer) TO service_role;
