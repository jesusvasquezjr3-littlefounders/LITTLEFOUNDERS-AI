-- social_pattern_age_based — E.3's repeated-report pattern trigger counts
-- minors by age, not by role (OD-3), and so does its guardian notice.
-- @phase: expand
--
-- E.3: an account that collects reports or blocks from 3 or more unrelated
-- minor accounts within 30 days is queued for staff review automatically.
-- OD-3 (13-OWNER-DECISION-LOG section 1 and the section 2 access table):
-- every minor safeguard follows age, not role. OWNER-REVIEW-ANSWERS D-19 lets
-- adults outside a teen's family send the teen requests and names this
-- trigger as one of the limits.
--
-- The 0108 rule counted a reporter only when user_roles.role = 'kid' and
-- skipped any reporter without a verified guardian, so three self-registered
-- 13-17 teens reporting or blocking the same adult never opened a case. This
-- redefinition keeps the event sources (reports, plus blocks read from the
-- append-only 0095 audit trail), the 30-day window, the threshold of 3, the
-- greedy first-event ordering and the idempotent upsert, and changes who
-- qualifies:
--
--   - a reporter qualifies when public.social_tier() places it in a minor
--     tier ('guardian': a parent-created child or a guardian-linked origin
--     account; 'teen': a self-registered 13-17 account). Adults, guests and
--     the closed tier do not. The tier is read at evaluation time, the same
--     "as of today" reading every other E.8 gate uses;
--   - a reporter WITH verified guardians is related to the subject when it
--     shares a guardian with the subject (siblings) or when the subject is
--     one of its guardians (its own family), and is excluded; reporters that
--     share a guardian with an already-counted reporter count once;
--   - a reporter WITHOUT a verified guardian is its own unrelated unit. It
--     is still excluded when a verified guardian link joins it to the subject
--     in either direction. Only verified links count: a pending link is not a
--     relationship anyone confirmed, and letting one exempt the subject would
--     let an adult shield itself from the pattern by starting a link.
--
-- Same signature, return type, SECURITY DEFINER, empty search_path and
-- grants as 0108 (no role may call it directly; the report transaction and
-- the block trigger do).

