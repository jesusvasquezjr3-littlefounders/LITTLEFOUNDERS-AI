-- family_decision_flows — S07.5, part 5 of 6 (D.17, D.18): the redemption
-- guard, the legacy decide call and the flows that decide chores and reward
-- requests through the ladder.
-- @phase: contract
-- @after-release: none — a reward request can no longer be denied without a
--   decision row carrying an actionable reason (the current Core's deny call
--   is refused until the S07.5 Core ships); approvals keep working and record
--   themselves. Apply with the Core release that ships the S07.5 routes,
--   after family_decision_guards.
--
-- Rationale: family_decision_guards (part 4) and
-- docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- ── Redemption state machine (S07.1 rules verbatim, plus S07.5) ─────────────
CREATE OR REPLACE FUNCTION public.guard_redemption_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_item     public.redemption_catalog%ROWTYPE;
    v_limit    public.spend_limits%ROWTYPE;
    v_used     bigint;
    v_decision public.family_decisions%ROWTYPE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'requested' OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.fulfilled_by IS NOT NULL OR NEW.fulfilled_at IS NOT NULL OR NEW.decision_id IS NOT NULL THEN
            RAISE EXCEPTION 'REDEMPTION_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        SELECT * INTO v_item FROM public.redemption_catalog WHERE id = NEW.catalog_id;
        IF NOT FOUND OR NOT v_item.active OR NOT public.family_is_verified_guardian(v_item.parent_user_id, NEW.kid_user_id) THEN
            RAISE EXCEPTION 'REWARD_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;
        -- The same rolling-window spend limit Core checks at request time.
        SELECT * INTO v_limit FROM public.spend_limits WHERE kid_user_id = NEW.kid_user_id AND active;
        IF FOUND THEN
            SELECT coalesce(-sum(amount), 0) INTO v_used FROM public.wallet_ledger
            WHERE kid_user_id = NEW.kid_user_id AND bucket = 'spend' AND reason = 'redemption'
              AND created_at >= now() - CASE WHEN v_limit.period = 'weekly' THEN interval '7 days' ELSE interval '30 days' END;
            IF v_used + v_item.cost > v_limit.cap THEN
                RAISE EXCEPTION 'SPEND_LIMIT_REACHED' USING ERRCODE = 'P0001';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['fulfilled_by', 'decision_id'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'catalog_id', 'kid_user_id', 'created_at', 'child_reason_kind', 'child_note'] THEN
        RAISE EXCEPTION 'REDEMPTION_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'requested' AND NEW.status IN ('approved', 'denied') THEN
            IF NEW.status = 'approved' AND NEW.decided_by IS NULL AND NEW.decision_id IS NOT NULL THEN
                -- S07.5 (D.17): pre-approved by the child's level, still
                -- inside the spending limit (checked at insert) and never
                -- while the account is frozen.
                v_decision := public.family_decision_matches(NEW.decision_id, 'redemption', NEW.id, 'preapproved');
                IF v_decision.id IS NULL OR NEW.decided_at IS NULL THEN
                    RAISE EXCEPTION 'REDEMPTION_DECISION_REQUIRED' USING ERRCODE = 'P0001';
                END IF;
                SELECT * INTO v_item FROM public.redemption_catalog WHERE id = NEW.catalog_id;
                IF NOT public.family_autonomy_admits_reward(NEW.kid_user_id, v_item.cost) THEN
                    RAISE EXCEPTION 'REDEMPTION_PREAPPROVAL_FORBIDDEN' USING ERRCODE = 'P0001';
                END IF;
                IF NOT public.banking_movement_allowed(NEW.kid_user_id) THEN
                    RAISE EXCEPTION 'ACCOUNT_FROZEN' USING ERRCODE = 'P0001';
                END IF;
            ELSE
                IF NOT public.family_is_verified_guardian(NEW.decided_by, NEW.kid_user_id) OR NEW.decided_at IS NULL THEN
                    RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
                END IF;
                v_decision := public.family_decision_matches(NEW.decision_id, 'redemption', NEW.id, NEW.status);
                IF v_decision.id IS NULL OR v_decision.actor_user_id IS DISTINCT FROM NEW.decided_by THEN
                    RAISE EXCEPTION 'DECISION_REASON_REQUIRED' USING ERRCODE = 'P0001';
                END IF;
            END IF;
            IF NEW.fulfilled_by IS NOT NULL OR NEW.fulfilled_at IS NOT NULL THEN
                RAISE EXCEPTION 'REDEMPTION_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.status = 'approved' AND NOT EXISTS (
                SELECT 1 FROM public.wallet_ledger
                WHERE redemption_id = NEW.id AND reason = 'redemption' AND amount < 0
            ) THEN
                RAISE EXCEPTION 'REDEMPTION_NOT_PAID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status = 'approved' AND NEW.status = 'fulfilled' THEN
            IF NOT public.family_is_verified_guardian(NEW.fulfilled_by, NEW.kid_user_id) OR NEW.fulfilled_at IS NULL THEN
                RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
            END IF;
            IF v_changed && ARRAY['decided_by', 'decided_at', 'decision_id'] THEN
                RAISE EXCEPTION 'REDEMPTION_DECISION_IMMUTABLE' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            RAISE EXCEPTION 'REDEMPTION_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
                DETAIL = format('%s -> %s', OLD.status, NEW.status);
        END IF;
    ELSIF v_changed && ARRAY['decided_by', 'decided_at', 'fulfilled_by', 'fulfilled_at', 'decision_id'] THEN
        RAISE EXCEPTION 'REDEMPTION_DECISION_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_redemption_state() FROM PUBLIC, anon, authenticated, service_role;

