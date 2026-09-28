-- onboarding_discovery_metrics — A.2 and Appendix M 1.1 (Unconsented Analytics
-- Event Rate, flagged sessions: target zero) for the onboarding survey's
-- "how did you hear about us" answer.
-- @phase: expand
--
-- Core's POST /onboarding/complete stores onboarding_responses.discovery_channel
-- only under the signup-attribution predicate (admitsAcquisitionAnswer): never
-- an under-13 origin (the age-refusal guest included), never a kid-role
-- account, never an under-13 declaration, a teen only after their own opt-in.
-- Before gap-fix round 2 it stored the answer for everyone.
--
-- 1. Scrub: answers recorded before the gate for those populations are set to
--    NULL. The row stays: it is the onboarding completion marker, and a NULL
--    channel is a value every deployed reader already accepts (a skipped
--    question), so no older deploy loses anything it relies on.
-- 2. Measure: public.onboarding_discovery_metrics() counts, over the whole
--    population, the stored answers and those that belong to a population the
--    predicate refuses. Core reads it next to identity_metrics and reports the
--    release-gate metric onboarding_discovery_unconsented (target zero).
--    Counts only: no account id leaves the function.
--
-- A teen promoted to the adult tier by birth month (OD-28) keeps an explicit
-- earlier "no"; that population is counted as refused when its disclosed
-- preference is off, as allowsSelfManagedAnalytics decides.

UPDATE public.onboarding_responses r
SET discovery_channel = NULL
WHERE r.discovery_channel IS NOT NULL
  AND (
        EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = r.user_id)
     OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = r.user_id AND ur.role = 'kid')
     OR EXISTS (SELECT 1 FROM public.account_age_declarations d WHERE d.user_id = r.user_id AND d.declared_age_band = 'under_13')
     OR (EXISTS (SELECT 1 FROM public.account_age_declarations d WHERE d.user_id = r.user_id AND d.declared_age_band = '13_to_17')
         AND NOT EXISTS (SELECT 1 FROM public.teen_analytics_preferences p WHERE p.user_id = r.user_id AND p.enabled))
     OR (EXISTS (SELECT 1 FROM public.account_age_declarations d WHERE d.user_id = r.user_id
                 AND d.declared_age_band = 'adult' AND d.promoted_to_adult_at IS NOT NULL)
         AND EXISTS (SELECT 1 FROM public.teen_analytics_preferences p WHERE p.user_id = r.user_id AND NOT p.enabled))
  );

CREATE OR REPLACE FUNCTION public.onboarding_discovery_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH answered AS (
        SELECT r.user_id,
               EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = r.user_id) AS origin,
               EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = r.user_id AND ur.role = 'kid') AS kid,
               (SELECT d.declared_age_band FROM public.account_age_declarations d WHERE d.user_id = r.user_id) AS declared,
               EXISTS (SELECT 1 FROM public.account_age_declarations d WHERE d.user_id = r.user_id
                       AND d.promoted_to_adult_at IS NOT NULL) AS promoted,
               (SELECT p.enabled FROM public.teen_analytics_preferences p WHERE p.user_id = r.user_id) AS opted_in
        FROM public.onboarding_responses r
        WHERE r.discovery_channel IS NOT NULL
    ),
    judged AS (
        SELECT answered.*,
               (origin OR kid OR declared = 'under_13'
                OR (declared = '13_to_17' AND opted_in IS NOT TRUE)
                OR (declared = 'adult' AND promoted AND opted_in IS FALSE)) AS refused
        FROM answered
    )
    SELECT jsonb_build_object(
        'answered', (SELECT count(*) FROM judged),
        'unconsented', (SELECT count(*) FROM judged WHERE refused),
        'flaggedOrigin', (SELECT count(*) FROM judged WHERE origin),
        'kid', (SELECT count(*) FROM judged WHERE kid),
        'under13Declared', (SELECT count(*) FROM judged WHERE declared = 'under_13'),
        'teenWithoutOptIn', (SELECT count(*) FROM judged WHERE refused AND NOT origin AND NOT kid
                                                        AND declared IS DISTINCT FROM 'under_13'));
$$;

REVOKE ALL ON FUNCTION public.onboarding_discovery_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_discovery_metrics() TO service_role;

SELECT 'migration_onboarding_discovery_metrics_ok' AS sentinel;
