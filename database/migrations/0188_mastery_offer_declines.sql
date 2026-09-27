-- mastery_offer_declines — OD-25 (27 September 2026), W3L.1: the learner's
-- "no" to a Mentor-mastery offer is remembered.
-- @phase: expand
--
-- 0181 stored only the "yes" (course_topic_mastery_credits), so a learner who
-- declined "You have shown mastery of X; unlock the next level?" was asked
-- again on every visit. This table records the decline, written by Core
-- (service role) only after it re-derived the offer from the learner's own
-- pathway (backend/src/services/pathway/coursePathway.ts), the same rule as
-- the acceptance. The first answer is final: a declined topic is never offered
-- again, and the learner completes it by playing its lessons as usual.
--
-- POSTURE (0181's): no client INSERT, UPDATE or DELETE policy exists. The
-- learner and their verified guardians read the learner's own rows. Rows are
-- never updated or deleted by any Core path; account erasure removes them with
-- the account (ON DELETE CASCADE). Additive only: one new table. A Core that
-- cannot read it (not yet applied) treats it as empty: an offer asked again
-- never re-locks shown work.

CREATE TABLE IF NOT EXISTS public.course_topic_mastery_declines (
    user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id   uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    topic_id    uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    kc_keys     text[] NOT NULL CHECK (cardinality(kc_keys) BETWEEN 1 AND 50),
    declined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_course_topic_mastery_declines_course
    ON public.course_topic_mastery_declines (user_id, course_id);

ALTER TABLE public.course_topic_mastery_declines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_topic_mastery_declines_select_own ON public.course_topic_mastery_declines;
CREATE POLICY course_topic_mastery_declines_select_own ON public.course_topic_mastery_declines
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

REVOKE INSERT, UPDATE, DELETE ON public.course_topic_mastery_declines FROM anon, authenticated;

COMMENT ON TABLE public.course_topic_mastery_declines IS
    'OD-25: a learner''s decline of a Mentor-mastery offer. Core (service role) writes after re-deriving the offer; the topic is not offered again.';
