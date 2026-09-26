-- family_decision_guards — S07.5, part 4 of 6 (D.17, D.18): chores and reward
-- requests decided through the ladder and the decision record (the columns and
-- the task guard here; the redemption guard and the flows in
-- family_decision_flows).
-- @phase: contract
-- @after-release: none — narrows what a writer may do with tasks and
--   redemptions: a chore can no longer be cancelled, and a reward request no
--   longer denied, without a decision row carrying an actionable reason
--   (D.18), so the current Core's optional-reason cancel and its deny call
--   are refused until the S07.5 Core ships. Approvals keep working for every
--   writer (a trigger records the decision). Apply with the Core release that
--   ships the S07.5 routes, after family_autonomy_flows.
--
-- WHAT CHANGES
--
-- D.18 (Appendix G §4.2, §4.5). A "not yet" is never a bare verdict:
--   - a chore the child marked done can be approved, SENT BACK (it returns to
--     open so the child can finish it: the visible next step), or cancelled;
--     sending back and cancelling each need a reason code and a reason
--     specific enough to act on;
--   - a reward request is approved or denied, and a denial needs the same
--     (and a date when the code is "later");
--   - the child's own words travel with the request: a note when marking a
--     chore done, and a reason (a closed set a young child can tap, plus an
--     optional note) when asking for a reward, surfaced to the Tutor at the
--     moment of decision.
--
-- D.17. The child's level decides what needs a tap:
--   - a chore the level admits is SELF-LOGGED: approved at once, by the
--     child, under the level (a chore that asks for a photo only once the
--     photo is in); the Tutor looks afterwards and may question it;
--   - a reward the level pre-approves is approved and paid at once, still
--     inside the spending limit and never while the account is frozen.
--
-- Every S07.1-S07.4 rule of the task and redemption guards is kept word for
-- word; the new rules only add to them. Every decision transition now points
-- at its decision row (tasks.decision_id, redemptions.decision_id), and the
-- deferred check of family_autonomy_ladder refuses a decision row whose
-- state change did not happen.

-- ── Columns ─────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS child_note text;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_child_note_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_child_note_check
    CHECK (child_note IS NULL OR (char_length(child_note) BETWEEN 1 AND 140 AND child_note = btrim(child_note)));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS decision_id uuid REFERENCES public.family_decisions (id) ON DELETE SET NULL;

ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS child_reason_kind text;
ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_child_reason_kind_check;
ALTER TABLE public.redemptions ADD CONSTRAINT redemptions_child_reason_kind_check
    CHECK (child_reason_kind IS NULL OR child_reason_kind IN ('saved_for_it', 'treat', 'need_it', 'for_someone', 'other'));
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS child_note text;
ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_child_note_check;
ALTER TABLE public.redemptions ADD CONSTRAINT redemptions_child_note_check
    CHECK (child_note IS NULL OR (char_length(child_note) BETWEEN 1 AND 140 AND child_note = btrim(child_note)));
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS decision_id uuid REFERENCES public.family_decisions (id) ON DELETE SET NULL;

-- Existing decisions point at their backfilled rows.
UPDATE public.tasks t SET decision_id = d.id
FROM public.family_decisions d
WHERE d.task_id = t.id AND d.legacy AND t.decision_id IS NULL AND t.status = 'approved';
UPDATE public.redemptions r SET decision_id = d.id
FROM public.family_decisions d
WHERE d.redemption_id = r.id AND d.legacy AND r.decision_id IS NULL;

-- ── The completion day: a chore sent back is no longer done ─────────────────
-- (chore_streak_rest_days verbatim, plus: a send-back clears the day.)
CREATE OR REPLACE FUNCTION public.guard_task_completion_day()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.completed_on IS NOT NULL THEN
            RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001',
                DETAIL = 'A task is created without a completion day.';
        END IF;
        RETURN NEW;
    END IF;
    IF OLD.status = 'open' AND NEW.status = 'done' THEN
        NEW.completed_on := coalesce(NEW.completed_on, v_today);
        IF NEW.completed_on NOT BETWEEN v_today - 1 AND v_today + 1 THEN
            RAISE EXCEPTION 'TASK_COMPLETION_DAY_INVALID' USING ERRCODE = 'P0001',
                DETAIL = 'The completion day must be the local day of the completion.';
        END IF;
    ELSIF OLD.status = 'done' AND NEW.status = 'open' THEN
        -- S07.5 (D.18): a chore sent back to finish is not done yet.
        IF NEW.completed_on IS NOT NULL THEN
            RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001',
                DETAIL = 'A chore sent back has no completion day.';
        END IF;
    ELSIF NEW.completed_on IS DISTINCT FROM OLD.completed_on THEN
        RAISE EXCEPTION 'TASK_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_task_completion_day() FROM PUBLIC, anon, authenticated, service_role;

