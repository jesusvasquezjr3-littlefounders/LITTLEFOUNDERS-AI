-- wallet_moves — part 1 of 2: the holder moves their own coins: between pockets,
-- into a goal, out of a goal. This part holds the move log, the ledger reasons
-- and the ledger guard; wallet_move_flows (part 2) holds the goal guard, the
-- provenance rule and the producing flows. Split so each payload stays inside
-- the operator transport's single-argument limit on Windows.
-- @phase: contract
-- @after-release: none — the ledger reason CHECK is dropped and re-added (a
--   pure widening: pocket_move, goal_move) and the ledger guard is replaced by
--   one that keeps every earlier rule word for word. No write the current Core
--   makes becomes illegal. Apply with the Core release that ships the
--   wallet-moves routes, never ahead of it; part 2 follows it.
--
-- Why: a child's wallet could only fix where coins went at the moment they
-- arrived (the D.13 split). After that nothing moved: Save could not fund a
-- new goal, a goal could not give coins back, a typo in a goal meant archiving
-- it, and archiving a funded goal left its coins tagged to a dead goal and
-- protected from every debit (GOAL_SAVINGS_PROTECTED), unreachable for a
-- child. These are the moves a kid-banking app is made of, and each one is the
-- holder's own: no approval, nothing leaves the account (D.7), and every move
-- is two balanced ledger rows pointing at the move that explains them, the
-- same shape as wallet_self_actions and wallet_guardian_actions.
--
-- Honesty (D.16): coins put into a goal this way are the holder's own saved
-- coins and count as "own" in the provenance breakdown. The weekly savings
-- bonus still never lands in a goal directly; once bonus coins sit in plain
-- Save they are the holder's coins like any other, and that is stated, not hidden.

