-- 0044_tier4_age_check.sql — widen the age-tier taxonomy to tier4
-- (COURSE_ENGINE.md §3.1b addendum, WALKTHROUGH 2026-08-12): Emprendimiento
-- and Inversiones pivot from tier1-3 (6-12) to a single tier4 (12-18)
-- audience with matured language/analogies and fewer, longer lessons.
-- Delta over 0008/0007 (never edit an applied migration). Idempotent.

-- ─────────────────────────────────────────────────────────────
-- adventures.age_tier: widen tier1|tier2|tier3 → tier1|tier2|tier3|tier4.
-- Same DO-block pattern 0008 used to add tier3.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.adventures DROP CONSTRAINT IF EXISTS adventures_age_tier_check;
DO $$
BEGIN
    ALTER TABLE public.adventures
        ADD CONSTRAINT adventures_age_tier_check
        CHECK (age_tier IN ('tier1', 'tier2', 'tier3', 'tier4'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
