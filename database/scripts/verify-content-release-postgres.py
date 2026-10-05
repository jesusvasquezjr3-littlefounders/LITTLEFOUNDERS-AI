"""GAP-FIX-R2 staff-ops: G.2's human staff approval for a live lesson's new v2
version, the justified owner bypass and the 30-day retroactive release check
(Appendix N 1.2, 2.3), against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, a minimal Supabase shim, EVERY migration applied
in order, then at the enforcing boundary:

  - the service role alone cannot put a published lesson's new version live:
    publish_v2_lesson_version records a pending request and moves no pointer,
    a direct pointer write is refused, the internal activation function is not
    callable, and release_lesson_version refuses an actor without
    manage_content;
  - a staff release re-runs the course verification (stale: refused), then
    moves the pointer with activated_by and an audit row naming the staff
    actor; a second decision is refused; a rejection needs a reason;
  - the emergency activation needs a Superadmin AND a 20-600 character
    justification (each attempt without is refused), and opens a retroactive
    check carrying the justification;
  - the database owner's patch of a live document is refused without
    lf.bypass_justification and opens a check with it;
  - a complete, current Forge verification of the course closes every open
    check logged before it and records the closing (content.retro_check_closed);
    an incomplete one closes nothing;
  - a check past 30 days is overdue, and content_bypass_metrics counts it;
  - no browser role reads the new tables or calls the new functions.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP. Run by
database/scripts/staff-analytics-db-verify.mjs.
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

database = 'lf_content_release_' + uuid.uuid4().hex[:12]
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

    I = {k: str(uuid.uuid4()) for k in ('boss', 'editor', 'analyst', 'course', 'adv', 'saga', 'topic', 'lesson', 'old')}
    # The fixture lesson is live before this proof starts: its pointer is set under the owner's justified
    # bypass of the Stage 3 gate (GAP-FIX-R6, stage3_review_release_gate).
    run(f"""BEGIN; SET LOCAL lf.bypass_justification = 'Fixture: the lesson is live before this proof starts';
    INSERT INTO auth.users (id, email) VALUES ('{I['boss']}', 'boss@littlefounders.ai'), ('{I['editor']}', 'editor@littlefounders.ai'), ('{I['analyst']}', 'analyst@littlefounders.ai');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['boss']}', 'superadmin', NULL), ('{I['editor']}', 'admin', '{I['boss']}'), ('{I['analyst']}', 'admin', '{I['boss']}');
    INSERT INTO admin_permissions (user_id, permission) VALUES ('{I['editor']}', 'manage_content'), ('{I['analyst']}', 'view_analytics');
    INSERT INTO courses (id, slug, status, badge_asset) VALUES ('{I['course']}', 'retro-course', 'published', 'course-badges/retro.png');
    INSERT INTO adventures (id, course_id, position, slug, theme, status) VALUES ('{I['adv']}', '{I['course']}', 1, 'retro-adv', 'archipelago', 'published');
    INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES ('{I['saga']}', '{I['adv']}', 1, 'retro-saga', 'published');
    INSERT INTO topics (id, saga_id, position, slug, status) VALUES ('{I['topic']}', '{I['saga']}', 1, 'retro-topic', 'published');
    INSERT INTO lessons (id, topic_id, position, slug, status) VALUES ('{I['lesson']}', '{I['topic']}', 1, 'retro-lesson', 'published');
    INSERT INTO lesson_document_versions (id, lesson_id, locale, version_id, schema_version, document, answer_keys)
        VALUES ('{I['old']}', '{I['lesson']}', 'es-MX', 'old-rev-001', 2, '{{}}', '{{}}');
    INSERT INTO lesson_document_version_current (lesson_id, locale, document_version_id) VALUES ('{I['lesson']}', 'es-MX', '{I['old']}');
    INSERT INTO lesson_documents (lesson_id, locale, document) VALUES ('{I['lesson']}', 'es-MX', '{{"segments": [{{"id": "s1", "prompt": "Hola"}}]}}');
    COMMIT;""")

    # GAP-FIX-R6: a live lesson's new version goes live only with a passing Stage 3 review of that version,
    # recorded by a content admin who did not author it (verify-stage3-review-postgres.py proves the gate).
    def stage3_pass(version):
        code = service(f"""SELECT code FROM record_lesson_pedagogical_review('{I['editor']}', '{I['lesson']}', '{version}', NULL, '{I['boss']}',
            (SELECT jsonb_object_agg(item, jsonb_build_object('result', 'pass', 'finding', 'Meets the Block B standard for this lesson.')) FROM stage3_review_items()), '[]'::jsonb)""")
        assert code == 'RECORDED', code
    all_gates = run("SELECT string_agg(format('{\"gate\": \"%s\", \"ok\": true}', gate_id), ',') FROM forge_release_gates")
    verify = lambda: run(f"INSERT INTO course_release_verifications (course_id, checks, content_watermark) VALUES ('{I['course']}', '[{all_gates}]'::jsonb, forge_release_content_watermark('{I['course']}')) ON CONFLICT (course_id) DO UPDATE SET checks = EXCLUDED.checks, content_watermark = EXCLUDED.content_watermark")
    verify()

    # The gates a v2 manifest must carry are read from the database (forge_v2_manifest_gates),
    # never listed here: a later migration that adds one would otherwise break this proof unseen.
    gate_ids = run("SELECT gate_id FROM forge_release_gates WHERE gate_id IN (SELECT gate_id FROM forge_v2_manifest_gates) ORDER BY gate_id").splitlines()
    gates = ', '.join('{"gate": "%s", "ok": true}' % gate for gate in gate_ids)

    def publish(version_id, segments='[]', answer_keys='{}'):
        doc = f'{{"schema_version": 2, "lesson_id": "{I["lesson"]}", "locale": "es-MX", "version_id": "{version_id}", "segments": {segments}}}'
        manifest = f'{{"lesson_id": "{I["lesson"]}", "locale": "es-MX", "version_id": "{version_id}", "core_contract": true, "interactive_behaviour": true, "run_id": "r2", "checks": [{gates}]}}'
        return service(f"SELECT publish_v2_lesson_version('{I['lesson']}', 'es-MX', '{version_id}', '{doc}'::jsonb, '{answer_keys}'::jsonb, '{manifest}'::jsonb)::text")

    current = lambda: run(f"SELECT v.version_id FROM lesson_document_version_current c JOIN lesson_document_versions v ON v.id = c.document_version_id WHERE c.lesson_id = '{I['lesson']}' AND c.locale = 'es-MX'")
    version_of = lambda vid: run(f"SELECT id FROM lesson_document_versions WHERE version_id = '{vid}'")

    # ── G.2: the service role alone cannot activate a live lesson's new version ──
    assert '"activation": "pending_staff_approval"' in publish('new-rev-001')
    new = version_of('new-rev-001')
    retry = publish('new-rev-001')
    assert '"activation": "pending_staff_approval"' in retry and '"idempotent": true' in retry, retry
    assert run(f"SELECT count(*) FROM lesson_document_versions WHERE lesson_id = '{I['lesson']}' AND locale = 'es-MX' AND version_id = 'new-rev-001'") == '1'
    assert run(f"SELECT count(*) FROM lesson_version_activation_requests WHERE document_version_id = '{new}'") == '1'
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'forge.v2_lesson_version_submitted' AND detail ->> 'document_version_id' = '{new}'") == '1'
    rejected("SET ROLE service_role; " +
             f"SELECT publish_v2_lesson_version('{I['lesson']}', 'es-MX', 'new-rev-001', " +
             f"'{{\"schema_version\": 2, \"lesson_id\": \"{I['lesson']}\", \"locale\": \"es-MX\", \"version_id\": \"new-rev-001\", \"segments\": [{{\"id\": \"changed\"}}]}}'::jsonb, " +
             f"'{{}}'::jsonb, '{{\"lesson_id\": \"{I['lesson']}\", \"locale\": \"es-MX\", \"version_id\": \"new-rev-001\", \"core_contract\": true, \"interactive_behaviour\": true, \"checks\": [{gates}]}}'::jsonb)",
             'different content digests')
    try:
        publish('new-rev-001', answer_keys='{"changed": "key"}')
    except RuntimeError as error:
        assert 'different content digests' in str(error), str(error)
    else:
        raise AssertionError('reusing a v2 identity with different answer keys succeeded')
    assert current() == 'old-rev-001'
    rejected(f"SET ROLE service_role; UPDATE lesson_document_version_current SET document_version_id = '{new}' WHERE lesson_id = '{I['lesson']}'", 'reviewed publication transaction')
    rejected(f"SET ROLE service_role; SELECT activate_lesson_version_request(gen_random_uuid(), NULL)", 'permission denied')
    refused = service(f"SELECT code FROM release_lesson_version(NULL, '{I['lesson']}', '{new}')")
    assert refused == 'FORBIDDEN', refused
    assert service(f"SELECT code FROM release_lesson_version('{I['analyst']}', '{I['lesson']}', '{new}')") == 'FORBIDDEN'
    assert current() == 'old-rev-001'
    check('G.2: publish_v2_lesson_version on a live lesson stores one pending request and moves no pointer; an identical retry is idempotent, a digest conflict is refused, and the service role cannot move the pointer, call the internal activation, or release without an actor holding manage_content')

    # ── The staff release re-runs the course verification ──
    run(f"BEGIN; SET LOCAL lf.bypass_justification = 'Correcting a price typo while the release is queued'; UPDATE lesson_documents SET document = '{{\"segments\": [{{\"id\": \"s1\", \"prompt\": \"Hola!\"}}]}}' WHERE lesson_id = '{I['lesson']}'; COMMIT;")
    stale = service(f"SELECT code FROM release_lesson_version('{I['editor']}', '{I['lesson']}', '{new}')")
    assert stale == 'VERIFICATION_REQUIRED', stale
    verify()
    stage3_pass(new)
    assert service(f"SELECT code FROM release_lesson_version('{I['editor']}', '{I['lesson']}', '{new}')") == 'RELEASED'
    assert current() == 'new-rev-001'
    activated_retry = publish('new-rev-001')
    assert '"activation": "activated"' in activated_retry and '"idempotent": true' in activated_retry, activated_retry
    assert run(f"SELECT activated_by FROM lesson_document_version_current WHERE lesson_id = '{I['lesson']}' AND locale = 'es-MX'") == I['editor']
    assert run(f"SELECT actor_id FROM audit_logs WHERE action = 'content.v2_version_released' AND subject = '{I['lesson']}'") == I['editor']
    assert service(f"SELECT code FROM release_lesson_version('{I['editor']}', '{I['lesson']}', '{new}')") == 'NOT_PENDING'
    check('a staff release is refused on a stale course verification, then moves the pointer with the staff actor on the pointer and the audit row; a second decision is refused')

    verify()  # the release moved the pointer, so the course needs a fresh verification before the next publication
    assert '"activation": "pending_staff_approval"' in publish('new-rev-002')
    second = version_of('new-rev-002')
    assert service(f"SELECT code FROM reject_lesson_version('{I['editor']}', '{I['lesson']}', '{second}', 'short')") == 'INVALID_REASON'
    assert service(f"SELECT code FROM reject_lesson_version('{I['editor']}', '{I['lesson']}', '{second}', 'The example uses a foreign currency.')") == 'REJECTED'
    assert run(f"SELECT status FROM lesson_version_activation_requests WHERE document_version_id = '{second}'") == 'rejected'
    assert current() == 'new-rev-001'
    check('a rejection needs a 10-600 character reason, is audited, and changes nothing a learner sees')

    # ── The emergency activation (G.2's retained bypass) ──
    assert '"activation": "pending_staff_approval"' in publish('new-rev-003')
    third = version_of('new-rev-003')
    why = 'Live lesson shows a wrong answer; verification service down'
    assert service(f"SELECT code FROM emergency_activate_lesson_version('{I['editor']}', '{I['lesson']}', '{third}', '{why}')") == 'FORBIDDEN'
    assert service(f"SELECT code FROM emergency_activate_lesson_version('{I['boss']}', '{I['lesson']}', '{third}', 'urgent')") == 'JUSTIFICATION_REQUIRED'
    assert service(f"SELECT code FROM emergency_activate_lesson_version('{I['boss']}', '{I['lesson']}', '{third}', NULL)") == 'JUSTIFICATION_REQUIRED'
    assert current() == 'new-rev-001'
    stage3_pass(third)
    assert service(f"SELECT code FROM emergency_activate_lesson_version('{I['boss']}', '{I['lesson']}', '{third}', '{why}')") == 'ACTIVATED'
    assert current() == 'new-rev-003'
    assert run(f"SELECT justification FROM content_retro_checks WHERE action = 'content.v2_emergency_activation'") == why
    assert run(f"SELECT detail ->> 'justification' FROM audit_logs WHERE action = 'content.v2_emergency_activation'") == why
    check('the emergency activation is refused without a Superadmin or without a 20-600 character justification; with both it activates and opens a retroactive check carrying the justification')

    # ── The owner's patch needs a justification and opens a check ──
    rejected(f"UPDATE lesson_documents SET document = '{{\"segments\": []}}' WHERE lesson_id = '{I['lesson']}'", 'needs a justification')
    rejected(f"BEGIN; SET LOCAL lf.bypass_justification = 'too short'; DELETE FROM lesson_documents WHERE lesson_id = '{I['lesson']}'; COMMIT;", 'needs a justification')
    owner_checks = run("SELECT count(*) FROM content_retro_checks WHERE action = 'content.live_document_patched' AND justification IS NOT NULL")
    assert owner_checks == '1', owner_checks
    check('the database owner cannot patch or delete a live document without lf.bypass_justification (20-600 characters); a justified patch opens a retroactive check with the text')

    # ── Closing: a complete, current verification of the course ──
    open_before = run(f"SELECT count(*) FROM content_retro_checks WHERE course_id = '{I['course']}' AND closed_at IS NULL")
    # The first owner patch was closed by the verification that preceded the release; the emergency activation is open.
    assert open_before == '1', open_before
    run(f"UPDATE course_release_verifications SET checks = '[]'::jsonb, content_watermark = forge_release_content_watermark('{I['course']}') WHERE course_id = '{I['course']}'")
    assert run(f"SELECT count(*) FROM content_retro_checks WHERE closed_at IS NULL") == '1'
    verify()
    assert run(f"SELECT count(*) FROM content_retro_checks WHERE closed_at IS NULL") == '0'
    assert run("SELECT count(*) FROM content_retro_checks WHERE closing_verified_at IS NOT NULL") == '2'
    assert run(f"SELECT detail ->> 'closed' FROM audit_logs WHERE action = 'content.retro_check_closed' AND subject = '{I['course']}' ORDER BY id DESC LIMIT 1") == '1'
    states = service("SELECT string_agg(state, ',' ORDER BY id) FROM content_bypass_checks(90)")
    assert states == 'closed,closed', states
    check('an incomplete verification closes nothing; a complete, current Forge verification of the course closes every earlier check and records it (closing_verified_at, content.retro_check_closed)')

    # ── Overdue: a check past its 30 days ──
    run(f"BEGIN; SET LOCAL lf.bypass_justification = 'Second hotfix of the live prompt wording'; UPDATE lesson_documents SET document = '{{\"segments\": [{{\"id\": \"s1\", \"prompt\": \"Hola!!\"}}]}}' WHERE lesson_id = '{I['lesson']}'; COMMIT;")
    run("UPDATE content_retro_checks SET occurred_at = now() - interval '40 days', due_at = now() - interval '10 days' WHERE closed_at IS NULL")
    assert service("SELECT state FROM content_bypass_checks(90) WHERE closed_at IS NULL") == 'overdue'
    metrics = service("SELECT publish_actions || ',' || bypasses || ',' || decided || ',' || unverified || ',' || complete || ',' || overdue_open FROM content_bypass_metrics(90)")
    # 1 staff release + 3 bypasses; all 3 decided; 1 unverified (overdue); 2 complete; 1 overdue open.
    assert metrics == '4,3,3,1,2,1', metrics
    check('a check past its 30 days reads overdue, and content_bypass_metrics counts it (bypass rate 1/4, completeness 2/3)')

    for role in ('anon', 'authenticated'):
        for query in ('SELECT count(*) FROM lesson_version_activation_requests', 'SELECT count(*) FROM content_retro_checks',
                      'SELECT count(*) FROM content_bypass_checks(30)', 'SELECT count(*) FROM content_bypass_metrics(30)',
                      f"SELECT count(*) FROM release_lesson_version('{I['boss']}', '{I['lesson']}', '{third}')",
                      f"SELECT count(*) FROM emergency_activate_lesson_version('{I['boss']}', '{I['lesson']}', '{third}', 'x')"):
            rejected(f'SET ROLE {role}; {query}', 'permission denied')
    check('no browser role reads the request queue or the checks, or calls a release, reject, emergency or metrics function')
    print(f'\n{len(checks)} checks passed on {database}')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
