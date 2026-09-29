"""GAP-FIX-R1 learning: mixed v2 completion, receipt signals, course-lesson KC
evidence and the lesson signal metrics, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim, applies
EVERY migration in database/migrations in order, and proves at the enforcing
boundary (migrations v2_mixed_lesson_completion, course_lesson_kc_evidence and
v2_learning_signal_metrics):

  - a non-scored step is recorded only on the learner's own live run, once;
  - complete_v2_mixed_lesson refuses while a graded step lacks a met receipt
    or a non-scored step lacks a view receipt, then completes (score 100 for
    a lesson with no graded step) and reports viewed_count and hints_used;
  - the receipt CHECK refuses an unknown diagnostic, hints above the ladder,
    an unknown item role and malformed detection counts;
  - kc_attempt accepts source 'course_lesson' only with a receipt key, and a
    second row for the same receipt is refused;
  - the four metric functions aggregate first tries;
  - each practised local day lands once in learning_practice_days (0208);
  - publish_v2_lesson_version (0209, redefined by *_v2_staff_release_approval)
    needs a current course verification and a manifest attesting this
    document, never reuses a version id, and for a live lesson only records a
    pending staff release (verify-content-release-postgres.py proves the rest);
  - no browser role can read the new tables or call the new functions.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP.
"""

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

