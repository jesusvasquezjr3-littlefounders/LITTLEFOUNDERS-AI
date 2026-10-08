-- clean_slate_identity_functions — shared functions stop reading the removed family, task and wallet objects (1 of 3).
-- @phase: contract
-- @after-release: the clean-slate Core that removed the family console, tasks, family wallet and teen wallet
--
-- Owner decision (October 2026): the family console, tasks and rewards, the
-- family wallet and the teen wallet are removed. clean_slate_drop_removed_areas
-- drops their objects; this file and clean_slate_erasure_functions first
-- re-create each shared function that survives, from its latest definition,
-- minus only the statements that touched those objects.
--
-- identity_metrics: no family_money_events stream. The JSON shape Core parses
-- (backend identityMetrics.ts) is unchanged: unconsentedFlagged.familyMoneyEvents
-- is always 0 and faqCapabilities.secondGuardian is always false (co-guardian
-- invites are gone).
-- has_data_practice_consent: a practice whose consent_source is
-- 'family_research_consents' has no consent table any more and is never
-- consented (the ELSE branch).
-- enforce_sharing_practice: only social_connection_requests still uses it.
-- end_revoked_tutor_powers: no invites to withdraw; invitesWithdrawn stays in
-- the result as 0.
-- guard_kid_username: same refusal; its DETAIL no longer names a removed function.

CREATE OR REPLACE FUNCTION public.identity_metrics(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
            'secondGuardian', false,
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
            'familyMoneyEvents', 0),
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

CREATE OR REPLACE FUNCTION public.has_data_practice_consent(p_subject uuid, p_practice text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
    SELECT COALESCE((
        SELECT CASE p.consent_source
            WHEN 'data_practice_consents' THEN EXISTS (
                SELECT 1 FROM public.data_practice_consents c
                WHERE c.subject_user_id = p_subject AND c.practice_key = p.key
                  AND c.revoked_at IS NULL AND c.disclosure_version >= p.disclosure_version
                  AND CASE c.grantor_kind
                        WHEN 'tutor' THEN public.family_is_verified_guardian(c.granted_by, p_subject)
                        WHEN 'self' THEN p.teen_self_consent
                                         AND public.wallet_holder_kind(p_subject) = 'teen'
                                         AND NOT public.data_practice_has_tutor(p_subject)
                        ELSE false END)
            ELSE false
        END
        FROM public.data_practices p
        WHERE p.key = p_practice
    ), false)
$$;

CREATE OR REPLACE FUNCTION public.enforce_sharing_practice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
BEGIN
    IF TG_TABLE_NAME = 'social_connection_requests' THEN
        IF NOT public.data_practice_applies(NEW.kid_user_id, 'sharing.social_connections')
           OR NOT public.data_practice_applies(NEW.requester_id, 'sharing.social_connections') THEN
            RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_revoked_tutor_powers(p_user uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    v_kids uuid[];
    v_invites integer := 0;
    v_roles integer := 0;
    v_paused integer := 0;
BEGIN
    IF p_user IS NULL THEN
        RAISE EXCEPTION 'TUTOR_REVOCATION_INVALID: user is required' USING ERRCODE = '22023';
    END IF;
    PERFORM set_config('lf.tutor_revocation', p_user::text, true);
    PERFORM set_config('lf.actor', coalesce(p_actor::text, ''), true);

    WITH ended AS (
        UPDATE public.guardian_links
        SET verification_status = 'revoked', revoked_by = p_actor, revoked_at = now()
        WHERE parent_user_id = p_user AND verification_status = 'verified'
        RETURNING kid_user_id
    )
    SELECT coalesce(array_agg(DISTINCT kid_user_id), '{}') INTO v_kids FROM ended;

    DELETE FROM public.user_roles WHERE user_id = p_user AND role = 'parent';
    GET DIAGNOSTICS v_roles = ROW_COUNT;

    SELECT count(*) INTO v_paused
    FROM unnest(v_kids) AS k(kid)
    WHERE NOT EXISTS (SELECT 1 FROM public.guardian_links gl WHERE gl.kid_user_id = k.kid AND gl.verification_status = 'verified');

    PERFORM set_config('lf.tutor_revocation', '', true);
    PERFORM set_config('lf.actor', '', true);
    RETURN jsonb_build_object('linksRevoked', cardinality(v_kids), 'invitesWithdrawn', v_invites,
                              'parentRoleRemoved', v_roles = 1, 'childrenPaused', v_paused);
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_kid_username()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
BEGIN
    IF OLD.username IS NOT NULL
       AND NEW.username IS DISTINCT FROM OLD.username
       AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'kid')
       AND coalesce(current_setting('lf.kid_username_rename', true), '') <> NEW.user_id::text THEN
        RAISE EXCEPTION 'KID_USERNAME_LOCKED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
