-- gate_effectiveness_reviews — every defect escape opens a gate-effectiveness
-- review that someone owns and must close with a named outcome (gap-fix round
-- 7 learning; Appendix C Part 1.3 "Defect Escape Rate": "any non-zero count
-- triggers a gate-effectiveness review, not only a content fix — the question
-- is always why didn't the gate catch this"; Part 3 Stage 6; Part 2.1
-- criterion 4).
-- @phase: expand
--
-- Before this, content_defect_escapes (0218) only counted rows: nobody was
-- asked why the gate missed the defect.
--
-- 1. forge_release_gates.owner_role: who answers for a gate's effectiveness.
--    The Pedagogical Lead owns the content gates (Appendix C Part 3 Stage 6);
--    the pipeline-completeness checks (every lesson, locale, illustration and
--    scene present, no orphaned progress) belong to content engineering. A
--    gate added later defaults to the Pedagogical Lead.
-- 2. gate_effectiveness_reviews: one row per escape (escape_id UNIQUE),
--    naming the gate and the owner copied from forge_release_gates when it
--    opened. It is opened by an AFTER INSERT trigger on content_defect_escapes,
--    so every write path opens one, in the same transaction; the escapes
--    recorded before this migration are backfilled open. A review resolves
--    once, with a closed outcome
--      gate_changed         the gate was fixed (gate_change_ref: the commit or
--                           gate version that changed it, required),
--      lexicon_extended     the gate's word list or pattern set now covers it,
--      accepted_limitation  the gate structurally cannot catch it (said why),
--    and a 10-600 character note. The table CHECK is the backstop: no
--    resolved row without an outcome, a note and a time; no open row with one.
--    Rows are append-only (a resolved review never changes, nothing is
--    deleted); an account erasure only nulls resolved_by.
-- 3. record_content_defect_escape re-checks the actor like every content
--    writer (content_release_actor_allowed: superadmin, or admin with
--    manage_content). Core already sends only that actor ('/content' →
--    manage_content), so no running Core call is refused.
-- 4. resolve_gate_effectiveness_review(actor, review, outcome, note, ref):
--    the one writer; named refusals FORBIDDEN, NOT_FOUND, ALREADY_RESOLVED,
--    INVALID_OUTCOME, NOTE_REQUIRED, CHANGE_REF_REQUIRED, CHANGE_REF_UNEXPECTED;
--    audited 'admin.content.gate_review.resolved' in the same transaction.
-- 5. gate_effectiveness_reviews_open(now): the open reviews with their age in
--    days, for the staff learning-quality panel and the release-readiness
--    cadence check (agent/tools/check-block-b-thresholds.mjs), which apply
--    the logged maximum (gate_effectiveness.review_max_open_days).
-- RLS on, no policy: only Core's service role reads and writes.

ALTER TABLE public.forge_release_gates
    ADD COLUMN IF NOT EXISTS owner_role text NOT NULL DEFAULT 'pedagogical_lead'
        CHECK (owner_role IN ('pedagogical_lead', 'content_engineering'));
UPDATE public.forge_release_gates SET owner_role = 'content_engineering'
WHERE gate_id IN ('forge.release.lessons-complete', 'forge.release.locales-complete', 'forge.release.illustration-style',
                  'forge.release.visual-coverage', 'forge.release.distinct-scenes', 'forge.release.orphan-progress');

CREATE TABLE IF NOT EXISTS public.gate_effectiveness_reviews (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escape_id        uuid NOT NULL UNIQUE REFERENCES public.content_defect_escapes (id) ON DELETE RESTRICT,
    gate_id          text NOT NULL REFERENCES public.forge_release_gates (gate_id),
    owner_role       text NOT NULL CHECK (owner_role IN ('pedagogical_lead', 'content_engineering')),
    status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    opened_at        timestamptz NOT NULL DEFAULT now(),
    outcome          text CHECK (outcome IN ('gate_changed', 'lexicon_extended', 'accepted_limitation')),
    gate_change_ref  text CHECK (gate_change_ref ~ '^[A-Za-z0-9][A-Za-z0-9._/@+-]{2,79}$'),
    resolution_note  text,
    resolved_by      uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    resolved_at      timestamptz,
    CONSTRAINT gate_effectiveness_reviews_lifecycle CHECK (
        (status = 'open' AND outcome IS NULL AND gate_change_ref IS NULL AND resolution_note IS NULL AND resolved_at IS NULL AND resolved_by IS NULL)
        OR (status = 'resolved' AND outcome IS NOT NULL AND resolved_at IS NOT NULL
            AND resolution_note IS NOT NULL AND length(btrim(resolution_note)) BETWEEN 10 AND 600
            AND (outcome = 'gate_changed') = (gate_change_ref IS NOT NULL)))
);
ALTER TABLE public.gate_effectiveness_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gate_effectiveness_reviews FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS gate_effectiveness_reviews_open_at ON public.gate_effectiveness_reviews (opened_at) WHERE status = 'open';

