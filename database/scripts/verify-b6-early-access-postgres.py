"""B.6 / OD-25 (owner review P-03, P-04) learner pathway decisions against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim (the
anon/authenticated/service_role roles and an auth schema with users and
uid()/role()), applies EVERY migration in database/migrations in order, seeds
a small catalog and one account per population, and proves at the enforcing
boundary what migration 0183 promises:

  - course_chapter_early_access (Rule P8) stores only the two one-stage-up
    pairs (child to tween, tween to teen): an adult chapter, two stages up, a
    stage that does not match the chapter, a chapter of another course, an
    unpublished chapter and a confirmation without prerequisite evidence are
    all refused, even for the service role;
  - course_topic_mastery_decisions (Rule E3) stores 'accepted' or 'declined'
    only, for a topic of the named course, naming only ACTIVE shared KCs;
  - both tables are write-once: a replay through PostgREST's
    ON CONFLICT DO NOTHING keeps the first row (the first decision stands),
    and an UPDATE is refused for every role, the table owner included;
  - privileges and RLS: no browser role can write; anon cannot read;
    a learner reads only their own rows, a verified guardian reads their
    child's, a stranger and another learner read nothing; the service role
    reads, inserts and deletes but cannot update;
  - erasure: deleting the account removes its rows (ON DELETE CASCADE).

Configuration (defaults match the repo's owned audit cluster):
  LF_PG_PSQL   path to psql      (default <repo>/.codex/audit-db/pgsql/bin/psql.exe)
  LF_PG_PORT   port              (default 15483)
  LF_PG_USER   superuser name    (default audit_owner)
  LF_PG_KEEP   set to 1 to keep the throwaway database for inspection
  LF_PG_REPORT optional path for a JSON report of the passed checks
"""
from pathlib import Path
import json
import os
import subprocess
import uuid

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

database = 'lf_b6_early_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(query):
    return run('SET ROLE service_role;' + query)


