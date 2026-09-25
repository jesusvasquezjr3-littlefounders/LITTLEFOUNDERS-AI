-- @phase: expand
-- E.10, E.11 and E.12 standing guardrails (S08.7). Policy:
-- docs/rebuild/policies/SOCIAL-GOVERNANCE.md.
--
-- Additive half. It adds two write guards, the retention windows, the
-- consented-edge rule, the messaging-surface scan and a service-only metric.
-- The guards refuse only shapes no deployed writer produces: Core validates
-- the same closed avatar option set and the same ten cover presets before it
-- writes, and no client writes these columns any other way through Core. They
-- close the one remaining path around that validation, a direct browser write
-- through the `avatars_upsert_own` / `profiles_update_own` policies, which
-- could store any JSON (a link, a phone number, an image URL) that Core then
-- served to every viewer of the profile. The sweep that deletes expired
-- social-graph rows is the companion migration `social_graph_retention`.

-- ── E.12: the avatar is a cartoon option set, never an image ───────────────
-- Mirrors backend/src/services/profileShape.ts (AVATAR_ARRAY_KEYS,
-- AVATAR_NUMBER_KEYS, the seed and value patterns); `guardrails:check`
-- compares the key lists literally.
CREATE OR REPLACE FUNCTION public.avatar_options_valid(p_options jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
    entry record;
    item jsonb;
BEGIN
    IF p_options IS NULL OR jsonb_typeof(p_options) <> 'object' THEN
        RETURN false;
    END IF;
    FOR entry IN SELECT key, value FROM jsonb_each(p_options) LOOP
        IF entry.key = 'seed' THEN
            IF jsonb_typeof(entry.value) <> 'string' OR (entry.value #>> '{}') !~ '^[A-Za-z0-9_-]{1,64}$' THEN
                RETURN false;
            END IF;
        ELSIF entry.key IN ('facialHairProbability', 'accessoriesProbability') THEN
            IF jsonb_typeof(entry.value) <> 'number' OR (entry.value #>> '{}') !~ '^[0-9]{1,3}$'
               OR (entry.value #>> '{}')::integer > 100 THEN
                RETURN false;
            END IF;
        ELSIF entry.key IN ('top', 'hairColor', 'skinColor', 'eyes', 'eyebrows', 'mouth', 'facialHair', 'clothing', 'clothesColor', 'accessories') THEN
            IF jsonb_typeof(entry.value) <> 'array' OR jsonb_array_length(entry.value) > 3 THEN
                RETURN false;
            END IF;
            FOR item IN SELECT value FROM jsonb_array_elements(entry.value) LOOP
                IF jsonb_typeof(item) <> 'string' OR (item #>> '{}') !~ '^[A-Za-z0-9]{1,40}$' THEN
                    RETURN false;
                END IF;
            END LOOP;
        ELSE
            RETURN false;
        END IF;
    END LOOP;
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.avatar_options_valid(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.avatar_options_valid(jsonb) TO service_role;

-- Mirrors COVER_PRESETS in backend/src/routes/profile.ts and
-- frontend/src/lib/coverPresets.ts: a cover is a token gradient, never an image.
CREATE OR REPLACE FUNCTION public.profile_cover_valid(p_cover jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT p_cover IS NOT NULL AND jsonb_typeof(p_cover) = 'object' AND (
        p_cover = '{}'::jsonb
        OR (p_cover ? 'preset'
            AND (SELECT count(*) FROM jsonb_object_keys(p_cover)) = 1
            AND jsonb_typeof(p_cover -> 'preset') = 'string'
            AND (p_cover ->> 'preset') IN ('aurora', 'sunset', 'ocean', 'forest', 'candy', 'ember', 'midnight', 'mint', 'grape', 'dawn'))
    );
$$;
REVOKE ALL ON FUNCTION public.profile_cover_valid(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_cover_valid(jsonb) TO service_role;

-- A value that was already stored is not re-judged on an unrelated edit: only
-- a changed options/seed/cover value must be valid. Legacy off-schema rows are
-- counted by the metric below and never served (Core projects on read).
CREATE OR REPLACE FUNCTION public.guard_avatar_shape()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR NEW.options IS DISTINCT FROM OLD.options)
       AND NOT public.avatar_options_valid(NEW.options) THEN
        RAISE EXCEPTION 'AVATAR_OPTIONS_INVALID' USING ERRCODE = 'P0001', DETAIL = 'options';
    END IF;
    IF (TG_OP = 'INSERT' OR NEW.seed IS DISTINCT FROM OLD.seed)
       AND NOT (coalesce(NEW.seed, '') = '' OR NEW.seed ~ '^[A-Za-z0-9_-]{1,64}$') THEN
        RAISE EXCEPTION 'AVATAR_OPTIONS_INVALID' USING ERRCODE = 'P0001', DETAIL = 'seed';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_avatar_shape() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER avatar_shape_guard
BEFORE INSERT OR UPDATE OF options, seed ON public.avatars
FOR EACH ROW EXECUTE FUNCTION public.guard_avatar_shape();

CREATE OR REPLACE FUNCTION public.guard_profile_cover()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR NEW.cover IS DISTINCT FROM OLD.cover)
       AND NOT public.profile_cover_valid(NEW.cover) THEN
        RAISE EXCEPTION 'PROFILE_COVER_INVALID' USING ERRCODE = 'P0001', DETAIL = 'cover';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_cover() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER profile_cover_guard
BEFORE INSERT OR UPDATE OF cover ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_cover();

-- ── E.11: social-graph retention windows ────────────────────────────────────
-- One definition, read by the sweep (social_graph_retention), the metric below
-- and Core's metric route. `guardrails:check` compares every value with the
-- policy table and with Core.
CREATE OR REPLACE FUNCTION public.social_retention_windows()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT jsonb_build_object(
        'pendingRequestDays', 30,
        'closedRequestDays', 30,
        'reportNoteDays', 90,
        'resolvedReportDays', 365,
        'resolvedCaseDays', 365,
        'readNoticeDays', 90,
        'unreadNoticeDays', 365
    );
$$;
REVOKE ALL ON FUNCTION public.social_retention_windows() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_retention_windows() TO service_role;

-- Social-graph audit entries have no window here: public.audit_logs is
-- append-only (README non-negotiables), so the sweep never deletes from it.
-- An expiry for them is an owner decision (policy §8), not a migration.

-- A child for the E.11 disclosure rule: the guardian tier (a `kid` role or a
-- linked under-13 origin) or an under-13 origin no guardian has linked yet.
-- The second kind is `closed` for the social layer, but it is still a child:
-- a follow made before the tiers existed must not keep exposing it.
CREATE OR REPLACE FUNCTION public.social_child_account(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'kid')
        OR EXISTS (SELECT 1 FROM public.account_safety_origins WHERE user_id = p_user)
        OR public.social_tier(p_user) = 'guardian'
    );
$$;
REVOKE ALL ON FUNCTION public.social_child_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_child_account(uuid) TO service_role;

-- E.11 disclosure rule: an edge that exposes a child to another account exists
-- only inside the child's family or through that account's own request, which
-- a CURRENT verified guardian of the child approved (the same test the follow
-- admission trigger applies to a new edge: social_guardian_is_current).
-- Account-creation consent never covers it. A teen's legacy inbound edges are
-- the teen's to remove (S08.6), so the rule speaks only for children.
CREATE OR REPLACE FUNCTION public.social_edge_consented(p_follower uuid, p_followed uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT public.social_family(p_follower, p_followed) OR (
        (NOT public.social_child_account(p_followed)
            OR EXISTS (SELECT 1 FROM public.social_connection_requests request
                WHERE request.requester_id = p_follower AND request.kid_user_id = p_followed
                  AND request.status = 'approved'
                  AND public.social_guardian_is_current(request.decided_by, p_followed)))
        AND (NOT public.social_child_account(p_follower)
            OR EXISTS (SELECT 1 FROM public.social_connection_requests request
                WHERE request.requester_id = p_followed AND request.kid_user_id = p_follower
                  AND request.status = 'approved'
                  AND public.social_guardian_is_current(request.decided_by, p_follower)))
    );
$$;
REVOKE ALL ON FUNCTION public.social_edge_consented(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_edge_consented(uuid, uuid) TO service_role;

-- ── E.10: no person-to-person messaging surface in the schema ─────────────
-- A tripwire over the LIVE catalog, so an object created out of band (a
-- dashboard edit, a hand-run script) is caught as surely as a migration.
-- Two rules:
--   vocabulary  a table, view, column or function whose name carries a
--               messaging word (the same list as `guardrails:check` and
--               Core's route test);
--   structure   a free-text or JSON column in a table that references two or
--               more accounts: the shape of anything one person writes for
--               another, whatever it is called.
-- Reviewed channels (policy §2.2) are listed below and nowhere else in SQL.
-- The answer is the list of UNREVIEWED objects; empty means compliant.
CREATE OR REPLACE FUNCTION public.social_messaging_surfaces()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
            'text:banking_accounts.display_number', 'text:banking_accounts.nickname',
            'text:guardian_invites.token',
            'text:learner_memory_proposals.expected_before', 'text:learner_memory_proposals.proposed',
            'text:social_reports.note',
            'text:tasks.cancel_reason', 'text:tasks.evidence_bucket', 'text:tasks.evidence_hash', 'text:tasks.title',
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
REVOKE ALL ON FUNCTION public.social_messaging_surfaces() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_messaging_surfaces() TO service_role;

-- ── Appendix J metrics for E.10, E.11 and E.12 (counts and schema names only)
CREATE OR REPLACE FUNCTION public.social_governance_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    w jsonb := public.social_retention_windows();
    last_at timestamptz;
    last_detail jsonb;
    result jsonb;
BEGIN
    SELECT created_at, detail INTO last_at, last_detail FROM public.audit_logs
        WHERE action = 'social_retention.sweep_ran' ORDER BY id DESC LIMIT 1;
    result := jsonb_build_object(
        'windows', w,
        'overdue', jsonb_build_object(
            'teenPending', (SELECT count(*) FROM public.social_consent_requests WHERE status = 'pending'
                AND requested_at < now() - make_interval(days => (w ->> 'pendingRequestDays')::integer)),
            'guardianPending', (SELECT count(*) FROM public.social_connection_requests WHERE status = 'pending'
                AND requested_at < now() - make_interval(days => (w ->> 'pendingRequestDays')::integer)),
            'teenClosed', (SELECT count(*) FROM public.social_consent_requests WHERE status IN ('declined', 'withdrawn', 'removed')
                AND coalesce(decided_at, requested_at) < now() - make_interval(days => (w ->> 'closedRequestDays')::integer)),
            'guardianClosed', (SELECT count(*) FROM public.social_connection_requests WHERE status IN ('denied', 'revoked')
                AND coalesce(decided_at, requested_at) < now() - make_interval(days => (w ->> 'closedRequestDays')::integer)),
            'reportNotes', (SELECT count(*) FROM public.social_reports WHERE status = 'resolved' AND note IS NOT NULL
                AND resolved_at < now() - make_interval(days => (w ->> 'reportNoteDays')::integer)),
            'resolvedReports', (SELECT count(*) FROM public.social_reports WHERE status = 'resolved'
                AND resolved_at < now() - make_interval(days => (w ->> 'resolvedReportDays')::integer)),
            'resolvedCases', (SELECT count(*) FROM public.social_review_cases WHERE status = 'resolved'
                AND resolved_at < now() - make_interval(days => (w ->> 'resolvedCaseDays')::integer)),
            'notices', (SELECT count(*) FROM public.social_safety_notices
                WHERE read_at < now() - make_interval(days => (w ->> 'readNoticeDays')::integer)
                   OR created_at < now() - make_interval(days => (w ->> 'unreadNoticeDays')::integer))
        ),
        'unconsentedChildEdges', (SELECT count(*) FROM public.follows f
            WHERE (public.social_child_account(f.follower_id) OR public.social_child_account(f.followed_id))
              AND NOT public.social_edge_consented(f.follower_id, f.followed_id)),
        'messagingSurfaces', public.social_messaging_surfaces(),
        'offSchema', jsonb_build_object(
            'avatars', (SELECT count(*) FROM public.avatars
                WHERE NOT public.avatar_options_valid(options)
                   OR NOT (coalesce(seed, '') = '' OR seed ~ '^[A-Za-z0-9_-]{1,64}$')),
            'covers', (SELECT count(*) FROM public.profiles WHERE NOT public.profile_cover_valid(cover))
        ),
        'lastSweep', CASE WHEN last_at IS NULL THEN NULL
            ELSE jsonb_build_object('at', last_at, 'counts', last_detail) END
    );
    RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.social_governance_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_governance_metrics() TO service_role;
