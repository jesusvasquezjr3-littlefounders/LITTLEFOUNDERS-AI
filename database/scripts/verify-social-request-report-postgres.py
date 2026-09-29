"""E.3 from the request queues (GAP-FIX-R5 social, OD-8, D-19), against real PostgreSQL.

An inbound connection request is the first unwanted-contact event. Core now
lets the person deciding one report the requester from the queue (the Tutor
for a parent-created child; a self-registered teen for itself) and lets the
teen block the requester there. This proves, at the enforcing boundary, what
those actions do to the E.3 pattern trigger that OWNER-REVIEW-ANSWERS D-19
names as a limit on adults who ask teens to connect.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs the minimal Supabase shim read
from verify-social-tiers-postgres.py, applies EVERY migration in
database/migrations in order and proves:

  - a decline alone never reaches the pattern: three teens declining one
    adult's requests open nothing (evaluate_social_pattern reads reports and
    blocks only), and the adult may not ask a declining teen again for 30
    days;
  - three self-registered teens reporting one adult requester from their
    queues (pending or already declined) cross the pattern threshold; two do
    not;
  - three teens blocking one adult requester from their queues queue it for
    staff review automatically (origin 'pattern'); each block closes that
    teen's pending request ('removed') and the adult cannot ask that teen
    again;
  - a Tutor's report on a pending request to a parent-created child opens a
    staff review case (origin 'report') on its own, and, the Tutor being an
    adult, does not count toward the three-minor pattern.

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

database = 'lf_social_queue_report_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def service(query):
    return run('SET ROLE service_role;' + query)


def check(name):
    checks.append(name)
    print('ok -', name)


def refused(query, message):
    try:
        service(query)
    except RuntimeError as error:
        assert message in str(error), str(error)
        return
    raise AssertionError(f'expected {message}: {query}')


def ask_teen(requester, teen):
    """The adult asks a self-registered teen to connect (Core: POST /profiles/:username/connection-request)."""
    return service(f"SELECT request_teen_connection('{requester}', '{teen}')")


def teen_decides(request_id, teen, accept):
    """The teen's own queue decision (Core: POST /profile/connection-requests/:id/decision)."""
    return service(f"SELECT decide_teen_connection('{request_id}', '{teen}', {'true' if accept else 'false'})")


def report(reporter, subject):
    """Core's queue report routes call the same transaction as every other report."""
    service(f"SELECT submit_social_report('{reporter}', '{subject}', 'unwanted_contact', NULL)")


def block(blocker, blocked):
    """Core's teen queue block writes the edge with the teen's own session (the 0095 audit trigger records it)."""
    run(f"SELECT set_config('request.jwt.claim.sub', '{blocker}', false); "
        f"INSERT INTO blocks (blocker_id, blocked_id) VALUES ('{blocker}', '{blocked}')")


def case(subject):
    return run(f"SELECT coalesce((SELECT origin || '/' || status FROM social_review_cases WHERE subject_id = '{subject}'), 'none')")


def evaluate(subject):
    return run(f"SELECT evaluate_social_pattern('{subject}')")


