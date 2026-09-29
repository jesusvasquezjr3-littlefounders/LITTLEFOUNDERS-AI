-- @phase: expand
-- C.1 / Appendix F 1.3 Age-Tier Calibration Coverage Rate (GAP-FIX-R3 mentor
-- lane): the share of Mentor sessions started by a learner whose age Core
-- could not place in a teaching tier that had the explicit one-time
-- calibration (mentor_age_calibrations, 0088) BEFORE the session started.
-- A hard invariant at 100%: Core refuses such a session with
-- MENTOR_AGE_CALIBRATION_REQUIRED, and this function is how that promise is
-- measured instead of assumed.
--
-- "Unknown age" mirrors Core's knownMentorAgeTier
-- (backend/src/services/mentorAgeCalibration.ts) as of the session start:
-- the age is KNOWN when a 13_to_17 or adult declaration existed and no
-- under-13 origin marker did, or when a stored birth date put the learner
-- under 13 on that day. Every other session is unknown-age: no stored birth
-- date or age declaration, an under-13 declaration alone, or an origin-marked
-- account without a birth date.
--
-- Counts only; service role only. Additive: a new function.

CREATE OR REPLACE FUNCTION public.mentor_age_calibration_coverage(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (sessions bigint, unknown_age_sessions bigint, calibrated_before_start bigint, coverage numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH window_sessions AS (
        SELECT s.id, s.user_id, s.started_at
          FROM public.tutor_sessions s
         WHERE s.started_at >= p_from
           AND s.started_at < p_to
    ),
    classified AS (
        SELECT w.user_id,
               w.started_at,
               NOT (
                   (
                       EXISTS (
                           SELECT 1 FROM public.account_age_declarations d
                            WHERE d.user_id = w.user_id
                              AND d.created_at <= w.started_at
                              AND d.declared_age_band IN ('13_to_17', 'adult')
                       )
                       AND NOT EXISTS (
                           SELECT 1 FROM public.account_safety_origins o
                            WHERE o.user_id = w.user_id
                              AND o.created_at <= w.started_at
                       )
                   )
                   OR EXISTS (
                       SELECT 1 FROM public.profiles p
                        WHERE p.user_id = w.user_id
                          AND p.birth_date IS NOT NULL
                          AND p.birth_date <= (w.started_at AT TIME ZONE 'UTC')::date
                          AND p.birth_date > ((w.started_at AT TIME ZONE 'UTC')::date - interval '13 years')::date
                   )
               ) AS unknown_age
          FROM window_sessions w
    ),
    unknown AS (
        SELECT c.user_id, c.started_at,
               EXISTS (
                   SELECT 1 FROM public.mentor_age_calibrations m
                    WHERE m.user_id = c.user_id
                      AND m.created_at <= c.started_at
               ) AS calibrated
          FROM classified c
         WHERE c.unknown_age
    )
    SELECT (SELECT count(*) FROM window_sessions),
           (SELECT count(*) FROM unknown),
           (SELECT count(*) FROM unknown WHERE calibrated),
           CASE WHEN (SELECT count(*) FROM unknown) = 0 THEN NULL
                ELSE round((SELECT count(*) FROM unknown WHERE calibrated)::numeric / (SELECT count(*) FROM unknown), 4)
           END;
$$;

REVOKE ALL ON FUNCTION public.mentor_age_calibration_coverage(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mentor_age_calibration_coverage(timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.mentor_age_calibration_coverage(timestamptz, timestamptz) IS
    'C.1 / Appendix F 1.3: Mentor sessions started in [p_from, p_to), those by learners of unknown age, and how many of those had the explicit age calibration before the session started (hard invariant: all of them). Counts only.';
