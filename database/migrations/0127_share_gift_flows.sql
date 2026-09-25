-- share_gift_flows — S07.4, part 3 of 5 (D.14, and the D.13 allowance goal
-- tag): the ledger guard learns the Share-gift rows, then the producing flows
-- and the Share-Bucket Destination Completion Rate.
-- @phase: expand
--
-- The ledger guard is replaced by one that keeps every S07.1/S07.2 rule word
-- for word and adds two things: the Share-gift rows must match their gift
-- (a row type that did not exist before share_gift_destinations), and an
-- allowance's Save part may now carry a goal tag (D.13's split chooser lets an
-- allowance go to a goal, as a chore reward already could). No write the
-- current Core makes becomes illegal. Apply after share_gift_destinations.
--
-- Rationale: share_gift_destinations (part 2) and
-- docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- ── The ledger guard (supersedes independent_teen_wallet_ledger's) ──────────
CREATE OR REPLACE FUNCTION public.guard_wallet_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed  text[];
    v_action   public.wallet_guardian_actions%ROWTYPE;
    v_self     public.wallet_self_actions%ROWTYPE;
    v_gift     public.share_gifts%ROWTYPE;
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
           OR public.family_only_nulled(v_changed, ARRAY['task_id', 'goal_id', 'redemption_id', 'guardian_action_id', 'self_action_id', 'share_gift_id'], to_jsonb(NEW)) THEN
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

-- ── Producing flows (service role only, serialized on the holder's wallet
-- lock like every S07.1/S07.2 flow, audited in the same transaction) ────────

-- A destination: a verified Tutor for any child in a family, or a
-- self-registered teen for themself. The guard decides; this is one call.
CREATE OR REPLACE FUNCTION public.share_destination_create(p_holder uuid, p_actor uuid, p_title text, p_kind text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_title text := btrim(coalesce(p_title, ''));
    v_id    uuid;
BEGIN
    IF p_holder IS NULL OR p_actor IS NULL OR char_length(v_title) NOT BETWEEN 1 AND 60
       OR p_kind IS NULL OR p_kind NOT IN ('charity', 'gift', 'community') THEN
        RAISE EXCEPTION 'SHARE_DESTINATION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    INSERT INTO public.share_destinations (holder_user_id, title, kind, chosen_by, created_by)
    VALUES (p_holder, v_title, p_kind, CASE WHEN p_actor = p_holder THEN 'holder' ELSE 'tutor' END, p_actor)
    RETURNING id INTO v_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'wallet.share_destination_created', p_holder::text, jsonb_build_object('destination_id', v_id, 'kind', p_kind));
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.share_destination_create(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_destination_create(uuid, uuid, text, text) TO service_role;

-- true = archived now, false = already archived. Only the destination's
-- steward archives it; gifts already pledged to it can still be settled.
CREATE OR REPLACE FUNCTION public.share_destination_archive(p_destination uuid, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_dest public.share_destinations%ROWTYPE;
BEGIN
    SELECT * INTO v_dest FROM public.share_destinations WHERE id = p_destination;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHARE_DESTINATION_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_dest.holder_user_id::text, 1));
    IF NOT public.share_destination_steward(p_destination, p_actor) THEN
        RAISE EXCEPTION 'SHARE_GIFT_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_dest FROM public.share_destinations WHERE id = p_destination FOR UPDATE;
    IF v_dest.status <> 'active' THEN
        RETURN false;
    END IF;
    UPDATE public.share_destinations SET status = 'archived', archived_at = now() WHERE id = p_destination;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'wallet.share_destination_archived', v_dest.holder_user_id::text, jsonb_build_object('destination_id', p_destination));
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.share_destination_archive(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_destination_archive(uuid, uuid) TO service_role;

-- The child directs Share coins to a destination: the coins leave Share at
-- once (no double pledge), and the gift waits for its steward.
CREATE OR REPLACE FUNCTION public.share_gift_pledge(p_holder uuid, p_destination uuid, p_amount int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_gift uuid;
BEGIN
    IF p_holder IS NULL OR p_destination IS NULL OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'SHARE_GIFT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    INSERT INTO public.share_gifts (holder_user_id, destination_id, amount)
    VALUES (p_holder, p_destination, p_amount)
    RETURNING id INTO v_gift;
    INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, share_gift_id)
    VALUES (p_holder, 'share', -p_amount, 'share_gift', p_holder, v_gift);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_holder, 'wallet.share_gift_pledged', p_holder::text,
            jsonb_build_object('gift_id', v_gift, 'destination_id', p_destination, 'amount', p_amount));
    RETURN v_gift;
