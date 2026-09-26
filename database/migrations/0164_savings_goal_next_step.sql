-- savings_goal_next_step — S07.4, part 5 of 5 (D.15, D.16): "what's your next
-- goal?" at the celebration, and a goal's progress split by where its coins
-- came from.
-- @phase: expand
--
-- D.15 (Appendix G §2.3, "postreward resetting"): saving slows right after a
-- goal is reached. The moment a goal is reached, the database opens a next
-- step for it (pending). The child's first view of the reached goal is the one
-- OD-7 celebration, and it carries the prompt (prompted). The child either
-- starts a next goal that follows this one (set) or says "not now"
-- (declined). A "not now" is respected: the prompt does not come back, and a
-- next goal can still follow later. Each step writes a consent-gated event,
-- so Appendix H's Post-Goal Motivation Cliff can compare children who set a
-- next goal within 2 days with those who did not.
--
-- D.16 (Appendix G §2.3, "illusionary goal progress"): a goal's progress is
-- read with its provenance: the child's own coins (chores, allowance, their
-- own logged income), bonus coins and Tutor coins, never one mixed number.
-- Today the savings bonus can never be tagged to a goal (the ledger guard
-- refuses it), so bonus is 0 in every goal; the breakdown makes any future
-- path that adds one visible instead of silent. Coins taken out of a goal are
-- taken from the child's own part first, so the "yours" part is never
-- overstated.

