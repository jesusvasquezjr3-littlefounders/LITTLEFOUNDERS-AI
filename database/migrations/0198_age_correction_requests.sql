-- age_correction_requests: the staff-reviewed date-of-birth correction for a
-- self-registered account (Product 10 E.4 as amended by OD-3; Appendix J 1.1
-- Age-Tier Boundary Integrity).
-- @phase: expand
--
-- E.4 locks a self-registered account's age after its first declaration: the
-- account cannot change it (UI, API and SQL all refuse; record_age_declaration
-- inserts once). "With no guardian to re-confirm, a later change goes through
-- a staff-reviewed request." This file builds that request.
--
--   age_correction_requests
--       One row per request: the requester, the band the corrected date gives
--       and, for a 13-17 band only, its birth month (0179's data rule: never a
--       day, never an under-13 or adult date), the status (pending, approved,
--       rejected), the deciding staff member, a reason code and timestamps.
--       At most one pending request per account. RLS on, no policy, no browser
--       grant: only Core's service role reads it, and nobody writes it except
--       through the two functions below.
--
--   request_age_correction(user, band, month)   service_role only
--       Files a request for a self-registered account that already has a
--       declaration. Refuses a parent-created child (kid role: the Tutor gives
--       that age), an account with the under-13 origin (A.2: permanent), a
--       guest, a second pending request, and a request that changes nothing.
--       A request for the under-13 band protects at once: record_age_declaration
--       marks the under-13 origin (0086: a later under-13 disclosure always
--       protects), and the request still waits for staff to settle the band.
--
--   decide_age_correction(request, staff, approve, reason)   service_role only
--       A staff decision. The decider must hold the admin role with the
--       manage_users grant, or superadmin, and can never be the requester, so
--       an account cannot approve its own request. A pending request changes
--       nothing. On approval, in ONE transaction: the declaration takes the
--       requested band and month (checked at filing with 0179's month rules and
--       held by the table's own shape constraints; an under-13 band marks the
--       under-13 origin as record_age_declaration does; an account with no
--       declaration row gets one through record_age_declaration), a due teen
--       month is promoted through
--       promote_age_declaration, the E.13 profile review re-runs when the tier
--       moved, and one audit_logs row records the decision (G.3). A rejection
--       writes the audit row and changes no age.
--
-- Evidence: database/scripts/verify-age-correction-postgres.py.

CREATE TABLE IF NOT EXISTS public.age_correction_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_age_band text NOT NULL CHECK (from_age_band IN ('under_13', '13_to_17', 'adult')),
    requested_age_band text NOT NULL CHECK (requested_age_band IN ('under_13', '13_to_17', 'adult')),
    requested_birth_month date,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reason_code text CHECK (reason_code IN ('evidence_verified', 'entry_error', 'evidence_missing', 'not_credible')),
    created_at timestamptz NOT NULL DEFAULT now(),
    decided_at timestamptz,
    CONSTRAINT age_correction_month_shape CHECK (
        requested_birth_month IS NULL
        OR (requested_age_band = '13_to_17' AND extract(day FROM requested_birth_month) = 1)),
    CONSTRAINT age_correction_decision_shape CHECK (
        (status = 'pending' AND decided_at IS NULL AND reason_code IS NULL)
        OR (status = 'approved' AND decided_at IS NOT NULL AND reason_code IN ('evidence_verified', 'entry_error'))
        OR (status = 'rejected' AND decided_at IS NOT NULL AND reason_code IN ('evidence_missing', 'not_credible')))
);
CREATE UNIQUE INDEX IF NOT EXISTS age_correction_requests_one_pending
    ON public.age_correction_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS age_correction_requests_status_created
    ON public.age_correction_requests (status, created_at DESC);

ALTER TABLE public.age_correction_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.age_correction_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.age_correction_requests TO service_role;