-- Append-only: an open review may only become resolved; a resolved one never changes (bar the erasure's SET NULL).
CREATE OR REPLACE FUNCTION public.guard_gate_effectiveness_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'GATE_REVIEW_APPEND_ONLY: gate-effectiveness reviews are never deleted' USING ERRCODE = '42501';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.escape_id IS DISTINCT FROM OLD.escape_id OR NEW.gate_id IS DISTINCT FROM OLD.gate_id
       OR NEW.owner_role IS DISTINCT FROM OLD.owner_role OR NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
        RAISE EXCEPTION 'GATE_REVIEW_APPEND_ONLY: a review keeps its escape, gate, owner and opening time' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'resolved' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.outcome IS DISTINCT FROM OLD.outcome
       OR NEW.gate_change_ref IS DISTINCT FROM OLD.gate_change_ref OR NEW.resolution_note IS DISTINCT FROM OLD.resolution_note
       OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at OR (NEW.resolved_by IS DISTINCT FROM OLD.resolved_by AND NEW.resolved_by IS NOT NULL)) THEN
        RAISE EXCEPTION 'GATE_REVIEW_RESOLVED: a resolved review never changes' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_gate_effectiveness_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS gate_effectiveness_reviews_append_only ON public.gate_effectiveness_reviews;
CREATE TRIGGER gate_effectiveness_reviews_append_only
    BEFORE UPDATE OR DELETE ON public.gate_effectiveness_reviews
    FOR EACH ROW EXECUTE FUNCTION public.guard_gate_effectiveness_review();

-- Every escape opens its review in the same transaction, whichever path wrote it.
CREATE OR REPLACE FUNCTION public.open_gate_effectiveness_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_owner text;
    v_id uuid;
BEGIN
    SELECT g.owner_role INTO v_owner FROM public.forge_release_gates g WHERE g.gate_id = NEW.gate_id;
    INSERT INTO public.gate_effectiveness_reviews (escape_id, gate_id, owner_role, opened_at)
    VALUES (NEW.id, NEW.gate_id, coalesce(v_owner, 'pedagogical_lead'), NEW.reported_at)
    RETURNING id INTO v_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (NEW.reported_by, 'admin.content.gate_review.opened', NEW.lesson_id::text, jsonb_build_object(
        'review_id', v_id, 'escape_id', NEW.id, 'gate_id', NEW.gate_id, 'owner_role', coalesce(v_owner, 'pedagogical_lead')));
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.open_gate_effectiveness_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS content_defect_escapes_open_review ON public.content_defect_escapes;
CREATE TRIGGER content_defect_escapes_open_review
    AFTER INSERT ON public.content_defect_escapes
    FOR EACH ROW EXECUTE FUNCTION public.open_gate_effectiveness_review();

-- Escapes recorded before this migration: their reviews open now, dated when the escape was reported.
INSERT INTO public.gate_effectiveness_reviews (escape_id, gate_id, owner_role, opened_at)
SELECT e.id, e.gate_id, g.owner_role, e.reported_at
FROM public.content_defect_escapes e
JOIN public.forge_release_gates g ON g.gate_id = e.gate_id
WHERE NOT EXISTS (SELECT 1 FROM public.gate_effectiveness_reviews r WHERE r.escape_id = e.id);