-- ── The legacy decide call: a yes still works; a no needs its reason ────────
-- (enforce_banking_freeze's function verbatim for approval; a denial is now
-- family_decide_redemption's, because it carries the D.18 reason.)
CREATE OR REPLACE FUNCTION public.decide_redemption(
    p_redemption_id uuid,
    p_approve       boolean,
    p_decided_by    uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kid_user_id uuid;
    v_redemption  public.redemptions%ROWTYPE;
    v_cost        int;
    v_balance     int;
BEGIN
    IF NOT p_approve THEN
        RAISE EXCEPTION 'DECISION_REASON_REQUIRED' USING ERRCODE = 'P0001',
            DETAIL = 'A denial carries a reason: use family_decide_redemption.';
    END IF;
    SELECT kid_user_id INTO v_kid_user_id FROM public.redemptions WHERE id = p_redemption_id;
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_kid_user_id::text, 1));
    IF NOT public.banking_movement_allowed(v_kid_user_id) THEN RETURN false; END IF;

    SELECT * INTO v_redemption FROM public.redemptions
    WHERE id = p_redemption_id
    FOR UPDATE;

    IF NOT FOUND OR v_redemption.status <> 'requested' THEN
        RETURN false;
    END IF;

    SELECT cost INTO v_cost FROM public.redemption_catalog WHERE id = v_redemption.catalog_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM public.wallet_ledger
    WHERE kid_user_id = v_redemption.kid_user_id AND bucket = 'spend';

    IF v_cost IS NULL OR v_balance < v_cost THEN
        RETURN false;
    END IF;

    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, redemption_id, created_by)
    VALUES (v_redemption.kid_user_id, 'spend', -v_cost, 'redemption', p_redemption_id, p_decided_by);

    UPDATE public.redemptions
    SET status = 'approved', decided_at = now(), decided_by = p_decided_by
    WHERE id = p_redemption_id;

    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_redemption(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_redemption(uuid, boolean, uuid) TO service_role;

-- ── Producing flows (service role only; the guards decide) ──────────────────

-- The level admits a chore that is done: approve it under the level. Returns
-- false (nothing changes) when the level, the kind, the coins or a missing
-- photo keep it for the Tutor.
CREATE OR REPLACE FUNCTION public.family_task_self_log(p_task uuid, p_kid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_task     public.tasks%ROWTYPE;
    v_decision uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task FOR UPDATE;
    IF NOT FOUND OR v_task.assigned_to <> p_kid THEN
        RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_task.status <> 'done'
       OR (v_task.requires_evidence AND (v_task.evidence_bucket IS NULL OR v_task.evidence_hash IS NULL OR v_task.evidence_ext IS NULL))
       OR NOT public.family_autonomy_admits_task(p_kid, v_task.kind, v_task.reward_coins) THEN
        RETURN false;
    END IF;
    INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind)
    VALUES (p_kid, 'task', p_task, 'done', 'self_logged', p_kid, 'child') RETURNING id INTO v_decision;
    UPDATE public.tasks SET status = 'approved', decided_at = now(), decision_id = v_decision WHERE id = p_task;
    RETURN true;
END;
$$;

-- The child marks a chore done, optionally with a note for the Tutor; the
-- level then decides whether it waits for the Tutor or is self-logged.
CREATE OR REPLACE FUNCTION public.family_task_mark_done(p_task uuid, p_kid uuid, p_completed_on date, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_note text := nullif(btrim(coalesce(p_note, '')), '');
    v_task public.tasks%ROWTYPE;
    v_self boolean;
BEGIN
    IF v_note IS NOT NULL AND char_length(v_note) > public.family_autonomy_threshold('child_note_max_chars') THEN
        RAISE EXCEPTION 'TASK_NOTE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task FOR UPDATE;
    IF NOT FOUND OR v_task.assigned_to <> p_kid THEN
        RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_task.status <> 'open' THEN
        RAISE EXCEPTION 'TASK_NOT_OPEN' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.tasks SET status = 'done', completed_on = p_completed_on, child_note = v_note WHERE id = p_task;
    v_self := public.family_task_self_log(p_task, p_kid);
    RETURN jsonb_build_object('status', CASE WHEN v_self THEN 'approved' ELSE 'done' END, 'self_logged', v_self);
END;
$$;

-- A Tutor decides a chore: approve (an optional encouraging note), send it
-- back to finish, or cancel it. Both "not yet" outcomes need a reason code
-- and an actionable reason; the decision guard checks them.
CREATE OR REPLACE FUNCTION public.family_decide_task(
    p_task uuid, p_actor uuid, p_outcome text, p_reason_code text, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_kid      uuid;
    v_task     public.tasks%ROWTYPE;
    v_decision uuid;
    v_reason   text;
BEGIN
    IF p_outcome IS NULL OR p_outcome NOT IN ('approved', 'sent_back', 'cancelled') THEN
        RAISE EXCEPTION 'DECISION_OUTCOME_INVALID' USING ERRCODE = 'P0001';
    END IF;
    SELECT assigned_to INTO v_kid FROM public.tasks WHERE id = p_task;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_kid::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, v_kid) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task FOR UPDATE;
    INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind, reason_code, reason)
    VALUES (v_kid, 'task', p_task, v_task.status, p_outcome, p_actor, 'tutor', p_reason_code, p_reason)
    RETURNING id, reason INTO v_decision, v_reason;
    IF p_outcome = 'approved' THEN
        UPDATE public.tasks SET status = 'approved', decided_by = p_actor, decided_at = now(), decision_id = v_decision WHERE id = p_task;
    ELSIF p_outcome = 'sent_back' THEN
        UPDATE public.tasks SET status = 'open', completed_on = NULL, decision_id = v_decision WHERE id = p_task;
    ELSE
        UPDATE public.tasks SET status = 'cancelled', decided_by = p_actor, decided_at = now(), cancel_reason = v_reason, decision_id = v_decision
        WHERE id = p_task;
    END IF;
    RETURN CASE p_outcome WHEN 'approved' THEN 'approved' WHEN 'sent_back' THEN 'open' ELSE 'cancelled' END;
END;
$$;

-- The child asks for a reward with their reason; the level may pre-approve it.
CREATE OR REPLACE FUNCTION public.family_request_redemption(p_kid uuid, p_catalog uuid, p_reason_kind text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_note     text := nullif(btrim(coalesce(p_note, '')), '');
    v_id       uuid;
    v_cost     int;
    v_balance  bigint;
    v_decision uuid;
BEGIN
    IF p_reason_kind IS NULL OR p_reason_kind NOT IN ('saved_for_it', 'treat', 'need_it', 'for_someone', 'other') THEN
        RAISE EXCEPTION 'REDEMPTION_REASON_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF v_note IS NOT NULL AND char_length(v_note) > public.family_autonomy_threshold('child_note_max_chars') THEN
        RAISE EXCEPTION 'REDEMPTION_NOTE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    INSERT INTO public.redemptions (catalog_id, kid_user_id, child_reason_kind, child_note)
    VALUES (p_catalog, p_kid, p_reason_kind, v_note) RETURNING id INTO v_id;
    SELECT cost INTO v_cost FROM public.redemption_catalog WHERE id = p_catalog;
    SELECT coalesce(sum(amount), 0) INTO v_balance FROM public.wallet_ledger WHERE kid_user_id = p_kid AND bucket = 'spend';
    IF public.family_autonomy_admits_reward(p_kid, v_cost) AND public.banking_movement_allowed(p_kid) AND v_balance >= v_cost THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, redemption_id, created_by)
        VALUES (p_kid, 'spend', -v_cost, 'redemption', v_id, p_kid);
        INSERT INTO public.family_decisions (kid_user_id, subject, redemption_id, prior_status, outcome, actor_user_id, actor_kind)
        VALUES (p_kid, 'redemption', v_id, 'requested', 'preapproved', p_kid, 'child') RETURNING id INTO v_decision;
        UPDATE public.redemptions SET status = 'approved', decided_at = now(), decision_id = v_decision WHERE id = v_id;
        RETURN jsonb_build_object('id', v_id, 'status', 'approved', 'preapproved', true);
    END IF;
    RETURN jsonb_build_object('id', v_id, 'status', 'requested', 'preapproved', false);
END;
$$;

-- A Tutor decides a reward request: yes (paid now, never while frozen) or a
-- denial with a code, an actionable reason and, for "later", a date.
CREATE OR REPLACE FUNCTION public.family_decide_redemption(
    p_redemption uuid, p_actor uuid, p_approve boolean, p_reason_code text, p_reason text, p_revisit_on date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_kid        uuid;
    v_redemption public.redemptions%ROWTYPE;
    v_cost       int;
    v_balance    bigint;
    v_decision   uuid;
BEGIN
    SELECT kid_user_id INTO v_kid FROM public.redemptions WHERE id = p_redemption;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'REDEMPTION_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_kid::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, v_kid) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_redemption FROM public.redemptions WHERE id = p_redemption FOR UPDATE;
    IF v_redemption.status <> 'requested' THEN
        RAISE EXCEPTION 'REDEMPTION_DECIDED' USING ERRCODE = 'P0001';
    END IF;
    IF p_approve THEN
        IF NOT public.banking_movement_allowed(v_kid) THEN
            RAISE EXCEPTION 'ACCOUNT_FROZEN' USING ERRCODE = 'P0001';
        END IF;
        SELECT cost INTO v_cost FROM public.redemption_catalog WHERE id = v_redemption.catalog_id;
        SELECT coalesce(sum(amount), 0) INTO v_balance FROM public.wallet_ledger WHERE kid_user_id = v_kid AND bucket = 'spend';
        IF v_cost IS NULL OR v_balance < v_cost THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
        END IF;
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, redemption_id, created_by)
        VALUES (v_kid, 'spend', -v_cost, 'redemption', p_redemption, p_actor);
        INSERT INTO public.family_decisions (kid_user_id, subject, redemption_id, prior_status, outcome, actor_user_id, actor_kind, reason)
        VALUES (v_kid, 'redemption', p_redemption, 'requested', 'approved', p_actor, 'tutor', p_reason) RETURNING id INTO v_decision;
        UPDATE public.redemptions SET status = 'approved', decided_by = p_actor, decided_at = now(), decision_id = v_decision WHERE id = p_redemption;
        RETURN 'approved';
    END IF;
    INSERT INTO public.family_decisions (kid_user_id, subject, redemption_id, prior_status, outcome, actor_user_id, actor_kind, reason_code, reason, revisit_on)
    VALUES (v_kid, 'redemption', p_redemption, 'requested', 'denied', p_actor, 'tutor', p_reason_code, p_reason, p_revisit_on)
    RETURNING id INTO v_decision;
    UPDATE public.redemptions SET status = 'denied', decided_by = p_actor, decided_at = now(), decision_id = v_decision WHERE id = p_redemption;
    RETURN 'denied';
END;
$$;

-- A Tutor looks at a self-directed item afterwards: "looks good" or a
-- question with an actionable reason the child reads. Coins already moved
-- stay where they are; a correction is the audited Tutor correction (S07.1).
CREATE OR REPLACE FUNCTION public.family_review_decision(
    p_decision uuid, p_actor uuid, p_outcome text, p_reason_code text, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_reviewed public.family_decisions%ROWTYPE;
BEGIN
    IF p_outcome IS NULL OR p_outcome NOT IN ('confirmed', 'questioned') THEN
        RAISE EXCEPTION 'DECISION_OUTCOME_INVALID' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_reviewed FROM public.family_decisions WHERE id = p_decision;
    IF NOT FOUND OR v_reviewed.outcome NOT IN ('self_logged', 'preapproved') THEN
        RAISE EXCEPTION 'DECISION_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_reviewed.kid_user_id::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, v_reviewed.kid_user_id) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.family_decisions WHERE reviews_decision_id = p_decision) THEN
        RAISE EXCEPTION 'DECISION_ALREADY_REVIEWED' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.family_decisions (kid_user_id, subject, task_id, redemption_id, prior_status, outcome, reviews_decision_id,
                                         actor_user_id, actor_kind, reason_code, reason)
    VALUES (v_reviewed.kid_user_id, v_reviewed.subject, v_reviewed.task_id, v_reviewed.redemption_id, 'approved', p_outcome, p_decision,
            p_actor, 'tutor', p_reason_code, p_reason);
    RETURN p_outcome;
END;
$$;

REVOKE ALL ON FUNCTION public.family_task_self_log(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_task_mark_done(uuid, uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_decide_task(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_request_redemption(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_decide_redemption(uuid, uuid, boolean, text, text, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_review_decision(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_task_self_log(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_task_mark_done(uuid, uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_decide_task(uuid, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_request_redemption(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_decide_redemption(uuid, uuid, boolean, text, text, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_review_decision(uuid, uuid, text, text, text) TO service_role;

-- Only the flows above write decisions and level requests.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.family_decisions, public.family_autonomy_requests FROM service_role;

SELECT 'family_decision_flows_ok' AS sentinel;
