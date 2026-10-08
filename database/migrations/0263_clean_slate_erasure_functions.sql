-- clean_slate_erasure_functions — account erasure and three more shared functions stop reading the removed objects (2 of 3).
-- @phase: contract
-- @after-release: the clean-slate Core that removed the family console, tasks, family wallet and teen wallet
--
-- See clean_slate_identity_functions. Each function is its latest definition
-- minus only the statements that touched a removed table.
--
-- erase_account_data: task evidence is no longer inventoried for the Depot
-- (the tasks table is gone); every other step, count and audit row is unchanged.
-- guard_guardian_link_state: a link can no longer be self-invited (guardian
-- invites are gone), so v_self_invited is constant false. A new invite_id is
-- refused here, as the foreign key to guardian_invites refused it while no
-- such invite existed; without that, dropping the key would let any uuid
-- re-open a rejected or revoked link. Every other transition rule is unchanged.
-- social_messaging_surfaces: the reviewed list loses the columns of removed tables.
-- learning_narrative_metrics: the five bridge_* keys stay in the result as 0.

CREATE OR REPLACE FUNCTION public.erase_account_data(p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
    v_req public.account_deletion_requests%ROWTYPE;
    v_subject uuid;
    v_email text;
    v_candidates text[];
    v_remaining text[];
    v_anon uuid[];
    v_counts jsonb := '{}'::jsonb;
    v_n bigint;
    v_gotrue_audit bigint;
BEGIN
    SELECT * INTO v_req FROM public.account_deletion_requests WHERE id = p_request FOR UPDATE;
    IF NOT FOUND OR v_req.status <> 'processing' THEN
        RAISE EXCEPTION 'ERASURE_NOT_CLAIMED' USING ERRCODE = 'P0001';
    END IF;
    IF v_req.steps ? 'core' THEN
        RETURN v_req.steps -> 'core';
    END IF;
    v_subject := v_req.subject_id;

    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_subject;
    IF NOT FOUND THEN
        -- Already gone (for example removed by an operator through GoTrue):
        -- nothing left here, and the other services still run their steps.
        v_counts := jsonb_build_object('account', 0);
        UPDATE public.account_deletion_requests
            SET steps = steps || jsonb_build_object('core', v_counts), last_error = NULL
            WHERE id = p_request;
        RETURN v_counts;
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_subject AND role IN ('admin', 'superadmin')) THEN
        RAISE EXCEPTION 'STAFF_ACCOUNT' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Inventory.
    SELECT COALESCE(array_agg(DISTINCT x.path), ARRAY[]::text[]) INTO v_candidates FROM (
        SELECT t.audio_path AS path
            FROM public.tutor_turns t JOIN public.tutor_sessions s ON s.id = t.session_id
            WHERE s.user_id = v_subject AND t.audio_path IS NOT NULL
        UNION ALL
        SELECT b.image_bucket || '/' || b.image_hash || '.' || b.image_ext
            FROM public.badge_shares b
            WHERE b.kid_user_id = v_subject OR b.created_by = v_subject
    ) x;
    SELECT COALESCE(array_agg(v.anon_id), ARRAY[]::uuid[]) INTO v_anon
        FROM public.anon_visitors v WHERE v.converted_user_id = v_subject;

    -- 3. Rows about this person that do not cascade.
    DELETE FROM public.learner_memory_ledger WHERE user_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('learner_memory_ledger', v_n);
    DELETE FROM public.anon_visitors WHERE converted_user_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('anon_visitors', v_n);
    DELETE FROM public.email_logs
        WHERE user_id = v_subject
           OR (v_email IS NOT NULL AND lower(to_address) = lower(v_email));
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('email_logs', v_n);

    -- 4. Trigger-bearing rows, while the account still exists.
    DELETE FROM public.follows WHERE follower_id = v_subject OR followed_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('follows', v_n);
    DELETE FROM public.blocks WHERE blocker_id = v_subject OR blocked_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('blocks', v_n);
    DELETE FROM public.guardian_links WHERE parent_user_id = v_subject OR kid_user_id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('guardian_links', v_n);
    UPDATE public.tutor_voice_consent SET revoked_at = now()
        WHERE granted_by = v_subject AND user_id <> v_subject AND revoked_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('voice_consents_ended', v_n);
    UPDATE public.user_roles SET granted_by = NULL WHERE granted_by = v_subject AND user_id <> v_subject;
    UPDATE public.admin_permissions SET granted_by = NULL WHERE granted_by = v_subject AND user_id <> v_subject;
    DELETE FROM public.admin_permissions WHERE user_id = v_subject;
    DELETE FROM public.user_roles WHERE user_id = v_subject;

    -- 5. GoTrue's audit trail, then the account.
    BEGIN
        DELETE FROM auth.audit_log_entries WHERE payload ->> 'actor_id' = v_subject::text;
        GET DIAGNOSTICS v_gotrue_audit = ROW_COUNT;
    EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
        v_gotrue_audit := -1;
    END;
    v_counts := v_counts || jsonb_build_object('gotrue_audit_entries', v_gotrue_audit);

    DELETE FROM auth.users WHERE id = v_subject;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN
        RAISE EXCEPTION 'ERASURE_ACCOUNT_NOT_DELETED' USING ERRCODE = 'P0001';
    END IF;
    v_counts := v_counts || jsonb_build_object('account', 1);

    -- 6. Depot objects nobody else still references.
    SELECT COALESCE(array_agg(c.path ORDER BY c.path), ARRAY[]::text[]) INTO v_remaining
        FROM unnest(v_candidates) AS c(path)
        WHERE NOT EXISTS (SELECT 1 FROM public.tutor_turns t WHERE t.audio_path = c.path)
          AND NOT EXISTS (SELECT 1 FROM public.badge_shares b
                WHERE b.image_bucket || '/' || b.image_hash || '.' || b.image_ext = c.path);
    v_counts := v_counts || jsonb_build_object(
        'depot_objects', COALESCE(array_length(v_remaining, 1), 0),
        'depot_shared_kept', COALESCE(array_length(v_candidates, 1), 0) - COALESCE(array_length(v_remaining, 1), 0),
        'anon_ids', COALESCE(array_length(v_anon, 1), 0));

    UPDATE public.account_deletion_requests
        SET steps = steps || jsonb_build_object('core', v_counts),
            depot_paths = to_jsonb(v_remaining),
            anon_ids = to_jsonb(v_anon),
            last_error = NULL
        WHERE id = p_request;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'account.erased', v_subject::text,
            jsonb_build_object('request_id', p_request, 'population', v_req.population, 'counts', v_counts));
    RETURN v_counts;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_guardian_link_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
    v_changed text[];
    v_others  boolean;
    v_self_invited boolean;
    v_staff_revocation boolean;
