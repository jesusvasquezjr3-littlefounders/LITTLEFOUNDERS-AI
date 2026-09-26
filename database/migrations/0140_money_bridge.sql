-- money_bridge — S07.7, part 3 of 5 (D.19): the first milestone of the
-- older-teen graduation initiative, enforced by age evidence.
-- @phase: expand
--
-- D.19 (Appendix G §3.1, §3.3): education delivered close to a real decision
-- ("just in time") outperforms education delivered long before it, and a pure
-- simulation builds the ability half of financial capability, never the
-- opportunity half. The initiative (docs/operations/OLDER-TEEN-GRADUATION-
-- INITIATIVE.md) is multi-year; its first milestone ships here: from 15, a
-- wallet holder sees a "beyond the app" path with three real-world moments
-- (first real pay, first account at a bank, first real budget), each with a
-- short checklist timed to when the teen says the moment has arrived.
--
-- WHAT IS STORED. Only the teen's own checklist: which moment they said has
-- arrived (step 0) and which steps they ticked (1-3). No amount, no bank, no
-- account detail, ever: the split tool that applies the teen's usual split to
-- a real amount runs in the browser and sends nothing. Coins never convert
-- and nothing links to a real account (the D.7 gate fails on any banking SDK).
--
-- ELIGIBILITY BY AGE EVIDENCE, NEVER ROLE (OD-3): a wallet holder (a
-- parent-created child or a self-registered teen) whose stored birth date
-- makes them 15 or older. No birth date means no known age, so no bridge.
--
-- Metric (Appendix H Part 1.1, Diagnostic): Real-World Bridge Engagement
-- Rate, the share of eligible teens with any checklist entry, per moment.
-- Retention: the checklist is the teen's own record, kept while the account
-- exists and erased with it (docs/operations/FAMILY-DATA-RETENTION.md).

CREATE TABLE IF NOT EXISTS public.money_bridge_progress (
    holder_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    milestone      text NOT NULL CHECK (milestone IN ('first_pay', 'first_account', 'first_budget')),
    step           smallint NOT NULL CHECK (step BETWEEN 0 AND 3),
    done_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (holder_user_id, milestone, step)
);
ALTER TABLE public.money_bridge_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS money_bridge_progress_select_own ON public.money_bridge_progress;
CREATE POLICY money_bridge_progress_select_own ON public.money_bridge_progress
    FOR SELECT USING (holder_user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.money_bridge_progress FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.money_bridge_progress FROM service_role;

CREATE OR REPLACE FUNCTION public.money_bridge_eligible(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL
       AND public.wallet_holder_kind(p_user) IS NOT NULL
       AND coalesce((SELECT date_part('year', age(current_date, p.birth_date))::int
                     FROM public.profiles p WHERE p.user_id = p_user AND p.birth_date IS NOT NULL), 0) >= 15;
$$;
REVOKE ALL ON FUNCTION public.money_bridge_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.money_bridge_eligible(uuid) TO service_role;

-- The teen's own view: eligibility and the checklist.
CREATE OR REPLACE FUNCTION public.money_bridge_state(p_holder uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT jsonb_build_object(
        'eligible', public.money_bridge_eligible(p_holder),
        'progress', CASE WHEN public.money_bridge_eligible(p_holder) THEN coalesce((
            SELECT jsonb_agg(jsonb_build_object('milestone', m.milestone, 'step', m.step, 'done_at', m.done_at)
                             ORDER BY m.milestone, m.step)
            FROM public.money_bridge_progress m WHERE m.holder_user_id = p_holder), '[]'::jsonb) ELSE '[]'::jsonb END);
$$;
REVOKE ALL ON FUNCTION public.money_bridge_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.money_bridge_state(uuid) TO service_role;

-- Tick or untick one entry. A step (1-3) can only be ticked once the teen has
-- said the moment arrived (step 0), and unticking the moment clears its steps.
CREATE OR REPLACE FUNCTION public.money_bridge_mark(p_holder uuid, p_milestone text, p_step int, p_done boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_removed bigint;
BEGIN
    IF NOT public.money_bridge_eligible(p_holder) THEN
        RAISE EXCEPTION 'BRIDGE_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
    END IF;
    IF p_milestone IS NULL OR p_milestone NOT IN ('first_pay', 'first_account', 'first_budget')
       OR p_step IS NULL OR p_step NOT BETWEEN 0 AND 3 OR p_done IS NULL THEN
        RAISE EXCEPTION 'BRIDGE_ENTRY_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF p_done THEN
        IF p_step > 0 AND NOT EXISTS (SELECT 1 FROM public.money_bridge_progress
                                      WHERE holder_user_id = p_holder AND milestone = p_milestone AND step = 0) THEN
            RAISE EXCEPTION 'BRIDGE_MOMENT_FIRST' USING ERRCODE = 'P0001';
        END IF;
        INSERT INTO public.money_bridge_progress (holder_user_id, milestone, step)
            VALUES (p_holder, p_milestone, p_step::smallint) ON CONFLICT DO NOTHING;
    ELSE
        -- Runs only when a teen unticks an entry, never while this migration is applied.
        WITH gone AS (DELETE FROM public.money_bridge_progress
            WHERE holder_user_id = p_holder AND milestone = p_milestone AND (step = p_step OR p_step = 0) RETURNING 1)
        SELECT count(*) INTO v_removed FROM gone;
    END IF;
    RETURN public.money_bridge_state(p_holder);
END;
$$;
REVOKE ALL ON FUNCTION public.money_bridge_mark(uuid, text, int, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.money_bridge_mark(uuid, text, int, boolean) TO service_role;

-- ── Appendix H Part 1.1: Real-World Bridge Engagement Rate (Diagnostic) ────
-- Eligible: wallet holders who are 15 or older today. Engaged: any entry.
-- Per moment: how many said it arrived and how many ticked every step.
CREATE OR REPLACE FUNCTION public.money_bridge_engagement()
RETURNS TABLE (milestone text, eligible bigint, engaged bigint, arrived bigint, completed bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH holders AS (
        SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'kid'
        UNION
        SELECT user_id FROM public.account_age_declarations WHERE declared_age_band = '13_to_17'
    ),
    eligible AS (
        SELECT h.user_id FROM holders h WHERE public.money_bridge_eligible(h.user_id)
    ),
    moments AS (
        SELECT * FROM (VALUES (0, 'all'), (1, 'first_pay'), (2, 'first_account'), (3, 'first_budget')) AS v (ord, name)
    )
    SELECT m.name,
           (SELECT count(*) FROM eligible),
           (SELECT count(DISTINCT p.holder_user_id) FROM public.money_bridge_progress p JOIN eligible e ON e.user_id = p.holder_user_id
             WHERE m.name = 'all' OR p.milestone = m.name),
           (SELECT count(DISTINCT p.holder_user_id) FROM public.money_bridge_progress p JOIN eligible e ON e.user_id = p.holder_user_id
             WHERE p.step = 0 AND (m.name = 'all' OR p.milestone = m.name)),
           (SELECT count(*) FROM (
               SELECT p.holder_user_id, p.milestone FROM public.money_bridge_progress p JOIN eligible e ON e.user_id = p.holder_user_id
               WHERE m.name = 'all' OR p.milestone = m.name
               GROUP BY p.holder_user_id, p.milestone HAVING count(*) = 4) done)
    FROM moments m
    ORDER BY m.ord;
$$;
REVOKE ALL ON FUNCTION public.money_bridge_engagement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.money_bridge_engagement() TO service_role;

SELECT 'migration_money_bridge_ok' AS sentinel;
