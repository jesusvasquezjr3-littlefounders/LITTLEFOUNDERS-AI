-- OD-9 section 4.1 and 4.5: the before/after inventory of every record a
-- family was promised, with row counts and per-account and per-family
-- checksums; and section 4.4: usernames and guardian links, verbatim.
--
-- Runs on the legacy schema and on the migrated one. Each category names the
-- columns it hashes; the columns are those the legacy platform already had,
-- so a column the rebuild adds never changes a checksum. A category whose
-- table or columns are absent is recorded in od9.inventory_gaps, never
-- silently skipped.
--
-- Canonical form: every row becomes jsonb_build_array(...)::text (null-safe,
-- unambiguous), ordered by a stable key, and hashed with md5 under
-- TimeZone = UTC so timestamps render the same on every session.

CREATE OR REPLACE FUNCTION od9.inventory_categories()
RETURNS TABLE (category text, source text, needs text[], query text)
LANGUAGE sql IMMUTABLE AS $body$
VALUES
    ('progress', 'public.lesson_progress', ARRAY['user_id', 'lesson_id', 'best_score', 'passed', 'attempts', 'xp_earned', 'completed_at'],
     $q$SELECT user_id AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(lesson_id, best_score, passed, attempts, xp_earned, completed_at)::text, ',' ORDER BY lesson_id)) AS h
        FROM public.lesson_progress GROUP BY user_id$q$),
    ('placement_credits', 'public.placement_credits', ARRAY['user_id', 'lesson_id', 'topic_id', 'course_id'],
     $q$SELECT user_id AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(lesson_id, topic_id, course_id)::text, ',' ORDER BY lesson_id)) AS h
        FROM public.placement_credits GROUP BY user_id$q$),
    ('placements', 'public.course_placements', ARRAY['user_id', 'course_id', 'claimed_level', 'education_level', 'quiz_answers', 'start_topic_id', 'start_lesson_id', 'method', 'created_at'],
     $q$SELECT user_id AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(course_id, claimed_level, education_level, quiz_answers, start_topic_id, start_lesson_id, method, created_at)::text, ',' ORDER BY course_id)) AS h
        FROM public.course_placements GROUP BY user_id$q$),
    ('xp', 'public.learning_stats', ARRAY['user_id', 'xp_points', 'minutes_learned', 'lessons_completed'],
     $q$SELECT user_id AS uid, 1::bigint AS n, md5(jsonb_build_array(xp_points, minutes_learned, lessons_completed)::text) AS h
        FROM public.learning_stats$q$),
    ('learning_streak', 'public.learning_stats', ARRAY['user_id', 'streak_days', 'longest_streak', 'last_active_date'],
     $q$SELECT user_id AS uid, 1::bigint AS n, md5(jsonb_build_array(streak_days, longest_streak, last_active_date)::text) AS h
        FROM public.learning_stats$q$),
    ('chore_streak', 'public.kid_task_streaks', ARRAY['kid_user_id', 'current_streak_days', 'longest_streak_days', 'last_completed_date'],
     $q$SELECT kid_user_id AS uid, 1::bigint AS n, md5(jsonb_build_array(current_streak_days, longest_streak_days, last_completed_date)::text) AS h
        FROM public.kid_task_streaks$q$),
    ('coin_balances', 'public.wallet_ledger', ARRAY['kid_user_id', 'bucket', 'amount'],
     $q$SELECT uid, sum(n)::bigint AS n, md5(string_agg(jsonb_build_array(bucket, total)::text, ',' ORDER BY bucket)) AS h
        FROM (SELECT kid_user_id AS uid, bucket, count(*) AS n, sum(amount) AS total FROM public.wallet_ledger GROUP BY 1, 2) b GROUP BY uid$q$),
    ('coin_ledger', 'public.wallet_ledger', ARRAY['id', 'kid_user_id', 'bucket', 'amount', 'reason', 'task_id', 'goal_id', 'redemption_id', 'created_at'],
     $q$SELECT kid_user_id AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(id, bucket, amount, reason, task_id, goal_id, redemption_id, created_at)::text, ',' ORDER BY id)) AS h
        FROM public.wallet_ledger GROUP BY kid_user_id$q$),
    ('course_badges', 'public.get_completed_course_badges(uuid)', NULL,
     $q$SELECT l.uid, count(*) AS n, md5(string_agg(b.course_slug, ',' ORDER BY b.course_slug)) AS h
        FROM od9.badge_learners() l CROSS JOIN LATERAL public.get_completed_course_badges(l.uid) b GROUP BY l.uid$q$),
    ('savings_goals', 'public.savings_goals', ARRAY['id', 'kid_user_id', 'title', 'target', 'icon', 'status', 'created_at', 'reached_at'],
     $q$SELECT kid_user_id AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(id, title, target, icon, status, created_at, reached_at)::text, ',' ORDER BY id)) AS h
        FROM public.savings_goals GROUP BY kid_user_id$q$),
    ('chore_history', 'public.tasks', ARRAY['id', 'assigned_by', 'assigned_to', 'title', 'status', 'reward_coins', 'recurrence', 'due_at', 'created_at'],
     $q$SELECT assigned_to AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(id, assigned_by, title, status, reward_coins, recurrence, due_at, created_at)::text, ',' ORDER BY id)) AS h
        FROM public.tasks GROUP BY assigned_to$q$),
    ('rewards', 'public.redemptions', ARRAY['id', 'catalog_id', 'kid_user_id', 'status', 'created_at', 'decided_at'],
     $q$SELECT kid_user_id AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(id, catalog_id, status, created_at, decided_at)::text, ',' ORDER BY id)) AS h
        FROM public.redemptions GROUP BY kid_user_id$q$),
    ('mentor_plans', 'public.tutor_plans', ARRAY['user_id', 'content', 'session_id', 'updated_at'],
     $q$SELECT user_id AS uid, 1::bigint AS n, md5(jsonb_build_array(content, session_id, updated_at)::text) AS h
        FROM public.tutor_plans$q$),
    ('mentor_notebooks', 'public.tutor_notebook_entries', ARRAY['id', 'user_id', 'whiteboard', 'session_id', 'turn_seq', 'kept_at'],
     $q$SELECT user_id AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(id, whiteboard, session_id, turn_seq, kept_at)::text, ',' ORDER BY id)) AS h
        FROM public.tutor_notebook_entries GROUP BY user_id$q$),
    ('mentor_memory', 'public.learner_memory', ARRAY['user_id', 'store', 'content', 'updated_at'],
     $q$SELECT user_id AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(store, content, updated_at)::text, ',' ORDER BY store)) AS h
        FROM public.learner_memory GROUP BY user_id$q$),
    ('mentor_mastery', 'public.learner_kc_mastery', ARRAY['user_id', 'kc_id', 'p_known', 'attempts', 'correct'],
     $q$SELECT user_id AS uid, count(*) AS n, md5(string_agg(jsonb_build_array(kc_id, p_known, attempts, correct)::text, ',' ORDER BY kc_id)) AS h
        FROM public.learner_kc_mastery GROUP BY user_id$q$)
