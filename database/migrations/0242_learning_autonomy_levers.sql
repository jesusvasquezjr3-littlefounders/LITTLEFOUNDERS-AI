-- learning_autonomy_levers — the per-band autonomy mechanisms of the
-- Pedagogical Design Standard, built (GAP-FIX-R5 learning; Product 10 Block B
-- "Age-band registers" autonomy column; B.24; B.23; Appendix C Part 1.2
-- Autonomy Mechanism Adoption Rate).
-- @phase: contract
-- @after-release: none — two nullable/defaulted columns, one trigger that only refuses states no deployed Core writes (an approach chain segment graded or viewed without its pinned approach, a pinned approach changed), one new service-role function, the learning_events CHECK widened with three server-only events, and learning_autonomy_adoption replaced with the same signature and two more rows. The phase classifier counts any CHECK swap as a contraction, so it is declared contract and applied by hand. Apply it BEFORE the Core release that serves approach choices and enrichment lessons: that release reads lessons.optional_enrichment and writes lesson_v2_runs.approach_id and the three events (an older schema answers 502 on the lesson tree and the pin).
--
-- The registers declare an autonomy mechanism per band (young 'topic',
-- transition 'approach', teen 'path-pace', adult 'full'); until now only path,
-- pace and Mentor choice existed, the same for every band. This adds the
-- storage behind the two missing levers:
--
--   * lessons.optional_enrichment — a pathway lesson that is depth or
--     enrichment: served on the course path as optional to teens and adults,
--     never required for progress, badges or OD-25 unlocks (Core leaves it out
--     of every topic's required lessons). Default false: no existing lesson
--     changes.
--   * lesson_v2_runs.approach_id — the approach (one of two or three
--     equally valid, fully graded segment chains a v2 document may declare
--     for the same skill) the learner chose to practise, pinned on the run.
--     It is set once, only to an approach the run's pinned document declares,
--     and never changed; a completed run cannot take one.
--   * guard_v2_approach_chain — a grade receipt or a view receipt for a
--     segment inside an approach chain is refused unless the run pinned that
--     chain (the enforcing boundary behind Core's own check).
--   * pin_v2_run_approach(user, run, approach) — the only writer, service
--     role only; it answers the pinned approach (the existing one when the
--     run already has one, so a replay is idempotent).
--   * learning_events: approach_choice (value 1 = not the suggested approach,
--     as path_choice), enrichment_offer (a course path served enrichment,
--     once per learner, course and day) and enrichment_open (an enrichment
--     lesson was opened). Server-only, consent-gated like path_choice.
--   * learning_autonomy_adoption: two more rows, 'approach' (of the approach
--     choices, the share away from the suggestion) and 'enrichment' (of the
--     learners offered enrichment in the window, the share who opened one).

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS optional_enrichment boolean NOT NULL DEFAULT false;

ALTER TABLE public.lesson_v2_runs ADD COLUMN IF NOT EXISTS approach_id text
    CONSTRAINT lesson_v2_runs_approach_id_check CHECK (approach_id IS NULL OR approach_id ~ '^[a-z0-9][a-z0-9._:-]{2,100}$');

-- The approach ids a pinned document declares, and the one whose chain holds a segment.
CREATE OR REPLACE FUNCTION public.v2_document_approach_ids(p_document jsonb)
RETURNS SETOF text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT o->>'id' FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_document->'approaches'->'options') = 'array' THEN p_document->'approaches'->'options' ELSE '[]'::jsonb END) o
$$;

CREATE OR REPLACE FUNCTION public.v2_segment_approach_id(p_document jsonb, p_segment_id text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT o->>'id' FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_document->'approaches'->'options') = 'array' THEN p_document->'approaches'->'options' ELSE '[]'::jsonb END) o
    WHERE jsonb_typeof(o->'segment_ids') = 'array' AND (o->'segment_ids') ? p_segment_id
    LIMIT 1
$$;

-- Set once, to a declared approach, before completion; never changed afterwards.
CREATE OR REPLACE FUNCTION public.guard_v2_run_approach()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.approach_id IS NOT DISTINCT FROM OLD.approach_id THEN
        RETURN NEW;
    END IF;
    IF OLD.approach_id IS NOT NULL THEN
        RAISE EXCEPTION 'The approach of this run is already chosen' USING ERRCODE = '23514';
    END IF;
    IF OLD.completed_at IS NOT NULL THEN
        RAISE EXCEPTION 'A completed run cannot choose an approach' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.lesson_document_versions v
                   WHERE v.id = NEW.document_version_id AND NEW.approach_id IN (SELECT public.v2_document_approach_ids(v.document))) THEN
        RAISE EXCEPTION 'This lesson offers no such approach' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lesson_v2_runs_approach_guard ON public.lesson_v2_runs;
CREATE TRIGGER lesson_v2_runs_approach_guard
    BEFORE UPDATE OF approach_id ON public.lesson_v2_runs
    FOR EACH ROW EXECUTE FUNCTION public.guard_v2_run_approach();

-- A new run starts without an approach: the learner chooses it (Core pins it through the function below).
CREATE OR REPLACE FUNCTION public.guard_v2_run_approach_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.approach_id IS NOT NULL THEN
        RAISE EXCEPTION 'A run starts without an approach' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lesson_v2_runs_approach_insert_guard ON public.lesson_v2_runs;
CREATE TRIGGER lesson_v2_runs_approach_insert_guard
    BEFORE INSERT ON public.lesson_v2_runs
    FOR EACH ROW EXECUTE FUNCTION public.guard_v2_run_approach_insert();

-- A receipt or view inside an approach chain belongs to the run's pinned chain only.
CREATE OR REPLACE FUNCTION public.guard_v2_approach_chain()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_chain text;
    v_pinned text;
