-- analytics_disclosure_coverage — Appendix O Part 1.1 (Teen/Guest
-- Consent-Adjacent Disclosure Coverage) for H.1, and Part 2.1 criterion 3
-- ("Measured"): COUNTS for one window, read by Core's
-- GET /api/v1/admin/analytics/consent-coverage (view_analytics), which
-- computes the rate against the 100% target.
-- @phase: expand
--
-- Population, for the window [p_from, p_to):
--   active      an account created, signed in (auth.users.last_sign_in_at),
--               holding an auth session touched, or writing a learning event
--               in the window. GoTrue's optional columns are read through
--               to_jsonb, so the function also runs where they are absent.
--   teen        a self-registered account (not anonymous, no kid role: a
--               kid-role account sits behind the guardian-consent gate and is
--               out of scope) whose effective age band today is 13_to_17.
--   guest       an anonymous account.
-- Coverage:
--   a teen is covered when a disclosure choice is on file
--   (teen_analytics_preferences, disclosure_version 1) or the account carries
--   a protected under-13 origin (analytics suppressed outright), and no
--   optional learning event was admitted in the window without an opt-in.
--   a guest is covered because the protected guest origin suppresses
--   analytics: the admission trigger (0090) drops every guest event. A guest
--   with an admitted event in the window is counted as measured, uncovered.
-- Counts only: no account id leaves this function.
--
-- Proven on native PostgreSQL by
-- database/scripts/verify-analytics-disclosure-postgres.py.

CREATE OR REPLACE FUNCTION public.analytics_disclosure_coverage(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
        RAISE EXCEPTION 'analytics_disclosure_coverage needs a window with from < to' USING ERRCODE = '22023';
    END IF;

    WITH raw AS (
        SELECT u.id, to_jsonb(u) AS j FROM auth.users u
    ),
    session_touch AS (
        SELECT DISTINCT s.user_id FROM (SELECT x.user_id, to_jsonb(x) AS j FROM auth.sessions x) s
        WHERE coalesce((s.j ->> 'refreshed_at')::timestamptz, (s.j ->> 'updated_at')::timestamptz, (s.j ->> 'created_at')::timestamptz)
              >= p_from
          AND coalesce((s.j ->> 'refreshed_at')::timestamptz, (s.j ->> 'updated_at')::timestamptz, (s.j ->> 'created_at')::timestamptz)
              < p_to
    ),
    events AS (
        SELECT DISTINCT e.user_id FROM public.learning_events e
        WHERE e.user_id IS NOT NULL AND e.created_at >= p_from AND e.created_at < p_to
    ),
    acc AS (
        SELECT raw.id,
               coalesce((raw.j ->> 'is_anonymous')::boolean, false) AS anonymous,
               EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = raw.id AND r.role = 'kid') AS kid,
               public.effective_age_band(raw.id) AS band,
               EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = raw.id AND o.under13_origin) AS protected,
               ev.user_id IS NOT NULL AS measured,
               (   ((raw.j ->> 'created_at')::timestamptz >= p_from AND (raw.j ->> 'created_at')::timestamptz < p_to)
                OR ((raw.j ->> 'last_sign_in_at')::timestamptz >= p_from AND (raw.j ->> 'last_sign_in_at')::timestamptz < p_to)
                OR st.user_id IS NOT NULL
                OR ev.user_id IS NOT NULL) AS active
        FROM raw
        LEFT JOIN session_touch st ON st.user_id = raw.id
        LEFT JOIN events ev ON ev.user_id = raw.id
    ),
    teens AS (
        SELECT acc.*,
               p.user_id IS NOT NULL AS disclosed,
               coalesce(p.enabled, false) AS opted_in
        FROM acc
        LEFT JOIN public.teen_analytics_preferences p ON p.user_id = acc.id AND p.disclosure_version = 1
        WHERE acc.active AND NOT acc.anonymous AND NOT acc.kid AND acc.band = '13_to_17'
    ),
    guests AS (
        SELECT acc.* FROM acc WHERE acc.active AND acc.anonymous
    )
    SELECT jsonb_build_object(
        'window', jsonb_build_object('from', p_from, 'to', p_to),
        'teens', jsonb_build_object(
            'active', (SELECT count(*) FROM teens),
            'disclosed', (SELECT count(*) FROM teens WHERE disclosed),
            'optedIn', (SELECT count(*) FROM teens WHERE disclosed AND opted_in),
            'optedOut', (SELECT count(*) FROM teens WHERE disclosed AND NOT opted_in),
            'protectedOrigin', (SELECT count(*) FROM teens WHERE protected),
            'measuredWithoutOptIn', (SELECT count(*) FROM teens WHERE measured AND NOT opted_in),
            'covered', (SELECT count(*) FROM teens WHERE (disclosed OR protected) AND NOT (measured AND NOT opted_in))),
        'guests', jsonb_build_object(
            'active', (SELECT count(*) FROM guests),
            'suppressed', (SELECT count(*) FROM guests WHERE NOT measured),
            'measured', (SELECT count(*) FROM guests WHERE measured))
    ) INTO v_result;
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_disclosure_coverage(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_disclosure_coverage(timestamptz, timestamptz) TO service_role;

SELECT 'migration_analytics_disclosure_coverage_ok' AS sentinel;