$body$;

-- Everyone who can hold a course badge: learners with graded or credited
-- lessons, plus (on the migrated schema) anyone with a stored badge, so a
-- badge whose lessons were retired is still counted.
CREATE OR REPLACE FUNCTION od9.badge_learners()
RETURNS TABLE (uid uuid) LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF to_regclass('public.course_pathway_badges') IS NOT NULL THEN
        RETURN QUERY EXECUTE 'SELECT user_id FROM public.lesson_progress WHERE passed
            UNION SELECT user_id FROM public.placement_credits UNION SELECT user_id FROM public.course_pathway_badges';
    ELSE
        RETURN QUERY EXECUTE 'SELECT user_id FROM public.lesson_progress WHERE passed
            UNION SELECT user_id FROM public.placement_credits';
    END IF;
END $$;

-- Families are the connected components of the live guardian graph (links
-- that are neither rejected nor revoked); the key is the smallest account id
-- in the component. An account with no link is its own family.
CREATE OR REPLACE FUNCTION od9.build_families()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    DROP TABLE IF EXISTS pg_temp.od9_family;
    CREATE TEMP TABLE od9_family (user_id uuid PRIMARY KEY, family_key uuid NOT NULL);
    INSERT INTO od9_family SELECT id, id FROM auth.users;
    DROP TABLE IF EXISTS pg_temp.od9_edge;
    CREATE TEMP TABLE od9_edge AS
        SELECT parent_user_id AS a, kid_user_id AS b FROM public.guardian_links WHERE verification_status NOT IN ('rejected', 'revoked')
        UNION SELECT kid_user_id, parent_user_id FROM public.guardian_links WHERE verification_status NOT IN ('rejected', 'revoked');
    LOOP
        UPDATE od9_family f SET family_key = m.k
        FROM (SELECT e.a AS user_id, min(n.family_key::text)::uuid AS k
              FROM od9_edge e JOIN od9_family n ON n.user_id = e.b GROUP BY e.a) m
        WHERE f.user_id = m.user_id AND m.k < f.family_key;
        EXIT WHEN NOT FOUND;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION od9.capture_inventory(p_label text)