BEGIN
    SELECT public.v2_segment_approach_id(v.document, NEW.segment_id) INTO v_chain
    FROM public.lesson_document_versions v WHERE v.id = NEW.document_version_id;
    IF v_chain IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT r.approach_id INTO v_pinned FROM public.lesson_v2_runs r WHERE r.id = NEW.run_id;
    IF v_pinned IS DISTINCT FROM v_chain THEN
        RAISE EXCEPTION 'This step belongs to an approach the run did not choose' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lesson_v2_grade_receipts_approach_chain ON public.lesson_v2_grade_receipts;
CREATE TRIGGER lesson_v2_grade_receipts_approach_chain
    BEFORE INSERT ON public.lesson_v2_grade_receipts
    FOR EACH ROW EXECUTE FUNCTION public.guard_v2_approach_chain();
DROP TRIGGER IF EXISTS lesson_v2_segment_views_approach_chain ON public.lesson_v2_segment_views;
CREATE TRIGGER lesson_v2_segment_views_approach_chain
    BEFORE INSERT ON public.lesson_v2_segment_views
    FOR EACH ROW EXECUTE FUNCTION public.guard_v2_approach_chain();

-- The one writer. Answers the pinned approach: the requested one, or the one already pinned.
CREATE OR REPLACE FUNCTION public.pin_v2_run_approach(p_user_id uuid, p_run_id uuid, p_approach_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_run public.lesson_v2_runs%ROWTYPE;
BEGIN
    IF p_user_id IS NULL OR p_run_id IS NULL OR p_approach_id IS NULL OR p_approach_id !~ '^[a-z0-9][a-z0-9._:-]{2,100}$' THEN
        RAISE EXCEPTION 'Invalid approach choice' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_run FROM public.lesson_v2_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND OR v_run.user_id <> p_user_id THEN
        RAISE EXCEPTION 'Unknown lesson run' USING ERRCODE = '22023';
    END IF;
    IF v_run.approach_id IS NOT NULL THEN
        RETURN v_run.approach_id;
    END IF;
    UPDATE public.lesson_v2_runs SET approach_id = p_approach_id WHERE id = p_run_id;
    RETURN p_approach_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pin_v2_run_approach(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pin_v2_run_approach(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.v2_document_approach_ids(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v2_segment_approach_id(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_document_approach_ids(jsonb), public.v2_segment_approach_id(jsonb, text) TO service_role;

-- The 0224 list plus the three server-only autonomy events.
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
    'lesson_update_required', 'scorer_parity_miss',
    'parent_signup_completed', 'parent_first_value',
    'approach_choice', 'enrichment_offer', 'enrichment_open'
  ));

-- Appendix C "Autonomy Mechanism Adoption Rate" (B.24), one row per lever:
-- 0134's path, pace and Mentor rows unchanged, plus
--   approach:   of the approach choices made, the share away from the suggested approach;
--   enrichment: of the learners offered enrichment in the window, the share who opened one.
CREATE OR REPLACE FUNCTION public.learning_autonomy_adoption(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (lever text, offered bigint, exercised bigint, adoption_rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH path AS (
        SELECT count(*) AS offered, count(*) FILTER (WHERE value = 1) AS exercised
        FROM public.learning_events
        WHERE event = 'path_choice' AND created_at >= p_since AND created_at < p_until
    ), active AS (
        SELECT DISTINCT user_id FROM public.learning_events
        WHERE event IN ('lesson_complete', 'lesson_start') AND user_id IS NOT NULL
          AND created_at >= p_since AND created_at < p_until
    ), pace AS (
        SELECT count(*) AS offered, count(p.user_id) AS exercised
        FROM active a LEFT JOIN public.learning_pace_preferences p ON p.user_id = a.user_id
    ), mentor AS (
        SELECT count(*) AS offered, count(t.user_id) AS exercised
        FROM active a LEFT JOIN public.tutor_preferences t ON t.user_id = a.user_id
    ), approach AS (
        SELECT count(*) AS offered, count(*) FILTER (WHERE value = 1) AS exercised
        FROM public.learning_events
        WHERE event = 'approach_choice' AND created_at >= p_since AND created_at < p_until
    ), enrichment_offered AS (
        SELECT DISTINCT user_id FROM public.learning_events
        WHERE event = 'enrichment_offer' AND user_id IS NOT NULL AND created_at >= p_since AND created_at < p_until
    ), enrichment AS (
        SELECT count(*) AS offered,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.learning_events e
                   WHERE e.user_id = o.user_id AND e.event = 'enrichment_open' AND e.created_at >= p_since AND e.created_at < p_until)) AS exercised
        FROM enrichment_offered o
    )
    SELECT 'path', offered, exercised, CASE WHEN offered = 0 THEN NULL ELSE round(exercised::numeric / offered, 4) END FROM path
    UNION ALL
    SELECT 'pace', offered, exercised, CASE WHEN offered = 0 THEN NULL ELSE round(exercised::numeric / offered, 4) END FROM pace
    UNION ALL
    SELECT 'mentor', offered, exercised, CASE WHEN offered = 0 THEN NULL ELSE round(exercised::numeric / offered, 4) END FROM mentor
    UNION ALL
    SELECT 'approach', offered, exercised, CASE WHEN offered = 0 THEN NULL ELSE round(exercised::numeric / offered, 4) END FROM approach
    UNION ALL
    SELECT 'enrichment', offered, exercised, CASE WHEN offered = 0 THEN NULL ELSE round(exercised::numeric / offered, 4) END FROM enrichment
$$;

REVOKE ALL ON FUNCTION public.learning_autonomy_adoption(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_autonomy_adoption(timestamptz, timestamptz) TO service_role;
