-- family_autonomy_rules — S07.5, part 2 of 6 (D.17, D.18): the level in
-- force, the documented eligibility rule, what a level admits, and the guards
-- of the decision record and of the child's level requests.
-- @phase: expand
--
-- Rationale: family_autonomy_ladder (part 1) and
-- docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- ── The level a child is on, as every rule reads it ─────────────────────────
-- The stored level is capped by age at the moment of use: if a Tutor removes
-- or changes a birth date, the level falls back to what the age allows, and
-- the pre-approved amount to what that level allows. A child outside a
-- family is on Level 1 with nothing pre-approved.
CREATE OR REPLACE FUNCTION public.family_autonomy_cap(p_level int)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT CASE p_level
        WHEN 3 THEN public.family_autonomy_threshold('level3_preapproved_cap')
        WHEN 2 THEN public.family_autonomy_threshold('level2_preapproved_cap')
        ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.family_autonomy_level(p_kid uuid)
RETURNS TABLE (level int, preapproved_limit int, stored_level int, stored_limit int, level_since timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_row   public.family_autonomy_levels%ROWTYPE;
    v_age   int;
    v_level int;
BEGIN
    SELECT * INTO v_row FROM public.family_autonomy_levels WHERE kid_user_id = p_kid;
    IF NOT FOUND THEN
        v_row.level := 1;
        v_row.preapproved_limit := 0;
        v_row.level_since := NULL;
    END IF;
    v_age := public.family_child_age(p_kid);
    IF NOT public.family_child_in_family(p_kid) THEN
        v_level := 1;
    ELSIF v_row.level >= 3 AND v_age >= public.family_autonomy_threshold('level3_min_age') THEN
        v_level := 3;
    ELSIF v_row.level >= 2 AND v_age >= public.family_autonomy_threshold('level2_min_age') THEN
        v_level := 2;
    ELSE
        v_level := 1;
    END IF;
    RETURN QUERY SELECT v_level, least(v_row.preapproved_limit, public.family_autonomy_cap(v_level)),
                        v_row.level::int, v_row.preapproved_limit, v_row.level_since;
END;
$$;

REVOKE ALL ON FUNCTION public.family_autonomy_cap(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_autonomy_level(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_autonomy_cap(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_autonomy_level(uuid) TO service_role;

-- Does a decision count against the track record? A chore sent back, a chore
-- cancelled after the child said it was done, a reward denied, a
-- self-directed item a Tutor questioned. Asking for a level and hearing "not
-- yet" never counts: asking to grow is not a failure.
CREATE OR REPLACE FUNCTION public.family_decision_not_approved(p_outcome text, p_prior_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT p_outcome IN ('sent_back', 'denied', 'questioned') OR (p_outcome = 'cancelled' AND p_prior_status = 'done');
$$;
REVOKE ALL ON FUNCTION public.family_decision_not_approved(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_decision_not_approved(text, text) TO service_role;

-- The track record over the window: requests approved (a Tutor's approval,
-- or a self-directed item nobody questioned) and requests not approved.
CREATE OR REPLACE FUNCTION public.family_autonomy_record(p_kid uuid)
RETURNS TABLE (approved bigint, not_approved bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT count(*) FILTER (WHERE d.outcome = 'approved'
                              OR (d.outcome IN ('self_logged', 'preapproved')
                                  AND NOT EXISTS (SELECT 1 FROM public.family_decisions q
                                                  WHERE q.reviews_decision_id = d.id AND q.outcome = 'questioned'))),
           count(*) FILTER (WHERE public.family_decision_not_approved(d.outcome, d.prior_status))
    FROM public.family_decisions d
    WHERE d.kid_user_id = p_kid AND d.subject IN ('task', 'redemption')
      AND d.created_at > now() - make_interval(days => public.family_autonomy_threshold('record_window_days'));
$$;
REVOKE ALL ON FUNCTION public.family_autonomy_record(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_autonomy_record(uuid) TO service_role;

-- The documented eligibility rule for one level, with every number the child
-- and the Tutor see ("7 of 10 approved"). Level 2: age 8+, 10 approved in 60
-- days, at most 25% not approved. Level 3: age 12+, on Level 2 for 28 days,
-- 20 approved in 60 days, at most 20% not approved.
CREATE OR REPLACE FUNCTION public.family_autonomy_eligibility(p_kid uuid, p_level int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_prefix   text := 'level' || p_level || '_';
    v_age      int := public.family_child_age(p_kid);
    v_cur      record;
    v_rec      record;
    v_min_age  int;
    v_min_ok   int;
    v_max_pct  int;
    v_min_days int := 0;
    v_days     int := 0;
    v_age_ok   boolean;
    v_count_ok boolean;
    v_share_ok boolean;
    v_days_ok  boolean;
BEGIN
    IF p_level NOT IN (2, 3) THEN
        RETURN NULL;
    END IF;
    SELECT * INTO v_cur FROM public.family_autonomy_level(p_kid);
    SELECT * INTO v_rec FROM public.family_autonomy_record(p_kid);
    v_min_age := public.family_autonomy_threshold(v_prefix || 'min_age');
    v_min_ok := public.family_autonomy_threshold(v_prefix || 'min_approved');
    v_max_pct := public.family_autonomy_threshold(v_prefix || 'max_not_approved_pct');
    IF p_level = 3 THEN
        v_min_days := public.family_autonomy_threshold('level3_min_days_at_level2');
        IF v_cur.level >= 2 AND v_cur.level_since IS NOT NULL THEN
            v_days := greatest(0, (current_date - (v_cur.level_since AT TIME ZONE 'utc')::date));
        END IF;
        v_days_ok := v_cur.level >= 2 AND v_days >= v_min_days;
    ELSE
        v_days_ok := true;
    END IF;
    v_age_ok := v_age IS NOT NULL AND v_age >= v_min_age;
    v_count_ok := v_rec.approved >= v_min_ok;
    v_share_ok := v_rec.not_approved * 100 <= v_max_pct * (v_rec.approved + v_rec.not_approved);
    RETURN jsonb_build_object(
        'level', p_level,
        'in_family', public.family_child_in_family(p_kid),
        'age', v_age, 'min_age', v_min_age, 'age_ok', v_age_ok,
        'approved', v_rec.approved, 'min_approved', v_min_ok,
        'not_approved', v_rec.not_approved, 'max_not_approved_pct', v_max_pct, 'share_ok', v_share_ok,
        'days_at_level', v_days, 'min_days', v_min_days, 'days_ok', v_days_ok,
        'window_days', public.family_autonomy_threshold('record_window_days'),
        'eligible', public.family_child_in_family(p_kid) AND v_age_ok AND v_count_ok AND v_share_ok AND v_days_ok);
END;
$$;
REVOKE ALL ON FUNCTION public.family_autonomy_eligibility(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_autonomy_eligibility(uuid, int) TO service_role;

CREATE OR REPLACE FUNCTION public.family_autonomy_eligible_for(p_kid uuid, p_level int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce((public.family_autonomy_eligibility(p_kid, p_level) ->> 'eligible')::boolean, false);
$$;
REVOKE ALL ON FUNCTION public.family_autonomy_eligible_for(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_autonomy_eligible_for(uuid, int) TO service_role;

-- What a level lets the child do without a Tutor's tap. The spending limit
-- and the freeze are checked separately and apply at every level.
CREATE OR REPLACE FUNCTION public.family_autonomy_admits_task(p_kid uuid, p_kind text, p_coins int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE
        WHEN l.level >= 3 THEN p_kind = 'contribution' OR p_coins <= public.family_autonomy_threshold('level3_self_log_max_coins')
        WHEN l.level = 2 THEN p_kind = 'contribution'
        ELSE false END
    FROM public.family_autonomy_level(p_kid) l;
$$;

CREATE OR REPLACE FUNCTION public.family_autonomy_admits_reward(p_kid uuid, p_cost int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT l.level >= 2 AND l.preapproved_limit > 0 AND p_cost <= l.preapproved_limit
    FROM public.family_autonomy_level(p_kid) l;
$$;
REVOKE ALL ON FUNCTION public.family_autonomy_admits_task(uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_autonomy_admits_reward(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_autonomy_admits_task(uuid, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_autonomy_admits_reward(uuid, int) TO service_role;

-- ── The decision guard (D.18), for every writer ─────────────────────────────
-- The subject's state is read from the subject itself (never trusted from the
-- row), the actor must be the one this outcome belongs to, and every "not
-- yet" carries a code from its subject's vocabulary and an actionable reason.
CREATE OR REPLACE FUNCTION public.guard_family_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_kid      uuid;
    v_status   text;
    v_reviewed public.family_decisions%ROWTYPE;
    v_codes    text[];
    v_negative boolean;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW)) = '{}'::text[]
           OR public.family_only_nulled(public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW)), ARRAY['actor_user_id'], to_jsonb(NEW)) THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'DECISION_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.legacy THEN
        RAISE EXCEPTION 'DECISION_LEGACY_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.subject = 'task' THEN
        SELECT assigned_to, status INTO v_kid, v_status FROM public.tasks WHERE id = NEW.task_id;
        v_codes := ARRAY['not_finished', 'redo', 'not_suitable', 'talk_first'];
    ELSIF NEW.subject = 'redemption' THEN
        SELECT kid_user_id, status INTO v_kid, v_status FROM public.redemptions WHERE id = NEW.redemption_id;
        v_codes := ARRAY['save_more', 'later_date', 'not_suitable', 'talk_first'];
    ELSE
        SELECT kid_user_id, status INTO v_kid, v_status FROM public.family_autonomy_requests WHERE id = NEW.level_request_id;
        v_codes := ARRAY['practice_more', 'later_date', 'talk_first'];
    END IF;
    IF v_kid IS NULL OR v_kid <> NEW.kid_user_id THEN
        RAISE EXCEPTION 'DECISION_SUBJECT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    NEW.prior_status := v_status;
    NEW.created_at := now();

    -- The outcome must fit the subject and its current state.
    IF NOT (
        (NEW.subject = 'task' AND (
            (NEW.outcome IN ('approved', 'self_logged', 'sent_back') AND v_status = 'done')
            OR (NEW.outcome = 'cancelled' AND v_status IN ('open', 'done'))
            OR (NEW.outcome IN ('confirmed', 'questioned') AND v_status = 'approved')))
        OR (NEW.subject = 'redemption' AND (
            (NEW.outcome IN ('approved', 'preapproved', 'denied') AND v_status = 'requested')
            OR (NEW.outcome IN ('confirmed', 'questioned') AND v_status IN ('approved', 'fulfilled'))))
        OR (NEW.subject = 'level_request' AND NEW.outcome IN ('granted', 'declined') AND v_status = 'pending')
    ) THEN
        RAISE EXCEPTION 'DECISION_OUTCOME_INVALID' USING ERRCODE = 'P0001',
            DETAIL = format('%s %s from %s', NEW.subject, NEW.outcome, v_status);
    END IF;

    -- Who may decide what.
    IF NEW.outcome IN ('self_logged', 'preapproved') THEN
        IF NEW.actor_kind <> 'child' OR NEW.actor_user_id IS DISTINCT FROM NEW.kid_user_id THEN
            RAISE EXCEPTION 'DECISION_ACTOR_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF NEW.actor_kind <> 'tutor' OR NOT public.family_is_verified_guardian(NEW.actor_user_id, NEW.kid_user_id) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;

    -- A review names the self-directed decision it looks at, once.
    IF NEW.outcome IN ('confirmed', 'questioned') THEN
        SELECT * INTO v_reviewed FROM public.family_decisions WHERE id = NEW.reviews_decision_id;
        IF NOT FOUND OR v_reviewed.kid_user_id <> NEW.kid_user_id OR v_reviewed.subject <> NEW.subject
           OR v_reviewed.task_id IS DISTINCT FROM NEW.task_id OR v_reviewed.redemption_id IS DISTINCT FROM NEW.redemption_id
           OR v_reviewed.outcome NOT IN ('self_logged', 'preapproved') THEN
            RAISE EXCEPTION 'DECISION_REVIEW_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF NEW.reviews_decision_id IS NOT NULL THEN
        RAISE EXCEPTION 'DECISION_REVIEW_INVALID' USING ERRCODE = 'P0001';
    END IF;

    -- D.18: no "not yet" without a reason the child can act on.
    v_negative := NEW.outcome IN ('sent_back', 'cancelled', 'denied', 'declined', 'questioned');
    IF v_negative THEN
        IF NEW.reason_code IS NULL OR NOT (NEW.reason_code = ANY (v_codes)) OR NEW.reason IS NULL THEN
            RAISE EXCEPTION 'DECISION_REASON_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        NEW.reason := btrim(NEW.reason);
        IF NOT public.family_reason_actionable(NEW.reason) THEN
            RAISE EXCEPTION 'DECISION_REASON_NOT_ACTIONABLE' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.reason_code = 'later_date' THEN
            IF NEW.revisit_on IS NULL OR NEW.revisit_on < current_date + 1
               OR NEW.revisit_on > current_date + public.family_autonomy_threshold('revisit_max_days') THEN
                RAISE EXCEPTION 'DECISION_REVISIT_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.revisit_on IS NOT NULL THEN
            RAISE EXCEPTION 'DECISION_REVISIT_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSE
        -- A yes may carry an encouraging note; a self-directed item carries none.
        IF NEW.reason_code IS NOT NULL OR NEW.revisit_on IS NOT NULL
           OR (NEW.reason IS NOT NULL AND (NEW.outcome IN ('self_logged', 'preapproved') OR btrim(NEW.reason) = '')) THEN
            RAISE EXCEPTION 'DECISION_NOTE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        NEW.reason := nullif(btrim(NEW.reason), '');
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_family_decision() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER family_decision_guard BEFORE INSERT OR UPDATE ON public.family_decisions
    FOR EACH ROW EXECUTE FUNCTION public.guard_family_decision();

-- A decision that changes a subject must be the one the subject now points
-- at when the transaction commits: no track-record row without the state
-- change it describes (a review changes no state, so it is exempt).
CREATE OR REPLACE FUNCTION public.check_family_decision_applied()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_applied uuid;
BEGIN
    IF NEW.legacy OR NEW.outcome IN ('confirmed', 'questioned') THEN
        RETURN NULL;
    END IF;
    IF NEW.subject = 'task' THEN
        SELECT (to_jsonb(t) ->> 'decision_id')::uuid INTO v_applied FROM public.tasks t WHERE t.id = NEW.task_id;
    ELSIF NEW.subject = 'redemption' THEN
        SELECT (to_jsonb(r) ->> 'decision_id')::uuid INTO v_applied FROM public.redemptions r WHERE r.id = NEW.redemption_id;
    ELSE
        SELECT decision_id INTO v_applied FROM public.family_autonomy_requests WHERE id = NEW.level_request_id;
    END IF;
    IF v_applied IS DISTINCT FROM NEW.id THEN
        RAISE EXCEPTION 'DECISION_UNAPPLIED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.check_family_decision_applied() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_decision_applied ON public.family_decisions;
CREATE CONSTRAINT TRIGGER family_decision_applied AFTER INSERT ON public.family_decisions
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_family_decision_applied();

-- ── The level-request guard ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_family_autonomy_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_decision public.family_decisions%ROWTYPE;
    v_level    int;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT stored_level INTO v_level FROM public.family_autonomy_level(NEW.kid_user_id);
        IF NOT public.family_child_in_family(NEW.kid_user_id) THEN
            RAISE EXCEPTION 'AUTONOMY_NOT_IN_FAMILY' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.status <> 'pending' OR NEW.decided_at IS NOT NULL OR NEW.decision_id IS NOT NULL
           OR NEW.requested_level <> v_level + 1 THEN
            RAISE EXCEPTION 'AUTONOMY_REQUEST_INVALID' USING ERRCODE = 'P0001';
        END IF;
        NEW.created_at := now();
        RETURN NEW;
    END IF;
    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['decision_id'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'kid_user_id', 'requested_level', 'child_note', 'created_at'] THEN
        RAISE EXCEPTION 'AUTONOMY_REQUEST_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_decision FROM public.family_decisions WHERE id = NEW.decision_id;
    IF OLD.status <> 'pending' OR NEW.status NOT IN ('granted', 'declined') OR NOT FOUND
       OR v_decision.level_request_id <> NEW.id OR v_decision.outcome <> NEW.status OR v_decision.created_at <> now() THEN
        RAISE EXCEPTION 'AUTONOMY_REQUEST_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status = 'granted' AND (SELECT stored_level FROM public.family_autonomy_level(NEW.kid_user_id)) < NEW.requested_level THEN
        RAISE EXCEPTION 'AUTONOMY_REQUEST_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
            DETAIL = 'A request is granted only once the level is reached.';
    END IF;
    NEW.decided_at := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_family_autonomy_request() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_autonomy_request_guard ON public.family_autonomy_requests;
CREATE TRIGGER family_autonomy_request_guard BEFORE INSERT OR UPDATE ON public.family_autonomy_requests
    FOR EACH ROW EXECUTE FUNCTION public.guard_family_autonomy_request();

SELECT 'family_autonomy_rules_ok' AS sentinel;
