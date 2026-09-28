-- od9_merge_reconciliation — the S10 OD-9 lane (0186, 0187) meets E.10's live
-- messaging scan on the integration chain.
-- @phase: expand
--
-- Found by running every native-PostgreSQL verifier over the whole merged
-- chain (verify-social-governance-postgres.py): social_messaging_surfaces()
-- returned ["text:data_practice_consents.practice_key"], so the Appendix J
-- metric (messagingSurfaces, target empty) would have gone red. Evidence:
-- docs/rebuild/sprints/S10-CUTOVER.md ("Local database evidence").
--
-- data_practice_consents references two accounts (the subject and the adult
-- who granted or revoked), so the structure rule treats its free-text columns
-- as messaging until reviewed. practice_key is not free text: it is a
-- foreign key into data_practices (key held to ^[a-z][a-z0-9_.-]{2,63}$ by
-- that table's CHECK), written by the service role only. It is added to the
-- reviewed list here and in docs/rebuild/policies/SOCIAL-GOVERNANCE.md
-- section 2.2; guardrails:check keeps the two equal. The vocabulary, the
-- structure rule and every earlier reviewed name are unchanged. Same
-- signature, grants and return shape as 0178.

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

SELECT 'migration_od9_merge_reconciliation_ok' AS sentinel;
