-- v2_mixed_lesson_completion — the general v2 lesson player (GAP-FIX-R1
-- learning: OD-17, OD-24, B.7, B.8, Appendix P Part 4.5).
-- @phase: expand
--
-- Until now a v2 lesson could complete only when EVERY required step was a
-- server-graded segment with a met receipt; a lesson made of an intro Mentor
-- turn, an explorable visual and a decision could not even start a run, and
-- a visual-only lesson could never earn completion. This migration adds:
--
-- 1. lesson_v2_segment_views: Core's record that the learner acted on a
--    non-scored segment of a pinned run (a Mentor turn read, a visual
--    explored). Service role only; RLS on, no policy.
-- 2. record_v2_segment_view: the one writer. The run must be the learner's,
--    on the same immutable version, not completed and not expired. Idempotent
--    per (run, segment).
-- 3. complete_v2_mixed_lesson: version-pinned completion for mixed
--    documents. Server-graded segments still need a met receipt; non-scored
--    segments need a view receipt. The score stays first-try accuracy over
--    the graded segments (100 when the lesson has none, as a story-only v1
--    lesson does). The receipt gains viewed_count and hints_used.
-- 4. CHECK constraints pinning the new verdict fields Core stores beside each
--    grade: the closed diagnostic code (Part 4.5), hints_used (the per-segment
--    help ladder, at most two steps), item_role and the KC id (Appendix C 1.1),
--    and the signal-detection counts of the scam families (Part 7).
--
-- complete_v2_lesson (0128) is untouched: this is an additive function.

