"""E.10, E.11 and E.12 standing guardrails against real PostgreSQL (S08.7).

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs the same minimal Supabase shim
as verify-social-tiers-postgres.py (anon/authenticated/service_role with
Supabase's default grants, an auth schema with users and uid()/role()),
applies EVERY migration in database/migrations in order and proves at the
enforcing boundary:

  - E.12: the avatar is a closed DiceBear option set and the cover one of ten
    presets, for the browser writer (the own-row policies Core also uses) and
    the service role alike: an image URL, a link, a phone number, an unknown
    key or an oversized value is refused; a legacy off-schema row does not
    block an unrelated edit and is counted by the metric;
  - E.10: the live-catalog scan finds nothing unreviewed in the migrated
    schema, and finds a messaging table, a disguised person-to-person text
    table and a reply column added to a reviewed table;
  - E.11: one sweep run applies every retention class of the written policy
    (unanswered requests expire with an audit, closed requests go after the
    cooldown, report notes then reports, resolved cases, notices) and leaves
    everything still in force alone (open reports, approved and accepted
    connections, family edges, blocks, a teen's legacy inbound edge, and the
    append-only audit log, old entries included); an edge exposing a child
    without a current guardian's decision is removed and audited; the page limit
    holds and a second run completes; the run is audited; the metric reports
    zero overdue afterwards;
  - no browser role can execute any new function.

Configuration (same variables as the other verifiers):
  LF_PG_PSQL   path to psql      (default <repo>/.codex/audit-db/pgsql/bin/psql.exe)
  LF_PG_PORT   port              (default 15483)
  LF_PG_USER   superuser name    (default audit_owner)
  LF_PG_KEEP   set to 1 to keep the throwaway database for inspection
  LF_PG_REPORT optional path for a JSON report of the passed checks
"""
from pathlib import Path
import json
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


# One shim for every social verifier: read it from the tiers verifier so the
# two can never drift apart.
SHIM = re.search(r'SHIM = """(.*?)"""', (ROOT / 'database/scripts/verify-social-tiers-postgres.py').read_text(encoding='utf-8'), re.S).group(1)

database = 'lf_social_governance_' + uuid.uuid4().hex[:12]
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


