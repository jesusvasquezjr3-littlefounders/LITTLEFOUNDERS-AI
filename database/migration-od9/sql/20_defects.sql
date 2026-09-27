-- OD-9 section 4.3: legacy defects are not migrated forward. Records created
-- by defective flows are flagged and corrected during migration:
--   A.5  staff-granted parent roles without a justification
--   A.2  guest accounts created from the age-refusal path
--   A.3  Google accounts with no date of birth (and A.4, any account with no
--        age evidence at all)
--   F.2  public badge shares with no expiry (given the default expiry)
-- plus one carry-over that is not a defect: an account whose stored birth
-- date already answers the age screen gets its declaration from that date, so
-- nobody is asked again for what they told us (never an invented age).
--
-- od9.run_defects(false) is the dry run: it changes nothing and reports what
-- apply would do. od9.run_defects(true) applies, records each finding in
-- od9.findings and writes an audit_logs row per data change. Both are
-- idempotent: a second apply finds nothing new to change.

CREATE OR REPLACE FUNCTION od9.share_default_window()
RETURNS interval LANGUAGE sql IMMUTABLE AS $$ SELECT interval '30 days' $$;  -- 0109 (OD-10/OD-13)

CREATE OR REPLACE FUNCTION od9.band_for_birth_date(p_birth date, p_today date DEFAULT current_date)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN p_birth IS NULL OR p_birth > p_today OR p_birth <= p_today - interval '120 years' THEN NULL
        WHEN p_birth > p_today - interval '13 years' THEN 'under_13'
        WHEN p_birth > p_today - interval '18 years' THEN '13_to_17'
        ELSE 'adult' END
$$;

