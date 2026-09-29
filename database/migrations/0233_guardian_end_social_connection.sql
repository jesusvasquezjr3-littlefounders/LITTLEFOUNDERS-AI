-- guardian_end_social_connection — the verified Tutor who approved a child's
-- connection can also end it (Product 10 E.1, E.2, E.3, E.13; Block E Safe
-- Social Layer Standard components 1-2, "the parent stays in the room";
-- OD-3 section 2: a child connects only with guardian approval).
-- @phase: expand
--
-- Before this file the guardian's only social write was decide_social_connection
-- (0097/0098), which settles a PENDING request. withdraw_social_connection
-- (0099/0120) is the follower's own unfollow, remove_social_follower (0120) is
-- the followed account's own tool, and the retention sweep (0122) removes an
-- edge only when the approving guardian is no longer current. So a Tutor who
-- approved an account, or who later received an E.3 safety notice about it,
-- could not close the exposure they had authorized: E.13 requires that "a
-- parent-approved connection actually be the boundary of the exposure".
--
-- 1. public.guardian_end_social_connection(p_guardian, p_kid, p_other),
--    service role only (Core passes the session guardian). In one transaction:
--      - takes the per-pair advisory locks every social transition takes
--        (both directions, in a fixed order, exactly like the block trigger),
--        then locks the guardian evidence the way decide_social_connection does;
--      - re-checks social_guardian_is_current (verified link, parent role, no
--        kid role, the LATEST verification adult and local-ocr) and refuses
--        otherwise (GUARDIAN_DECISION_FORBIDDEN);
--      - refuses a child outside the guardian tier (SOCIAL_SELF_MANAGED): a
--        self-registered teen decides its own connections (E.8, OD-3 Option B);
--      - answers 0 and writes nothing when the two accounts share no follow;
--      - marks every APPROVED social_connection_requests row between the pair,
--        in either direction, 'revoked' (the table's existing terminal state
--        for an ended approval; the audit reason says who ended it), so
--        has_current_social_approval turns false and any new follow needs a
--        fresh guardian approval; closes an accepted teen consent between the
--        pair the same way the block trigger does ('removed');
--      - deletes the follow in both directions (the follows trigger writes
--        one social.unfollow row per edge, as for every other writer);
--      - writes ONE audit_logs row: 'social.connection_revoked', actor the
--        guardian, reason 'guardian_ended', origin 'database-function'.
--    Returns how many follow edges it removed (0, 1 or 2).
--    Applying this file deletes nothing: the DELETE lives inside the function.
--
-- 2. public.social_protection_metrics(p_days): Appendix J Audit-Log
--    Completeness for Social Events reconciles Core's 'unfollow' counter with
--    social.unfollow audit rows whose actor is the follower. A guardian-ended
--    edge is deleted by the service role, so its trigger row carries no actor.
--    Core records each removed edge as an 'unfollow' event; the redefinition
--    also counts as audited a trigger row with no actor that shares its
--    transaction timestamp with a 'guardian_ended' row naming the same pair.
--    Everything else is 0204 verbatim (same signature, STABLE, SECURITY
--    DEFINER, empty search_path, grants).

