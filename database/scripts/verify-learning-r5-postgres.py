"""Gap-fix round 5, learning lane (Appendix P M2/M3 placement error on the receipt; Product 10 Block B autonomy levers, B.24, Appendix C 1.2 Autonomy Mechanism Adoption Rate), against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim,
applies EVERY migration in database/migrations in order, and proves at the
enforcing boundary (migrations v2_number_line_pae, learning_autonomy_levers):

  - the receipt CHECK admits `pae` as a number between 0 and 1 and refuses
    anything else;
  - lessons.optional_enrichment defaults to false;
  - a v2 run starts without an approach; pin_v2_run_approach (service role
    only) pins one the run's document declares, once: a replay answers the
    pinned one, another learner's run and an undeclared approach are refused,
    a pinned approach cannot be changed and a completed run cannot take one;
  - a view or grade receipt for a segment inside an approach chain is refused
    unless the run pinned that chain; a segment outside the chains is open;
  - learning_events admits approach_choice, enrichment_offer, enrichment_open;
  - learning_autonomy_adoption reports path, pace, Mentor, approach and
    enrichment rows;
  - get_completed_course_badges never waits for an optional enrichment lesson.

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

database = 'lf_learning_r5_' + uuid.uuid4().hex[:12]
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

    users = {name: str(uuid.uuid4()) for name in ['learner', 'other']}
    for name, uid in users.items():
        run(f"INSERT INTO auth.users (id, email) VALUES ('{uid}', '{name}@example.com');")
    learner, other = users['learner'], users['other']

    # ── 0241: the placement error on the receipt ──
    def receipt(jti, verdict, run_id=None, version=None, segment='line-01'):
        return f"""SET session_replication_role = replica;
            INSERT INTO lesson_v2_grade_receipts (jti, user_id, run_id, document_version_id, segment_id, verdict)
            VALUES ('{jti}', '{learner}', '{run_id or uuid.uuid4()}', '{version or uuid.uuid4()}', '{segment}', '{verdict}'::jsonb);"""
    run(receipt('jti-r5-pae-0000000000001', '{"correct": true, "score": 100, "pae": 0.0125}'))
    run(receipt('jti-r5-pae-0000000000002', '{"correct": false, "score": 0, "diagnostic": "tolerance", "pae": 1}'))
    for index, bad in enumerate(['1.5', '-0.1', '"0.2"']):
        rejected(receipt(f'jti-r5-pae-bad000000000{index}', f'{{"correct": false, "score": 0, "pae": {bad}}}'), 'lesson_v2_grade_receipts_signals_check')
    check('the receipt CHECK admits pae as a number in 0-1 and refuses one outside it or as a string')

    # ── 0242: the approach lever ──
    assert run("SELECT column_default FROM information_schema.columns WHERE table_name = 'lessons' AND column_name = 'optional_enrichment'") == 'false'
    check('lessons.optional_enrichment exists and defaults to false (no existing lesson changes)')

    lesson, version = str(uuid.uuid4()), str(uuid.uuid4())
    document = json.dumps({'segments': [{'id': 'intro-01'}, {'id': 'bar-01'}, {'id': 'bar-02'}, {'id': 'diagram-01'}, {'id': 'wrap-01'}],
                           'approaches': {'options': [{'id': 'approach-bars', 'label': 'Draw bars', 'segment_ids': ['bar-01', 'bar-02']},
                                                      {'id': 'approach-diagram', 'label': 'Use a diagram', 'segment_ids': ['diagram-01']}]}})
    run(f"""SET session_replication_role = replica;
        INSERT INTO lesson_document_versions (id, lesson_id, locale, version_id, schema_version, document)
        VALUES ('{version}', '{lesson}', 'en-US', 'forge-r5-approach', 2, '{document}'::jsonb);""")

    def new_run(user, completed=False):
        run_id = str(uuid.uuid4())
        run(f"""SET session_replication_role = replica;
            INSERT INTO lesson_v2_runs (id, user_id, lesson_id, locale, document_version_id, expires_at, completed_at)
            VALUES ('{run_id}', '{user}', '{lesson}', 'en-US', '{version}', now() + interval '1 hour', {'now()' if completed else 'NULL'});""")
        return run_id

    rejected(f"""INSERT INTO lesson_v2_runs (user_id, lesson_id, locale, document_version_id, expires_at, approach_id)
        VALUES ('{learner}', '{lesson}', 'en-US', '{version}', now() + interval '1 hour', 'approach-bars');""", 'A run starts without an approach')
    check('a new run cannot start with an approach already chosen')

    first = new_run(learner)
    pin = lambda user, run_id, approach: run(f"SET ROLE service_role; SELECT pin_v2_run_approach('{user}', '{run_id}', '{approach}');")
    rejected(f"SET ROLE service_role; SELECT pin_v2_run_approach('{learner}', '{first}', 'approach-other');", 'This lesson offers no such approach')
    rejected(f"SET ROLE service_role; SELECT pin_v2_run_approach('{other}', '{first}', 'approach-bars');", 'Unknown lesson run')
    rejected(f"SET ROLE service_role; SELECT pin_v2_run_approach('{learner}', '{first}', 'Bad Id!');", 'Invalid approach choice')
    rejected(f"SET ROLE authenticated; SELECT pin_v2_run_approach('{learner}', '{first}', 'approach-bars');", 'permission denied')
    assert pin(learner, first, 'approach-diagram') == 'approach-diagram'
    assert pin(learner, first, 'approach-bars') == 'approach-diagram', 'a later pin must answer the first choice'
    rejected(f"UPDATE lesson_v2_runs SET approach_id = 'approach-bars' WHERE id = '{first}'", 'The approach of this run is already chosen')
    done = new_run(learner, completed=True)
    rejected(f"SET ROLE service_role; SELECT pin_v2_run_approach('{learner}', '{done}', 'approach-bars');", 'A completed run cannot choose an approach')
    check('pin_v2_run_approach pins a declared approach once (a replay answers the first), for the run owner only, never after completion; service role only')

    view = lambda run_id, segment: run(f"""INSERT INTO lesson_v2_segment_views (user_id, run_id, document_version_id, segment_id)
        VALUES ('{learner}', '{run_id}', '{version}', '{segment}');""")
    view(first, 'intro-01')
    view(first, 'diagram-01')
    rejected(f"""INSERT INTO lesson_v2_segment_views (user_id, run_id, document_version_id, segment_id)
        VALUES ('{learner}', '{first}', '{version}', 'bar-01');""", 'This step belongs to an approach the run did not choose')
    unpinned = new_run(learner)
    rejected(f"""INSERT INTO lesson_v2_segment_views (user_id, run_id, document_version_id, segment_id)
        VALUES ('{learner}', '{unpinned}', '{version}', 'diagram-01');""", 'This step belongs to an approach the run did not choose')
    view(unpinned, 'wrap-01')
    rejected(f"""INSERT INTO lesson_v2_grade_receipts (jti, user_id, run_id, document_version_id, segment_id, verdict)
        VALUES ('jti-r5-chain-00000000001', '{learner}', '{first}', '{version}', 'bar-02', '{{"correct": true, "score": 100}}'::jsonb);""",
             'This step belongs to an approach the run did not choose')
    check('a view or grade receipt inside an approach chain needs the run to have pinned that chain; steps outside the chains stay open')

    # ── the live course badge never waits for optional enrichment ──
    B = {k: str(uuid.uuid4()) for k in ('course', 'adv', 'saga', 'topic', 'required', 'deep')}
    run(f"""SET session_replication_role = replica;
        INSERT INTO courses (id, slug, status, badge_asset) VALUES ('{B['course']}', 'r5-course', 'published', 'course-badges/r5.png');
        INSERT INTO adventures (id, course_id, position, slug, theme, status) VALUES ('{B['adv']}', '{B['course']}', 1, 'r5-adv', 'archipelago', 'published');
        INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES ('{B['saga']}', '{B['adv']}', 1, 'r5-saga', 'published');
        INSERT INTO topics (id, saga_id, position, slug, status) VALUES ('{B['topic']}', '{B['saga']}', 1, 'r5-topic', 'published');
        INSERT INTO lessons (id, topic_id, position, slug, status) VALUES ('{B['required']}', '{B['topic']}', 1, 'r5-required', 'published');
        INSERT INTO lessons (id, topic_id, position, slug, status, optional_enrichment) VALUES ('{B['deep']}', '{B['topic']}', 2, 'r5-deep', 'published', true);
        INSERT INTO lesson_progress (user_id, lesson_id, passed, completed_at) VALUES ('{learner}', '{B['required']}', true, now());""")
    badges = run(f"SET ROLE service_role; SELECT string_agg(course_slug, ',') FROM get_completed_course_badges('{learner}');")
    assert badges == 'r5-course', badges
    assert run(f"SET ROLE service_role; SELECT count(*) FROM get_completed_course_badges('{other}');") == '0'
    check('get_completed_course_badges awards the live badge once every required lesson is passed; an unplayed enrichment lesson never blocks it')

    # ── learning_events and the adoption metric ──
    run(f"""ALTER TABLE learning_events DISABLE TRIGGER USER;
        INSERT INTO learning_events (user_id, role, event, route_class, value) VALUES
          ('{learner}', 'kid', 'approach_choice', 'learn', 1),
          ('{other}', 'kid', 'approach_choice', 'learn', 0),
          ('{learner}', 'kid', 'enrichment_offer', 'learn', NULL),
          ('{other}', 'kid', 'enrichment_offer', 'learn', NULL),
          ('{learner}', 'kid', 'enrichment_open', 'learn', 1);
        ALTER TABLE learning_events ENABLE TRIGGER USER;""")
    rejected(f"""ALTER TABLE learning_events DISABLE TRIGGER USER;
        INSERT INTO learning_events (user_id, role, event, route_class) VALUES ('{learner}', 'kid', 'approach_pick', 'learn');""", 'learning_events_event_check')
    rows = run("SET ROLE service_role; SELECT lever || '|' || offered || '|' || exercised || '|' || coalesce(adoption_rate::text, '-') FROM learning_autonomy_adoption(now() - interval '1 day', now() + interval '1 day');").splitlines()
    table = {row.split('|')[0]: row.split('|')[1:] for row in rows}
    assert set(table) == {'path', 'pace', 'mentor', 'approach', 'enrichment'}, rows
    assert table['approach'] == ['2', '1', '0.5000'], table
    assert table['enrichment'] == ['2', '1', '0.5000'], table
    rejected("SET ROLE authenticated; SELECT * FROM learning_autonomy_adoption(now() - interval '1 day', now());", 'permission denied')
    check('learning_events admits the three autonomy events (and refuses an unknown one); learning_autonomy_adoption adds the approach and enrichment rows')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'Every migration applied in order on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal Supabase shim; fixture runs, versions and receipts inserted with replication-role replica (FKs skipped where noted, CHECKs and the tested triggers enforced); not PostgREST or deployed Core.',
}
if os.environ.get('LF_PG_REPORT'):
    Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks)}))
