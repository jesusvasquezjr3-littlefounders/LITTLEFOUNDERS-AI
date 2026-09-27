-- @phase: expand
-- effective_age_band: every tier and analytics reader follows a declared
-- teen's birth month to the adult tier at 18 (S-04, owner decision OD-28,
-- 27 September 2026).
--
-- Merge reconciliation. Two lanes implemented S-04. The W2 site lane's
-- 0179_age_declaration_birth_month keeps the month (declared_birth_month) with
-- the first 13-17 declaration and PROMOTES the stored band to 'adult' once the
-- 18th-birthday month has passed (promote_age_declaration, lazily from Core or
-- in a batch), clearing the month and stamping promoted_to_adult_at. The W3
-- owner-answers lane re-pointed every database reader of the band at a
-- read-time effective band, so a teen who has not signed in since turning 18
-- is not left in the teen tier by the lazy promotion, and so a teen's explicit
-- analytics "no" is carried into adulthood. This file keeps that second half
-- on 0179's columns; it adds no column and no second write path.
--
--   effective_age_band(user)
--       The stored band, except that a 13-to-17 declaration whose birth month
--       is due reads as 'adult' before 0179's promotion has run. A month cannot
--       say which day, so the move waits until every day of the 18th-birthday
--       month has passed (the same reading as age_declaration_promotion_due).
--
--   adult_by_birth_month(user)
--       True when the birth month is what made the account adult: promoted by
--       0179 (promoted_to_adult_at) or due and not yet promoted. The optional
--       analytics gates use it to carry a teen's explicit "no" into adulthood.
--
--   age_at_least_by_birth_month(user, years)
--       True only when the recorded birth month proves the person is at least
--       that old today, with the same end-of-month caution (used by the 16-17
--       discoverable-profile opt-in, S-03, 0184).
--
-- Every reader of the declared band that decides a tier or an analytics
-- admission is re-pointed at effective_age_band: social_tier (E.8), the two
-- optional-analytics gates (H.1: guard_optional_learning_event and
-- family_analytics_admitted), the teen wallet holder (D.3: at 18 the wallet
-- stops taking writes and its rows are kept, H-08) and the research adulthood
-- test (D.22). Each body below is the latest definition with only that read
-- changed (0119, 0090, 0160, 0152, 0176). With no birth month recorded, every
-- function answers exactly as before.

-- ── Reading the band as of today ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.effective_age_band(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE
        WHEN d.declared_age_band = '13_to_17' AND d.declared_birth_month IS NOT NULL
         AND (d.declared_birth_month + interval '18 years 1 month')::date <= (now() AT TIME ZONE 'UTC')::date THEN 'adult'
        ELSE d.declared_age_band
    END
    FROM public.account_age_declarations d WHERE d.user_id = p_user;
$$;
REVOKE ALL ON FUNCTION public.effective_age_band(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_age_band(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.adult_by_birth_month(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce((
        SELECT (d.declared_age_band = 'adult' AND d.promoted_to_adult_at IS NOT NULL)
            OR (d.declared_age_band = '13_to_17' AND d.declared_birth_month IS NOT NULL
                AND (d.declared_birth_month + interval '18 years 1 month')::date <= (now() AT TIME ZONE 'UTC')::date)
        FROM public.account_age_declarations d WHERE d.user_id = p_user), false);
$$;
REVOKE ALL ON FUNCTION public.adult_by_birth_month(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adult_by_birth_month(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.age_at_least_by_birth_month(p_user uuid, p_years int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce((
        SELECT d.declared_birth_month IS NOT NULL AND p_years IS NOT NULL AND p_years >= 0
           AND (d.declared_birth_month + make_interval(years => p_years, months => 1))::date <= (now() AT TIME ZONE 'UTC')::date
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