-- (chore_streak_rest_days verbatim, plus: a send-back takes the day back,
-- exactly as a cancellation after "done" already did.)
CREATE OR REPLACE FUNCTION public.record_chore_streak_day()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF OLD.status = 'open' AND NEW.status = 'done' THEN
        INSERT INTO public.chore_streak_days (kid_user_id, local_date, completions)
        VALUES (NEW.assigned_to, NEW.completed_on, 1)
        ON CONFLICT (kid_user_id, local_date)
        DO UPDATE SET completions = public.chore_streak_days.completions + 1, updated_at = now();
    ELSIF OLD.status = 'done' AND NEW.status IN ('cancelled', 'open') AND OLD.completed_on IS NOT NULL THEN
        -- A Tutor who cancels a chore marked done, or sends it back, says it
        -- was not done yet.
        UPDATE public.chore_streak_days
        SET completions = greatest(completions - 1, 0), updated_at = now()
        WHERE kid_user_id = NEW.assigned_to AND local_date = OLD.completed_on;
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.record_chore_streak_day() FROM PUBLIC, anon, authenticated, service_role;

-- ── A Tutor's approval records itself, whoever writes it ────────────────────
-- Runs before task_state_guard (name order). An approval that arrives without
-- its own decision row (the S07.1 path, or any direct writer) gets one here,
-- so the track record never misses a yes. A "not yet" cannot be recorded
-- this way: it needs the Tutor's reason.
CREATE OR REPLACE FUNCTION public.record_family_task_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF OLD.status = 'done' AND NEW.status = 'approved' AND NEW.decided_by IS NOT NULL
       AND NEW.decision_id IS NOT DISTINCT FROM OLD.decision_id THEN
        INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind)
        VALUES (NEW.assigned_to, 'task', NEW.id, 'done', 'approved', NEW.decided_by, 'tutor')
        RETURNING id INTO NEW.decision_id;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_family_task_decision() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS task_decision_record ON public.tasks;
CREATE TRIGGER task_decision_record BEFORE UPDATE OF status ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.record_family_task_decision();

CREATE OR REPLACE FUNCTION public.record_family_redemption_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF OLD.status = 'requested' AND NEW.status = 'approved' AND NEW.decided_by IS NOT NULL
       AND NEW.decision_id IS NOT DISTINCT FROM OLD.decision_id THEN
        INSERT INTO public.family_decisions (kid_user_id, subject, redemption_id, prior_status, outcome, actor_user_id, actor_kind)
        VALUES (NEW.kid_user_id, 'redemption', NEW.id, 'requested', 'approved', NEW.decided_by, 'tutor')
        RETURNING id INTO NEW.decision_id;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_family_redemption_decision() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS redemption_decision_record ON public.redemptions;
CREATE TRIGGER redemption_decision_record BEFORE UPDATE OF status ON public.redemptions
    FOR EACH ROW EXECUTE FUNCTION public.record_family_redemption_decision();