def days_ago(n):
    return f"now() - interval '{n} days'"


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    # ── Populations ─────────────────────────────────────────────────────────
    ids = {name: str(uuid.uuid4()) for name in (
        'parent', 'parent2', 'kid', 'sibling', 'other_kid', 'teen', 'adult', 'adult2', 'stranger', 'approved',
        'stale', 'origin_child')}
    I = ids
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{k}@example.com')" for k, v in ids.items()) + ';')
    run(f"""
    UPDATE profiles SET display_name = initcap(p.k), username = p.k
      FROM (VALUES {', '.join(f"('{v}'::uuid, '{k}')" for k, v in ids.items())}) AS p(id, k)
      WHERE profiles.user_id = p.id;
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['parent']}', 'parent', NULL), ('{I['parent2']}', 'parent', NULL);
    INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
        VALUES ('{I['parent']}', 'verified', 'local-ocr', 'P', 'One', '1985-03-01'), ('{I['parent2']}', 'verified', 'local-ocr', 'P', 'Two', '1984-03-01');
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{I['parent']}', '{I['kid']}', 'verified', now()), ('{I['parent']}', '{I['sibling']}', 'verified', now()),
        ('{I['parent2']}', '{I['other_kid']}', 'verified', now());
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['kid']}', 'kid', '{I['parent']}'),
        ('{I['sibling']}', 'kid', '{I['parent']}'), ('{I['other_kid']}', 'kid', '{I['parent2']}');
    INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES
        ('{I['teen']}', '13_to_17'), ('{I['adult']}', 'adult'), ('{I['adult2']}', 'adult'),
        ('{I['stranger']}', 'adult'), ('{I['approved']}', 'adult'), ('{I['kid']}', 'under_13'), ('{I['stale']}', 'adult');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['origin_child']}', 'universal', NULL) ON CONFLICT DO NOTHING;
    INSERT INTO account_safety_origins (user_id) VALUES ('{I['origin_child']}');
    """)
    assert service(f"SELECT social_tier('{I['origin_child']}')") == 'closed'
    assert service(f"SELECT social_child_account('{I['origin_child']}')") == 't'
    assert service(f"SELECT social_child_account('{I['teen']}')") == 'f' and service(f"SELECT social_child_account('{I['adult']}')") == 'f'
    check('seeded: two verified Tutors, three children in two families, an unlinked under-13 origin (closed tier, still a child), an independent teen and five adults')

    # ── E.12: avatar and cover shapes, every writer ─────────────────────────
    good = '{"seed": "Kid_01", "top": ["shortFlat"], "hairColor": ["2c1b18"], "facialHairProbability": 0, "accessoriesProbability": 40}'
    as_user(I['adult'], f"INSERT INTO avatars (user_id, options) VALUES ('{I['adult']}', '{good}')")
    as_user(I['adult'], f"UPDATE avatars SET options = '{{\"top\": [\"bob\"]}}' WHERE user_id = '{I['adult']}'")
    bad_options = [
        '{"imageUrl": "https://example.com/me.png"}',
        '{"seed": "call me 5551234567"}',
        '{"seed": "https://example.com"}',
        '{"top": ["a", "b", "c", "d"]}',
        '{"top": ["https://example.com/x.png"]}',
        '{"top": [7]}',
        '{"top": "bob"}',
        '{"accessoriesProbability": 101}',
        '{"accessoriesProbability": 1.5}',
        '{"backgroundColor": ["ffffff"]}',
        '[]',
    ]
    for bad in bad_options:
        rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['adult']}', false); UPDATE avatars SET options = '{bad}' WHERE user_id = '{I['adult']}'", 'AVATAR_OPTIONS_INVALID')
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['kid']}', false); INSERT INTO avatars (user_id, options) VALUES ('{I['kid']}', '{{\"photo\": \"data:image/png;base64,AAAA\"}}')", 'AVATAR_OPTIONS_INVALID')
    rejected(f"SET ROLE service_role; INSERT INTO avatars (user_id, options) VALUES ('{I['teen']}', '{{\"url\": \"https://example.com\"}}')", 'AVATAR_OPTIONS_INVALID')
    rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['adult']}', false); UPDATE avatars SET seed = 'find me on snap' WHERE user_id = '{I['adult']}'", 'AVATAR_OPTIONS_INVALID')
    as_user(I['adult'], f"INSERT INTO avatars (user_id, options) VALUES ('{I['adult']}', '{{\"top\": [\"bob\"]}}') ON CONFLICT (user_id) DO UPDATE SET options = EXCLUDED.options")
    check(f'avatar: a closed cartoon option set; {len(bad_options) + 3} off-schema writes (image URL, data URI, link, phone number, unknown key, oversized array, wrong types, out-of-range number, free-text seed) refused for the browser writer and the service role; valid inserts, updates and the upsert Core uses pass')

    as_user(I['adult'], f"UPDATE profiles SET cover = '{{\"preset\": \"ocean\"}}' WHERE user_id = '{I['adult']}'")
    as_user(I['adult'], f"UPDATE profiles SET cover = '{{}}' WHERE user_id = '{I['adult']}'")
    for bad in ('{"preset": "ocean", "image": "https://example.com/c.png"}', '{"preset": "nope"}', '{"url": "https://example.com"}', '{"preset": 3}', '"ocean"'):
        rejected(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{I['adult']}', false); UPDATE profiles SET cover = '{bad}' WHERE user_id = '{I['adult']}'", 'PROFILE_COVER_INVALID')
    rejected(f"SET ROLE service_role; UPDATE profiles SET cover = '{{\"image\": \"x\"}}' WHERE user_id = '{I['teen']}'", 'PROFILE_COVER_INVALID')
    check('cover: one of ten presets or empty; an image, a link, an unknown preset or a wrong type is refused for the browser writer and the service role')

    # Legacy off-schema rows written before the guard (as the owner, trigger off).
    run(f"""ALTER TABLE avatars DISABLE TRIGGER avatar_shape_guard;
        INSERT INTO avatars (user_id, options) VALUES ('{I['stranger']}', '{{"note": "dm me"}}');
        ALTER TABLE avatars ENABLE TRIGGER avatar_shape_guard;
        ALTER TABLE profiles DISABLE TRIGGER profile_cover_guard;
        UPDATE profiles SET cover = '{{"preset": "ocean", "image": "https://example.com"}}' WHERE user_id = '{I['stranger']}';
        ALTER TABLE profiles ENABLE TRIGGER profile_cover_guard;""")
    as_user(I['stranger'], f"UPDATE profiles SET locale = 'es-MX' WHERE user_id = '{I['stranger']}'")
    as_user(I['stranger'], f"UPDATE avatars SET updated_at = now() WHERE user_id = '{I['stranger']}'")
    off = json.loads(service('SELECT social_governance_metrics()'))['offSchema']
    assert off == {'avatars': 1, 'covers': 1}, off
    as_user(I['stranger'], f"UPDATE avatars SET options = '{{\"top\": [\"bob\"]}}' WHERE user_id = '{I['stranger']}'")
    as_user(I['stranger'], f"UPDATE profiles SET cover = '{{\"preset\": \"mint\"}}' WHERE user_id = '{I['stranger']}'")
    off = json.loads(service('SELECT social_governance_metrics()'))['offSchema']
    assert off == {'avatars': 0, 'covers': 0}, off
    check('a legacy off-schema avatar and cover do not block unrelated edits, are counted by the metric (1/1) and clear when the holder saves a valid value (0/0)')

    # ── E.10: the live-catalog messaging scan ───────────────────────────────
    assert service('SELECT social_messaging_surfaces()') == '[]', service('SELECT social_messaging_surfaces()')
    run("""CREATE TABLE public.direct_messages (id uuid PRIMARY KEY, sender_id uuid REFERENCES auth.users(id), recipient_id uuid REFERENCES auth.users(id), body text);
           CREATE TABLE public.kid_notes (id uuid PRIMARY KEY, author uuid REFERENCES auth.users(id), kid uuid REFERENCES auth.users(id), content text, kind text CHECK (kind IN ('a', 'b')));
           ALTER TABLE public.tasks ADD COLUMN kid_reply text;
           CREATE TABLE public.lesson_hints (id uuid PRIMARY KEY, author uuid REFERENCES auth.users(id), body text);""")
    found = json.loads(service('SELECT social_messaging_surfaces()'))
    for expected in ('table:direct_messages', 'text:direct_messages.body',
                     'text:kid_notes.content', 'column:tasks.kid_reply', 'text:tasks.kid_reply'):
        assert expected in found, (expected, found)
    assert 'text:kid_notes.kind' not in found and not any('lesson_hints' in f for f in found), found
    assert json.loads(service('SELECT social_governance_metrics()'))['messagingSurfaces'] == found
    run('DROP TABLE public.direct_messages; DROP TABLE public.kid_notes; DROP TABLE public.lesson_hints; ALTER TABLE public.tasks DROP COLUMN kid_reply;')
    assert service('SELECT social_messaging_surfaces()') == '[]'
    check(f'messaging scan: nothing unreviewed in the migrated schema; a messages table, a disguised person-to-person text table and a reply column on tasks are all found ({len(found)} objects); a closed-set column and a one-author table are not; the metric carries the same list')

    # ── Browser roles cannot reach the new functions ────────────────────────
    for role in ('anon', 'authenticated'):
        for call in ('run_social_graph_retention(10)', 'social_governance_metrics()', 'social_messaging_surfaces()',
                     'social_retention_windows()', f"social_edge_consented('{I['kid']}', '{I['adult']}')", f"social_child_account('{I['kid']}')",
                     "avatar_options_valid('{}')", "profile_cover_valid('{}')"):
            rejected(f'SET ROLE {role}; SELECT {call}', 'permission denied')
    rejected('SET ROLE service_role; SELECT run_social_graph_retention(0)', 'INVALID_RETENTION_LIMIT')
    rejected('SET ROLE service_role; SELECT run_social_graph_retention(5001)', 'INVALID_RETENTION_LIMIT')
    check('no browser role can execute the sweep, the metric, the scan or any helper; the sweep refuses a limit outside 1..5000')

    # ── E.11: seed every retention class ────────────────────────────────────
    def teen_request(requester, status, requested, decided=None):
        rid = str(uuid.uuid4())
        run(f"""INSERT INTO social_consent_requests (id, requester_id, subject_id, status, requested_at, decided_at)
                VALUES ('{rid}', '{requester}', '{I['teen']}', '{status}', {requested}, {decided or 'NULL'})""")
        return rid

    def kid_request(requester, kid, status, requested, decided=None, decider=None):
        rid = str(uuid.uuid4())
        run(f"""INSERT INTO social_connection_requests (id, requester_id, kid_user_id, status, requested_at, decided_at, decided_by)
                VALUES ('{rid}', '{requester}', '{kid}', '{status}', {requested}, {decided or 'NULL'}, {f"'{decider}'" if decider else 'NULL'})""")
        return rid

    teen_old_pending = teen_request(I['adult'], 'pending', days_ago(31))
    teen_new_pending = teen_request(I['adult2'], 'pending', days_ago(29))
    teen_old_declined = teen_request(I['stranger'], 'declined', days_ago(60), days_ago(31))
    teen_recent_declined = teen_request(I['parent2'], 'declined', days_ago(20), days_ago(10))
    kid_old_pending = kid_request(I['adult'], I['kid'], 'pending', days_ago(31))
    kid_new_pending = kid_request(I['adult2'], I['kid'], 'pending', days_ago(5))
    kid_old_denied = kid_request(I['stranger'], I['kid'], 'denied', days_ago(60), days_ago(31), I['parent'])
    kid_old_revoked = kid_request(I['stranger'], I['sibling'], 'revoked', days_ago(60), days_ago(40), I['parent'])
    kid_approved = kid_request(I['approved'], I['kid'], 'approved', days_ago(500), days_ago(499), I['parent'])
    # An approval whose decider is not a current verified guardian of the
    # child (here: another family's Tutor; in production, a guardian whose
    # link or verification has since ended) does not keep an edge alive.
    kid_request(I['stale'], I['kid'], 'approved', days_ago(300), days_ago(299), I['parent2'])

    # Live edges: an approved outsider follows the child and the child follows
    # back; the child follows its own Tutor; the approved adult is also
    # followed by the teen (the teen's choice).
    service(f"INSERT INTO follows (follower_id, followed_id) VALUES ('{I['approved']}', '{I['kid']}')")
    as_user(I['kid'], f"INSERT INTO follows (follower_id, followed_id) VALUES ('{I['kid']}', '{I['approved']}')")
    as_user(I['kid'], f"INSERT INTO follows (follower_id, followed_id) VALUES ('{I['kid']}', '{I['parent']}')")
    as_user(I['adult'], f"INSERT INTO follows (follower_id, followed_id) VALUES ('{I['adult']}', '{I['stranger']}')")
    # Legacy edges from before E.1/S08.6 (triggers off, as the owner).
    run(f"""SET session_replication_role = replica;
        INSERT INTO follows (follower_id, followed_id, created_at) VALUES
            ('{I['kid']}', '{I['stranger']}', {days_ago(200)}),
            ('{I['stranger']}', '{I['other_kid']}', {days_ago(200)}),
            ('{I['other_kid']}', '{I['kid']}', {days_ago(200)}),
            ('{I['adult2']}', '{I['teen']}', {days_ago(200)}),
            ('{I['stale']}', '{I['kid']}', {days_ago(200)}),
            ('{I['adult']}', '{I['origin_child']}', {days_ago(200)});
        SET session_replication_role = origin;""")
    as_user(I['teen'], f"INSERT INTO blocks (blocker_id, blocked_id) VALUES ('{I['teen']}', '{I['stranger']}')")
    run(f"UPDATE blocks SET created_at = {days_ago(900)} WHERE blocker_id = '{I['teen']}'")

    open_report = str(uuid.uuid4())
    note_report = str(uuid.uuid4())
    old_report = str(uuid.uuid4())
    run(f"""INSERT INTO social_reports (id, reporter_id, subject_id, category, note, status, created_at, resolved_at, resolved_by) VALUES
        ('{open_report}', '{I['kid']}', '{I['stranger']}', 'unwanted_contact', 'he keeps asking', 'open', {days_ago(400)}, NULL, NULL),
        ('{note_report}', '{I['teen']}', '{I['stranger']}', 'harassment', 'rude words', 'resolved', {days_ago(120)}, {days_ago(91)}, '{I['parent2']}'),
        ('{old_report}', '{I['adult']}', '{I['stranger']}', 'other', 'old', 'resolved', {days_ago(400)}, {days_ago(366)}, '{I['parent2']}');
        INSERT INTO social_review_cases (subject_id, origin, status, first_seen_at, last_seen_at, resolved_at, resolved_by) VALUES
        ('{I['adult2']}', 'report', 'resolved', {days_ago(400)}, {days_ago(400)}, {days_ago(366)}, '{I['parent2']}'),
        ('{I['stranger']}', 'report', 'open', {days_ago(400)}, {days_ago(1)}, NULL, NULL);
        INSERT INTO social_safety_notices (guardian_id, kid_user_id, kind, subject_id, report_id, created_at, read_at) VALUES
        ('{I['parent']}', '{I['kid']}', 'social.report', '{I['stranger']}', '{open_report}', {days_ago(120)}, {days_ago(91)}),
        ('{I['parent']}', '{I['kid']}', 'social.report', '{I['stranger']}', '{open_report}', {days_ago(366)}, NULL),
        ('{I['parent']}', '{I['kid']}', 'social.report', '{I['stranger']}', '{open_report}', {days_ago(100)}, NULL),
        ('{I['parent']}', '{I['kid']}', 'social.report', '{I['stranger']}', '{open_report}', {days_ago(10)}, {days_ago(5)});
        INSERT INTO audit_logs (actor_id, action, subject, detail, created_at) VALUES
        (NULL, 'social.follow', 'x', '{{"marker": "old-follow"}}', {days_ago(401)}),
        (NULL, 'social.connection_approved', 'x', '{{"marker": "old-decision"}}', {days_ago(401)}),
        (NULL, 'social.follow', 'x', '{{"marker": "recent-follow"}}', {days_ago(399)}),
        (NULL, 'social.report', 'x', '{{"marker": "old-report"}}', {days_ago(401)}),
        (NULL, 'social.case_resolved', 'x', '{{"marker": "old-case"}}', {days_ago(401)}),
        (NULL, 'account.erased', 'x', '{{"marker": "old-account"}}', {days_ago(401)});""")

    before = json.loads(service('SELECT social_governance_metrics()'))
    assert before['overdue'] == {'teenPending': 1, 'guardianPending': 1, 'teenClosed': 1, 'guardianClosed': 2, 'reportNotes': 2,
                                 'resolvedReports': 1, 'resolvedCases': 1, 'notices': 2}, before['overdue']
    assert before['unconsentedChildEdges'] == 5, before
    assert before['lastSweep'] is None
    check(f"before the sweep the metric reports every overdue class and 5 edges exposing a child without a current guardian's decision: {json.dumps(before['overdue'])}")

    # A page limit of 1 leaves work for a second run.
    first = json.loads(service('SELECT run_social_graph_retention(1)'))
    assert first['complete'] is False and first['guardianClosedDeleted'] == 1 and first['unconsentedEdgesRemoved'] == 1, first
    second = json.loads(service('SELECT run_social_graph_retention(500)'))
    assert second['complete'] is True, second
    third = json.loads(service('SELECT run_social_graph_retention(500)'))
    assert all(v == 0 for k, v in third.items() if k not in ('limit', 'complete')) and third['complete'] is True, third
    assert run("SELECT count(*) FROM audit_logs WHERE action = 'social_retention.sweep_ran'") == '3'
    check('the page limit holds (limit 1 leaves the run incomplete), the next run completes, a third finds nothing, and every run is audited (3 sweep_ran rows)')

    def exists(table, where):
        return run(f'SELECT count(*) FROM {table} WHERE {where}') == '1'

    assert not exists('social_consent_requests', f"id = '{teen_old_pending}'") and exists('social_consent_requests', f"id = '{teen_new_pending}'")
    assert not exists('social_connection_requests', f"id = '{kid_old_pending}'") and exists('social_connection_requests', f"id = '{kid_new_pending}'")
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'social.connection_expired' AND detail->>'request_id' IN ('{teen_old_pending}', '{kid_old_pending}')") == '2'
    assert run(f"SELECT detail->>'tier' FROM audit_logs WHERE action = 'social.connection_expired' AND detail->>'request_id' = '{kid_old_pending}'") == 'guardian'
    check('unanswered requests older than 30 days expire (teen and child), each with a social.connection_expired audit naming its tier; a 29-day and a 5-day request stay')

    assert not exists('social_consent_requests', f"id = '{teen_old_declined}'") and exists('social_consent_requests', f"id = '{teen_recent_declined}'")
    rejected(f"SET ROLE service_role; SELECT request_teen_connection('{I['parent2']}', '{I['teen']}')", 'SOCIAL_REQUEST_COOLDOWN')
    assert not exists('social_connection_requests', f"id = '{kid_old_denied}'") and not exists('social_connection_requests', f"id = '{kid_old_revoked}'")
    assert exists('social_connection_requests', f"id = '{kid_approved}'")
    again = service(f"SELECT request_social_connection('{I['adult']}', '{I['kid']}')")
    assert again and again != kid_old_pending
    check('closed requests go 30 days after the decision; a 10-day decline still enforces the teen cooldown; the 500-day approval that a live edge depends on stays; an expired requester may ask again')

    assert run(f"SELECT note IS NULL FROM social_reports WHERE id = '{note_report}'") == 't'
    assert not exists('social_reports', f"id = '{old_report}'")
    assert run(f"SELECT note FROM social_reports WHERE id = '{open_report}'") == 'he keeps asking'
    assert not exists('social_review_cases', f"subject_id = '{I['adult2']}'") and exists('social_review_cases', f"subject_id = '{I['stranger']}'")
    assert run(f"SELECT count(*) FROM social_safety_notices WHERE guardian_id = '{I['parent']}'") == '2'
    check('a resolved report loses its note at 90 days and goes at 365; an open 400-day report keeps its note; a resolved case goes at 365, an open one stays; read notices go at 90 days and unread at 365 (2 of 4 remain)')

    def edge(a, b):
        return run(f"SELECT count(*) FROM follows WHERE follower_id = '{I[a]}' AND followed_id = '{I[b]}'") == '1'

    assert not edge('kid', 'stranger') and not edge('stranger', 'other_kid')
    assert not edge('other_kid', 'kid')
    assert not edge('stale', 'kid') and not edge('adult', 'origin_child')
    assert edge('approved', 'kid') and edge('kid', 'approved') and edge('kid', 'parent')
    assert edge('adult2', 'teen') and edge('adult', 'stranger')
    assert run(f"SELECT count(*) FROM blocks WHERE blocker_id = '{I['teen']}'") == '1'
    removed = run("SELECT count(*) FROM audit_logs WHERE action = 'social.retention_removed' AND detail->>'reason' = 'no_guardian_decision'")
    unfollows = run(f"SELECT count(*) FROM audit_logs WHERE action = 'social.unfollow' AND detail->>'follower_id' IN ('{I['kid']}', '{I['stranger']}', '{I['other_kid']}', '{I['stale']}', '{I['adult']}')")
    assert removed == '5' and unfollows == '5', (removed, unfollows)
    check('edges exposing a child with no current guardian decision (child -> stranger, stranger -> child, child -> child across families, an approval decided by someone who is not a current guardian of the child, an adult -> an unlinked under-13 origin) are removed, each audited twice (unfollow by the trigger, retention_removed with the reason); the approved pair, the family edge, an adult edge, a teen\'s legacy inbound edge and a 900-day block stay')

    markers = run("SELECT string_agg(detail->>'marker', ',' ORDER BY detail->>'marker') FROM audit_logs WHERE detail ? 'marker'")
    assert markers == 'old-account,old-case,old-decision,old-follow,old-report,recent-follow', markers
    assert run("SELECT count(*) FROM audit_logs WHERE action LIKE 'social_retention.%' OR action IN ('social.connection_expired', 'social.retention_removed')") != '0'
    check('the audit log stays append-only: every seeded entry, including 401-day social-graph ones, survives three runs; the sweep only adds its own entries')

    after = json.loads(service('SELECT social_governance_metrics()'))
    assert all(v == 0 for v in after['overdue'].values()), after
    assert after['unconsentedChildEdges'] == 0 and after['messagingSurfaces'] == [] and after['lastSweep']['counts']['complete'] is True
    flat = json.dumps(after)
    assert all(v not in flat for v in ids.values())
    check(f"after the sweep the metric reports zero overdue, zero unconsented edges, no messaging surface and the last run; it carries no account id: {json.dumps(after['overdue'])}")

    report = {'database': database, 'server': run('SHOW server_version'), 'checks': checks}
    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
