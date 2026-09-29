-- tutor_age_record_review — gap-fix round 3, F3-identity-site finish
-- (A.2, A.5, E.4, OD-3 section 2, Appendix M 1.2).
-- @phase: expand
--
-- identity_enforcement (guard_parent_verification_age) stops a NEW verified
-- ID check for an account whose age record is a minor's. Accounts that were
-- verified before it keep the parent role, and with it the adult Mentor
-- defaults, until staff act. They are never demoted automatically here: the
-- age record itself may be the error (E.4's staff-reviewed correction), and
-- a silent role change would take a family's Tutor away without a person
-- looking. This file makes them findable and measurable:
--
--   list_minor_record_tutors()   service_role only
--       The accounts that hold the parent role while their age record says
--       a minor: a kid-role account, an under-13 origin
--       (account_safety_origins), or an effective declared band of under 13
--       or 13 to 17 (effective_age_band, so a teen who has turned 18 by
--       birth month is not listed). The same predicate as
--       guard_parent_verification_age. Ordered by user id, ids only.
--
-- Core reads it for the staff user list (a per-account flag next to the
-- existing revocation action) and for the identity metrics release gate
-- tutor_adult_age_record (Appendix M 1.2: zero Tutors with a minor's age
-- record). No table, so no new RLS.
--
-- Proven on native PostgreSQL by database/scripts/verify-staff-ops-postgres.py.

CREATE OR REPLACE FUNCTION public.list_minor_record_tutors()
RETURNS TABLE (user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT DISTINCT r.user_id
    FROM public.user_roles r
    WHERE r.role = 'parent'
      AND (EXISTS (SELECT 1 FROM public.user_roles k WHERE k.user_id = r.user_id AND k.role = 'kid')
           OR EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = r.user_id)
           OR coalesce(public.effective_age_band(r.user_id), '') IN ('under_13', '13_to_17'))
    ORDER BY r.user_id;
$$;
REVOKE ALL ON FUNCTION public.list_minor_record_tutors() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_minor_record_tutors() TO service_role;
