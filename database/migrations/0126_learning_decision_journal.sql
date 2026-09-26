-- @phase: expand
-- B.9 (S05.3c): the course engine's narrative layer, the decision journal.
-- Record: docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md. Its B.13 companion,
-- *_learning_family_bridge.sql, follows it. (The two were one file until the
-- Railway runner test showed the combined payload exceeds the 32,767-character
-- Windows command-line limit of the base64 transport.)
--
--   learner_decision_journal       One row per meaningful in-story
--   learner_decision_resurfacings  decision point a learner answered (a
--                                  story_branch node that offered two or more
--                                  choices, a dialogue_choice turn, a
--                                  would_you_rather pair). Core records the
--                                  choice from the graded answer it already
--                                  validated, never from a client claim, and
--                                  resurfaces it in a later, relevant lesson.
--                                  The first and the latest choice are both
--                                  kept, so "you changed your mind" is part of
--                                  the story. This is the learner's own record:
--                                  only the learner can read it. The guardian's
--                                  B.10 narrative counts decisions, never shows
--                                  them (the parent asks; the child tells).
--
-- POSTURE: the function is SECURITY DEFINER and executable by service_role
-- only. No client policy writes either table.

-- ─────────────────────────────────────────────────────────────
-- learner_decision_journal (B.9)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learner_decision_journal (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id          uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    topic_id           uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    lesson_id          uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
    segment_id         text NOT NULL CHECK (char_length(segment_id) BETWEEN 1 AND 101),
    decision_point     text NOT NULL CHECK (char_length(decision_point) BETWEEN 1 AND 101),
    segment_type       text NOT NULL CHECK (segment_type IN ('story_branch', 'dialogue_choice', 'would_you_rather')),
    locale             text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    situation_text     text NOT NULL CHECK (char_length(situation_text) BETWEEN 1 AND 280),
    first_choice_id    text NOT NULL CHECK (char_length(first_choice_id) BETWEEN 1 AND 101),
    first_choice_text  text NOT NULL CHECK (char_length(first_choice_text) BETWEEN 1 AND 280),
    choice_id          text NOT NULL CHECK (char_length(choice_id) BETWEEN 1 AND 101),
    choice_text        text NOT NULL CHECK (char_length(choice_text) BETWEEN 1 AND 280),
    outcome_text       text NULL CHECK (outcome_text IS NULL OR char_length(outcome_text) BETWEEN 1 AND 280),
    times_decided      integer NOT NULL DEFAULT 1 CHECK (times_decided >= 1),
    first_recorded_at  timestamptz NOT NULL DEFAULT now(),
    recorded_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT learner_decision_journal_point_unique UNIQUE (user_id, lesson_id, segment_id, decision_point)
);

CREATE INDEX IF NOT EXISTS idx_learner_decision_journal_user_course
    ON public.learner_decision_journal (user_id, course_id, recorded_at DESC);

ALTER TABLE public.learner_decision_journal ENABLE ROW LEVEL SECURITY;

-- The learner's own story. Deliberately no guardian read (see header).
DROP POLICY IF EXISTS learner_decision_journal_select_own ON public.learner_decision_journal;
CREATE POLICY learner_decision_journal_select_own ON public.learner_decision_journal
    FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.learner_decision_resurfacings (
    entry_id       uuid NOT NULL REFERENCES public.learner_decision_journal (id) ON DELETE CASCADE,
    lesson_id      uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
    user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    resurfaced_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (entry_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_decision_resurfacings_user
    ON public.learner_decision_resurfacings (user_id, resurfaced_at DESC);

ALTER TABLE public.learner_decision_resurfacings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learner_decision_resurfacings_select_own ON public.learner_decision_resurfacings;
CREATE POLICY learner_decision_resurfacings_select_own ON public.learner_decision_resurfacings
    FOR SELECT USING (user_id = auth.uid());

-- Upserts the decision points of one graded answer. The first choice is kept
-- forever; the latest choice, its outcome and the count move on each graded
-- submission. The lesson must belong to the topic and the topic to the course,
-- so a Core defect cannot file a decision under another course's story.
CREATE OR REPLACE FUNCTION public.record_learner_decisions(
    p_user_id   uuid,
    p_course_id uuid,
    p_topic_id  uuid,
    p_lesson_id uuid,
    p_locale    text,
    p_decisions jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    IF p_decisions IS NULL OR jsonb_typeof(p_decisions) <> 'array'
       OR jsonb_array_length(p_decisions) = 0 OR jsonb_array_length(p_decisions) > 12 THEN
        RAISE EXCEPTION 'record_learner_decisions: 1 to 12 decisions required' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM public.lessons l
        JOIN public.topics t ON t.id = l.topic_id
        JOIN public.sagas s ON s.id = t.saga_id
        JOIN public.adventures a ON a.id = s.adventure_id
        WHERE l.id = p_lesson_id AND t.id = p_topic_id AND a.course_id = p_course_id
    ) THEN
        RAISE EXCEPTION 'record_learner_decisions: lesson is not in that topic and course' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.learner_decision_journal AS j (
        user_id, course_id, topic_id, lesson_id, segment_id, decision_point, segment_type, locale,
        situation_text, first_choice_id, first_choice_text, choice_id, choice_text, outcome_text
    )
    SELECT p_user_id, p_course_id, p_topic_id, p_lesson_id, d.segment_id, d.decision_point, d.segment_type, p_locale,
           d.situation_text, d.choice_id, d.choice_text, d.choice_id, d.choice_text, d.outcome_text
    FROM jsonb_to_recordset(p_decisions) AS d(
        segment_id text, decision_point text, segment_type text,
        situation_text text, choice_id text, choice_text text, outcome_text text
    )
    ON CONFLICT (user_id, lesson_id, segment_id, decision_point) DO UPDATE SET
        segment_type   = EXCLUDED.segment_type,
        locale         = EXCLUDED.locale,
        situation_text = EXCLUDED.situation_text,
        choice_id      = EXCLUDED.choice_id,
        choice_text    = EXCLUDED.choice_text,
        outcome_text   = EXCLUDED.outcome_text,
        times_decided  = j.times_decided + 1,
        recorded_at    = now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_learner_decisions(uuid, uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_learner_decisions(uuid, uuid, uuid, uuid, text, jsonb) TO service_role;
