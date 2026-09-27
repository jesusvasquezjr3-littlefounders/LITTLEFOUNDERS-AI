-- @phase: expand
-- S-03 (owner decision OD-27 (2), 27 September 2026): a 16- or 17-year-old
-- may opt in to a discoverable profile. Private stays the default for every
-- teen, and children and 13-to-15-year-olds cannot opt in.
--
-- Additive. With no opt-in recorded, every function below answers exactly as
-- before, so nothing an older Core does changes meaning.
--
--   teen_profile_discoverability
--       The teen's own choice, one row per account, written only through
--       set_teen_profile_discoverable. RLS on; no browser access.
--
--   teen_discoverable_eligible(user)
--       The account is in the teen social tier (a self-registered 13-to-17
--       account, E.8; never a parent-created child, never an under-13
--       origin), its age evidence PROVES 16 or more (a recorded birth month
--       past its whole 16th-birthday month, S-04, or a profile birth date),
--       and its profile fields are not flagged (E.13). A declared teen with no
--       birth month cannot prove 16, so cannot opt in: the band alone says
--       13 to 17.
--
--   teen_profile_discoverable(user)
--       Eligible AND opted in. Read at every visibility decision, so the
--       opt-in lapses by itself the moment the account stops being eligible
--       (a flag on the handle, or the adult tier at 18, where the adult rule
--       takes over) and needs no sweep.
--
--   set_teen_profile_discoverable(user, on)
--       Explicit and revocable: turning it on needs eligibility, turning it
--       off always works. Each change writes an audit row in the same
--       transaction (E.2 pattern); an unchanged answer writes nothing.
--
-- What discoverable means (SOCIAL-TIERS.md §1): the whole profile is visible
-- to a signed-in account outside the closed tier, as an adult's is, and the
-- profile may appear in lists. What does not change: a follow into the teen
-- still needs the teen's own recorded consent (SUBJECT_CONSENT_REQUIRED,
-- E.8); no person-to-person messaging exists (E.10); a minor's learning stats
-- stay hidden from others; a flagged profile stays hidden (E.13).

CREATE TABLE IF NOT EXISTS public.teen_profile_discoverability (
    user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    discoverable boolean NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teen_profile_discoverability ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teen_profile_discoverability FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.teen_profile_discoverability TO service_role;

CREATE OR REPLACE FUNCTION public.teen_discoverable_eligible(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL
       AND public.social_tier(p_user) = 'teen'
       AND (public.age_at_least_by_birth_month(p_user, 16)
            OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user AND p.birth_date IS NOT NULL
                       AND p.birth_date <= ((now() AT TIME ZONE 'UTC')::date - interval '16 years')::date))
       AND NOT public.profile_fields_flagged(p_user);
$$;
REVOKE ALL ON FUNCTION public.teen_discoverable_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_discoverable_eligible(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.teen_profile_discoverable(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce((SELECT d.discoverable FROM public.teen_profile_discoverability d WHERE d.user_id = p_user), false)
       AND public.teen_discoverable_eligible(p_user);
$$;
REVOKE ALL ON FUNCTION public.teen_profile_discoverable(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_profile_discoverable(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_teen_profile_discoverable(p_user uuid, p_discoverable boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_before boolean;
BEGIN
    IF p_user IS NULL OR p_discoverable IS NULL THEN
        RAISE EXCEPTION 'A choice is required' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_user FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found' USING ERRCODE = '23503';
    END IF;
    IF p_discoverable AND NOT public.teen_discoverable_eligible(p_user) THEN
        RAISE EXCEPTION 'DISCOVERABLE_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
    END IF;
    SELECT discoverable INTO v_before FROM public.teen_profile_discoverability WHERE user_id = p_user;
    IF v_before IS NOT DISTINCT FROM p_discoverable OR (v_before IS NULL AND NOT p_discoverable) THEN
        RETURN p_discoverable;
    END IF;
    INSERT INTO public.teen_profile_discoverability (user_id, discoverable, updated_at)
    VALUES (p_user, p_discoverable, now())
    ON CONFLICT (user_id) DO UPDATE SET discoverable = EXCLUDED.discoverable, updated_at = EXCLUDED.updated_at;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_user,
            CASE WHEN p_discoverable THEN 'social.profile_discoverable_enabled' ELSE 'social.profile_discoverable_disabled' END,
            p_user::text, jsonb_build_object('origin', 'database-function', 'tier', 'teen'));
    RETURN p_discoverable;
END;
$$;
REVOKE ALL ON FUNCTION public.set_teen_profile_discoverable(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_teen_profile_discoverable(uuid, boolean) TO service_role;

-- Browser-side visibility (0120), with the opted-in, still-eligible teen as
-- the only addition. Mirrors Core's profileAccess 'full' verdict.
CREATE OR REPLACE FUNCTION public.social_subject_visible(p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT auth.uid() IS NOT NULL AND (
        auth.uid() = p_subject OR (
            public.social_tier(auth.uid()) <> 'closed'
            AND CASE public.social_tier(p_subject)
                WHEN 'adult' THEN true
                WHEN 'guardian' THEN
                    public.social_family(auth.uid(), p_subject)
                    OR (NOT public.profile_fields_flagged(p_subject)
                        AND public.has_current_social_approval(auth.uid(), p_subject))
                WHEN 'teen' THEN
                    EXISTS (SELECT 1 FROM public.guardian_links WHERE kid_user_id = p_subject
                        AND parent_user_id = auth.uid() AND verification_status = 'verified')
                    OR (NOT public.profile_fields_flagged(p_subject) AND (
                        public.has_current_teen_consent(auth.uid(), p_subject)
                        OR EXISTS (SELECT 1 FROM public.follows
                            WHERE follower_id = p_subject AND followed_id = auth.uid())
                        OR public.teen_profile_discoverable(p_subject)))
                ELSE false
            END
        )
    );
$$;
