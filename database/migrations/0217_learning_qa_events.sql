-- learning_qa_events — Appendix C Part 1.3 QA metrics for B.1, B.2, B.4 and
-- the defect escape rate, plus the Appendix P Part 8 scorer-parity misses
-- (GAP-FIX-R2 learning).
-- @phase: contract
-- @after-release: none; the event CHECK is re-added WIDER (every existing event value stays valid, and no running Core emits the six new ones until this lane's release). The classifier treats any CHECK replacement as a contraction, so it is declared contract and applied by hand, BEFORE the Core release that records them: an older CHECK would reject the whole batch the new Core sends.
--
-- Six server-only learn events, written by Core (the client ingest drops
-- them) through the existing consent gate, and mapped to the existing
-- analytics.learning_quality_events practice (0187):
--   placement_commit_ok      a placement persisted (segment_id = its method:
--                            adaptive_quiz, learner_chose_start, learner_adjusted);
--   placement_commit_failed  the placement write failed (segment_id = write_failed
--                            or already_complete);
--   prerequisite_refused     a course entry refused with COURSE_PREREQUISITE_REQUIRED;
--   prerequisite_passed      a course entry with declared prerequisites opened;
--   lesson_update_required   Core blocked a completion the document format could
--                            not earn and asked for a client update (B.4);
--   scorer_parity_miss       the browser scorer read as valid an answer Core refused.
-- learning_qa_rates(p_since, p_until) reports the rates for the staff panel.
--
-- content_defect_escapes records a pedagogical or psychological-design defect
-- found in already-released content, the lesson and the Forge gate that should
-- have caught it (Appendix C 1.3 "Defect Escape Rate": the question is always
-- why the gate did not catch it). Staff write it through Core
-- (record_content_defect_escape, service role, audited); no free text: the
-- gate is a forge_release_gates id and the kind a closed list. RLS on, no
-- policy: only Core's service role reads and writes it.

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_event_check;
ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_event_check CHECK (event IN (
    'session_start', 'session_heartbeat', 'session_end', 'nav_view',
    'page_view', 'cta_click', 'scroll_depth',
    'signup_start', 'signup_submit', 'signup_complete', 'login_complete',
    'course_open', 'lesson_start', 'lesson_complete', 'first_lesson_complete',
    'lesson_abandon', 'segment_view', 'segment_submit', 'segment_retry',
    'hint_open', 'explanation_view', 'audio_replay', 'results_view',
    'task_view', 'profile_edit', 'avatar_edit', 'tutor_open',
    'streak_extend', 'territory_view', 'consent_grant', 'consent_revoke',
    'parent_report_viewed', 'badge_generated', 'badge_shared', 'badge_link_click',
    'replay_below_best', 'replay_notice_view',
    'streak_rest_day', 'streak_restart', 'path_choice',
    'placement_commit_ok', 'placement_commit_failed', 'prerequisite_refused', 'prerequisite_passed',
    'lesson_update_required', 'scorer_parity_miss'
  ));

-- The 0187 practice gate, with the six QA events under the learning-quality practice.
CREATE OR REPLACE FUNCTION public.enforce_learning_event_practice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_practice text := CASE
        WHEN NEW.event IN ('replay_below_best', 'replay_notice_view', 'placement_commit_ok', 'placement_commit_failed',
                           'prerequisite_refused', 'prerequisite_passed', 'lesson_update_required', 'scorer_parity_miss')
            THEN 'analytics.learning_quality_events'
        WHEN NEW.event IN ('streak_rest_day', 'streak_restart', 'path_choice') THEN 'analytics.motivation_events'
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

-- Appendix C 1.3: the B.1, B.2 and B.4 QA rates and the scorer-parity misses.
CREATE OR REPLACE FUNCTION public.learning_qa_rates(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (event text, detail text, events bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT event, coalesce(segment_id, ''), count(*)
    FROM public.learning_events
    WHERE created_at >= p_since AND created_at < p_until
      AND event IN ('placement_commit_ok', 'placement_commit_failed', 'prerequisite_refused', 'prerequisite_passed',
                    'lesson_update_required', 'scorer_parity_miss')
    GROUP BY 1, 2
    ORDER BY 1, 2;
$$;
REVOKE ALL ON FUNCTION public.learning_qa_rates(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_qa_rates(timestamptz, timestamptz) TO service_role;

CREATE TABLE IF NOT EXISTS public.content_defect_escapes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id    uuid NOT NULL,
    gate_id      text NOT NULL REFERENCES public.forge_release_gates (gate_id),
    defect_kind  text NOT NULL CHECK (defect_kind IN ('pedagogical', 'psychological', 'factual', 'regional', 'copy')),
    reported_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    reported_at  timestamptz NOT NULL DEFAULT now()
);
-- No FK on lesson_id: lessons are replaced by the new catalog (OD-24) and the escape record must outlive them.
ALTER TABLE public.content_defect_escapes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_defect_escapes FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS content_defect_escapes_reported_at ON public.content_defect_escapes (reported_at DESC);

CREATE OR REPLACE FUNCTION public.record_content_defect_escape(p_lesson_id uuid, p_gate_id text, p_defect_kind text, p_actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id uuid;
BEGIN
    IF p_lesson_id IS NULL OR p_gate_id IS NULL OR p_actor IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.forge_release_gates WHERE gate_id = p_gate_id) THEN
        RAISE EXCEPTION 'Invalid defect escape' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.content_defect_escapes (lesson_id, gate_id, defect_kind, reported_by)
    VALUES (p_lesson_id, p_gate_id, p_defect_kind, p_actor)
    RETURNING id INTO v_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'admin.content.defect_escape', p_lesson_id::text, jsonb_build_object('gate_id', p_gate_id, 'defect_kind', p_defect_kind, 'escape_id', v_id));
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_content_defect_escape(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_content_defect_escape(uuid, text, text, uuid) TO service_role;

-- Defect escapes per gate in the window, beside the v2 versions published in
-- the same window (the rate's denominator: Forge-gated content released).
CREATE OR REPLACE FUNCTION public.content_defect_escape_rate(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (gate_id text, escapes bigint, published_versions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH published AS (
        SELECT count(*) AS n FROM public.lesson_document_versions WHERE created_at >= p_since AND created_at < p_until
    )
    SELECT e.gate_id, count(*), (SELECT n FROM published)
    FROM public.content_defect_escapes e
    WHERE e.reported_at >= p_since AND e.reported_at < p_until
    GROUP BY e.gate_id
    UNION ALL
    SELECT NULL, 0, (SELECT n FROM published)
    WHERE NOT EXISTS (SELECT 1 FROM public.content_defect_escapes e WHERE e.reported_at >= p_since AND e.reported_at < p_until)
    ORDER BY 2 DESC;
$$;
REVOKE ALL ON FUNCTION public.content_defect_escape_rate(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_defect_escape_rate(timestamptz, timestamptz) TO service_role;
