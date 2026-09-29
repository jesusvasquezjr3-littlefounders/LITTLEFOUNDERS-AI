-- identity_enforcement — gap-fix round 3, F3-identity-site (A.1, A.2, A.5,
-- E.4, E.6, OD-3 section 2, Appendix M 1.4 and Part 2.1 criterion 2).
-- @phase: expand
--
-- 1. A suspended child is paused at the identity layer, not on one read.
--    0110 wrote profiles.suspended_at when a child's last verified guardian
--    link disappeared, and only GET /auth/me read it, so a direct API client
--    or a tab that never called /me again kept a working session. Now the
--    same trigger also bans the kid-role account at GoTrue
--    (auth.users.banned_until, so password sign-in and refresh are refused)
--    and deletes its GoTrue sessions and refresh tokens; a newly verified
--    link lifts exactly that ban. Core refuses every remaining access token
--    (requireActiveAccount). Only kid-role accounts are banned: a
--    self-registered teen keeps Option B (a personal account without a
--    parent) even when a guardian link it invited goes away.
--
--    The ban is a fixed far-future timestamp, not 'infinity': GoTrue scans
--    banned_until into a Go time value, and an infinite timestamp would make
--    the user unreadable (sign-in would fail with a server error instead of a
--    clean "banned", and every admin call on the account would fail). The
--    sentinel also marks the ban as this lifecycle's, so reactivation never
--    lifts a ban set for another reason. GoTrue's columns are read
--    dynamically so the chain still applies on the native verifiers' shims.
--
-- 2. list_expired_kid_suspensions: the scheduled 90-day purge. The FAQ
--    promises erasure 90 days into a pause; the purge only ran when the child
--    signed in again. Core's daily account-deletion sweep now reads the
--    kid-role accounts suspended at least 90 days ago with no verified link
--    and no open deletion request, and erases each through the E.6 lifecycle.
--    The window cannot be asked for below 90 days.
--
-- 3. guard_parent_verification_age: a verified ID check (local-ocr) cannot be
--    recorded for a kid-role account, an account with an under-13 origin, or
--    an account whose effective declared band is under 13 or 13 to 17. A
--    self-typed ID check used to override the locked age record (E.4) and
--    grant the parent role, which then switched off the Mentor's minor
--    safeguards (OD-3 section 2: safeguards follow age, not role). Core
--    refuses first (AGE_RECORD_MINOR); this is the database's backstop.
--
-- 4. identity_metrics: faqCapabilities.cancellationCascade now also requires
--    the suspension triggers with the ban, the scheduled candidate read and a
--    sweep run in the last two days that looked for expired suspensions, so
--    the metric no longer reports parity for a deletion that never runs.
--
-- Proven on native PostgreSQL by database/scripts/verify-account-erasure-postgres.py
-- (ban, unban, purge candidates, age guard) and verify-staff-ops-postgres.py (metric).

-- ── 1. The GoTrue ban ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_kid_sign_in_ban(p_user uuid, p_banned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_sentinel constant timestamptz := '9999-12-31 00:00:00+00';
    v_has_ban boolean;
BEGIN
    IF p_user IS NULL THEN RETURN; END IF;
    v_has_ban := to_regclass('auth.users') IS NOT NULL AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute
        WHERE attrelid = 'auth.users'::regclass AND attname = 'banned_until' AND NOT attisdropped);
    IF NOT p_banned THEN
        IF v_has_ban THEN
            EXECUTE 'UPDATE auth.users SET banned_until = NULL WHERE id = $1 AND banned_until = $2' USING p_user, v_sentinel;
        END IF;
        RETURN;
    END IF;
    IF v_has_ban THEN
        EXECUTE 'UPDATE auth.users SET banned_until = $2 WHERE id = $1 AND (banned_until IS NULL OR banned_until < $2)'
            USING p_user, v_sentinel;
    ELSE
        RAISE WARNING 'set_kid_sign_in_ban: auth.users has no banned_until column; sign-in is refused by Core only';
    END IF;
    -- GoTrue keeps refresh_tokens.user_id as text.
    IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
        EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id = $1' USING p_user::text;
    END IF;
    IF to_regclass('auth.sessions') IS NOT NULL THEN
        EXECUTE 'DELETE FROM auth.sessions WHERE user_id = $1' USING p_user;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_kid_sign_in_ban(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- 0110's body, plus the ban for a kid-role account.
CREATE OR REPLACE FUNCTION public.suspend_unlinked_kid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.verification_status = 'verified' OR OLD.verification_status <> 'verified' THEN
        RETURN OLD;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.guardian_links gl
        WHERE gl.kid_user_id = OLD.kid_user_id AND gl.verification_status = 'verified'
    ) THEN
        UPDATE public.profiles SET suspended_at = coalesce(suspended_at, now()), updated_at = now()
            WHERE user_id = OLD.kid_user_id;
        IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = OLD.kid_user_id AND r.role = 'kid') THEN
            PERFORM public.set_kid_sign_in_ban(OLD.kid_user_id, true);
        END IF;
    END IF;
    RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.suspend_unlinked_kid() FROM PUBLIC, anon, authenticated, service_role;

