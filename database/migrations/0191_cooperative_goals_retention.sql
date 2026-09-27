-- cooperative_goals_retention: Product 10 E.11 for L-04 (OD-27 (1)). The
-- social-graph retention sweep (social_graph_retention) now also covers teen
-- cooperative goals (docs/rebuild/policies/SOCIAL-GOVERNANCE.md section 3.2).
-- @phase: contract
-- @after-release: the Core release that accepts the three new counts (coopGoalsReconciled, coopGoalsDeleted, coopConsentsDeleted) in services/socialGovernance.ts SocialRetentionRun; an older Core parses the run strictly and would answer 502. This file only REDEFINES run_social_graph_retention(); applying it deletes nothing. The phase classifier flags the DELETE statements inside the function body. Apply after teen_cooperative_goals and teen_cooperative_goal_actions.
--
-- Classes 1 to 7 are unchanged from social_graph_retention. New:
--
--  8. An open cooperative goal whose rules may have lapsed is reconciled:
--     past its window it closes; an invitation older than the pending-request
--     window (30 days) lapses; a member who is no longer a 13-to-17
--     participant (turned 18, a flagged profile, the guardian's opt-in gone)
--     ends. Each change is audited by coop_goal_reconcile.
--  9. A closed goal is deleted 30 days after it closed (the closed-request
--     window), with its membership rows (ON DELETE CASCADE). What happened
--     stays in the audit log, which is append-only.
-- 10. A guardian's opt-in whose guardian is no longer a verified guardian of
--     the child is deleted; a turned-off opt-in is deleted 30 days after it
--     was turned off. Turning it on or off was audited when it happened.
--
-- The windows are the existing ones (social_retention_windows is unchanged):
-- a cooperative goal adds no new retention period.

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


    -- 8. L-04 cooperative goals whose rules may have lapsed: past the window,
    --    an invitation older than the pending window, or a member who is no
    --    longer a 13-to-17 participant (18, flagged, guardian opt-in gone).
    --    coop_goal_reconcile ends those memberships and closes the goal, with
    --    audit rows; it takes the goal's own lock.
    n := 0;
    FOR item IN SELECT g.id FROM public.coop_goals g
        WHERE g.status = 'open' AND (g.ends_at <= now() OR EXISTS (SELECT 1 FROM public.coop_goal_members m
            WHERE m.goal_id = g.id AND ((m.status = 'invited' AND m.invited_at < pending_cutoff)
               OR (m.status IN ('invited', 'active') AND NOT public.coop_goal_eligible(m.user_id)))))
        ORDER BY g.ends_at, g.id LIMIT p_limit
    LOOP
        PERFORM public.coop_goal_reconcile(item.id);
        n := n + 1;
    END LOOP;
    counts := counts || jsonb_build_object('coopGoalsReconciled', n);

    -- 9. A closed goal and its membership rows go 30 days after it closed.
    DELETE FROM public.coop_goals WHERE id IN (
        SELECT id FROM public.coop_goals WHERE status = 'closed' AND closed_at < closed_cutoff
        ORDER BY closed_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('coopGoalsDeleted', n);

    -- 10. A guardian's opt-in ends with the guardian link; a turned-off
    --     opt-in goes 30 days after it was turned off.
    DELETE FROM public.coop_goal_guardian_consents WHERE kid_user_id IN (
        SELECT c.kid_user_id FROM public.coop_goal_guardian_consents c
        WHERE (NOT c.enabled AND c.updated_at < closed_cutoff)
           OR NOT EXISTS (SELECT 1 FROM public.guardian_links l WHERE l.kid_user_id = c.kid_user_id
               AND l.parent_user_id = c.guardian_id AND l.verification_status = 'verified')
        ORDER BY c.updated_at, c.kid_user_id LIMIT p_limit FOR UPDATE SKIP LOCKED);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('coopConsentsDeleted', n);

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
