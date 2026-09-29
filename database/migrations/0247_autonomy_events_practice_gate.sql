-- autonomy_events_practice_gate — the three autonomy-lever learn events join
-- the OD-9 practice gate (GAP-FIX-R6 data-platform; OD-9 section 4.2; S10.3a;
-- data_practices row analytics.motivation_events; B.24).
-- @phase: expand
--
-- CORRECTION to the 0246 header. 0246 (learning_autonomy_levers) widened the
-- learning_events CHECK with approach_choice, enrichment_offer and
-- enrichment_open and called them "consent-gated like path_choice". They were
-- not: the only OD-9 enforcement on learning_events is the BEFORE INSERT
-- trigger learning_events_data_practice, whose function (last replaced in
-- 0218) maps an event to a data practice and skips the row when the practice
-- does not apply. The three new events had no mapping, so v_practice was NULL
-- and the row landed unconditionally. A migrated child (legacy_consent_subjects)
-- whose Tutor had not given the analytics.motivation_events consent had
-- path_choice dropped but their approach choices and enrichment offers and
-- opens recorded on the legacy consent alone, which section 4.2 forbids.
--
-- This replaces the function with 0218's body plus the three events under
-- analytics.motivation_events (its registry summary already names the
-- autonomy-lever events). database/scripts/check-learning-event-practices.mjs
-- now fails the database gate when a rebuild-era learning_events value has no
-- practice here, so the next new event class cannot slip past the same way.
--
-- Deploy safety: a skipped row is the practice not applying, never an error,
-- exactly as for path_choice since 0187, so no running Core write is refused.
-- Until the OD-9 consent step marks migrated children, every practice applies
-- and nothing changes.

CREATE OR REPLACE FUNCTION public.enforce_learning_event_practice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_practice text := CASE
        WHEN NEW.event IN ('replay_below_best', 'replay_notice_view', 'placement_commit_ok', 'placement_commit_failed',
                           'prerequisite_refused', 'prerequisite_passed', 'lesson_update_required', 'scorer_parity_miss')
            THEN 'analytics.learning_quality_events'
        WHEN NEW.event IN ('streak_rest_day', 'streak_restart', 'path_choice',
                           'approach_choice', 'enrichment_offer', 'enrichment_open')
            THEN 'analytics.motivation_events'
        WHEN NEW.event = 'session_heartbeat' THEN 'analytics.engagement_heartbeats'
    END;
BEGIN
    IF v_practice IS NOT NULL AND NEW.user_id IS NOT NULL AND NOT public.data_practice_applies(NEW.user_id, v_practice) THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_learning_event_practice() FROM PUBLIC, anon, authenticated;

-- The registry summary names every event class the practice covers.
UPDATE public.data_practices
   SET summary = 'Streak, rest-day, path-choice, approach-choice and enrichment events recorded per learner (Appendix C motivation metrics).'
 WHERE key = 'analytics.motivation_events';
