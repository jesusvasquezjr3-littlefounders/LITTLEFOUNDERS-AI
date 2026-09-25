-- family_task_contribution_kind — S07.3 (D.10): a Tutor chooses, per chore,
-- between an expected family contribution and a paid bonus task.
-- @phase: contract
-- @after-release: none — replaces tasks_reward_coins_check (> 0) with a
--   0..500 range plus a per-kind rule, and replaces the S07.1 task guard with
--   one that keeps every S07.1 rule verbatim and adds the kind rules. Every
--   task the current Core creates (always paid, 1..500 coins) is a legal
--   'bonus' task, which is the column default. Apply with the Core release
--   that ships the S07.3 routes, after chore_streak_rest_days.
--
-- WHY. Appendix G §1.2: whether ordinary household contribution should be paid
-- is an unsettled values question (Lieber's "pay for extraordinary tasks, not
-- ordinary contribution" against no controlled study either way), so the
-- product stops making the choice implicitly. A Tutor tags each chore:
--
--   contribution  part of family life: unpaid, or a nominal 1 or 2 coins
--   bonus         extra help, paid at the rate the Tutor sets (1..500)
--
-- Nothing defaults the choice in the rebuilt composer; the column default
-- 'bonus' exists only so every existing task (all of them paid) and every
-- request from an older client keeps its meaning.
--
-- A zero-coin contribution is approved like any chore and never allocated:
-- there is nothing to split, and the guard below refuses marking it
-- allocated. The chore still counts toward the chore streak (D.2).
--
-- Measured: chore_tag_adoption(since) (Appendix H, Chore-Tag Adoption Rate,
-- Diagnostic) counts chores created per kind and the Tutors who created them.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'bonus';
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_kind_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_kind_check CHECK (kind IN ('contribution', 'bonus'));

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_reward_coins_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_reward_coins_check CHECK (reward_coins BETWEEN 0 AND 500);
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_kind_reward_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_kind_reward_check CHECK (
    (kind = 'bonus' AND reward_coins BETWEEN 1 AND 500) OR (kind = 'contribution' AND reward_coins BETWEEN 0 AND 2)
);

CREATE INDEX IF NOT EXISTS tasks_created_at_kind_idx ON public.tasks (created_at, kind);

-- ── Task state machine (S07.1 rules verbatim, plus the kind rules) ──────────
CREATE OR REPLACE FUNCTION public.guard_task_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'open' OR NEW.allocated OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.cancel_reason IS NOT NULL OR NEW.evidence_bucket IS NOT NULL OR NEW.evidence_hash IS NOT NULL
           OR NEW.evidence_ext IS NOT NULL OR NEW.evidence_uploaded_at IS NOT NULL THEN
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
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['decided_by'], to_jsonb(NEW)) THEN
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

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status = 'open' AND NEW.status = 'done' THEN
            IF v_changed && ARRAY['decided_by', 'decided_at', 'cancel_reason', 'allocated'] THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status = 'done' AND NEW.status = 'approved' THEN
            IF NEW.requires_evidence AND (NEW.evidence_bucket IS NULL OR NEW.evidence_hash IS NULL OR NEW.evidence_ext IS NULL) THEN
                RAISE EXCEPTION 'TASK_EVIDENCE_REQUIRED' USING ERRCODE = 'P0001';
            END IF;
            IF NOT public.family_is_verified_guardian(NEW.decided_by, NEW.assigned_to) OR NEW.decided_at IS NULL THEN
                RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.allocated OR NEW.cancel_reason IS NOT NULL THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF OLD.status IN ('open', 'done') AND NEW.status = 'cancelled' THEN
            IF NOT public.family_is_verified_guardian(NEW.decided_by, NEW.assigned_to) OR NEW.decided_at IS NULL THEN
                RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.allocated THEN
                RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            RAISE EXCEPTION 'TASK_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
                DETAIL = format('%s -> %s', OLD.status, NEW.status);
        END IF;
    ELSIF v_changed && ARRAY['decided_by', 'decided_at', 'cancel_reason'] THEN
        RAISE EXCEPTION 'TASK_DECISION_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;

    IF 'allocated' = ANY (v_changed) AND (OLD.allocated OR NEW.status <> 'approved' OR NEW.reward_coins = 0) THEN
        RAISE EXCEPTION 'TASK_ALLOCATION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_task_state() FROM PUBLIC, anon, authenticated, service_role;

-- ── Appendix H: Chore-Tag Adoption Rate (Diagnostic, no target) ─────────────
-- Counts only, never an identity: chores created inside the window per kind,
-- the Tutors who created any, and how many of them tagged at least one chore
-- as an expected contribution.
CREATE OR REPLACE FUNCTION public.chore_tag_adoption(p_since timestamptz)
RETURNS TABLE (contribution_tasks bigint, bonus_tasks bigint, tutors bigint, tutors_using_contribution bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT count(*) FILTER (WHERE t.kind = 'contribution'),
           count(*) FILTER (WHERE t.kind = 'bonus'),
           count(DISTINCT t.assigned_by),
           count(DISTINCT t.assigned_by) FILTER (WHERE t.kind = 'contribution')
    FROM public.tasks t
    WHERE t.created_at >= p_since;
$$;
REVOKE ALL ON FUNCTION public.chore_tag_adoption(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chore_tag_adoption(timestamptz) TO service_role;

SELECT 'family_task_contribution_kind_ok' AS sentinel;