END;
$$;
REVOKE ALL ON FUNCTION public.share_gift_pledge(uuid, uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_gift_pledge(uuid, uuid, int) TO service_role;

-- Settling a pledge. 'given': the steward records what really happened (a
-- required note). 'returned': the coins go back to Share, by the child (no
-- note needed) or by the steward (a required reason).
CREATE OR REPLACE FUNCTION public.share_gift_settle(p_gift uuid, p_actor uuid, p_outcome text, p_note text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_gift public.share_gifts%ROWTYPE;
    v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
    IF p_gift IS NULL OR p_actor IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('given', 'returned')
       OR (v_note IS NOT NULL AND char_length(v_note) > 240) THEN
        RAISE EXCEPTION 'SHARE_GIFT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_gift FROM public.share_gifts WHERE id = p_gift;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHARE_GIFT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_gift.holder_user_id::text, 1));
    SELECT * INTO v_gift FROM public.share_gifts WHERE id = p_gift FOR UPDATE;
    IF NOT (p_actor = v_gift.holder_user_id OR public.share_destination_steward(v_gift.destination_id, p_actor)) THEN
        RAISE EXCEPTION 'SHARE_GIFT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_gift.status <> 'pledged' THEN
        RAISE EXCEPTION 'SHARE_GIFT_SETTLED' USING ERRCODE = 'P0001';
    END IF;
    IF (p_outcome = 'given' OR p_actor <> v_gift.holder_user_id) AND v_note IS NULL THEN
        RAISE EXCEPTION 'SHARE_GIFT_NOTE_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF p_outcome = 'given' THEN
        UPDATE public.share_gifts SET status = 'given', settled_at = now(), settled_by = p_actor, note = v_note WHERE id = p_gift;
    ELSE
        UPDATE public.share_gifts SET status = 'returned', settled_at = now(), settled_by = p_actor, note = v_note WHERE id = p_gift;
        INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by, share_gift_id)
        VALUES (v_gift.holder_user_id, 'share', v_gift.amount, 'share_gift_returned', p_actor, p_gift);
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'wallet.share_gift_' || p_outcome, v_gift.holder_user_id::text,
            jsonb_build_object('gift_id', p_gift, 'amount', v_gift.amount));
    RETURN p_outcome;
END;
$$;
REVOKE ALL ON FUNCTION public.share_gift_settle(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_gift_settle(uuid, uuid, text, text) TO service_role;

-- ── Appendix H: Share-Bucket Destination Completion Rate ────────────────────
-- Gifts pledged in the window and old enough to judge (p_window_days), how
-- many were given inside the window, given later, returned, or are still
-- waiting; and, as the "invisible destination" risk itself, how many wallet
-- holders have Share coins but no active destination. Counts only.
CREATE OR REPLACE FUNCTION public.share_gift_completion(p_since timestamptz, p_window_days int DEFAULT 14)
RETURNS TABLE (pledged bigint, given_in_window bigint, given_later bigint, returned bigint, waiting bigint,
               holders_with_share bigint, holders_without_destination bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH judged AS (
        SELECT g.* FROM public.share_gifts g
        WHERE g.pledged_at >= p_since AND g.pledged_at <= now() - make_interval(days => p_window_days)
    ), share_holders AS (
        SELECT l.kid_user_id FROM public.wallet_ledger l
        WHERE l.bucket = 'share' GROUP BY l.kid_user_id HAVING sum(l.amount) > 0
    )
    SELECT (SELECT count(*) FROM judged),
           (SELECT count(*) FROM judged WHERE status = 'given' AND settled_at <= pledged_at + make_interval(days => p_window_days)),
           (SELECT count(*) FROM judged WHERE status = 'given' AND settled_at > pledged_at + make_interval(days => p_window_days)),
           (SELECT count(*) FROM judged WHERE status = 'returned'),
           (SELECT count(*) FROM judged WHERE status = 'pledged'),
           (SELECT count(*) FROM share_holders),
           (SELECT count(*) FROM share_holders h WHERE NOT EXISTS (
                SELECT 1 FROM public.share_destinations d WHERE d.holder_user_id = h.kid_user_id AND d.status = 'active'));
$$;
REVOKE ALL ON FUNCTION public.share_gift_completion(timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_gift_completion(timestamptz, int) TO service_role;

SELECT 'share_gift_flows_ok' AS sentinel;
