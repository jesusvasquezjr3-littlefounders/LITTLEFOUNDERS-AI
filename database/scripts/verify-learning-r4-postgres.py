"""Gap-fix round 4, learning lane (Appendix C 1.1 Delayed Retention and Time-to-Mastery by age band; Appendix C 1.2 Session Efficiency with v2 time on task; Appendix P L5/L10 diagnostic codes), against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim,
applies EVERY migration in database/migrations in order, and proves at the
enforcing boundary (migrations learning_delayed_retention, v2_time_on_task):

  - learning_delayed_retention counts, per KC and per 30/60/90-day window,
    the FIRST spaced review of a learner's memory card after the learner
    first reached the mastery bar, from the Mentor or a course lesson; it
    ignores short-horizon re-exposures, reviews before the window, learners
    without a review card, and reviews outside the requested period;
  - record_learning_retention_release freezes a release once, chains each
    period from the previous release, refuses a malformed id; the table and
    the functions are service role only (RLS on, no client policy);
  - learning_kc_learner_age_bands reads a declared 13-17 band, a profile
    birth date, or 'unknown' (bands only);
  - record_v2_time_on_task sets a bounded time once on the learner's own
    receipt or view, never another learner's, never out of bounds;
  - learning_session_efficiency now counts v1 attempts plus v2 receipts and
    views, capped at the day's visible session time.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP, LF_PG_REPORT
(see verify-teen-discoverable-postgres.py).
"""

