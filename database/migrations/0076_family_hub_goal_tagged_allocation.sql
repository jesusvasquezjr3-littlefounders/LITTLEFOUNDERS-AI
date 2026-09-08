-- 0076_family_hub_goal_tagged_allocation.sql — allocate_task_reward learns to
-- tag a save-bucket credit to a goal at the moment it is earned.
-- @phase: expand
--
-- FAMILY_HUB.md §6 step 4-5: a kid allocates an approved task's reward across
-- Save/Spend/Share and, for the Save portion, may point it at an active goal
-- in the SAME action — not a separate "move money into a goal" step, which
-- would need to either double-count a bucket total or retroactively re-tag an
-- append-only ledger row. Neither is necessary: a goal's progress is simply
-- SUM(wallet_ledger.amount) WHERE goal_id = that goal, a tag on money that
-- was always also counted in the plain 'save' bucket total
-- (SUM(...) WHERE bucket='save', regardless of tag). 0075 shipped the
-- function one migration before this tag existed as a requirement, caught
-- while writing the service layer that calls it — fixed here rather than by
-- editing 0075, per this repo's own "never edit, write a delta" rule.
--
-- CREATE OR REPLACE cannot append a required positional parameter to an
-- existing function; DROP + CREATE is the correct, idempotent way to widen
-- the signature.
DROP FUNCTION IF EXISTS public.allocate_task_reward(uuid, uuid, int, int, int, uuid);

CREATE OR REPLACE FUNCTION public.allocate_task_reward(
    p_task_id     uuid,
    p_kid_user_id uuid,
    p_save        int,
    p_spend       int,
    p_share       int,
    p_created_by  uuid,
    p_goal_id     uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.tasks%ROWTYPE;
    v_goal_ok boolean;
BEGIN
    IF p_save < 0 OR p_spend < 0 OR p_share < 0 THEN
        RETURN false;
    END IF;
    -- A goal tag only makes sense when there is money going into Save, and
    -- only for a goal that is actually this kid's own active one — the same
    -- ownership discipline every other guardian-scoped read in this schema
    -- already applies, checked here rather than trusted from the caller.
    IF p_goal_id IS NOT NULL THEN
        IF p_save <= 0 THEN
            RETURN false;
        END IF;
        SELECT EXISTS (
            SELECT 1 FROM public.savings_goals
            WHERE id = p_goal_id AND kid_user_id = p_kid_user_id AND status = 'active'
        ) INTO v_goal_ok;
        IF NOT v_goal_ok THEN
            RETURN false;
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid_user_id::text, 1));

    SELECT * INTO v_task FROM public.tasks
    WHERE id = p_task_id AND assigned_to = p_kid_user_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_task.status <> 'approved'
       OR v_task.allocated
       OR (p_save + p_spend + p_share) <> v_task.reward_coins
    THEN
        RETURN false;
    END IF;

    IF p_save > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, task_id, goal_id, created_by)
        VALUES (p_kid_user_id, 'save', p_save, 'task_approved', p_task_id, p_goal_id, p_created_by);
    END IF;
    IF p_spend > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, task_id, created_by)
        VALUES (p_kid_user_id, 'spend', p_spend, 'task_approved', p_task_id, p_created_by);
    END IF;
    IF p_share > 0 THEN
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, task_id, created_by)
        VALUES (p_kid_user_id, 'share', p_share, 'task_approved', p_task_id, p_created_by);
    END IF;

    UPDATE public.tasks SET allocated = true WHERE id = p_task_id;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid, uuid) TO service_role;

SELECT 'migration_0076_ok' AS sentinel;
