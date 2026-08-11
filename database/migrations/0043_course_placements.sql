-- 0043_course_placements.sql — the placement quiz result and its skip-ahead
-- credit ledger (COURSE_ENGINE.md §3.2, guest accounts + onboarding +
-- placement feature). Mandatory, per-course, gates a course's first lesson
-- (backend/src/routes/learn.ts's PLACEMENT_REQUIRED check).
--
-- course_placements — one row per (user, course): the quiz result. Service-
-- role-only (Core computes and writes it; no client INSERT/UPDATE), same
-- posture as generation telemetry (0017) and picture/speech caches (0014/
-- 0015). quiz_answers is an audit trail, never re-derived from.
--
-- placement_credits — one row per (user, lesson) the learner was placed
-- PAST. Deliberately its OWN table, never a synthetic lesson_progress row:
-- a placement credit must stay distinguishable from a genuinely played and
-- passed lesson everywhere (no fabricated XP, no fabricated attempt count).
-- It DOES count toward course-completion badges (get_completed_course_badges
-- below) and the public progress bar, by explicit product decision — a
-- learner is never asked to re-prove mastery the placement quiz already
-- established.

CREATE TABLE IF NOT EXISTS public.course_placements (
    user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    course_id        uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    claimed_level    text NOT NULL CHECK (claimed_level IN ('new', 'some', 'confident')),
    education_level  text NOT NULL CHECK (education_level IN
                         ('preschool', 'elementary', 'middle', 'high', 'adult')),
    quiz_answers     jsonb NOT NULL DEFAULT '[]'::jsonb,
    start_topic_id   uuid REFERENCES public.topics (id),
    start_lesson_id  uuid REFERENCES public.lessons (id),
    method           text NOT NULL CHECK (method IN
                         ('quiz', 'claimed_beginner_shortcut', 'no_probe_content_fallback')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, course_id)
);

ALTER TABLE public.course_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_placements_select_own ON public.course_placements;
CREATE POLICY course_placements_select_own ON public.course_placements
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

CREATE TABLE IF NOT EXISTS public.placement_credits (
    user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    lesson_id   uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
    topic_id    uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    course_id   uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_placement_credits_user_course
    ON public.placement_credits (user_id, course_id);

ALTER TABLE public.placement_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS placement_credits_select_own ON public.placement_credits;
CREATE POLICY placement_credits_select_own ON public.placement_credits
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- Extends 0039's function (already applied — immutable, so this is a
-- forward-only CREATE OR REPLACE, same mechanism 0039 itself already uses)
-- so a lesson counts toward course-badge completion if it was EITHER really
-- passed OR placement-credited. Verified against 0039's actual body before
-- editing — only the two placement_credits references and the coalesce are
-- new, the join structure and every existing predicate are untouched.
CREATE OR REPLACE FUNCTION public.get_completed_course_badges(
    p_user_id uuid
)
RETURNS TABLE (
    course_slug text,
    course_title jsonb,
    badge_asset text,
    completed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        c.slug,
        c.title,
        c.badge_asset,
        MAX(COALESCE(lp.completed_at, pc.created_at)) AS completed_at
    FROM public.courses c
    JOIN public.adventures a ON a.course_id = c.id
    JOIN public.sagas s ON s.adventure_id = a.id
    JOIN public.topics t ON t.saga_id = s.id
    JOIN public.lessons l ON l.topic_id = t.id
    LEFT JOIN public.lesson_progress lp
        ON lp.lesson_id = l.id
       AND lp.user_id = p_user_id
       AND lp.passed = true
    LEFT JOIN public.placement_credits pc
        ON pc.lesson_id = l.id
       AND pc.user_id = p_user_id
    WHERE c.status = 'published'
      AND c.badge_asset IS NOT NULL
      AND l.status <> 'archived'
    GROUP BY c.id, c.slug, c.title, c.badge_asset, c.position
    HAVING COUNT(DISTINCT l.id) > 0
       AND COUNT(DISTINCT COALESCE(lp.lesson_id, pc.lesson_id)) = COUNT(DISTINCT l.id)
    ORDER BY MAX(COALESCE(lp.completed_at, pc.created_at)) DESC NULLS LAST, c.position ASC, c.id ASC;
$$;

REVOKE ALL ON FUNCTION public.get_completed_course_badges(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_course_badges(uuid) TO service_role;
