"""E.3 repeated-report pattern trigger, by age (OD-3), against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs the minimal Supabase shim read
from verify-social-tiers-postgres.py, applies EVERY migration in
database/migrations in order and proves at the enforcing boundary
(public.evaluate_social_pattern, reached through submit_social_report and the
blocks trigger):

  - three self-registered 13-17 teens (no guardian) blocking one adult queue
    it for staff review automatically (origin 'pattern'); two do not;
  - reports and blocks mix: two teens reporting and one blocking another adult
    cross the threshold (the pattern evaluation returns true);
  - adults never count; minors of both tiers mix (two siblings count once,
    plus an unrelated child and a teen reach 3);
  - the subject's own family never counts: a child blocking its own verified
    Tutor, or a sibling of the subject; a teen joined to the subject by a
    verified guardian link is excluded, while a merely pending link started by
    the subject does not shield it;
  - mutation checks: restoring the 0108 rules (role = 'kid', and skipping a
    reporter with no guardian) turns the independent-teen case red;
  - the E.3 guardian notice follows age too (submit_social_report): a
    guardian-linked under-13 origin account (no kid role) reporting, or being
    reported, notifies its verified guardian; an unlinked teen reporter
    notifies nobody; restoring the kid-role test loses the notice.

Configuration (same variables as the other verifiers):
  LF_PG_PSQL   path to psql      (default <repo>/.codex/audit-db/pgsql/bin/psql.exe)
  LF_PG_PORT   port              (default 15483)
  LF_PG_USER   superuser name    (default audit_owner)
  LF_PG_KEEP   set to 1 to keep the throwaway database for inspection
"""
from pathlib import Path
import os
import re
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


SHIM = re.search(r'SHIM = """(.*?)"""', (ROOT / 'database/scripts/verify-social-tiers-postgres.py').read_text(encoding='utf-8'), re.S).group(1)
MIGRATION = next((ROOT / 'database/migrations').glob('*_social_pattern_age_based.sql'))

database = 'lf_social_pattern_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(query):
    return run('SET ROLE service_role;' + query)


def check(name):
    checks.append(name)
    print('ok -', name)


def block(blocker, blocked):
    # The blocker's own session writes the edge; the 0095 audit trigger records
    # it with the session actor and the 0108 trigger evaluates the pattern.
    run(f"SELECT set_config('request.jwt.claim.sub', '{blocker}', false); "
        f"INSERT INTO blocks (blocker_id, blocked_id) VALUES ('{blocker}', '{blocked}')")


def report(reporter, subject):
    service(f"SELECT submit_social_report('{reporter}', '{subject}', 'unwanted_contact', NULL)")


def case(subject):
    return run(f"SELECT coalesce((SELECT origin || '/' || status FROM social_review_cases WHERE subject_id = '{subject}'), 'none')")


