-- @phase: expand
-- E.3: a report action routes to a platform-level review queue; reporting or
-- blocking a kid-role connection notifies the linked guardian(s); report and
-- block events feed the E.2 audit trail; and an automatic pattern trigger
-- queues an account for proactive staff review once >= 3 unrelated kid-role
-- accounts report or block it within 30 days (OD-13 calibration: "three
-- reports in 30 days" applies as written).
--
-- The trigger is a DETERMINISTIC FUNCTION EVALUATED ON EVERY REPORT/BLOCK
-- WRITE, not a cron sweep: the queue entry is created in the same transaction
-- as the event that crosses the threshold, so no scheduled job exists to miss
-- a window or drift. Block events are counted from the append-only audit
-- trail written by migration 0095 (E.2's own record), never from the live
-- blocks table, so an unblock cannot erase history from the pattern.

CREATE TABLE IF NOT EXISTS public.social_reports (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category    text NOT NULL CHECK (category IN ('unwanted_contact', 'harassment', 'inappropriate_content', 'impersonation', 'other')),
    -- Child-safe by construction: the note is optional and capped at 140
    -- characters. No free-form unbounded text reaches staff.
    note        text CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 140),
    status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT social_report_not_self CHECK (reporter_id <> subject_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS social_report_one_open
    ON public.social_reports(reporter_id, subject_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS social_report_pattern_window
    ON public.social_reports(subject_id, created_at);
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;
-- No browser policies: Core brokers reads and writes through the reviewed
-- transaction function below, exactly like social_connection_requests.

-- One queue case per subject account. The unique PK is what makes the
-- automatic pattern trigger idempotent: any number of threshold-crossing
-- writes upsert one open case instead of flooding the queue.
CREATE TABLE IF NOT EXISTS public.social_review_cases (
    subject_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    origin        text NOT NULL CHECK (origin IN ('report', 'pattern')),
    status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at  timestamptz NOT NULL DEFAULT now(),
    resolved_at   timestamptz,
    resolved_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.social_review_cases ENABLE ROW LEVEL SECURITY;
-- No browser policies: the staff console reads it through Core's service-role
-- data plane under the manage_support grant (G.1).

-- Guardian notification mechanism. There is no general notification
-- infrastructure in the product; this table IS the durable notice record,
-- read by Family through Core's verified-guardian boundary. Kind is a closed
-- set so a future notice type is an explicit schema decision, never
-- free-form.
CREATE TABLE IF NOT EXISTS public.social_safety_notices (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kid_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('social.report')),
    subject_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_id   uuid REFERENCES public.social_reports(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    read_at     timestamptz
);
CREATE INDEX IF NOT EXISTS social_safety_notice_guardian_queue
    ON public.social_safety_notices(guardian_id, created_at DESC, id DESC);
ALTER TABLE public.social_safety_notices ENABLE ROW LEVEL SECURITY;
-- No browser policies: notices are written only inside submit_social_report
-- and read by Core's /family/social-notices under the verified-parent gate.

REVOKE ALL ON public.social_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.social_review_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.social_safety_notices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.social_reports TO service_role;
GRANT SELECT ON public.social_review_cases TO service_role;
GRANT SELECT ON public.social_safety_notices TO service_role;

-- The pattern rule, as a single deterministic function. Qualifying reporters
-- are kid-role accounts that filed a report against the subject or blocked
-- the subject (per the 0095 audit trail) in the last 30 days, are unrelated
-- to the subject (never the subject's own family), and are pairwise
-- unrelated to each other by verified guardian sets (two siblings reporting
-- one account count once, greedily, ordered by first event time). Three
-- qualifying reporters open the case; the upsert makes crossing the
-- threshold again a no-op rather than a duplicate queue entry.
CREATE OR REPLACE FUNCTION public.evaluate_social_pattern(p_subject uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    reporter record;
    qualified int := 0;
    seen_guardians uuid[] := '{}';
    kid_guardians uuid[];
    subject_guardians uuid[];
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
        WHERE EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = events.reporter_id AND ur.role = 'kid')
        GROUP BY events.reporter_id
        ORDER BY first_at ASC
    LOOP
        SELECT array_agg(parent_user_id) INTO kid_guardians
            FROM public.guardian_links
            WHERE kid_user_id = reporter.reporter_id AND verification_status = 'verified';
        IF kid_guardians IS NULL THEN CONTINUE; END IF;
        IF subject_guardians IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(kid_guardians) g WHERE g = ANY(subject_guardians)) THEN
            CONTINUE;
        END IF;
        IF EXISTS (SELECT 1 FROM unnest(kid_guardians) g WHERE g = ANY(seen_guardians)) THEN
            CONTINUE;
        END IF;
        seen_guardians := seen_guardians || kid_guardians;
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
-- The pattern rule is evaluated by the report transaction and the block
-- trigger; nothing may invoke it as a standalone RPC.
REVOKE ALL ON FUNCTION public.evaluate_social_pattern(uuid) FROM PUBLIC, anon, authenticated, service_role;

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
    -- E.3: for a kid-role account's connections, notify the linked guardian.
    -- Notified: verified guardians of (a) a kid-role reporter, (b) a
    -- kid-role subject, and (c) kid-role accounts connected to the subject
    -- through a follow in either direction or a pending/approved connection
    -- request. Guardian rows are deduplicated across the three sources.
    INSERT INTO public.social_safety_notices(guardian_id, kid_user_id, kind, subject_id, report_id)
    SELECT DISTINCT gl.parent_user_id, involved.kid_user_id, 'social.report', p_subject_id, report_id
    FROM (
        SELECT p_reporter_id AS kid_user_id
        WHERE EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = p_reporter_id AND ur.role = 'kid')
        UNION
        SELECT p_subject_id
        WHERE EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = p_subject_id AND ur.role = 'kid')
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
    -- kid-role reporters in 30 days queue the subject for proactive review.
    PERFORM public.evaluate_social_pattern(p_subject_id);
    RETURN report_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_social_report(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_social_report(uuid, uuid, text, text) TO service_role;

-- Block events feed the same pattern trigger (E.3: "reports or blocks").
-- The 0095 audit trigger already records the block this trigger reads, and
-- alphabetical trigger order (audit < pattern) means the current block is
-- visible to the pattern evaluation in the same transaction.
CREATE OR REPLACE FUNCTION public.social_block_pattern_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM public.evaluate_social_pattern(NEW.blocked_id);
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.social_block_pattern_trigger() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER social_block_pattern AFTER INSERT ON public.blocks
FOR EACH ROW EXECUTE FUNCTION public.social_block_pattern_trigger();

-- Staff resolution: closes the case and every open report for the subject,
-- with the decision actor recorded in the audit trail (G.3's standard for
-- staff moderation decisions).
CREATE OR REPLACE FUNCTION public.resolve_social_review_case(p_subject uuid, p_resolved_by uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_subject IS NULL OR p_resolved_by IS NULL THEN
        RAISE EXCEPTION 'INVALID_CASE_RESOLUTION' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.social_review_cases
        SET status = 'resolved', resolved_at = now(), resolved_by = p_resolved_by
        WHERE subject_id = p_subject;
    IF NOT FOUND THEN RETURN false; END IF;
    UPDATE public.social_reports
        SET status = 'resolved', resolved_at = now(), resolved_by = p_resolved_by
        WHERE subject_id = p_subject AND status = 'open';
    INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (p_resolved_by, 'social.case_resolved', p_subject::text,
            jsonb_build_object('origin', 'database-function'));
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_social_review_case(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_social_review_case(uuid, uuid) TO service_role;
