-- 0075_family_hub_atomic_wallet.sql — the earn/allocate/redeem loop's two
-- money-moving actions, made atomic the same way 0055 made XP atomic.
-- @phase: expand
--
-- WHY THIS EXISTS. wallet_ledger (0074) is append-only and correct in
-- isolation, but the two operations that write to it — a kid allocating an
-- approved task's reward across Save/Spend/Share, and a parent approving a
-- redemption request — are each a read-check-write sequence over more than
-- one row (a task's `allocated` flag plus up to three new ledger rows; a
-- redemption's status plus the kid's current spend-bucket balance). Doing
-- that as separate PostgREST calls from Core is exactly the shape 0055's own
-- header describes: two concurrent requests (a double-tap, a retried
-- request, two open tabs) both read the same "not yet allocated"/"balance
-- sufficient" state before either write lands, and both act on it. Moved
-- into one function per operation, serialized with a Postgres advisory lock
-- keyed on the kid, exactly like award_tutor_xp.

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS allocated boolean NOT NULL DEFAULT false;

-- Allocates an APPROVED, not-yet-allocated task's fixed reward_coins across
-- the three buckets. The total is never client-supplied — it is read from
-- the task row itself — only the SPLIT is, and it is rejected unless it sums
-- to exactly that total. Returns false (never partial) on any guard failure;
-- the caller (Core) turns that into a 409.
CREATE OR REPLACE FUNCTION public.allocate_task_reward(
    p_task_id    uuid,
    p_kid_user_id uuid,
    p_save       int,
    p_spend      int,
    p_share      int,
    p_created_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.tasks%ROWTYPE;
BEGIN
    IF p_save < 0 OR p_spend < 0 OR p_share < 0 THEN
        RETURN false;
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
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, task_id, created_by)
        VALUES (p_kid_user_id, 'save', p_save, 'task_approved', p_task_id, p_created_by);
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

REVOKE ALL ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_task_reward(uuid, uuid, int, int, int, uuid) TO service_role;

-- Decides a redemption request. Approving debits the kid's `spend` bucket
-- (computed the same way a wallet screen would: SUM(amount) WHERE
-- bucket='spend') by the catalog item's cost — but only if the balance
-- actually covers it, checked and spent inside the same locked transaction,
-- never trusted from a prior read. Denying writes no ledger row at all.
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
    -- Lock ordering matches allocate_task_reward: the advisory lock (keyed on
    -- the kid, same lock space — tag 1) is taken BEFORE any row lock, so the
    -- two functions can never deadlock against each other for the same kid.
    -- A cheap, unlocked read gets the key; the authoritative row is re-read
    -- FOR UPDATE only after the lock is held.
    SELECT kid_user_id INTO v_kid_user_id FROM public.redemptions WHERE id = p_redemption_id;
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_kid_user_id::text, 1));

    SELECT * INTO v_redemption FROM public.redemptions
    WHERE id = p_redemption_id
    FOR UPDATE;

    IF NOT FOUND OR v_redemption.status <> 'requested' THEN
        RETURN false;
    END IF;

    IF NOT p_approve THEN
        UPDATE public.redemptions
        SET status = 'denied', decided_at = now(), decided_by = p_decided_by
        WHERE id = p_redemption_id;
        RETURN true;
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

REVOKE ALL ON FUNCTION public.decide_redemption(uuid, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_redemption(uuid, boolean, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.decide_redemption(uuid, boolean, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decide_redemption(uuid, boolean, uuid) TO service_role;

SELECT 'migration_0075_ok' AS sentinel;
