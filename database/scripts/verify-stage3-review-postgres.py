"""GAP-FIX-R6 learning: Appendix C Part 3 Stage 3 (Pedagogical Human Review)
is recorded, and no lesson content reaches learners without a passing one,
against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, a minimal Supabase shim, EVERY migration applied
in order, then at the enforcing boundary (lesson_pedagogical_reviews,
lesson_pedagogical_review_writer, stage3_review_release_gate):

  - release_course, release_lesson, release_lesson_version and
    emergency_activate_lesson_version raise STAGE3_REVIEW_REQUIRED and move
    nothing while no passing review covers the content;
  - record_lesson_pedagogical_review refuses an actor without manage_content,
    an unknown lesson, a stale fingerprint, no / a non-staff / a mismatched
    author, the author reviewing their own content, a review that is not the
    ten items each with a 10-600 character finding (or marks a required item
    not applicable), and one that does not resolve every open Forge item once;
  - the result is derived (a failed item or a Forge item needing change fails
    the review, with its finding count), a failed review keeps the release
    refused, a passing one releases, and the review, the item resolutions and
    'content.stage3_review.recorded' commit together;
  - a content change after the review makes it stale; Forge's items (service
    role) are recorded once and block the release until resolved;
  - reviews and items are append-only (the erasure of an account nulls its id;
    the lesson's own deletion removes them); reviewer = author is refused by
    the table CHECK too;
  - the database owner passes only with lf.bypass_justification, audited;
  - no browser role reads the tables or calls a function.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP. Run by
database/scripts/learning-db-verify.mjs.
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

database = 'lf_stage3_review_' + uuid.uuid4().hex[:12]
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


FINDING = 'Checked against the Block B standard for this lesson.'


def checks_json(**overrides):
    items = run('SELECT string_agg(item, \',\' ORDER BY item_position) FROM stage3_review_items()').split(',')
    body = {item: {'result': 'pass', 'finding': FINDING} for item in items}
    for item, value in overrides.items():
        if value is None:
            body.pop(item)
        else:
            body[item] = value
    return json.dumps(body).replace("'", "''")


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    I = {k: str(uuid.uuid4()) for k in ('boss', 'editor', 'writer', 'analyst', 'learner', 'course', 'adv', 'saga', 'topic',
                                        'lesson', 'lesson2', 'draft', 'course2', 'topic2')}
    run(f"""
    INSERT INTO auth.users (id, email) VALUES ('{I['boss']}', 'boss@littlefounders.ai'), ('{I['editor']}', 'editor@littlefounders.ai'),
        ('{I['writer']}', 'writer@littlefounders.ai'), ('{I['analyst']}', 'analyst@littlefounders.ai'), ('{I['learner']}', 'learner@example.com');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['boss']}', 'superadmin', NULL), ('{I['editor']}', 'admin', '{I['boss']}'),
        ('{I['writer']}', 'admin', '{I['boss']}'), ('{I['analyst']}', 'admin', '{I['boss']}');
    INSERT INTO admin_permissions (user_id, permission) VALUES ('{I['editor']}', 'manage_content'), ('{I['analyst']}', 'view_analytics');
    INSERT INTO courses (id, slug, status, badge_asset) VALUES ('{I['course']}', 'stage3-course', 'draft', 'course-badges/stage3.png');
    INSERT INTO adventures (id, course_id, position, slug, theme, status) VALUES ('{I['adv']}', '{I['course']}', 1, 's3-adv', 'archipelago', 'draft');
    INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES ('{I['saga']}', '{I['adv']}', 1, 's3-saga', 'draft');
    INSERT INTO topics (id, saga_id, position, slug, status) VALUES ('{I['topic']}', '{I['saga']}', 1, 's3-topic', 'draft');
    INSERT INTO courses (id, slug, status, badge_asset) VALUES ('{I['course2']}', 'stage3-other', 'draft', 'course-badges/other.png');
    INSERT INTO adventures (id, course_id, position, slug, theme, status) VALUES ('{I['course2']}', '{I['course2']}', 1, 's3-adv-2', 'archipelago', 'draft');
    INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES ('{I['course2']}', '{I['course2']}', 1, 's3-saga-2', 'draft');
    INSERT INTO topics (id, saga_id, position, slug, status) VALUES ('{I['topic2']}', '{I['course2']}', 1, 's3-topic-2', 'draft');
    INSERT INTO lessons (id, topic_id, position, slug, status) VALUES ('{I['lesson']}', '{I['topic']}', 1, 's3-lesson', 'review'),
        ('{I['draft']}', '{I['topic2']}', 1, 's3-draft', 'draft');
    INSERT INTO lesson_documents (lesson_id, locale, document)
        SELECT l, loc, '{{"segments": [{{"id": "s1", "prompt": "Save first"}}]}}' FROM unnest(ARRAY['{I['lesson']}', '{I['draft']}']::uuid[]) AS l,
        unnest(ARRAY['en-US', 'es-MX', 'pt-BR']) AS loc;
    """)
    gates = run("SELECT string_agg(format('{\"gate\": \"%s\", \"ok\": true}', gate_id), ',') FROM forge_release_gates")
    verify = lambda: run(f"INSERT INTO course_release_verifications (course_id, checks, content_watermark) VALUES ('{I['course']}', '[{gates}]'::jsonb, forge_release_content_watermark('{I['course']}')) ON CONFLICT (course_id) DO UPDATE SET checks = EXCLUDED.checks, content_watermark = EXCLUDED.content_watermark")
    verify()
    status = lambda key: run(f"SELECT status FROM lessons WHERE id = '{I[key]}'")
    fp = lambda key: run(f"SELECT lesson_stage3_fingerprint('{I[key]}')")

    def review(actor, key, author, checks=None, items='[]', fingerprint=None, version='NULL'):
        fingerprint = 'NULL' if version != 'NULL' and fingerprint is None else f"'{fingerprint or fp(key)}'"
        author = 'NULL' if author is None else f"'{author}'"
        out = service(f"SELECT code || '|' || coalesce(result, '') FROM record_lesson_pedagogical_review('{actor}', '{I[key]}', {version}, {fingerprint}, {author}, '{checks or checks_json()}'::jsonb, '{items}'::jsonb)")
        return out.split('|')

    # ── No review: every release path refuses ──
    rejected(f"SET ROLE service_role; SELECT code FROM release_course('{I['editor']}', '{I['course']}')", 'STAGE3_REVIEW_REQUIRED')
    assert status('lesson') == 'review' and run(f"SELECT status FROM courses WHERE id = '{I['course']}'") == 'draft'
    assert service(f"SELECT lesson_stage3_review_state('{I['lesson']}') ->> 'refusal'") == 'no Stage 3 pedagogical review covers this content'
    check('without a Stage 3 review release_course raises STAGE3_REVIEW_REQUIRED and nothing is published')

    # ── The writer's refusals ──
    assert review(I['analyst'], 'lesson', I['writer'])[0] == 'FORBIDDEN'
    assert service(f"SELECT code FROM record_lesson_pedagogical_review('{I['editor']}', gen_random_uuid(), NULL, NULL, '{I['writer']}', '{{}}'::jsonb, '[]'::jsonb)") == 'NOT_FOUND'
    assert review(I['editor'], 'lesson', I['writer'], fingerprint='0' * 64)[0] == 'CONTENT_CHANGED'
    assert review(I['editor'], 'lesson', None)[0] == 'AUTHOR_REQUIRED'
    assert review(I['editor'], 'lesson', I['learner'])[0] == 'AUTHOR_NOT_STAFF'
    assert review(I['editor'], 'lesson', I['editor'])[0] == 'SELF_REVIEW'
    check('the writer refuses an actor without manage_content, an unknown lesson, a stale fingerprint, a missing or non-staff author, and a reviewer who authored the content')

    bad = [checks_json(working_memory=None),
           checks_json(feedback_scope={'result': 'pass', 'finding': 'ok'}),
           checks_json(working_memory={'result': 'not_applicable', 'finding': FINDING}),
           checks_json(practice_zone={'result': 'maybe', 'finding': FINDING}),
           checks_json(age_register={'result': 'pass', 'finding': FINDING, 'extra': 1}),
           checks_json(unknown_item={'result': 'pass', 'finding': FINDING})]
    for body in bad:
        assert review(I['editor'], 'lesson', I['writer'], checks=body)[0] == 'INVALID_REVIEW', body
    check('a review must answer exactly the ten items, each {result, finding}, with a 10-600 character finding; not_applicable only where the SPEC scopes the item')

    # ── Forge's Stage 3 items ──
    items = json.dumps([{'gate': 17, 'message': 'mystery-reward language "surprise": teaches, never offers (B.22)'},
                        {'gate': 14, 'message': 'introduces 4 new concepts, above the 6-9 target of 3'}])
    assert service(f"SELECT record_forge_stage3_items('{I['lesson']}', NULL, NULL, 'run-1', '{items}'::jsonb)") == '2'
    assert service(f"SELECT record_forge_stage3_items('{I['lesson']}', NULL, NULL, 'run-2', '{items}'::jsonb)") == '0'
    rejected(f"SET ROLE service_role; SELECT record_forge_stage3_items('{I['lesson']}', NULL, NULL, 'run-3', '[{{\"gate\": 120, \"message\": \"x\"}}]'::jsonb)", 'gate 1-99')
    open_ids = run(f"SELECT string_agg(id::text, ',' ORDER BY gate) FROM lesson_stage3_review_items WHERE lesson_id = '{I['lesson']}'").split(',')
    assert review(I['editor'], 'lesson', I['writer'])[0] == 'FORGE_ITEMS_UNRESOLVED'
    one = json.dumps([{'id': open_ids[0], 'resolution': 'acceptable', 'note': 'Concepts chunk onto the prior topic.'}])
    assert review(I['editor'], 'lesson', I['writer'], items=one)[0] == 'FORGE_ITEMS_UNRESOLVED'
    twice = json.dumps([{'id': open_ids[0], 'resolution': 'acceptable', 'note': 'Concepts chunk onto the prior topic.'}] * 2)
    assert review(I['editor'], 'lesson', I['writer'], items=twice)[0] == 'FORGE_ITEMS_UNRESOLVED'
    check('Forge records its Stage 3 flags once (a re-run adds none, a bad gate is refused), and a review must resolve every open flag exactly once')

    # ── A failing review: derived result, release still refused ──
    needs = json.dumps([{'id': open_ids[0], 'resolution': 'acceptable', 'note': 'Concepts chunk onto the prior topic.'},
                        {'id': open_ids[1], 'resolution': 'needs_change', 'note': 'The mystery chest reads as an offer.'}])
    failing = review(I['editor'], 'lesson', I['writer'], checks=checks_json(practice_zone={'result': 'fail', 'finding': 'Every practice item is near-certain to pass.'}), items=needs)
    assert failing == ['RECORDED', 'fail'], failing
    assert run(f"SELECT finding_count FROM lesson_pedagogical_reviews WHERE lesson_id = '{I['lesson']}'") == '2'
    assert run(f"SELECT count(*) FROM lesson_stage3_review_items WHERE lesson_id = '{I['lesson']}' AND review_id IS NOT NULL") == '2'
    rejected(f"SET ROLE service_role; SELECT code FROM release_course('{I['editor']}', '{I['course']}')", 'review of this content failed')
    check('the result is derived: a failed check and a Forge item needing change fail the review (2 findings), the items are resolved, and the release stays refused')

    # ── A passing review releases; everything commits together ──
    passing = review(I['editor'], 'lesson', I['writer'])
    assert passing == ['RECORDED', 'pass'], passing
    assert service(f"SELECT code FROM release_course('{I['editor']}', '{I['course']}')") == 'RELEASED'
    assert status('lesson') == 'published'
    assert run(f"SELECT count(*) || ':' || max(actor_id::text) FROM audit_logs WHERE action = 'content.stage3_review.recorded' AND subject = '{I['lesson']}'") == f"2:{I['editor']}"
    assert run(f"SELECT reviewer_id || ':' || author_id || ':' || author_source FROM lesson_pedagogical_reviews WHERE result = 'pass'") == f"{I['editor']}:{I['writer']}:named_by_reviewer"
    check('a passing review (reviewer and named author recorded, audit row by the reviewer) lets release_course publish the lesson')

    # ── A content change after the review makes it stale ──
    run(f"""INSERT INTO lessons (id, topic_id, position, slug, status) VALUES ('{I['lesson2']}', '{I['topic']}', 2, 's3-lesson-2', 'review');
        INSERT INTO lesson_documents (lesson_id, locale, document) SELECT '{I['lesson2']}', l, '{{"segments": []}}' FROM unnest(ARRAY['en-US', 'es-MX', 'pt-BR']) AS l;""")
    assert review(I['editor'], 'lesson2', I['writer']) == ['RECORDED', 'pass']
    before = fp('lesson2')
    run(f"UPDATE lesson_documents SET document = '{{\"segments\": [{{\"id\": \"s9\"}}]}}' WHERE lesson_id = '{I['lesson2']}' AND locale = 'pt-BR'")
    assert fp('lesson2') != before
    verify()
    rejected(f"SET ROLE service_role; SELECT code FROM release_lesson('{I['editor']}', '{I['lesson2']}')", 'no Stage 3 pedagogical review covers this content')
    assert status('lesson2') == 'review'
    assert review(I['editor'], 'lesson2', I['writer']) == ['RECORDED', 'pass']
    assert service(f"SELECT code FROM release_lesson('{I['editor']}', '{I['lesson2']}')") == 'RELEASED'
    check('a review covers the content it read: a later document change leaves release_lesson refused until the current content is reviewed')

    # ── Append-only, and the reviewer-is-not-author backstop ──
    rejected(f"UPDATE lesson_pedagogical_reviews SET result = 'pass', finding_count = 0 WHERE result = 'fail'", 'never edited or removed')
    rejected(f"DELETE FROM lesson_pedagogical_reviews WHERE result = 'fail'", 'never edited or removed')
    rejected(f"UPDATE lesson_stage3_review_items SET resolution = 'acceptable' WHERE resolution = 'needs_change'", 'never edited or removed')
    rejected(f"""INSERT INTO lesson_pedagogical_reviews (lesson_id, subject_kind, content_fingerprint, reviewer_id, author_id, author_source, result, finding_count, checks)
        VALUES ('{I['draft']}', 'lesson', '{'0' * 64}', '{I['editor']}', '{I['editor']}', 'named_by_reviewer', 'pass', 0, '{checks_json()}'::jsonb)""",
             'lesson_pedagogical_reviews_independent')
    run(f"DELETE FROM auth.users WHERE id = '{I['writer']}'")
    assert run(f"SELECT count(*) FROM lesson_pedagogical_reviews WHERE author_id IS NULL") == '4'
    assert review(I['editor'], 'draft', I['boss']) == ['RECORDED', 'pass']
    run(f"DELETE FROM lessons WHERE id = '{I['draft']}'")
    assert run(f"SELECT count(*) FROM lesson_pedagogical_reviews WHERE lesson_id = '{I['draft']}'") == '0'
    check('reviews and item resolutions are append-only; reviewer = author is refused by the table CHECK; an erased author is nulled and the lesson\'s own deletion removes its reviews')

    # ── v2 versions of a live lesson (G.2 queue) ──
    gate_ids = run("SELECT gate_id FROM forge_v2_manifest_gates ORDER BY gate_id").splitlines()
    manifest_checks = ', '.join('{"gate": "%s", "ok": true}' % gate for gate in gate_ids)

    def publish(version_id):
        verify()
        doc = f'{{"schema_version": 2, "lesson_id": "{I["lesson"]}", "locale": "es-MX", "version_id": "{version_id}", "segments": []}}'
        manifest = f'{{"lesson_id": "{I["lesson"]}", "locale": "es-MX", "version_id": "{version_id}", "core_contract": true, "interactive_behaviour": true, "run_id": "r6", "checks": [{manifest_checks}]}}'
        assert 'pending_staff_approval' in service(f"SELECT publish_v2_lesson_version('{I['lesson']}', 'es-MX', '{version_id}', '{doc}'::jsonb, '{{}}'::jsonb, '{manifest}'::jsonb)::text")
        return run(f"SELECT id FROM lesson_document_versions WHERE version_id = '{version_id}'")

    current = lambda: run(f"SELECT v.version_id FROM lesson_document_version_current c JOIN lesson_document_versions v ON v.id = c.document_version_id WHERE c.lesson_id = '{I['lesson']}' AND c.locale = 'es-MX'")
    new = publish('s3-rev-001')
    rejected(f"SET ROLE service_role; SELECT code FROM release_lesson_version('{I['editor']}', '{I['lesson']}', '{new}')", 'STAGE3_REVIEW_REQUIRED')
    assert current() == '' and run(f"SELECT status FROM lesson_version_activation_requests WHERE document_version_id = '{new}'") == 'pending'
    flag = json.dumps([{'gate': 18, 'message': 'hurry: the reviewer confirms the story never presses the learner (B.25)'}])
    assert service(f"SELECT record_forge_stage3_items('{I['lesson']}', 'es-MX', 's3-rev-001', 'r6', '{flag}'::jsonb)") == '1'
    version = f"'{new}'"
    assert review(I['editor'], 'lesson', I['boss'], version=version, fingerprint='0' * 64)[0] == 'INVALID_REVIEW'
    assert review(I['editor'], 'lesson', I['boss'], version=version)[0] == 'FORGE_ITEMS_UNRESOLVED'
    flag_id = run(f"SELECT id FROM lesson_stage3_review_items WHERE document_version_id = '{new}'")
    resolved = json.dumps([{'id': flag_id, 'resolution': 'acceptable', 'note': 'The story character hurries, never the learner.'}])
    state = json.loads(service(f"SELECT lesson_stage3_review_state('{I['lesson']}', '{new}')::text"))
    assert state['subject'] == 'version' and state['locale'] == 'es-MX' and len(state['open_items']) == 1 and state['refusal']
    assert {a['user_id'] for a in state['authors']} >= {I['boss'], I['editor']}
    assert review(I['editor'], 'lesson', I['boss'], version=version, items=resolved) == ['RECORDED', 'pass']
    assert service(f"SELECT code FROM release_lesson_version('{I['editor']}', '{I['lesson']}', '{new}')") == 'RELEASED'
    assert current() == 's3-rev-001'
    check('release_lesson_version raises STAGE3_REVIEW_REQUIRED until a version review resolving its Forge flag passes; the review state lists the flag and the staff authors')

    third = publish('s3-rev-002')
    why = 'Live lesson shows a wrong answer; verification service down'
    rejected(f"SET ROLE service_role; SELECT code FROM emergency_activate_lesson_version('{I['boss']}', '{I['lesson']}', '{third}', '{why}')", 'STAGE3_REVIEW_REQUIRED')
    assert review(I['boss'], 'lesson', I['editor'], version=f"'{third}'") == ['RECORDED', 'pass']
    assert service(f"SELECT code FROM emergency_activate_lesson_version('{I['boss']}', '{I['lesson']}', '{third}', '{why}')") == 'ACTIVATED'
    check('the emergency activation skips the course verification, never the Stage 3 review')

    # ── The owner's justified bypass ──
    fourth = publish('s3-rev-003')
    move = f"UPDATE lesson_document_version_current SET document_version_id = '{fourth}' WHERE lesson_id = '{I['lesson']}' AND locale = 'es-MX'"
    rejected(move, 'STAGE3_REVIEW_REQUIRED')
    rejected(f"BEGIN; SET LOCAL lf.bypass_justification = 'too short'; {move}; COMMIT;", 'STAGE3_REVIEW_REQUIRED')
    run(f"BEGIN; SET LOCAL lf.bypass_justification = 'Operator restore of the version live before the outage'; {move}; COMMIT;")
    assert run(f"SELECT detail ->> 'origin' FROM audit_logs WHERE action = 'content.stage3_review_bypassed'") == 'database-owner'
    check('the database owner passes only with a 20-600 character lf.bypass_justification, audited as content.stage3_review_bypassed')

    for role in ('anon', 'authenticated'):
        for query in ('SELECT count(*) FROM lesson_pedagogical_reviews', 'SELECT count(*) FROM lesson_stage3_review_items',
                      f"SELECT lesson_stage3_review_state('{I['lesson']}')", f"SELECT lesson_stage3_fingerprint('{I['lesson']}')",
                      f"SELECT stage3_release_refusal('{I['lesson']}')",
                      f"SELECT record_forge_stage3_items('{I['lesson']}', NULL, NULL, NULL, '[]'::jsonb)",
                      f"SELECT count(*) FROM record_lesson_pedagogical_review('{I['boss']}', '{I['lesson']}', NULL, NULL, NULL, '{{}}'::jsonb, '[]'::jsonb)"):
            rejected(f'SET ROLE {role}; {query}', 'permission denied')
    check('no browser role reads a review or an item, or calls a Stage 3 function')
    print(f'\n{len(checks)} checks passed on {database}')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