import json
import os
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PSQL = os.environ.get('LF_PG_PSQL', str(ROOT / '.codex/audit-db/pgsql/bin/psql.exe'))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
BASE = [PSQL, '-X', '-h', '127.0.0.1', '-p', PORT, '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True,
                            env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


SHIM = """
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb, email_change text DEFAULT '',
    created_at timestamptz DEFAULT now(), is_anonymous boolean DEFAULT false);
CREATE TABLE auth.audit_log_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payload json, created_at timestamptz DEFAULT now());
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""

database = 'lf_learning_r4_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def rejected(query, message):
    try:
        run(query)
    except RuntimeError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError(f'expected {message!r}, the statement succeeded')


def check(name):
    checks.append(name)
    print('ok -', name)


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    users = {name: str(uuid.uuid4()) for name in ['a', 'b', 'c', 'd', 'e', 'teen', 'kid', 'nobody']}
    for name, uid in users.items():
        run(f"INSERT INTO auth.users (id, email) VALUES ('{uid}', '{name}@example.com');")
    kc = run("""INSERT INTO kc (key, strand, title, objective) VALUES ('money.saving-basics', 'money_math', '{"en-US":"Saving"}', '{"en-US":"Save"}') RETURNING id;""")
    kc2 = run("""INSERT INTO kc (key, strand, title, objective) VALUES ('money.pricing', 'money_math', '{"en-US":"Pricing"}', '{"en-US":"Price"}') RETURNING id;""")

    def attempt(user, days_ago, p_after, correct=True, tier='spaced', source='segment_grade', kc_id=None):
        receipt = f"'v1:receipt-{uuid.uuid4().hex}'" if source == 'course_lesson' else 'NULL'
        tier_sql = 'NULL' if tier is None else f"'{tier}'"
        run(f"""INSERT INTO kc_attempt (user_id, kc_id, source, correct, p_known_before, p_known_after, review_tier, receipt_key, created_at)
                VALUES ('{users[user]}', '{kc_id or kc}', '{source}', {str(correct).lower()}, 0.5, {p_after}, {tier_sql}, {receipt},
                        now() - interval '{days_ago} days');""")

    def card(user, kc_id=None):
        run(f"INSERT INTO memory_card (user_id, kc_id, state) VALUES ('{users[user]}', '{kc_id or kc}', 'review');")

    # a: mastered 150 days ago; spaced reviews at +35 (right), +65 (wrong), a short-horizon
    #    re-exposure at +95 (ignored), then a spaced course-lesson review at +100 (right).
    attempt('a', 152, 0.6, tier=None)
    attempt('a', 150, 0.9)
    attempt('a', 115, 0.95)
    attempt('a', 85, 0.7, correct=False)
    attempt('a', 55, 0.8, tier='short_horizon')
    attempt('a', 50, 0.9, source='course_lesson')
    card('a')
    # b: mastered 150 days ago; the first spaced review in the 30-day window is wrong (+31), a later one right (+40, not counted).
    attempt('b', 150, 0.88)
    attempt('b', 119, 0.6, correct=False)
    attempt('b', 110, 0.9)
    card('b')
    # c: mastered, reviewed in the window, but holds no review card: not a review-card result.
    attempt('c', 150, 0.9)
    attempt('c', 115, 0.9)
    # d: reviewed only before the 30-day mark (+20): no window.
    attempt('d', 150, 0.9)
    attempt('d', 130, 0.9)
    card('d')
    # e: never reaches the bar: never counted.
    attempt('e', 150, 0.5, tier=None)
    attempt('e', 115, 0.6)
    card('e')
    # A second KC keeps its own rows.
    attempt('a', 150, 0.9, kc_id=kc2)
    attempt('a', 110, 0.9, correct=False, kc_id=kc2)
    card('a', kc2)

    window = "now() - interval '365 days', now() + interval '1 day'"
    rows = run(f"SET ROLE service_role; SELECT kc_key || '|' || window_days || '|' || learners || '|' || correct FROM learning_delayed_retention({window}) ORDER BY kc_key, window_days;").splitlines()
    assert rows == ['money.pricing|30|1|0', 'money.saving-basics|30|2|1', 'money.saving-basics|60|1|0', 'money.saving-basics|90|1|1'], rows
    # The period filter reads the review's own date: a period after the 30-day reviews drops them.
    rows = run("SET ROLE service_role; SELECT kc_key || '|' || window_days FROM learning_delayed_retention(now() - interval '100 days', now() + interval '1 day') ORDER BY 1;").splitlines()
    assert rows == ['money.saving-basics|60', 'money.saving-basics|90'], rows
    # A stricter mastery bar moves the mastery date later (a's 0.95 at 115 days ago).
    rows = run(f"SET ROLE service_role; SELECT kc_key || '|' || window_days || '|' || learners FROM learning_delayed_retention({window}, 0.93) ORDER BY 1;").splitlines()
    assert rows == ['money.saving-basics|30|1', 'money.saving-basics|60|1'], rows
    check('learning_delayed_retention counts the first spaced review-card result 30/60/90 days after first mastery, per KC, Mentor and course lessons alike')

    rejected(f"SET ROLE authenticated; SELECT * FROM learning_delayed_retention({window});", 'permission denied')
    rejected("SET ROLE authenticated; SELECT * FROM learning_retention_release_baseline;", 'permission denied')
    rejected("SET ROLE authenticated; SELECT record_learning_retention_release('r1', now() - interval '1 day');", 'permission denied')
    assert run("SELECT relrowsecurity FROM pg_class WHERE relname = 'learning_retention_release_baseline'") == 't'
    assert run("SELECT count(*) FROM pg_policies WHERE tablename = 'learning_retention_release_baseline'") == '0'
    check('the retention functions and the release table are service role only (RLS on, no client policy)')

    first = run("SET ROLE service_role; SELECT record_learning_retention_release('2026.09.1', now() - interval '365 days', now() - interval '60 days');")
    assert first == '3', first  # the two KCs' 30-day cells and the 60-day cell, all reviewed before 60 days ago
    again = run("SET ROLE service_role; SELECT record_learning_retention_release('2026.09.1', now() - interval '365 days', now());")
    assert again == '0', again
    second = run("SET ROLE service_role; SELECT record_learning_retention_release('2026.10.1', now() - interval '365 days', now() + interval '1 day');")
    assert second == '1', second  # the 90-day cell, reviewed after the first period ended
    chained = run("SELECT count(*) FROM (SELECT DISTINCT period_start FROM learning_retention_release_baseline WHERE release_id = '2026.10.1') s "
                  "WHERE period_start = (SELECT max(period_end) FROM learning_retention_release_baseline WHERE release_id = '2026.09.1')")
    assert chained == '1', chained
    rejected("SET ROLE service_role; SELECT record_learning_retention_release('bad id!', now() - interval '1 day');", 'invalid release id')
    check('record_learning_retention_release freezes a release once and chains each period from the previous release')

    run(f"UPDATE profiles SET birth_date = (now() - interval '8 years')::date WHERE user_id = '{users['kid']}';")
    run(f"INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES ('{users['teen']}', '13_to_17');")
    for name in ['kid', 'teen', 'nobody']:
        attempt(name, 1, 0.5, tier=None)
    bands = dict(line.split('|') for line in run("SET ROLE service_role; SELECT user_id || '|' || age_band FROM learning_kc_learner_age_bands(now() - interval '2 days');").splitlines())
    assert bands == {users['kid']: '6-9', users['teen']: '13-17', users['nobody']: 'unknown'}, bands
    rejected("SET ROLE authenticated; SELECT * FROM learning_kc_learner_age_bands(now());", 'permission denied')
    check('learning_kc_learner_age_bands reads the declared band, then the birth date, else unknown; service role only')

    # ── 0237: the L5 / L10 diagnostic codes ──
    for index, code in enumerate(['occupancy', 'conclusion', 'rule_switch']):
        run(f"""SET session_replication_role = replica;
            INSERT INTO lesson_v2_grade_receipts (jti, user_id, run_id, document_version_id, segment_id, verdict)
            VALUES ('jti-r4-code-{index:013d}', '{users['c']}', '{uuid.uuid4()}', '{uuid.uuid4()}', 'logic-01', '{{"correct": false, "score": 0, "diagnostic": "{code}"}}'::jsonb);""")
    rejected(f"""SET session_replication_role = replica;
        INSERT INTO lesson_v2_grade_receipts (jti, user_id, run_id, document_version_id, segment_id, verdict)
        VALUES ('jti-r4-code-bad0000001', '{users['c']}', '{uuid.uuid4()}', '{uuid.uuid4()}', 'logic-01', '{{"correct": false, "score": 0, "diagnostic": "syllogism"}}'::jsonb);""",
        'lesson_v2_grade_receipts_signals_check')
    split = dict((row.split('|')[1], row.split('|')[0]) for row in run(
        "SET ROLE service_role; SELECT family || '|' || diagnostic FROM learning_error_family_split(now() - interval '1 day', now() + interval '1 day');").splitlines())
    assert split.get('rule_switch') == 'structure' and split.get('occupancy') == 'answer' and split.get('conclusion') == 'answer', split
    check('the receipt CHECK admits the occupancy, conclusion and rule_switch codes (and still refuses an unknown one); rule_switch is a structure error')

    # ── 0236: v2 time on task ──
    learner, other = users['a'], users['b']
    run_id, version = str(uuid.uuid4()), str(uuid.uuid4())
    run(f"""SET session_replication_role = replica;
        INSERT INTO lesson_v2_grade_receipts (jti, user_id, run_id, document_version_id, segment_id, verdict)
        VALUES ('jti-time-000000000000001', '{learner}', '{run_id}', '{version}', 'decide-01', '{{"correct": true, "score": 100}}'::jsonb);
        INSERT INTO lesson_v2_segment_views (user_id, run_id, document_version_id, segment_id) VALUES ('{learner}', '{run_id}', '{version}', 'intro-01');""")
    t = lambda user, segment, jti, seconds: run(f"SET ROLE service_role; SELECT record_v2_time_on_task('{user}', '{run_id}', '{segment}', {jti}, {seconds});")
    assert t(other, 'decide-01', "'jti-time-000000000000001'", 30) == 'f'
    assert t(learner, 'decide-01', "'jti-time-000000000000001'", 30) == 't'
    assert t(learner, 'decide-01', "'jti-time-000000000000001'", 999) == 'f'
    assert t(learner, 'intro-01', 'NULL', 45) == 't'
    assert t(learner, 'intro-01', 'NULL', 7) == 'f'
    for bad in ['-1', '7201']:
        rejected(f"SET ROLE service_role; SELECT record_v2_time_on_task('{learner}', '{run_id}', 'intro-01', NULL, {bad});", 'Invalid time on task')
    rejected("UPDATE lesson_v2_segment_views SET time_spent_seconds = 7201", 'check')
    assert run("SELECT string_agg(time_spent_seconds::text, ',' ORDER BY segment_id) FROM (SELECT segment_id, time_spent_seconds FROM lesson_v2_grade_receipts UNION ALL SELECT segment_id, time_spent_seconds FROM lesson_v2_segment_views) s") == '30,45'
    assert run("SELECT verdict::text FROM lesson_v2_grade_receipts WHERE jti = 'jti-time-000000000000001'") == '{"score": 100, "correct": true}'
    rejected(f"SET ROLE authenticated; SELECT record_v2_time_on_task('{learner}', '{run_id}', 'intro-01', NULL, 1);", 'permission denied')
    check('record_v2_time_on_task sets a bounded time once on the learner\'s own receipt or view; the verdict is untouched')

    # Session efficiency: 600 visible seconds today; 75 seconds of v2 work plus 60 of a v1 attempt.
    run(f"""ALTER TABLE learning_events DISABLE TRIGGER USER;
        INSERT INTO learning_events (user_id, role, event, route_class, value)
        SELECT '{learner}', 'kid', 'session_heartbeat', 'learn', 60 FROM generate_series(1, 10);
        ALTER TABLE learning_events ENABLE TRIGGER USER;""")
    lesson = run("SELECT id FROM lessons LIMIT 1") or None
    run(f"""SET session_replication_role = replica;
        INSERT INTO lesson_segment_attempts (user_id, lesson_id, segment_id, attempt_number, score, time_spent_seconds)
        VALUES ('{learner}', '{lesson or uuid.uuid4()}', 'seg-01', 1, 100, 60);""")
    row = run("SET ROLE service_role; SELECT learners || '|' || graded_seconds || '|' || session_seconds || '|' || efficiency_ratio FROM learning_session_efficiency(now() - interval '1 day', now() + interval '1 day');")
    assert row == '1|135|600|0.2250', row
    check('learning_session_efficiency counts v1 attempts plus v2 receipts and views, capped at the day\'s session time')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'Every migration applied in order on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal Supabase shim; fixture receipts and attempts inserted directly (FKs skipped where noted, CHECKs enforced); not PostgREST or deployed Core.',
}
if os.environ.get('LF_PG_REPORT'):
    Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks)}))