def status(request_id):
    return run(f"SELECT status FROM social_consent_requests WHERE id = '{request_id}'")


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    teens = [f'teen{n}' for n in range(1, 10)]
    adults = ['decliner_target', 'report_target', 'block_target', 'kid_asker']
    ids = {name: str(uuid.uuid4()) for name in teens + adults + ['parent', 'kid']}
    I = ids
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{k}@example.com')" for k, v in ids.items()) + ';')
    run(f"""
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['parent']}', 'parent', NULL) ON CONFLICT DO NOTHING;
    INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
        VALUES ('{I['parent']}', 'verified', 'local-ocr', 'P', 'One', '1985-03-01');
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at)
        VALUES ('{I['parent']}', '{I['kid']}', 'verified', now());
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['kid']}', 'kid', '{I['parent']}') ON CONFLICT DO NOTHING;
    INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES
        {', '.join(f"('{I[t]}', '13_to_17')" for t in teens)},
        {', '.join(f"('{I[a]}', 'adult')" for a in adults)},
        ('{I['kid']}', 'under_13');
    """)
    tiers = {name: service(f"SELECT social_tier('{I[name]}')") for name in ids}
    assert all(tiers[t] == 'teen' for t in teens), tiers
    assert all(tiers[a] == 'adult' for a in adults), tiers
    assert tiers['kid'] == 'guardian', tiers
    check('seeded: nine self-registered teens (teen tier, no guardian), four adults, one verified Tutor with a parent-created child')

    # ── A decline alone never reaches the pattern ───────────────────────────
    declined = {}
    for teen in ('teen1', 'teen2', 'teen3'):
        declined[teen] = ask_teen(I['decliner_target'], I[teen])
        assert teen_decides(declined[teen], I[teen], False) == 'declined'
    assert evaluate(I['decliner_target']) == 'f' and case(I['decliner_target']) == 'none'
    refused(f"SELECT request_teen_connection('{I['decliner_target']}', '{I['teen1']}')", 'SOCIAL_REQUEST_COOLDOWN')
    check('three teens declining one adult open nothing (a decline is not a pattern input), and the adult waits 30 days to ask again')

    # ── Reports from the queue feed the pattern ─────────────────────────────
    # teen1 reports the adult it already declined (Core admits a declined
    # request for 30 days); teen4 and teen5 report from pending requests.
    report(I['teen1'], I['decliner_target'])
    assert evaluate(I['decliner_target']) == 'f'
    pending = {teen: ask_teen(I['report_target'], I[teen]) for teen in ('teen4', 'teen5', 'teen6')}
    report(I['teen4'], I['report_target'])
    report(I['teen5'], I['report_target'])
    assert evaluate(I['report_target']) == 'f', 'two queue reports crossed the threshold'
    assert case(I['report_target']) == 'report/open', case(I['report_target'])
    report(I['teen6'], I['report_target'])
    assert evaluate(I['report_target']) == 't', 'three queue reports did not cross the threshold'
    assert case(I['report_target']) == 'report/open', case(I['report_target'])
    assert all(status(r) == 'pending' for r in pending.values()), 'a report decided the request'
    report(I['teen2'], I['decliner_target'])
    report(I['teen3'], I['decliner_target'])
    assert evaluate(I['decliner_target']) == 't', 'reports after declines did not reach the pattern'
    check('three teens reporting one adult requester from their queues (pending or declined) cross the pattern threshold; two do not; a report leaves the request to decide')

    # ── Blocks from the queue feed the pattern and close the request ────────
    asks = {teen: ask_teen(I['block_target'], I[teen]) for teen in ('teen7', 'teen8', 'teen9')}
    block(I['teen7'], I['block_target'])
    block(I['teen8'], I['block_target'])
    assert case(I['block_target']) == 'none', case(I['block_target'])
    block(I['teen9'], I['block_target'])
    assert case(I['block_target']) == 'pattern/open', case(I['block_target'])
    assert all(status(r) == 'removed' for r in asks.values()), [status(r) for r in asks.values()]
    refused(f"SELECT request_teen_connection('{I['block_target']}', '{I['teen7']}')", 'SOCIAL_REQUEST_UNAVAILABLE')
    check("three teens blocking one adult requester from their queues queue it automatically (origin pattern); each block closes that teen's request and the adult cannot ask again")

    # ── The Tutor's queue report ────────────────────────────────────────────
    kid_request = service(f"SELECT request_social_connection('{I['kid_asker']}', '{I['kid']}')")
    assert run(f"SELECT status FROM social_connection_requests WHERE id = '{kid_request}'") == 'pending'
    report(I['parent'], I['kid_asker'])
    assert case(I['kid_asker']) == 'report/open', case(I['kid_asker'])
    assert evaluate(I['kid_asker']) == 'f', "an adult Tutor's report counted toward the three-minor pattern"
    assert run(f"SELECT count(*) FROM social_reports WHERE reporter_id = '{I['parent']}' AND subject_id = '{I['kid_asker']}'") == '1'
    report(I['parent'], I['kid_asker'])
    assert run(f"SELECT count(*) FROM social_reports WHERE reporter_id = '{I['parent']}' AND subject_id = '{I['kid_asker']}'") == '1', 'a retried report double-counted'
    assert run(f"SELECT status FROM social_connection_requests WHERE id = '{kid_request}'") == 'pending', 'a report decided the request'
    check("a Tutor's report on a pending request to their child opens a staff review case on its own, is idempotent, leaves the request to decide, and does not count toward the three-minor pattern")

    print(f'\n{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