CREATE TABLE IF NOT EXISTS public.lesson_v2_segment_views (
    user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id                uuid NOT NULL REFERENCES public.lesson_v2_runs(id) ON DELETE CASCADE,
    document_version_id   uuid NOT NULL REFERENCES public.lesson_document_versions(id) ON DELETE RESTRICT,
    segment_id            text NOT NULL CHECK (length(segment_id) BETWEEN 1 AND 101),
    created_at            timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (run_id, segment_id)
);
ALTER TABLE public.lesson_v2_segment_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lesson_v2_segment_views FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.lesson_v2_segment_views TO service_role;
CREATE INDEX IF NOT EXISTS lesson_v2_segment_views_user_idx ON public.lesson_v2_segment_views (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_v2_segment_view(
    p_user_id uuid, p_run_id uuid, p_document_version_id uuid, p_segment_id text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_run public.lesson_v2_runs%ROWTYPE;
BEGIN
    IF p_user_id IS NULL OR p_run_id IS NULL OR p_document_version_id IS NULL
       OR p_segment_id IS NULL OR length(p_segment_id) NOT BETWEEN 1 AND 101 THEN
        RAISE EXCEPTION 'Invalid v2 view input' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_run FROM public.lesson_v2_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND OR v_run.user_id <> p_user_id OR v_run.document_version_id <> p_document_version_id
       OR v_run.completed_at IS NOT NULL OR v_run.expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid v2 lesson run' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.lesson_v2_segment_views (user_id, run_id, document_version_id, segment_id)
    VALUES (p_user_id, p_run_id, p_document_version_id, p_segment_id)
    ON CONFLICT (run_id, segment_id) DO NOTHING;
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_v2_segment_view(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_v2_segment_view(uuid, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_v2_mixed_lesson(
    p_user_id uuid,
    p_lesson_id uuid,
    p_run_id uuid,
    p_document_version_id uuid,
    p_required_segment_ids text[],
    p_viewed_segment_ids text[],
    p_xp int,
    p_minutes int,
    p_local_date date
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_run public.lesson_v2_runs%ROWTYPE;
    v_result jsonb;
    v_extras jsonb;
    v_graded int;
    v_viewed int;
    v_met int;
    v_seen int;
    v_first_correct int := 0;
    v_sound int := 0;
    v_partial int := 0;
    v_unsupported int := 0;
    v_hints int := 0;
    v_score int;
BEGIN
    IF p_user_id IS NULL OR p_lesson_id IS NULL OR p_run_id IS NULL OR p_document_version_id IS NULL
       OR p_required_segment_ids IS NULL OR p_viewed_segment_ids IS NULL
       OR cardinality(p_required_segment_ids) + cardinality(p_viewed_segment_ids) = 0
       OR cardinality(ARRAY(SELECT DISTINCT unnest(p_required_segment_ids || p_viewed_segment_ids)))
          <> cardinality(p_required_segment_ids) + cardinality(p_viewed_segment_ids)
       OR EXISTS (SELECT 1 FROM unnest(p_required_segment_ids || p_viewed_segment_ids) AS id WHERE id IS NULL OR length(id) = 0)
       OR p_xp IS NULL OR p_xp < 0 OR p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 120 OR p_local_date IS NULL THEN
        RAISE EXCEPTION 'Invalid v2 completion input' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_run FROM public.lesson_v2_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND OR v_run.user_id <> p_user_id OR v_run.lesson_id <> p_lesson_id
       OR v_run.document_version_id <> p_document_version_id THEN
        RAISE EXCEPTION 'Invalid v2 lesson run' USING ERRCODE = '22023';
    END IF;

    v_graded := cardinality(p_required_segment_ids);
    v_viewed := cardinality(p_viewed_segment_ids);
    SELECT count(DISTINCT segment_id) INTO v_met FROM public.lesson_v2_grade_receipts
    WHERE user_id = p_user_id AND run_id = p_run_id AND document_version_id = p_document_version_id
      AND segment_id = ANY(p_required_segment_ids)
      AND verdict->>'correct' = 'true' AND verdict->>'score' = '100';
    SELECT count(*) INTO v_seen FROM public.lesson_v2_segment_views
    WHERE user_id = p_user_id AND run_id = p_run_id AND document_version_id = p_document_version_id
      AND segment_id = ANY(p_viewed_segment_ids);
    IF v_met <> v_graded OR v_seen <> v_viewed THEN
        RAISE EXCEPTION 'V2 lesson has pending learning steps' USING ERRCODE = '22023';
    END IF;

    IF v_graded > 0 THEN
        SELECT count(*) FILTER (WHERE first_try.verdict->>'correct' = 'true'),
               count(*) FILTER (WHERE first_try.verdict->'judgment'->>'quality' = 'sound'),
               count(*) FILTER (WHERE first_try.verdict->'judgment'->>'quality' = 'partial'),
               count(*) FILTER (WHERE first_try.verdict->'judgment'->>'quality' = 'unsupported')
          INTO v_first_correct, v_sound, v_partial, v_unsupported
          FROM (
            SELECT DISTINCT ON (segment_id) segment_id, verdict
            FROM public.lesson_v2_grade_receipts
            WHERE user_id = p_user_id AND run_id = p_run_id AND document_version_id = p_document_version_id
              AND segment_id = ANY(p_required_segment_ids)
            ORDER BY segment_id, created_at, jti
          ) AS first_try;
        SELECT COALESCE(sum((verdict->>'hints_used')::int), 0) INTO v_hints
          FROM public.lesson_v2_grade_receipts
         WHERE user_id = p_user_id AND run_id = p_run_id AND document_version_id = p_document_version_id
           AND verdict ? 'hints_used';
        v_score := round(100.0 * v_first_correct / v_graded)::int;
    ELSE
        v_score := 100;
    END IF;

    v_result := public.complete_lesson(p_user_id, p_lesson_id, p_run_id, v_score, true, p_xp, p_minutes, p_local_date);
    UPDATE public.lesson_v2_runs SET completed_at = COALESCE(completed_at, now()) WHERE id = p_run_id;
    IF v_result->>'replayed' = 'true' THEN
        RETURN v_result;
    END IF;

    v_extras := jsonb_build_object(
        'first_try_correct', v_first_correct,
        'graded_count', v_graded,
        'viewed_count', v_viewed,
        'hints_used', v_hints,
        'judgment', jsonb_build_object(
            'assessed', v_sound + v_partial + v_unsupported,
            'sound', v_sound, 'partial', v_partial, 'unsupported', v_unsupported));
    UPDATE public.lesson_completion_receipts SET result = result || v_extras
    WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND run_id = p_run_id;
    RETURN v_result || v_extras;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_v2_mixed_lesson(uuid, uuid, uuid, uuid, text[], text[], int, int, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_v2_mixed_lesson(uuid, uuid, uuid, uuid, text[], text[], int, int, date) TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lesson_v2_grade_receipts_signals_check'
          AND conrelid = 'public.lesson_v2_grade_receipts'::regclass
    ) THEN
        ALTER TABLE public.lesson_v2_grade_receipts
            ADD CONSTRAINT lesson_v2_grade_receipts_signals_check CHECK (
                (NOT (verdict ? 'diagnostic') OR verdict->>'diagnostic' IN
                    ('none', 'structure', 'value', 'partial', 'miss', 'false_alarm', 'path', 'outcome', 'bin', 'reason', 'tolerance'))
                AND (NOT (verdict ? 'hints_used') OR (jsonb_typeof(verdict->'hints_used') = 'number'
                    AND verdict->>'hints_used' IN ('0', '1', '2')))
                AND (NOT (verdict ? 'item_role') OR verdict->>'item_role' IN ('practice', 'transfer'))
                AND (NOT (verdict ? 'kc') OR (jsonb_typeof(verdict->'kc') = 'string'
                    AND verdict->>'kc' ~ '^[a-z0-9][a-z0-9._:-]{2,100}$'))
                AND (NOT (verdict ? 'detection') OR (jsonb_typeof(verdict->'detection') = 'object'
                    AND (verdict->'detection') ?& ARRAY['hits', 'misses', 'false_alarms', 'correct_rejections']
                    AND (verdict->'detection') - ARRAY['hits', 'misses', 'false_alarms', 'correct_rejections'] = '{}'::jsonb
                    AND (verdict->'detection'->>'hits') ~ '^[0-9]$'
                    AND (verdict->'detection'->>'misses') ~ '^[0-9]$'
                    AND (verdict->'detection'->>'false_alarms') ~ '^[0-9]$'
                    AND (verdict->'detection'->>'correct_rejections') ~ '^[0-9]$'))
            );
    END IF;
END $$;
