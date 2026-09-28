-- @phase: expand
-- trajectory_discounted_evidence — C.10 and Appendix D §2.6: the parent-facing
-- explanation layer exposes the evidence, not just the conclusion.
--
-- tutor_trajectory_step (0066, 0138) records each consequential controller
-- decision with the consecutive qualifying observations it rested on. The
-- parent-facing view (GET /tutor/kids/:kidUserId/mastery) also says whether a
-- correct answer was SET ASIDE on the way: too fast to have been read (a
-- surprising correct), or given with the hint ladder's help. Oracle's
-- controller already applies both rules; this column records the outcome.
--
--   evidence_discounted  'none' | 'too_fast' | 'hint_assisted' |
--                        'too_fast_and_hint_assisted'; NULL on every step
--                        with no evidence (it travels with evidence_rule).
--
-- Additive: a nullable column and a closed CHECK. The OD-9 consent trigger
-- (tutor_trajectory_step_data_practice, 0187) clears the evidence columns
-- when the analytics.mentor_integrity_evidence practice does not apply; it
-- predates this column, so a second BEFORE INSERT trigger, named to fire after
-- it (triggers fire in name order), clears evidence_discounted whenever the
-- evidence itself is absent. The CHECK is evaluated after both triggers.

ALTER TABLE public.tutor_trajectory_step
    ADD COLUMN IF NOT EXISTS evidence_discounted text NULL
        CHECK (evidence_discounted IS NULL
               OR evidence_discounted IN ('none', 'too_fast', 'hint_assisted', 'too_fast_and_hint_assisted'));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tutor_trajectory_step_discounted_with_evidence'
    ) THEN
        ALTER TABLE public.tutor_trajectory_step
            ADD CONSTRAINT tutor_trajectory_step_discounted_with_evidence
            CHECK (evidence_discounted IS NULL OR evidence_rule IS NOT NULL);
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trajectory_discounted_follows_evidence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.evidence_rule IS NULL THEN
        NEW.evidence_discounted := NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.trajectory_discounted_follows_evidence() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tutor_trajectory_step_zz_discounted ON public.tutor_trajectory_step;
CREATE TRIGGER tutor_trajectory_step_zz_discounted BEFORE INSERT OR UPDATE ON public.tutor_trajectory_step
    FOR EACH ROW EXECUTE FUNCTION public.trajectory_discounted_follows_evidence();

-- The guardian evidence read: one learner's latest consequential decisions.
CREATE INDEX IF NOT EXISTS idx_tutor_trajectory_step_user_evidence
    ON public.tutor_trajectory_step (user_id, created_at DESC)
    WHERE evidence_rule IS NOT NULL OR mastery_revoked;

SELECT 'migration_trajectory_discounted_evidence_ok' AS sentinel;