-- The decision a transition points at must be this transaction's, for this
-- subject, with this outcome.
CREATE OR REPLACE FUNCTION public.family_decision_matches(p_decision uuid, p_subject text, p_id uuid, p_outcome text)
RETURNS public.family_decisions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v public.family_decisions%ROWTYPE;
BEGIN
    SELECT * INTO v FROM public.family_decisions WHERE id = p_decision;
    IF NOT FOUND OR v.subject <> p_subject OR v.outcome <> p_outcome OR v.created_at <> now()
       OR (p_subject = 'task' AND v.task_id IS DISTINCT FROM p_id)
       OR (p_subject = 'redemption' AND v.redemption_id IS DISTINCT FROM p_id) THEN
        RETURN NULL;
    END IF;
    RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.family_decision_matches(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- ── Task state machine (S07.1 and S07.3 rules verbatim, plus S07.5) ─────────
CREATE OR REPLACE FUNCTION public.guard_task_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_decision public.family_decisions%ROWTYPE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'open' OR NEW.allocated OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.cancel_reason IS NOT NULL OR NEW.evidence_bucket IS NOT NULL OR NEW.evidence_hash IS NOT NULL
           OR NEW.evidence_ext IS NOT NULL OR NEW.evidence_uploaded_at IS NOT NULL
           OR NEW.child_note IS NOT NULL OR NEW.decision_id IS NOT NULL THEN
            RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001',
                DETAIL = 'A task is created open, unallocated, undecided and without evidence.';
        END IF;
        IF NEW.kind IS NULL OR NEW.kind NOT IN ('contribution', 'bonus') THEN
            RAISE EXCEPTION 'TASK_KIND_INVALID' USING ERRCODE = 'P0001';
        END IF;
        IF (NEW.kind = 'bonus' AND NEW.reward_coins NOT BETWEEN 1 AND 500)
           OR (NEW.kind = 'contribution' AND NEW.reward_coins NOT BETWEEN 0 AND 2) THEN
            RAISE EXCEPTION 'TASK_REWARD_OUT_OF_RANGE' USING ERRCODE = 'P0001';
        END IF;
        IF NOT public.family_is_verified_guardian(NEW.assigned_by, NEW.assigned_to) THEN
            RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['decided_by', 'decision_id'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'assigned_by', 'assigned_to', 'title', 'reward_coins', 'recurrence', 'due_at',
                          'requires_evidence', 'created_at', 'kind'] THEN
        RAISE EXCEPTION 'TASK_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;
    IF v_changed && ARRAY['evidence_bucket', 'evidence_hash', 'evidence_ext', 'evidence_uploaded_at']
       AND (OLD.status NOT IN ('open', 'done') OR NEW.status IS DISTINCT FROM OLD.status) THEN
        RAISE EXCEPTION 'TASK_EVIDENCE_LOCKED' USING ERRCODE = 'P0001';
    END IF;
    -- S07.5 (D.18): the child's note is written when the child marks it done.
    IF 'child_note' = ANY (v_changed) AND NOT (OLD.status = 'open' AND NEW.status = 'done') THEN
        RAISE EXCEPTION 'TASK_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'open' AND NEW.status = 'done' THEN
            IF v_changed && ARRAY['decided_by', 'decided_at', 'cancel_reason', 'allocated', 'decision_id'] THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status = 'done' AND NEW.status = 'approved' THEN
            IF NEW.requires_evidence AND (NEW.evidence_bucket IS NULL OR NEW.evidence_hash IS NULL OR NEW.evidence_ext IS NULL) THEN
                RAISE EXCEPTION 'TASK_EVIDENCE_REQUIRED' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.decided_by IS NULL AND NEW.decision_id IS DISTINCT FROM OLD.decision_id AND NEW.decision_id IS NOT NULL THEN
                -- S07.5 (D.17): self-logged by the child, under their level.
                v_decision := public.family_decision_matches(NEW.decision_id, 'task', NEW.id, 'self_logged');
                IF v_decision.id IS NULL OR NEW.decided_at IS NULL THEN
                    RAISE EXCEPTION 'TASK_DECISION_REQUIRED' USING ERRCODE = 'P0001';
                END IF;
                IF NOT public.family_autonomy_admits_task(NEW.assigned_to, NEW.kind, NEW.reward_coins) THEN
                    RAISE EXCEPTION 'TASK_SELF_LOG_FORBIDDEN' USING ERRCODE = 'P0001';
                END IF;
            ELSE
                IF NOT public.family_is_verified_guardian(NEW.decided_by, NEW.assigned_to) OR NEW.decided_at IS NULL THEN
                    RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
                END IF;
                v_decision := public.family_decision_matches(NEW.decision_id, 'task', NEW.id, 'approved');
                IF v_decision.id IS NULL OR v_decision.actor_user_id IS DISTINCT FROM NEW.decided_by THEN
                    RAISE EXCEPTION 'TASK_DECISION_REQUIRED' USING ERRCODE = 'P0001';
                END IF;
            END IF;
            IF NEW.allocated OR NEW.cancel_reason IS NOT NULL THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status = 'done' AND NEW.status = 'open' THEN
            -- S07.5 (D.18): sent back to finish, with the Tutor's reason.
            v_decision := public.family_decision_matches(NEW.decision_id, 'task', NEW.id, 'sent_back');
            IF v_decision.id IS NULL THEN
                RAISE EXCEPTION 'DECISION_REASON_REQUIRED' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL OR NEW.cancel_reason IS NOT NULL OR NEW.allocated THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status IN ('open', 'done') AND NEW.status = 'cancelled' THEN
            IF NOT public.family_is_verified_guardian(NEW.decided_by, NEW.assigned_to) OR NEW.decided_at IS NULL THEN
                RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.allocated THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
            -- S07.5 (D.18): no cancellation without the reason the child reads.
            v_decision := public.family_decision_matches(NEW.decision_id, 'task', NEW.id, 'cancelled');
            IF v_decision.id IS NULL OR v_decision.actor_user_id IS DISTINCT FROM NEW.decided_by
               OR NEW.cancel_reason IS DISTINCT FROM v_decision.reason THEN
                RAISE EXCEPTION 'DECISION_REASON_REQUIRED' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            RAISE EXCEPTION 'TASK_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
                DETAIL = format('%s -> %s', OLD.status, NEW.status);
        END IF;
    ELSIF v_changed && ARRAY['decided_by', 'decided_at', 'cancel_reason', 'decision_id'] THEN
        RAISE EXCEPTION 'TASK_DECISION_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;

    IF 'allocated' = ANY (v_changed) AND (OLD.allocated OR NEW.status <> 'approved' OR NEW.reward_coins = 0) THEN
        RAISE EXCEPTION 'TASK_ALLOCATION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_task_state() FROM PUBLIC, anon, authenticated, service_role;

SELECT 'family_decision_guards_ok' AS sentinel;