RETURNS TABLE (category text, accounts bigint, total_rows bigint, status text)
LANGUAGE plpgsql
SET "TimeZone" = 'UTC'
AS $$
#variable_conflict use_column
DECLARE
    c record;
    missing text;
    run_id bigint;
    summary jsonb := '{}'::jsonb;
BEGIN
    IF p_label IS NULL OR p_label !~ '^[a-z0-9_-]{1,40}$' THEN
        RAISE EXCEPTION 'OD9_BAD_LABEL: labels are 1-40 of a-z 0-9 _ -' USING ERRCODE = '22023';
    END IF;
    DELETE FROM od9.inventory WHERE label = p_label;
    DELETE FROM od9.inventory_gaps WHERE label = p_label;
    DELETE FROM od9.identifiers WHERE label = p_label;
    PERFORM od9.build_families();

    FOR c IN SELECT * FROM od9.inventory_categories() LOOP
        missing := NULL;
        IF c.needs IS NULL THEN
            IF to_regprocedure(c.source) IS NULL THEN missing := 'function ' || c.source || ' absent'; END IF;
        ELSIF to_regclass(c.source) IS NULL THEN
            missing := 'table ' || c.source || ' absent';
        ELSE
            SELECT 'columns absent: ' || string_agg(col, ', ') INTO missing
            FROM unnest(c.needs) AS col
            WHERE NOT od9.has_column(split_part(c.source, '.', 1), split_part(c.source, '.', 2), col);
        END IF;
        IF missing IS NOT NULL THEN
            INSERT INTO od9.inventory_gaps (label, category, reason) VALUES (p_label, c.category, missing);
            summary := summary || jsonb_build_object(c.category, jsonb_build_object('status', 'absent', 'reason', missing));
            CONTINUE;
        END IF;
        EXECUTE format(
            'INSERT INTO od9.inventory (label, user_id, family_key, category, row_count, checksum)
             SELECT %L, q.uid, COALESCE(f.family_key, q.uid), %L, q.n, q.h FROM (%s) q LEFT JOIN od9_family f ON f.user_id = q.uid',
            p_label, c.category, c.query);
    END LOOP;

    INSERT INTO od9.identifiers (label, kind, key, value)
    SELECT p_label, 'username', user_id::text, username FROM public.profiles WHERE username IS NOT NULL;
    INSERT INTO od9.identifiers (label, kind, key, value)
    SELECT p_label, 'guardian_link', id::text,
           jsonb_build_array(parent_user_id, kid_user_id, verification_status, verified_at, created_at)::text
    FROM public.guardian_links;

    RETURN QUERY
        SELECT i.category, count(*)::bigint, sum(i.row_count)::bigint, 'captured'::text
        FROM od9.inventory i WHERE i.label = p_label GROUP BY i.category
        UNION ALL
        SELECT g.category, 0::bigint, 0::bigint, 'absent: ' || g.reason FROM od9.inventory_gaps g WHERE g.label = p_label
        UNION ALL
        SELECT 'identifiers:' || d.kind, count(*)::bigint, count(*)::bigint, 'captured'::text
        FROM od9.identifiers d WHERE d.label = p_label GROUP BY d.kind
        ORDER BY 1;

    SELECT jsonb_object_agg(i.category, jsonb_build_object('accounts', i.accounts, 'rows', i.total_rows)) INTO summary
    FROM (SELECT x.category, count(*) AS accounts, sum(x.row_count) AS total_rows
          FROM od9.inventory x WHERE x.label = p_label GROUP BY x.category) i;
    INSERT INTO od9.runs (step, mode, label, summary) VALUES ('inventory', 'capture', p_label, COALESCE(summary, '{}'::jsonb));
    -- Fresh statistics for the comparison that follows.
    ANALYZE od9.inventory;
    ANALYZE od9.identifiers;
