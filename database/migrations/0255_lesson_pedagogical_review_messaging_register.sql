-- lesson_pedagogical_review_messaging_register — E.10 (no person-to-person
-- messaging): the reviewed-name register of public.social_messaging_surfaces()
-- learns the Stage 3 pedagogical review record.
-- @phase: expand
--
-- lesson_pedagogical_reviews (lesson_pedagogical_reviews, Appendix C Part 3
-- Stage 3) references two accounts (reviewer_id and author_id, both
-- auth.users), so the scan's structure rule reads every free-text or JSON
-- column of it as a possible channel between them until it is reviewed. One
-- column is neither a code nor held to a closed set by its own CHECK:
-- `checks`, the ten Stage 3 items with a staff reviewer's finding on each
-- (stage3_review_checks_valid). It is a staff record about lesson content,
-- written only by the service role through the Stage 3 writer behind Core's
-- manage_content routes and never shown to a learner or family; nothing in it
-- is addressed from one account to another. The same row is added to
-- docs/rebuild/policies/SOCIAL-GOVERNANCE.md section 2.2 (guardrails:check
-- keeps the two lists equal).
--
-- Redefined identically to banking_display_number_drop (the latest body):
-- same signature, SECURITY DEFINER, grants and return shape; the vocabulary,
-- the structure rule and every other reviewed name are unchanged. Proven on
-- the full chain by database/scripts/verify-social-governance-postgres.py
-- (the scan returns []).

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
            'text:lesson_pedagogical_reviews.checks',
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

SELECT 'migration_lesson_pedagogical_review_messaging_register_ok' AS sentinel;
