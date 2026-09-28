-- mentor_tell_budget_self_naming_counts — gap-fix round 1 (Mentor lane).
-- @phase: expand
--
-- Three per-session counts the Mentor runtime (Oracle) now keeps, written at
-- close on the existing C.17 record (tutor_dialogue_calibration, 0143). Labels
-- and numbers only, never the learner's words.
--
--   tell_delivered / tell_withdrawn (C.13 non-negotiable, C.24 signal
--     rubric.tell_honored): the Mentor turns that carried the "just tell me"
--     rung after an explicit request, and the requests whose answer turn the
--     learner cut off or a safety response replaced. The rules scorer reads
--     tell_requests - tell_withdrawn - tell_delivered as the misses of a hard
--     invariant (target 0).
--   budget_caught / budget_delivered (OD-13; Frontend Bible 06 role
--     `mentor`, 08 §2 layer 3): Mentor turns over the Copy Budget on the
--     first attempt, and those delivered anyway after the one retry (the M-13
--     "deliver, count and flag" pattern).
--   self_naming_caught / self_naming_delivered (OD-6 glossary): turns where
--     the Mentor called itself a tutor, bot or assistant.
--
-- Nullable: a row written by an Oracle that predates these counts stays NULL
-- (the scorer treats that as "not measured", never as a pass). Additive only.

ALTER TABLE public.tutor_dialogue_calibration
    ADD COLUMN IF NOT EXISTS tell_delivered        integer NULL CHECK (tell_delivered BETWEEN 0 AND 10000),
    ADD COLUMN IF NOT EXISTS tell_withdrawn        integer NULL CHECK (tell_withdrawn BETWEEN 0 AND 10000),
    ADD COLUMN IF NOT EXISTS budget_caught         integer NULL CHECK (budget_caught BETWEEN 0 AND 10000),
    ADD COLUMN IF NOT EXISTS budget_delivered      integer NULL CHECK (budget_delivered BETWEEN 0 AND 10000),
    ADD COLUMN IF NOT EXISTS self_naming_caught    integer NULL CHECK (self_naming_caught BETWEEN 0 AND 10000),
    ADD COLUMN IF NOT EXISTS self_naming_delivered integer NULL CHECK (self_naming_delivered BETWEEN 0 AND 10000);

-- A tell answer (or withdrawal) always follows a tell request.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tutor_dialogue_calibration_tell_answers'
          AND conrelid = 'public.tutor_dialogue_calibration'::regclass
    ) THEN
        ALTER TABLE public.tutor_dialogue_calibration
            ADD CONSTRAINT tutor_dialogue_calibration_tell_answers
            CHECK (coalesce(tell_delivered, 0) + coalesce(tell_withdrawn, 0) <= tell_requests);
    END IF;
END $$;

COMMENT ON COLUMN public.tutor_dialogue_calibration.tell_delivered IS
    'C.13/C.24: Mentor turns that carried the tell rung after an explicit "just tell me" (NULL before gap-fix round 1).';
COMMENT ON COLUMN public.tutor_dialogue_calibration.budget_delivered IS
    'OD-13: Mentor turns over the Copy Budget delivered after the one retry (counted, never hidden).';
COMMENT ON COLUMN public.tutor_dialogue_calibration.self_naming_delivered IS
    'OD-6: Mentor turns that called the Mentor a tutor, bot or assistant, delivered after the one retry.';
