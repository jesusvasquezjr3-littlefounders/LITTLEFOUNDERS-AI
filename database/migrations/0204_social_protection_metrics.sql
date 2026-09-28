-- @phase: expand
-- social_protection_metrics — Appendix J Part 1.1-1.2 for E.1-E.5, the
-- metrics DoD 2.1(3) requires before any of those requirements is done:
-- Cross-Family Discovery Rate, Unauthorized Connection Attempt Rate,
-- Guardian-Approval Queue Latency, Report Rate and Resolution Time,
-- Repeated-Contact Pattern Escalation Rate, Age-Tier Boundary Integrity,
-- Tutor-Badge Cross-Population Visibility, Family-Panel Social Visibility
-- Adoption and Audit-Log Completeness for Social Events. The social-safety
-- and social-governance functions (social_age_tiers, social_standing_
-- guardrails) cover E.8-E.13 only.
--
-- 1. social_protection_counters: daily COUNTS by event and tier pair, never
--    an identifier. Core records the events only it sees (a profile or list
--    resolution and its verdict, a follow attempt and its refusal, a Tutor
--    badge rendered, a Family social panel view, a self-initiated unfollow
--    or unblock) through record_social_protection_event, which derives the
--    tiers and whether the two accounts are related in SQL and stores only
--    those. Birth-date and age-declaration changes are counted by triggers
--    with the path that made them.
-- 2. social_pattern_qualifies: the E.3 pattern rule of report_escalation
--    (evaluate_social_pattern), read-only, so the metric can compare the
--    subjects that meet it with the cases staff actually received.
-- 3. social_protection_metrics(p_days): service role only, counts and
--    durations only, over the last p_days (1 to 366). Core serves it at
--    GET /admin/analytics/social-protection (view_analytics).
--
-- Additive: one counts table (RLS on, no browser access), functions, two
-- AFTER UPDATE triggers that only count.

CREATE TABLE IF NOT EXISTS public.social_protection_counters (
    day          date NOT NULL,
    event        text NOT NULL CONSTRAINT social_protection_counters_event_check CHECK (event IN (
        'profile_full', 'profile_card', 'profile_refused',
        'list_full', 'list_refused',
        'action_full', 'action_card', 'action_refused',
        'follow_attempt', 'follow_refused_guardian', 'follow_refused_teen',
        'tutor_badge_shown', 'family_social_panel_view', 'unfollow', 'unblock',
        'age_change_guardian_path', 'age_change_function', 'age_change_other')),
    viewer_tier  text NOT NULL CHECK (viewer_tier IN ('guardian', 'teen', 'adult', 'closed', 'none')),
    subject_tier text NOT NULL CHECK (subject_tier IN ('guardian', 'teen', 'adult', 'closed', 'none')),
    related      boolean NOT NULL,
    n            bigint NOT NULL DEFAULT 0 CHECK (n >= 0),
    PRIMARY KEY (day, event, viewer_tier, subject_tier, related)
);
ALTER TABLE public.social_protection_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_protection_counters FROM PUBLIC, anon, authenticated, service_role;

-- Whether two accounts have an established relationship: the same account,
-- staff looking, a guardian link either way, the same family, an approved
-- guardian connection or a teen's consent either way, or a mutual follow.
CREATE OR REPLACE FUNCTION public.social_protection_related(p_viewer uuid, p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_viewer IS NOT NULL AND p_subject IS NOT NULL AND (
        p_viewer = p_subject
        OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p_viewer AND r.role IN ('admin', 'superadmin'))
        OR EXISTS (SELECT 1 FROM public.guardian_links g WHERE g.verification_status = 'verified'
                   AND ((g.parent_user_id = p_viewer AND g.kid_user_id = p_subject) OR (g.parent_user_id = p_subject AND g.kid_user_id = p_viewer)))
        OR public.social_family(p_viewer, p_subject)
        OR public.has_current_social_approval(p_viewer, p_subject) OR public.has_current_social_approval(p_subject, p_viewer)
        OR public.has_current_teen_consent(p_viewer, p_subject) OR public.has_current_teen_consent(p_subject, p_viewer)
        OR (EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = p_viewer AND f.followed_id = p_subject)
            AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = p_subject AND f.followed_id = p_viewer)));
