-- 0008_course_sequence.sql — the course sequence: widen the age-tier taxonomy
-- to tier3 and add course-level prerequisite edges (COURSE_ENGINE.md §3.1b).
-- Delta over 0001-0007 (never edit an applied migration). Idempotent.

-- ─────────────────────────────────────────────────────────────
-- adventures.age_tier: widen tier1|tier2 → tier1|tier2|tier3. 0007 only
-- anticipated tier1/tier2; COURSE_ENGINE §3.1b introduces tier3 (10-12yo,
-- concrete-operational→formal transition) for the Inversiones course.
-- The 0007 column CHECK was unnamed, so Postgres auto-named it
-- `adventures_age_tier_check` — drop it (idempotent via IF EXISTS) and
-- re-add widened, wrapped in the same DO-block pattern 0007 uses for
-- constraint churn (courses_subject_check).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.adventures DROP CONSTRAINT IF EXISTS adventures_age_tier_check;
DO $$
BEGIN
    ALTER TABLE public.adventures
        ADD CONSTRAINT adventures_age_tier_check
        CHECK (age_tier IN ('tier1', 'tier2', 'tier3'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- courses.requires — the course-level prerequisite edge (COURSE_ENGINE.md
-- §3.1b, catalog.yaml `course.requires`): a jsonb array of prerequisite
-- course slugs, e.g. ["financial-education"]. Powers future placement/unlock
-- across courses; topic-level `prerequisites` (§3.2) stay within-course.
-- Empty by default — no course requires anything until seeded.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS requires jsonb NOT NULL DEFAULT '[]'::jsonb;
