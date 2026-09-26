-- @phase: expand
-- B.12 (S05.3d): Law 4 inside the v2 grading architecture. Record:
-- docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md.
--
-- The reasoning family `reasoning.decide-justify.v2` grades two things from
-- one signed attempt: the decision (the existing 0/100 verdict, which alone
-- decides completion) and the reason the learner gave for it (a separate
-- judgment quality from a private rubric: sound, partial or unsupported).
-- Core writes the judgment into the same receipt verdict through the same
-- nonce transaction (0101-0106), so it is as server-authoritative and as
-- one-use as the score. Nothing here changes the score, completion or XP: the
-- judgment is a distinct signal, never folded into the number.
--
--   lesson_v2_grade_receipts_judgment_check
--       A verdict may carry a judgment only as {"quality": <one of three>}.
--       Every receipt written before this migration has no judgment and
--       passes. A malformed or smuggled judgment is refused by the database
--       even if Core regressed.
--
--   learning_judgment_differentiation(p_since, p_until)
--       Appendix C "Judgment-Quality Signal Differentiation": per lesson, the
--       2x2 of correctness against a sound reason, the share of attempts where
--       the two signals diverge, and the Pearson correlation between
--       correctness (0/1) and judgment (sound 1, partial 0.5, unsupported 0).
--       If the signals always agree, the family measures nothing new and the
--       lesson needs pedagogical review (Appendix C Stage 3). Service role
--       only; the staff console reads it through Core.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lesson_v2_grade_receipts_judgment_check'
          AND conrelid = 'public.lesson_v2_grade_receipts'::regclass
    ) THEN
        ALTER TABLE public.lesson_v2_grade_receipts
            ADD CONSTRAINT lesson_v2_grade_receipts_judgment_check CHECK (
                NOT (verdict ? 'judgment') OR (
                    jsonb_typeof(verdict->'judgment') = 'object'
                    AND (verdict->'judgment') - 'quality' = '{}'::jsonb
                    AND verdict->'judgment'->>'quality' IN ('sound', 'partial', 'unsupported')
                )
            );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.learning_judgment_differentiation(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (
    lesson_id uuid,
    attempts bigint,
    correct_sound bigint,
    correct_not_sound bigint,
    incorrect_sound bigint,
    incorrect_not_sound bigint,
    divergent_share numeric,
    correlation numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH judged AS (
        SELECT run.lesson_id,
               (r.verdict->>'correct') = 'true' AS correct,
               r.verdict->'judgment'->>'quality' AS quality
        FROM public.lesson_v2_grade_receipts r
        JOIN public.lesson_v2_runs run ON run.id = r.run_id
        WHERE r.verdict ? 'judgment'
          AND r.created_at >= p_since AND r.created_at < p_until
    )
    SELECT judged.lesson_id,
           count(*) AS attempts,
           count(*) FILTER (WHERE correct AND quality = 'sound') AS correct_sound,
           count(*) FILTER (WHERE correct AND quality <> 'sound') AS correct_not_sound,
           count(*) FILTER (WHERE NOT correct AND quality = 'sound') AS incorrect_sound,
           count(*) FILTER (WHERE NOT correct AND quality <> 'sound') AS incorrect_not_sound,
           round(count(*) FILTER (WHERE correct <> (quality = 'sound'))::numeric / count(*), 4) AS divergent_share,
           round(corr(correct::int::double precision,
               CASE quality WHEN 'sound' THEN 1.0 WHEN 'partial' THEN 0.5 ELSE 0.0 END)::numeric, 4) AS correlation
    FROM judged
    GROUP BY judged.lesson_id
$$;

REVOKE ALL ON FUNCTION public.learning_judgment_differentiation(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_judgment_differentiation(timestamptz, timestamptz) TO service_role;