$$;
REVOKE ALL ON FUNCTION public.social_protection_related(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_protection_related(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.social_protection_count(p_event text, p_viewer_tier text, p_subject_tier text, p_related boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    INSERT INTO public.social_protection_counters (day, event, viewer_tier, subject_tier, related, n)
    VALUES ((now() AT TIME ZONE 'UTC')::date, p_event, coalesce(p_viewer_tier, 'none'), coalesce(p_subject_tier, 'none'), p_related, 1)
    ON CONFLICT (day, event, viewer_tier, subject_tier, related) DO UPDATE SET n = public.social_protection_counters.n + 1;
$$;
REVOKE ALL ON FUNCTION public.social_protection_count(text, text, text, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- What Core calls. The ids never reach the table: only the tiers and the relation.
CREATE OR REPLACE FUNCTION public.record_social_protection_event(p_event text, p_viewer uuid, p_subject uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_event IS NULL OR p_event LIKE 'age_change_%' OR p_viewer IS NULL OR p_subject IS NULL THEN
        RAISE EXCEPTION 'SOCIAL_EVENT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM public.social_protection_count(p_event, public.social_tier(p_viewer), public.social_tier(p_subject),
        public.social_protection_related(p_viewer, p_subject));
EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'SOCIAL_EVENT_INVALID' USING ERRCODE = 'P0001';
END;
$$;
REVOKE ALL ON FUNCTION public.record_social_protection_event(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_social_protection_event(text, uuid, uuid) TO service_role;

-- E.4 (Age-Tier Boundary Integrity): every change of a set birth date or age
-- declaration is counted with its path. A reviewed function or migration
-- (the database owner) and Core's guardian path (the service role writing a
-- child with a verified guardian) are sanctioned; anything else is counted
-- as 'other' (target zero). Setting a first birth date is not a change.
-- The writer is captured by a SECURITY INVOKER BEFORE trigger (inside a
-- reviewed SECURITY DEFINER function current_user is its owner; a direct
-- PostgREST write is the API role) into a transaction-local setting that the
-- counting AFTER trigger reads.
CREATE OR REPLACE FUNCTION public.note_age_boundary_writer()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    PERFORM set_config('lf.age_boundary_writer', current_user::text, true);
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.note_age_boundary_writer() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.count_age_boundary_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_user uuid := NEW.user_id;
    v_writer text := coalesce(nullif(current_setting('lf.age_boundary_writer', true), ''), 'unknown');
    v_path text;
BEGIN
    IF TG_TABLE_NAME = 'profiles' THEN
        IF OLD.birth_date IS NULL OR NEW.birth_date IS NOT DISTINCT FROM OLD.birth_date THEN RETURN NULL; END IF;
    ELSIF (to_jsonb(NEW) -> 'declared_age_band') IS NOT DISTINCT FROM (to_jsonb(OLD) -> 'declared_age_band')
          AND (to_jsonb(NEW) -> 'declared_birth_month') IS NOT DISTINCT FROM (to_jsonb(OLD) -> 'declared_birth_month') THEN
        RETURN NULL;
    END IF;
    IF v_writer NOT IN ('anon', 'authenticated', 'service_role', 'unknown') THEN
        v_path := 'age_change_function';
    ELSIF v_writer = 'service_role' AND TG_TABLE_NAME = 'profiles' AND EXISTS (
        SELECT 1 FROM public.guardian_links g WHERE g.kid_user_id = v_user AND g.verification_status = 'verified') THEN
        v_path := 'age_change_guardian_path';
    ELSE
        v_path := 'age_change_other';
    END IF;
    PERFORM public.social_protection_count(v_path, 'none', public.social_tier(v_user), v_path <> 'age_change_other');
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.count_age_boundary_change() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS profiles_note_age_boundary_writer ON public.profiles;
CREATE TRIGGER profiles_note_age_boundary_writer
    BEFORE UPDATE OF birth_date ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.note_age_boundary_writer();

DROP TRIGGER IF EXISTS profiles_count_age_boundary_change ON public.profiles;
CREATE TRIGGER profiles_count_age_boundary_change
    AFTER UPDATE OF birth_date ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.count_age_boundary_change();

DROP TRIGGER IF EXISTS age_declarations_note_writer ON public.account_age_declarations;
CREATE TRIGGER age_declarations_note_writer
    BEFORE UPDATE ON public.account_age_declarations
    FOR EACH ROW EXECUTE FUNCTION public.note_age_boundary_writer();

DROP TRIGGER IF EXISTS age_declarations_count_boundary_change ON public.account_age_declarations;
CREATE TRIGGER age_declarations_count_boundary_change
    AFTER UPDATE ON public.account_age_declarations
    FOR EACH ROW EXECUTE FUNCTION public.count_age_boundary_change();

-- E.3's pattern rule (report_escalation), read-only: three unrelated kid-role
-- reporters or blockers, pairwise unrelated by verified guardians, in 30 days.
CREATE OR REPLACE FUNCTION public.social_pattern_qualifies(p_subject uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    reporter record;
    qualified int := 0;
    seen_guardians uuid[] := '{}';
    kid_guardians uuid[];
    subject_guardians uuid[];
BEGIN
    IF p_subject IS NULL THEN RETURN false; END IF;
    SELECT array_agg(parent_user_id) INTO subject_guardians
        FROM public.guardian_links WHERE kid_user_id = p_subject AND verification_status = 'verified';
    FOR reporter IN
        SELECT events.reporter_id, min(events.created_at) AS first_at
        FROM (
            SELECT reporter_id, created_at FROM public.social_reports
                WHERE subject_id = p_subject AND created_at >= now() - interval '30 days'
            UNION ALL
            SELECT al.actor_id, al.created_at FROM public.audit_logs al
                WHERE al.action = 'social.block' AND al.detail ->> 'blocked_id' = p_subject::text
                  AND al.actor_id IS NOT NULL AND al.created_at >= now() - interval '30 days'
        ) events
        WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = events.reporter_id AND ur.role = 'kid')
        GROUP BY events.reporter_id
        ORDER BY first_at ASC
    LOOP
        SELECT array_agg(parent_user_id) INTO kid_guardians
            FROM public.guardian_links WHERE kid_user_id = reporter.reporter_id AND verification_status = 'verified';
        IF kid_guardians IS NULL THEN CONTINUE; END IF;
        IF subject_guardians IS NOT NULL AND EXISTS (SELECT 1 FROM unnest(kid_guardians) g WHERE g = ANY(subject_guardians)) THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM unnest(kid_guardians) g WHERE g = ANY(seen_guardians)) THEN CONTINUE; END IF;
        seen_guardians := seen_guardians || kid_guardians;
        qualified := qualified + 1;
        IF qualified >= 3 THEN RETURN true; END IF;
    END LOOP;
    RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.social_pattern_qualifies(uuid) FROM PUBLIC, anon, authenticated, service_role;

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
              AND a.actor_id::text = a.detail ->> 'follower_id') AS unfollows_audited,
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