CREATE OR REPLACE FUNCTION public.evaluate_social_pattern(p_subject uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    reporter record;
    qualified int := 0;
    seen_guardians uuid[] := '{}';
    reporter_guardians uuid[];
    subject_guardians uuid[];
    reporter_tier text;
BEGIN
    IF p_subject IS NULL THEN RETURN false; END IF;
    SELECT array_agg(parent_user_id) INTO subject_guardians
        FROM public.guardian_links
        WHERE kid_user_id = p_subject AND verification_status = 'verified';
    FOR reporter IN
        SELECT events.reporter_id, min(events.created_at) AS first_at
        FROM (
            SELECT reporter_id, created_at FROM public.social_reports
                WHERE subject_id = p_subject
                  AND created_at >= now() - interval '30 days'
            UNION ALL
            SELECT al.actor_id, al.created_at FROM public.audit_logs al
                WHERE al.action = 'social.block'
                  AND al.detail ->> 'blocked_id' = p_subject::text
                  AND al.actor_id IS NOT NULL
                  AND al.created_at >= now() - interval '30 days'
        ) events
        WHERE events.reporter_id <> p_subject
        GROUP BY events.reporter_id
        ORDER BY first_at ASC, events.reporter_id ASC
    LOOP
        -- OD-3: a minor by age, whatever its role.
        reporter_tier := public.social_tier(reporter.reporter_id);
        IF reporter_tier IS NULL OR reporter_tier NOT IN ('guardian', 'teen') THEN
            CONTINUE;
        END IF;
        SELECT array_agg(parent_user_id) INTO reporter_guardians
            FROM public.guardian_links
            WHERE kid_user_id = reporter.reporter_id AND verification_status = 'verified';
        IF reporter_guardians IS NULL THEN
            -- No guardian: its own unit, unless a verified guardian link
            -- joins it to the subject.
            IF EXISTS (SELECT 1 FROM public.guardian_links gl
                WHERE gl.verification_status = 'verified'
                  AND ((gl.parent_user_id = p_subject AND gl.kid_user_id = reporter.reporter_id)
                    OR (gl.parent_user_id = reporter.reporter_id AND gl.kid_user_id = p_subject))) THEN
                CONTINUE;
            END IF;
        ELSE
            -- The subject's own family: the subject is the reporter's
            -- guardian, or the two share one.
            IF p_subject = ANY(reporter_guardians) THEN CONTINUE; END IF;
            IF subject_guardians IS NOT NULL AND EXISTS (
                SELECT 1 FROM unnest(reporter_guardians) g WHERE g = ANY(subject_guardians)) THEN
                CONTINUE;
            END IF;
            -- Siblings of an already-counted reporter count once.
            IF EXISTS (SELECT 1 FROM unnest(reporter_guardians) g WHERE g = ANY(seen_guardians)) THEN
                CONTINUE;
            END IF;
            seen_guardians := seen_guardians || reporter_guardians;
        END IF;
        qualified := qualified + 1;
        IF qualified >= 3 THEN EXIT; END IF;
    END LOOP;
    IF qualified >= 3 THEN
        INSERT INTO public.social_review_cases(subject_id, origin)
        VALUES (p_subject, 'pattern')
        ON CONFLICT (subject_id) DO UPDATE
            SET last_seen_at = now(), status = 'open';
        RETURN true;
    END IF;
    RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.evaluate_social_pattern(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- E.3 guardian notice, by age (OD-3). 0108 notified the verified guardian of
-- a reporter or subject only when that account held the kid role, so a
-- guardian-linked under-13 origin account (social tier 'guardian', no kid
-- role) reported or was reported without its guardian being told. The rule
-- now reads public.social_child_account (0121), the same "child" test the
-- E.11 disclosure rule uses. A self-registered teen keeps deciding for itself
-- (S-05): whether a teen's linked guardian also gets this notice is the open
-- question SOCIAL-TIERS already records. Everything else is 0108 verbatim:
-- validation, the idempotent receipt, the audit row, the case upsert, the
-- connection-based notice sources and the pattern evaluation.

CREATE OR REPLACE FUNCTION public.submit_social_report(
    p_reporter_id uuid, p_subject_id uuid, p_category text, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE report_id uuid;
BEGIN
    IF p_reporter_id IS NULL OR p_subject_id IS NULL OR p_reporter_id = p_subject_id THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_REPORT' USING ERRCODE = 'P0001';
    END IF;
    IF p_category IS NULL OR p_category NOT IN
        ('unwanted_contact', 'harassment', 'inappropriate_content', 'impersonation', 'other') THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_REPORT' USING ERRCODE = 'P0001';
    END IF;
    IF p_note IS NOT NULL AND (char_length(p_note) < 1 OR char_length(p_note) > 140) THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_REPORT' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_reporter_id)
       OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_subject_id) THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_REPORT' USING ERRCODE = 'P0001';
    END IF;
    -- Idempotent receipt: one open report per reporter/subject pair; a retry
    -- returns the existing report instead of double-counting the pattern.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'social-report:' || p_reporter_id::text || ':' || p_subject_id::text, 0));
    SELECT id INTO report_id FROM public.social_reports
        WHERE reporter_id = p_reporter_id AND subject_id = p_subject_id AND status = 'open';
    IF report_id IS NOT NULL THEN RETURN report_id; END IF;
    INSERT INTO public.social_reports(reporter_id, subject_id, category, note)
        VALUES (p_reporter_id, p_subject_id, p_category, p_note) RETURNING id INTO report_id;
    -- E.2/E.3: the report feeds the append-only audit trail. The note never
    -- enters audit detail: it lives only on the report row the staff console
    -- reads under manage_support.
    INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (p_reporter_id, 'social.report', p_subject_id::text,
            jsonb_build_object('report_id', report_id, 'subject_id', p_subject_id,
                'category', p_category, 'origin', 'database-function'));
    -- Every report opens (or reopens) a review case; a later pattern trigger
    -- only bumps the same case, it cannot create a duplicate.
    INSERT INTO public.social_review_cases(subject_id, origin)
        VALUES (p_subject_id, 'report')
        ON CONFLICT (subject_id) DO UPDATE
            SET last_seen_at = now(), status = 'open', origin = 'report';
    -- E.3: notify the linked guardian. Notified: verified guardians of (a) a
    -- child reporter, (b) a child subject, and (c) accounts connected to the
    -- subject through a follow in either direction or a pending/approved
    -- connection request. A child is public.social_child_account (OD-3: by
    -- age, so a linked under-13 origin counts, not only the kid role).
    -- Guardian rows are deduplicated across the three sources.
    INSERT INTO public.social_safety_notices(guardian_id, kid_user_id, kind, subject_id, report_id)
    SELECT DISTINCT gl.parent_user_id, involved.kid_user_id, 'social.report', p_subject_id, report_id
    FROM (
        SELECT p_reporter_id AS kid_user_id
        WHERE public.social_child_account(p_reporter_id)
        UNION
        SELECT p_subject_id
        WHERE public.social_child_account(p_subject_id)
        UNION
        SELECT f.follower_id FROM public.follows f WHERE f.followed_id = p_subject_id
        UNION
        SELECT f.followed_id FROM public.follows f WHERE f.follower_id = p_subject_id
        UNION
        SELECT r.requester_id FROM public.social_connection_requests r
            WHERE r.kid_user_id = p_subject_id AND r.status IN ('pending', 'approved')
    ) involved
    JOIN public.guardian_links gl
        ON gl.kid_user_id = involved.kid_user_id AND gl.verification_status = 'verified';
    -- Automatic pattern detection, evaluated on write: three unrelated
    -- minors in 30 days queue the subject for proactive review.
    PERFORM public.evaluate_social_pattern(p_subject_id);
    RETURN report_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_social_report(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_social_report(uuid, uuid, text, text) TO service_role;
