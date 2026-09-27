-- OD-9 section 4.2: parental consent carries over only for the practices it
-- covered. Every practice the rebuild introduced is listed in
-- public.data_practices with the consent it needs; this step marks, for each
-- migrated child, which of those consents is missing and who could give it.
--
-- A migrated child is an account created before the cutover whose youngest
-- possible age (Rule P3: under-13 origin marker, age declaration, profile
-- birth date, ID-verified birth date) is under 18, or unknown. Unknown age is
-- treated as a child, never as an adult. Role is never age evidence.
--
-- Who can consent: a verified Tutor when one is linked; a self-registered
-- 13-17 themselves only for practices that follow H.1's self-managed model
-- (data_practices.teen_self_consent); otherwise nobody yet ('none_available':
-- the practice cannot apply to that child until a Tutor is linked).
--
-- od9.run_consent(false) reports; od9.run_consent(true) records each gap in
-- od9.findings (kind consent_gap) and resolves gaps that have since been
-- consented. No product row is written by either.

CREATE OR REPLACE FUNCTION od9.age_class(p_user uuid)
RETURNS text LANGUAGE sql STABLE AS $$
    WITH evidence(band) AS (
        SELECT 'under_13' FROM public.account_safety_origins o WHERE o.user_id = p_user
        UNION ALL SELECT a.declared_age_band FROM public.account_age_declarations a WHERE a.user_id = p_user
        UNION ALL SELECT od9.band_for_birth_date(p.birth_date) FROM public.profiles p WHERE p.user_id = p_user
        UNION ALL SELECT od9.band_for_birth_date(v.birth_date) FROM public.parent_verifications v
                  WHERE v.user_id = p_user AND v.status = 'verified' AND v.method = 'local-ocr'
    )
    SELECT CASE
        WHEN bool_or(band = 'under_13') THEN 'under_13'
        WHEN bool_or(band = '13_to_17') THEN 'teen'
        WHEN bool_or(band = 'adult') THEN 'adult'
        ELSE 'unknown' END
    FROM evidence WHERE band IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION od9.run_consent(p_apply boolean, p_cutover timestamptz DEFAULT now())
RETURNS TABLE (user_id uuid, practice_key text, age_class text, grantor text, status text)
LANGUAGE plpgsql
SET "TimeZone" = 'UTC'
AS $$
#variable_conflict use_column
DECLARE
    run bigint;
    g record;
    seen text[] := ARRAY[]::text[];
BEGIN
    PERFORM od9.require_rebuild_schema();
    INSERT INTO od9.runs (step, mode) VALUES ('consent', CASE WHEN p_apply THEN 'apply' ELSE 'dry_run' END) RETURNING id INTO run;

    DROP TABLE IF EXISTS pg_temp.od9_consent;
    CREATE TEMP TABLE od9_consent AS
    WITH children AS (
        SELECT u.id AS user_id, COALESCE(od9.age_class(u.id), 'unknown') AS age_class,
               EXISTS (SELECT 1 FROM public.guardian_links l
                       WHERE l.kid_user_id = u.id AND l.verification_status = 'verified') AS has_tutor
        FROM auth.users u
        WHERE u.created_at IS NULL OR u.created_at < p_cutover
    )
    SELECT c.user_id, p.key AS practice_key, c.age_class,
           CASE WHEN c.has_tutor THEN 'tutor'
                WHEN c.age_class = 'teen' AND p.teen_self_consent THEN 'self'
                ELSE 'none_available' END AS grantor,
           CASE WHEN public.has_data_practice_consent(c.user_id, p.key) THEN 'consented' ELSE 'missing' END AS status,
           p.kind, p.introduced_by
    FROM children c CROSS JOIN public.data_practices p
    WHERE c.age_class <> 'adult';

    IF p_apply THEN
        FOR g IN SELECT * FROM od9_consent x WHERE x.status = 'missing' LOOP
            PERFORM od9.record_finding('consent_gap', g.user_id, g.user_id || ':' || g.practice_key, 'flagged',
                jsonb_build_object('practice', g.practice_key, 'kind', g.kind, 'introduced_by', g.introduced_by,
                                   'age_class', g.age_class, 'grantor', g.grantor), NULL, run);
            seen := seen || (g.user_id || ':' || g.practice_key);
        END LOOP;
        UPDATE od9.findings f SET status = 'resolved', updated_at = clock_timestamp(), run_id = run
        WHERE f.kind = 'consent_gap' AND f.status = 'flagged' AND NOT (f.subject_ref = ANY (seen));
    END IF;

    UPDATE od9.runs SET summary = jsonb_build_object(
        'children', (SELECT count(DISTINCT x.user_id) FROM od9_consent x),
        'practices', (SELECT count(*) FROM public.data_practices),
        'missing', (SELECT count(*) FROM od9_consent x WHERE x.status = 'missing'),
        'by_practice', (SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb) FROM (
            SELECT x.practice_key AS k, count(*) FILTER (WHERE x.status = 'missing') AS n FROM od9_consent x GROUP BY 1) s),
        'by_grantor', (SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb) FROM (
            SELECT x.grantor AS k, count(*) FILTER (WHERE x.status = 'missing') AS n FROM od9_consent x GROUP BY 1) s))
    WHERE id = run;

    RETURN QUERY SELECT x.user_id, x.practice_key, x.age_class, x.grantor, x.status
                 FROM od9_consent x ORDER BY x.user_id, x.practice_key;
END $$;
