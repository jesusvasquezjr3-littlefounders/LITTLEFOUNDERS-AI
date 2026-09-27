-- pathway_early_stage_and_mastery_credit — OD-25 (27 September 2026) on the B.6
-- pathway engine: mastery may open one stage early, and Mentor mastery may
-- complete a topic with the learner's consent.
-- @phase: expand
--
-- Two learner records, each written by Core (service role) only after it
-- re-derived the offer from the learner's own pathway, the same computation
-- the lesson gate uses (backend/src/services/pathway/coursePathway.ts):
--
--   course_chapter_early_access   the learner confirmed opening a chapter ONE
--                                 stage above their own (never an adult
--                                 chapter for a minor, never two stages up),
--                                 once every prerequisite skill of the chapter
--                                 was mastered on the shared graph. The chapter
--                                 then plays as optional: never required, never
--                                 in a denominator. Age is re-checked on every
--                                 read, so a corrected birth date closes it
--                                 again without deleting this row (T4, OD-9).
--   course_topic_mastery_credits  the learner accepted counting a topic as done
--                                 on the mastery they showed with the Mentor
--                                 ("You have shown mastery of X; unlock the
--                                 next level?"). Read as a credit: counts toward
--                                 completion and badges, never as played, never
--                                 as XP. The skills and the Mentor's estimates
--                                 it was accepted on are kept as its evidence.
--
-- POSTURE (0123's): Core writes with the service role; no client INSERT,
-- UPDATE or DELETE policy exists. The learner and their verified guardians read
-- the learner's own rows. Rows are never updated or deleted by any Core path;
-- account erasure removes them with the account (ON DELETE CASCADE).
-- Additive only: two new tables.

CREATE TABLE IF NOT EXISTS public.course_chapter_early_access (
    user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id        uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    adventure_id     uuid NOT NULL REFERENCES public.adventures (id) ON DELETE CASCADE,
    -- The chapter's stage when it was opened. Adult chapters never open early.
    pathway_stage    text NOT NULL CHECK (pathway_stage IN ('tween', 'teen')),
    prerequisite_kcs text[] NOT NULL CHECK (cardinality(prerequisite_kcs) BETWEEN 1 AND 200),
    confirmed_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, adventure_id)
);

CREATE INDEX IF NOT EXISTS idx_course_chapter_early_access_course
    ON public.course_chapter_early_access (course_id);

ALTER TABLE public.course_chapter_early_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_chapter_early_access_select_own ON public.course_chapter_early_access;
CREATE POLICY course_chapter_early_access_select_own ON public.course_chapter_early_access
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

COMMENT ON TABLE public.course_chapter_early_access IS
    'OD-25: a learner''s confirmation opening a chapter one stage above their own, once its prerequisite skills were mastered. Core (service role) writes; optional chapter, never counted.';

CREATE TABLE IF NOT EXISTS public.course_topic_mastery_credits (
    user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id   uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    topic_id    uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    kc_keys     text[] NOT NULL CHECK (cardinality(kc_keys) BETWEEN 1 AND 50),
    -- The Mentor's posterior per skill when the learner accepted, as evidence.
    p_known     jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(p_known) = 'object'),
    accepted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_course_topic_mastery_credits_course
    ON public.course_topic_mastery_credits (user_id, course_id);

ALTER TABLE public.course_topic_mastery_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_topic_mastery_credits_select_own ON public.course_topic_mastery_credits;
CREATE POLICY course_topic_mastery_credits_select_own ON public.course_topic_mastery_credits
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

COMMENT ON TABLE public.course_topic_mastery_credits IS
    'OD-25: a learner''s acceptance counting a topic as done on Mentor mastery. Core (service role) writes; read as a credit, never as played or XP.';
