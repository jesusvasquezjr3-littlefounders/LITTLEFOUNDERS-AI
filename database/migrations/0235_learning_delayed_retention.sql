-- learning_delayed_retention — Appendix C 1.1 Delayed Retention Rate, as the
-- SPEC defines it (GAP-FIX-R4 learning).
-- @phase: expand
--
-- Appendix C 1.1: "% of learners answering a spaced-repetition review card
-- correctly 30 / 60 / 90 days after first reaching 'mastered' on a knowledge
-- component", sourced from the Mentor's review cards extended to course-driven
-- KCs (B.6), with the target "establish release-1 baseline per KC, then
-- require no decline release over release".
--
-- The metric used to read admin_retention_at_distance (0016), which measures
-- first tries on legacy v1 review-topic lessons by days since the source
-- topic, never reads memory_card or the mastery date, has no per-KC split and
-- empties once the v1 catalog retires (OD-24). This replaces it as the
-- metric's source; 0016's function is left in place for its admin readers.
--
--   learning_delayed_retention(since, until, mastery)
--       Per KC and per window (30, 60, 90 days): the learners whose first
--       spaced review of that KC's memory card fell in the window, and how
--       many answered it correctly.
--         * mastered_at: the learner's FIRST kc_attempt on the KC whose
--           posterior (p_known_after) reached the mastery bar (default 0.85,
--           mentorQuality.ts masteryPosterior), from any evidence source.
--         * a review result: a later kc_attempt the FSRS scheduler counted as
--           a spaced review of the card (review_tier = 'spaced', 0143), from
--           the Mentor or from a course lesson (source 'course_lesson',
--           0206); a within-session short-horizon re-exposure is not a
--           review. The learner must hold a memory_card for the KC.
--         * the 30-day window is [mastered_at + 30d, mastered_at + 60d), the
--           60-day [60d, 90d), the 90-day [90d, 120d); the first review in the
--           window is the one that counts.
--         * a window is reported in the period its review happened
--           (since <= review < until), so each release reads its own reviews.
--
--   learning_retention_release_baseline
--       One row per release x KC x window, frozen when the release is
--       recorded (record_learning_retention_release). The first recorded
--       release is the release-1 baseline; Core compares each new period
--       against the latest recorded release (no decline beyond a tolerance,
--       mentorQuality.ts). No learner id is stored: counts only.
--
-- Service role only; RLS on the new table with no client policy.

