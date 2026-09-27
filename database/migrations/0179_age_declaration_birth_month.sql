-- age_declaration_birth_month: a declared teen moves to the adult tier at 18.
-- @phase: expand
--
-- Owner decision OD-28 (review item S-04, 27 September 2026): the age screen
-- keeps a birth month so a declared teen's tier updates at 18. Before this, a
-- declared 13-17 stayed in the teen tier until verified adult ID or a staff
-- correction (Product 10 A.3, A.4, E.4).
--
-- What is kept, and for whom (data minimisation):
--   * Only for a declared 13-17 band: the month and year, stored as the first
--     day of that month. Never the day. Under-13 dates are still never kept,
--     and an adult declaration keeps nothing but its band.
--   * Only on the FIRST declaration: record_age_declaration still inserts once
--     (ON CONFLICT DO NOTHING), so a later call can neither add nor change a
--     month (E.4: a self-service declaration cannot be edited to gain a tier).
--   * The month is cleared at promotion: once the band is adult it has no use.
--
-- When the move happens: the day is unknown, so the 18th birthday is taken as
-- the LAST day of the birth month (the later, protective reading). The band
-- becomes adult on the first day of the following month, 18 years on.
-- An account with an under-13 origin marker is never promoted (A.2: that
-- posture is permanent and outranks any declaration).
--
-- Promotion is a system transition, not an edit by the account: it is done
-- only by promote_age_declaration (Core, lazily, on the account's next age
-- read) or promote_due_age_declarations (an operator or scheduled batch), both
-- service_role only, and it is stamped with promoted_to_adult_at.
-- Rationale and evidence: docs/rebuild/sprints/W2-SITE-AND-AUTH.md (W2S.3).

ALTER TABLE public.account_age_declarations
    ADD COLUMN IF NOT EXISTS declared_birth_month date,
    ADD COLUMN IF NOT EXISTS promoted_to_adult_at timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'account_age_declarations_birth_month_shape'
                     AND conrelid = 'public.account_age_declarations'::regclass) THEN
        ALTER TABLE public.account_age_declarations
            ADD CONSTRAINT account_age_declarations_birth_month_shape CHECK (
                declared_birth_month IS NULL
                OR (declared_age_band = '13_to_17'
                    AND extract(day FROM declared_birth_month) = 1));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'account_age_declarations_promotion_shape'
                     AND conrelid = 'public.account_age_declarations'::regclass) THEN
        ALTER TABLE public.account_age_declarations
            ADD CONSTRAINT account_age_declarations_promotion_shape CHECK (
                promoted_to_adult_at IS NULL
                OR (declared_age_band = 'adult' AND declared_birth_month IS NULL));
    END IF;
END;
$$;

-- RLS stays on (0086) and the browser keeps no access at all.
ALTER TABLE public.account_age_declarations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_age_declarations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.account_age_declarations TO service_role;

-- The first declaration with its birth month. The two-argument form (0086)
-- stays for every caller that has no month to give.
CREATE OR REPLACE FUNCTION public.record_age_declaration(p_user_id uuid, p_age_band text, p_birth_month date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    stored_band text;
    kept_month date;
BEGIN
    IF p_age_band IS NULL OR p_age_band NOT IN ('under_13', '13_to_17', 'adult') THEN
        RAISE EXCEPTION 'Invalid age band' USING ERRCODE = '22023';
    END IF;
    -- A month is kept only for a teen, and only when it is a teen's month:
    -- the first of a month, not in the future, and at most 19 years back.
    IF p_age_band = '13_to_17' AND p_birth_month IS NOT NULL THEN
        IF extract(day FROM p_birth_month) <> 1
           OR p_birth_month > (now() AT TIME ZONE 'UTC')::date
           OR p_birth_month < ((now() AT TIME ZONE 'UTC')::date - interval '19 years')::date THEN
            RAISE EXCEPTION 'Invalid birth month' USING ERRCODE = '22023';
        END IF;
        kept_month := p_birth_month;
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found' USING ERRCODE = '23503';
    END IF;
    IF p_age_band = 'under_13' THEN
        PERFORM public.mark_under13_origin(p_user_id);
    END IF;
    INSERT INTO public.account_age_declarations(user_id, declared_age_band, declared_birth_month)
    VALUES (p_user_id, p_age_band, kept_month)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT declared_age_band INTO stored_band FROM public.account_age_declarations WHERE user_id = p_user_id;
    RETURN stored_band;
END;
$$;
REVOKE ALL ON FUNCTION public.record_age_declaration(uuid, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_age_declaration(uuid, text, date) TO service_role;

-- True when a declared teen's month says they are 18 by now.
CREATE OR REPLACE FUNCTION public.age_declaration_promotion_due(p_birth_month date, p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT p_birth_month IS NOT NULL
       AND (p_now AT TIME ZONE 'UTC')::date >= (p_birth_month + interval '18 years 1 month')::date;
$$;
REVOKE ALL ON FUNCTION public.age_declaration_promotion_due(date, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.age_declaration_promotion_due(date, timestamptz) TO service_role;

-- One account: promote when due, and return the band as stored afterwards.
CREATE OR REPLACE FUNCTION public.promote_age_declaration(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    stored_band text;
    promoted boolean := false;
BEGIN
    UPDATE public.account_age_declarations d
       SET declared_age_band = 'adult', declared_birth_month = NULL, promoted_to_adult_at = now()
     WHERE d.user_id = p_user_id
       AND d.declared_age_band = '13_to_17'
       AND public.age_declaration_promotion_due(d.declared_birth_month)
       AND NOT EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = d.user_id);
    promoted := FOUND;
    -- The profile review (E.13, 0119) depends on the tier: re-run it on a move.
    IF promoted AND to_regprocedure('public.review_profile_fields(uuid)') IS NOT NULL THEN
        EXECUTE 'SELECT public.review_profile_fields($1)' USING p_user_id;
    END IF;
    SELECT declared_age_band INTO stored_band FROM public.account_age_declarations WHERE user_id = p_user_id;
    RETURN stored_band;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_age_declaration(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_age_declaration(uuid) TO service_role;

-- Every account that is due, for an operator or a scheduled job. Returns how
-- many moved; running it twice moves nobody twice.
CREATE OR REPLACE FUNCTION public.promote_due_age_declarations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    due uuid;
    moved integer := 0;
BEGIN
    FOR due IN
        SELECT d.user_id FROM public.account_age_declarations d
         WHERE d.declared_age_band = '13_to_17'
           AND public.age_declaration_promotion_due(d.declared_birth_month)
           AND NOT EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = d.user_id)
    LOOP
        IF public.promote_age_declaration(due) = 'adult' THEN
            moved := moved + 1;
        END IF;
    END LOOP;
    RETURN moved;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_due_age_declarations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_due_age_declarations() TO service_role;