def evaluate(subject):
    return run(f"SELECT evaluate_social_pattern('{subject}')")


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    teens = [f'teen{n}' for n in range(1, 8)]
    adults = ['a_block', 'a_mixed', 'a_adults', 'a_minors', 'a_linked', 'a_pending', 'a_notice', 'b1', 'b2', 'b3']
    ids = {name: str(uuid.uuid4()) for name in teens + adults + ['parent', 'parent2', 'kid', 'sibling', 'other_kid', 'origin_kid']}
    I = ids
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{k}@example.com')" for k, v in ids.items()) + ';')
    run(f"""
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['parent']}', 'parent', NULL), ('{I['parent2']}', 'parent', NULL)
        ON CONFLICT DO NOTHING;
    INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
        VALUES ('{I['parent']}', 'verified', 'local-ocr', 'P', 'One', '1985-03-01'), ('{I['parent2']}', 'verified', 'local-ocr', 'P', 'Two', '1984-03-01');
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{I['parent']}', '{I['kid']}', 'verified', now()), ('{I['parent']}', '{I['sibling']}', 'verified', now()),
        ('{I['parent2']}', '{I['other_kid']}', 'verified', now()), ('{I['parent2']}', '{I['origin_kid']}', 'verified', now());
    INSERT INTO account_safety_origins (user_id) VALUES ('{I['origin_kid']}');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['kid']}', 'kid', '{I['parent']}'),
        ('{I['sibling']}', 'kid', '{I['parent']}'), ('{I['other_kid']}', 'kid', '{I['parent2']}') ON CONFLICT DO NOTHING;
    INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES
        {', '.join(f"('{I[t]}', '13_to_17')" for t in teens)},
        {', '.join(f"('{I[a]}', 'adult')" for a in adults)},
        ('{I['kid']}', 'under_13'), ('{I['sibling']}', 'under_13'), ('{I['other_kid']}', 'under_13');
    """)
    tiers = {name: service(f"SELECT social_tier('{I[name]}')") for name in ids}
    assert all(tiers[t] == 'teen' for t in teens), tiers
    assert all(tiers[a] == 'adult' for a in adults), tiers
    assert tiers['kid'] == tiers['sibling'] == tiers['other_kid'] == tiers['origin_kid'] == 'guardian', tiers
    assert run(f"SELECT count(*) FROM user_roles WHERE role = 'kid' AND user_id = '{I['origin_kid']}'") == '0'
    assert run(f"SELECT count(*) FROM user_roles WHERE role = 'kid' AND user_id IN ({', '.join(repr(I[t]) for t in teens)})") == '0'
    check('seeded: seven self-registered teens (teen tier, no kid role, no guardian), ten adults, two verified Tutors, three children in two families, one linked under-13 origin account without the kid role')

    # ── Independent teens, blocks only ──────────────────────────────────────
    block(I['teen1'], I['a_block'])
    block(I['teen2'], I['a_block'])
    assert case(I['a_block']) == 'none', case(I['a_block'])
    block(I['teen3'], I['a_block'])
    assert case(I['a_block']) == 'pattern/open', case(I['a_block'])
    check('three independent teens blocking one adult queue it automatically (origin pattern); two do not')

    # ── Reports and blocks mixed ────────────────────────────────────────────
    report(I['teen4'], I['a_mixed'])
    block(I['teen5'], I['a_mixed'])
    assert evaluate(I['a_mixed']) == 'f'
    report(I['teen6'], I['a_mixed'])
    assert evaluate(I['a_mixed']) == 't'
    assert case(I['a_mixed']) == 'report/open', case(I['a_mixed'])
    check('two teen reports and one teen block against one adult cross the threshold; two events do not')

    # ── Adults never count ──────────────────────────────────────────────────
    for adult in ('b1', 'b2', 'b3'):
        block(I[adult], I['a_adults'])
    assert case(I['a_adults']) == 'none' and evaluate(I['a_adults']) == 'f'
    check('three adults blocking one adult open nothing')

    # ── Minor tiers mix; siblings count once ────────────────────────────────
    block(I['kid'], I['a_minors'])
    block(I['sibling'], I['a_minors'])
    block(I['other_kid'], I['a_minors'])
    assert case(I['a_minors']) == 'none', 'siblings counted twice'
    block(I['teen7'], I['a_minors'])
    assert case(I['a_minors']) == 'pattern/open', case(I['a_minors'])
    check('two siblings count once; with an unrelated child and an independent teen the adult is queued')

    # ── The subject's own family never counts ───────────────────────────────
    block(I['kid'], I['parent'])
    block(I['other_kid'], I['parent'])
    block(I['teen1'], I['parent'])
    assert evaluate(I['parent']) == 'f' and case(I['parent']) == 'none', 'a child counted against its own Tutor'
    block(I['teen2'], I['parent'])
    assert evaluate(I['parent']) == 't'
    block(I['other_kid'], I['sibling'])
    block(I['teen3'], I['sibling'])
    block(I['kid'], I['sibling'])
    assert evaluate(I['sibling']) == 'f', 'a sibling counted against the subject'
    check("a child blocking its own Tutor, or a sibling blocking the subject, is the subject's family and never counts")

    # A guardian-less teen joined to the subject by a verified link is family;
    # a pending link the subject started is not a relationship and shields
    # nothing. The link rows are written directly (the shape the rule reads).
    run(f"""
    ALTER TABLE guardian_links DISABLE TRIGGER USER;
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
        VALUES ('{I['teen4']}', '{I['a_linked']}', 'verified', now());
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status)
        VALUES ('{I['a_pending']}', '{I['teen5']}', 'pending');
    ALTER TABLE guardian_links ENABLE TRIGGER USER;
    """)
    for teen in ('teen4', 'teen6', 'teen7'):
        block(I[teen], I['a_linked'])
    assert evaluate(I['a_linked']) == 'f', 'a teen joined to the subject by a verified link counted'
    for teen in ('teen5', 'teen6', 'teen7'):
        block(I[teen], I['a_pending'])
    assert service(f"SELECT social_tier('{I['teen5']}')") == 'teen'
    assert case(I['a_pending']) == 'pattern/open', 'a pending link shielded the subject'
    check('a teen joined to the subject by a verified guardian link is excluded; a pending link the subject started shields nothing')

    # ── Mutation checks against the rule itself ─────────────────────────────
    source = MIGRATION.read_text(encoding='utf-8')
    role_gate = re.sub(
        r"reporter_tier := public\.social_tier\(reporter\.reporter_id\);\s*IF reporter_tier IS NULL OR reporter_tier NOT IN \('guardian', 'teen'\) THEN",
        "IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = reporter.reporter_id AND ur.role = 'kid') THEN",
        source)
    assert role_gate != source, 'the role mutation did not apply'
    no_guardian_skip = source.replace(
        '-- No guardian: its own unit, unless a verified guardian link',
        'CONTINUE; -- mutation: 0108 skipped a reporter with no guardian')
    assert no_guardian_skip != source, 'the guardian mutation did not apply'
    for name, mutant in (("role = 'kid'", role_gate), ('skip a reporter with no guardian', no_guardian_skip)):
        run(mutant)
        run(f"DELETE FROM social_review_cases WHERE subject_id = '{I['a_block']}'")
        assert evaluate(I['a_block']) == 'f', f'mutation {name!r} survived'
        run(source)
        assert evaluate(I['a_block']) == 't'
        print(f'   mutation {name!r} turns the independent-teen case red')
    check('mutation checks: restoring role = \'kid\' or the no-guardian skip fails the independent-teen case')

    # ── The guardian notice follows age (OD-3) ──────────────────────────────
    def notices(guardian, child, subject):
        return run(f"SELECT count(*) FROM social_safety_notices WHERE guardian_id = '{guardian}' "
                   f"AND kid_user_id = '{child}' AND subject_id = '{subject}'")
    report(I['origin_kid'], I['a_notice'])
    assert notices(I['parent2'], I['origin_kid'], I['a_notice']) == '1', 'a linked origin reporter did not notify its guardian'
    report(I['b1'], I['origin_kid'])
    assert notices(I['parent2'], I['origin_kid'], I['origin_kid']) == '1', 'a reported linked origin did not notify its guardian'
    report(I['teen1'], I['b2'])
    assert run(f"SELECT count(*) FROM social_safety_notices WHERE subject_id = '{I['b2']}'") == '0', 'an unlinked teen reporter produced a notice'
    kid_role = source.replace('WHERE public.social_child_account(p_reporter_id)',
                              "WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_reporter_id AND ur.role = 'kid')")
    assert kid_role != source, 'the notice mutation did not apply'
    run(kid_role)
    report(I['origin_kid'], I['b3'])
    assert notices(I['parent2'], I['origin_kid'], I['b3']) == '0', "mutation role = 'kid' on the notice survived"
    run(source)
    report(I['origin_kid'], I['a_adults'])
    assert notices(I['parent2'], I['origin_kid'], I['a_adults']) == '1'
    check("the E.3 guardian notice follows age: a linked under-13 origin account reporting or reported notifies its guardian; "
          "an unlinked teen notifies nobody; restoring role = 'kid' loses the notice")

    for role in ('anon', 'authenticated', 'service_role'):
        try:
            run(f"SET ROLE {role}; SELECT evaluate_social_pattern('{I['a_block']}')")
        except RuntimeError as error:
            assert 'permission denied' in str(error), str(error)
        else:
            raise AssertionError(f'{role} executed evaluate_social_pattern')
    check('no browser role and not the service role can call the pattern rule directly')

    print(f'\n{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