END $$;

-- Section 4.5: the comparison a person signs off. Account rows whose
-- checksum changed or that vanished are failures; accounts that appear only
-- after (new sign-ups, new Mentor memory) are informational.
-- Hash joins only: with a third label captured the planner once chose nested
-- loops over the per-label scans, and a 5,000-account comparison went from
-- two seconds to minutes (found in the S10.2 volume rehearsal).
CREATE OR REPLACE FUNCTION od9.compare_inventory(p_before text, p_after text)
RETURNS TABLE (scope text, category text, subject text, before_rows bigint, after_rows bigint, verdict text)
LANGUAGE sql STABLE
SET enable_nestloop = off
AS $$
    WITH b AS (SELECT * FROM od9.inventory WHERE label = p_before),
         a AS (SELECT * FROM od9.inventory WHERE label = p_after),
    accounts AS (
        SELECT COALESCE(b.category, a.category) AS category, COALESCE(b.user_id, a.user_id) AS user_id,
               b.row_count AS before_rows, a.row_count AS after_rows,
               CASE WHEN a.user_id IS NULL THEN 'missing_after'
                    WHEN b.user_id IS NULL THEN 'new_after'
                    WHEN a.checksum = b.checksum AND a.row_count = b.row_count THEN 'same'
                    ELSE 'changed' END AS verdict
        FROM b FULL JOIN a ON a.user_id = b.user_id AND a.category = b.category
    ),
    families AS (
        SELECT COALESCE(fb.family_key, fa.family_key) AS family_key, fb.h AS hb, fa.h AS ha, fb.n AS nb, fa.n AS na
        FROM (SELECT family_key, sum(row_count) AS n, md5(string_agg(user_id || ':' || category || ':' || checksum, ',' ORDER BY user_id, category)) AS h
              FROM b GROUP BY family_key) fb
        FULL JOIN (SELECT b2.family_key, sum(a2.row_count) AS n,
                          md5(string_agg(a2.user_id || ':' || a2.category || ':' || a2.checksum, ',' ORDER BY a2.user_id, a2.category)) AS h
                   FROM a a2 JOIN b b2 ON b2.user_id = a2.user_id AND b2.category = a2.category GROUP BY b2.family_key) fa
        ON fa.family_key = fb.family_key
    )
    SELECT 'account', category, user_id::text, before_rows, after_rows, verdict FROM accounts WHERE verdict <> 'same'
    UNION ALL
    SELECT 'family', 'all', family_key::text, nb::bigint, na::bigint,
           CASE WHEN ha = hb THEN 'same' ELSE 'changed' END FROM families
    UNION ALL
    SELECT 'category', category, NULL, sum(before_rows)::bigint, sum(after_rows)::bigint,
           CASE WHEN bool_and(verdict IN ('same', 'new_after')) THEN 'same' ELSE 'changed' END
    FROM accounts GROUP BY category
    UNION ALL
    SELECT 'gap', g.category, NULL, NULL, NULL, 'absent_after: ' || g.reason
    FROM od9.inventory_gaps g
    WHERE g.label = p_after AND NOT EXISTS (SELECT 1 FROM od9.inventory_gaps x WHERE x.label = p_before AND x.category = g.category)
    UNION ALL
    SELECT 'identifier', COALESCE(ib.kind, ia.kind), COALESCE(ib.key, ia.key), NULL, NULL,
           CASE WHEN ia.key IS NULL THEN 'missing_after' WHEN ib.key IS NULL THEN 'new_after' ELSE 'changed' END
    FROM (SELECT * FROM od9.identifiers WHERE label = p_before) ib
    FULL JOIN (SELECT * FROM od9.identifiers WHERE label = p_after) ia ON ia.kind = ib.kind AND ia.key = ib.key
    WHERE ia.value IS DISTINCT FROM ib.value
$$;
