-- identity_unconsented_flagged_metric — gap-fix round 7, fix7identi0 (A.2;
-- Appendix M 1.1 Unconsented Analytics Event Rate (flagged sessions), Part
-- 2.1 criterion 3 "Measured", Part 2.2(d), Part 3 Stage 5).
-- @phase: expand
--
-- Appendix M 1.1 names the data source of this metric: the analytics event
-- log filtered by the origin flag, target zero. Until now it was only a test
-- suite (identity:db-verify proves guard_optional_learning_event and
-- guard_family_money_event refuse a flagged account); nothing counted what the
-- event log actually holds, so a trigger disabled or bypassed in production
-- would have gone unseen by the staff Trust view.
--
-- identity_metrics keeps 0228's body unchanged and gains one object,
-- 'unconsentedFlagged', for the window [p_from, p_to):
--   events / learningEvents / familyMoneyEvents  rows of public.learning_events
--       and public.family_money_events whose user_id has an
--       account_safety_origins row and whose created_at is at or after that
--       row's created_at (an event admitted before a later flag is excluded);
--   accountsWithEvents  distinct flagged accounts with such a row;
--   flaggedActive  flagged accounts seen in the window (flagged in it, signed
--       in during it, or with any analytics row in it) — the denominator;
--   flagged  flagged accounts that existed before p_to.
-- Counts only, SECURITY DEFINER, executable by service_role only, as before.
-- Core reports it as the release gate flagged_session_unconsented_events
-- (met only at zero events). Deploy order: apply before the Core release that
-- reads it (Core refuses an answer without the object, never shows zeros); an
-- older Core ignores the extra key.
-- Proven on native PostgreSQL by database/scripts/verify-origin-postgres.py.

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
    -- Appendix M 1.1 (Unconsented Analytics Event Rate, flagged sessions):
    -- every stored optional-analytics row of an account that carries the
    -- under-13 origin, written at or after the moment it was flagged. Rows
    -- admitted before a later flag are the account's history, not a leak.
    flagged AS (
        SELECT o.user_id, o.created_at AS flagged_at FROM public.account_safety_origins o WHERE o.created_at < p_to
    ),
    unconsented AS (
        SELECT 'learning'::text AS stream, e.user_id FROM public.learning_events e JOIN flagged f ON f.user_id = e.user_id
        WHERE e.created_at >= f.flagged_at AND e.created_at >= p_from AND e.created_at < p_to
        UNION ALL
        SELECT 'family'::text AS stream, e.user_id FROM public.family_money_events e JOIN flagged f ON f.user_id = e.user_id
        WHERE e.created_at >= f.flagged_at AND e.created_at >= p_from AND e.created_at < p_to
    ),
    -- The denominator context: flagged accounts seen in the window (flagged in
    -- it, signed in during it, or with any analytics row in it, so an account
    -- with an unconsented row is always counted as active).
    flagged_active AS (
        SELECT f.user_id FROM flagged f
        LEFT JOIN raw ON raw.id = f.user_id
        WHERE f.flagged_at >= p_from
           OR ((raw.j ->> 'last_sign_in_at')::timestamptz >= p_from AND (raw.j ->> 'last_sign_in_at')::timestamptz < p_to)
           OR EXISTS (SELECT 1 FROM public.learning_events e WHERE e.user_id = f.user_id AND e.created_at >= p_from AND e.created_at < p_to)
           OR EXISTS (SELECT 1 FROM public.family_money_events e WHERE e.user_id = f.user_id AND e.created_at >= p_from AND e.created_at < p_to)
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
                            WHERE n.nspname = 'public' AND p.proname = 'erase_account_data')
                -- F3-identity-site: the FAQ promises a pause at once and an erasure after 90
                -- days without any sign-in, so parity needs the suspension triggers, the ban
                -- they apply, the scheduled candidate read and a recent sweep that used it.
                AND (SELECT count(DISTINCT t.tgname) FROM pg_catalog.pg_trigger t
                     WHERE t.tgrelid = 'public.guardian_links'::regclass AND NOT t.tgisinternal
                       AND t.tgname IN ('guardian_link_suspension', 'guardian_link_suspension_on_status')) = 2
                AND EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                            WHERE n.nspname = 'public' AND p.proname = 'suspend_unlinked_kid' AND p.prosrc ILIKE '%set_kid_sign_in_ban%')
                AND EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                            WHERE n.nspname = 'public' AND p.proname = 'list_expired_kid_suspensions')
                AND EXISTS (SELECT 1 FROM public.audit_logs a
                            WHERE a.action = 'account_deletions.sweep_ran' AND a.detail ? 'suspensionsExpired'
                              AND a.created_at >= least(p_to, now()) - interval '2 days' AND a.created_at < p_to),
            'reportTool', to_regclass('public.social_reports') IS NOT NULL),
        'unconsentedFlagged', jsonb_build_object(
            'flagged', (SELECT count(*) FROM flagged),
            'flaggedActive', (SELECT count(*) FROM flagged_active),
            'accountsWithEvents', (SELECT count(DISTINCT user_id) FROM unconsented),
            'events', (SELECT count(*) FROM unconsented),
            'learningEvents', (SELECT count(*) FROM unconsented WHERE stream = 'learning'),
            'familyMoneyEvents', (SELECT count(*) FROM unconsented WHERE stream = 'family')),
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

SELECT 'migration_identity_unconsented_flagged_metric_ok' AS sentinel;