CREATE OR REPLACE FUNCTION od9.google_accounts()
RETURNS TABLE (user_id uuid) LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF to_regclass('auth.identities') IS NOT NULL THEN
        RETURN QUERY EXECUTE $q$SELECT DISTINCT user_id FROM auth.identities WHERE provider = 'google'$q$;
    END IF;
    IF od9.has_column('auth', 'users', 'raw_app_meta_data') THEN
        RETURN QUERY EXECUTE $q$SELECT id FROM auth.users
            WHERE raw_app_meta_data ->> 'provider' = 'google'
               OR COALESCE(raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'$q$;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION od9.run_defects(p_apply boolean, p_cutover timestamptz DEFAULT now())
RETURNS TABLE (kind text, subject_user_id uuid, subject_ref text, action text, detail jsonb)
LANGUAGE plpgsql
SET "TimeZone" = 'UTC'
AS $$
#variable_conflict use_column
DECLARE
    d record;
    run bigint;
    anon_sql text;
    seen text[] := ARRAY[]::text[];
BEGIN
    PERFORM od9.require_rebuild_schema();
    INSERT INTO od9.runs (step, mode) VALUES ('defects', CASE WHEN p_apply THEN 'apply' ELSE 'dry_run' END) RETURNING id INTO run;

    DROP TABLE IF EXISTS pg_temp.od9_defect;
    CREATE TEMP TABLE od9_defect (kind text, user_id uuid, ref text, action text, status text, detail jsonb, band text);

    -- A.5 ───────────────────────────────────────────────────────────────
    INSERT INTO od9_defect
    SELECT 'A5_parent_role_without_justification', r.user_id, r.user_id::text,
           CASE WHEN l.user_id IS NULL THEN 'mark_staff_granted'
                WHEN l.status = 'verified' THEN 'await_justification'
                ELSE 'review_revoked_verification' END,
           'review_required',
           jsonb_build_object('granted_by', r.granted_by, 'granted_at', r.granted_at,
                              'latest_verification', CASE WHEN l.user_id IS NULL THEN NULL ELSE l.status || '/' || l.method END,
                              'verified_children', (SELECT count(*) FROM public.guardian_links g
                                                    WHERE g.parent_user_id = r.user_id AND g.verification_status = 'verified')),
           NULL
    FROM public.user_roles r
    LEFT JOIN LATERAL (SELECT v.user_id, v.status, v.method FROM public.parent_verifications v
                       WHERE v.user_id = r.user_id ORDER BY v.created_at DESC, v.id DESC LIMIT 1) l ON true
    WHERE r.role = 'parent'
      AND NOT (COALESCE(l.status, '') = 'verified' AND COALESCE(l.method, '') = 'local-ocr')
      AND NOT EXISTS (SELECT 1 FROM public.audit_logs a
                      WHERE a.action = 'admin.parent_role_justification' AND a.subject = r.user_id::text);

    -- Age evidence per account without a declaration or an origin marker.
    anon_sql := CASE WHEN od9.has_column('auth', 'users', 'is_anonymous') THEN 'u.is_anonymous' ELSE 'false' END;
    DROP TABLE IF EXISTS pg_temp.od9_age;
    EXECUTE format($q$
        CREATE TEMP TABLE od9_age AS
        SELECT u.id AS user_id, %s AS anonymous, u.created_at,
               p.birth_date AS profile_birth,
               (SELECT v.birth_date FROM public.parent_verifications v
                WHERE v.user_id = u.id AND v.status = 'verified' AND v.method = 'local-ocr'
                ORDER BY v.created_at DESC, v.id DESC LIMIT 1) AS verified_birth,
               EXISTS (SELECT 1 FROM od9.google_accounts() g WHERE g.user_id = u.id) AS google,
               (SELECT array_agg(r.role ORDER BY r.role) FROM public.user_roles r WHERE r.user_id = u.id) AS roles
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.user_id = u.id
        WHERE (u.created_at IS NULL OR u.created_at < %L)
          AND NOT EXISTS (SELECT 1 FROM public.account_age_declarations a WHERE a.user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = u.id)$q$, anon_sql, p_cutover);

    -- A.2 ───────────────────────────────────────────────────────────────
    INSERT INTO od9_defect
    SELECT 'A2_legacy_guest', a.user_id, a.user_id::text,
           CASE WHEN od9.band_for_birth_date(a.profile_birth) IS NULL THEN 'protective_under13_marker'
                ELSE 'declare_from_birth_date' END,
           'corrected',
           jsonb_build_object('band', od9.band_for_birth_date(a.profile_birth), 'reason',
                              CASE WHEN a.profile_birth IS NULL THEN 'no age evidence: the refusal path cannot be ruled out'
                                   ELSE 'guest with a stored birth date' END),
           od9.band_for_birth_date(a.profile_birth)
    FROM od9_age a WHERE a.anonymous;

    -- Carry-over: a stored birth date answers the age screen.
    INSERT INTO od9_defect
    SELECT 'age_declaration_from_birth_date', a.user_id, a.user_id::text, 'declare_from_birth_date', 'corrected',
           jsonb_build_object('band', od9.band_for_birth_date(COALESCE(a.profile_birth, a.verified_birth)),
                              'source', CASE WHEN a.profile_birth IS NOT NULL THEN 'profile' ELSE 'parent_verification' END),
           od9.band_for_birth_date(COALESCE(a.profile_birth, a.verified_birth))
    FROM od9_age a
    WHERE NOT a.anonymous AND od9.band_for_birth_date(COALESCE(a.profile_birth, a.verified_birth)) IS NOT NULL;

    -- A.3 / A.4: nothing to derive. Core's age screen is mandatory for every
    -- account without a declaration (ageScreen.required), and until it is
    -- answered the learner is treated as a child (Rule P3). No age is invented.
    INSERT INTO od9_defect
    SELECT CASE WHEN a.google THEN 'A3_google_no_dob' ELSE 'A4_no_age_evidence' END,
           a.user_id, a.user_id::text, 'age_screen_required', 'flagged',
           jsonb_build_object('roles', to_jsonb(a.roles), 'google', a.google), NULL
    FROM od9_age a
    WHERE NOT a.anonymous AND od9.band_for_birth_date(COALESCE(a.profile_birth, a.verified_birth)) IS NULL;

    -- F.2 ───────────────────────────────────────────────────────────────
    INSERT INTO od9_defect
    SELECT 'F2_share_without_expiry', s.kid_user_id, s.id::text, 'default_expiry', 'corrected',
           jsonb_build_object('created_at', s.created_at, 'expires_at', s.expires_at,
                              'new_expires_at', s.created_at + od9.share_default_window(),
                              'expired_by_default', s.created_at + od9.share_default_window() <= now()),
           NULL
    FROM public.badge_shares s
    WHERE s.revoked_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > s.created_at + od9.share_default_window());

    IF p_apply THEN
        FOR d IN SELECT * FROM od9_defect ORDER BY kind, ref LOOP
            IF d.kind = 'A5_parent_role_without_justification' AND d.action = 'mark_staff_granted' THEN
                INSERT INTO public.parent_verifications (user_id, status, method, checks)
                VALUES (d.user_id, 'verified', 'staff-granted', jsonb_build_object('od9', 'legacy staff grant without justification'));
            ELSIF d.kind = 'A2_legacy_guest' AND d.action = 'protective_under13_marker' THEN
                PERFORM public.mark_under13_origin(d.user_id);
            ELSIF d.action = 'declare_from_birth_date' THEN
                PERFORM public.record_age_declaration(d.user_id, d.band);
            ELSIF d.kind = 'F2_share_without_expiry' THEN
                UPDATE public.badge_shares SET expires_at = created_at + od9.share_default_window()
                WHERE id = d.ref::uuid AND revoked_at IS NULL;
            END IF;
            IF d.action IN ('mark_staff_granted', 'protective_under13_marker', 'declare_from_birth_date', 'default_expiry') THEN
                INSERT INTO public.audit_logs (actor_id, action, subject, detail)
                VALUES (NULL, 'od9.' || d.kind, d.ref, d.detail || jsonb_build_object('action', d.action, 'run', run));
            END IF;
            PERFORM od9.record_finding(d.kind, d.user_id, d.ref, d.status, d.detail,
                                       jsonb_build_object('action', d.action, 'at', clock_timestamp()), run);
            seen := seen || (d.kind || '|' || d.ref);
        END LOOP;
        -- A finding that needed a person and is no longer detected (the staff
        -- member recorded a justification, the account answered the age
        -- screen) is resolved; a corrected finding keeps its status.
        UPDATE od9.findings f SET status = 'resolved', updated_at = clock_timestamp(), run_id = run
        WHERE f.kind IN ('A5_parent_role_without_justification', 'A3_google_no_dob', 'A4_no_age_evidence')
          AND f.status IN ('flagged', 'review_required')
          AND NOT ((f.kind || '|' || f.subject_ref) = ANY (seen));
    END IF;

    UPDATE od9.runs SET summary = (SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb)
                                   FROM (SELECT x.kind || ':' || x.action AS k, count(*) AS n FROM od9_defect x GROUP BY 1) s)
    WHERE id = run;

    RETURN QUERY SELECT x.kind, x.user_id, x.ref,
                        CASE WHEN p_apply THEN x.action ELSE 'would_' || x.action END, x.detail
                 FROM od9_defect x ORDER BY x.kind, x.ref;
END $$;