def as_user(user_id, query):
    return run(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{user_id}', false); {query}")


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


def last(output):
    return output.splitlines()[-1] if output else ''


EARLY = 'course_chapter_early_access'
DECISIONS = 'course_topic_mastery_decisions'

try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    # ── Structure, RLS and privileges ───────────────────────────────────────
    for table in (EARLY, DECISIONS):
        assert run(f"SELECT relrowsecurity FROM pg_class WHERE oid = 'public.{table}'::regclass") == 't', table
        for role in ('anon', 'authenticated', 'service_role'):
            got = {p: run(f"SELECT has_table_privilege('{role}', 'public.{table}', '{p}')") == 't'
                   for p in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')}
            want = {'anon': set(), 'authenticated': {'SELECT'}, 'service_role': {'SELECT', 'INSERT', 'DELETE'}}[role]
            assert {p for p, v in got.items() if v} == want, (table, role, got)
        policies = run(f"SELECT string_agg(cmd || ':' || array_to_string(roles, ','), ' ') FROM pg_policies WHERE tablename = '{table}'")
        assert policies == 'SELECT:public', (table, policies)
    check('both tables: RLS on, one SELECT policy only; anon has no privilege, authenticated only SELECT, service_role SELECT/INSERT/DELETE and never UPDATE or TRUNCATE')

    # ── Catalog and populations ─────────────────────────────────────────────
    U = {name: str(uuid.uuid4()) for name in ('tween', 'child', 'other', 'parent', 'pending_parent', 'stranger')}
    C = {name: str(uuid.uuid4()) for name in ('course', 'other_course')}
    A = {name: str(uuid.uuid4()) for name in ('kids', 'tweens', 'teens', 'adults', 'legacy_teen', 'draft_teen', 'other_teen')}
    S = {name: str(uuid.uuid4()) for name in A}
    T = {name: str(uuid.uuid4()) for name in A}
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{k}@example.com')" for k, v in U.items()) + ';')
    chapters = {
        # name: (course, age_tier, pathway_stage, min, max, status)
        'kids': ('course', 'tier1', None, None, None, 'published'),
        'tweens': ('course', 'tier1', 'tween', 10, 12, 'published'),
        'teens': ('course', 'tier1', 'teen', 13, 17, 'published'),
        'adults': ('course', 'tier1', 'adult', 18, None, 'published'),
        'legacy_teen': ('course', 'tier4', None, None, None, 'published'),
        'draft_teen': ('course', 'tier1', 'teen', 13, 17, 'draft'),
        'other_teen': ('other_course', 'tier1', 'teen', 13, 17, 'published'),
    }
    lit = lambda v: 'NULL' if v is None else (str(v) if isinstance(v, int) else f"'{v}'")
    rows = []
    for pos, (name, (course, tier, stage, lo, hi, status)) in enumerate(chapters.items(), start=1):
        rows.append(f"INSERT INTO adventures (id, course_id, position, slug, theme, age_tier, pathway_stage, eligibility_min_age, eligibility_max_age, status) "
                    f"VALUES ('{A[name]}', '{C[course]}', {pos}, '{name.replace('_', '-')}', 'archipelago', '{tier}', {lit(stage)}, {lit(lo)}, {lit(hi)}, '{status}');")
        rows.append(f"INSERT INTO sagas (id, adventure_id, position, slug) VALUES ('{S[name]}', '{A[name]}', 1, 's-{pos}');")
        rows.append(f"INSERT INTO topics (id, saga_id, position, slug) VALUES ('{T[name]}', '{S[name]}', 1, 't-{pos}');")
    run(f"INSERT INTO courses (id, slug) VALUES ('{C['course']}', 'b6-course'), ('{C['other_course']}', 'b6-other');")
    run('\n'.join(rows))
    run("""
    INSERT INTO kc (key, strand, title, objective, status) VALUES
        ('money.b6-prereq', 'money_math', '{"en-US":"P"}', '{"en-US":"P"}', 'active'),
        ('money.b6-taught', 'money_math', '{"en-US":"T"}', '{"en-US":"T"}', 'active'),
        ('money.b6-draft', 'money_math', '{"en-US":"D"}', '{"en-US":"D"}', 'draft');
    """)
    run(f"""
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{U['parent']}', 'parent', NULL);
    INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
        VALUES ('{U['parent']}', 'verified', 'local-ocr', 'P', 'One', '1985-03-01');
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
        VALUES ('{U['parent']}', '{U['tween']}', 'verified', now());
    """)
    check('seeded two courses (child, tween, teen, adult, legacy tier4, unpublished and other-course chapters), active and draft KCs, a tween, a child, another learner, the tween\'s verified guardian and a stranger')

    def early(user, chapter, stage, learner, kcs="ARRAY['money.b6-prereq']", course='course', conflict=True):
        return (f"INSERT INTO {EARLY} (user_id, course_id, adventure_id, pathway_stage, learner_stage, prerequisite_kcs) "
                f"VALUES ('{U[user]}', '{C[course]}', '{A[chapter]}', '{stage}', '{learner}', {kcs})"
                + (' ON CONFLICT (user_id, adventure_id) DO NOTHING' if conflict else '') + ';')

    # ── Rule P8: only the one-stage-up pairs, and never an adult chapter ────
    service(early('tween', 'teens', 'teen', 'tween'))
    service(early('tween', 'legacy_teen', 'teen', 'tween'))
    service(early('child', 'tweens', 'tween', 'child'))
    assert run(f"SELECT count(*) FROM {EARLY}") == '3'
    check('P8 stores tween->teen (explicit and legacy tier4 chapters) and child->tween confirmations written by the service role, through the PostgREST upsert form')

    rejected('SET ROLE service_role;' + early('tween', 'adults', 'adult', 'tween'), 'check constraint')
    rejected('SET ROLE service_role;' + early('tween', 'adults', 'teen', 'tween'), 'EARLY_ACCESS_STAGE_MISMATCH')
    rejected('SET ROLE service_role;' + early('child', 'teens', 'teen', 'child'), 'course_chapter_early_access_one_stage')
    rejected('SET ROLE service_role;' + early('tween', 'tweens', 'tween', 'tween'), 'course_chapter_early_access_one_stage')
    rejected('SET ROLE service_role;' + early('child', 'teens', 'tween', 'child'), 'EARLY_ACCESS_STAGE_MISMATCH')
    rejected('SET ROLE service_role;' + early('child', 'kids', 'tween', 'child'), 'EARLY_ACCESS_STAGE_MISMATCH')
    rejected('SET ROLE service_role;' + early('other', 'other_teen', 'teen', 'tween'), 'EARLY_ACCESS_CHAPTER_INVALID')
    rejected('SET ROLE service_role;' + early('other', 'draft_teen', 'teen', 'tween'), 'EARLY_ACCESS_CHAPTER_INVALID')
    rejected('SET ROLE service_role;' + early('other', 'teens', 'teen', 'tween', kcs="ARRAY[]::text[]"), 'course_chapter_early_access_has_evidence')
    rejected('SET ROLE service_role;' + early('other', 'teens', 'teen', 'tween', kcs="ARRAY['money.b6-prereq', NULL]"), 'course_chapter_early_access_has_evidence')
    rejected('SET ROLE service_role;' + early('other', 'teens', 'teen', 'adult'), 'check constraint')
    assert run(f"SELECT count(*) FROM {EARLY}") == '3'
    check('P8 refuses, even for the service role: an adult chapter (as adult or disguised as teen), two stages up, the same stage, a stage that is not the chapter\'s (explicit or legacy), a chapter of another course, an unpublished chapter, no or NULL prerequisite evidence, and an adult learner stage')

    first = run(f"SELECT confirmed_at FROM {EARLY} WHERE user_id = '{U['tween']}' AND adventure_id = '{A['teens']}'")
    service(early('tween', 'teens', 'teen', 'tween', kcs="ARRAY['money.b6-taught']"))
    where = f"user_id = '{U['tween']}' AND adventure_id = '{A['teens']}'"
    assert run(f"SELECT (SELECT count(*) FROM {EARLY} WHERE {where}) || ' ' || (SELECT prerequisite_kcs::text || ' ' || confirmed_at FROM {EARLY} WHERE {where})") \
        == f"1 {{money.b6-prereq}} {first}"
    rejected('SET ROLE service_role;' + early('tween', 'teens', 'teen', 'tween', conflict=False), 'duplicate key')
    check('P8 is idempotent: a replayed confirmation is ignored by the primary key and the first row (evidence and time) is kept; a plain duplicate insert is refused')

    # ── Rule E3: mastery-offer decisions ────────────────────────────────────
    def decide(user, topic, decision, kcs="ARRAY['money.b6-taught']", course='course', conflict=True):
        return (f"INSERT INTO {DECISIONS} (user_id, course_id, topic_id, decision, kcs) "
                f"VALUES ('{U[user]}', '{C[course]}', '{T[topic]}', '{decision}', {kcs})"
                + (' ON CONFLICT (user_id, topic_id) DO NOTHING' if conflict else '') + ';')

    service(decide('tween', 'kids', 'accepted'))
    service(decide('tween', 'tweens', 'declined'))
    service(decide('other', 'kids', 'declined'))
    service(decide('tween', 'kids', 'declined'))
    assert run(f"SELECT decision FROM {DECISIONS} WHERE user_id = '{U['tween']}' AND topic_id = '{T['kids']}'") == 'accepted'
    assert run(f"SELECT count(*) FROM {DECISIONS}") == '3'
    check('E3 stores accepted and declined decisions per learner and topic; a later opposite decision through the upsert form is ignored, so the first decision stands')

    rejected('SET ROLE service_role;' + decide('child', 'kids', 'maybe'), 'check constraint')
    rejected('SET ROLE service_role;' + decide('child', 'other_teen', 'accepted'), 'MASTERY_DECISION_TOPIC_INVALID')
    rejected('SET ROLE service_role;' + decide('child', 'kids', 'accepted', kcs="ARRAY['money.b6-draft']"), 'MASTERY_DECISION_KC_INVALID')
    rejected('SET ROLE service_role;' + decide('child', 'kids', 'accepted', kcs="ARRAY['money.no-such-kc']"), 'MASTERY_DECISION_KC_INVALID')
    rejected('SET ROLE service_role;' + decide('child', 'kids', 'accepted', kcs="ARRAY[]::text[]"), 'course_topic_mastery_decisions_has_evidence')
    rejected('SET ROLE service_role;' + decide('child', 'kids', 'accepted', kcs="ARRAY[NULL]::text[]"), 'MASTERY_DECISION_KC_INVALID')
    assert run(f"SELECT count(*) FROM {DECISIONS} WHERE user_id = '{U['child']}'") == '0'
    check('E3 refuses an unknown decision, a topic outside the named course, a draft, unknown or NULL KC, and no KC evidence')

    # ── Write-once, for every role ──────────────────────────────────────────
    for table, column, value in ((EARLY, 'prerequisite_kcs', "ARRAY['money.b6-taught']"), (DECISIONS, 'decision', "'declined'")):
        rejected(f"UPDATE {table} SET {column} = {value} WHERE user_id = '{U['tween']}'", 'B6_LEARNER_DECISION_IMMUTABLE')
        rejected(f"SET ROLE service_role; UPDATE {table} SET {column} = {value} WHERE user_id = '{U['tween']}'", 'permission denied')
        rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{U['tween']}', false); UPDATE {table} SET {column} = {value}", 'permission denied')
    assert run(f"SELECT decision FROM {DECISIONS} WHERE user_id = '{U['tween']}' AND topic_id = '{T['kids']}'") == 'accepted'
    check('both tables are write-once: UPDATE is refused for the table owner (trigger), the service role and the learner (privilege)')

    # ── Browser roles: read own and a verified guardian's child, write nothing
    for table in (EARLY, DECISIONS):
        rejected(f"SET ROLE anon; SELECT count(*) FROM {table}", 'permission denied')
        assert last(as_user(U['tween'], f"SELECT count(*) FROM {table}")) == '2', table
        assert last(as_user(U['parent'], f"SELECT count(*) FROM {table}")) == '2', table
        assert last(as_user(U['parent'], f"SELECT count(*) FROM {table} WHERE user_id <> '{U['tween']}'")) == '0', table
        assert last(as_user(U['stranger'], f"SELECT count(*) FROM {table}")) == '0', table
        assert last(as_user(U['other'], f"SELECT count(*) FROM {table} WHERE user_id = '{U['tween']}'")) == '0', table
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{U['other']}', false); " + early('other', 'teens', 'teen', 'tween'), 'permission denied')
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{U['other']}', false); " + decide('other', 'tweens', 'accepted'), 'permission denied')
    rejected(f"SET ROLE anon; " + decide('other', 'tweens', 'accepted'), 'permission denied')
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{U['tween']}', false); DELETE FROM {DECISIONS}", 'permission denied')
    run(f"INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status) VALUES ('{U['pending_parent']}', '{U['tween']}', 'pending')")
    assert last(as_user(U['pending_parent'], f"SELECT count(*) FROM {EARLY}")) == '0'
    assert last(as_user(U['pending_parent'], f"SELECT count(*) FROM {DECISIONS}")) == '0'
    check('browser roles: anon reads nothing; the learner reads their own rows, a verified guardian their child\'s (an unverified guardian link reads nothing), a stranger and another learner nothing; no browser role inserts or deletes')

    # ── Erasure ─────────────────────────────────────────────────────────────
    service(f"DELETE FROM {DECISIONS} WHERE user_id = '{U['other']}'")
    assert run(f"SELECT count(*) FROM {DECISIONS} WHERE user_id = '{U['other']}'") == '0'
    service(decide('child', 'kids', 'accepted'))
    assert run(f"SELECT (SELECT count(*) FROM {EARLY} WHERE user_id = '{U['child']}') + (SELECT count(*) FROM {DECISIONS} WHERE user_id = '{U['child']}')") == '2'
    run(f"DELETE FROM auth.users WHERE id = '{U['child']}'")
    assert run(f"SELECT (SELECT count(*) FROM {EARLY} WHERE user_id = '{U['child']}') + (SELECT count(*) FROM {DECISIONS} WHERE user_id = '{U['child']}')") == '0'
    assert run(f"SELECT (SELECT count(*) FROM {EARLY} WHERE user_id = '{U['tween']}') || ' ' || (SELECT count(*) FROM {DECISIONS} WHERE user_id = '{U['tween']}')") == '2 2'
    check('erasure: the service role may delete a learner\'s rows, and deleting the account cascades both tables without touching other learners')

    report = {'database': database, 'server': run('SHOW server_version'), 'checks': checks}
    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
