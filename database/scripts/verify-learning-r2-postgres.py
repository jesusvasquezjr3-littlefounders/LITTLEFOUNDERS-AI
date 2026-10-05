"""Gap-fix round 2, learning lane, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim,
applies EVERY migration in database/migrations in order, and proves at the
enforcing boundary (migrations v2_learning_signals_r2, v2_manifest_carried_gates
and learning_qa_events):

  - the widened receipt CHECK accepts the $2 count_from_zero diagnostic, L12
    cue hits, scorer parity, item phase, representation variant and M1 entry
    stage, and still refuses malformed values of each;
  - lesson_v2_runs.cpa_entry_stage takes only the three M1 stages;
  - learning_scorer_parity, learning_detection_cells_by_phase,
    learning_cue_hits, learning_variant_transfer and
    learning_cpa_entry_stage_distribution report those receipts, service role only;
  - learning_events accepts the six QA events and learning_qa_rates counts them;
  - content_defect_escapes is written only through the audited recorder with
    a known Forge gate, and content_defect_escape_rate counts it; browser
    roles read nothing;
  - publish_v2_lesson_version reads its required gates from
    forge_v2_manifest_gates, including the carried gates 2-9, 17, 18 and 19.

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

database = 'lf_learning_r2_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def scalar(query):
    return run(query).splitlines()[-1]


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

    # Receipts are written by the grade functions; the proof inserts rows directly (the owner bypasses nothing: CHECKs still apply).
    user = str(uuid.uuid4())
    run(f"INSERT INTO auth.users (id, email) VALUES ('{user}', 'learner@example.com');")
    run("SET session_replication_role = replica;")  # FK shortcuts for fixture rows only; CHECK constraints are not triggers and still run.
    receipt = lambda jti, run_id, segment, verdict: f"""SET session_replication_role = replica;
      INSERT INTO lesson_v2_grade_receipts (jti, user_id, run_id, document_version_id, segment_id, verdict)
      VALUES ('{jti}', '{user}', '{run_id}', '{uuid.uuid4()}', '{segment}', '{json.dumps(verdict)}'::jsonb);"""
    r1 = str(uuid.uuid4()); r2 = str(uuid.uuid4()); r3 = str(uuid.uuid4())
    run(receipt('jti-change-000000000001', r1, 'change-01', {'correct': False, 'score': 0, 'diagnostic': 'count_from_zero', 'client_agree': True}))
    run(receipt('jti-scam-pre-00000000001', r1, 'scam-pre', {'correct': False, 'score': 0, 'diagnostic': 'miss', 'item_phase': 'pre',
        'detection': {'hits': 1, 'misses': 1, 'false_alarms': 1, 'correct_rejections': 1}, 'cues': {'hits': 1, 'missed': 2, 'false_ticks': 0}}))
    run(receipt('jti-scam-post-0000000001', r1, 'scam-post', {'correct': True, 'score': 100, 'diagnostic': 'none', 'item_phase': 'post',
        'detection': {'hits': 2, 'misses': 0, 'false_alarms': 0, 'correct_rejections': 2}, 'client_agree': False}))
    run(receipt('jti-unit-transfer-00001', r2, 'unit-02', {'correct': True, 'score': 100, 'diagnostic': 'none', 'item_role': 'transfer',
        'kc': 'kc-unit-price', 'variant': 'ratio-lines', 'client_agree': True}))
    run(receipt('jti-cpa-abstract-000001', r3, 'cpa-abstract-01', {'correct': True, 'score': 100, 'diagnostic': 'none', 'entry_stage': 'abstract'}))
    check('the receipt CHECK accepts count_from_zero, cues, client_agree, item_phase, variant and entry_stage')
    for verdict, name in [({'correct': False, 'score': 0, 'diagnostic': 'counted_wrong'}, 'an unknown diagnostic'),
                          ({'correct': False, 'score': 0, 'cues': {'hits': 1}}, 'partial cue counts'),
                          ({'correct': False, 'score': 0, 'cues': {'hits': 1, 'missed': 0, 'false_ticks': 0, 'extra': 1}}, 'an extra cue field'),
                          ({'correct': False, 'score': 0, 'client_agree': 'yes'}, 'a non-boolean parity flag'),
                          ({'correct': False, 'score': 0, 'item_phase': 'during'}, 'an unknown phase'),
                          ({'correct': False, 'score': 0, 'variant': 'Bad Variant!'}, 'a free-text variant'),
                          ({'correct': False, 'score': 0, 'entry_stage': 'symbolic'}, 'an unknown entry stage')]:
        rejected(receipt('jti-bad-' + uuid.uuid4().hex[:16], r1, 'bad-01', verdict), 'lesson_v2_grade_receipts_signals_check')
    check('the receipt CHECK still refuses malformed diagnostics, cue counts, parity flags, phases, variants and entry stages')

    run(f"""SET session_replication_role = replica;
      INSERT INTO lesson_v2_runs (id, user_id, lesson_id, locale, document_version_id, expires_at, cpa_entry_stage)
      VALUES ('{uuid.uuid4()}', '{user}', '{uuid.uuid4()}', 'en-US', '{uuid.uuid4()}', now() + interval '1 hour', 'pictorial');""")
    rejected(f"""SET session_replication_role = replica;
      INSERT INTO lesson_v2_runs (id, user_id, lesson_id, locale, document_version_id, expires_at, cpa_entry_stage)
      VALUES ('{uuid.uuid4()}', '{user}', '{uuid.uuid4()}', 'en-US', '{uuid.uuid4()}', now() + interval '1 hour', 'symbolic');""", 'lesson_v2_runs_cpa_entry_stage_check')
    check('lesson_v2_runs.cpa_entry_stage takes only concrete, pictorial or abstract')

    window = "now() - interval '1 day', now() + interval '1 day'"
    parity = scalar(f"SET ROLE service_role; SELECT graded || ',' || reported || ',' || agreed || ',' || agreement_share FROM learning_scorer_parity({window});")
    assert parity == '5,3,2,0.6667', parity
    phases = run(f"SET ROLE service_role; SELECT item_phase || ':' || hits || '/' || misses || '/' || false_alarms FROM learning_detection_cells_by_phase({window});").splitlines()
    assert phases == ['pre:1/1/1', 'post:2/0/0'], phases
    cues = scalar(f"SET ROLE service_role; SELECT responses || ',' || hits || ',' || missed || ',' || false_ticks FROM learning_cue_hits({window});")
    assert cues == '1,1,2,0', cues
    variants = scalar(f"SET ROLE service_role; SELECT kc || ':' || variant || ':' || first_attempts || ':' || success_share FROM learning_variant_transfer({window});")
    assert variants == 'kc-unit-price:ratio-lines:1:1.0000', variants
    entries = scalar(f"SET ROLE service_role; SELECT entry_stage || ':' || runs FROM learning_cpa_entry_stage_distribution({window});")
    assert entries == 'abstract:1', entries
    rejected(f"SET ROLE authenticated; SELECT * FROM learning_scorer_parity({window});", 'permission denied')
    check('parity, d-prime by phase, cue hits, variant transfer and entry stages report the receipts; browsers cannot call them')

    for event, detail in [('placement_commit_ok', 'adaptive_quiz'), ('placement_commit_ok', 'adaptive_quiz'), ('placement_commit_failed', 'write_failed'),
                          ('prerequisite_refused', 'pathway'), ('prerequisite_passed', 'pathway'), ('lesson_update_required', 'completion'), ('scorer_parity_miss', 'seg-01')]:
        run(f"""SET session_replication_role = replica;
          INSERT INTO learning_events (user_id, role, event, route_class, segment_id) VALUES ('{user}', 'kid', '{event}', 'learn', '{detail}');""")
    # Triggers off so the CHECK itself answers (the consent trigger would otherwise drop an unconsented kid's row first).
    rejected(f"SET session_replication_role = replica; INSERT INTO learning_events (user_id, role, event, route_class) VALUES ('{user}', 'kid', 'placement_commit_maybe', 'learn');", 'learning_events_event_check')
    rates = run(f"SET ROLE service_role; SELECT event || ':' || detail || ':' || events FROM learning_qa_rates({window});").splitlines()
    assert 'placement_commit_ok:adaptive_quiz:2' in rates and 'placement_commit_failed:write_failed:1' in rates and 'scorer_parity_miss:seg-01:1' in rates, rates
    check('learning_events accepts the six QA events, refuses others, and learning_qa_rates counts them')

    lesson = str(uuid.uuid4())
    # Gap-fix round 7: the recorder re-checks the actor (content_release_actor_allowed), so a staff account records it.
    staff = str(uuid.uuid4())
    run(f"INSERT INTO auth.users (id, email) VALUES ('{staff}', 'staff@littlefounders.ai'); INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{staff}', 'superadmin', NULL);")
    escape = scalar(f"SET ROLE service_role; SELECT record_content_defect_escape('{lesson}', 'forge.gate.18.wellbeing-language', 'psychological', '{staff}');")
    assert len(escape) == 36, escape
    audited = scalar(f"SELECT count(*) FROM audit_logs WHERE action = 'admin.content.defect_escape' AND subject = '{lesson}';")
    assert audited == '1', audited
    rejected(f"SET ROLE service_role; SELECT record_content_defect_escape('{lesson}', 'forge.gate.99.nothing', 'copy', '{staff}');", 'Invalid defect escape')
    rejected(f"SET ROLE service_role; SELECT record_content_defect_escape('{lesson}', 'forge.gate.12.tone', 'rumour', '{staff}');", 'content_defect_escapes_defect_kind_check')
    rate = scalar(f"SET ROLE service_role; SELECT gate_id || ':' || escapes FROM content_defect_escape_rate({window});")
    assert rate == 'forge.gate.18.wellbeing-language:1', rate
    rejected("SET ROLE authenticated; SELECT * FROM content_defect_escapes;", 'permission denied')
    check('defect escapes are recorded only through the audited recorder with a known gate; the rate counts them; browsers read nothing')

    gates = run("SELECT gate_id FROM forge_v2_manifest_gates ORDER BY gate_id;").splitlines()
    for gate in ['forge.gate.02.age-vocabulary', 'forge.gate.03.currency-facts', 'forge.gate.04.arithmetic',
                 'forge.gate.05.rationale-canon', 'forge.gate.06.anti-genericity', 'forge.gate.07.generation-quality',
                 'forge.gate.08.clarity', 'forge.gate.09.readability', 'forge.gate.17.reward-mechanics',
                 'forge.gate.18.wellbeing-language', 'forge.gate.19.age-register']:
        assert gate in gates, gates
    assert len(gates) == 19, gates
    body = run("SELECT pg_get_functiondef('public.publish_v2_lesson_version(uuid, text, text, jsonb, jsonb, jsonb)'::regprocedure);")
    assert 'forge_v2_manifest_gates' in body and 'gate_number IN (1, 11' not in body, 'publish function still lists gates inline'
    rejected("SET ROLE authenticated; SELECT * FROM forge_v2_manifest_gates;", 'permission denied')
    check('publish_v2_lesson_version requires the forge_v2_manifest_gates rows, which include gates 2-9, 17, 18 and 19')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'Every migration applied in order on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal Supabase shim; fixture receipts and runs inserted directly (FKs skipped, CHECKs enforced); not PostgREST or deployed Core.',
}
if os.environ.get('LF_PG_REPORT'):
    Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks)}))
