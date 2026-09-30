"""GAP-FIX-R7 learning: Appendix C 1.1 "Decision Journal Coverage & Resurfacing
Rate" (B.9) has its coverage denominator, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, a minimal Supabase shim, EVERY migration applied
in order, then at the enforcing boundary (learning_narrative_metrics as
replaced by decision_journal_coverage):

  - story_decisions_made counts distinct (learner, lesson, segment) story
    decisions graded in the window, on both engines: v1 attempts on a
    story_branch with a real choice, a dialogue_choice and a would_you_rather;
    v2 receipts on story.branch.v2 and story.would-you-rather.v2. A replay
    counts once. A one-choice story, a quiz, a v2 non-story kind, an attempt
    outside the window and a malformed document count nothing (and raise
    nothing);
  - story_decisions_journaled counts the ones the journal holds, so a
    DELIBERATELY UNJOURNALED decision (the best-effort write that failed)
    shows as made and not journaled: coverage 5 / 6;
  - a migrated child without the learning.decision_journal consent (OD-9) is
    reported apart as story_decisions_without_consent: the consent trigger
    dropped the journal write, so the decision is not counted as lost;
  - the keys the metric already returned (recorded, resurfaced) are unchanged;
  - no browser role calls the metric or its helpers.

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

database = 'lf_journal_coverage_' + uuid.uuid4().hex[:12]
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


def lit(value):
    return json.dumps(value).replace("'", "''")


V1_DOCUMENT = {'segments': [
    {'id': 'branch', 'type': 'story_branch', 'prompt_md': 'Price it', 'payload': {'nodes': [
        {'id': 'start', 'text_md': 'What price brings me closer to the guitar?', 'choices': [
            {'id': 'p5', 'text_md': 'Five coins', 'next': 'end'}, {'id': 'p10', 'text_md': 'Ten coins', 'next': 'end'}]},
        {'id': 'end', 'text_md': 'The stall opens.', 'choices': []}]}},
    {'id': 'linear', 'type': 'story_branch', 'prompt_md': 'Walk on', 'payload': {'nodes': [
        {'id': 'start', 'text_md': 'The market opens.', 'choices': [{'id': 'go', 'text_md': 'Continue', 'next': 'end'}]},
        {'id': 'end', 'text_md': 'Done.', 'choices': []}]}},
    {'id': 'talk', 'type': 'dialogue_choice', 'prompt_md': 'Talk to Rho', 'payload': {'turns': [
        {'id': 't1', 'npc_md': 'Spend it now or save it?', 'replies': [{'id': 'now', 'text_md': 'Now'}, {'id': 'save', 'text_md': 'Save'}]}]}},
    {'id': 'wyr', 'type': 'would_you_rather', 'prompt_md': 'Now or later?', 'payload': {
        'a': {'text_md': 'A treat today'}, 'b': {'text_md': 'A bike in a month'}}},
    {'id': 'quiz', 'type': 'quiz_mcq', 'prompt_md': 'Pick one', 'payload': {'options': [{'id': 'x'}, {'id': 'y'}]}},
]}

V2_DOCUMENT = {'segments': [
    {'id': 'v2-branch', 'type': 'story.branch.v2', 'prompt': 'What should Zara do?', 'payload': {'scene': 'Zara has ten coins.', 'options': [
        {'id': 'save', 'label': 'Save them'}, {'id': 'spend', 'label': 'Spend them'}]}},
    {'id': 'v2-wyr', 'type': 'story.would-you-rather.v2', 'prompt': 'Which would you rather?', 'payload': {'options': [
        {'id': 'a', 'label': 'A treat today'}, {'id': 'b', 'label': 'A bike later'}]}},
    {'id': 'v2-quiz', 'type': 'logic.scam-spotter.v2', 'prompt': 'Spot the scam', 'payload': {}},
]}


def decision(segment, point, kind, choice):
    return {'segment_id': segment, 'decision_point': point, 'segment_type': kind, 'situation_text': 'What would you do?',
            'choice_id': choice, 'choice_text': 'This one', 'outcome_text': None}


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    I = {k: str(uuid.uuid4()) for k in ('one', 'two', 'child', 'course', 'adv', 'saga', 'topic', 'lesson', 'lesson_v2', 'broken',
                                        'version', 'run_one')}
    run(f"""
    INSERT INTO auth.users (id, email) VALUES ('{I['one']}', 'one@example.com'), ('{I['two']}', 'two@example.com'), ('{I['child']}', 'child@example.com');
    INSERT INTO legacy_consent_subjects (user_id, age_class) VALUES ('{I['child']}', 'under_13');
    INSERT INTO courses (id, slug, status, badge_asset) VALUES ('{I['course']}', 'journal-course', 'draft', 'course-badges/journal.png');
    INSERT INTO adventures (id, course_id, position, slug, theme, status) VALUES ('{I['adv']}', '{I['course']}', 1, 'j-adv', 'archipelago', 'draft');
    INSERT INTO sagas (id, adventure_id, position, slug, status) VALUES ('{I['saga']}', '{I['adv']}', 1, 'j-saga', 'draft');
    INSERT INTO topics (id, saga_id, position, slug, status) VALUES ('{I['topic']}', '{I['saga']}', 1, 'j-topic', 'draft');
    INSERT INTO lessons (id, topic_id, position, slug, status) VALUES ('{I['lesson']}', '{I['topic']}', 1, 'j-lesson', 'draft'),
        ('{I['lesson_v2']}', '{I['topic']}', 2, 'j-lesson-v2', 'draft'), ('{I['broken']}', '{I['topic']}', 3, 'j-broken', 'draft');
    INSERT INTO lesson_documents (lesson_id, locale, document) VALUES
        ('{I['lesson']}', 'en-US', '{lit(V1_DOCUMENT)}'::jsonb), ('{I['lesson']}', 'es-MX', '{lit(V1_DOCUMENT)}'::jsonb),
        ('{I['broken']}', 'en-US', '{{"segments": "oops"}}'::jsonb);
    """)
    run(f"""SET session_replication_role = replica;
    INSERT INTO lesson_document_versions (id, lesson_id, locale, version_id, schema_version, document, answer_keys)
        VALUES ('{I['version']}', '{I['lesson_v2']}', 'en-US', 'journal-v2-001', 2, '{lit(V2_DOCUMENT)}'::jsonb, '{{}}'::jsonb);
    INSERT INTO lesson_v2_runs (id, user_id, lesson_id, locale, document_version_id, expires_at)
        VALUES ('{I['run_one']}', '{I['one']}', '{I['lesson_v2']}', 'en-US', '{I['version']}', now() + interval '1 hour');
    """)
    assert run(f"SELECT data_practice_applies('{I['child']}', 'learning.decision_journal')") == 'f'
    assert run(f"SELECT data_practice_applies('{I['one']}', 'learning.decision_journal')") == 't'

    def attempt(user, lesson, segment, number=1, at='now()'):
        run(f"""INSERT INTO lesson_segment_attempts (user_id, lesson_id, segment_id, attempt_number, score, created_at)
                VALUES ('{I[user]}', '{I[lesson]}', '{segment}', {number}, 100, {at});""")

    def receipt(segment, suffix):
        run(f"""SET session_replication_role = replica;
          INSERT INTO lesson_v2_grade_receipts (jti, user_id, run_id, document_version_id, segment_id, verdict)
          VALUES ('jti-journal-{suffix:0>12}', '{I['one']}', '{I['run_one']}', '{I['version']}', '{segment}', '{{"correct": true, "score": 100}}'::jsonb);""")

    def journal(user, lesson, decisions):
        return run(f"""SET ROLE service_role; SELECT record_learner_decisions('{I[user]}', '{I['course']}', '{I['topic']}', '{I[lesson]}', 'en-US',
                       '{lit(decisions)}'::jsonb);""")

    # Learner one, v1: a real branch (replayed), a one-choice story, a dialogue, a would-you-rather, a quiz.
    attempt('one', 'lesson', 'branch')
    attempt('one', 'lesson', 'branch', 2)
    attempt('one', 'lesson', 'linear')
    attempt('one', 'lesson', 'talk')
    attempt('one', 'lesson', 'wyr')
    attempt('one', 'lesson', 'quiz')
    # Learner one, v2: a branch (replayed), a would-you-rather, a non-story kind.
    receipt('v2-branch', 1)
    receipt('v2-branch', 2)
    receipt('v2-wyr', 3)
    receipt('v2-quiz', 4)
    # Learner two: one branch in the window, one dialogue long before it.
    attempt('two', 'lesson', 'branch')
    attempt('two', 'lesson', 'talk', at="now() - interval '40 days'")
    # The migrated child without the specific consent answers a would-you-rather.
    attempt('child', 'lesson', 'wyr')
    # A malformed document: the metric counts nothing and raises nothing.
    attempt('one', 'broken', 'anything')

    # The journal: everything except learner one's v1 would-you-rather, the
    # deliberately UNJOURNALED decision (a best-effort write that failed).
    journal('one', 'lesson', [decision('branch', 'start', 'story_branch', 'p10'), decision('talk', 't1', 'dialogue_choice', 'save')])
    journal('one', 'lesson_v2', [decision('v2-branch', 'choice', 'story_branch', 'save'), decision('v2-wyr', 'pick', 'would_you_rather', 'b')])
    journal('two', 'lesson', [decision('branch', 'start', 'story_branch', 'p5')])
    journal('child', 'lesson', [decision('wyr', 'pick', 'would_you_rather', 'a')])
    assert run(f"SELECT count(*) FROM learner_decision_journal WHERE user_id = '{I['child']}'") == '0'
    assert run('SELECT count(*) FROM learner_decision_journal') == '5'
    run(f"""INSERT INTO learner_decision_resurfacings (entry_id, lesson_id, user_id)
            SELECT id, '{I['lesson_v2']}', user_id FROM learner_decision_journal WHERE user_id = '{I['two']}';""")
    check('seeded: 6 consented story decisions on two engines, 5 journaled, 1 deliberately unjournaled; the child write was dropped by consent')

    window = "now() - interval '1 day', now() + interval '1 day'"
    metrics = json.loads(run(f'SET ROLE service_role; SELECT learning_narrative_metrics({window});').splitlines()[-1])
    assert metrics['story_decisions_made'] == 6, metrics
    assert metrics['story_decisions_journaled'] == 5, metrics
    assert metrics['story_decisions_without_consent'] == 1, metrics
    check('coverage = journaled / made = 5 / 6: the unjournaled would-you-rather is made and not journaled')

    assert metrics['journal_entries_recorded'] == 5 and metrics['journal_entries_resurfaced'] == 1, metrics
    for key in ('bridge_prompts_offered', 'bridge_prompts_converted_7d', 'bridge_self_commitments', 'bridge_prompts_dismissed', 'bridge_prompts_expired'):
        assert metrics[key] == 0, (key, metrics)
    check('the keys the metric already returned are unchanged: 5 recorded, 1 resurfaced, the bridge counts')

    wide = json.loads(run("SET ROLE service_role; SELECT learning_narrative_metrics(now() - interval '60 days', now() + interval '1 day');").splitlines()[-1])
    assert wide['story_decisions_made'] == 7 and wide['story_decisions_journaled'] == 5, wide
    check('the window bounds the decisions: learner two\'s 40-day-old dialogue counts only in a 60-day window, unjournaled')

    empty = json.loads(run("SET ROLE service_role; SELECT learning_narrative_metrics(now() + interval '1 day', now() + interval '2 days');").splitlines()[-1])
    assert empty['story_decisions_made'] == 0 and empty['story_decisions_journaled'] == 0 and empty['story_decisions_without_consent'] == 0, empty
    check('an empty window reports zero decisions (coverage undefined, never a calm 100%)')

    assert run("SELECT learning_story_decision_segment('{\"type\": \"story_branch\", \"payload\": {\"nodes\": 7}}'::jsonb)") == 'f'
    assert run("SELECT learning_story_decision_segment('{\"type\": \"dialogue_choice\", \"payload\": {\"turns\": [{\"replies\": [{}]}]}}'::jsonb)") == 'f'
    assert run("SELECT learning_story_decision_segment('{\"type\": \"story.dialogue-choice.v2\"}'::jsonb)") == 't'
    assert run("SELECT learning_story_decision_segment('{}'::jsonb)") == 'f'
    check('the classifier matches Core: a one-reply turn or a malformed payload is not a decision; the v2 story kinds are')

    for role in ('anon', 'authenticated'):
        rejected(f'SET ROLE {role}; SELECT learning_narrative_metrics({window});', 'permission denied')
        rejected(f"SET ROLE {role}; SELECT learning_story_decision_segment('{{}}'::jsonb);", 'permission denied')
        rejected(f"SET ROLE {role}; SELECT learning_json_array('[]'::jsonb);", 'permission denied')
    check('no browser role calls the metric or its helpers')
    print(f'\n{len(checks)} checks passed on {database}')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
