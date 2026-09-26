-- family_research_instrumentation — S07.7, part 4 of 5 (D.22, D.19 (c)): the
-- first phase of the long-horizon instrumentation that can one day test the
-- product's own central hypothesis, observational and consent-gated.
-- @phase: expand
--
-- THE HYPOTHESIS (Appendix G §3.6): practising Save/Spend/Share and earning in
-- childhood produces better adult money behaviour. No study has shown it; the
-- company treats it as an open question it is testing, never as a result
-- (docs/operations/BLOCK-D-LONGITUDINAL-RESEARCH-PLAN.md).
--
-- OD-23 AND THE CONSENT MODEL. No experiment runs on a minor: this phase only
-- observes, and only with a separate, specific research consent (the FTC's
-- 2025 COPPA amendments ask for consent to the specific practice, Appendix G
-- §4.6), distinct from the H.1 analytics consent:
--   * a child in a family (under 18, or of unknown age) only when a verified
--     Tutor says yes, and only while that Tutor is still their verified Tutor;
--   * an adult (18+ by birth date, or an adult declaration) only by their own
--     yes. A Tutor's yes for a child lapses at 18 until the young adult says
--     yes themselves, and nothing more is recorded meanwhile;
--   * never a guest, and never a self-registered teen without a Tutor in this
--     phase (nobody can give the parental consent; owner question in the plan).
-- Saying no (the Tutor or the participant, the child included) withdraws and
-- deletes every snapshot at once.
--
-- WHAT IS RECORDED. One snapshot per participant per complete month after the
-- consent: counts and coin totals from records the product already keeps
-- (ledger, chores, goals, rewards, Share gifts, practised days, the bridge
-- checklist), the age in whole years, the register, the tenure and the level.
-- No names, no notes, no titles, no free text, no identity: snapshots are
-- keyed by a random research id; only these functions can map it back, and
-- only to delete it. Retention: 1,100 days (the first phase's horizon),
-- enforced by family_data_retention.
--
-- METRIC (Appendix H Part 1.4, Diagnostic): Longitudinal-Hypothesis Data
-- Completeness, overall and for the 15+ bridge population (D.19 (c)).

CREATE OR REPLACE FUNCTION public.family_research_disclosure_version()
RETURNS smallint LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 1::smallint $$;
REVOKE ALL ON FUNCTION public.family_research_disclosure_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_research_disclosure_version() TO service_role;

CREATE TABLE IF NOT EXISTS public.family_research_consents (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    grantor_kind       text NOT NULL CHECK (grantor_kind IN ('tutor', 'self')),
    granted_by         uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    disclosure_version smallint NOT NULL CHECK (disclosure_version >= 1),
    granted_at         timestamptz NOT NULL DEFAULT now(),
    revoked_at         timestamptz,
    revoked_by         uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    CONSTRAINT family_research_consent_revocation CHECK (revoked_at IS NOT NULL OR revoked_by IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS family_research_one_active_consent ON public.family_research_consents (subject_user_id) WHERE revoked_at IS NULL;
ALTER TABLE public.family_research_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_research_consents FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.family_research_consents TO service_role;

CREATE TABLE IF NOT EXISTS public.family_research_participants (
    subject_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    research_id     uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    enrolled_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.family_research_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_research_participants FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.family_research_snapshots (
    research_id      uuid NOT NULL REFERENCES public.family_research_participants (research_id) ON DELETE CASCADE,
    period           date NOT NULL CHECK (period = date_trunc('month', period)::date),
    age_years        smallint,
    register         text CHECK (register IN ('young', 'transition', 'teen')),
    tenure_months    smallint NOT NULL CHECK (tenure_months >= 0),
    autonomy_level   smallint NOT NULL CHECK (autonomy_level BETWEEN 1 AND 3),
    coins_received   integer NOT NULL CHECK (coins_received >= 0),
    coins_to_save    integer NOT NULL CHECK (coins_to_save >= 0),
    coins_spent      integer NOT NULL CHECK (coins_spent >= 0),
    coins_given      integer NOT NULL CHECK (coins_given >= 0),
    goals_reached    integer NOT NULL CHECK (goals_reached >= 0),
    next_goals_set   integer NOT NULL CHECK (next_goals_set >= 0),
    chores_approved  integer NOT NULL CHECK (chores_approved >= 0),
    rewards_asked    integer NOT NULL CHECK (rewards_asked >= 0),
    rewards_not_yet  integer NOT NULL CHECK (rewards_not_yet >= 0),
    practised_days   integer NOT NULL CHECK (practised_days >= 0),
    split_changed    boolean NOT NULL,
    bridge_entries   integer NOT NULL CHECK (bridge_entries >= 0),
    recorded_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (research_id, period)
);
ALTER TABLE public.family_research_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_research_snapshots FROM PUBLIC, anon, authenticated, service_role;

-- Whole years at a date, or NULL when the birth date is unknown.
CREATE OR REPLACE FUNCTION public.family_research_age_at(p_user uuid, p_at date)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT date_part('year', age(p_at, p.birth_date))::int FROM public.profiles p WHERE p.user_id = p_user AND p.birth_date IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION public.family_research_is_adult(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce(public.family_research_age_at(p_user, current_date) >= 18,
                    EXISTS (SELECT 1 FROM public.account_age_declarations WHERE user_id = p_user AND declared_age_band = 'adult'));
$$;
REVOKE ALL ON FUNCTION public.family_research_age_at(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_research_is_adult(uuid) FROM PUBLIC, anon, authenticated;

-- Is this account's data being recorded right now? Every rule, every time.
CREATE OR REPLACE FUNCTION public.family_research_admitted(p_subject uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_consent public.family_research_consents%ROWTYPE;
BEGIN
    SELECT * INTO v_consent FROM public.family_research_consents WHERE subject_user_id = p_subject AND revoked_at IS NULL;
    IF NOT FOUND OR v_consent.disclosure_version <> public.family_research_disclosure_version()
       OR public.wallet_holder_kind(p_subject) IS NULL
       OR EXISTS (SELECT 1 FROM auth.users WHERE id = p_subject AND is_anonymous) THEN
        RETURN false;
    END IF;
    IF v_consent.grantor_kind = 'self' THEN
        RETURN public.family_research_is_adult(p_subject);
    END IF;
    RETURN NOT public.family_research_is_adult(p_subject)
       AND public.family_is_verified_guardian(v_consent.granted_by, p_subject);
END;
$$;
REVOKE ALL ON FUNCTION public.family_research_admitted(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_research_admitted(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.family_research_state(p_subject uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT jsonb_build_object(
        'participating', c.id IS NOT NULL,
        'admitted', public.family_research_admitted(p_subject),
        'grantor', c.grantor_kind,
        'since', c.granted_at,
        'version', public.family_research_disclosure_version(),
        'adult', public.family_research_is_adult(p_subject),
        'snapshots', (SELECT count(*) FROM public.family_research_snapshots s
                      JOIN public.family_research_participants p ON p.research_id = s.research_id WHERE p.subject_user_id = p_subject))
    FROM (SELECT 1) one
    LEFT JOIN public.family_research_consents c ON c.subject_user_id = p_subject AND c.revoked_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.family_research_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_research_state(uuid) TO service_role;

-- Yes or no. Yes: a verified Tutor for a child under 18 (or of unknown age)
-- with a wallet, or an adult for themselves, having seen the current
-- disclosure. No: the Tutor, any verified Tutor of the child, or the
-- participant themselves (a child's own no counts), and it deletes the data.
CREATE OR REPLACE FUNCTION public.family_research_set_consent(p_subject uuid, p_actor uuid, p_participate boolean, p_version int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_self    boolean := p_actor IS NOT NULL AND p_actor = p_subject;
    v_tutor   boolean := public.family_is_verified_guardian(p_actor, p_subject);
    v_consent public.family_research_consents%ROWTYPE;
    v_active  boolean;
    v_removed bigint;
BEGIN
    IF p_subject IS NULL OR p_actor IS NULL OR p_participate IS NULL OR NOT (v_self OR v_tutor) THEN
        RAISE EXCEPTION 'RESEARCH_CONSENT_NOT_ALLOWED' USING ERRCODE = 'P0001';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_subject FOR UPDATE;
    SELECT * INTO v_consent FROM public.family_research_consents WHERE subject_user_id = p_subject AND revoked_at IS NULL;
    v_active := FOUND;

    IF NOT p_participate THEN
        IF v_active THEN
            UPDATE public.family_research_consents SET revoked_at = now(), revoked_by = p_actor WHERE id = v_consent.id;
        END IF;
        -- Runs only when someone says no, never while this migration is applied.
        WITH gone AS (DELETE FROM public.family_research_participants WHERE subject_user_id = p_subject RETURNING 1)
        SELECT count(*) INTO v_removed FROM gone;
        RETURN public.family_research_state(p_subject);
    END IF;

    IF p_version IS DISTINCT FROM public.family_research_disclosure_version() THEN
        RAISE EXCEPTION 'RESEARCH_DISCLOSURE_STALE' USING ERRCODE = 'P0001';
    END IF;
    IF public.wallet_holder_kind(p_subject) IS NULL OR EXISTS (SELECT 1 FROM auth.users WHERE id = p_subject AND is_anonymous)
       OR (v_self AND NOT public.family_research_is_adult(p_subject))
       OR (NOT v_self AND public.family_research_is_adult(p_subject)) THEN
        RAISE EXCEPTION 'RESEARCH_CONSENT_NOT_ALLOWED' USING ERRCODE = 'P0001';
    END IF;
    IF v_active AND public.family_research_admitted(p_subject) THEN
        RETURN public.family_research_state(p_subject);
    END IF;
    IF v_active THEN
        -- A lapsed consent (aged out, or its Tutor left) is replaced, never revived:
        -- it ends here and the new yes is its own row.
        UPDATE public.family_research_consents SET revoked_at = now(), revoked_by = p_actor WHERE id = v_consent.id;
    END IF;
    INSERT INTO public.family_research_consents (subject_user_id, grantor_kind, granted_by, disclosure_version)
        VALUES (p_subject, CASE WHEN v_self THEN 'self' ELSE 'tutor' END, p_actor, p_version::smallint);
    INSERT INTO public.family_research_participants (subject_user_id) VALUES (p_subject) ON CONFLICT DO NOTHING;
    RETURN public.family_research_state(p_subject);
END;
$$;
REVOKE ALL ON FUNCTION public.family_research_set_consent(uuid, uuid, boolean, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_research_set_consent(uuid, uuid, boolean, int) TO service_role;

-- ── The monthly snapshot (idempotent; the nightly job calls it) ────────────
-- Only complete months, only months that began after the consent, and only
-- for participants admitted when it runs.
CREATE OR REPLACE FUNCTION public.record_family_research_snapshots(p_period date DEFAULT (date_trunc('month', now()) - interval '1 month')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_m     date := date_trunc('month', p_period)::date;
    v_end   timestamptz;
    v_count integer;
BEGIN
    IF p_period IS NULL OR v_m >= date_trunc('month', now())::date THEN
        RAISE EXCEPTION 'RESEARCH_PERIOD_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    v_end := v_m + interval '1 month';
    INSERT INTO public.family_research_snapshots (
        research_id, period, age_years, register, tenure_months, autonomy_level, coins_received, coins_to_save, coins_spent,
        coins_given, goals_reached, next_goals_set, chores_approved, rewards_asked, rewards_not_yet, practised_days,
        split_changed, bridge_entries)
    SELECT p.research_id, v_m,
        public.family_research_age_at(p.subject_user_id, (v_end - interval '1 day')::date),
        public.family_money_register(p.subject_user_id),
        greatest(0, coalesce((SELECT (date_part('year', age(v_end, min(l.created_at))) * 12 + date_part('month', age(v_end, min(l.created_at))))::int
                              FROM public.wallet_ledger l WHERE l.kid_user_id = p.subject_user_id), 0)),
        (SELECT a.level FROM public.family_autonomy_level(p.subject_user_id) a),
        coalesce((SELECT sum(l.amount) FROM public.wallet_ledger l WHERE l.kid_user_id = p.subject_user_id AND l.amount > 0
                  AND l.reason IN ('task_approved', 'allowance', 'savings_bonus', 'self_income') AND l.created_at >= v_m AND l.created_at < v_end), 0),
        coalesce((SELECT sum(l.amount) FROM public.wallet_ledger l WHERE l.kid_user_id = p.subject_user_id AND l.amount > 0 AND l.bucket = 'save'
                  AND l.reason IN ('task_approved', 'allowance', 'savings_bonus', 'self_income') AND l.created_at >= v_m AND l.created_at < v_end), 0),
        coalesce((SELECT -sum(l.amount) FROM public.wallet_ledger l WHERE l.kid_user_id = p.subject_user_id AND l.amount < 0
                  AND l.reason IN ('redemption', 'personal_reward') AND l.created_at >= v_m AND l.created_at < v_end), 0),
        coalesce((SELECT sum(g.amount) FROM public.share_gifts g WHERE g.holder_user_id = p.subject_user_id AND g.status = 'given'
                  AND g.settled_at >= v_m AND g.settled_at < v_end), 0),
        (SELECT count(*) FROM public.savings_goals s WHERE s.kid_user_id = p.subject_user_id AND s.reached_at >= v_m AND s.reached_at < v_end),
        (SELECT count(*) FROM public.goal_next_steps n WHERE n.holder_user_id = p.subject_user_id AND n.state = 'set'
                  AND n.decided_at >= v_m AND n.decided_at < v_end),
        (SELECT count(*) FROM public.tasks t WHERE t.assigned_to = p.subject_user_id AND t.status = 'approved'
                  AND t.decided_at >= v_m AND t.decided_at < v_end),
        (SELECT count(*) FROM public.redemptions r WHERE r.kid_user_id = p.subject_user_id AND r.created_at >= v_m AND r.created_at < v_end),
        (SELECT count(*) FROM public.family_decisions d WHERE d.kid_user_id = p.subject_user_id AND d.subject = 'redemption'
                  AND d.outcome = 'denied' AND d.created_at >= v_m AND d.created_at < v_end),
        (SELECT count(*) FROM public.chore_streak_days c WHERE c.kid_user_id = p.subject_user_id AND c.completions > 0
                  AND c.local_date >= v_m AND c.local_date < v_end::date),
        EXISTS (SELECT 1 FROM public.wallet_split_preferences w WHERE w.holder_user_id = p.subject_user_id
                  AND w.updated_at >= v_m AND w.updated_at < v_end),
        (SELECT count(*) FROM public.money_bridge_progress b WHERE b.holder_user_id = p.subject_user_id
                  AND b.done_at >= v_m AND b.done_at < v_end)
    FROM public.family_research_participants p
    JOIN public.family_research_consents c ON c.subject_user_id = p.subject_user_id AND c.revoked_at IS NULL
    WHERE public.family_research_admitted(p.subject_user_id)
      AND v_m >= (date_trunc('month', c.granted_at) + interval '1 month')::date
    ON CONFLICT (research_id, period) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.record_family_research_snapshots(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_family_research_snapshots(date) TO service_role;

-- ── Appendix H Part 1.4: Longitudinal-Hypothesis Data Completeness ─────────
--   long_tenure  wallet holders whose first ledger line is p_min_tenure_months
--                old (the population the hypothesis is about)
--   enrolled     of those, recorded right now (coverage = enrolled / long_tenure)
--   measurable   enrolled for the whole window of the last p_months months
--   complete     measurable with a snapshot for every month of the window
--                (completeness = complete / measurable)
-- 'bridge_age' repeats it for holders who are 15 or older (D.19 (c)).
CREATE OR REPLACE FUNCTION public.family_research_completeness(p_months int DEFAULT 3, p_min_tenure_months int DEFAULT 6)
RETURNS TABLE (cohort text, long_tenure bigint, enrolled bigint, measurable bigint, complete bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_window_start date;
BEGIN
    IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 24 OR p_min_tenure_months IS NULL OR p_min_tenure_months NOT BETWEEN 0 AND 120 THEN
        RAISE EXCEPTION 'RESEARCH_WINDOW_INVALID' USING ERRCODE = 'P0001';
    END IF;
    v_window_start := (date_trunc('month', now()) - make_interval(months => p_months))::date;
    RETURN QUERY
    WITH holders AS (
        SELECT l.kid_user_id AS user_id, min(l.created_at) AS first_at
        FROM public.wallet_ledger l GROUP BY l.kid_user_id
        HAVING min(l.created_at) <= now() - make_interval(months => p_min_tenure_months)
    ),
    tagged AS (
        SELECT h.user_id, coalesce(public.family_research_age_at(h.user_id, current_date), 0) >= 15 AS bridge_age,
               public.family_research_admitted(h.user_id) AS admitted,
               (SELECT (date_trunc('month', c.granted_at) + interval '1 month')::date FROM public.family_research_consents c
                 WHERE c.subject_user_id = h.user_id AND c.revoked_at IS NULL) AS first_month,
               (SELECT count(*) FROM public.family_research_snapshots s JOIN public.family_research_participants p ON p.research_id = s.research_id
                 WHERE p.subject_user_id = h.user_id AND s.period >= v_window_start AND s.period < date_trunc('month', now())::date) AS months
        FROM holders h
        WHERE public.wallet_holder_kind(h.user_id) IS NOT NULL
    ),
    cohorts AS (
        SELECT 'all'::text AS cohort, t.* FROM tagged t
        UNION ALL
        SELECT 'bridge_age', t.* FROM tagged t WHERE t.bridge_age
    )
    SELECT k.name,
           count(c.user_id),
           count(c.user_id) FILTER (WHERE c.admitted),
           count(c.user_id) FILTER (WHERE c.admitted AND c.first_month <= v_window_start),
           count(c.user_id) FILTER (WHERE c.admitted AND c.first_month <= v_window_start AND c.months >= p_months)
    FROM (VALUES (1, 'all'), (2, 'bridge_age')) AS k (ord, name)
    LEFT JOIN cohorts c ON c.cohort = k.name
    GROUP BY k.ord, k.name
    ORDER BY k.ord;
END;
$$;
REVOKE ALL ON FUNCTION public.family_research_completeness(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_research_completeness(int, int) TO service_role;

SELECT 'migration_family_research_instrumentation_ok' AS sentinel;