BEGIN
    -- A.5: an adult whose verification was revoked never enters a link again.
    IF NEW.verification_status IN ('pending', 'verified')
       AND (TG_OP = 'INSERT' OR OLD.verification_status IS DISTINCT FROM NEW.verification_status)
       AND public.tutor_verification_revoked(NEW.parent_user_id) THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_TUTOR_REVOKED' USING ERRCODE = 'P0001';
    END IF;

    -- Guardian invites are gone, so no link can name a new one. The foreign
    -- key on invite_id refused it until the invites table was dropped.
    IF NEW.invite_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.invite_id IS DISTINCT FROM OLD.invite_id) THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_REINVITE_INVALID' USING ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.verification_status NOT IN ('pending', 'verified')
           OR (NEW.verification_status = 'verified' AND NEW.verified_at IS NULL)
           OR (NEW.verification_status = 'pending' AND NEW.verified_at IS NOT NULL)
           OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[]
       OR public.family_only_nulled(v_changed, ARRAY['invite_id', 'decided_by', 'revoked_by'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'parent_user_id', 'kid_user_id', 'created_at'] THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;

    v_others := EXISTS (
        SELECT 1 FROM public.guardian_links
        WHERE kid_user_id = NEW.kid_user_id AND id <> NEW.id AND verification_status = 'verified'
    );
    v_self_invited := false;
    -- Set only by end_revoked_tutor_powers, for the one adult it ends.
    v_staff_revocation := coalesce(current_setting('lf.tutor_revocation', true), '') = NEW.parent_user_id::text;

    IF OLD.verification_status = 'pending' AND NEW.verification_status IN ('verified', 'rejected')
       AND NEW.decided_by IS NOT NULL THEN
        IF NEW.decided_by = NEW.parent_user_id OR NEW.decided_at IS NULL
           OR (NEW.verification_status = 'verified' AND NEW.verified_at IS NULL)
           OR (NEW.verification_status = 'rejected' AND NEW.verified_at IS NOT NULL)
           OR (v_self_invited AND (NEW.decided_by <> NEW.kid_user_id OR NOT public.teen_wallet_holder(NEW.kid_user_id)))
           OR (NOT v_self_invited AND NOT public.family_is_verified_guardian(NEW.decided_by, NEW.kid_user_id)) THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_DECISION_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF OLD.verification_status = 'verified' AND NEW.verification_status = 'revoked' THEN
        -- The guardian stepping away names themself; a staff revocation of
        -- the adult's verification names the staff member (or no one, for
        -- the backfill of a revocation whose staff account is gone).
        IF NEW.revoked_at IS NULL
           OR (NOT v_staff_revocation AND NEW.revoked_by IS DISTINCT FROM NEW.parent_user_id) THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_REVOCATION_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF OLD.verification_status IN ('pending', 'rejected', 'revoked') AND NEW.verification_status = 'pending' THEN
        IF NEW.invite_id IS NULL OR NEW.invite_id IS NOT DISTINCT FROM OLD.invite_id OR NEW.verified_at IS NOT NULL
           OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_REINVITE_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF OLD.verification_status IN ('pending', 'rejected', 'revoked') AND NEW.verification_status = 'verified' THEN
        IF v_others OR v_self_invited OR NEW.invite_id IS NULL OR NEW.invite_id IS NOT DISTINCT FROM OLD.invite_id OR NEW.verified_at IS NULL
           OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_REINVITE_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSE
        RAISE EXCEPTION 'GUARDIAN_LINK_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
            DETAIL = format('%s -> %s', OLD.verification_status, NEW.verification_status);
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_messaging_surfaces()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
    WITH vocabulary(word) AS (
        SELECT unnest(ARRAY['message', 'messages', 'messaging', 'chat', 'chats', 'chatroom', 'chatrooms',
            'comment', 'comments', 'conversation', 'conversations', 'inbox', 'outbox', 'dm', 'dms',
            'directmessage', 'directmessages', 'thread', 'threads', 'reply', 'replies', 'mention', 'mentions',
            'whisper', 'whispers', 'guestbook', 'shoutout', 'shoutouts', 'reaction', 'reactions',
            'sticker', 'stickers', 'pm', 'pms', 'mailbox', 'wallpost', 'wallposts', 'poke', 'pokes',
            'greeting', 'greetings'])
    ), reviewed(name) AS (
        SELECT unnest(ARRAY[
            'column:email_logs.message_id', 'function:social_messaging_surfaces',
            'text:analytics_ip_exclusions.label', 'text:analytics_ip_exclusions.reason',
            'text:badge_shares.achievement_label', 'text:badge_shares.first_name', 'text:badge_shares.image_bucket',
            'text:badge_shares.image_ext', 'text:badge_shares.image_url',
            'text:data_practice_consents.practice_key',
            'text:learner_memory_proposals.expected_before', 'text:learner_memory_proposals.proposed',
            'text:lesson_pedagogical_reviews.checks',
            'text:mentor_quality_flag.dedup_key', 'text:mentor_quality_flag.resolution_note',
            'text:social_reports.note',
            'text:tutor_voice_consent.consent_text', 'text:tutor_voice_consent.scope'])
    ), named AS (
        SELECT CASE c.relkind WHEN 'v' THEN 'view:' WHEN 'm' THEN 'view:' ELSE 'table:' END || c.relname AS name, c.relname AS token_source
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
        UNION ALL
        SELECT 'column:' || c.relname || '.' || a.attname, a.attname
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
        UNION ALL
        SELECT 'function:' || p.proname, p.proname
        FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
    ), by_vocabulary AS (
        SELECT DISTINCT named.name FROM named
        WHERE EXISTS (SELECT 1 FROM regexp_split_to_table(lower(named.token_source), '_') AS token
            WHERE token IN (SELECT word FROM vocabulary))
    ), account_refs AS (
        SELECT con.conrelid, unnest(con.conkey) AS attnum
        FROM pg_catalog.pg_constraint con
        WHERE con.contype = 'f'
          AND con.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
    ), multi_account AS (
        SELECT conrelid FROM account_refs GROUP BY conrelid HAVING count(DISTINCT attnum) >= 2
    ), by_structure AS (
        SELECT 'text:' || c.relname || '.' || a.attname AS name
        FROM multi_account m
        JOIN pg_catalog.pg_class c ON c.oid = m.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        WHERE a.atttypid IN ('text'::regtype, 'varchar'::regtype, 'bpchar'::regtype, 'jsonb'::regtype, 'json'::regtype)
          -- A column held to a closed set (IN list, single literal) or a
          -- pattern by its own CHECK is a code, not free text.
          AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint k
              WHERE k.conrelid = c.oid AND k.contype = 'c' AND k.conkey = ARRAY[a.attnum]
                AND pg_catalog.pg_get_constraintdef(k.oid) ~ '(= ANY|~|= ''[^'']*''::text)')
    )
    SELECT coalesce(jsonb_agg(name ORDER BY name), '[]'::jsonb)
    FROM (SELECT name FROM by_vocabulary UNION SELECT name FROM by_structure) found
    WHERE name NOT IN (SELECT name FROM reviewed);
