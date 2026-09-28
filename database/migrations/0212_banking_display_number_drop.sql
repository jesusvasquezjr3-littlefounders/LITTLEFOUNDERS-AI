-- banking_display_number_drop — D.7 (no unbacked real-card guarantee),
-- F1-family part 2 of 2 (contract). The card-shaped practice number
-- (`LF-1234-5678`) is gone: Core no longer mints, stores or serves it, and no
-- rebuilt surface ever showed it. This drops banking_accounts.display_number
-- and the two places that still named it:
--
--   1. guard_banking_account_state() (latest body: 0149) compared it as an
--      immutable field; a PL/pgSQL body naming a dropped column fails at run
--      time, so the guard is redefined first, identical except that clause.
--   2. social_messaging_surfaces() (latest body: 0192) listed
--      'text:banking_accounts.display_number' as a reviewed name; the entry
--      is removed here and from docs/rebuild/policies/SOCIAL-GOVERNANCE.md
--      section 2.2 (guardrails:check keeps the two equal). Same signature,
--      grants and return shape as 0192; the vocabulary, the structure rule and
--      every other reviewed name are unchanged.
--
-- @phase: contract
-- @after-release: the Core release that stops writing display_number
--   (F1-family: supabaseRest.insertBankingAccount no longer sends it and
--   BANKING_ACCOUNT_FIELDS no longer selects it). An older Core still names
--   the column in both, and PostgREST would reject its account reads and
--   inserts. Apply after banking_display_number_optional.
--
-- Evidence: docs/rebuild/sprints/GAP-FIX-R1.md (F1-family.3).

-- ── 1. The account guard, without the retired number ────────────────────────
CREATE OR REPLACE FUNCTION public.guard_banking_account_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.opened_by <> NEW.kid_user_id AND NOT public.family_is_verified_guardian(NEW.opened_by, NEW.kid_user_id) THEN
            RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.frozen OR NEW.frozen_by IS NOT NULL OR NEW.frozen_at IS NOT NULL THEN
            RAISE EXCEPTION 'ACCOUNT_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.kid_user_id IS DISTINCT FROM OLD.kid_user_id
       OR NEW.opened_by IS DISTINCT FROM OLD.opened_by OR NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
        RAISE EXCEPTION 'ACCOUNT_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.frozen IS DISTINCT FROM OLD.frozen OR NEW.frozen_by IS DISTINCT FROM OLD.frozen_by
       OR NEW.frozen_at IS DISTINCT FROM OLD.frozen_at THEN
        IF NEW.frozen_by IS NULL OR (NEW.frozen_by <> NEW.kid_user_id
                                     AND NOT public.family_is_verified_guardian(NEW.frozen_by, NEW.kid_user_id)) THEN
            RAISE EXCEPTION 'FREEZE_ACTOR_INVALID' USING ERRCODE = 'P0001';
        END IF;
        -- A freeze placed by anyone but the child (or with no recorded owner)
        -- belongs to the guardians: the child can neither lift it nor re-own it.
        IF OLD.frozen AND OLD.frozen_by IS DISTINCT FROM OLD.kid_user_id AND NEW.frozen_by = NEW.kid_user_id THEN
            RAISE EXCEPTION 'FREEZE_OWNED_BY_GUARDIAN' USING ERRCODE = 'P0001';
        END IF;
        IF (NEW.frozen AND NEW.frozen_at IS NULL) OR (NOT NEW.frozen AND NEW.frozen_at IS NOT NULL) THEN
            RAISE EXCEPTION 'ACCOUNT_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_banking_account_state() FROM PUBLIC, anon, authenticated, service_role;

-- ── 2. The E.10 messaging scan, without the retired reviewed name ───────────
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
            'text:banking_accounts.nickname',
            'text:data_practice_consents.practice_key',
            'text:family_autonomy_changes.reason', 'text:family_decisions.prior_status', 'text:family_decisions.reason',
            'text:guardian_invites.token',
            'text:learner_memory_proposals.expected_before', 'text:learner_memory_proposals.proposed',
            'text:mentor_quality_flag.dedup_key', 'text:mentor_quality_flag.resolution_note',
            'text:redemptions.child_note',
            'text:share_destinations.title', 'text:share_gifts.note',
            'text:social_reports.note',
            'text:tasks.cancel_reason', 'text:tasks.child_note', 'text:tasks.evidence_bucket', 'text:tasks.evidence_hash', 'text:tasks.title',
            'text:tutor_voice_consent.consent_text', 'text:tutor_voice_consent.scope',
            'text:wallet_guardian_actions.reason'])
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

-- ── 3. The column ───────────────────────────────────────────────────────────
ALTER TABLE public.banking_accounts DROP COLUMN IF EXISTS display_number;

SELECT 'migration_banking_display_number_drop_ok' AS sentinel;
