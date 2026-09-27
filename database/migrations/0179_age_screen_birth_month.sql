-- @phase: expand
-- S-04 (owner decision OD-28, 27 September 2026): the age screen may also keep
-- a birth month, so a declared teen moves to the adult tier at 18.
--
-- Additive. Nothing an older Core does changes meaning: it never writes a
-- birth month, and with no birth month every function below returns exactly
-- what it returned before. What is new:
--
--   account_age_declarations.birth_month
--       The first day of the month the person was born in. Kept ONLY with a
--       13-to-17 declaration: an under-13 date is never retained (0086), and an
--       adult has no tier left to move to. It is written once, together with
--       the first declaration, through record_age_screen; the E.4 lock of 0086
--       is unchanged (the first declaration wins, and a band-only teen cannot
--       add a birth month later to reach the adult tier sooner).
--
--   effective_age_band(user)
--       The declared band, except that a 13-to-17 declaration with a birth
--       month reads as 'adult' from the first day of the month AFTER the 18th
--       birthday month. A month cannot say which day, so the move waits until
--       every day of that month has passed: a 17-year-old is never an adult,
--       and the wait is at most one month.
--
--   adult_by_birth_month(user)
--       True when that promotion is what made the account adult. The optional
--       analytics gates use it to carry a teen's explicit "no" into adulthood.
--
--   age_at_least_by_birth_month(user, years)
--       True only when the recorded birth month proves the person is at least
--       that old today, with the same end-of-month caution (used by the 16-17
--       discoverable-profile opt-in, S-03).
--
-- Every reader of the declared band that decides a tier or an analytics
-- admission is re-pointed at effective_age_band: social_tier (E.8), the two
-- optional-analytics gates (H.1: guard_optional_learning_event and
-- family_analytics_admitted), the teen wallet holder (D.3: at 18 the wallet
-- stops taking writes and its rows are kept, H-08) and the research adulthood
-- test (D.22). Each body below is the latest definition with only that read
-- changed (0119, 0090, 0160, 0152, 0176).

ALTER TABLE public.account_age_declarations
    ADD COLUMN IF NOT EXISTS birth_month date;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_age_declarations_birth_month_shape') THEN
        ALTER TABLE public.account_age_declarations
            ADD CONSTRAINT account_age_declarations_birth_month_shape CHECK (
                birth_month IS NULL
                OR (extract(day FROM birth_month) = 1 AND declared_age_band = '13_to_17')
            );
    END IF;
END $$;

COMMENT ON COLUMN public.account_age_declarations.birth_month IS
    'S-04/OD-28: first day of the birth month, kept only with a 13_to_17 declaration and only when the age screen sent it; moves the account to the adult tier after the 18th birthday month.';

