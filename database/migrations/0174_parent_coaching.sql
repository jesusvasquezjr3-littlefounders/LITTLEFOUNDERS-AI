-- parent_coaching — S07.7, part 2 of 5 (D.23): the Tutor's reflective prompt
-- at the moment of a decision, the monthly coaching tip, and Appendix H's
-- Parent-Coaching-Tip Delivery & Engagement Rate.
-- @phase: expand
--
-- D.23 treats the parent, not only the child, as a design surface (Appendix G
-- §1.1: what a parent visibly does with money in the family carries as much
-- weight as any mechanic). Three things are built; this file holds the two
-- that need a record.
--
-- 1. THE REFLECTIVE PROMPT (Appendix G §4.2). Before a Tutor's yes or "not
--    yet" is sent, the rebuilt decision surface asks "What would you tell
--    them about this?", prior to and separate from the reason the child reads
--    (D.18). What the Tutor writes stays in their browser unless they choose
--    to send it as their note; only the fact is recorded here, as one of
--    'written' (kept private), 'shared' (sent as the note) or 'skipped'. No
--    text is stored, so the record cannot leak a reflection. Core requires the
--    field on every Tutor decision and records it right after the decision,
--    matching the decision this Tutor just made on that subject.
--
-- 2. THE MONTHLY TIP. Tips are written from Appendix G's findings and are
--    delivered only after the Pedagogical Lead's review, which is recorded in
--    the repository (docs/operations/parent-coaching-tips.json, bound to the
--    exact copy by a hash that a gate checks). Core therefore passes the list
--    of reviewed tips; this function picks one per Tutor per month (never the
--    same tip twice until every reviewed tip has been shown) and records the
--    delivery. An unreviewed tip can never be delivered, because Core never
--    passes it.
--
-- Metrics (analytics staff, counts only):
--   parent_coaching_delivery_rate    (a) delivery to eligible Tutors, trend
--                                    toward 100%; (b) opened, Diagnostic
--   parent_coaching_reflection_rate  the prompt fired on every Tutor decision
--
-- Retention: family_data_retention prunes both tables after 400 days.

-- ── The reflective prompt's record ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.family_decision_reflections (
    decision_id uuid PRIMARY KEY REFERENCES public.family_decisions (id) ON DELETE CASCADE,
    reflection  text NOT NULL CHECK (reflection IN ('written', 'shared', 'skipped')),
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.family_decision_reflections ENABLE ROW LEVEL SECURITY;
-- No client policy and no direct write for anyone: one definer function writes.
REVOKE ALL ON public.family_decision_reflections FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.family_decision_reflections TO service_role;

