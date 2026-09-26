-- savings_bonus_age_framing — S07.3 (D.11): the savings bonus a child can
-- actually understand.
-- @phase: contract
-- @after-release: none — narrows what any writer may store in
--   savings_bonus_rules (a verified guardian, a wallet holder, and the fixed
--   ratio for a child under 13) and changes the weekly credit for under-13
--   children to the fixed ratio. The current Core's PUT /banking/savings-bonus
--   keeps working for a 13-17 child and for any child at the fixed ratio; for
--   a younger child it is refused until the S07.3 Core ships. Apply with the
--   Core release that ships the S07.3 routes, after
--   family_task_contribution_kind.
--
-- WHY. Appendix G §1.5 and §2.4: a percentage-of-balance weekly bonus is not
-- reliably understandable before early-to-mid adolescence (Ebersbach et al.
-- 2008), and even adults misjudge compound growth (Stango & Zinman 2009), so
-- for a young child "20% a week" reads as "the app sometimes gives free
-- coins". D.11 therefore mandates two framings, by age, never by role:
--
--   per_ten  under 13, or no known birth date (the younger framing is the
--            conservative default): "for every 10 coins you keep saved, you
--            get 1 more each week". The ratio is fixed (1 per 10, the SPEC's
--            proposed starting ratio, tracked in the Block D threshold log);
--            a Tutor switches it on or off, never picks a percentage.
--   percent  13 to 17 (a self-registered teen, or a parent-created child whose
--            birth date says 13+): the Tutor's 0-20% rate, shown with a
--            worked example the teen completes (the Age-Tier Bonus
--            Comprehension Proxy below).
--
-- The weekly credit itself (run_due_scheduled_credits) now applies the
-- framing the child is in AT CREDIT TIME: a stored percentage can never reach
-- an under-13 child, whatever was written before or by whom.
--
-- Existing rules for under-13 children (the S07.1 data a family already has):
--   rate >= 10%  -> the fixed ratio (never more than the Tutor agreed to)
--   0 < rate < 10%, or 0% -> switched off, so no coins are minted above what
--                    the Tutor agreed; the Tutor sees why and can switch it on
-- The previous rate is kept in reframed_from_rate_bp so the Tutor's screen
-- can say what changed; Core clears it on the Tutor's next save.

