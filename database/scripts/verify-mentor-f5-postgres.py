"""GAP-FIX-R5 (mentor lane): C.4/OD-18 deletion of a STORED Mentor memory note.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to a fresh database on an owned native PostgreSQL cluster, over the
minimal Supabase shim the other native verifiers use, then checks
clear_learner_memory (the learner_memory_clear migration):

  1. A delete that names the current text removes exactly that store's row
     and answers 'deleted'; the other store is untouched.
  2. It writes ONE append-only ledger row: the actor, the sha256 of the
     deleted note as before_hash, the sha256 of the empty string as
     after_hash, no session, and no text anywhere in the row.
  3. Pending proposals of that store written against the deleted note are
     closed as rejected, decided by the deleter; a proposal computed from "no
     note yet" stays pending and still applies cleanly afterwards; the other
     store's proposals are untouched.
  4. A stale compare answers 'conflict' and changes nothing (no row, no ledger).
  5. A missing note answers 'absent'.
  6. An unknown actor or store, and a NULL expected text, are refused.
  7. anon and authenticated cannot execute it; service_role can.
  8. Replaying the migration keeps every row.
  9. The guardian actor stamps its own ledger row.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN    directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT   loopback port (default 15483)
  LF_PG_USER   superuser (default audit_owner)
  LF_PG_DATA   the data directory the server must report (ownership check)
  LF_PG_REPORT report path (default audit-results/f5-mentor-postgres.json)
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
REPORT = Path(os.environ.get('LF_PG_REPORT', str(ROOT / 'audit-results/f5-mentor-postgres.json')))
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
TARGET = next(m for m in MIGRATIONS if m.name.endswith('_learner_memory_clear.sql'))
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
EMPTY = sha('')

database = 'lf_memory_clear_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {database}')
sql(SHIM, database)
report = {'migrationsApplied': 0}
teen = str(uuid.uuid4())
kid = str(uuid.uuid4())
guardian = str(uuid.uuid4())
NOTE = 'Le gustan los ejemplos con monedas. ¿Ñandú?'
TEACH = 'Short steps help.'
try:
    for migration in MIGRATIONS:
        sql(migration.read_text(encoding='utf-8'), database)
        report['migrationsApplied'] += 1

    for uid in (teen, kid, guardian):
        sql(f"INSERT INTO auth.users (id, email) VALUES ('{uid}', '{uid}@example.test')", database)

    def seed(user, store, content):
        sql(f"""INSERT INTO public.learner_memory (user_id, store, content) VALUES ('{user}', '{store}', {lit(content)})
                ON CONFLICT (user_id, store) DO UPDATE SET content = EXCLUDED.content""", database)

    def park(user, store, proposed, expected=None):
        pid = str(uuid.uuid4())
        sql(f"""INSERT INTO public.learner_memory_proposals
                (id, user_id, store, proposed, expected_before, before_hash, after_hash)
                VALUES ('{pid}', '{user}', '{store}', {lit(proposed)}, {lit(expected)},
                        {lit(None if expected is None else sha(expected))}, '{sha(proposed)}')""", database)
        return pid

    def clear(user, store, expected, actor, by):
        return sql(f"SET ROLE service_role; SELECT public.clear_learner_memory('{user}', {lit(store)}, {lit(expected)}, {lit(actor)}, "
                   f"{lit(by)}::uuid)", database)

    status = lambda pid: sql(f"SELECT status || ':' || coalesce(decided_by::text, '-') FROM public.learner_memory_proposals WHERE id = '{pid}'", database)
    ledger_count = lambda user: int(sql(f"SELECT count(*) FROM public.learner_memory_ledger WHERE user_id = '{user}'", database))

    seed(teen, 'learner', NOTE)
    seed(teen, 'pedagogy', TEACH)
    against_note = park(teen, 'learner', 'A newer learner note.', NOTE)
    from_nothing = park(teen, 'learner', 'A fresh learner note.', None)
    other_store = park(teen, 'pedagogy', 'Longer steps now.', TEACH)

    # 4. Stale compare: nothing changes.
    assert clear(teen, 'learner', 'Some older text.', 'learner-self-deleted', teen) == 'conflict'
    assert sql(f"SELECT content FROM public.learner_memory WHERE user_id = '{teen}' AND store = 'learner'", database) == NOTE
    assert ledger_count(teen) == 0
    report['staleCompareChangesNothing'] = True

    # 1. The delete removes exactly that store's row.
    assert clear(teen, 'learner', NOTE, 'learner-self-deleted', teen) == 'deleted'
    stores = sql(f"SELECT string_agg(store, ',' ORDER BY store) FROM public.learner_memory WHERE user_id = '{teen}'", database)
    assert stores == 'pedagogy', stores
    report['deletesOneStore'] = True

    # 2. One ledger row, hashes only.
    row = json.loads(sql(f"SELECT row_to_json(l) FROM public.learner_memory_ledger l WHERE user_id = '{teen}'", database))
    assert row['store'] == 'learner' and row['actor'] == 'learner-self-deleted', row
    assert row['before_hash'] == sha(NOTE), row
    assert row['after_hash'] == EMPTY, row
    assert row['session_id'] is None, row
    assert NOTE not in json.dumps(row, ensure_ascii=False)
    report['ledgerRowHashesOnly'] = True

    # 3. Stale proposals close; the from-nothing one and the other store stay pending.
    assert status(against_note) == f'rejected:{teen}', status(against_note)
    assert status(from_nothing) == 'pending:-', status(from_nothing)
    assert status(other_store) == 'pending:-', status(other_store)
    outcome = sql(f"SET ROLE service_role; SELECT public.decide_learner_memory_proposal('{from_nothing}', '{teen}', 'approved', 'learner-self-approved-review')", database)
    assert outcome == 'written', outcome
    report['staleProposalsClosed'] = True

    # 5. Absent.
    assert clear(kid, 'learner', NOTE, 'guardian-deleted', guardian) == 'absent'
    assert ledger_count(kid) == 0
    report['absentIsAbsent'] = True

    # 9. The guardian stamp.
    seed(kid, 'pedagogy', TEACH)
    assert clear(kid, 'pedagogy', TEACH, 'guardian-deleted', guardian) == 'deleted'
    assert sql(f"SELECT actor FROM public.learner_memory_ledger WHERE user_id = '{kid}'", database) == 'guardian-deleted'
    report['guardianActor'] = True

    # 6. Refused inputs.
    seed(kid, 'learner', NOTE)
    refusals = 0
    for args in (('learner', NOTE, 'oracle-post-session-review', guardian), ('diary', NOTE, 'guardian-deleted', guardian),
                 ('learner', None, 'guardian-deleted', guardian), ('learner', NOTE, 'guardian-deleted', None)):
        try:
            clear(kid, *args)
        except RuntimeError:
            refusals += 1
    assert refusals == 4, refusals
    assert sql(f"SELECT content FROM public.learner_memory WHERE user_id = '{kid}' AND store = 'learner'", database) == NOTE
    report['refusedInputs'] = refusals

    # 7. No browser role may call it.
    denials = 0
    for role in ('anon', 'authenticated'):
        try:
            sql(f"SET ROLE {role}; SELECT public.clear_learner_memory('{kid}', 'learner', {lit(NOTE)}, 'guardian-deleted', '{guardian}')", database)
        except RuntimeError as error:
            assert 'permission denied' in str(error), str(error)
            denials += 1
    assert denials == 2
    assert sql(f"SELECT content FROM public.learner_memory WHERE user_id = '{kid}' AND store = 'learner'", database) == NOTE
    report['browserDenials'] = denials

    # 8. Replay keeps every row.
    snapshot = sql("SELECT json_agg(m ORDER BY user_id, store) FROM public.learner_memory m", database)
    ledger = sql("SELECT count(*) FROM public.learner_memory_ledger", database)
    sql(TARGET.read_text(encoding='utf-8'), database)
    assert sql("SELECT json_agg(m ORDER BY user_id, store) FROM public.learner_memory m", database) == snapshot
    assert sql("SELECT count(*) FROM public.learner_memory_ledger", database) == ledger
    report['replayPreservesRows'] = True
finally:
    sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