-- ── The first declaration, optionally with the birth month ──────────────────
CREATE OR REPLACE FUNCTION public.record_age_screen(p_user_id uuid, p_age_band text, p_birth_month date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    stored_band text;
    today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
    IF p_age_band IS NULL OR p_age_band NOT IN ('under_13', '13_to_17', 'adult') THEN
        RAISE EXCEPTION 'Invalid age band' USING ERRCODE = '22023';
    END IF;
    IF p_birth_month IS NOT NULL THEN
        IF p_age_band <> '13_to_17' THEN
            RAISE EXCEPTION 'A birth month is kept only with a 13 to 17 declaration' USING ERRCODE = '22023';
        END IF;
        IF extract(day FROM p_birth_month) <> 1 THEN
            RAISE EXCEPTION 'A birth month is the first day of its month' USING ERRCODE = '22023';
        END IF;
        -- Consistent with the band: some day of that month gives 13 or more
        -- today, and some day of it gives less than 18.
        IF (p_birth_month + interval '13 years')::date > today
           OR (p_birth_month + interval '18 years 1 month' - interval '1 day')::date <= today THEN
            RAISE EXCEPTION 'The birth month does not match a 13 to 17 declaration' USING ERRCODE = '22023';
        END IF;
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found' USING ERRCODE = '23503';
    END IF;
    IF p_age_band = 'under_13' THEN
        PERFORM public.mark_under13_origin(p_user_id);
    END IF;
    -- E.4 lock (0086): the first declaration wins, month included. A later
    -- call never adds or changes a birth month.
    INSERT INTO public.account_age_declarations(user_id, declared_age_band, birth_month)
    VALUES (p_user_id, p_age_band, p_birth_month)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT declared_age_band INTO stored_band FROM public.account_age_declarations WHERE user_id = p_user_id;
    RETURN stored_band;
END;
$$;
REVOKE ALL ON FUNCTION public.record_age_screen(uuid, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_age_screen(uuid, text, date) TO service_role;

-- ── Reading the band as of today ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.effective_age_band(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE
        WHEN d.declared_age_band = '13_to_17' AND d.birth_month IS NOT NULL
         AND (d.birth_month + interval '18 years 1 month')::date <= (now() AT TIME ZONE 'UTC')::date THEN 'adult'
        ELSE d.declared_age_band
    END
    FROM public.account_age_declarations d WHERE d.user_id = p_user;
$$;
REVOKE ALL ON FUNCTION public.effective_age_band(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_age_band(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.adult_by_birth_month(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce((
        SELECT d.declared_age_band = '13_to_17' AND d.birth_month IS NOT NULL
           AND (d.birth_month + interval '18 years 1 month')::date <= (now() AT TIME ZONE 'UTC')::date
        FROM public.account_age_declarations d WHERE d.user_id = p_user), false);
$$;
REVOKE ALL ON FUNCTION public.adult_by_birth_month(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adult_by_birth_month(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.age_at_least_by_birth_month(p_user uuid, p_years int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce((
        SELECT d.birth_month IS NOT NULL AND p_years IS NOT NULL AND p_years >= 0
           AND (d.birth_month + make_interval(years => p_years, months => 1))::date <= (now() AT TIME ZONE 'UTC')::date
        FROM public.account_age_declarations d WHERE d.user_id = p_user), false);
$$;
REVOKE ALL ON FUNCTION public.age_at_least_by_birth_month(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.age_at_least_by_birth_month(uuid, int) TO service_role;

-- ── E.8: the social tier (0119), reading the band as of today ───────────────
CREATE OR REPLACE FUNCTION public.social_tier(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE
        WHEN p_user IS NULL
          OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user)
          OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user) THEN 'closed'
        WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'kid') THEN 'guardian'
        WHEN EXISTS (SELECT 1 FROM public.account_safety_origins WHERE user_id = p_user) THEN
            CASE WHEN EXISTS (SELECT 1 FROM public.guardian_links
                    WHERE kid_user_id = p_user AND verification_status = 'verified')
                 THEN 'guardian' ELSE 'closed' END
        WHEN (SELECT is_anonymous FROM auth.users WHERE id = p_user) IS TRUE THEN 'closed'
        WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'parent')
          AND EXISTS (SELECT 1 FROM (
                SELECT status, method, birth_date FROM public.parent_verifications WHERE user_id = p_user
                ORDER BY created_at DESC, id DESC LIMIT 1
            ) latest WHERE latest.status = 'verified' AND latest.method = 'local-ocr'
                AND latest.birth_date <= ((now() AT TIME ZONE 'UTC')::date - interval '18 years')::date) THEN 'adult'
        WHEN public.effective_age_band(p_user) = 'adult' THEN 'adult'
        WHEN public.effective_age_band(p_user) = '13_to_17' THEN 'teen'
        ELSE 'closed'
    END;
$$;

-- ── H.1: optional learning events (0090) ────────────────────────────────────
-- A teen who reached the adult tier by birth month keeps an explicit earlier
-- "no": a recorded teen preference still decides. Without one, the adult rule.
CREATE OR REPLACE FUNCTION public.guard_optional_learning_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE guest boolean; age_band text;
BEGIN
    IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
    SELECT is_anonymous INTO guest FROM auth.users WHERE id = NEW.user_id FOR UPDATE;
    IF NOT FOUND OR guest IS TRUE THEN RETURN NULL; END IF;
    IF EXISTS (SELECT 1 FROM public.account_safety_origins WHERE user_id = NEW.user_id AND under13_origin) THEN RETURN NULL; END IF;
    age_band := public.effective_age_band(NEW.user_id);
    IF age_band IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id) THEN RETURN NULL; END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'kid') THEN
        IF NOT EXISTS (SELECT 1 FROM public.analytics_consents WHERE kid_user_id = NEW.user_id AND revoked_at IS NULL) THEN RETURN NULL; END IF;
    ELSIF age_band = '13_to_17' THEN
        IF NOT EXISTS (SELECT 1 FROM public.teen_analytics_preferences WHERE user_id = NEW.user_id AND enabled AND disclosure_version = 1) THEN RETURN NULL; END IF;
    ELSIF age_band <> 'adult' THEN
        RETURN NULL;
    ELSIF public.adult_by_birth_month(NEW.user_id)
      AND EXISTS (SELECT 1 FROM public.teen_analytics_preferences WHERE user_id = NEW.user_id AND NOT enabled) THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;

-- ── H.1 for Family Hub events (0160) ────────────────────────────────────────
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
    v_band := public.effective_age_band(p_user);
    IF v_band IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user) THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'kid') THEN
        RETURN EXISTS (SELECT 1 FROM public.analytics_consents WHERE kid_user_id = p_user AND revoked_at IS NULL);
    ELSIF v_band = '13_to_17' THEN
        RETURN EXISTS (SELECT 1 FROM public.teen_analytics_preferences WHERE user_id = p_user AND enabled AND disclosure_version = 1);
    END IF;
    IF v_band = 'adult' AND public.adult_by_birth_month(p_user)
       AND EXISTS (SELECT 1 FROM public.teen_analytics_preferences WHERE user_id = p_user AND NOT enabled) THEN
        RETURN false;
    END IF;
    RETURN v_band = 'adult';
END;
$$;

-- ── D.3: the teen wallet holder (0152) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.teen_wallet_holder(p_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_band  text;
    v_guest boolean;
    v_birth date;
    v_age   int;
BEGIN
    IF p_user IS NULL THEN
        RETURN false;
    END IF;
    v_band := public.effective_age_band(p_user);
    IF v_band IS DISTINCT FROM '13_to_17' THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.account_safety_origins WHERE user_id = p_user) THEN
        RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role IN ('kid', 'parent', 'admin', 'superadmin')) THEN
        RETURN false;
    END IF;
    SELECT coalesce(u.is_anonymous, false) INTO v_guest FROM auth.users u WHERE u.id = p_user;
    IF NOT FOUND OR v_guest THEN
        RETURN false;
    END IF;
    SELECT birth_date INTO v_birth FROM public.profiles WHERE user_id = p_user;
    IF v_birth IS NOT NULL THEN
        v_age := date_part('year', age(current_date, v_birth))::int;
        IF v_age < 13 OR v_age > 17 THEN
            RETURN false;
        END IF;
    END IF;
    RETURN true;
END;
$$;

-- ── D.22: research adulthood (0176) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.family_research_is_adult(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce(public.family_research_age_at(p_user, current_date) >= 18,
                    public.effective_age_band(p_user) = 'adult', false);
$$;