CREATE OR REPLACE FUNCTION public.guardian_end_social_connection(p_guardian uuid, p_kid uuid, p_other uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    forward_pair text;
    reverse_pair text;
    removed integer;
    request_ids uuid[];
    consent_ids uuid[];
BEGIN
    IF p_guardian IS NULL OR p_kid IS NULL OR p_other IS NULL OR p_kid = p_other OR p_guardian = p_kid THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_END' USING ERRCODE = 'P0001';
    END IF;
    forward_pair := p_other::text || ':' || p_kid::text;
    reverse_pair := p_kid::text || ':' || p_other::text;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-request:' || least(forward_pair, reverse_pair), 0));
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-request:' || greatest(forward_pair, reverse_pair), 0));
    -- Lock the guardian evidence before acting; a revocation cannot land mid-way.
    PERFORM id FROM auth.users WHERE id = p_guardian FOR UPDATE;
    PERFORM user_id FROM public.user_roles WHERE user_id = p_guardian FOR SHARE;
    PERFORM user_id FROM public.parent_verifications WHERE user_id = p_guardian FOR SHARE;
    PERFORM parent_user_id FROM public.guardian_links WHERE parent_user_id = p_guardian
        AND kid_user_id = p_kid FOR SHARE;
    IF NOT public.social_guardian_is_current(p_guardian, p_kid) THEN
        RAISE EXCEPTION 'GUARDIAN_DECISION_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    IF public.social_tier(p_kid) IS DISTINCT FROM 'guardian' THEN
        RAISE EXCEPTION 'SOCIAL_SELF_MANAGED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.follows WHERE
        (follower_id = p_other AND followed_id = p_kid) OR (follower_id = p_kid AND followed_id = p_other)) THEN
        RETURN 0;
    END IF;
    WITH ended AS (
        UPDATE public.social_connection_requests SET status = 'revoked'
        WHERE status = 'approved' AND (
            (requester_id = p_other AND kid_user_id = p_kid) OR (requester_id = p_kid AND kid_user_id = p_other))
        RETURNING id)
    SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO request_ids FROM ended;
    WITH closed AS (
        UPDATE public.social_consent_requests SET status = 'removed', decided_at = now()
        WHERE status IN ('pending', 'accepted') AND (
            (requester_id = p_other AND subject_id = p_kid) OR (requester_id = p_kid AND subject_id = p_other))
        RETURNING id)
    SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO consent_ids FROM closed;
    WITH gone AS (DELETE FROM public.follows WHERE
            (follower_id = p_other AND followed_id = p_kid) OR (follower_id = p_kid AND followed_id = p_other)
        RETURNING 1)
    SELECT count(*) INTO removed FROM gone;
    INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (p_guardian, 'social.connection_revoked', p_kid::text,
            jsonb_build_object('kid_user_id', p_kid, 'guardian_id', p_guardian, 'other_user_id', p_other,
                'request_ids', to_jsonb(request_ids), 'consent_ids', to_jsonb(consent_ids), 'removed_edges', removed,
                'reason', 'guardian_ended', 'origin', 'database-function'));
    RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.guardian_end_social_connection(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_end_social_connection(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.social_protection_metrics(p_days integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_since timestamptz;
    v_day date;
BEGIN
    IF p_days IS NULL OR p_days < 1 OR p_days > 366 THEN
        RAISE EXCEPTION 'SOCIAL_METRIC_WINDOW' USING ERRCODE = 'P0001';
    END IF;
    v_since := now() - make_interval(days => p_days);
    v_day := (v_since AT TIME ZONE 'UTC')::date;
    RETURN (
    WITH c AS (
        SELECT event, viewer_tier, subject_tier, related, sum(n)::bigint AS n
        FROM public.social_protection_counters WHERE day >= v_day
        GROUP BY event, viewer_tier, subject_tier, related
    ), guardian_requests AS (
        SELECT r.requester_id, r.kid_user_id, r.status, r.requested_at, r.decided_at
        FROM public.social_connection_requests r WHERE r.requested_at >= v_since
    ), guardian_decided AS (
        SELECT extract(epoch FROM (decided_at - requested_at)) / 3600.0 AS hours
        FROM guardian_requests WHERE status IN ('approved', 'denied') AND decided_at IS NOT NULL
    ), teen_decided AS (
        SELECT extract(epoch FROM (decided_at - requested_at)) / 3600.0 AS hours
        FROM public.social_consent_requests WHERE requested_at >= v_since AND status IN ('accepted', 'declined') AND decided_at IS NOT NULL
    ), reports AS (
        SELECT r.id, r.status, r.created_at, r.resolved_at FROM public.social_reports r WHERE r.created_at >= v_since
    ), candidates AS (
        SELECT DISTINCT subject_id FROM public.social_reports WHERE created_at >= now() - interval '30 days'
        UNION
        SELECT DISTINCT (al.detail ->> 'blocked_id')::uuid FROM public.audit_logs al
         WHERE al.action = 'social.block' AND al.created_at >= now() - interval '30 days' AND al.detail ? 'blocked_id'
    ), qualifying AS (
        SELECT cd.subject_id FROM candidates cd WHERE public.social_pattern_qualifies(cd.subject_id)
    ), new_follows AS (
        SELECT f.follower_id, f.followed_id, f.created_at FROM public.follows f WHERE f.created_at >= v_since
    ), new_blocks AS (
        SELECT b.blocker_id, b.blocked_id, b.created_at FROM public.blocks b WHERE b.created_at >= v_since
    ), audit AS (
        SELECT
          (SELECT count(*) FROM new_follows) AS follows,
          (SELECT count(*) FROM new_follows f WHERE EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.action = 'social.follow'
              AND a.detail ->> 'follower_id' = f.follower_id::text AND a.detail ->> 'followed_id' = f.followed_id::text
              AND a.created_at >= f.created_at - interval '1 minute')) AS follows_audited,
          (SELECT count(*) FROM new_blocks) AS blocks,
          (SELECT count(*) FROM new_blocks b WHERE EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.action = 'social.block'
              AND a.detail ->> 'blocker_id' = b.blocker_id::text AND a.detail ->> 'blocked_id' = b.blocked_id::text
              AND a.created_at >= b.created_at - interval '1 minute')) AS blocks_audited,
          (SELECT count(*) FROM reports) AS reports,
          (SELECT count(*) FROM reports r WHERE EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.action = 'social.report'
              AND a.detail ->> 'report_id' = r.id::text)) AS reports_audited,
          (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'unfollow') AS unfollows,
          (SELECT count(*) FROM public.audit_logs a WHERE a.action = 'social.unfollow' AND a.created_at >= v_since
              AND (a.actor_id::text = a.detail ->> 'follower_id'
                OR (a.actor_id IS NULL AND EXISTS (SELECT 1 FROM public.audit_logs g
                    WHERE g.action = 'social.connection_revoked' AND g.detail ->> 'reason' = 'guardian_ended'
                      AND g.created_at = a.created_at
                      AND ((g.detail ->> 'kid_user_id' = a.detail ->> 'follower_id' AND g.detail ->> 'other_user_id' = a.detail ->> 'followed_id')
                        OR (g.detail ->> 'kid_user_id' = a.detail ->> 'followed_id' AND g.detail ->> 'other_user_id' = a.detail ->> 'follower_id')))))
          ) AS unfollows_audited,
          (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'unblock') AS unblocks,
          (SELECT count(*) FROM public.audit_logs a WHERE a.action = 'social.unblock' AND a.created_at >= v_since) AS unblocks_audited
    ), sums AS (
        SELECT
          (SELECT coalesce(sum(n), 0) FROM c WHERE subject_tier = 'guardian' AND NOT related AND event IN ('profile_full', 'profile_card', 'profile_refused', 'list_full', 'list_refused', 'action_full', 'action_card', 'action_refused')) AS disc_attempts,
          (SELECT coalesce(sum(n), 0) FROM c WHERE subject_tier = 'guardian' AND NOT related AND event IN ('profile_full', 'profile_card', 'list_full', 'action_full', 'action_card')) AS disc_reached,
          (SELECT coalesce(sum(n), 0) FROM c WHERE event IN ('profile_full', 'profile_card', 'profile_refused', 'list_full', 'list_refused', 'action_full', 'action_card', 'action_refused')) AS resolutions,
          (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'follow_attempt') AS follow_attempts,
          (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'follow_refused_guardian') AS refused_guardian,
          (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'follow_refused_teen') AS refused_teen,
          (SELECT count(*) FROM guardian_requests) AS requests,
          (SELECT count(*) FROM guardian_requests r WHERE NOT public.social_family(r.requester_id, r.kid_user_id)
              AND NOT EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = r.kid_user_id AND f.followed_id = r.requester_id)) AS requests_unrelated
    )
    SELECT jsonb_build_object(
        'days', p_days,
        'discovery', jsonb_build_object(
            'unrelatedAttempts', s.disc_attempts, 'unrelatedReached', s.disc_reached, 'resolutions', s.resolutions,
            'rate', CASE WHEN s.disc_attempts = 0 THEN NULL ELSE s.disc_reached::numeric / s.disc_attempts END),
        'unauthorizedConnections', jsonb_build_object(
            'followAttempts', s.follow_attempts, 'refusedGuardianApproval', s.refused_guardian, 'refusedSubjectConsent', s.refused_teen,
            'guardianRequests', s.requests, 'unrelatedGuardianRequests', s.requests_unrelated,
            'rate', CASE WHEN s.follow_attempts + s.requests = 0 THEN NULL
                         ELSE (s.refused_guardian + s.refused_teen + s.requests_unrelated)::numeric / (s.follow_attempts + s.requests) END),
        'approvalLatency', jsonb_build_object(
            'guardianDecided', (SELECT count(*) FROM guardian_decided),
            'guardianPending', (SELECT count(*) FROM guardian_requests WHERE status = 'pending'),
            'guardianP50Hours', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY hours) FROM guardian_decided),
            'guardianP95Hours', (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY hours) FROM guardian_decided),
            'teenDecided', (SELECT count(*) FROM teen_decided),
            'teenP50Hours', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY hours) FROM teen_decided),
            'teenP95Hours', (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY hours) FROM teen_decided)),
        'reports', jsonb_build_object(
            'filed', (SELECT count(*) FROM reports),
            'resolved', (SELECT count(*) FROM reports WHERE status = 'resolved'),
            'open', (SELECT count(*) FROM reports WHERE status = 'open'),
            'p50ResolutionHours', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (resolved_at - created_at)) / 3600.0) FROM reports WHERE resolved_at IS NOT NULL),
            'p95ResolutionHours', (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM (resolved_at - created_at)) / 3600.0) FROM reports WHERE resolved_at IS NOT NULL)),
        'patternEscalation', (SELECT jsonb_build_object(
            'qualifying', count(*),
            'escalated', count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.social_review_cases rc WHERE rc.subject_id = q.subject_id
                AND (rc.status = 'open' OR rc.last_seen_at >= now() - interval '30 days'))),
            'rate', CASE WHEN count(*) = 0 THEN NULL ELSE (count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.social_review_cases rc
                WHERE rc.subject_id = q.subject_id AND (rc.status = 'open' OR rc.last_seen_at >= now() - interval '30 days'))))::numeric / count(*) END)
            FROM qualifying q),
        'ageBoundary', jsonb_build_object(
            'guardianPath', (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'age_change_guardian_path'),
            'reviewedFunction', (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'age_change_function'),
            'other', (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'age_change_other')),
        'tutorBadge', jsonb_build_object(
            'shown', (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'tutor_badge_shown'),
            'shownUnrelated', (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'tutor_badge_shown' AND NOT related)),
        'familySocialPanel', jsonb_build_object(
            'views', (SELECT coalesce(sum(n), 0) FROM c WHERE event = 'family_social_panel_view'),
            'guardiansWithLinkedChild', (SELECT count(DISTINCT g.parent_user_id) FROM public.guardian_links g WHERE g.verification_status = 'verified')),
        'auditCompleteness', jsonb_build_object(
            'follows', a.follows, 'followsAudited', a.follows_audited,
            'blocks', a.blocks, 'blocksAudited', a.blocks_audited,
            'reports', a.reports, 'reportsAudited', a.reports_audited,
            'unfollows', a.unfollows, 'unfollowsAudited', least(a.unfollows, a.unfollows_audited),
            'unblocks', a.unblocks, 'unblocksAudited', least(a.unblocks, a.unblocks_audited),
            'rate', CASE WHEN a.follows + a.blocks + a.reports + a.unfollows + a.unblocks = 0 THEN NULL
                         ELSE (a.follows_audited + a.blocks_audited + a.reports_audited + least(a.unfollows, a.unfollows_audited)
                               + least(a.unblocks, a.unblocks_audited))::numeric
                              / (a.follows + a.blocks + a.reports + a.unfollows + a.unblocks) END)
    )
    FROM sums s, audit a
    );
END;
$$;
REVOKE ALL ON FUNCTION public.social_protection_metrics(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_protection_metrics(integer) TO service_role;