$$;

CREATE OR REPLACE FUNCTION public.learning_narrative_metrics(p_since timestamp with time zone, p_until timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    WITH v1_decisions AS (
        SELECT DISTINCT a.user_id, a.lesson_id, a.segment_id
        FROM public.lesson_segment_attempts a
        WHERE a.created_at >= p_since AND a.created_at < p_until
          AND EXISTS (
              SELECT 1
              FROM public.lesson_documents d
              CROSS JOIN LATERAL jsonb_array_elements(public.learning_json_array(d.document -> 'segments')) s
              WHERE d.lesson_id = a.lesson_id AND s ->> 'id' = a.segment_id
                AND public.learning_story_decision_segment(s))
    ),
    v2_decisions AS (
        SELECT DISTINCT r.user_id, run.lesson_id, r.segment_id
        FROM public.lesson_v2_grade_receipts r
        JOIN public.lesson_v2_runs run ON run.id = r.run_id
        JOIN public.lesson_document_versions v ON v.id = r.document_version_id
        WHERE r.created_at >= p_since AND r.created_at < p_until
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(public.learning_json_array(v.document -> 'segments')) s
              WHERE s ->> 'id' = r.segment_id AND public.learning_story_decision_segment(s))
    ),
    decisions AS (
        SELECT user_id, lesson_id, segment_id FROM v1_decisions
        UNION
        SELECT user_id, lesson_id, segment_id FROM v2_decisions
    ),
    classified AS (
        SELECT public.data_practice_applies(d.user_id, 'learning.decision_journal') AS applies,
               EXISTS (SELECT 1 FROM public.learner_decision_journal j
                       WHERE j.user_id = d.user_id AND j.lesson_id = d.lesson_id AND j.segment_id = d.segment_id) AS journaled
        FROM decisions d
    )
    SELECT jsonb_build_object(
        'journal_entries_recorded', (
            SELECT count(*) FROM public.learner_decision_journal j
            WHERE j.first_recorded_at >= p_since AND j.first_recorded_at < p_until),
        'journal_entries_resurfaced', (
            SELECT count(*) FROM public.learner_decision_journal j
            WHERE j.first_recorded_at >= p_since AND j.first_recorded_at < p_until
              AND EXISTS (SELECT 1 FROM public.learner_decision_resurfacings r WHERE r.entry_id = j.id)),
        'story_decisions_made', (SELECT count(*) FROM classified c WHERE c.applies),
        'story_decisions_journaled', (SELECT count(*) FROM classified c WHERE c.applies AND c.journaled),
        'story_decisions_without_consent', (SELECT count(*) FROM classified c WHERE NOT c.applies),
        'bridge_prompts_offered', 0,
        'bridge_prompts_converted_7d', 0,
        'bridge_self_commitments', 0,
        'bridge_prompts_dismissed', 0,
        'bridge_prompts_expired', 0
    );
$$;
