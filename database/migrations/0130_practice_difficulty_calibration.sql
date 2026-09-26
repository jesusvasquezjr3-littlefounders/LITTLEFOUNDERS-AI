-- @phase: expand
-- B.19 (S05.3d): practice difficulty calibrated to a target success band.
-- Record: docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md; policy:
-- docs/rebuild/PRACTICE-DIFFICULTY-CALIBRATION.md.
--
-- Product 10 B.19 and Appendix B §1.7: practice should land at roughly 70-85%
-- success, as a starting hypothesis tracked and adjusted per lesson, never a
-- satisfaction or completion metric. Appendix C: anything consistently outside
-- the band triggers a difficulty-calibration review, and every threshold
-- change is logged (the Threshold Recalibration Log).
--
--   practice_difficulty_bands       The platform default band (lesson_id
--                                   NULL, seeded 70-85%, 30 first attempts
--                                   minimum) and per-lesson hypotheses. The
--                                   CHECKs are the guard rails: no band may sit
--                                   above 95% (the near-certain zone B.19
--                                   forbids drifting into) or below 50%, and a
--                                   band is at least 5 points wide.
--   practice_difficulty_band_log    Append-only history of every band change,
--                                   with the rationale and the staff actor.
--   practice_difficulty_reviews     A calibration review, opened only when a
--                                   lesson is outside its band in two
--                                   consecutive windows with enough evidence,
--                                   resolved once by a content-team decision.
--
-- First-attempt success, the metric: the first graded attempt of a segment in
-- a run. Legacy lessons: lesson_segment_attempts.attempt_number = 1 is a
-- success only when correct and unaided (diagnostic_code NULL); a hinted first
-- attempt counts as an attempt and is reported as assisted. v2 lessons: the
-- earliest receipt of each segment in a run, reported per exercise family (the
-- segment type in the immutable version). Placement probes are not practice
-- and are not counted. A lesson with no graded practice never appears (B.4).
--
-- Every function is service-role only; Core's staff routes gate them behind
-- manage_content and pass the verified staff actor. No browser policy exists.

CREATE TABLE IF NOT EXISTS public.practice_difficulty_bands (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id   uuid UNIQUE REFERENCES public.lessons(id) ON DELETE RESTRICT,
    lower_pct   integer NOT NULL,
    upper_pct   integer NOT NULL,
    min_sample  integer NOT NULL,
    rationale   text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 10 AND 600),
    set_by      uuid,
    set_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT practice_difficulty_bands_guard_rails CHECK (
        lower_pct >= 50 AND upper_pct <= 95 AND upper_pct - lower_pct >= 5
    ),
    CONSTRAINT practice_difficulty_bands_sample CHECK (min_sample BETWEEN 10 AND 100000)
);
CREATE UNIQUE INDEX IF NOT EXISTS practice_difficulty_bands_default_idx
    ON public.practice_difficulty_bands ((true)) WHERE lesson_id IS NULL;
ALTER TABLE public.practice_difficulty_bands ENABLE ROW LEVEL SECURITY;

INSERT INTO public.practice_difficulty_bands (lesson_id, lower_pct, upper_pct, min_sample, rationale)
SELECT NULL, 70, 85, 30,
       'Starting hypothesis from Product 10 B.19 and Appendix B section 1.7; recalibrate per lesson from the tracked metric.'
WHERE NOT EXISTS (SELECT 1 FROM public.practice_difficulty_bands WHERE lesson_id IS NULL);