CREATE OR REPLACE FUNCTION public.request_age_correction(p_user uuid, p_age_band text, p_birth_month date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_band text;
    v_month date;
    v_guest boolean;
    v_id uuid;
BEGIN
    IF p_age_band IS NULL OR p_age_band NOT IN ('under_13', '13_to_17', 'adult') THEN
        RAISE EXCEPTION 'INVALID_AGE_BAND' USING ERRCODE = 'P0001';
    END IF;
    IF p_birth_month IS NOT NULL AND (p_age_band <> '13_to_17' OR extract(day FROM p_birth_month) <> 1
        OR p_birth_month > (now() AT TIME ZONE 'UTC')::date
        OR p_birth_month < ((now() AT TIME ZONE 'UTC')::date - interval '19 years')::date) THEN
        RAISE EXCEPTION 'INVALID_BIRTH_MONTH' USING ERRCODE = 'P0001';
    END IF;
    -- Serialize with sign-in changes, declarations and deletion of this account.
    SELECT coalesce(is_anonymous, false) INTO v_guest FROM auth.users WHERE id = p_user FOR UPDATE;
    IF NOT FOUND OR v_guest THEN
        RAISE EXCEPTION 'NOT_ELIGIBLE' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'kid') THEN
        RAISE EXCEPTION 'KID_AGE_BY_TUTOR' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.account_safety_origins WHERE user_id = p_user) THEN
        RAISE EXCEPTION 'AGE_PROTECTED' USING ERRCODE = 'P0001';
    END IF;
    SELECT declared_age_band, declared_birth_month INTO v_band, v_month
      FROM public.account_age_declarations WHERE user_id = p_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'AGE_SCREEN_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF v_band = p_age_band AND v_month IS NOT DISTINCT FROM p_birth_month THEN
        RAISE EXCEPTION 'AGE_UNCHANGED' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.age_correction_requests WHERE user_id = p_user AND status = 'pending') THEN
        RAISE EXCEPTION 'CORRECTION_PENDING' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.age_correction_requests (user_id, from_age_band, requested_age_band, requested_birth_month)
    VALUES (p_user, v_band, p_age_band, p_birth_month)
    RETURNING id INTO v_id;
    -- A.2 / 0086: an under-13 disclosure protects at once; staff still settle the declared band.
    IF p_age_band = 'under_13' THEN
        PERFORM public.mark_under13_origin(p_user);
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_user, 'account.age_correction_requested', p_user::text,
            jsonb_build_object('request', v_id, 'from', v_band, 'to', p_age_band));
    RETURN v_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'CORRECTION_PENDING' USING ERRCODE = 'P0001';
END;
$$;
REVOKE ALL ON FUNCTION public.request_age_correction(uuid, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_age_correction(uuid, text, date) TO service_role;

CREATE OR REPLACE FUNCTION public.decide_age_correction(p_request uuid, p_staff uuid, p_approve boolean, p_reason text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_row public.age_correction_requests%ROWTYPE;
    v_tier_before text;
    v_tier_after text;
    v_band text;
BEGIN
    IF p_approve IS NULL OR p_reason IS NULL
       OR (p_approve AND p_reason NOT IN ('evidence_verified', 'entry_error'))
       OR (NOT p_approve AND p_reason NOT IN ('evidence_missing', 'not_credible')) THEN
        RAISE EXCEPTION 'INVALID_DECISION' USING ERRCODE = 'P0001';
    END IF;
    IF p_staff IS NULL
       OR NOT (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_staff AND role = 'superadmin')
               OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_staff AND role = 'admin')
                   AND EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = p_staff AND permission = 'manage_users'))) THEN
        RAISE EXCEPTION 'NOT_STAFF' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_row FROM public.age_correction_requests WHERE id = p_request FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    -- The account can never approve (or reject) its own request.
    IF v_row.user_id = p_staff THEN
        RAISE EXCEPTION 'SELF_DECISION' USING ERRCODE = 'P0001';
    END IF;
    IF v_row.status <> 'pending' THEN
        RAISE EXCEPTION 'NOT_PENDING' USING ERRCODE = 'P0001';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = v_row.user_id FOR UPDATE;
    v_tier_before := public.social_tier(v_row.user_id);

    IF p_approve THEN
        -- The corrected declaration: the month was checked at filing with 0179's rules, and the table's
        -- shape constraints hold it again here. The promotion stamp belongs to the old declaration.
        UPDATE public.account_age_declarations
           SET declared_age_band = v_row.requested_age_band,
               declared_birth_month = v_row.requested_birth_month,
               promoted_to_adult_at = NULL
         WHERE user_id = v_row.user_id
        RETURNING declared_age_band INTO v_band;
        IF NOT FOUND THEN
            v_band := public.record_age_declaration(v_row.user_id, v_row.requested_age_band, v_row.requested_birth_month);
        ELSIF v_row.requested_age_band = 'under_13' THEN
            PERFORM public.mark_under13_origin(v_row.user_id);
        END IF;
        IF v_band IS DISTINCT FROM v_row.requested_age_band THEN
            RAISE EXCEPTION 'CORRECTION_NOT_APPLIED' USING ERRCODE = 'P0001';
        END IF;
        -- OD-28: a corrected teen month that already says 18 moves to adult now.
        v_band := public.promote_age_declaration(v_row.user_id);
        v_tier_after := public.social_tier(v_row.user_id);
        IF v_tier_after IS DISTINCT FROM v_tier_before AND to_regprocedure('public.review_profile_fields(uuid)') IS NOT NULL THEN
            EXECUTE 'SELECT public.review_profile_fields($1)' USING v_row.user_id;
        END IF;
    ELSE
        v_tier_after := v_tier_before;
    END IF;

    UPDATE public.age_correction_requests
       SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
           decided_by = p_staff, reason_code = p_reason, decided_at = now()
     WHERE id = p_request;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_staff, 'staff.age_correction_decided', v_row.user_id::text,
            jsonb_build_object('request', p_request, 'decision', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
                               'reason', p_reason, 'from', v_row.from_age_band, 'to', v_row.requested_age_band,
                               'tierBefore', v_tier_before, 'tierAfter', v_tier_after));
    RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_age_correction(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_age_correction(uuid, uuid, boolean, text) TO service_role;
