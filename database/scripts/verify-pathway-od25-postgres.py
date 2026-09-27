"""OD-25 (B.6): the two learner records of migration 0181, enforced by PostgreSQL.

Applies the ACTUAL migration chain to a fresh database on an owned native
PostgreSQL cluster (the teen-wallet verifier's Supabase shim), then proves:
an adult-stage early opening and an empty evidence list are refused by CHECK;
a learner reads only their own rows (RLS); the browser role cannot write
either table; account erasure cascades to both. Eligibility itself is Core's
(coursePathway.ts, tested at the HTTP boundary in learnPathway.test.ts).

Cluster selection (never the shared Docker stack):
  LF_PG_BIN / LF_PG_PORT / LF_PG_USER / LF_PG_DATA as in verify-teen-wallet-postgres.py
"""
import os
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / '.codex/audit-db'
BIN = Path(os.environ.get('LF_PG_BIN', str(RUNTIME / 'pgsql/bin')))
PORT = os.environ.get('LF_PG_PORT', '15483')
USER = os.environ.get('LF_PG_USER', 'audit_owner')
DATA = Path(os.environ.get('LF_PG_DATA', str(RUNTIME / 'data')))
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(q, db='postgres'):
    r = subprocess.run(BASE + ['-d', db], input=q, text=True, encoding='utf-8', capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()


if Path(sql('SHOW data_directory')).resolve() != DATA.resolve():
    raise RuntimeError('Refusing an unowned database cluster')

SHIM = (ROOT / 'database/scripts/verify-teen-wallet-postgres.py').read_text(encoding='utf-8').split('SHIM = """')[1].split('"""')[0]
db = 'lf_pathway_od25_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {db}')
sql(SHIM, db)
for m in sorted((ROOT / 'database/migrations').glob('*.sql')):
    sql(m.read_text(encoding='utf-8'), db)
u, o = str(uuid.uuid4()), str(uuid.uuid4())
c, a, s_, t = [str(uuid.uuid4()) for _ in range(4)]
sql(f"""INSERT INTO auth.users (id) VALUES ('{u}'), ('{o}');
INSERT INTO public.courses (id, slug) VALUES ('{c}', 'c');
INSERT INTO public.adventures (id, course_id, position, slug, theme) VALUES ('{a}', '{c}', 1, 'a', 'forest');
INSERT INTO public.sagas (id, adventure_id, position, slug) VALUES ('{s_}', '{a}', 1, 's');
INSERT INTO public.topics (id, saga_id, position, slug) VALUES ('{t}', '{s_}', 1, 't');""", db)
sql(f"SET ROLE service_role; INSERT INTO public.course_chapter_early_access (user_id, course_id, adventure_id, pathway_stage, prerequisite_kcs) VALUES ('{u}', '{c}', '{a}', 'teen', ARRAY['kc.a']);", db)
sql(f"""SET ROLE service_role; INSERT INTO public.course_topic_mastery_credits (user_id, course_id, topic_id, kc_keys, p_known) VALUES ('{u}', '{c}', '{t}', ARRAY['kc.a'], '{{"kc.a":0.9}}');""", db)
checks=[]
for bad in [f"INSERT INTO public.course_chapter_early_access (user_id, course_id, adventure_id, pathway_stage, prerequisite_kcs) VALUES ('{o}', '{c}', '{a}', 'adult', ARRAY['kc.a'])",
            f"INSERT INTO public.course_chapter_early_access (user_id, course_id, adventure_id, pathway_stage, prerequisite_kcs) VALUES ('{o}', '{c}', '{a}', 'teen', ARRAY[]::text[])"]:
    try: sql("SET ROLE service_role; "+bad+";", db); raise SystemExit('expected CHECK refusal')
    except RuntimeError as e: assert 'check constraint' in str(e), e
checks.append('adult stage and empty evidence refused')
def as_user(uid, q):
    return sql(f"SELECT set_config('request.jwt.claim.sub', '{uid}', false); SET ROLE authenticated; {q}", db).splitlines()[-1]
assert as_user(u, 'SELECT count(*) FROM public.course_chapter_early_access;') == '1'
assert as_user(o, 'SELECT count(*) FROM public.course_chapter_early_access;') == '0'
assert as_user(o, 'SELECT count(*) FROM public.course_topic_mastery_credits;') == '0'
checks.append('RLS: own rows only')
for q in [f"INSERT INTO public.course_topic_mastery_credits (user_id, course_id, topic_id, kc_keys) VALUES ('{u}', '{c}', '{t}', ARRAY['kc.b'])",
          f"INSERT INTO public.course_chapter_early_access (user_id, course_id, adventure_id, pathway_stage, prerequisite_kcs) VALUES ('{u}', '{c}', '{a}', 'teen', ARRAY['kc.a'])"]:
    try: as_user(u, q+';'); raise SystemExit('expected RLS refusal')
    except RuntimeError as e: assert 'row-level security' in str(e) or 'duplicate' in str(e), e
assert as_user(u, f"WITH d AS (DELETE FROM public.course_topic_mastery_credits RETURNING 1) SELECT count(*) FROM d;") == '0'
checks.append('browser writes refused (insert by RLS, delete matches nothing)')
sql(f"DELETE FROM auth.users WHERE id = '{u}';", db)
assert sql('SELECT count(*) FROM public.course_chapter_early_access;', db) == '0'
assert sql('SELECT count(*) FROM public.course_topic_mastery_credits;', db) == '0'
checks.append('account erasure cascades')
sql(f'DROP DATABASE {db} WITH (FORCE)')
print(chr(10).join(checks))
