-- family_talk_nudges — S07.5, part 6 of 6 (D.17, D.18): the "talk about it"
-- nudge, the level's evidence-based step-down, the eligibility log's writer,
-- and the Appendix H metrics for both requirements.
-- @phase: expand
--
-- D.18 (Appendix G §4.2): the approval tap must be one input to a
-- conversation, not a replacement for it. After a defined pattern of repeated
-- "not yet"s (three in 14 days for one child: a chore sent back, a chore
-- cancelled after "done", a reward denied, a self-directed item questioned)
-- the Tutor gets a "talk about it" nudge, at most once per 14 days per child.
-- The child can also ask to talk about any "not yet" they received (their own
-- voice, reciprocal rather than one-way). A Tutor closes a nudge as "we
-- talked" or dismisses it. The nudge is written by a trigger on the decision
-- record, so no flow can forget it; Appendix H's Repeated-Denial
-- Communication-Nudge Trigger Rate recomputes the pattern independently and
-- compares.
--
-- D.17 (Appendix H Definition of Done (d), the Appendix D demotion
-- precedent): when a Tutor questions three self-directed items within 30
-- days, the level steps down by one, recorded as a system change the family
-- reads with its reason. Tutors and staff can also lower a level at any time
-- (family_autonomy_ladder).
--
-- Metrics (analytics staff, counts only):
--   family_autonomy_progression   Independence-Tier Progression Rate
--   family_autonomy_step_downs    rollback usage, by who lowered the level
--   family_talk_nudge_rate        Repeated-Denial Communication-Nudge Trigger Rate
--   family_denial_actionability   Denial-Reason Actionability Rate: a random,
--                                 consent-gated sample of reasons (no names,
--                                 no ids of the family) scored by a person