CREATE TABLE IF NOT EXISTS public.practice_difficulty_band_log (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lesson_id   uuid REFERENCES public.lessons(id) ON DELETE RESTRICT,
    previous    jsonb,
    next        jsonb NOT NULL,
    rationale   text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 10 AND 600),
    review_id   uuid,
    changed_by  uuid NOT NULL,
    changed_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.practice_difficulty_band_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.practice_difficulty_reviews (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id     uuid NOT NULL REFERENCES public.lessons(id) ON DELETE RESTRICT,
    direction     text NOT NULL CHECK (direction IN ('below_band', 'above_band')),
    window_days   integer NOT NULL CHECK (window_days BETWEEN 7 AND 180),
    evidence      jsonb NOT NULL,
    status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    decision      text CHECK (decision IN ('make_harder', 'make_easier', 'adjust_band', 'no_change')),
    decision_note text,
    resolved_by   uuid,
    opened_at     timestamptz NOT NULL DEFAULT now(),
    resolved_at   timestamptz,
    CONSTRAINT practice_difficulty_reviews_resolution CHECK (
        (status = 'open' AND decision IS NULL AND decision_note IS NULL AND resolved_by IS NULL AND resolved_at IS NULL)
        OR (status = 'resolved' AND decision IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL
            AND length(btrim(decision_note)) BETWEEN 10 AND 600)
    ),
    -- Too easy can only be made harder, too hard only easier: a decision
    -- that would push a lesson further out of its band is not a decision.
    CONSTRAINT practice_difficulty_reviews_direction CHECK (
        decision IS NULL
        OR (decision = 'make_harder' AND direction = 'above_band')
        OR (decision = 'make_easier' AND direction = 'below_band')
        OR decision IN ('adjust_band', 'no_change')
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS practice_difficulty_reviews_open_idx
    ON public.practice_difficulty_reviews (lesson_id) WHERE status = 'open';
ALTER TABLE public.practice_difficulty_reviews ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reject_practice_difficulty_history_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Nested, not one AND chain: the band log has no status column, and SQL
    -- does not promise to short-circuit a field reference.
    IF TG_TABLE_NAME = 'practice_difficulty_reviews' AND TG_OP = 'UPDATE' THEN
        IF OLD.status = 'open' THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'practice difficulty history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS practice_difficulty_band_log_append_only ON public.practice_difficulty_band_log;
CREATE TRIGGER practice_difficulty_band_log_append_only
    BEFORE UPDATE OR DELETE ON public.practice_difficulty_band_log
    FOR EACH ROW EXECUTE FUNCTION public.reject_practice_difficulty_history_change();
DROP TRIGGER IF EXISTS practice_difficulty_reviews_resolved_once ON public.practice_difficulty_reviews;
CREATE TRIGGER practice_difficulty_reviews_resolved_once
    BEFORE UPDATE OR DELETE ON public.practice_difficulty_reviews
    FOR EACH ROW EXECUTE FUNCTION public.reject_practice_difficulty_history_change();

-- Defense in depth behind Core's route gate: the actor Core passes must hold
-- the content permission on an admin role, or be a superadmin.
CREATE OR REPLACE FUNCTION public.practice_difficulty_actor_allowed(p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'superadmin')
        OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'admin')
            AND EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = p_actor AND permission = 'manage_content'))
$$;

