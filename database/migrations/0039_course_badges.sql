-- 0039_course_badges.sql — course identity and completed-course badges.
-- Every planned course declares its own badge in the Forge catalog. The
-- database keeps the public asset path with the course so clients do not need
-- a second course-to-art mapping.

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS badge_asset text;

UPDATE public.courses
SET badge_asset = CASE slug
    WHEN 'first-lemonade-stand' THEN 'course-badges/first-lemonade-stand.png'
    WHEN 'financial-education' THEN 'course-badges/financial-education.png'
    WHEN 'entrepreneurship' THEN 'course-badges/entrepreneurship.png'
    WHEN 'investing' THEN 'course-badges/investing.png'
    ELSE badge_asset
END
WHERE badge_asset IS NULL;

DO $$
BEGIN
    ALTER TABLE public.courses
        ADD CONSTRAINT courses_badge_asset_format_check
        CHECK (badge_asset IS NULL OR badge_asset ~ '^course-badges/[a-z0-9-]+[.]png$')
        NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.courses
        ADD CONSTRAINT courses_published_badge_required_check
        CHECK (status <> 'published' OR badge_asset IS NOT NULL)
        NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
        MAX(lp.completed_at) AS completed_at
    FROM public.courses c
    JOIN public.adventures a ON a.course_id = c.id
    JOIN public.sagas s ON s.adventure_id = a.id
    JOIN public.topics t ON t.saga_id = s.id
    JOIN public.lessons l ON l.topic_id = t.id
    LEFT JOIN public.lesson_progress lp
        ON lp.lesson_id = l.id
       AND lp.user_id = p_user_id
       AND lp.passed = true
    WHERE c.status = 'published'
      AND c.badge_asset IS NOT NULL
      AND l.status <> 'archived'
    GROUP BY c.id, c.slug, c.title, c.badge_asset, c.position
    HAVING COUNT(DISTINCT l.id) > 0
       AND COUNT(DISTINCT lp.lesson_id) = COUNT(DISTINCT l.id)
    ORDER BY MAX(lp.completed_at) DESC NULLS LAST, c.position ASC, c.id ASC;
$$;

REVOKE ALL ON FUNCTION public.get_completed_course_badges(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_course_badges(uuid) TO service_role;
