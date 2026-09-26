-- s07_merge_reconciliation — the S07 Family Hub lane (0147 to 0177) meets the
-- S06 Mentor lane and the S08 profiles/social lane on one chain.
-- @phase: expand
--
-- Both findings come from running each lane's native-PostgreSQL verifier over
-- the whole merged chain; neither lane could see the other when it was built.
-- Rationale and evidence: docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md
-- ("S07 merge integration").
--
-- 1. E.10's live messaging scan (0121 social_standing_guardrails) applies a
--    structure rule: free text in a table that references two or more
--    accounts is a messaging surface until docs/rebuild/policies/
--    SOCIAL-GOVERNANCE.md section 2.2 reviews it. On the merged chain it
--    reported ten unreviewed names, so the Appendix J metric
--    (messagingSurfaces, target empty) would have gone red in production:
--      * S06: mentor_quality_flag.dedup_key and .resolution_note, a staff
--        dashboard's key and a staff lead's resolution note.
--      * S07: the reasons and notes of the family's own decisions. Each is
--        written by a verified Tutor for their own child, or by the child for
--        their own verified Tutor at decision time (Product 10 D.18 mandates
--        the child's stated reasoning), inside the family and never to
--        anyone else, which is how section 2.2 already reviewed
--        tasks.cancel_reason and tasks.title.
--    None of them is person-to-person messaging in the E.10 sense; the list
--    below and section 2.2 name each one with its reason, and guardrails:check
--    keeps the two equal. The structure rule, the vocabulary and every
--    earlier reviewed name are unchanged. Stage 3 review of the new rows is
--    open with the rest of section 2.2.
--
-- 2. E.6 erasure reaches the S07.1 transition audit. family_state_audit
--    recorded the acting adult's account id with no foreign key, so after an
--    erasure the departed adult's id stayed on the family's audit rows for up
--    to 400 days, where audit_logs (the S08 lifecycle) clears it at once. The
--    actor column now lets go of an erased account the same way (ON DELETE
--    SET NULL), inside the one erasure transaction erase_account_data runs.
--    Every value the recorder writes comes from a column that already
--    references auth.users (decided_by, fulfilled_by, revoked_by, frozen_by,
--    settled_by, holder_user_id), so no insert the recorder makes can fail on
--    it. NOT VALID skips re-reading rows written before this file (the table
--    is new in the same release); the ON DELETE action applies to every row.

-- ── 1. E.10 reviewed names, extended ─────────────────────────────────────────
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

-- ── 2. The transition audit lets go of an erased adult ───────────────────────
ALTER TABLE public.family_state_audit
    DROP CONSTRAINT IF EXISTS family_state_audit_actor_user_id_fkey,
    ADD CONSTRAINT family_state_audit_actor_user_id_fkey
        FOREIGN KEY (actor_user_id) REFERENCES auth.users (id) ON DELETE SET NULL NOT VALID;
-- The ON DELETE action looks rows up by actor; without this an erasure would
-- scan the whole audit table.
CREATE INDEX IF NOT EXISTS idx_family_state_audit_actor
    ON public.family_state_audit (actor_user_id) WHERE actor_user_id IS NOT NULL;

SELECT 'migration_s07_merge_reconciliation_ok' AS sentinel;