-- 0218's recorder, now re-checking the actor like every other content writer.
CREATE OR REPLACE FUNCTION public.record_content_defect_escape(p_lesson_id uuid, p_gate_id text, p_defect_kind text, p_actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id uuid;
BEGIN
    IF NOT public.content_release_actor_allowed(p_actor) THEN
        RAISE EXCEPTION 'FORBIDDEN: only staff with the content permission may record a defect escape' USING ERRCODE = '42501';
    END IF;
    IF p_lesson_id IS NULL OR p_gate_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.forge_release_gates WHERE gate_id = p_gate_id) THEN
        RAISE EXCEPTION 'Invalid defect escape' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.content_defect_escapes (lesson_id, gate_id, defect_kind, reported_by)
    VALUES (p_lesson_id, p_gate_id, p_defect_kind, p_actor)
    RETURNING id INTO v_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'admin.content.defect_escape', p_lesson_id::text, jsonb_build_object('gate_id', p_gate_id, 'defect_kind', p_defect_kind, 'escape_id', v_id));
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_content_defect_escape(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_content_defect_escape(uuid, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_gate_effectiveness_review(
    p_actor uuid, p_review_id uuid, p_outcome text, p_note text, p_gate_change_ref text)
RETURNS TABLE (ok boolean, code text, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_review public.gate_effectiveness_reviews%ROWTYPE;
    v_lesson uuid;
    v_ref text := nullif(btrim(coalesce(p_gate_change_ref, '')), '');
BEGIN
    IF NOT public.content_release_actor_allowed(p_actor) THEN
        RETURN QUERY SELECT false, 'FORBIDDEN'::text, 'Only staff with the content permission may resolve a gate-effectiveness review.'::text;
        RETURN;
    END IF;
    SELECT * INTO v_review FROM public.gate_effectiveness_reviews r WHERE r.id = p_review_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'NOT_FOUND'::text, 'No such review.'::text;
        RETURN;
    END IF;
    IF v_review.status <> 'open' THEN
        RETURN QUERY SELECT false, 'ALREADY_RESOLVED'::text, 'This review is already resolved.'::text;
        RETURN;
    END IF;
    IF p_outcome IS NULL OR p_outcome NOT IN ('gate_changed', 'lexicon_extended', 'accepted_limitation') THEN
        RETURN QUERY SELECT false, 'INVALID_OUTCOME'::text, 'Choose what changed: the gate, its lexicon, or an accepted limitation.'::text;
        RETURN;
    END IF;
    IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 10 AND 600 THEN
        RETURN QUERY SELECT false, 'NOTE_REQUIRED'::text, 'Say why the gate missed it, in 10-600 characters.'::text;
        RETURN;
    END IF;
    IF p_outcome = 'gate_changed' AND (v_ref IS NULL OR v_ref !~ '^[A-Za-z0-9][A-Za-z0-9._/@+-]{2,79}$') THEN
        RETURN QUERY SELECT false, 'CHANGE_REF_REQUIRED'::text, 'Name the commit or gate version that changed the gate.'::text;
        RETURN;
    END IF;
    IF p_outcome <> 'gate_changed' AND v_ref IS NOT NULL THEN
        RETURN QUERY SELECT false, 'CHANGE_REF_UNEXPECTED'::text, 'Only a changed gate names a commit or version.'::text;
        RETURN;
    END IF;
    UPDATE public.gate_effectiveness_reviews
    SET status = 'resolved', outcome = p_outcome, gate_change_ref = v_ref, resolution_note = btrim(p_note),
        resolved_by = p_actor, resolved_at = now()
    WHERE id = p_review_id;
    SELECT e.lesson_id INTO v_lesson FROM public.content_defect_escapes e WHERE e.id = v_review.escape_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'admin.content.gate_review.resolved', v_lesson::text, jsonb_build_object(
        'review_id', p_review_id, 'escape_id', v_review.escape_id, 'gate_id', v_review.gate_id, 'owner_role', v_review.owner_role,
        'outcome', p_outcome, 'gate_change_ref', v_ref, 'open_days', floor(extract(epoch FROM now() - v_review.opened_at) / 86400)::integer));
    RETURN QUERY SELECT true, 'RESOLVED'::text, 'Resolved.'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_gate_effectiveness_review(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_gate_effectiveness_review(uuid, uuid, text, text, text) TO service_role;

-- The open reviews, oldest first, with their age in whole days at p_now.
CREATE OR REPLACE FUNCTION public.gate_effectiveness_reviews_open(p_now timestamptz DEFAULT now())
RETURNS TABLE (review_id uuid, escape_id uuid, lesson_id uuid, gate_id text, gate_description text, owner_role text,
               defect_kind text, opened_at timestamptz, age_days integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT r.id, r.escape_id, e.lesson_id, r.gate_id, g.description, r.owner_role, e.defect_kind, r.opened_at,
           greatest(0, floor(extract(epoch FROM coalesce(p_now, now()) - r.opened_at) / 86400))::integer
    FROM public.gate_effectiveness_reviews r
    JOIN public.content_defect_escapes e ON e.id = r.escape_id
    JOIN public.forge_release_gates g ON g.gate_id = r.gate_id
    WHERE r.status = 'open'
    ORDER BY r.opened_at, r.id;
$$;
REVOKE ALL ON FUNCTION public.gate_effectiveness_reviews_open(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gate_effectiveness_reviews_open(timestamptz) TO service_role;