-- ── The move: one row explains the ledger rows it writes ────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_moves (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    holder_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kind           text NOT NULL CHECK (kind IN ('pocket', 'goal_in', 'goal_out')),
    amount         integer NOT NULL CHECK (amount BETWEEN 1 AND 100000),
    from_bucket    text CHECK (from_bucket IN ('save', 'spend', 'share')),
    to_bucket      text CHECK (to_bucket IN ('save', 'spend', 'share')),
    goal_id        uuid REFERENCES public.savings_goals (id) ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT wallet_move_shape CHECK (
        (kind = 'pocket' AND from_bucket IS NOT NULL AND to_bucket IS NOT NULL AND from_bucket <> to_bucket AND goal_id IS NULL)
        OR (kind IN ('goal_in', 'goal_out') AND from_bucket IS NULL AND to_bucket IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_wallet_moves_holder ON public.wallet_moves (holder_user_id, created_at DESC);

ALTER TABLE public.wallet_moves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wallet_moves_select_party ON public.wallet_moves;
CREATE POLICY wallet_moves_select_party ON public.wallet_moves
    FOR SELECT USING (holder_user_id = auth.uid() OR public.is_verified_guardian_of(holder_user_id));

-- Browser roles never write; the log is append-only and written by the functions below.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.wallet_moves FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.wallet_moves FROM service_role;
GRANT SELECT, INSERT ON public.wallet_moves TO service_role;

ALTER TABLE public.wallet_ledger
    ADD COLUMN IF NOT EXISTS move_id uuid REFERENCES public.wallet_moves (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_move ON public.wallet_ledger (move_id) WHERE move_id IS NOT NULL;

alter table public.wallet_ledger drop constraint if exists wallet_ledger_reason_check;
alter table public.wallet_ledger add constraint wallet_ledger_reason_check
    check (reason in ('task_approved', 'goal_withdrawal', 'redemption', 'manual_adjustment', 'allowance', 'savings_bonus', 'self_income', 'personal_reward', 'goal_release', 'share_gift', 'share_gift_returned', 'pocket_move', 'goal_move'));

-- At commit, a move has exactly the two ledger rows it describes.
CREATE OR REPLACE FUNCTION public.check_wallet_move_balanced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_rows int;
    v_sum  bigint;
BEGIN
    SELECT count(*), coalesce(sum(amount), 0) INTO v_rows, v_sum FROM public.wallet_ledger WHERE move_id = NEW.id;
    IF v_rows <> 2 OR v_sum <> 0 THEN
        RAISE EXCEPTION 'WALLET_MOVE_UNBALANCED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.check_wallet_move_balanced() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS wallet_move_balanced ON public.wallet_moves;
CREATE CONSTRAINT TRIGGER wallet_move_balanced AFTER INSERT ON public.wallet_moves
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_wallet_move_balanced();

-- ── The ledger guard (supersedes share_gift_flows'): every earlier rule kept,
-- plus the two move reasons ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_wallet_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_action   public.wallet_guardian_actions%ROWTYPE;
    v_self     public.wallet_self_actions%ROWTYPE;
    v_gift     public.share_gifts%ROWTYPE;
    v_move     public.wallet_moves%ROWTYPE;
    v_bucket   bigint;
    v_goal     bigint;
    v_tagged   bigint;
    v_goal_kid uuid;
    v_goal_status text;
    v_split    int;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
        IF v_changed = '{}'::text[]
           OR public.family_only_nulled(v_changed, ARRAY['task_id', 'goal_id', 'redemption_id', 'guardian_action_id', 'self_action_id', 'share_gift_id', 'move_id'], to_jsonb(NEW)) THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'LEDGER_APPEND_ONLY' USING ERRCODE = 'P0001';
    END IF;

    -- OD-3: a wallet belongs to a parent-created child or an eligible teen.
    -- Adults never hold one, whoever writes the row.
    IF public.wallet_holder_kind(NEW.kid_user_id) IS NULL THEN
        RAISE EXCEPTION 'WALLET_HOLDER_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.goal_id IS NOT NULL THEN
        SELECT kid_user_id, status INTO v_goal_kid, v_goal_status FROM public.savings_goals WHERE id = NEW.goal_id;
        IF v_goal_kid IS DISTINCT FROM NEW.kid_user_id OR NEW.bucket <> 'save' THEN
            RAISE EXCEPTION 'LEDGER_GOAL_INVALID' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- S07.4 (D.14): only a Share-gift row may point at a gift.
    IF NEW.share_gift_id IS NOT NULL AND NEW.reason NOT IN ('share_gift', 'share_gift_returned') THEN
        RAISE EXCEPTION 'LEDGER_REASON_INVALID' USING ERRCODE = 'P0001';
    END IF;
    -- Only a move row may point at a move.
    IF NEW.move_id IS NOT NULL AND NEW.reason NOT IN ('pocket_move', 'goal_move') THEN
        RAISE EXCEPTION 'LEDGER_REASON_INVALID' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.reason IN ('self_income', 'personal_reward', 'goal_release') THEN
        SELECT * INTO v_self FROM public.wallet_self_actions WHERE id = NEW.self_action_id;
        IF NOT FOUND OR NEW.guardian_action_id IS NOT NULL OR v_self.kind <> NEW.reason
           OR v_self.holder_user_id <> NEW.kid_user_id OR NEW.created_by <> NEW.kid_user_id
           OR NEW.task_id IS NOT NULL OR NEW.redemption_id IS NOT NULL THEN
            RAISE EXCEPTION 'LEDGER_SELF_ACTION_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.reason = 'self_income' THEN
            v_split := CASE NEW.bucket WHEN 'save' THEN v_self.save_amount WHEN 'spend' THEN v_self.spend_amount ELSE v_self.share_amount END;
            IF NEW.amount <= 0 OR NEW.amount <> v_split
               OR (NEW.bucket = 'save' AND NEW.goal_id IS DISTINCT FROM v_self.goal_id)
               OR (NEW.bucket <> 'save' AND NEW.goal_id IS NOT NULL)
               OR (NEW.goal_id IS NOT NULL AND v_goal_status <> 'active')
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE self_action_id = v_self.id AND bucket = NEW.bucket) THEN
                RAISE EXCEPTION 'LEDGER_SELF_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.reason = 'personal_reward' THEN
            IF NEW.amount <> -v_self.amount OR NEW.bucket <> 'spend' OR NEW.goal_id IS NOT NULL
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE self_action_id = v_self.id) THEN
                RAISE EXCEPTION 'LEDGER_SELF_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.amount < 0 THEN
            IF NEW.amount <> -v_self.amount OR NEW.bucket <> 'save' OR NEW.goal_id IS DISTINCT FROM v_self.goal_id
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE self_action_id = v_self.id AND amount < 0) THEN
                RAISE EXCEPTION 'LEDGER_SELF_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            IF NEW.amount <> v_self.amount OR NEW.bucket <> v_self.destination OR NEW.goal_id IS NOT NULL
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE self_action_id = v_self.id AND amount > 0) THEN
                RAISE EXCEPTION 'LEDGER_SELF_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    ELSIF NEW.self_action_id IS NOT NULL THEN
        RAISE EXCEPTION 'LEDGER_REASON_INVALID' USING ERRCODE = 'P0001';
    ELSIF NEW.reason IN ('pocket_move', 'goal_move') THEN
        -- The holder's own move: two rows, one out and one in, each exactly what
        -- the move says, written by the holder, never alongside another source.
        SELECT * INTO v_move FROM public.wallet_moves WHERE id = NEW.move_id;
        IF NOT FOUND OR v_move.holder_user_id <> NEW.kid_user_id OR NEW.created_by <> NEW.kid_user_id
           OR NEW.task_id IS NOT NULL OR NEW.redemption_id IS NOT NULL OR NEW.guardian_action_id IS NOT NULL
           OR NEW.share_gift_id IS NOT NULL OR NEW.amount = 0
           OR (NEW.reason = 'pocket_move') <> (v_move.kind = 'pocket')
           OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE move_id = v_move.id AND sign(amount) = sign(NEW.amount)) THEN
            RAISE EXCEPTION 'LEDGER_MOVE_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF v_move.kind = 'pocket' THEN
            IF NEW.goal_id IS NOT NULL
               OR NOT ((NEW.amount = -v_move.amount AND NEW.bucket = v_move.from_bucket)
                    OR (NEW.amount = v_move.amount AND NEW.bucket = v_move.to_bucket)) THEN
                RAISE EXCEPTION 'LEDGER_MOVE_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSIF v_move.kind = 'goal_in' THEN
            -- plain Save out, the goal in; only an active goal takes coins.
            IF NEW.bucket <> 'save' OR NOT (
                   (NEW.amount = -v_move.amount AND NEW.goal_id IS NULL)
                OR (NEW.amount = v_move.amount AND NEW.goal_id = v_move.goal_id AND v_goal_status = 'active')) THEN
                RAISE EXCEPTION 'LEDGER_MOVE_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            -- the goal out, back to plain Save; a goal in any state gives coins back.
            IF NEW.bucket <> 'save' OR NOT (
                   (NEW.amount = -v_move.amount AND NEW.goal_id = v_move.goal_id)
                OR (NEW.amount = v_move.amount AND NEW.goal_id IS NULL)) THEN
                RAISE EXCEPTION 'LEDGER_MOVE_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    ELSIF NEW.reason IN ('share_gift', 'share_gift_returned') THEN
        -- S07.4 (D.14): one Share debit when a gift is pledged, one matching
        -- credit only once it was returned.
        SELECT * INTO v_gift FROM public.share_gifts WHERE id = NEW.share_gift_id;
        IF NOT FOUND OR v_gift.holder_user_id <> NEW.kid_user_id OR NEW.bucket <> 'share' OR NEW.goal_id IS NOT NULL
           OR NEW.task_id IS NOT NULL OR NEW.redemption_id IS NOT NULL OR NEW.guardian_action_id IS NOT NULL
           OR (NEW.reason = 'share_gift' AND (NEW.amount <> -v_gift.amount OR v_gift.status <> 'pledged'))
           OR (NEW.reason = 'share_gift_returned' AND (NEW.amount <> v_gift.amount OR v_gift.status <> 'returned'))
           OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE share_gift_id = v_gift.id AND reason = NEW.reason) THEN
            RAISE EXCEPTION 'LEDGER_SHARE_GIFT_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF NEW.reason IN ('manual_adjustment', 'goal_withdrawal') THEN
        SELECT * INTO v_action FROM public.wallet_guardian_actions WHERE id = NEW.guardian_action_id;
        IF NOT FOUND OR v_action.kind <> NEW.reason OR v_action.kid_user_id <> NEW.kid_user_id
           OR v_action.actor_user_id IS DISTINCT FROM NEW.created_by THEN
            RAISE EXCEPTION 'LEDGER_GUARDIAN_ACTION_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.reason = 'manual_adjustment' THEN
            IF NEW.amount <> v_action.amount OR NEW.bucket <> v_action.bucket OR NEW.goal_id IS NOT NULL
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE guardian_action_id = v_action.id) THEN
                RAISE EXCEPTION 'LEDGER_GUARDIAN_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.amount < 0 THEN
            IF NEW.amount <> -v_action.amount OR NEW.bucket <> 'save' OR NEW.goal_id IS DISTINCT FROM v_action.goal_id
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE guardian_action_id = v_action.id AND amount < 0) THEN
                RAISE EXCEPTION 'LEDGER_GUARDIAN_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            IF NEW.amount <> v_action.amount OR NEW.bucket <> v_action.bucket OR NEW.goal_id IS NOT NULL
               OR EXISTS (SELECT 1 FROM public.wallet_ledger WHERE guardian_action_id = v_action.id AND amount > 0) THEN
                RAISE EXCEPTION 'LEDGER_GUARDIAN_ACTION_MISMATCH' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    ELSE
        IF NEW.guardian_action_id IS NOT NULL THEN
            RAISE EXCEPTION 'LEDGER_REASON_INVALID' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.reason = 'task_approved' THEN
            IF NEW.amount <= 0 OR NOT EXISTS (
                SELECT 1 FROM public.tasks
                WHERE id = NEW.task_id AND assigned_to = NEW.kid_user_id AND status = 'approved' AND NOT allocated
            ) THEN
                RAISE EXCEPTION 'LEDGER_TASK_INVALID' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.goal_id IS NOT NULL AND v_goal_status <> 'active' THEN
                RAISE EXCEPTION 'LEDGER_GOAL_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.reason = 'redemption' THEN
            IF NEW.amount >= 0 OR NEW.bucket <> 'spend' OR NEW.goal_id IS NOT NULL OR NOT EXISTS (
                SELECT 1 FROM public.redemptions
                WHERE id = NEW.redemption_id AND kid_user_id = NEW.kid_user_id AND status = 'requested'
            ) OR EXISTS (
                SELECT 1 FROM public.wallet_ledger WHERE redemption_id = NEW.redemption_id AND reason = 'redemption'
            ) THEN
                RAISE EXCEPTION 'LEDGER_REDEMPTION_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.reason IN ('allowance', 'savings_bonus') THEN
            -- S07.4: an allowance's Save part may go to an active goal, like a
            -- chore reward's. The savings bonus never lands in a goal, so a
            -- goal's progress can never be padded with it (D.16).
            IF NEW.amount <= 0 OR (NEW.reason = 'savings_bonus' AND (NEW.bucket <> 'save' OR NEW.goal_id IS NOT NULL))
               OR (NEW.reason = 'allowance' AND NEW.goal_id IS NOT NULL AND v_goal_status <> 'active') THEN
                RAISE EXCEPTION 'LEDGER_CREDIT_INVALID' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    -- No debit may overdraw a bucket, a goal, or the savings reserved for goals.
    IF NEW.amount < 0 THEN
        IF NEW.goal_id IS NOT NULL THEN
            SELECT coalesce(sum(amount), 0) INTO v_goal FROM public.wallet_ledger WHERE goal_id = NEW.goal_id;
            IF v_goal + NEW.amount < 0 THEN
                RAISE EXCEPTION 'GOAL_BALANCE_INSUFFICIENT' USING ERRCODE = 'P0001';
            END IF;
        END IF;
        SELECT coalesce(sum(amount), 0) INTO v_bucket FROM public.wallet_ledger
        WHERE kid_user_id = NEW.kid_user_id AND bucket = NEW.bucket;
        IF v_bucket + NEW.amount < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.goal_id IS NULL AND NEW.bucket = 'save' THEN
            SELECT coalesce(sum(amount), 0) INTO v_tagged FROM public.wallet_ledger
            WHERE kid_user_id = NEW.kid_user_id AND bucket = 'save' AND goal_id IS NOT NULL;
            IF v_bucket - v_tagged + NEW.amount < 0 THEN
                RAISE EXCEPTION 'GOAL_SAVINGS_PROTECTED' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_wallet_ledger_entry() FROM PUBLIC, anon, authenticated, service_role;

SELECT 'wallet_moves_ok' AS sentinel;
