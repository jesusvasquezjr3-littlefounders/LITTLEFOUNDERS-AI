-- course_lesson_kc_evidence — graded course lessons update the Mentor's
-- mastery and review cards (GAP-FIX-R1 learning; owner review P-09 approved:
-- "yes, for the topic's primary skill only, as a new course_lesson evidence
-- source"; B.6 "same mastery model and review cards").
-- @phase: expand
--
-- kc_attempt.source (0052) accepted only the Mentor's own evidence
-- ('segment_grade', 'voice_check'). Core now also records one row per graded
-- course-lesson receipt for the topic's primary knowledge component, through
-- the same recordAttempt path (BKT update, FSRS review, evidence row).
--
-- receipt_key makes that evidence idempotent per grade receipt: a v2 grade is
-- keyed by its one-use attempt nonce, a v1 completion by its run. The partial
-- unique index refuses a second row for the same receipt; Core checks the key
-- before it updates the posterior, so a replayed receipt never moves mastery
-- twice. Existing rows keep receipt_key NULL. RLS and grants are unchanged
-- (service-role writes, self/guardian reads, 0052).

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'kc_attempt_source_check' AND conrelid = 'public.kc_attempt'::regclass
    ) THEN
        ALTER TABLE public.kc_attempt DROP CONSTRAINT kc_attempt_source_check;
    END IF;
    ALTER TABLE public.kc_attempt
        ADD CONSTRAINT kc_attempt_source_check CHECK (source IN ('segment_grade', 'voice_check', 'course_lesson'));
END $$;

ALTER TABLE public.kc_attempt
    ADD COLUMN IF NOT EXISTS receipt_key text NULL
        CHECK (receipt_key IS NULL OR receipt_key ~ '^(v1|v2):[A-Za-z0-9_:.-]{8,200}$');

CREATE UNIQUE INDEX IF NOT EXISTS uq_kc_attempt_receipt
    ON public.kc_attempt (user_id, receipt_key)
    WHERE receipt_key IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'kc_attempt_course_lesson_receipt' AND conrelid = 'public.kc_attempt'::regclass
    ) THEN
        -- Course-lesson evidence always names the receipt it came from.
        ALTER TABLE public.kc_attempt
            ADD CONSTRAINT kc_attempt_course_lesson_receipt CHECK (source <> 'course_lesson' OR receipt_key IS NOT NULL);
    END IF;
END $$;
