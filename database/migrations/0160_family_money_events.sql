-- family_money_events — S07.4, part 1 of 5 (D.13, D.15): the consent-gated
-- Block D behaviour stream, its emitters, its retention job and the Appendix H
-- diagnostics that read it.
-- @phase: expand
--
-- Parts, applied in this order after the S07.3 migrations: family_money_events
-- (this file), share_gift_destinations and share_gift_flows (D.14, the ledger
-- learns the Share destination), wallet_usual_split (D.13, a recommended default split with an
-- easy override) and savings_goal_next_step (D.15 next-goal prompt, D.16 goal
-- progress provenance). Rationale: docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.
--
-- WHY A SEPARATE STREAM. Appendix H asks for four behavioural diagnostics in
-- this checkpoint (Allowance-Triggered Redemption Spike and Split-Ratio
-- Engagement Quality for D.13; Save-Bucket Contribution Persistence and the
-- Post-Goal Motivation Cliff for D.15). Each is a record of what a child did
-- with their coins and when, which is analytics, not bookkeeping. So it goes
-- through the SAME consent gate as learning_events (H.1, 0090): a parent-
-- created child only while an active analytics_consents row exists, a
-- self-registered teen only with their own opt-in, never a guest or an
-- account carrying the under-13 origin marker. The gate is a BEFORE INSERT
-- trigger that silently drops the row, so no emitter can forget it and a
-- consent revoked mid-transaction still wins. The wallet itself never depends
-- on this stream: every emitter is an AFTER trigger or a trailing insert whose
-- only effect is this table.
--
-- NO FREE TEXT, BY CONSTRUCTION: closed vocabularies, integers and ids only.

-- ── The consent gate (mirrors guard_optional_learning_event, 0090) ──────────
CREATE OR REPLACE FUNCTION public.family_analytics_admitted(p_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_guest boolean;
    v_band  text;
BEGIN
    IF p_user IS NULL THEN
        RETURN false;
    END IF;
    SELECT is_anonymous INTO v_guest FROM auth.users WHERE id = p_user;
    IF NOT FOUND OR v_guest IS TRUE THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.account_safety_origins WHERE user_id = p_user AND under13_origin) THEN
        RETURN false;
    END IF;
    SELECT declared_age_band INTO v_band FROM public.account_age_declarations WHERE user_id = p_user;
    IF v_band IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user) THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'kid') THEN
        RETURN EXISTS (SELECT 1 FROM public.analytics_consents WHERE kid_user_id = p_user AND revoked_at IS NULL);
    ELSIF v_band = '13_to_17' THEN
        RETURN EXISTS (SELECT 1 FROM public.teen_analytics_preferences WHERE user_id = p_user AND enabled AND disclosure_version = 1);
    END IF;
    RETURN v_band = 'adult';