-- ── Which framing a wallet holder is in ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.savings_bonus_framing(p_kid uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_kind  text;
    v_birth date;
BEGIN
    v_kind := public.wallet_holder_kind(p_kid);
    IF v_kind IS NULL THEN
        RETURN NULL;
    END IF;
    IF v_kind = 'teen' THEN
        RETURN 'percent';
    END IF;
    SELECT birth_date INTO v_birth FROM public.profiles WHERE user_id = p_kid;
    IF v_birth IS NULL OR date_part('year', age(current_date, v_birth))::int < 13 THEN
        RETURN 'per_ten';
    END IF;
    RETURN 'percent';
END;
$$;
REVOKE ALL ON FUNCTION public.savings_bonus_framing(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.savings_bonus_framing(uuid) TO service_role;

-- ── Existing rules move to the framing their child is in ────────────────────
ALTER TABLE public.savings_bonus_rules ADD COLUMN IF NOT EXISTS reframed_from_rate_bp integer;

UPDATE public.savings_bonus_rules r
SET reframed_from_rate_bp = r.rate_bp,
    active = r.active AND r.rate_bp >= 1000,
    rate_bp = 1000
WHERE public.savings_bonus_framing(r.kid_user_id) = 'per_ten' AND r.rate_bp <> 1000;

-- ── Rule writes, for every writer ────────────────────────────────────────────
-- A configuration change (rate, on/off, the Tutor) needs a wallet holder, a
-- verified guardian of that child, and the fixed ratio for a per_ten child.
-- The weekly job's own bookkeeping (next_run_at only) is always allowed, so a
-- Tutor stepping away never stops the credit job for everything else.
CREATE OR REPLACE FUNCTION public.guard_savings_bonus_rule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
    v_framing text;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
        IF v_changed <@ ARRAY['next_run_at', 'reframed_from_rate_bp'] THEN
            RETURN NEW;
        END IF;
        IF v_changed && ARRAY['kid_user_id', 'created_at'] THEN
            RAISE EXCEPTION 'SAVINGS_BONUS_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    v_framing := public.savings_bonus_framing(NEW.kid_user_id);
    IF v_framing IS NULL THEN
        RAISE EXCEPTION 'WALLET_HOLDER_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.family_is_verified_guardian(NEW.parent_user_id, NEW.kid_user_id) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF v_framing = 'per_ten' AND NEW.rate_bp <> 1000 THEN
        RAISE EXCEPTION 'SAVINGS_BONUS_FIXED_FOR_AGE' USING ERRCODE = 'P0001',
            DETAIL = 'Under 13 the bonus is 1 coin for every 10 coins saved.';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_savings_bonus_rule() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS savings_bonus_rule_guard ON public.savings_bonus_rules;
CREATE TRIGGER savings_bonus_rule_guard BEFORE INSERT OR UPDATE ON public.savings_bonus_rules
    FOR EACH ROW EXECUTE FUNCTION public.guard_savings_bonus_rule();

-- ── The weekly credit, by framing (0093's job verbatim otherwise) ────────────
CREATE OR REPLACE FUNCTION public.run_due_scheduled_credits(p_kid_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_allowance public.allowance_rules%rowtype;
    v_bonus     public.savings_bonus_rules%rowtype;
    v_credited  int := 0;
    v_iter      int;
    v_save_balance int;
    v_bonus_amount int;
    v_step      interval;
    v_framing   text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid_user_id::text, 1));
    IF NOT public.banking_movement_allowed(p_kid_user_id) THEN RETURN 0; END IF;

    SELECT * INTO v_allowance FROM public.allowance_rules
    WHERE kid_user_id = p_kid_user_id AND active FOR UPDATE;

    IF found THEN
        v_step := CASE v_allowance.frequency
            WHEN 'weekly' THEN interval '7 days'
            WHEN 'biweekly' THEN interval '14 days'
            ELSE interval '1 month'
        END;
        v_iter := 0;
        WHILE v_allowance.next_run_at <= now() AND v_iter < 8 LOOP
            INSERT INTO public.pending_credits (kid_user_id, amount, source, source_ref)
            VALUES (p_kid_user_id, v_allowance.amount, 'allowance', v_allowance.id);
            v_allowance.next_run_at := v_allowance.next_run_at + v_step;
            v_iter := v_iter + 1;
            v_credited := v_credited + 1;
        END LOOP;
        WHILE v_allowance.next_run_at <= now() LOOP
            v_allowance.next_run_at := v_allowance.next_run_at + v_step;
        END LOOP;
        UPDATE public.allowance_rules SET next_run_at = v_allowance.next_run_at WHERE id = v_allowance.id;
    END IF;

    SELECT * INTO v_bonus FROM public.savings_bonus_rules
    WHERE kid_user_id = p_kid_user_id AND active FOR UPDATE;

    IF found THEN
        v_framing := public.savings_bonus_framing(p_kid_user_id);
        v_iter := 0;
        WHILE v_bonus.next_run_at <= now() AND v_iter < 8 LOOP
            SELECT coalesce(sum(amount), 0) INTO v_save_balance
            FROM public.wallet_ledger WHERE kid_user_id = p_kid_user_id AND bucket = 'save';
            -- per_ten: 1 coin for every full 10 coins saved, whatever rate is
            -- stored. percent: the Tutor's rate. No framing (no longer a
            -- wallet holder): nothing is credited.
            v_bonus_amount := CASE v_framing
                WHEN 'per_ten' THEN greatest(v_save_balance, 0) / 10
                WHEN 'percent' THEN floor(greatest(v_save_balance, 0) * v_bonus.rate_bp / 10000.0)::int
                ELSE 0
            END;
            IF v_bonus_amount > 0 THEN
                INSERT INTO public.wallet_ledger (kid_user_id, bucket, amount, reason, created_by)
                VALUES (p_kid_user_id, 'save', v_bonus_amount, 'savings_bonus', p_kid_user_id);
            END IF;
            v_bonus.next_run_at := v_bonus.next_run_at + interval '7 days';
            v_iter := v_iter + 1;
            v_credited := v_credited + 1;
        END LOOP;
        WHILE v_bonus.next_run_at <= now() LOOP
            v_bonus.next_run_at := v_bonus.next_run_at + interval '7 days';
        END LOOP;
        UPDATE public.savings_bonus_rules SET next_run_at = v_bonus.next_run_at WHERE kid_user_id = p_kid_user_id;
    END IF;

    RETURN v_credited;
END;
$$;

REVOKE ALL ON FUNCTION public.run_due_scheduled_credits(uuid) FROM public;
REVOKE ALL ON FUNCTION public.run_due_scheduled_credits(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.run_due_scheduled_credits(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_due_scheduled_credits(uuid) TO service_role;

-- ── The 13-17 worked example ─────────────────────────────────────────────────
-- One row per teen: when the worked example was first shown, how many answers
-- were tried and when a correct one was first given. The answer is checked
-- here against the child's CURRENT rate, never taken from the client.
CREATE TABLE IF NOT EXISTS public.savings_bonus_explanations (
    user_id        uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    first_shown_at timestamptz NOT NULL DEFAULT now(),
    attempts       integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    completed_at   timestamptz
);

ALTER TABLE public.savings_bonus_explanations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS savings_bonus_explanations_select_own ON public.savings_bonus_explanations;
CREATE POLICY savings_bonus_explanations_select_own ON public.savings_bonus_explanations
    FOR SELECT USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.savings_bonus_explanations FROM anon, authenticated;

-- p_step 'shown': records the first view. p_step 'answered': checks the answer
-- for p_example_saved coins (10..10000) at the child's current rate; returns
-- whether it was right. Only a 13-17 child with an active percentage bonus
-- has this teaching moment (EXAMPLE_NOT_APPLICABLE otherwise).
CREATE OR REPLACE FUNCTION public.record_savings_bonus_explanation(
    p_user uuid, p_step text, p_example_saved int, p_answer int
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_rate    int;
    v_correct boolean;
BEGIN
    IF p_user IS NULL OR p_step IS NULL OR p_step NOT IN ('shown', 'answered') THEN
        RAISE EXCEPTION 'EXAMPLE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF public.savings_bonus_framing(p_user) IS DISTINCT FROM 'percent' THEN
        RAISE EXCEPTION 'EXAMPLE_NOT_APPLICABLE' USING ERRCODE = 'P0001';
    END IF;
    SELECT rate_bp INTO v_rate FROM public.savings_bonus_rules WHERE kid_user_id = p_user AND active;
    IF NOT FOUND OR v_rate = 0 THEN
        RAISE EXCEPTION 'EXAMPLE_NOT_APPLICABLE' USING ERRCODE = 'P0001';
    END IF;
    IF p_step = 'shown' THEN
        INSERT INTO public.savings_bonus_explanations (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
        RETURN true;
    END IF;
    IF p_example_saved IS NULL OR p_answer IS NULL OR p_example_saved NOT BETWEEN 10 AND 10000 OR p_answer < 0 THEN
        RAISE EXCEPTION 'EXAMPLE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    v_correct := p_answer = floor(p_example_saved * v_rate / 10000.0)::int;
    INSERT INTO public.savings_bonus_explanations (user_id, attempts, completed_at)
    VALUES (p_user, 1, CASE WHEN v_correct THEN now() END)
    ON CONFLICT (user_id) DO UPDATE
    SET attempts = public.savings_bonus_explanations.attempts + 1,
        completed_at = coalesce(public.savings_bonus_explanations.completed_at, CASE WHEN v_correct THEN now() END);
    RETURN v_correct;
END;
$$;
REVOKE ALL ON FUNCTION public.record_savings_bonus_explanation(uuid, text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_savings_bonus_explanation(uuid, text, int, int) TO service_role;

-- ── Appendix H: Age-Tier Bonus Comprehension Proxy (Diagnostic) ─────────────
-- Counts only: 13-17 children with an active percentage bonus today, how many
-- were first shown the worked example inside the window, and how many of
-- those completed it (a correct answer).
CREATE OR REPLACE FUNCTION public.savings_bonus_comprehension(p_since timestamptz)
RETURNS TABLE (eligible bigint, shown bigint, completed bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT (SELECT count(*) FROM public.savings_bonus_rules r
            WHERE r.active AND r.rate_bp > 0 AND public.savings_bonus_framing(r.kid_user_id) = 'percent'),
           count(*) FILTER (WHERE e.first_shown_at >= p_since),
           count(*) FILTER (WHERE e.first_shown_at >= p_since AND e.completed_at IS NOT NULL)
    FROM public.savings_bonus_explanations e;
$$;
REVOKE ALL ON FUNCTION public.savings_bonus_comprehension(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.savings_bonus_comprehension(timestamptz) TO service_role;

SELECT 'savings_bonus_age_framing_ok' AS sentinel;