-- The Tutor's most recent decision on that subject, made in the last ten
-- minutes and not yet reflected on. A child's own decision (self-logged,
-- pre-approved) has no Tutor prompt and is never matched.
CREATE OR REPLACE FUNCTION public.record_decision_reflection(p_actor uuid, p_subject text, p_subject_id uuid, p_reflection text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_decision uuid;
BEGIN
    IF p_reflection IS NULL OR p_reflection NOT IN ('written', 'shared', 'skipped')
       OR p_subject IS NULL OR p_subject NOT IN ('task', 'redemption', 'level_request') THEN
        RAISE EXCEPTION 'REFLECTION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    SELECT d.id INTO v_decision
    FROM public.family_decisions d
    WHERE d.actor_kind = 'tutor' AND d.actor_user_id = p_actor
      AND d.created_at > now() - interval '10 minutes'
      AND ((p_subject = 'task' AND d.task_id = p_subject_id)
        OR (p_subject = 'redemption' AND d.redemption_id = p_subject_id)
        OR (p_subject = 'level_request' AND d.level_request_id = p_subject_id))
      AND NOT EXISTS (SELECT 1 FROM public.family_decision_reflections r WHERE r.decision_id = d.id)
    ORDER BY d.created_at DESC
    LIMIT 1
    FOR UPDATE;
    IF v_decision IS NULL THEN
        RAISE EXCEPTION 'REFLECTION_NO_DECISION' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.family_decision_reflections (decision_id, reflection) VALUES (v_decision, p_reflection);
    RETURN v_decision;
END;
$$;
REVOKE ALL ON FUNCTION public.record_decision_reflection(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_decision_reflection(uuid, text, uuid, text) TO service_role;

-- ── The monthly tip's delivery record ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_coaching_deliveries (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    tip_id        text NOT NULL CHECK (char_length(tip_id) BETWEEN 3 AND 48 AND tip_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    period        date NOT NULL CHECK (period = date_trunc('month', period)::date),
    delivered_at  timestamptz NOT NULL DEFAULT now(),
    opened_at     timestamptz,
    dismissed_at  timestamptz,
    CONSTRAINT parent_coaching_one_per_month UNIQUE (tutor_user_id, period)
);
CREATE INDEX IF NOT EXISTS parent_coaching_deliveries_period_idx ON public.parent_coaching_deliveries (period);
ALTER TABLE public.parent_coaching_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parent_coaching_deliveries FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.parent_coaching_deliveries TO service_role;

-- Only opened_at and dismissed_at move, each once, from NULL to a time.
CREATE OR REPLACE FUNCTION public.guard_parent_coaching_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
BEGIN
    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF NOT v_changed <@ ARRAY['opened_at', 'dismissed_at']
       OR ('opened_at' = ANY (v_changed) AND (OLD.opened_at IS NOT NULL OR NEW.opened_at IS NULL))
       OR ('dismissed_at' = ANY (v_changed) AND (OLD.dismissed_at IS NOT NULL OR NEW.dismissed_at IS NULL)) THEN
        RAISE EXCEPTION 'COACHING_DELIVERY_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_parent_coaching_delivery() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS parent_coaching_delivery_guard ON public.parent_coaching_deliveries;
CREATE TRIGGER parent_coaching_delivery_guard BEFORE UPDATE ON public.parent_coaching_deliveries
    FOR EACH ROW EXECUTE FUNCTION public.guard_parent_coaching_delivery();

-- A Tutor is anyone with at least one verified guardian link (OD-6: the
-- verified parent). Coaching is for Tutors only.
CREATE OR REPLACE FUNCTION public.parent_coaching_eligible(p_tutor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_tutor IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.guardian_links gl
        WHERE gl.parent_user_id = p_tutor AND gl.verification_status = 'verified');
$$;
REVOKE ALL ON FUNCTION public.parent_coaching_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_coaching_eligible(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.parent_coaching_row(p public.parent_coaching_deliveries)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT jsonb_build_object('id', p.id, 'tip_id', p.tip_id, 'period', p.period, 'delivered_at', p.delivered_at,
                              'opened_at', p.opened_at, 'dismissed_at', p.dismissed_at);
$$;
REVOKE ALL ON FUNCTION public.parent_coaching_row(public.parent_coaching_deliveries) FROM PUBLIC, anon, authenticated;

-- This month's tip for this Tutor, delivered at most once per month. p_tips
-- is the ordered list of reviewed tips Core may show; an empty list delivers
-- nothing (nothing has been reviewed), and a tip no longer on the list is
-- never returned again.
CREATE OR REPLACE FUNCTION public.parent_coaching_deliver(p_tutor uuid, p_tips text[], p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_period date := date_trunc('month', p_now)::date;
    v_row    public.parent_coaching_deliveries%ROWTYPE;
    v_tip    text;
BEGIN
    IF NOT public.parent_coaching_eligible(p_tutor) THEN
        RAISE EXCEPTION 'COACHING_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
    END IF;
    IF p_now > now() + interval '1 day' OR p_now < now() - interval '1 day' THEN
        RAISE EXCEPTION 'COACHING_PERIOD_INVALID' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_row FROM public.parent_coaching_deliveries WHERE tutor_user_id = p_tutor AND period = v_period;
    IF FOUND THEN
        RETURN CASE WHEN v_row.tip_id = ANY (coalesce(p_tips, ARRAY[]::text[])) THEN public.parent_coaching_row(v_row) END;
    END IF;
    IF coalesce(cardinality(p_tips), 0) = 0 THEN
        RETURN NULL;
    END IF;
    -- The first reviewed tip this Tutor has never had; when every one has
    -- been shown, the one shown longest ago.
    SELECT t.tip INTO v_tip
    FROM unnest(p_tips) WITH ORDINALITY AS t (tip, ord)
    LEFT JOIN LATERAL (
        SELECT max(d.period) AS last_period FROM public.parent_coaching_deliveries d
        WHERE d.tutor_user_id = p_tutor AND d.tip_id = t.tip
    ) last ON true
    ORDER BY last.last_period NULLS FIRST, t.ord
    LIMIT 1;
    INSERT INTO public.parent_coaching_deliveries (tutor_user_id, tip_id, period)
        VALUES (p_tutor, v_tip, v_period)
        ON CONFLICT ON CONSTRAINT parent_coaching_one_per_month DO NOTHING;
    SELECT * INTO v_row FROM public.parent_coaching_deliveries WHERE tutor_user_id = p_tutor AND period = v_period;
    RETURN public.parent_coaching_row(v_row);
END;
$$;
REVOKE ALL ON FUNCTION public.parent_coaching_deliver(uuid, text[], timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_coaching_deliver(uuid, text[], timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.parent_coaching_mark(p_delivery uuid, p_tutor uuid, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_row public.parent_coaching_deliveries%ROWTYPE;
BEGIN
    IF p_action IS NULL OR p_action NOT IN ('opened', 'dismissed') THEN
        RAISE EXCEPTION 'COACHING_ACTION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_row FROM public.parent_coaching_deliveries WHERE id = p_delivery AND tutor_user_id = p_tutor FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'COACHING_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF p_action = 'opened' AND v_row.opened_at IS NULL THEN
        UPDATE public.parent_coaching_deliveries SET opened_at = now() WHERE id = p_delivery RETURNING * INTO v_row;
    ELSIF p_action = 'dismissed' AND v_row.dismissed_at IS NULL THEN
        UPDATE public.parent_coaching_deliveries SET dismissed_at = now() WHERE id = p_delivery RETURNING * INTO v_row;
    END IF;
    RETURN public.parent_coaching_row(v_row);
END;
$$;
REVOKE ALL ON FUNCTION public.parent_coaching_mark(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_coaching_mark(uuid, uuid, text) TO service_role;

-- ── Appendix H: Parent-Coaching-Tip Delivery & Engagement Rate ────────────
-- Eligible: a Tutor (a verified link today) who was active in the month (a
-- decision, a chore created, or a Family Hub surface that asked for the
-- tip). Delivered: a tip was recorded for them that month. (a) delivered /
-- eligible trends toward 100%; (b) opened / delivered is Diagnostic.
CREATE OR REPLACE FUNCTION public.parent_coaching_delivery_rate(p_period date)
RETURNS TABLE (period date, eligible bigint, delivered bigint, opened bigint, dismissed bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH bounds AS (
        SELECT date_trunc('month', p_period)::date AS m,
               (date_trunc('month', p_period) + interval '1 month') AS m_end
    ),
    active AS (
        SELECT d.actor_user_id AS tutor FROM public.family_decisions d, bounds b
            WHERE d.actor_kind = 'tutor' AND d.actor_user_id IS NOT NULL AND d.created_at >= b.m AND d.created_at < b.m_end
        UNION
        SELECT t.assigned_by FROM public.tasks t, bounds b WHERE t.created_at >= b.m AND t.created_at < b.m_end
        UNION
        SELECT c.tutor_user_id FROM public.parent_coaching_deliveries c, bounds b WHERE c.period = b.m
    ),
    eligible AS (
        SELECT a.tutor FROM active a WHERE public.parent_coaching_eligible(a.tutor)
    )
    SELECT b.m,
           (SELECT count(*) FROM eligible),
           (SELECT count(*) FROM eligible e JOIN public.parent_coaching_deliveries c ON c.tutor_user_id = e.tutor AND c.period = b.m),
           (SELECT count(*) FROM eligible e JOIN public.parent_coaching_deliveries c ON c.tutor_user_id = e.tutor AND c.period = b.m AND c.opened_at IS NOT NULL),
           (SELECT count(*) FROM eligible e JOIN public.parent_coaching_deliveries c ON c.tutor_user_id = e.tutor AND c.period = b.m AND c.dismissed_at IS NOT NULL)
    FROM bounds b;
$$;
REVOKE ALL ON FUNCTION public.parent_coaching_delivery_rate(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_coaching_delivery_rate(date) TO service_role;

-- The prompt fired on every Tutor decision made since p_since (legacy,
-- backfilled decisions excluded): with_reflection / tutor_decisions trends
-- toward 100%, and the split between written, shared and skipped is Diagnostic.
CREATE OR REPLACE FUNCTION public.parent_coaching_reflection_rate(p_since timestamptz)
RETURNS TABLE (tutor_decisions bigint, with_reflection bigint, written bigint, shared bigint, skipped bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT count(*),
           count(r.decision_id),
           count(*) FILTER (WHERE r.reflection = 'written'),
           count(*) FILTER (WHERE r.reflection = 'shared'),
           count(*) FILTER (WHERE r.reflection = 'skipped')
    FROM public.family_decisions d
    LEFT JOIN public.family_decision_reflections r ON r.decision_id = d.id
    WHERE d.actor_kind = 'tutor' AND NOT d.legacy AND d.created_at >= p_since;
$$;
REVOKE ALL ON FUNCTION public.parent_coaching_reflection_rate(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parent_coaching_reflection_rate(timestamptz) TO service_role;

SELECT 'migration_parent_coaching_ok' AS sentinel;
