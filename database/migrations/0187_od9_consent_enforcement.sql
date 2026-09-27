-- od9_consent_enforcement — S10.3 (OD-9 section 4.2): parental consent
-- carries over only for the practices it covered, now ENFORCED, not only
-- marked.
-- @phase: expand
--
-- Record: docs/rebuild/sprints/S10-CUTOVER.md. Registry and per-child
-- consents: *_od9_legacy_migration.sql (data_practices,
-- data_practice_consents). Toolkit step that marks migrated children:
-- database/migration-od9/sql/40_consent.sql.
--
-- 1. legacy_consent_subjects: the accounts the OD-9 consent step found to be
--    migrated children (created before the cutover, youngest possible age
--    under 18 or unknown). Written by the toolkit operator only; no browser
--    role and no product path writes it. released_at is set by the toolkit
--    when later age evidence shows an adult.
-- 2. has_data_practice_consent (replaced): a consent counts only while its
--    grantor still may give it: a Tutor grant while the grantor is still a
--    verified guardian of the child; a self grant only for a teen-self
--    practice while the account is a self-registered 13-17 with no verified
--    Tutor. Research defers to the D.22 admission rule.
-- 3. data_practice_applies(subject, practice): the question every consumer
--    asks. True for an account that is not a migrated child, for an adult,
--    and for a migrated child with a live consent. An unknown practice never
--    applies.
-- 4. data_practice_state / data_practice_set_consent: what Core reads and
--    writes for a Tutor (or a teen for themselves). The database decides who
--    may answer and writes the audit row; Core passes the caller as actor.
-- 5. Enforcement at the tables, so Core and Oracle cannot drift from it:
--    BEFORE triggers skip the row (or strip the practice's columns) when the
--    practice does not apply, and refuse a social request or a bridge prompt
--    by name. A skipped write is the practice not applying, never an error.
--
-- Additive only: one table, functions and triggers. Deploy order: apply
-- before the Core release that calls data_practice_state. Until the OD-9
-- consent step runs at the cutover, legacy_consent_subjects is empty and
-- every practice applies exactly as before.

-- ─────────────────────────────────────────────────────────────
-- 1. legacy_consent_subjects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legacy_consent_subjects (
    user_id     uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    age_class   text NOT NULL CHECK (age_class IN ('under_13', 'teen', 'unknown')),
    marked_at   timestamptz NOT NULL DEFAULT now(),
    released_at timestamptz
);
ALTER TABLE public.legacy_consent_subjects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacy_consent_subjects FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.legacy_consent_subjects TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 2. has_data_practice_consent — a consent lapses with its grantor's standing
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.data_practice_has_tutor(p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.guardian_links gl
                   WHERE gl.kid_user_id = p_subject AND gl.verification_status = 'verified');
$$;
REVOKE ALL ON FUNCTION public.data_practice_has_tutor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.data_practice_has_tutor(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.has_data_practice_consent(p_subject uuid, p_practice text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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
            WHEN 'family_research_consents' THEN public.family_research_admitted(p_subject)
            ELSE false
        END
        FROM public.data_practices p
        WHERE p.key = p_practice
    ), false)
$$;
REVOKE ALL ON FUNCTION public.has_data_practice_consent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_data_practice_consent(uuid, text) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. data_practice_applies — the one question a consumer asks
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.data_practice_is_migrated_child(p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_subject IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.legacy_consent_subjects s WHERE s.user_id = p_subject AND s.released_at IS NULL)
       AND NOT COALESCE(public.family_research_is_adult(p_subject), false);
$$;
REVOKE ALL ON FUNCTION public.data_practice_is_migrated_child(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.data_practice_is_migrated_child(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.data_practice_applies(p_subject uuid, p_practice text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.data_practices p WHERE p.key = p_practice)
       AND (NOT public.data_practice_is_migrated_child(p_subject)
            OR public.has_data_practice_consent(p_subject, p_practice));
$$;
REVOKE ALL ON FUNCTION public.data_practice_applies(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.data_practice_applies(uuid, text) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. What Core reads and writes
-- ─────────────────────────────────────────────────────────────
-- self_grantable: the account itself may say yes (a teen-self practice, a
-- self-registered 13-17, no verified Tutor). A Tutor may say yes to every
-- practice whose consent is recorded here; research has its own flow (D.22).
CREATE OR REPLACE FUNCTION public.data_practice_state(p_subject uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT jsonb_build_object(
        'migrated', public.data_practice_is_migrated_child(p_subject),
        'has_tutor', public.data_practice_has_tutor(p_subject),
        'practices', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'key', p.key, 'kind', p.kind, 'requirement', p.requirement, 'version', p.disclosure_version,
                'source', p.consent_source,
                'consented', public.has_data_practice_consent(p_subject, p.key),
                'applies', public.data_practice_applies(p_subject, p.key),
                'grantor', c.grantor_kind, 'since', c.granted_at,
                'self_grantable', p.teen_self_consent AND p.consent_source = 'data_practice_consents'
                                  AND public.wallet_holder_kind(p_subject) = 'teen'
                                  AND NOT public.data_practice_has_tutor(p_subject))
                ORDER BY p.kind, p.key)
            FROM public.data_practices p
            LEFT JOIN public.data_practice_consents c
                   ON c.subject_user_id = p_subject AND c.practice_key = p.key AND c.revoked_at IS NULL
                  AND public.has_data_practice_consent(p_subject, p.key)
        ), '[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.data_practice_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.data_practice_state(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.data_practice_set_consent(p_subject uuid, p_actor uuid, p_practice text, p_grant boolean, p_version int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_practice public.data_practices%ROWTYPE;
    v_self     boolean := p_actor IS NOT NULL AND p_actor = p_subject;
    v_tutor    boolean := public.family_is_verified_guardian(p_actor, p_subject);
    v_active   public.data_practice_consents%ROWTYPE;
    v_found    boolean;
BEGIN
    IF p_subject IS NULL OR p_actor IS NULL OR p_grant IS NULL OR NOT (v_self OR v_tutor) THEN
        RAISE EXCEPTION 'DATA_PRACTICE_NOT_ALLOWED' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_practice FROM public.data_practices WHERE key = p_practice;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DATA_PRACTICE_UNKNOWN' USING ERRCODE = 'P0001';
    END IF;
    IF v_practice.consent_source <> 'data_practice_consents' THEN
        RAISE EXCEPTION 'DATA_PRACTICE_OTHER_FLOW' USING ERRCODE = 'P0001';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_subject FOR UPDATE;
    SELECT * INTO v_active FROM public.data_practice_consents
        WHERE subject_user_id = p_subject AND practice_key = p_practice AND revoked_at IS NULL;
    v_found := FOUND;

    IF NOT p_grant THEN
        -- A no from the Tutor or from the account itself (a child's own no counts).
        IF v_found THEN
            UPDATE public.data_practice_consents SET revoked_at = now(), revoked_by = p_actor WHERE id = v_active.id;
            INSERT INTO public.audit_logs (actor_id, action, subject, detail)
                VALUES (p_actor, 'data_practice.revoked', p_subject::text,
                        jsonb_build_object('practice', p_practice, 'by', CASE WHEN v_self THEN 'self' ELSE 'tutor' END));
        END IF;
        RETURN public.data_practice_state(p_subject);
    END IF;

    IF p_version IS DISTINCT FROM v_practice.disclosure_version THEN
        RAISE EXCEPTION 'DATA_PRACTICE_DISCLOSURE_STALE' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(public.family_research_is_adult(p_subject), false) THEN
        RAISE EXCEPTION 'DATA_PRACTICE_NOT_NEEDED' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_subject AND is_anonymous)
       OR (v_self AND NOT (v_practice.teen_self_consent
                           AND public.wallet_holder_kind(p_subject) = 'teen'
                           AND NOT public.data_practice_has_tutor(p_subject))) THEN
        RAISE EXCEPTION 'DATA_PRACTICE_NOT_ALLOWED' USING ERRCODE = 'P0001';
    END IF;
    IF v_found AND public.has_data_practice_consent(p_subject, p_practice) THEN
        RETURN public.data_practice_state(p_subject);
    END IF;
    IF v_found THEN
        -- A lapsed consent (its Tutor left, or an older disclosure) is replaced, never revived.
        UPDATE public.data_practice_consents SET revoked_at = now(), revoked_by = p_actor WHERE id = v_active.id;
    END IF;
    INSERT INTO public.data_practice_consents (subject_user_id, practice_key, grantor_kind, granted_by, disclosure_version)
        VALUES (p_subject, p_practice, CASE WHEN v_self THEN 'self' ELSE 'tutor' END, p_actor, p_version::smallint);
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (p_actor, 'data_practice.granted', p_subject::text,
                jsonb_build_object('practice', p_practice, 'version', p_version, 'by', CASE WHEN v_self THEN 'self' ELSE 'tutor' END));
    RETURN public.data_practice_state(p_subject);
END;
$$;
REVOKE ALL ON FUNCTION public.data_practice_set_consent(uuid, uuid, text, boolean, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.data_practice_set_consent(uuid, uuid, text, boolean, int) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 5. Enforcement at the tables
-- ─────────────────────────────────────────────────────────────
-- TG_ARGV[0]: the practice key. TG_ARGV[1]: 'user_id' / 'learner_id' (the
-- subject column) or 'session' (the subject is tutor_sessions.user_id).
-- Returns NULL (the row is skipped) when the practice does not apply.
CREATE OR REPLACE FUNCTION public.enforce_data_practice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_subject uuid;
    v_session uuid;
BEGIN
    IF TG_ARGV[1] = 'session' THEN
        v_session := (to_jsonb(NEW) ->> 'session_id')::uuid;
        SELECT s.user_id INTO v_subject FROM public.tutor_sessions s WHERE s.id = v_session;
    ELSE
        v_subject := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
    END IF;
    IF v_subject IS NOT NULL AND NOT public.data_practice_applies(v_subject, TG_ARGV[0]) THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_data_practice() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
    t record;
BEGIN
    FOR t IN SELECT * FROM (VALUES
        ('family_money_events',          'analytics.family_money_events',         'user_id', 'INSERT'),
        ('tutor_telemetry_firing',       'analytics.mentor_behavioral_telemetry', 'session', 'INSERT'),
        ('tutor_turn_honesty',           'analytics.mentor_integrity_evidence',   'session', 'INSERT'),
        ('learner_disposition_profile',  'mentor.disposition_profile',            'user_id', 'INSERT OR UPDATE'),
        ('tutor_session_alliance',       'mentor.alliance_record',                'session', 'INSERT'),
        ('tutor_alliance_renegotiation', 'mentor.alliance_record',                'session', 'INSERT'),
        ('tutor_self_explanation_event', 'mentor.alliance_record',                'session', 'INSERT'),
        ('tutor_review_routing',         'mentor.dialogue_calibration',           'session', 'INSERT'),
        ('tutor_dialogue_calibration',   'mentor.dialogue_calibration',           'session', 'INSERT'),
        ('learner_decision_journal',     'learning.decision_journal',             'user_id', 'INSERT OR UPDATE'),
        ('learner_decision_resurfacings','learning.decision_journal',             'user_id', 'INSERT')
    ) AS v(tbl, practice, subject, ops) LOOP
        IF to_regclass('public.' || t.tbl) IS NOT NULL THEN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t.tbl || '_data_practice', t.tbl);
            EXECUTE format('CREATE TRIGGER %I BEFORE %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_data_practice(%L, %L)',
                           t.tbl || '_data_practice', t.ops, t.tbl, t.practice, t.subject);
        END IF;
    END LOOP;
END $$;

-- learning_events: only the event classes the rebuild introduced.
CREATE OR REPLACE FUNCTION public.enforce_learning_event_practice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_practice text := CASE
        WHEN NEW.event IN ('replay_below_best', 'replay_notice_view') THEN 'analytics.learning_quality_events'
        WHEN NEW.event IN ('streak_rest_day', 'streak_restart', 'path_choice') THEN 'analytics.motivation_events'
        WHEN NEW.event = 'session_heartbeat' THEN 'analytics.engagement_heartbeats'
    END;
BEGIN
    IF v_practice IS NOT NULL AND NEW.user_id IS NOT NULL AND NOT public.data_practice_applies(NEW.user_id, v_practice) THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_learning_event_practice() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS learning_events_data_practice ON public.learning_events;
CREATE TRIGGER learning_events_data_practice BEFORE INSERT ON public.learning_events
    FOR EACH ROW EXECUTE FUNCTION public.enforce_learning_event_practice();

-- Columns a rebuild practice added to an existing row: stripped, never the row.
CREATE OR REPLACE FUNCTION public.enforce_mentor_column_practices()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_TABLE_NAME = 'tutor_sessions' THEN
        IF NEW.telemetry_mode IS NOT NULL
           AND (TG_OP = 'INSERT' OR NEW.telemetry_mode IS DISTINCT FROM OLD.telemetry_mode
                OR NEW.telemetry_evaluated_turns IS DISTINCT FROM OLD.telemetry_evaluated_turns
                OR NEW.telemetry_action_turns IS DISTINCT FROM OLD.telemetry_action_turns)
           AND NOT public.data_practice_applies(NEW.user_id, 'analytics.mentor_behavioral_telemetry') THEN
            NEW.telemetry_mode := NULL;
            NEW.telemetry_evaluated_turns := NULL;
            NEW.telemetry_action_turns := NULL;
        END IF;
    ELSIF TG_TABLE_NAME = 'tutor_trajectory_step' THEN
        IF (NEW.evidence_rule IS NOT NULL OR NEW.mastery_revoked)
           AND NOT public.data_practice_applies(NEW.user_id, 'analytics.mentor_integrity_evidence') THEN
            NEW.evidence_rule := NULL;
            NEW.evidence_observations := NULL;
            NEW.evidence_required := NULL;
            NEW.mastery_revoked := false;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_mentor_column_practices() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tutor_sessions_data_practice ON public.tutor_sessions;
CREATE TRIGGER tutor_sessions_data_practice BEFORE INSERT OR UPDATE ON public.tutor_sessions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_mentor_column_practices();
DROP TRIGGER IF EXISTS tutor_trajectory_step_data_practice ON public.tutor_trajectory_step;
CREATE TRIGGER tutor_trajectory_step_data_practice BEFORE INSERT ON public.tutor_trajectory_step
    FOR EACH ROW EXECUTE FUNCTION public.enforce_mentor_column_practices();

-- Sharing surfaces are refused by name, never skipped silently: the social
-- request keeps its existing opaque refusal (no child's settings leak to the
-- requester); a bridge prompt names the missing consent.
CREATE OR REPLACE FUNCTION public.enforce_sharing_practice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_TABLE_NAME = 'social_connection_requests' THEN
        IF NOT public.data_practice_applies(NEW.kid_user_id, 'sharing.social_connections')
           OR NOT public.data_practice_applies(NEW.requester_id, 'sharing.social_connections') THEN
            RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;
    ELSIF TG_TABLE_NAME = 'learning_bridge_prompts' THEN
        IF NOT public.data_practice_applies(NEW.learner_id, 'sharing.learning_family_bridge') THEN
            RAISE EXCEPTION 'DATA_PRACTICE_CONSENT_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_sharing_practice() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS social_connection_requests_data_practice ON public.social_connection_requests;
CREATE TRIGGER social_connection_requests_data_practice BEFORE INSERT ON public.social_connection_requests
    FOR EACH ROW EXECUTE FUNCTION public.enforce_sharing_practice();
DROP TRIGGER IF EXISTS learning_bridge_prompts_data_practice ON public.learning_bridge_prompts;
CREATE TRIGGER learning_bridge_prompts_data_practice BEFORE INSERT ON public.learning_bridge_prompts
    FOR EACH ROW EXECUTE FUNCTION public.enforce_sharing_practice();

SELECT 'migration_od9_consent_enforcement_ok' AS sentinel;
