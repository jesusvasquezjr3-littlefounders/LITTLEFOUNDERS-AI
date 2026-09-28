-- social_pattern_metric_age_based — the Appendix J Repeated-Contact Pattern
-- Escalation Rate reads the same E.3 rule the trigger enforces.
-- @phase: expand
--
-- social_protection_metrics (F1-data-platform) added
-- public.social_pattern_qualifies(p_subject): a read-only copy of the E.3
-- pattern rule, so the metric can compare the subjects that meet the rule
-- with the cases staff actually received. It copied the 0108 rule (kid-role
-- reporters with a verified guardian only). social_pattern_age_based
-- (F1-social, OD-3, D-19) then changed the enforced rule in
-- evaluate_social_pattern to count minors by age tier. Left alone, the metric
-- would measure the old rule and report self-registered teens' patterns as
-- neither qualifying nor missed.
--
-- This redefinition mirrors evaluate_social_pattern from
-- social_pattern_age_based exactly, minus the case upsert: same event sources
-- (reports, plus blocks read from the 0095 audit trail), 30-day window,
-- threshold of 3, first-event ordering, minor tiers ('guardian', 'teen'),
-- guardian-set exclusion for linked reporters and the verified-link exclusion
-- for guardian-less reporters. Same signature, STABLE, SECURITY DEFINER,
-- empty search_path and grants (no role may call it directly).

CREATE OR REPLACE FUNCTION public.social_pattern_qualifies(p_subject uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
        reporter_tier := public.social_tier(reporter.reporter_id);
        IF reporter_tier IS NULL OR reporter_tier NOT IN ('guardian', 'teen') THEN
            CONTINUE;
        END IF;
        SELECT array_agg(parent_user_id) INTO reporter_guardians
            FROM public.guardian_links
            WHERE kid_user_id = reporter.reporter_id AND verification_status = 'verified';
        IF reporter_guardians IS NULL THEN
            IF EXISTS (SELECT 1 FROM public.guardian_links gl
                WHERE gl.verification_status = 'verified'
                  AND ((gl.parent_user_id = p_subject AND gl.kid_user_id = reporter.reporter_id)
                    OR (gl.parent_user_id = reporter.reporter_id AND gl.kid_user_id = p_subject))) THEN
                CONTINUE;
            END IF;
        ELSE
            IF p_subject = ANY(reporter_guardians) THEN CONTINUE; END IF;
            IF subject_guardians IS NOT NULL AND EXISTS (
                SELECT 1 FROM unnest(reporter_guardians) g WHERE g = ANY(subject_guardians)) THEN
                CONTINUE;
            END IF;
            IF EXISTS (SELECT 1 FROM unnest(reporter_guardians) g WHERE g = ANY(seen_guardians)) THEN
                CONTINUE;
            END IF;
            seen_guardians := seen_guardians || reporter_guardians;
        END IF;
        qualified := qualified + 1;
        IF qualified >= 3 THEN RETURN true; END IF;
    END LOOP;
    RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.social_pattern_qualifies(uuid) FROM PUBLIC, anon, authenticated, service_role;
