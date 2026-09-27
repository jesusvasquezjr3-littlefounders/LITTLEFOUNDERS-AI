-- OD-9 section 4.5: per-family spot checks on balances, streaks and badges,
-- signed off by a person before the legacy platform is switched off.
--
-- The inventory proves equality with checksums; a reviewer needs numbers.
-- capture_spot_check records readable values for a deterministic sample of
-- families (ordered by md5 of the family key, so the same sample is drawn on
-- every run and on every copy of the data), and with p_from it re-reads the
-- accounts of an earlier sample and returns the side-by-side comparison.
-- Runs on the legacy schema and on the migrated one; read-only on product
-- tables.

CREATE OR REPLACE FUNCTION od9.capture_spot_check(p_label text, p_families integer, p_from text)
RETURNS TABLE (family_key uuid, user_id uuid, username text, item text, before_value text, after_value text, verdict text)
LANGUAGE plpgsql
SET "TimeZone" = 'UTC'
AS $$
#variable_conflict use_column
BEGIN
    IF p_label IS NULL OR p_label !~ '^[a-z0-9_-]{1,40}$' THEN
        RAISE EXCEPTION 'OD9_BAD_LABEL: labels are 1-40 of a-z 0-9 _ -' USING ERRCODE = '22023';
    END IF;
    IF p_from IS NOT NULL AND NOT EXISTS (SELECT 1 FROM od9.spot_values s WHERE s.label = p_from) THEN
        RAISE EXCEPTION 'OD9_NO_SPOT_SAMPLE: no spot check was captured under label %', p_from USING ERRCODE = '22023';
    END IF;
    IF p_from IS NULL AND (p_families IS NULL OR p_families < 1 OR p_families > 500) THEN
        RAISE EXCEPTION 'OD9_BAD_SAMPLE: sample between 1 and 500 families' USING ERRCODE = '22023';
    END IF;
    DELETE FROM od9.spot_values s WHERE s.label = p_label;

    DROP TABLE IF EXISTS pg_temp.od9_spot_sample;
    IF p_from IS NULL THEN
        PERFORM od9.build_families();
        -- Families with more than one member first (a guardian and a child:
        -- where balances, streaks and badges live), then single accounts.
        CREATE TEMP TABLE od9_spot_sample AS
            SELECT f.user_id, f.family_key FROM od9_family f
            WHERE f.family_key IN (
                SELECT g.family_key FROM od9_family g GROUP BY g.family_key
                ORDER BY (count(*) > 1) DESC, md5(g.family_key::text) LIMIT p_families);
    ELSE
        -- The same accounts as the earlier sample, keyed by its families, so
        -- a family split or merged by the migration still lines up.
        CREATE TEMP TABLE od9_spot_sample AS
            SELECT DISTINCT s.user_id, s.family_key FROM od9.spot_values s WHERE s.label = p_from;
    END IF;

    INSERT INTO od9.spot_values (label, family_key, user_id, item, value)
    SELECT p_label, x.family_key, x.user_id, v.item, v.value
    FROM od9_spot_sample x
    CROSS JOIN LATERAL (
        SELECT 'account' AS item, 'present' AS value WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)
        UNION ALL
        SELECT 'username', p.username FROM public.profiles p WHERE p.user_id = x.user_id AND p.username IS NOT NULL
        UNION ALL
        SELECT 'xp', ls.xp_points::text FROM public.learning_stats ls WHERE ls.user_id = x.user_id
        UNION ALL
        SELECT 'learning_streak (current/best)', ls.streak_days || ' / ' || ls.longest_streak
        FROM public.learning_stats ls WHERE ls.user_id = x.user_id
        UNION ALL
        SELECT 'chore_streak (current/best)', ks.current_streak_days || ' / ' || ks.longest_streak_days
        FROM public.kid_task_streaks ks WHERE ks.kid_user_id = x.user_id
        UNION ALL
        SELECT 'coins:' || w.bucket, sum(w.amount)::text FROM public.wallet_ledger w WHERE w.kid_user_id = x.user_id GROUP BY w.bucket
        UNION ALL
        SELECT 'lessons_passed', count(*)::text FROM public.lesson_progress lp WHERE lp.user_id = x.user_id AND lp.passed HAVING count(*) > 0
        UNION ALL
        SELECT 'course_badges', string_agg(b.course_slug, ', ' ORDER BY b.course_slug)
        FROM public.get_completed_course_badges(x.user_id) b HAVING count(*) > 0
        UNION ALL
        SELECT 'goals_reached', count(*)::text FROM public.savings_goals g WHERE g.kid_user_id = x.user_id AND g.reached_at IS NOT NULL HAVING count(*) > 0
    ) v;

    IF p_from IS NULL THEN
        RETURN QUERY
            SELECT s.family_key, s.user_id, (SELECT u.value FROM od9.spot_values u WHERE u.label = p_label AND u.user_id = s.user_id AND u.item = 'username'),
                   s.item, NULL::text, s.value, 'captured'::text
            FROM od9.spot_values s WHERE s.label = p_label
            ORDER BY md5(s.family_key::text), s.user_id, s.item;
    ELSE
        RETURN QUERY
            SELECT COALESCE(b.family_key, a.family_key), COALESCE(b.user_id, a.user_id),
                   COALESCE((SELECT u.value FROM od9.spot_values u WHERE u.label = p_from AND u.user_id = COALESCE(b.user_id, a.user_id) AND u.item = 'username'),
                            (SELECT u.value FROM od9.spot_values u WHERE u.label = p_label AND u.user_id = COALESCE(b.user_id, a.user_id) AND u.item = 'username')),
                   COALESCE(b.item, a.item), b.value, a.value,
                   CASE WHEN a.item IS NULL THEN 'missing_after'
                        WHEN b.item IS NULL THEN 'new_after'
                        WHEN a.value = b.value THEN 'same'
                        ELSE 'changed' END
            FROM (SELECT * FROM od9.spot_values WHERE label = p_from) b
            FULL JOIN (SELECT * FROM od9.spot_values WHERE label = p_label) a ON a.user_id = b.user_id AND a.item = b.item
            ORDER BY md5(COALESCE(b.family_key, a.family_key)::text), COALESCE(b.user_id, a.user_id), COALESCE(b.item, a.item);
    END IF;
END $$;