-- 0110's body, plus lifting this lifecycle's ban.
CREATE OR REPLACE FUNCTION public.reactivate_linked_kid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.verification_status <> 'verified' THEN RETURN NEW; END IF;
    UPDATE public.profiles SET suspended_at = NULL, updated_at = now()
        WHERE user_id = NEW.kid_user_id;
    PERFORM public.set_kid_sign_in_ban(NEW.kid_user_id, false);
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reactivate_linked_kid() FROM PUBLIC, anon, authenticated, service_role;

-- Backfill: every kid-role account paused today with no verified link.
SELECT public.set_kid_sign_in_ban(p.user_id, true)
FROM public.profiles p
WHERE p.suspended_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'kid')
  AND NOT EXISTS (SELECT 1 FROM public.guardian_links gl WHERE gl.kid_user_id = p.user_id AND gl.verification_status = 'verified');

-- ── 2. The scheduled 90-day purge's candidates ─────────────────────────────
CREATE OR REPLACE FUNCTION public.list_expired_kid_suspensions(p_older_than_days int, p_limit int)
RETURNS TABLE (user_id uuid, suspended_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_older_than_days IS NULL OR p_older_than_days < 90 THEN
        RAISE EXCEPTION 'SUSPENSION_WINDOW_TOO_SHORT: a paused child is kept for at least 90 days' USING ERRCODE = '22023';
    END IF;
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
        RAISE EXCEPTION 'SUSPENSION_LIMIT_INVALID: 1 to 200' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    SELECT p.user_id, p.suspended_at
    FROM public.profiles p
    WHERE p.suspended_at IS NOT NULL
      AND p.suspended_at <= now() - make_interval(days => p_older_than_days)
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'kid')
      AND NOT EXISTS (SELECT 1 FROM public.guardian_links gl
                      WHERE gl.kid_user_id = p.user_id AND gl.verification_status = 'verified')
      AND NOT EXISTS (SELECT 1 FROM public.account_deletion_requests d
                      WHERE d.subject_id = p.user_id AND d.status IN ('pending', 'processing', 'held'))
    ORDER BY p.suspended_at ASC, p.user_id ASC
    LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.list_expired_kid_suspensions(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_expired_kid_suspensions(int, int) TO service_role;

-- ── 3. A verified ID check never outranks a minor's age record ─────────────
CREATE OR REPLACE FUNCTION public.guard_parent_verification_age()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.status <> 'verified' OR NEW.method <> 'local-ocr' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = NEW.status AND OLD.method = NEW.method AND OLD.user_id = NEW.user_id THEN
        RETURN NEW;
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = NEW.user_id AND r.role = 'kid')
       OR EXISTS (SELECT 1 FROM public.account_safety_origins o WHERE o.user_id = NEW.user_id)
       OR coalesce(public.effective_age_band(NEW.user_id), '') IN ('under_13', '13_to_17') THEN
        RAISE EXCEPTION 'AGE_RECORD_MINOR: the account''s age record is a minor''s; only staff review changes it'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_parent_verification_age() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_guard_parent_verification_age ON public.parent_verifications;
CREATE TRIGGER trg_guard_parent_verification_age
    BEFORE INSERT OR UPDATE ON public.parent_verifications
    FOR EACH ROW EXECUTE FUNCTION public.guard_parent_verification_age();

-- ── 4. identity_metrics: 0196's body; only cancellationCascade changes ─────
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

SELECT 'migration_identity_enforcement_ok' AS sentinel;
