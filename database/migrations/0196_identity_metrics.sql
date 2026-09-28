-- identity_metrics — Appendix M Part 1 (1.1-1.4) and Part 2.1 criterion 3
-- ("Measured"): every Block A acquisition and identity metric that the
-- database can observe, as COUNTS for one window, read by Core's
-- GET /api/v1/admin/analytics/identity (which computes the rates, and marks
-- each metric as a release-gate target or diagnostic).
-- @phase: expand
--
-- Window [p_from, p_to) for flow metrics; whole-population audits ignore it.
-- Sources: auth.users (is_anonymous and app-metadata provider read through
-- to_jsonb, so the function also runs where those optional GoTrue columns are
-- absent), account_safety_origins, account_age_declarations (with
-- promoted_to_adult_at), profiles.birth_date, user_roles, guardian_links,
-- parent_verifications (latest row per account), audit_logs:
--   auth.guest.age_refusal        written by Core's POST /auth/guest when the
--                                 age-refusal path asks for a flagged guest
--                                 (detail.flagged = the flag write confirmed)
--   admin.parent_role_justification, admin.parent_verification.revoked
--                                 written atomically by 0193's functions
--   auth.kid_email_change.refused written by Core when POST /auth/change-email
--                                 refuses a kid-role account (A.6)
--
-- Population rules:
--   entry paths   email = not anonymous and provider not google; google =
--                 app-metadata provider google; guest = anonymous. Kid-role
--                 accounts are created by a guardian (a fourth path with a
--                 birth date on the profile) and are counted apart.
--   age on file   an age declaration, an under-13 origin row, or a profile
--                 birth date.
--   backlog       accounts older than the age screen itself (the first
--                 declaration ever recorded, or p_from when none exists).
--   staff-granted a parent-role holder that never had an ID-verified
--                 (verified, local-ocr) row.
--   schema fields produced = rows carry the field; consumed = a function in
--                 the public schema reads it (a declared field with no
--                 consumer is reported, never assumed).
-- Counts only: no account id leaves this function.
--
-- Proven on native PostgreSQL by database/scripts/verify-staff-ops-postgres.py.