CREATE OR REPLACE FUNCTION public.practice_success_band_metrics(p_since timestamptz, p_until timestamptz)
RETURNS TABLE (
    lesson_id uuid,
    lesson_slug text,
    lesson_title jsonb,
    first_attempts bigint,
    successes bigint,
    assisted bigint,
    success_pct numeric,
    lower_pct integer,
    upper_pct integer,
    min_sample integer,
    band_scope text,
    status text,
    families jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH legacy AS (
        SELECT a.lesson_id, 'legacy'::text AS family,
               (a.diagnostic_code IS NULL AND a.score > 0) AS success,
               (a.diagnostic_code = 'hint_assisted') AS assisted
        FROM public.lesson_segment_attempts a
        WHERE a.attempt_number = 1 AND a.created_at >= p_since AND a.created_at < p_until
    ),
    v2_first AS (
        SELECT DISTINCT ON (r.run_id, r.segment_id)
               run.lesson_id, r.segment_id, r.document_version_id, r.verdict, r.created_at
        FROM public.lesson_v2_grade_receipts r
        JOIN public.lesson_v2_runs run ON run.id = r.run_id
        -- Runs last 15 minutes: a day of margin finds a window's first tries.
        WHERE r.created_at >= p_since - interval '1 day' AND r.created_at < p_until
        ORDER BY r.run_id, r.segment_id, r.created_at, r.jti
    ),
    v2 AS (
        SELECT f.lesson_id, COALESCE(seg.type, 'unknown') AS family,
               (f.verdict->>'correct') = 'true' AS success, false AS assisted
        FROM v2_first f
        JOIN public.lesson_document_versions v ON v.id = f.document_version_id
        LEFT JOIN LATERAL (
            SELECT s->>'type' AS type FROM jsonb_array_elements(v.document->'segments') s
            WHERE s->>'id' = f.segment_id LIMIT 1
        ) seg ON true
        WHERE f.created_at >= p_since
    ),
    attempts AS (SELECT * FROM legacy UNION ALL SELECT * FROM v2),
    per_family AS (
        SELECT attempts.lesson_id, family, count(*) AS n, count(*) FILTER (WHERE success) AS ok
        FROM attempts GROUP BY attempts.lesson_id, family
    ),
    per_lesson AS (
        SELECT attempts.lesson_id, count(*) AS n, count(*) FILTER (WHERE success) AS ok,
               count(*) FILTER (WHERE assisted) AS helped
        FROM attempts GROUP BY attempts.lesson_id
    ),
    default_band AS (
        SELECT b.lower_pct, b.upper_pct, b.min_sample FROM public.practice_difficulty_bands b WHERE b.lesson_id IS NULL
    )
    SELECT p.lesson_id, l.slug, l.title, p.n, p.ok, p.helped,
           round(100.0 * p.ok / p.n, 1),
           COALESCE(b.lower_pct, d.lower_pct), COALESCE(b.upper_pct, d.upper_pct), COALESCE(b.min_sample, d.min_sample),
           CASE WHEN b.id IS NULL THEN 'default' ELSE 'lesson' END,
           CASE
               WHEN p.n < COALESCE(b.min_sample, d.min_sample) THEN 'insufficient_sample'
               WHEN 100.0 * p.ok / p.n < COALESCE(b.lower_pct, d.lower_pct) THEN 'below_band'
               WHEN 100.0 * p.ok / p.n > COALESCE(b.upper_pct, d.upper_pct) THEN 'above_band'
               ELSE 'in_band' END,
           (SELECT jsonb_agg(jsonb_build_object('family', f.family, 'first_attempts', f.n, 'successes', f.ok) ORDER BY f.family)
              FROM per_family f WHERE f.lesson_id = p.lesson_id)
    FROM per_lesson p
    JOIN public.lessons l ON l.id = p.lesson_id
    CROSS JOIN default_band d
    LEFT JOIN public.practice_difficulty_bands b ON b.lesson_id = p.lesson_id
$$;

CREATE OR REPLACE FUNCTION public.set_practice_difficulty_band(
    p_lesson_id uuid, p_lower integer, p_upper integer, p_min_sample integer,
    p_rationale text, p_actor uuid, p_review_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_previous public.practice_difficulty_bands%ROWTYPE;
    v_next jsonb;
BEGIN
    IF p_actor IS NULL OR p_rationale IS NULL OR length(btrim(p_rationale)) NOT BETWEEN 10 AND 600
       OR p_lower IS NULL OR p_upper IS NULL THEN
        RAISE EXCEPTION 'Invalid practice band input' USING ERRCODE = '22023';
    END IF;
    IF NOT public.practice_difficulty_actor_allowed(p_actor) THEN
        RAISE EXCEPTION 'Content permission required' USING ERRCODE = '42501';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('practice_difficulty_band:' || COALESCE(p_lesson_id::text, 'default'), 0));

    IF p_lesson_id IS NULL THEN
        SELECT * INTO v_previous FROM public.practice_difficulty_bands WHERE lesson_id IS NULL FOR UPDATE;
        UPDATE public.practice_difficulty_bands
           SET lower_pct = p_lower, upper_pct = p_upper,
               min_sample = COALESCE(p_min_sample, v_previous.min_sample),
               rationale = btrim(p_rationale), set_by = p_actor, set_at = now()
         WHERE lesson_id IS NULL;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE id = p_lesson_id) THEN
            RAISE EXCEPTION 'Unknown lesson' USING ERRCODE = '22023';
        END IF;
        SELECT * INTO v_previous FROM public.practice_difficulty_bands WHERE lesson_id = p_lesson_id FOR UPDATE;
        INSERT INTO public.practice_difficulty_bands (lesson_id, lower_pct, upper_pct, min_sample, rationale, set_by)
        VALUES (p_lesson_id, p_lower, p_upper,
                COALESCE(p_min_sample, v_previous.min_sample,
                         (SELECT min_sample FROM public.practice_difficulty_bands WHERE lesson_id IS NULL)),
                btrim(p_rationale), p_actor)
        ON CONFLICT (lesson_id) DO UPDATE SET
            lower_pct = EXCLUDED.lower_pct, upper_pct = EXCLUDED.upper_pct, min_sample = EXCLUDED.min_sample,
            rationale = EXCLUDED.rationale, set_by = EXCLUDED.set_by, set_at = now();
    END IF;

    SELECT jsonb_build_object('lower_pct', b.lower_pct, 'upper_pct', b.upper_pct, 'min_sample', b.min_sample)
      INTO v_next FROM public.practice_difficulty_bands b
     WHERE b.lesson_id IS NOT DISTINCT FROM p_lesson_id;
    INSERT INTO public.practice_difficulty_band_log (lesson_id, previous, next, rationale, review_id, changed_by)
    VALUES (p_lesson_id,
            CASE WHEN v_previous.id IS NULL THEN NULL ELSE jsonb_build_object(
                'lower_pct', v_previous.lower_pct, 'upper_pct', v_previous.upper_pct, 'min_sample', v_previous.min_sample) END,
            v_next, btrim(p_rationale), p_review_id, p_actor);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'practice_band.set', COALESCE(p_lesson_id::text, 'default'),
            jsonb_build_object('next', v_next, 'review_id', p_review_id));
    RETURN jsonb_build_object('status', 'set', 'band', v_next);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_practice_difficulty_reviews(p_window_days integer, p_now timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_opened integer;
    v_window interval;
BEGIN
    IF p_window_days IS NULL OR p_window_days NOT BETWEEN 7 AND 180 OR p_now IS NULL OR p_now > now() + interval '1 minute' THEN
        RAISE EXCEPTION 'Invalid review window' USING ERRCODE = '22023';
    END IF;
    v_window := make_interval(days => p_window_days);
    PERFORM pg_advisory_xact_lock(hashtextextended('practice_difficulty_reviews', 0));

    WITH current_window AS (
        SELECT * FROM public.practice_success_band_metrics(p_now - v_window, p_now)
    ), previous_window AS (
        SELECT * FROM public.practice_success_band_metrics(p_now - 2 * v_window, p_now - v_window)
    ), opened AS (
        INSERT INTO public.practice_difficulty_reviews (lesson_id, direction, window_days, evidence)
        SELECT c.lesson_id, c.status, p_window_days, jsonb_build_object(
                   'current', jsonb_build_object('first_attempts', c.first_attempts, 'successes', c.successes, 'success_pct', c.success_pct),
                   'previous', jsonb_build_object('first_attempts', p.first_attempts, 'successes', p.successes, 'success_pct', p.success_pct),
                   'band', jsonb_build_object('lower_pct', c.lower_pct, 'upper_pct', c.upper_pct, 'min_sample', c.min_sample, 'scope', c.band_scope),
                   'as_of', p_now)
        FROM current_window c
        JOIN previous_window p ON p.lesson_id = c.lesson_id
        WHERE c.status IN ('below_band', 'above_band') AND p.status = c.status
          AND NOT EXISTS (
              SELECT 1 FROM public.practice_difficulty_reviews r
              WHERE r.lesson_id = c.lesson_id
                AND (r.status = 'open' OR r.resolved_at > p_now - v_window))
        ON CONFLICT DO NOTHING
        RETURNING 1
    )
    SELECT count(*) INTO v_opened FROM opened;
    RETURN v_opened;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_practice_difficulty_review(
    p_review_id uuid, p_actor uuid, p_decision text, p_note text,
    p_lower integer DEFAULT NULL, p_upper integer DEFAULT NULL, p_min_sample integer DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_review public.practice_difficulty_reviews%ROWTYPE;
BEGIN
    IF p_review_id IS NULL OR p_actor IS NULL OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 10 AND 600
       OR p_decision IS NULL OR p_decision NOT IN ('make_harder', 'make_easier', 'adjust_band', 'no_change')
       OR (p_decision = 'adjust_band' AND (p_lower IS NULL OR p_upper IS NULL))
       OR (p_decision <> 'adjust_band' AND (p_lower IS NOT NULL OR p_upper IS NOT NULL OR p_min_sample IS NOT NULL)) THEN
        RAISE EXCEPTION 'Invalid review decision' USING ERRCODE = '22023';
    END IF;
    IF NOT public.practice_difficulty_actor_allowed(p_actor) THEN
        RAISE EXCEPTION 'Content permission required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_review FROM public.practice_difficulty_reviews WHERE id = p_review_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;
    IF v_review.status <> 'open' THEN RETURN jsonb_build_object('status', 'already_resolved'); END IF;
    IF (p_decision = 'make_harder' AND v_review.direction <> 'above_band')
       OR (p_decision = 'make_easier' AND v_review.direction <> 'below_band') THEN
        RETURN jsonb_build_object('status', 'wrong_direction');
    END IF;

    IF p_decision = 'adjust_band' THEN
        PERFORM public.set_practice_difficulty_band(v_review.lesson_id, p_lower, p_upper, p_min_sample, p_note, p_actor, p_review_id);
    END IF;
    UPDATE public.practice_difficulty_reviews
       SET status = 'resolved', decision = p_decision, decision_note = btrim(p_note),
           resolved_by = p_actor, resolved_at = now()
     WHERE id = p_review_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'practice_review.resolve', v_review.lesson_id::text,
            jsonb_build_object('review_id', p_review_id, 'decision', p_decision, 'direction', v_review.direction));
    RETURN jsonb_build_object('status', 'resolved');
END;
$$;

REVOKE ALL ON FUNCTION public.practice_difficulty_actor_allowed(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.practice_success_band_metrics(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_practice_difficulty_band(uuid, integer, integer, integer, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_practice_difficulty_reviews(integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_practice_difficulty_review(uuid, uuid, text, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.practice_difficulty_actor_allowed(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.practice_success_band_metrics(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_practice_difficulty_band(uuid, integer, integer, integer, text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_practice_difficulty_reviews(integer, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_practice_difficulty_review(uuid, uuid, text, text, integer, integer, integer) TO service_role;