-- ── The nudge ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.family_talk_nudges (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    origin      text NOT NULL CHECK (origin IN ('pattern', 'child')),
    decision_id uuid REFERENCES public.family_decisions (id) ON DELETE CASCADE,
    denials     integer,
    status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'talked', 'dismissed')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    closed_at   timestamptz,
    closed_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    CONSTRAINT family_talk_nudges_shape CHECK ((origin = 'pattern' AND denials IS NOT NULL) OR (origin = 'child' AND denials IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS family_talk_nudges_one_child_ask ON public.family_talk_nudges (decision_id) WHERE origin = 'child';
CREATE INDEX IF NOT EXISTS family_talk_nudges_kid_idx ON public.family_talk_nudges (kid_user_id, created_at DESC);

ALTER TABLE public.family_talk_nudges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS family_talk_nudges_select_party ON public.family_talk_nudges;
CREATE POLICY family_talk_nudges_select_party ON public.family_talk_nudges
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.family_talk_nudges FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.family_talk_nudges FROM service_role;

CREATE OR REPLACE FUNCTION public.guard_family_talk_nudge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_decision public.family_decisions%ROWTYPE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'open' OR NEW.closed_at IS NOT NULL OR NEW.closed_by IS NOT NULL THEN
            RAISE EXCEPTION 'TALK_NUDGE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        SELECT * INTO v_decision FROM public.family_decisions WHERE id = NEW.decision_id;
        IF NOT FOUND OR v_decision.kid_user_id <> NEW.kid_user_id
           OR NOT (public.family_decision_not_approved(v_decision.outcome, v_decision.prior_status) OR v_decision.outcome = 'declined') THEN
            RAISE EXCEPTION 'TALK_NUDGE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        -- A pattern nudge comes only from the decision trigger below.
        IF NEW.origin = 'pattern' AND pg_trigger_depth() < 2 THEN
            RAISE EXCEPTION 'TALK_NUDGE_FORBIDDEN' USING ERRCODE = 'P0001';
        END IF;
        NEW.created_at := now();
        RETURN NEW;
    END IF;
    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['closed_by'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'kid_user_id', 'origin', 'decision_id', 'denials', 'created_at']
       OR OLD.status <> 'open' OR NEW.status NOT IN ('talked', 'dismissed')
       OR NOT public.family_is_verified_guardian(NEW.closed_by, NEW.kid_user_id) THEN
        RAISE EXCEPTION 'TALK_NUDGE_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    NEW.closed_at := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_family_talk_nudge() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_talk_nudge_guard ON public.family_talk_nudges;
CREATE TRIGGER family_talk_nudge_guard BEFORE INSERT OR UPDATE ON public.family_talk_nudges
    FOR EACH ROW EXECUTE FUNCTION public.guard_family_talk_nudge();

-- ── What follows a decision, for every writer ───────────────────────────────
CREATE OR REPLACE FUNCTION public.family_decision_followups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_count bigint;
    v_cur   record;
BEGIN
    IF NEW.legacy THEN
        RETURN NULL;
    END IF;

    -- D.18: repeated "not yet"s open a "talk about it" nudge for the Tutor.
    IF public.family_decision_not_approved(NEW.outcome, NEW.prior_status) THEN
        SELECT count(*) INTO v_count FROM public.family_decisions d
        WHERE d.kid_user_id = NEW.kid_user_id AND NOT d.legacy
          AND public.family_decision_not_approved(d.outcome, d.prior_status)
          AND d.created_at > now() - make_interval(days => public.family_autonomy_threshold('talk_nudge_window_days'));
        IF v_count >= public.family_autonomy_threshold('talk_nudge_denials') AND NOT EXISTS (
            SELECT 1 FROM public.family_talk_nudges n
            WHERE n.kid_user_id = NEW.kid_user_id AND n.origin = 'pattern'
              AND n.created_at > now() - make_interval(days => public.family_autonomy_threshold('talk_nudge_window_days'))
        ) THEN
            INSERT INTO public.family_talk_nudges (kid_user_id, origin, decision_id, denials)
            VALUES (NEW.kid_user_id, 'pattern', NEW.id, v_count);
        END IF;
    END IF;

    -- D.17: three questioned self-directed items in 30 days step the level
    -- down by one (at most once per 30 days).
    IF NEW.outcome = 'questioned' THEN
        SELECT count(*) INTO v_count FROM public.family_decisions d
        WHERE d.kid_user_id = NEW.kid_user_id AND d.outcome = 'questioned'
          AND d.created_at > now() - make_interval(days => public.family_autonomy_threshold('auto_step_down_window_days'));
        SELECT * INTO v_cur FROM public.family_autonomy_level(NEW.kid_user_id);
        IF v_count >= public.family_autonomy_threshold('auto_step_down_questioned') AND v_cur.stored_level > 1 AND NOT EXISTS (
            SELECT 1 FROM public.family_autonomy_changes c
            WHERE c.kid_user_id = NEW.kid_user_id AND c.actor_kind = 'system'
              AND c.created_at > now() - make_interval(days => public.family_autonomy_threshold('auto_step_down_window_days'))
        ) THEN
            PERFORM public.family_autonomy_apply(NEW.kid_user_id, NULL, 'system', v_cur.stored_level - 1,
                least(v_cur.stored_limit, public.family_autonomy_cap(v_cur.stored_level - 1)), 'questioned_pattern', NULL, NULL);
        END IF;
    END IF;

    -- D.17: the first moment the next level opened (the progression metric).
    PERFORM public.record_family_autonomy_eligibility(NEW.kid_user_id);
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.family_decision_followups() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_decision_followups ON public.family_decisions;
CREATE TRIGGER family_decision_followups AFTER INSERT ON public.family_decisions
    FOR EACH ROW EXECUTE FUNCTION public.family_decision_followups();

-- ── The child asks to talk; a Tutor closes a nudge ──────────────────────────
CREATE OR REPLACE FUNCTION public.family_talk_request(p_kid uuid, p_decision uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_id uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    SELECT id INTO v_id FROM public.family_talk_nudges WHERE decision_id = p_decision AND origin = 'child' AND kid_user_id = p_kid;
    IF FOUND THEN
        RETURN v_id;
    END IF;
    INSERT INTO public.family_talk_nudges (kid_user_id, origin, decision_id) VALUES (p_kid, 'child', p_decision)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.family_talk_close(p_nudge uuid, p_actor uuid, p_outcome text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_kid uuid;
BEGIN
    SELECT kid_user_id INTO v_kid FROM public.family_talk_nudges WHERE id = p_nudge;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TALK_NUDGE_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_kid::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, v_kid) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF p_outcome IS NULL OR p_outcome NOT IN ('talked', 'dismissed') THEN
        RAISE EXCEPTION 'TALK_NUDGE_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.family_talk_nudges SET status = p_outcome, closed_by = p_actor WHERE id = p_nudge AND status = 'open';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TALK_NUDGE_CLOSED' USING ERRCODE = 'P0001';
    END IF;
    RETURN p_outcome;
END;
$$;
REVOKE ALL ON FUNCTION public.family_talk_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_talk_close(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_talk_request(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_talk_close(uuid, uuid, text) TO service_role;

-- ── Appendix H: Independence-Tier Progression Rate (Diagnostic) ─────────────
-- Of the children who first became eligible for a level since p_since and
-- whose window has passed, how many reached that level within the window.
CREATE OR REPLACE FUNCTION public.family_autonomy_progression(p_since timestamptz, p_window_days int DEFAULT 30)
RETURNS TABLE (level int, judged bigint, progressed bigint, waiting bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT lv.level,
           count(e.kid_user_id) FILTER (WHERE e.first_eligible_at <= now() - make_interval(days => p_window_days)),
           count(e.kid_user_id) FILTER (WHERE e.first_eligible_at <= now() - make_interval(days => p_window_days) AND EXISTS (
               SELECT 1 FROM public.family_autonomy_changes c
               WHERE c.kid_user_id = e.kid_user_id AND c.to_level >= e.level AND c.to_level > c.from_level
                 AND c.created_at >= e.first_eligible_at AND c.created_at <= e.first_eligible_at + make_interval(days => p_window_days))),
           count(e.kid_user_id) FILTER (WHERE e.first_eligible_at > now() - make_interval(days => p_window_days))
    FROM (VALUES (2), (3)) AS lv (level)
    LEFT JOIN public.family_autonomy_eligibility_log e ON e.level = lv.level AND e.first_eligible_at >= p_since
    GROUP BY lv.level
    ORDER BY lv.level;
$$;

-- The rollback path in use: levels lowered since p_since, by who lowered them.
CREATE OR REPLACE FUNCTION public.family_autonomy_step_downs(p_since timestamptz)
RETURNS TABLE (actor_kind text, step_downs bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT k.actor_kind, count(c.id)
    FROM (VALUES ('tutor'), ('child'), ('staff'), ('system')) AS k (actor_kind)
    LEFT JOIN public.family_autonomy_changes c
      ON c.actor_kind = k.actor_kind AND c.to_level < c.from_level AND c.created_at >= p_since
    GROUP BY k.actor_kind
    ORDER BY k.actor_kind;
$$;

-- ── Appendix H: Repeated-Denial Communication-Nudge Trigger Rate ────────────
-- Recomputes the qualifying patterns from the decision record alone (an
-- episode starts at the first "not yet" that makes three in 14 days, and the
-- next one no sooner than 14 days later) and counts how many opened their
-- nudge in the same transaction.
CREATE OR REPLACE FUNCTION public.family_talk_nudge_rate(p_since timestamptz)
RETURNS TABLE (patterns bigint, nudged bigint, child_asks bigint, talked bigint, dismissed bigint, still_open bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH RECURSIVE negative AS (
        SELECT d.kid_user_id, d.created_at
        FROM public.family_decisions d
        WHERE NOT d.legacy AND public.family_decision_not_approved(d.outcome, d.prior_status)
          AND d.created_at >= p_since - make_interval(days => public.family_autonomy_threshold('talk_nudge_window_days'))
    ), qualifying AS (
        SELECT DISTINCT n.kid_user_id, n.created_at
        FROM negative n
        WHERE (SELECT count(*) FROM negative x
               WHERE x.kid_user_id = n.kid_user_id AND x.created_at <= n.created_at
                 AND x.created_at > n.created_at - make_interval(days => public.family_autonomy_threshold('talk_nudge_window_days')))
              >= public.family_autonomy_threshold('talk_nudge_denials')
    ), episodes AS (
        SELECT q.kid_user_id, min(q.created_at) AS started FROM qualifying q GROUP BY q.kid_user_id
        UNION ALL
        SELECT e.kid_user_id,
               (SELECT min(q.created_at) FROM qualifying q
                WHERE q.kid_user_id = e.kid_user_id
                  AND q.created_at >= e.started + make_interval(days => public.family_autonomy_threshold('talk_nudge_window_days')))
        FROM episodes e
        WHERE e.started IS NOT NULL
    ), counted AS (
        SELECT e.kid_user_id, e.started FROM episodes e WHERE e.started IS NOT NULL AND e.started >= p_since
    )
    SELECT (SELECT count(*) FROM counted),
           (SELECT count(*) FROM counted c WHERE EXISTS (
                SELECT 1 FROM public.family_talk_nudges n
                WHERE n.kid_user_id = c.kid_user_id AND n.origin = 'pattern' AND n.created_at = c.started)),
           (SELECT count(*) FROM public.family_talk_nudges n WHERE n.origin = 'child' AND n.created_at >= p_since),
           (SELECT count(*) FROM public.family_talk_nudges n WHERE n.status = 'talked' AND n.created_at >= p_since),
           (SELECT count(*) FROM public.family_talk_nudges n WHERE n.status = 'dismissed' AND n.created_at >= p_since),
           (SELECT count(*) FROM public.family_talk_nudges n WHERE n.status = 'open' AND n.created_at >= p_since);
$$;

-- ── Appendix H: Denial-Reason Actionability Rate (human-scored) ─────────────
-- Staff score a random sample of "not yet" reasons as actionable or not. The
-- sample carries the reason text and its code only: no child, family or
-- decision identity beyond an opaque id, and only from children the H.1
-- analytics gate admits (family_analytics_admitted, S07.4).
CREATE TABLE IF NOT EXISTS public.family_denial_reason_scores (
    decision_id uuid PRIMARY KEY REFERENCES public.family_decisions (id) ON DELETE CASCADE,
    actionable  boolean NOT NULL,
    scored_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    scored_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.family_denial_reason_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_denial_reason_scores FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.family_denial_reason_scores FROM service_role;

CREATE OR REPLACE FUNCTION public.family_staff_may_view_analytics(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'superadmin')
        OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'admin')
            AND EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = p_user AND permission = 'view_analytics'));
$$;
REVOKE ALL ON FUNCTION public.family_staff_may_view_analytics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_staff_may_view_analytics(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.family_denial_reason_sample(p_since timestamptz, p_limit int DEFAULT 20)
RETURNS TABLE (decision_id uuid, subject text, outcome text, reason_code text, reason text, created_at timestamptz)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
    SELECT d.id, d.subject, d.outcome, d.reason_code, d.reason, d.created_at
    FROM public.family_decisions d
    WHERE NOT d.legacy AND d.outcome IN ('sent_back', 'cancelled', 'denied', 'declined', 'questioned') AND d.reason IS NOT NULL
      AND d.created_at >= p_since AND public.family_analytics_admitted(d.kid_user_id)
      AND NOT EXISTS (SELECT 1 FROM public.family_denial_reason_scores s WHERE s.decision_id = d.id)
    ORDER BY random()
    LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

CREATE OR REPLACE FUNCTION public.family_score_denial_reason(p_decision uuid, p_staff uuid, p_actionable boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v public.family_decisions%ROWTYPE;
BEGIN
    IF NOT public.family_staff_may_view_analytics(p_staff) THEN
        RAISE EXCEPTION 'DENIAL_SCORE_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v FROM public.family_decisions WHERE id = p_decision;
    IF NOT FOUND OR v.legacy OR p_actionable IS NULL OR v.reason IS NULL
       OR v.outcome NOT IN ('sent_back', 'cancelled', 'denied', 'declined', 'questioned')
       OR NOT public.family_analytics_admitted(v.kid_user_id) THEN
        RAISE EXCEPTION 'DENIAL_SCORE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.family_denial_reason_scores (decision_id, actionable, scored_by) VALUES (p_decision, p_actionable, p_staff)
    ON CONFLICT (decision_id) DO NOTHING;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.family_denial_actionability(p_since timestamptz)
RETURNS TABLE (denials bigint, structured bigint, admitted bigint, scored bigint, actionable bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT count(*),
           count(*) FILTER (WHERE d.reason_code IS NOT NULL AND d.reason IS NOT NULL),
           count(*) FILTER (WHERE public.family_analytics_admitted(d.kid_user_id)),
           count(s.decision_id),
           count(s.decision_id) FILTER (WHERE s.actionable)
    FROM public.family_decisions d
    LEFT JOIN public.family_denial_reason_scores s ON s.decision_id = d.id
    WHERE NOT d.legacy AND d.outcome IN ('sent_back', 'cancelled', 'denied', 'declined', 'questioned') AND d.created_at >= p_since;
$$;

REVOKE ALL ON FUNCTION public.family_autonomy_progression(timestamptz, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_autonomy_step_downs(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_talk_nudge_rate(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_denial_reason_sample(timestamptz, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_score_denial_reason(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_denial_actionability(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_autonomy_progression(timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_autonomy_step_downs(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_talk_nudge_rate(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_denial_reason_sample(timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_score_denial_reason(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_denial_actionability(timestamptz) TO service_role;

SELECT 'family_talk_nudges_ok' AS sentinel;