CREATE OR REPLACE FUNCTION public.identity_metrics(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff timestamptz;
    v_result jsonb;
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
        RAISE EXCEPTION 'identity_metrics needs a window with from < to' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(min(created_at), p_from) INTO v_cutoff FROM public.account_age_declarations;

    WITH raw AS (
        SELECT u.id, to_jsonb(u) AS j FROM auth.users u
    ),
    base AS (
        SELECT raw.id,
               coalesce((raw.j ->> 'created_at')::timestamptz, now()) AS created_at,
               coalesce((raw.j ->> 'is_anonymous')::boolean, false) AS anonymous,
               CASE WHEN coalesce((raw.j ->> 'is_anonymous')::boolean, false) THEN 'guest'
                    WHEN lower(coalesce(raw.j #>> '{raw_app_meta_data,provider}', '')) = 'google' THEN 'google'
                    ELSE 'email' END AS provider,
               coalesce(nullif(btrim(coalesce(raw.j ->> 'email_change', '')), ''),
                        nullif(btrim(coalesce(raw.j ->> 'new_email', '')), '')) IS NOT NULL AS pending_email,
               EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = raw.id AND r.role = 'kid') AS kid,
               EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = raw.id AND r.role = 'parent') AS parent,
               EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = raw.id) AS origin,
               (SELECT d.declared_age_band FROM public.account_age_declarations d WHERE d.user_id = raw.id) AS declared,
               EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = raw.id AND p.birth_date IS NOT NULL) AS birth_date
        FROM raw
    ),
    acc AS (
        SELECT base.*, (base.origin OR base.declared IS NOT NULL OR base.birth_date) AS age_on_file FROM base
    ),
    latest AS (
        SELECT DISTINCT ON (v.user_id) v.user_id, v.status, v.method
        FROM public.parent_verifications v
        ORDER BY v.user_id, v.created_at DESC, v.id DESC
    ),
    justified AS (
        SELECT DISTINCT a.subject FROM public.audit_logs a
        WHERE a.action = 'admin.parent_role_justification'
          AND char_length(btrim(coalesce(a.detail ->> 'justification', ''))) >= 10
    ),
    ever_id_verified AS (
        SELECT DISTINCT user_id FROM public.parent_verifications WHERE status = 'verified' AND method = 'local-ocr'
    ),
    parents AS (
        SELECT acc.id,
               CASE WHEN l.user_id IS NULL THEN (CASE WHEN j.subject IS NOT NULL THEN 'staff_granted' ELSE 'untagged' END)
                    WHEN l.status = 'revoked' THEN 'revoked'
                    WHEN l.method = 'local-ocr' THEN 'id_verified'
                    ELSE 'staff_granted' END AS tag,
               e.user_id IS NULL AS staff_granted,
               j.subject IS NOT NULL AS has_justification
        FROM acc
        LEFT JOIN latest l ON l.user_id = acc.id
        LEFT JOIN justified j ON j.subject = acc.id::text
        LEFT JOIN ever_id_verified e ON e.user_id = acc.id
        WHERE acc.parent
    ),
    refusals AS (
        SELECT a.detail FROM public.audit_logs a
        WHERE a.action = 'auth.guest.age_refusal' AND a.created_at >= p_from AND a.created_at < p_to
    ),
    field_consumers AS (
        SELECT
            EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname <> 'identity_metrics' AND p.prosrc ILIKE '%account_safety_origins%') AS origin,
            EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname <> 'identity_metrics' AND p.prosrc ILIKE '%parent_verifications%' AND p.prosrc ILIKE '%method%') AS tier,
            EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname <> 'identity_metrics' AND p.prosrc ILIKE '%document_type%') AS document_type,
            EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                    WHERE n.nspname = 'public' AND p.proname <> 'identity_metrics' AND p.prosrc ILIKE '%parent_verifications%' AND p.prosrc ILIKE '%revoked%') AS revocation
    )
    SELECT jsonb_build_object(
        'window', jsonb_build_object('from', p_from, 'to', p_to, 'backlogCutoff', v_cutoff),
        'guestOrigin', jsonb_build_object(
            'requested', (SELECT count(*) FROM refusals),
            'flagged', (SELECT count(*) FROM refusals r WHERE (r.detail ->> 'flagged')::boolean IS TRUE),
            'flaggedGuestsCreated', (SELECT count(*) FROM acc WHERE anonymous AND origin AND created_at >= p_from AND created_at < p_to)),
        'flagPersistence', jsonb_build_object(
            'upgraded', (SELECT count(*) FROM acc WHERE origin AND NOT anonymous),
            'safeguarded', (SELECT count(*) FROM acc WHERE origin AND NOT anonymous AND public.social_tier(acc.id) IN ('closed', 'guardian'))),
        'googleAgeScreen', jsonb_build_object(
            'firstTime', (SELECT count(*) FROM acc WHERE provider = 'google' AND NOT kid AND created_at >= p_from AND created_at < p_to),
            'screened', (SELECT count(*) FROM acc WHERE provider = 'google' AND NOT kid AND created_at >= p_from AND created_at < p_to
                           AND (declared IS NOT NULL OR origin))),
        'googleUnder13', jsonb_build_object(
            'declaredUnder13', (SELECT count(*) FROM acc WHERE provider = 'google' AND declared = 'under_13'),
            'reclassified', (SELECT count(*) FROM acc WHERE provider = 'google' AND declared = 'under_13' AND origin)),
        'entryCapture', jsonb_build_object(
            'email', jsonb_build_object(
                'created', (SELECT count(*) FROM acc WHERE provider = 'email' AND NOT kid AND created_at >= p_from AND created_at < p_to),
                'captured', (SELECT count(*) FROM acc WHERE provider = 'email' AND NOT kid AND created_at >= p_from AND created_at < p_to AND age_on_file)),
            'google', jsonb_build_object(
                'created', (SELECT count(*) FROM acc WHERE provider = 'google' AND NOT kid AND created_at >= p_from AND created_at < p_to),
                'captured', (SELECT count(*) FROM acc WHERE provider = 'google' AND NOT kid AND created_at >= p_from AND created_at < p_to AND age_on_file)),
            'guest', jsonb_build_object(
                'created', (SELECT count(*) FROM acc WHERE provider = 'guest' AND created_at >= p_from AND created_at < p_to),
                'captured', (SELECT count(*) FROM acc WHERE provider = 'guest' AND created_at >= p_from AND created_at < p_to AND age_on_file)),
            'kid', jsonb_build_object(
                'created', (SELECT count(*) FROM acc WHERE kid AND created_at >= p_from AND created_at < p_to),
                'captured', (SELECT count(*) FROM acc WHERE kid AND created_at >= p_from AND created_at < p_to AND age_on_file))),
        'undatedBacklog', jsonb_build_object(
            'existing', (SELECT count(*) FROM acc WHERE NOT anonymous AND created_at < v_cutoff),
            'undated', (SELECT count(*) FROM acc WHERE NOT anonymous AND created_at < v_cutoff AND NOT age_on_file)),
        'parentTags', jsonb_build_object(
            'holders', (SELECT count(*) FROM parents),
            'idVerified', (SELECT count(*) FROM parents WHERE tag = 'id_verified'),
            'staffGranted', (SELECT count(*) FROM parents WHERE tag = 'staff_granted'),
            'revoked', (SELECT count(*) FROM parents WHERE tag = 'revoked'),
            'untagged', (SELECT count(*) FROM parents WHERE tag = 'untagged')),
        'staffGrantJustification', jsonb_build_object(
            'staffGranted', (SELECT count(*) FROM parents WHERE staff_granted),
            'justified', (SELECT count(*) FROM parents WHERE staff_granted AND has_justification),
            'justificationsInWindow', (SELECT count(*) FROM public.audit_logs a WHERE a.action = 'admin.parent_role_justification'
                                        AND a.created_at >= p_from AND a.created_at < p_to)),
        'revocation', jsonb_build_object(
            'revokedRows', (SELECT count(*) FROM public.parent_verifications WHERE status = 'revoked'),
            'revokedInWindow', (SELECT count(*) FROM public.parent_verifications WHERE status = 'revoked' AND created_at >= p_from AND created_at < p_to),
            'auditedRevocations', (SELECT count(*) FROM public.audit_logs a WHERE a.action = 'admin.parent_verification.revoked')),
        'kidEmail', jsonb_build_object(
            'kids', (SELECT count(*) FROM acc WHERE kid),
            'restricted', (SELECT count(*) FROM acc WHERE kid AND NOT pending_email),
            'refusalsInWindow', (SELECT count(*) FROM public.audit_logs a WHERE a.action = 'auth.kid_email_change.refused'
                                  AND a.created_at >= p_from AND a.created_at < p_to)),
        'faqCapabilities', jsonb_build_object(
            'secondGuardian', to_regclass('public.guardian_invites') IS NOT NULL AND to_regclass('public.guardian_links') IS NOT NULL,
            'cancellationCascade', to_regclass('public.account_deletion_requests') IS NOT NULL
                AND EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                            WHERE n.nspname = 'public' AND p.proname = 'erase_account_data'),
            'reportTool', to_regclass('public.social_reports') IS NOT NULL),
        'schemaFields', jsonb_build_object(
            'originFlag', jsonb_build_object('produced', (SELECT count(*) FROM public.account_safety_origins), 'consumed', (SELECT origin FROM field_consumers)),
            'verificationTier', jsonb_build_object('produced', (SELECT count(DISTINCT method) FROM public.parent_verifications WHERE status = 'verified'),
                                                   'consumed', (SELECT tier FROM field_consumers)),
            'documentType', jsonb_build_object(
                'declared', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                                    AND table_name = 'parent_verifications' AND column_name = 'document_type'),
                'consumed', (SELECT document_type FROM field_consumers)),
            'revocationStatus', jsonb_build_object('produced', (SELECT count(*) FROM public.parent_verifications WHERE status = 'revoked'),
                                                   'consumed', (SELECT revocation FROM field_consumers)))
    ) INTO v_result;
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.identity_metrics(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.identity_metrics(timestamptz, timestamptz) TO service_role;

SELECT 'migration_identity_metrics_ok' AS sentinel;