END;
$$;
REVOKE ALL ON FUNCTION public.family_analytics_admitted(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_analytics_admitted(uuid) TO service_role;

-- ── The stream ──────────────────────────────────────────────────────────────
-- credit              a new credit landed in a pocket (source = its class)
-- split_allocated     a payout was split; the recommended default at that
--                     moment and whether the child kept it (D.13)
-- redemption_requested a reward was requested or marked, with the hours since
--                     the last allowance and the last earned credit to Spend (D.13)
-- goal_reached / next_goal_prompted / next_goal_set / next_goal_declined (D.15)
CREATE TABLE IF NOT EXISTS public.family_money_events (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id               uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    -- ANY(ARRAY[...]) rather than an IN list: the analytics console's drift
    -- test (usageShared.test.ts) reads the last event IN-list CHECK of the
    -- migrations as the learning_events vocabulary; this stream is another.
    event                 text NOT NULL CHECK (event = ANY (ARRAY['credit', 'split_allocated', 'redemption_requested', 'goal_reached', 'next_goal_prompted', 'next_goal_set', 'next_goal_declined'])),
    source                text CHECK (source IN ('allowance', 'earned', 'gift', 'bonus', 'task', 'income', 'catalog', 'personal_reward')),
    bucket                text CHECK (bucket IN ('save', 'spend', 'share')),
    amount                integer,
    save_amount           integer CHECK (save_amount >= 0),
    spend_amount          integer CHECK (spend_amount >= 0),
    share_amount          integer CHECK (share_amount >= 0),
    default_save          integer CHECK (default_save >= 0),
    default_spend         integer CHECK (default_spend >= 0),
    default_share         integer CHECK (default_share >= 0),
    followed_default      boolean,
    hours_since_allowance numeric(12, 2) CHECK (hours_since_allowance >= 0),
    hours_since_earned    numeric(12, 2) CHECK (hours_since_earned >= 0),
    goal_id               uuid,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT family_money_event_shape CHECK (
        (event = 'credit' AND source IN ('allowance', 'earned', 'gift', 'bonus') AND bucket IS NOT NULL AND amount > 0)
        OR (event = 'split_allocated' AND source IN ('task', 'allowance', 'income') AND amount > 0
            AND save_amount + spend_amount + share_amount = amount
            AND default_save + default_spend + default_share = amount AND followed_default IS NOT NULL)
        OR (event = 'redemption_requested' AND source IN ('catalog', 'personal_reward') AND amount > 0)
        OR (event IN ('goal_reached', 'next_goal_prompted', 'next_goal_set', 'next_goal_declined') AND goal_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_family_money_events_event_time ON public.family_money_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_money_events_user_time ON public.family_money_events (user_id, created_at DESC);

ALTER TABLE public.family_money_events ENABLE ROW LEVEL SECURITY;
-- No client policies. Only the definer emitters below write; staff read the
-- aggregates through Core. Not even Core's service role may write a row, so
-- no request can forge a behaviour the child did not have.
REVOKE ALL ON public.family_money_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.family_money_events TO service_role;

-- Fail-closed: when the consent question cannot be answered, the event is
-- dropped (never recorded first and asked later), and the coin movement that
-- produced it goes through untouched: the wallet never depends on this stream.
CREATE OR REPLACE FUNCTION public.guard_family_money_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_admitted boolean;
BEGIN
    BEGIN
        -- Serialize with a concurrent consent change on the same account (0090).
        PERFORM 1 FROM auth.users WHERE id = NEW.user_id FOR UPDATE;
        v_admitted := public.family_analytics_admitted(NEW.user_id);
    EXCEPTION WHEN OTHERS THEN
        v_admitted := false;
    END;
    IF v_admitted IS NOT TRUE THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_family_money_event() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_money_event_admission ON public.family_money_events;
CREATE TRIGGER family_money_event_admission BEFORE INSERT ON public.family_money_events
    FOR EACH ROW EXECUTE FUNCTION public.guard_family_money_event();

-- ── Credit classes ──────────────────────────────────────────────────────────
-- allowance: a Tutor's scheduled allowance, or a teen's own income logged as
--   allowance. earned: an approved chore, or a teen's income logged as earned.
-- gift: a teen's income logged as a gift. bonus: the weekly savings bonus.
CREATE OR REPLACE FUNCTION public.family_money_credit_class(p_reason text, p_income_source text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT CASE p_reason
        WHEN 'task_approved' THEN 'earned'
        WHEN 'allowance' THEN 'allowance'
        WHEN 'savings_bonus' THEN 'bonus'
        WHEN 'self_income' THEN CASE p_income_source WHEN 'allowance' THEN 'allowance' WHEN 'earned' THEN 'earned' WHEN 'gift' THEN 'gift' END
    END;
$$;
REVOKE ALL ON FUNCTION public.family_money_credit_class(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_money_credit_class(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.emit_family_money_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_source text;
    v_class  text;
BEGIN
    IF NEW.self_action_id IS NOT NULL THEN
        SELECT source INTO v_source FROM public.wallet_self_actions WHERE id = NEW.self_action_id;
    END IF;
    v_class := public.family_money_credit_class(NEW.reason, v_source);
    IF v_class IS NOT NULL THEN
        INSERT INTO public.family_money_events (user_id, event, source, bucket, amount, goal_id, created_at)
        VALUES (NEW.kid_user_id, 'credit', v_class, NEW.bucket, NEW.amount, NEW.goal_id, NEW.created_at);
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.emit_family_money_credit() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_money_credit_event ON public.wallet_ledger;
CREATE TRIGGER family_money_credit_event AFTER INSERT ON public.wallet_ledger
    FOR EACH ROW WHEN (NEW.amount > 0 AND NEW.reason IN ('task_approved', 'allowance', 'self_income', 'savings_bonus'))
    EXECUTE FUNCTION public.emit_family_money_credit();

-- ── D.13: a reward request, timed against the last credits to Spend ─────────
-- Heath & Soll's rigidity prediction (Appendix G §2.1): a Spend balance fresh
-- from an allowance should predict impulsive requests more than a chore-by-
-- chore credit does. The timing is read from the ledger at request time.
CREATE OR REPLACE FUNCTION public.record_family_redemption_timing(p_holder uuid, p_source text, p_cost int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_allowance timestamptz;
    v_earned    timestamptz;
BEGIN
    SELECT max(l.created_at) FILTER (WHERE public.family_money_credit_class(l.reason, a.source) = 'allowance'),
           max(l.created_at) FILTER (WHERE public.family_money_credit_class(l.reason, a.source) = 'earned')
    INTO v_allowance, v_earned
    FROM public.wallet_ledger l
    LEFT JOIN public.wallet_self_actions a ON a.id = l.self_action_id
    WHERE l.kid_user_id = p_holder AND l.bucket = 'spend' AND l.amount > 0
      AND l.reason IN ('task_approved', 'allowance', 'self_income');
    INSERT INTO public.family_money_events (user_id, event, source, amount, hours_since_allowance, hours_since_earned)
    VALUES (p_holder, 'redemption_requested', p_source, p_cost,
            round((extract(epoch FROM now() - v_allowance) / 3600.0)::numeric, 2),
            round((extract(epoch FROM now() - v_earned) / 3600.0)::numeric, 2));
END;
$$;
REVOKE ALL ON FUNCTION public.record_family_redemption_timing(uuid, text, int) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.emit_family_redemption_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_cost int;
BEGIN
    IF TG_TABLE_NAME = 'redemptions' THEN
        SELECT cost INTO v_cost FROM public.redemption_catalog WHERE id = NEW.catalog_id;
        IF v_cost IS NOT NULL THEN
            PERFORM public.record_family_redemption_timing(NEW.kid_user_id, 'catalog', v_cost);
        END IF;
    ELSE
        PERFORM public.record_family_redemption_timing(NEW.holder_user_id, 'personal_reward', NEW.amount);
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.emit_family_redemption_request() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_money_redemption_event ON public.redemptions;
CREATE TRIGGER family_money_redemption_event AFTER INSERT ON public.redemptions
    FOR EACH ROW EXECUTE FUNCTION public.emit_family_redemption_request();
DROP TRIGGER IF EXISTS family_money_personal_reward_event ON public.wallet_self_actions;
CREATE TRIGGER family_money_personal_reward_event AFTER INSERT ON public.wallet_self_actions
    FOR EACH ROW WHEN (NEW.kind = 'personal_reward')
    EXECUTE FUNCTION public.emit_family_redemption_request();

-- ── Retention (D.21 applies the same bound as learning_events: 400 days) ────
CREATE OR REPLACE FUNCTION public.prune_family_money_events(p_retain_days int DEFAULT 400)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_removed bigint;
BEGIN
    IF p_retain_days IS NULL OR p_retain_days < 30 THEN
        RAISE EXCEPTION 'RETENTION_INVALID' USING ERRCODE = 'P0001';
    END IF;
    -- Runs only when the retention job calls it, never while this migration is
    -- applied (which deletes nothing, so it stays an expand migration).
    WITH gone AS (DELETE FROM public.family_money_events WHERE created_at < now() - make_interval(days => p_retain_days) RETURNING 1)
    SELECT count(*) INTO v_removed FROM gone;
    INSERT INTO public.insights_maintenance_log (job, retain_days, removed)
    VALUES ('prune_family_money_events', p_retain_days, v_removed);
    RETURN v_removed;
END;
$$;
REVOKE ALL ON FUNCTION public.prune_family_money_events(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_family_money_events(int) TO service_role;

-- ── Appendix H diagnostics (no target; counts and rates only, never an id) ──

-- D.13 Allowance-Triggered Redemption Spike. For each credit class (allowance,
-- earned) and each time-since-last-credit bin: the reward requests made in
-- that bin, the child-hours spent in that bin (from the credit events, so the
-- rate has a real denominator), and requests per 100 child-days. A request
-- with no earlier credit of the class is counted in the 'none' bin, which has
-- no exposure.
CREATE OR REPLACE FUNCTION public.family_redemption_credit_timing(p_since timestamptz)
RETURNS TABLE (credit_class text, bin text, requests bigint, exposure_hours numeric, rate_per_100_child_days numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH bins (ord, bin, lo, hi) AS (
        VALUES (1, '0_24h', 0, 24), (2, '24_72h', 24, 72), (3, '72_168h', 72, 168), (4, '168h_plus', 168, 1000000)
    ), classes (credit_class) AS (
        VALUES ('allowance'), ('earned')
    ), credits AS (
        SELECT e.user_id, e.source AS credit_class, e.created_at AS at,
               lead(e.created_at) OVER (PARTITION BY e.user_id, e.source ORDER BY e.created_at, e.id) AS next_at
        FROM public.family_money_events e
        WHERE e.event = 'credit' AND e.bucket = 'spend' AND e.source IN ('allowance', 'earned')
    ), exposure AS (
        SELECT c.credit_class, b.bin,
               sum(greatest(0, extract(epoch FROM
                   least(coalesce(c.next_at, now()), c.at + make_interval(hours => b.hi), now())
                   - greatest(c.at + make_interval(hours => b.lo), p_since)) / 3600.0)) AS hours
        FROM credits c CROSS JOIN bins b
        GROUP BY c.credit_class, b.bin
    ), requests AS (
        SELECT 'allowance'::text AS credit_class, e.hours_since_allowance AS hours FROM public.family_money_events e
        WHERE e.event = 'redemption_requested' AND e.created_at >= p_since
        UNION ALL
        SELECT 'earned', e.hours_since_earned FROM public.family_money_events e
        WHERE e.event = 'redemption_requested' AND e.created_at >= p_since
    ), binned AS (
        SELECT r.credit_class, coalesce((SELECT b.bin FROM bins b WHERE r.hours >= b.lo AND r.hours < b.hi), 'none') AS bin
        FROM requests r
    ), grid AS (
        SELECT c.credit_class, b.ord, b.bin FROM classes c CROSS JOIN bins b
        UNION ALL
        SELECT c.credit_class, 5, 'none' FROM classes c
    )
    SELECT g.credit_class, g.bin,
           (SELECT count(*) FROM binned x WHERE x.credit_class = g.credit_class AND x.bin = g.bin),
           CASE WHEN g.bin = 'none' THEN NULL ELSE round(coalesce(x.hours, 0)::numeric, 2) END,
           CASE WHEN g.bin = 'none' OR coalesce(x.hours, 0) = 0 THEN NULL
                ELSE round(((SELECT count(*) FROM binned y WHERE y.credit_class = g.credit_class AND y.bin = g.bin) * 2400.0 / x.hours)::numeric, 2) END
    FROM grid g
    LEFT JOIN exposure x ON x.credit_class = g.credit_class AND x.bin = g.bin
    ORDER BY g.credit_class, g.ord;
$$;
REVOKE ALL ON FUNCTION public.family_redemption_credit_timing(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_redemption_credit_timing(timestamptz) TO service_role;

-- D.13 Split-Ratio Engagement Quality: per payout source, how many splits kept
-- the recommended default and how many were adjusted. A near-zero adjusted
-- share over time says the split has become rote (Appendix H).
CREATE OR REPLACE FUNCTION public.family_split_engagement(p_since timestamptz)
RETURNS TABLE (source text, allocations bigint, kept_default bigint, adjusted bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT s.source,
           count(e.id),
           count(e.id) FILTER (WHERE e.followed_default),
           count(e.id) FILTER (WHERE NOT e.followed_default)
    FROM (VALUES ('task'), ('allowance'), ('income')) s (source)
    LEFT JOIN public.family_money_events e
      ON e.event = 'split_allocated' AND e.source = s.source AND e.created_at >= p_since
    GROUP BY s.source
    ORDER BY s.source;
$$;
REVOKE ALL ON FUNCTION public.family_split_engagement(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_split_engagement(timestamptz) TO service_role;

-- D.15 Save-Bucket Contribution Persistence (the baseline): children with a
-- new credit of their own (allowance, earned or gift) in the window, how many
-- put some of it in Save, and the Save share of those coins. The bonus is not
-- a contribution and is excluded.
CREATE OR REPLACE FUNCTION public.family_save_contribution_persistence(p_since timestamptz)
RETURNS TABLE (children bigint, save_contributors bigint, save_coins bigint, own_coins bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT count(DISTINCT e.user_id),
           count(DISTINCT e.user_id) FILTER (WHERE e.bucket = 'save'),
           coalesce(sum(e.amount) FILTER (WHERE e.bucket = 'save'), 0),
           coalesce(sum(e.amount), 0)
    FROM public.family_money_events e
    WHERE e.event = 'credit' AND e.source IN ('allowance', 'earned', 'gift') AND e.created_at >= p_since;
$$;
REVOKE ALL ON FUNCTION public.family_save_contribution_persistence(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_save_contribution_persistence(timestamptz) TO service_role;

-- D.15 Post-Goal Motivation Cliff: for every goal reached in the window at
-- least 14 days ago, the child's own Save contributions per day in the 28 days
-- up to the moment it was reached versus the 14 days after, split by whether a
-- next goal was set within 2 days of the celebration (the D.15 mechanism).
CREATE OR REPLACE FUNCTION public.family_post_goal_motivation(p_since timestamptz)
RETURNS TABLE (next_goal_within_2_days boolean, goals bigint, mean_before_per_day numeric, mean_after_per_day numeric, goals_with_drop bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH reached AS (
        SELECT DISTINCT ON (e.goal_id) e.user_id, e.goal_id, e.created_at AS at
        FROM public.family_money_events e
        WHERE e.event = 'goal_reached' AND e.created_at >= p_since AND e.created_at <= now() - interval '14 days'
        ORDER BY e.goal_id, e.created_at
    ), measured AS (
        SELECT r.goal_id,
               (SELECT coalesce(sum(c.amount), 0) FROM public.family_money_events c
                WHERE c.user_id = r.user_id AND c.event = 'credit' AND c.bucket = 'save' AND c.source IN ('allowance', 'earned', 'gift')
                  AND c.created_at > r.at - interval '28 days' AND c.created_at <= r.at) / 28.0 AS before_rate,
               (SELECT coalesce(sum(c.amount), 0) FROM public.family_money_events c
                WHERE c.user_id = r.user_id AND c.event = 'credit' AND c.bucket = 'save' AND c.source IN ('allowance', 'earned', 'gift')
                  AND c.created_at > r.at AND c.created_at <= r.at + interval '14 days') / 14.0 AS after_rate,
               EXISTS (SELECT 1 FROM public.family_money_events n
                       WHERE n.user_id = r.user_id AND n.event = 'next_goal_set' AND n.goal_id = r.goal_id
                         AND n.created_at <= r.at + interval '2 days') AS next_soon
        FROM reached r
    )
    SELECT s.next_soon, count(m.goal_id),
           round(coalesce(avg(m.before_rate), 0)::numeric, 3), round(coalesce(avg(m.after_rate), 0)::numeric, 3),
           count(m.goal_id) FILTER (WHERE m.after_rate < m.before_rate)
    FROM (VALUES (true), (false)) s (next_soon)
    LEFT JOIN measured m ON m.next_soon = s.next_soon
    GROUP BY s.next_soon
    ORDER BY s.next_soon DESC;
$$;
REVOKE ALL ON FUNCTION public.family_post_goal_motivation(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_post_goal_motivation(timestamptz) TO service_role;

SELECT 'family_money_events_ok' AS sentinel;