CREATE OR REPLACE FUNCTION public.learning_delayed_retention(
    p_since timestamptz,
    p_until timestamptz,
    p_mastery numeric DEFAULT 0.85
)
RETURNS TABLE (kc_id uuid, kc_key text, window_days integer, learners bigint, correct bigint, correct_share numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH mastered AS (
        SELECT a.user_id, a.kc_id, min(a.created_at) AS mastered_at
        FROM public.kc_attempt AS a
        WHERE a.p_known_after >= p_mastery
        GROUP BY a.user_id, a.kc_id
    ),
    windows AS (
        SELECT d FROM (VALUES (30), (60), (90)) AS w(d)
    ),
    first_review AS (
        SELECT DISTINCT ON (m.user_id, m.kc_id, w.d)
               m.kc_id, w.d AS window_days, r.correct, r.created_at
        FROM mastered AS m
        JOIN public.memory_card AS card ON card.user_id = m.user_id AND card.kc_id = m.kc_id
        CROSS JOIN windows AS w
        JOIN public.kc_attempt AS r
          ON r.user_id = m.user_id AND r.kc_id = m.kc_id
         AND r.review_tier = 'spaced'
         AND r.created_at >= m.mastered_at + make_interval(days => w.d)
         AND r.created_at <  m.mastered_at + make_interval(days => w.d + 30)
        ORDER BY m.user_id, m.kc_id, w.d, r.created_at, r.id
    )
    SELECT f.kc_id, k.key, f.window_days, count(*),
           count(*) FILTER (WHERE f.correct),
           round(count(*) FILTER (WHERE f.correct)::numeric / count(*), 4)
    FROM first_review AS f
    JOIN public.kc AS k ON k.id = f.kc_id
    WHERE f.created_at >= p_since AND f.created_at < p_until
    GROUP BY f.kc_id, k.key, f.window_days
    ORDER BY k.key, f.window_days;
$$;

CREATE TABLE IF NOT EXISTS public.learning_retention_release_baseline (
    release_id   text NOT NULL CHECK (release_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
    kc_id        uuid NOT NULL REFERENCES public.kc (id) ON DELETE CASCADE,
    kc_key       text NOT NULL,
    window_days  integer NOT NULL CHECK (window_days IN (30, 60, 90)),
    learners     integer NOT NULL CHECK (learners > 0),
    correct      integer NOT NULL CHECK (correct >= 0 AND correct <= learners),
    period_start timestamptz NOT NULL,
    period_end   timestamptz NOT NULL CHECK (period_end > period_start),
    recorded_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (release_id, kc_id, window_days)
);

CREATE INDEX IF NOT EXISTS idx_learning_retention_release_recorded
    ON public.learning_retention_release_baseline (recorded_at DESC);

ALTER TABLE public.learning_retention_release_baseline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learning_retention_release_baseline FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.learning_retention_release_baseline TO service_role;

-- Freeze a release's retention. The period runs from the previous recorded
-- release's period end (or p_since when none) to p_until. A release is
-- recorded once: a second call for the same id changes nothing and returns 0.
CREATE OR REPLACE FUNCTION public.record_learning_retention_release(
    p_release_id text,
    p_since timestamptz,
    p_until timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_start timestamptz;
    v_rows integer;
BEGIN
    IF p_release_id IS NULL OR p_release_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' THEN
        RAISE EXCEPTION 'invalid release id' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.learning_retention_release_baseline WHERE release_id = p_release_id) THEN
        RETURN 0;
    END IF;
    SELECT coalesce(max(period_end), p_since) INTO v_start FROM public.learning_retention_release_baseline;
    IF v_start IS NULL OR v_start >= p_until THEN
        RAISE EXCEPTION 'empty retention period' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.learning_retention_release_baseline
        (release_id, kc_id, kc_key, window_days, learners, correct, period_start, period_end)
    SELECT p_release_id, r.kc_id, r.kc_key, r.window_days, r.learners, r.correct, v_start, p_until
    FROM public.learning_delayed_retention(v_start, p_until) AS r;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.learning_delayed_retention(timestamptz, timestamptz, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_learning_retention_release(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_delayed_retention(timestamptz, timestamptz, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_learning_retention_release(text, timestamptz, timestamptz) TO service_role;

-- Time-to-Mastery by age band (Appendix C 1.1 "per KC, segmented by age
-- band"): the band of each learner with evidence since p_since, derived the
-- way the Mentor derives its register (a self-registered 13-17 or adult
-- declaration wins, then the profile birth date, else 'unknown'). Bands only;
-- never a birth date or an age.
CREATE OR REPLACE FUNCTION public.learning_kc_learner_age_bands(p_since timestamptz)
RETURNS TABLE (user_id uuid, age_band text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH learners AS (
        SELECT DISTINCT a.user_id FROM public.kc_attempt AS a WHERE a.created_at >= p_since
    ),
    aged AS (
        SELECT l.user_id, public.effective_age_band(l.user_id) AS declared,
               CASE WHEN p.birth_date IS NULL THEN NULL
                    ELSE extract(year FROM age((now() AT TIME ZONE 'UTC')::date, p.birth_date))::int END AS years
        FROM learners AS l
        LEFT JOIN public.profiles AS p ON p.user_id = l.user_id
    )
    SELECT aged.user_id,
           CASE WHEN declared = 'adult' THEN 'adult'
                WHEN declared = '13_to_17' THEN '13-17'
                WHEN years BETWEEN 6 AND 9 THEN '6-9'
                WHEN years BETWEEN 10 AND 12 THEN '10-12'
                WHEN years BETWEEN 13 AND 17 THEN '13-17'
                WHEN years >= 18 AND years <= 120 THEN 'adult'
                ELSE 'unknown' END
    FROM aged;
$$;

REVOKE ALL ON FUNCTION public.learning_kc_learner_age_bands(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_kc_learner_age_bands(timestamptz) TO service_role;
