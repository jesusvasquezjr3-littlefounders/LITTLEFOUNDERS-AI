"""GAP-FIX-R2 (mentor lane): C.4/OD-18 pedagogy-note review and the C.10 discounted-evidence column.

Applies the ACTUAL migration chain (every file in database/migrations, in
order, through the memory_proposal_store migration) to a fresh database on an
owned native PostgreSQL cluster, over the minimal Supabase shim the other
native verifiers use, then checks: existing proposal rows read as learner
proposals; a pedagogy proposal is parked with the pedagogy cap (2,200) while a
learner proposal keeps its 1,400 cap; an approved pedagogy proposal writes the
PEDAGOGY store (not the learner store) through the atomic write path, with its
ledger row; a rejected one moves nothing; a stale one stays pending; the store
is a closed set; the browser roles cannot call the decision function; the
E.10 messaging scan does not list the new column; replaying the migration
keeps every row. Then, for trajectory_discounted_evidence: the discounted
label is kept exactly when the evidence is (the OD-9 consent trigger may clear
the evidence, and the discounted label follows it), a label with no evidence
is cleared rather than refused, and a label outside the closed set is refused.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN    directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT   loopback port (default 15483)
  LF_PG_USER   superuser (default audit_owner)
  LF_PG_DATA   the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/f2-mentor-postgres.json)
"""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BIN = Path(os.environ.get('LF_PG_BIN', str(RUNTIME / 'pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/f2-mentor-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
TARGET = next(m for m in MIGRATIONS if m.name.endswith('_memory_proposal_store.sql'))
DISCOUNTED = next(m for m in MIGRATIONS if m.name.endswith('_trajectory_discounted_evidence.sql'))
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


if Path(sql('SHOW data_directory')).resolve() != DATA.resolve():
    raise RuntimeError('Refusing an unowned database cluster')

SHIM = """
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END$$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
                         is_anonymous boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""

sha = lambda text: hashlib.sha256(text.encode('utf-8')).hexdigest()
lit = lambda text: 'NULL' if text is None else "'" + text.replace("'", "''") + "'"

database = 'lf_memory_store_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
sql(SHIM, database)
report = {'migrationsApplied': 0}
kid = str(uuid.uuid4())
guardian = str(uuid.uuid4())
legacy = str(uuid.uuid4())
try:
    for migration in MIGRATIONS:
        if migration.name == TARGET.name:
            break
        sql(migration.read_text(encoding='utf-8'), database)
        report['migrationsApplied'] += 1

    for uid in (kid, guardian):
        sql(f"INSERT INTO auth.users (id, email) VALUES ('{uid}', '{uid}@example.test')", database)
    # A learner proposal parked BEFORE the migration (the 0068 shape, no store column).
    sql(f"""INSERT INTO public.learner_memory_proposals (id, user_id, proposed, after_hash)
            VALUES ('{legacy}', '{kid}', 'Old learner note.', '{sha('Old learner note.')}')""", database)

    for migration in MIGRATIONS:
        if migration.name >= TARGET.name:
            sql(migration.read_text(encoding='utf-8'), database)
            report['migrationsApplied'] += 1

    # 1. Existing rows read as learner proposals.
    assert sql(f"SELECT store FROM public.learner_memory_proposals WHERE id = '{legacy}'", database) == 'learner'
    report['existingRowsAreLearner'] = True

    def park(store, proposed, expected=None):
        pid = str(uuid.uuid4())
        sql(f"""INSERT INTO public.learner_memory_proposals
                (id, user_id, store, proposed, expected_before, before_hash, after_hash)
                VALUES ('{pid}', '{kid}', '{store}', {lit(proposed)}, {lit(expected)},
                        {lit(None if expected is None else sha(expected))}, '{sha(proposed)}')""", database)
        return pid

    def refused(store, proposed):
        try:
            park(store, proposed)
        except RuntimeError as error:
            assert 'check constraint' in str(error), str(error)
            return True
        return False

    # 2. Store-aware caps: pedagogy takes 2,200, learner stays at 1,400; the store is closed.
    long_pedagogy = 'p' * 2200
    ped = park('pedagogy', long_pedagogy)
    assert refused('learner', 'l' * 1401)
    assert refused('pedagogy', 'p' * 2201)
    assert refused('diary', 'x')
    assert refused('pedagogy', '')
    report['storeAwareCaps'] = True

    # 3. Approving a pedagogy proposal writes the PEDAGOGY store, with its ledger row.
    outcome = sql(f"SET ROLE service_role; SELECT public.decide_learner_memory_proposal('{ped}', '{guardian}', 'approved', 'guardian-approved-review')", database)
    assert outcome == 'written', outcome
    stores = sql(f"SELECT json_object_agg(store, char_length(content)) FROM public.learner_memory WHERE user_id = '{kid}'", database)
    assert json.loads(stores) == {'pedagogy': 2200}, stores
    ledger = sql(f"SELECT store || ':' || actor FROM public.learner_memory_ledger WHERE user_id = '{kid}'", database)
    assert ledger == 'pedagogy:guardian-approved-review', ledger
    assert sql(f"SELECT status FROM public.learner_memory_proposals WHERE id = '{ped}'", database) == 'approved'
    report['approvedPedagogyWritesPedagogyStore'] = True

    # 4. A rejected pedagogy proposal moves nothing.
    rejected = park('pedagogy', 'Needs short steps.', long_pedagogy)
    assert sql(f"SET ROLE service_role; SELECT public.decide_learner_memory_proposal('{rejected}', '{guardian}', 'rejected', 'guardian-approved-review')", database) == 'rejected'
    assert sql(f"SELECT char_length(content) FROM public.learner_memory WHERE user_id = '{kid}' AND store = 'pedagogy'", database) == '2200'
    report['rejectedMovesNothing'] = True

    # 5. A stale pedagogy proposal (written against another note) stays pending.
    stale = park('pedagogy', 'Stale teaching note.', 'Some other note.')
    assert sql(f"SET ROLE service_role; SELECT public.decide_learner_memory_proposal('{stale}', '{guardian}', 'approved', 'guardian-approved-review')", database) == 'conflict'
    assert sql(f"SELECT status FROM public.learner_memory_proposals WHERE id = '{stale}'", database) == 'pending'
    report['staleStaysPending'] = True

    # 6. The learner proposal still applies to the learner store.
    assert sql(f"SET ROLE service_role; SELECT public.decide_learner_memory_proposal('{legacy}', '{guardian}', 'approved', 'guardian-approved-review')", database) == 'written'
    assert sql(f"SELECT content FROM public.learner_memory WHERE user_id = '{kid}' AND store = 'learner'", database) == 'Old learner note.'
    report['learnerProposalStillLearner'] = True

    # 7. No browser role may decide.
    denials = 0
    for role in ('anon', 'authenticated'):
        try:
            sql(f"SET ROLE {role}; SELECT public.decide_learner_memory_proposal('{stale}', '{guardian}', 'approved', 'x')", database)
        except RuntimeError as error:
            assert 'permission denied' in str(error), str(error)
            denials += 1
    assert denials == 2
    report['browserDenials'] = denials

    # 8. The E.10 messaging scan does not list the new column.
    surfaces = json.loads(sql('SET ROLE service_role; SELECT public.social_messaging_surfaces()', database))
    assert not any('learner_memory_proposals' in name for name in surfaces), surfaces
    report['messagingScanClean'] = True

    # 9. Replay keeps every row.
    snapshot = sql('SELECT json_agg(p ORDER BY id) FROM public.learner_memory_proposals p', database)
    sql(TARGET.read_text(encoding='utf-8'), database)
    assert sql('SELECT json_agg(p ORDER BY id) FROM public.learner_memory_proposals p', database) == snapshot
    report['replayPreservesRows'] = True

    # 10. trajectory_discounted_evidence.
    def step(seq, rule, discounted):
        obs = 'NULL' if rule is None else '2'
        sql(f"""SET ROLE service_role; INSERT INTO public.tutor_trajectory_step
                (user_id, turn_seq, event_kind, strategy_before, strategy, scaffolding, difficulty,
                 evidence_rule, evidence_observations, evidence_required, evidence_discounted)
                VALUES ('{kid}', {seq}, 'activity_result', 'DIRECT', 'CELEBRATE', 1, 2,
                        {lit(rule)}, {obs}, {obs}, {lit(discounted)})""", database)
        return sql(f"SELECT coalesce(evidence_rule, '-') || '|' || coalesce(evidence_discounted, '-') FROM public.tutor_trajectory_step WHERE user_id = '{kid}' AND turn_seq = {seq}", database)
    kept = step(1, 'mastery', 'too_fast')
    assert kept in ('mastery|too_fast', '-|-'), kept  # '-|-' when the OD-9 practice does not apply
    assert step(2, None, 'none') == '-|-'
    try:
        step(3, 'mastery', 'lucky')
    except RuntimeError as error:
        assert 'check constraint' in str(error), str(error)
    else:
        raise AssertionError('an unknown discounted label was accepted')
    report['discountedFollowsEvidence'] = kept
    snapshot = sql('SELECT json_agg(t ORDER BY turn_seq) FROM public.tutor_trajectory_step t', database)
    sql(DISCOUNTED.read_text(encoding='utf-8'), database)
    assert sql('SELECT json_agg(t ORDER BY turn_seq) FROM public.tutor_trajectory_step t', database) == snapshot
    report['discountedReplayPreservesRows'] = True
finally:
    sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