database = 'lf_v2_learning_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(query):
    out = run('SET ROLE service_role;' + query)
    return out.splitlines()[-1] if out else ''


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

    learner, other = str(uuid.uuid4()), str(uuid.uuid4())
    course, adventure, saga, topic, lesson = (str(uuid.uuid4()) for _ in range(5))
    version, run_id, empty_version, empty_run = (str(uuid.uuid4()) for _ in range(4))
    run(f"""
    INSERT INTO auth.users (id, email) VALUES ('{learner}', 'learner@example.com'), ('{other}', 'other@example.com');
    INSERT INTO public.learning_stats (user_id) VALUES ('{learner}'), ('{other}') ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO courses (id, slug) VALUES ('{course}', 'gap-course');
    INSERT INTO adventures (id, course_id, position, slug, theme) VALUES ('{adventure}', '{course}', 1, 'gap-adventure', 'archipelago');
    INSERT INTO sagas (id, adventure_id, position, slug) VALUES ('{saga}', '{adventure}', 1, 'gap-saga');
    INSERT INTO topics (id, saga_id, position, slug) VALUES ('{topic}', '{saga}', 1, 'gap-topic');
    INSERT INTO lessons (id, topic_id, position, slug, xp_total) VALUES ('{lesson}', '{topic}', 1, 'gap-lesson', 20);
    INSERT INTO lesson_document_versions (id, lesson_id, locale, version_id, schema_version, document, answer_keys)
        VALUES ('{version}', '{lesson}', 'en-US', 'mixed-rev-001', 2, '{{}}', '{{}}'),
               ('{empty_version}', '{lesson}', 'en-US', 'visual-rev-001', 2, '{{}}', '{{}}');
    INSERT INTO lesson_v2_runs (id, user_id, lesson_id, locale, document_version_id, expires_at)
        VALUES ('{run_id}', '{learner}', '{lesson}', 'en-US', '{version}', now() + interval '1 hour'),
               ('{empty_run}', '{learner}', '{lesson}', 'en-US', '{empty_version}', now() + interval '1 hour');
    """)

    # View receipts: only the learner's own live run, idempotent.
    assert service(f"SELECT record_v2_segment_view('{learner}', '{run_id}', '{version}', 'intro-01')") == 't'
    assert service(f"SELECT record_v2_segment_view('{learner}', '{run_id}', '{version}', 'intro-01')") == 't'
    assert run(f"SELECT count(*) FROM lesson_v2_segment_views WHERE run_id = '{run_id}'") == '1'
    rejected(f"SET ROLE service_role; SELECT record_v2_segment_view('{other}', '{run_id}', '{version}', 'goal-01')", 'Invalid v2 lesson run')
    check("a view receipt is recorded once, and only on the learner's own run")

    # A graded step: nonce + ordered grade with the new signals.
    jti = 'jti' + uuid.uuid4().hex + 'abcdefgh'
    run(f"""INSERT INTO lesson_v2_attempt_nonces (jti, user_id, run_id, document_version_id, segment_id, expires_at)
        VALUES ('{jti}', '{learner}', '{run_id}', '{version}', 'story-01', now() + interval '1 hour');""")
    rejected(f"""SET ROLE service_role; SELECT complete_v2_mixed_lesson('{learner}', '{lesson}', '{run_id}', '{version}',
        ARRAY['story-01'], ARRAY['intro-01'], 20, 1, current_date)""", 'pending learning steps')
    check('completion refuses a graded step without a met receipt')
    service(f"""SELECT record_v2_lesson_grade_ordered('{learner}', '{run_id}', '{version}', 'story-01', '{jti}',
        '{{"correct": true, "score": 100, "diagnostic": "none", "hints_used": 2, "item_role": "transfer", "kc": "kc-saving-goal"}}'::jsonb)""")
    rejected(f"""SET ROLE service_role; SELECT complete_v2_mixed_lesson('{learner}', '{lesson}', '{run_id}', '{version}',
        ARRAY['story-01'], ARRAY['intro-01', 'goal-01'], 20, 1, current_date)""", 'pending learning steps')
    check('completion refuses a non-scored step without a view receipt')
    service(f"SELECT record_v2_segment_view('{learner}', '{run_id}', '{version}', 'goal-01')")
    result = service(f"""SELECT complete_v2_mixed_lesson('{learner}', '{lesson}', '{run_id}', '{version}',
        ARRAY['story-01'], ARRAY['intro-01', 'goal-01'], 20, 1, current_date)::text""")
    assert '"viewed_count": 2' in result and '"hints_used": 2' in result and '"score": 100' in result, result
    rejected(f"SET ROLE service_role; SELECT record_v2_segment_view('{learner}', '{run_id}', '{version}', 'late-01')", 'Invalid v2 lesson run')
    check('a mixed lesson completes with its view and hint counts; a completed run takes no more views')

    service(f"SELECT record_v2_segment_view('{learner}', '{empty_run}', '{empty_version}', 'intro-01')")
    visual = service(f"""SELECT complete_v2_mixed_lesson('{learner}', '{lesson}', '{empty_run}', '{empty_version}',
        ARRAY[]::text[], ARRAY['intro-01'], 20, 1, current_date)::text""")
    assert '"score": 100' in visual and '"graded_count": 0' in visual, visual
    rejected(f"""SET ROLE service_role; SELECT complete_v2_mixed_lesson('{learner}', '{lesson}', '{empty_run}', '{empty_version}',
        ARRAY[]::text[], ARRAY[]::text[], 20, 1, current_date)""", 'Invalid v2 completion input')
    check('a visual-only lesson completes from view receipts (score 100); an empty completion is refused')

    for verdict, name in (('{"correct": false, "score": 0, "diagnostic": "guess"}', 'unknown diagnostic'),
                          ('{"correct": false, "score": 0, "hints_used": 3}', 'hints above the ladder'),
                          ('{"correct": false, "score": 0, "item_role": "exam"}', 'unknown item role'),
                          ('{"correct": false, "score": 0, "detection": {"hits": 1}}', 'partial detection counts')):
        bad = 'jti' + uuid.uuid4().hex + 'abcdefgh'
        run(f"""INSERT INTO lesson_v2_attempt_nonces (jti, user_id, run_id, document_version_id, segment_id, expires_at)
            VALUES ('{bad}', '{learner}', '{empty_run}', '{empty_version}', 'x-01', now() + interval '1 hour');""")
        rejected(f"""INSERT INTO lesson_v2_grade_receipts (jti, user_id, run_id, document_version_id, segment_id, verdict)
            VALUES ('{bad}', '{learner}', '{empty_run}', '{empty_version}', 'x-01', '{verdict}'::jsonb)""", 'lesson_v2_grade_receipts_signals_check')
        check(f'the receipt CHECK refuses {name}')

    # 0208: the completion above set last_active_date; the trigger recorded the practised local day, once.
    assert run(f"SELECT count(*) FROM learning_practice_days WHERE user_id = '{learner}' AND local_date = current_date") == '1'
    run(f"UPDATE learning_stats SET last_active_date = current_date + 1 WHERE user_id = '{learner}'")
    assert run(f"SELECT count(*) FROM learning_practice_days WHERE user_id = '{learner}'") == '2'
    rejected("SET ROLE authenticated; SELECT count(*) FROM learning_practice_days", 'permission denied')
    check('each practised local day is recorded once by the learning_stats trigger, and no browser role reads it')

    kc = str(uuid.uuid4())
    run(f"""INSERT INTO kc (id, key, strand, title, objective) VALUES ('{kc}', 'gap-kc', 'money_math', '{{"en-US": "Gap"}}', '{{"en-US": "Gap"}}');""")
    base_row = f"'{learner}', '{kc}', 'course_lesson', true, 100, 0.2, 0.5"
    rejected(f"INSERT INTO kc_attempt (user_id, kc_id, source, correct, score, p_known_before, p_known_after) VALUES ({base_row})",
             'kc_attempt_course_lesson_receipt')
    run(f"INSERT INTO kc_attempt (user_id, kc_id, source, correct, score, p_known_before, p_known_after, receipt_key) VALUES ({base_row}, 'v2:{jti}')")
    rejected(f"INSERT INTO kc_attempt (user_id, kc_id, source, correct, score, p_known_before, p_known_after, receipt_key) VALUES ({base_row}, 'v2:{jti}')",
             'uq_kc_attempt_receipt')
    rejected(f"INSERT INTO kc_attempt (user_id, kc_id, source, correct, score, p_known_before, p_known_after) VALUES ('{learner}', '{kc}', 'forged', true, 100, 0.2, 0.5)",
             'kc_attempt_source_check')
    check('course-lesson evidence needs a receipt key, once per receipt; unknown sources stay refused')

    transfer = service("SELECT string_agg(kc || ':' || item_role || ':' || successes || '/' || first_attempts, ',') FROM learning_transfer_success(now() - interval '1 day', now() + interval '1 day')")
    assert transfer == 'kc-saving-goal:transfer:1/1', transfer
    assert service("SELECT count(*) FROM learning_error_family_split(now() - interval '1 day', now() + interval '1 day')") == '0'
    assert service("SELECT count(*) FROM learning_first_unaided_stage_distribution(now() - interval '1 day', now() + interval '1 day')") == '0'
    assert service("SELECT count(*) FROM learning_detection_cells(now() - interval '1 day', now() + interval '1 day')") == '0'
    check('the metric functions aggregate first tries (transfer 1/1 on its KC)')

    # 0209: the reviewed publication transaction is the one way a published lesson's v2 pointer moves.
    pub_version = 'pub-rev-001'
    doc = f'{{"schema_version": 2, "lesson_id": "{lesson}", "locale": "es-MX", "version_id": "{pub_version}", "segments": []}}'
    # The gates a v2 manifest must attest are the forge_v2_manifest_gates rows (GAP-FIX-R2 carried gates 2, 3, 4, 17, 18
    # joined the original list); read them from the chain rather than a copy, so a new gate never stales this proof.
    gate_ids = run("SELECT gate_id FROM forge_v2_manifest_gates ORDER BY gate_id").splitlines()
    as_checks = lambda ids: ', '.join('{"gate": "%s", "ok": true}' % gate for gate in ids)
    gates = as_checks(gate_ids)
    manifest = f'{{"lesson_id": "{lesson}", "locale": "es-MX", "version_id": "{pub_version}", "core_contract": true, "interactive_behaviour": true, "run_id": "audit", "checks": [{gates}]}}'
    short = manifest.replace(gates, as_checks(gate_ids[1:]))
    call = lambda m: f"SET ROLE service_role; SELECT publish_v2_lesson_version('{lesson}', 'es-MX', '{pub_version}', '{doc}'::jsonb, '{{}}'::jsonb, '{m}'::jsonb)"
    run(f"UPDATE lessons SET status = 'published' WHERE id = '{lesson}'")
    rejected(f"SET ROLE service_role; INSERT INTO lesson_document_version_current (lesson_id, locale, document_version_id) VALUES ('{lesson}', 'en-US', '{version}')",
             'reviewed publication transaction')
    check('a direct pointer move on a published lesson is still refused')
    rejected(call(manifest), 'Course verification refused')
    all_gates = run("SELECT string_agg(format('{\"gate\": \"%s\", \"ok\": true}', gate_id), ',') FROM forge_release_gates")
    run(f"INSERT INTO course_release_verifications (course_id, checks, content_watermark) VALUES ('{course}', '[{all_gates}]'::jsonb, forge_release_content_watermark('{course}'))")
    rejected(call(short), 'release manifest is missing')
    rejected(call(manifest.replace('"interactive_behaviour": true', '"interactive_behaviour": false')), 'does not attest')
    published = service(call(manifest) + '::text')
    assert '"version_id": "pub-rev-001"' in published and '"activation": "pending_staff_approval"' in published, published
    # G.2 (GAP-FIX-R2, *_v2_staff_release_approval.sql): the new version of a live lesson waits for a staff release.
    assert run(f"SELECT count(*) FROM lesson_document_version_current c JOIN lesson_document_versions v ON v.id = c.document_version_id WHERE c.lesson_id = '{lesson}' AND c.locale = 'es-MX' AND v.version_id = '{pub_version}'") == '0'
    assert run(f"SELECT count(*) FROM lesson_version_activation_requests WHERE lesson_id = '{lesson}' AND version_id = '{pub_version}' AND status = 'pending'") == '1'
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'forge.v2_lesson_version_submitted' AND subject = '{lesson}'") == '1'
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'forge.v2_lesson_published' AND subject = '{lesson}'") == '0'
    check('the reviewed transaction stores an attested document of a live lesson as pending (no pointer move); a stale course, a missing gate or an unattested behaviour gate is refused')
    rejected(call(manifest), 'versions are immutable')
    check('a published version id is never reused')

    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT publish_v2_lesson_version('{lesson}', 'es-MX', 'x-rev-9', '{{}}'::jsonb, '{{}}'::jsonb, '{{}}'::jsonb)", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT count(*) FROM lesson_v2_segment_views", 'permission denied')
        for fn in ("record_v2_segment_view(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'x')",
                   "learning_transfer_success(now(), now())", "learning_detection_cells(now(), now())"):
            rejected(f"SET ROLE {role}; SELECT {fn}", 'permission denied')
    check('no browser role reads the view table or calls the new functions')
    print(f'\n{len(checks)} checks passed on {database}')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
