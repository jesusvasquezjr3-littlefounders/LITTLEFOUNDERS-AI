-- @phase: expand
-- discoverable_profile_data_practice — OD-9 section 4.2 for the 16-17
-- discoverable profile (OD-27 (2), S-03): a new sharing surface needs fresh,
-- specific consent before it applies to a migrated child. OD-10: the
-- conservative option.
--
-- teen_discoverable_profile (S-03) merged before the S10.3 registry of rebuild
-- data practices (od9_legacy_migration, od9_consent_enforcement) and never
-- asked data_practice_applies, so a migrated self-registered 16-17 account
-- that the OD-9 consent step marked in legacy_consent_subjects could make its
-- whole profile visible to any signed-in account, and listable, with no
-- specific consent.
--
-- 1. Registers 'sharing.discoverable_profile' (kind sharing_surface). A Tutor
--    answers it, never the teen alone (teen_self_consent false, the same
--    conservative reading as every other sharing surface); a marked teen with
--    no verified Tutor therefore cannot become discoverable. For every account
--    the consent step did not mark, data_practice_applies is true and nothing
--    changes.
-- 2. teen_discoverable_base_eligible(user): the S-03 rule unchanged (teen
--    social tier, age evidence proving 16, unflagged profile). It decides
--    nothing: Core and the setter read it only to name why an otherwise
--    eligible teen is not offered the choice.
-- 3. teen_discoverable_eligible(user) = the same rule AND
--    data_practice_applies(user, 'sharing.discoverable_profile'), and stays
--    the one authority. teen_profile_discoverable reads it at
--    every visibility decision (Core's socialVisibility and the browser's
--    social_subject_visible), so an opt-in recorded before the teen was
--    marked lapses by itself, with no sweep, and a revoked consent hides the
--    profile at once.
-- 4. set_teen_profile_discoverable refuses every opt-in the eligibility
--    function refuses: by name, DATA_PRACTICE_CONSENT_REQUIRED, when the
--    account is otherwise eligible but the practice does not apply, and
--    DISCOVERABLE_NOT_ELIGIBLE otherwise. Turning it off always works. Same signature,
--    return shape and grants (service role only).
--
-- Additive. Until the OD-9 consent step marks migrated children at the
-- cutover, every function answers exactly as before.

INSERT INTO public.data_practices (key, kind, introduced_by, requirement, consent_source, teen_self_consent, summary) VALUES
    ('sharing.discoverable_profile', 'sharing_surface', 'teen_discoverable_profile', 'E.8/OD-27', 'data_practice_consents', false,
     'A 16- or 17-year-old may let any signed-in account see the whole profile and find it in lists. Off by default.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.teen_discoverable_base_eligible(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL
       AND public.social_tier(p_user) = 'teen'
       AND (public.age_at_least_by_birth_month(p_user, 16)
            OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user AND p.birth_date IS NOT NULL
                       AND p.birth_date <= ((now() AT TIME ZONE 'UTC')::date - interval '16 years')::date))
       AND NOT public.profile_fields_flagged(p_user);
$$;
REVOKE ALL ON FUNCTION public.teen_discoverable_base_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_discoverable_base_eligible(uuid) TO service_role;

-- The whole rule stays inline (agent/tools/check-social-tiers.mjs reads the
-- latest definition of this function for each S-03 condition).
CREATE OR REPLACE FUNCTION public.teen_discoverable_eligible(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL
       AND public.social_tier(p_user) = 'teen'
       AND (public.age_at_least_by_birth_month(p_user, 16)
            OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user AND p.birth_date IS NOT NULL
                       AND p.birth_date <= ((now() AT TIME ZONE 'UTC')::date - interval '16 years')::date))
       AND NOT public.profile_fields_flagged(p_user)
       AND public.data_practice_applies(p_user, 'sharing.discoverable_profile');
$$;
REVOKE ALL ON FUNCTION public.teen_discoverable_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teen_discoverable_eligible(uuid) TO service_role;

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
        -- OD-9 4.2: an otherwise eligible migrated teen needs a Tutor's
        -- specific consent first, and is told so by name.
        IF public.teen_discoverable_base_eligible(p_user)
           AND NOT public.data_practice_applies(p_user, 'sharing.discoverable_profile') THEN
            RAISE EXCEPTION 'DATA_PRACTICE_CONSENT_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
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