-- ── D.15: which goal a new goal follows ─────────────────────────────────────
ALTER TABLE public.savings_goals
    ADD COLUMN IF NOT EXISTS follows_goal_id uuid REFERENCES public.savings_goals (id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_savings_goals_follows ON public.savings_goals (follows_goal_id) WHERE follows_goal_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_savings_goal_follows()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.follows_goal_id IS DISTINCT FROM OLD.follows_goal_id AND NEW.follows_goal_id IS NOT NULL THEN
            RAISE EXCEPTION 'GOAL_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.follows_goal_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.savings_goals g
        WHERE g.id = NEW.follows_goal_id AND g.kid_user_id = NEW.kid_user_id AND g.reached_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'GOAL_FOLLOWS_INVALID' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_savings_goal_follows() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS savings_goal_follows_guard ON public.savings_goals;
CREATE TRIGGER savings_goal_follows_guard BEFORE INSERT OR UPDATE OF follows_goal_id ON public.savings_goals
    FOR EACH ROW EXECUTE FUNCTION public.guard_savings_goal_follows();

-- ── D.15: the next step of a reached goal ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goal_next_steps (
    goal_id        uuid PRIMARY KEY REFERENCES public.savings_goals (id) ON DELETE CASCADE,
    holder_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    state          text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'prompted', 'set', 'declined')),
    reached_at     timestamptz NOT NULL,
    prompted_at    timestamptz,
    decided_at     timestamptz,
    next_goal_id   uuid REFERENCES public.savings_goals (id) ON DELETE SET NULL,
    CONSTRAINT goal_next_step_shape CHECK (
        (state = 'pending' AND prompted_at IS NULL AND decided_at IS NULL AND next_goal_id IS NULL)
        OR (state = 'prompted' AND prompted_at IS NOT NULL AND decided_at IS NULL AND next_goal_id IS NULL)
        OR (state = 'declined' AND decided_at IS NOT NULL AND next_goal_id IS NULL)
        OR (state = 'set' AND decided_at IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_goal_next_steps_holder ON public.goal_next_steps (holder_user_id, reached_at DESC);
ALTER TABLE public.goal_next_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS goal_next_steps_select_party ON public.goal_next_steps;
CREATE POLICY goal_next_steps_select_party ON public.goal_next_steps
    FOR SELECT USING (holder_user_id = auth.uid() OR public.is_verified_guardian_of(holder_user_id));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.goal_next_steps FROM anon, authenticated, service_role;
GRANT SELECT ON public.goal_next_steps TO service_role;

CREATE OR REPLACE FUNCTION public.guard_goal_next_step()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.state <> 'pending' OR NOT EXISTS (
            SELECT 1 FROM public.savings_goals g
            WHERE g.id = NEW.goal_id AND g.kid_user_id = NEW.holder_user_id AND g.reached_at IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'GOAL_NEXT_STEP_INVALID' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;
    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['next_goal_id'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF NOT (v_changed <@ ARRAY['state', 'prompted_at', 'decided_at', 'next_goal_id'])
       OR (v_changed && ARRAY['prompted_at'] AND OLD.prompted_at IS NOT NULL)
       OR NOT ((OLD.state = 'pending' AND NEW.state = 'prompted')
               OR (OLD.state IN ('pending', 'prompted') AND NEW.state = 'declined')
               OR (OLD.state IN ('pending', 'prompted', 'declined') AND NEW.state = 'set' AND NEW.next_goal_id IS NOT NULL)) THEN
        RAISE EXCEPTION 'GOAL_NEXT_STEP_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
            DETAIL = format('%s -> %s', OLD.state, NEW.state);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_goal_next_step() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS goal_next_step_guard ON public.goal_next_steps;
CREATE TRIGGER goal_next_step_guard BEFORE INSERT OR UPDATE ON public.goal_next_steps
    FOR EACH ROW EXECUTE FUNCTION public.guard_goal_next_step();
DROP TRIGGER IF EXISTS goal_next_step_state_transition_audit ON public.goal_next_steps;
CREATE TRIGGER goal_next_step_state_transition_audit AFTER UPDATE OF state ON public.goal_next_steps
    FOR EACH ROW EXECUTE FUNCTION public.record_family_state_transition('state', 'goal_id', 'holder_user_id');

-- A goal reached (by any path: a chore, an allowance, a teen's income, Core's
-- fallback flip) opens its next step, in the same transaction.
CREATE OR REPLACE FUNCTION public.open_goal_next_step()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    INSERT INTO public.goal_next_steps (goal_id, holder_user_id, reached_at)
    VALUES (NEW.id, NEW.kid_user_id, NEW.reached_at)
    ON CONFLICT (goal_id) DO NOTHING;
    INSERT INTO public.family_money_events (user_id, event, goal_id) VALUES (NEW.kid_user_id, 'goal_reached', NEW.id);
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.open_goal_next_step() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS savings_goal_opens_next_step ON public.savings_goals;
CREATE TRIGGER savings_goal_opens_next_step AFTER UPDATE OF status ON public.savings_goals
    FOR EACH ROW WHEN (OLD.status = 'active' AND NEW.status = 'reached')
    EXECUTE FUNCTION public.open_goal_next_step();

-- A new goal that follows a reached one closes that goal's next step as set.
CREATE OR REPLACE FUNCTION public.close_goal_next_step()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_reached timestamptz;
BEGIN
    UPDATE public.goal_next_steps SET state = 'set', decided_at = now(), next_goal_id = NEW.id
    WHERE goal_id = NEW.follows_goal_id AND state <> 'set'
    RETURNING reached_at INTO v_reached;
    IF v_reached IS NOT NULL THEN
        INSERT INTO public.family_money_events (user_id, event, goal_id) VALUES (NEW.kid_user_id, 'next_goal_set', NEW.follows_goal_id);
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.close_goal_next_step() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS savings_goal_closes_next_step ON public.savings_goals;
CREATE TRIGGER savings_goal_closes_next_step AFTER INSERT ON public.savings_goals
    FOR EACH ROW WHEN (NEW.follows_goal_id IS NOT NULL)
    EXECUTE FUNCTION public.close_goal_next_step();

-- The child's first view of a reached goal. true = this call is the first, so
-- this is the one moment to celebrate (OD-7: once per moment); false = already
-- seen, decided, or no next step (a goal reached before this checkpoint).
CREATE OR REPLACE FUNCTION public.goal_next_step_seen(p_holder uuid, p_goal uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_state text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    SELECT state INTO v_state FROM public.goal_next_steps WHERE goal_id = p_goal AND holder_user_id = p_holder FOR UPDATE;
    IF NOT FOUND THEN
        IF NOT EXISTS (SELECT 1 FROM public.savings_goals WHERE id = p_goal AND kid_user_id = p_holder) THEN
            RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
        END IF;
        RETURN false;
    END IF;
    IF v_state <> 'pending' THEN
        RETURN false;
    END IF;
    UPDATE public.goal_next_steps SET state = 'prompted', prompted_at = now() WHERE goal_id = p_goal;
    INSERT INTO public.family_money_events (user_id, event, goal_id) VALUES (p_holder, 'next_goal_prompted', p_goal);
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.goal_next_step_seen(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.goal_next_step_seen(uuid, uuid) TO service_role;

-- "Not now". true = declined now; false = already declined or set.
CREATE OR REPLACE FUNCTION public.goal_next_step_decline(p_holder uuid, p_goal uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_state text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_holder::text, 1));
    SELECT state INTO v_state FROM public.goal_next_steps WHERE goal_id = p_goal AND holder_user_id = p_holder FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_state NOT IN ('pending', 'prompted') THEN
        RETURN false;
    END IF;
    UPDATE public.goal_next_steps SET state = 'declined', decided_at = now() WHERE goal_id = p_goal;
    INSERT INTO public.family_money_events (user_id, event, goal_id) VALUES (p_holder, 'next_goal_declined', p_goal);
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.goal_next_step_decline(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.goal_next_step_decline(uuid, uuid) TO service_role;

-- ── D.16: a goal's progress by provenance ───────────────────────────────────
-- own:    the child's own coins (a chore reward, an allowance, their own
--         logged income)
-- bonus:  the weekly savings bonus (never taggable today; see header)
-- family: any other credit (none can be tagged today)
-- Coins taken out of the goal (a Tutor's withdrawal, a teen's own release)
-- come out of own first, then family, then bonus, so own is a floor.
CREATE OR REPLACE FUNCTION public.goal_progress_breakdown(p_goal_ids uuid[])
RETURNS TABLE (goal_id uuid, own bigint, bonus bigint, family bigint, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH sums AS (
        SELECT g.id,
               coalesce(sum(l.amount) FILTER (WHERE l.amount > 0 AND l.reason IN ('task_approved', 'allowance', 'self_income')), 0) AS own_in,
               coalesce(sum(l.amount) FILTER (WHERE l.amount > 0 AND l.reason = 'savings_bonus'), 0) AS bonus_in,
               coalesce(sum(l.amount) FILTER (WHERE l.amount > 0 AND l.reason NOT IN ('task_approved', 'allowance', 'self_income', 'savings_bonus')), 0) AS family_in,
               coalesce(-sum(l.amount) FILTER (WHERE l.amount < 0), 0) AS taken
        FROM unnest(p_goal_ids) AS g (id)
        LEFT JOIN public.wallet_ledger l ON l.goal_id = g.id
        GROUP BY g.id
    ), attributed AS (
        SELECT id, own_in, bonus_in, family_in, taken,
               greatest(own_in - taken, 0) AS own_left,
               greatest(taken - own_in, 0) AS after_own
        FROM sums
    )
    SELECT id,
           own_left,
           greatest(bonus_in - greatest(after_own - family_in, 0), 0),
           greatest(family_in - after_own, 0),
           own_in + bonus_in + family_in - taken
    FROM attributed;
$$;
REVOKE ALL ON FUNCTION public.goal_progress_breakdown(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.goal_progress_breakdown(uuid[]) TO service_role;

SELECT 'savings_goal_next_step_ok' AS sentinel;
