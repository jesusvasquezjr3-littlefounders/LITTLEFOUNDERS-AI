"""L-04 (owner decision OD-27 (1)): teen cooperative goals, against real PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim, applies
EVERY migration in database/migrations in order, and proves at the enforcing
boundary (migrations teen_cooperative_goals, teen_cooperative_goal_actions and
cooperative_goals_retention):

  - only a 13-to-17 participant takes part: the teen tier, or a parent-created
    child proven 13 to 17 whose verified guardian opted in; adults, children
    under 13, a child without the opt-in and a flagged teen are refused;
  - only mutual connections (consented follows both ways, no block) can be
    asked, and every member is connected with every other member;
  - the group is 2 to 5 people, one ask per person per goal, an invitee
    decides, anyone leaves, the creator removes, an unfollow ends the later
    joiner's membership, and a goal down to one person closes;
  - the only progress is the group total, returned to members only;
  - every change writes an audit row; the retention sweep reconciles, then
    deletes closed goals after the closed window;
  - no browser role can read the tables or call the functions.

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

database = 'lf_coop_goals_' + uuid.uuid4().hex[:12]
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


def month(years):
    return f"date_trunc('month', (now() AT TIME ZONE 'UTC')::date - interval '{years}')::date"


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    names = ("ana", 'bea', 'cai', 'dan', 'eva', 'flag', 'adult', 'parent', 'kid15', 'kid16', 'kid10')
    I = {name: str(uuid.uuid4()) for name in names}
    run('INSERT INTO auth.users (id, email) VALUES ' + ', '.join(f"('{v}', '{k}@example.com')" for k, v in I.items()) + ';')
    teens = ('ana', 'bea', 'cai', 'dan', 'eva', 'flag')
    run(f"""
    UPDATE profiles SET username = p.k, display_name = initcap(p.k)
      FROM (VALUES {', '.join(f"('{v}'::uuid, '{k}')" for k, v in I.items())}) AS p(id, k)
      WHERE profiles.user_id = p.id;
    INSERT INTO account_age_declarations (user_id, declared_age_band, declared_birth_month) VALUES
        {', '.join(f"('{I[t]}', '13_to_17', {month('15 years')})" for t in teens)},
        ('{I['adult']}', 'adult', NULL);
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['parent']}', 'parent', NULL);
    INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date)
        VALUES ('{I['parent']}', 'verified', 'local-ocr', 'P', 'One', '1985-03-01');
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{I['parent']}', '{I['kid15']}', 'verified', now()), ('{I['parent']}', '{I['kid16']}', 'verified', now()),
        ('{I['parent']}', '{I['kid10']}', 'verified', now());
    INSERT INTO user_roles (user_id, role, granted_by) VALUES
        ('{I['kid15']}', 'kid', '{I['parent']}'), ('{I['kid16']}', 'kid', '{I['parent']}'), ('{I['kid10']}', 'kid', '{I['parent']}');
    UPDATE profiles SET birth_date = ((now() AT TIME ZONE 'UTC')::date - interval '15 years')::date WHERE user_id = '{I['kid15']}';
    UPDATE profiles SET birth_date = ((now() AT TIME ZONE 'UTC')::date - interval '16 years')::date WHERE user_id = '{I['kid16']}';
    UPDATE profiles SET birth_date = ((now() AT TIME ZONE 'UTC')::date - interval '10 years')::date WHERE user_id = '{I['kid10']}';
    """)

    def connect(a, b):
        """a asks teen b, b accepts: a consented follow a -> b."""
        rid = service(f"SELECT request_teen_connection('{I[a]}', '{I[b]}')")
        assert service(f"SELECT decide_teen_connection('{rid}', '{I[b]}', true)") == 'accepted'

    for a, b in (('ana', 'bea'), ('bea', 'ana'), ('ana', 'cai'), ('cai', 'ana'), ('bea', 'cai'), ('cai', 'bea'),
                 ('ana', 'dan'), ('dan', 'ana'), ('ana', 'eva'), ('eva', 'ana'), ('bea', 'eva'), ('eva', 'bea'),
                 ('cai', 'eva'), ('eva', 'cai'), ('ana', 'flag'), ('flag', 'ana')):
        connect(a, b)
    # The two teenage siblings: their guardian approved each one's request to follow the other (E.1).
    run(f"""INSERT INTO social_connection_requests (requester_id, kid_user_id, status, decided_at, decided_by) VALUES
        ('{I['kid15']}', '{I['kid16']}', 'approved', now(), '{I['parent']}'), ('{I['kid16']}', '{I['kid15']}', 'approved', now(), '{I['parent']}');
        SET ROLE service_role;
        INSERT INTO follows (follower_id, followed_id) VALUES ('{I['kid15']}', '{I['kid16']}'), ('{I['kid16']}', '{I['kid15']}')""")
    run(f"UPDATE profile_safety_reviews SET display_name_flags = ARRAY['platform'] WHERE user_id = '{I['flag']}'")

    eligible = {'ana': 't', 'bea': 't', 'flag': 'f', 'adult': 'f', 'parent': 'f', 'kid15': 'f', 'kid10': 'f'}
    for name, want in eligible.items():
        assert service(f"SELECT coop_goal_eligible('{I[name]}')") == want, (name, want)
    assert service(f"SELECT coop_goal_mutual('{I['ana']}', '{I['bea']}')") == 't'
    assert service(f"SELECT coop_goal_mutual('{I['bea']}', '{I['dan']}')") == 'f'
    check('eligible: the teen tier only until a guardian opts in; an adult, a parent, a child under 13, a child without the opt-in and a flagged teen are not; mutual means consented follows both ways')

    rejected(f"SET ROLE service_role; SELECT set_coop_goal_guardian_consent('{I['parent']}', '{I['kid10']}', true)", 'COOP_CHILD_NOT_TEEN')
    rejected(f"SET ROLE service_role; SELECT set_coop_goal_guardian_consent('{I['adult']}', '{I['kid15']}', true)", 'COOP_GUARDIAN_NOT_LINKED')
    for kid in ('kid15', 'kid16'):
        assert service(f"SELECT set_coop_goal_guardian_consent('{I['parent']}', '{I[kid]}', true)") == 't'
    assert service(f"SELECT set_coop_goal_guardian_consent('{I['parent']}', '{I['kid15']}', true)") == 't'
    assert run("SELECT count(*) FROM audit_logs WHERE action = 'social.coop_guardian_enabled'") == '2'
    assert service(f"SELECT coop_goal_eligible('{I['kid15']}')") == 't'
    check('a verified guardian opts a 13-to-17 child in (audited once; a repeat writes nothing); a child under 13 and an unlinked adult are refused')

    goal = lambda creator, invitees, target=10, days=14: service(
        f"SELECT create_coop_goal('{I[creator]}', {target}, {days}, ARRAY[{', '.join(f'{chr(39)}{I[i]}{chr(39)}' for i in invitees)}]::uuid[])")
    for creator, invitees, code in (('adult', ['ana'], 'COOP_NOT_ELIGIBLE'), ('kid10', ['ana'], 'COOP_NOT_ELIGIBLE'),
                                    ('flag', ['ana'], 'COOP_NOT_ELIGIBLE'), ('ana', ['adult'], 'COOP_MEMBER_UNAVAILABLE'),
                                    ('ana', ['flag'], 'COOP_MEMBER_UNAVAILABLE'), ('bea', ['dan'], 'COOP_MEMBER_UNAVAILABLE'),
                                    ('ana', ['bea', 'dan'], 'COOP_MEMBER_UNAVAILABLE'), ('ana', ['ana'], 'COOP_INVALID'),
                                    ('ana', [], 'COOP_INVALID'), ('ana', ['bea', 'cai', 'dan', 'eva', 'kid15'], 'COOP_INVALID')):
        try:
            goal(creator, invitees)
        except RuntimeError as error:
            assert code in str(error), (creator, invitees, str(error))
        else:
            raise AssertionError((creator, invitees))
    rejected(f"SET ROLE service_role; SELECT create_coop_goal('{I['ana']}', 7, 14, ARRAY['{I['bea']}']::uuid[])", 'COOP_INVALID')
    rejected(f"SET ROLE service_role; SELECT create_coop_goal('{I['ana']}', 10, 30, ARRAY['{I['bea']}']::uuid[])", 'COOP_INVALID')
    assert run('SELECT count(*) FROM coop_goals') == '0'
    check('creation refuses adults, children under 13 and flagged teens as creator or invitee, invitees who are not mutually connected with everyone, and any target or window outside the presets')

    g = goal('ana', ['bea', 'cai'])
    assert run(f"SELECT status FROM coop_goal_members WHERE goal_id = '{g}' ORDER BY status") == 'active\ninvited\ninvited'
    rejected(f"SET ROLE service_role; SELECT invite_coop_goal_member('{I['ana']}', '{g}', '{I['dan']}')", 'COOP_MEMBER_UNAVAILABLE')
    rejected(f"SET ROLE service_role; SELECT invite_coop_goal_member('{I['bea']}', '{g}', '{I['eva']}')", 'COOP_GOAL_NOT_FOUND')
    assert service(f"SELECT decide_coop_goal_invitation('{I['bea']}', '{g}', true)") == 'accepted'
    assert service(f"SELECT decide_coop_goal_invitation('{I['cai']}', '{g}', false)") == 'declined'
    rejected(f"SET ROLE service_role; SELECT invite_coop_goal_member('{I['ana']}', '{g}', '{I['cai']}')", 'COOP_ALREADY_ASKED')
    assert service(f"SELECT invite_coop_goal_member('{I['bea']}', '{g}', '{I['eva']}')") == 't'
    rejected(f"SET ROLE service_role; SELECT decide_coop_goal_invitation('{I['dan']}', '{g}', true)", 'COOP_INVITATION_NOT_FOUND')
    check('an invitee decides; a no is final for that goal; only an active member invites, and only someone connected with every member')

    overview = json.loads(service(f"SELECT coop_goal_overview('{I['bea']}')"))
    assert overview['eligible'] is True and len(overview['goals']) == 1 and overview['goals'][0]['done'] == 0
    assert sorted(overview['goals'][0]['members']) == sorted([I['ana'], I['bea']])
    assert overview['goals'][0]['invited'] == [{'userId': I['eva'], 'mine': True}]
    assert 'rank' not in json.dumps(overview) and 'xp' not in json.dumps(overview).lower()
    stranger = json.loads(service(f"SELECT coop_goal_overview('{I['dan']}')"))
    assert stranger['goals'] == [] and stranger['invitations'] == []
    eva = json.loads(service(f"SELECT coop_goal_overview('{I['eva']}')"))
    assert [i['goalId'] for i in eva['invitations']] == [g]
    check('the overview gives members the group total only (no per-member numbers, no rank) and an invitee its invitation; a non-member sees nothing')

    assert service(f"SELECT decide_coop_goal_invitation('{I['eva']}', '{g}', true)") == 'accepted'
    rejected(f"SET ROLE service_role; SELECT end_coop_goal_membership('{I['bea']}', '{g}', '{I['eva']}')", 'COOP_NOT_ALLOWED')
    assert service(f"SELECT end_coop_goal_membership('{I['ana']}', '{g}', '{I['eva']}')") == 'removed'
    # An unfollow between two active members ends the later joiner's membership; the goal (one left) closes.
    run(f"DELETE FROM follows WHERE follower_id = '{I['ana']}' AND followed_id = '{I['bea']}'")
    assert run(f"SELECT end_reason FROM coop_goal_members WHERE goal_id = '{g}' AND user_id = '{I['bea']}'") == 'connection_ended'
    assert run(f"SELECT status || ':' || closed_reason FROM coop_goals WHERE id = '{g}'") == 'closed:too_small'
    check('the creator removes a member, a non-creator cannot; an unfollow ends the later joiner, and a goal down to one person closes')

    g2 = goal('kid15', ['kid16'], 5, 7)
    assert service(f"SELECT decide_coop_goal_invitation('{I['kid16']}', '{g2}', true)") == 'accepted'
    assert service(f"SELECT end_coop_goal_membership('{I['kid16']}', '{g2}', '{I['kid16']}')") == 'left'
    assert run(f"SELECT status FROM coop_goals WHERE id = '{g2}'") == 'closed'
    g3 = goal('kid15', ['kid16'], 5, 7)
    # GAP-FIX-R4 (E.2, Law 5): the verified Tutor sees the child's open goals and who is in them, never a number per person.
    seen = json.loads(service(f"SELECT coop_goal_guardian_goals('{I['parent']}', '{I['kid15']}')"))
    assert [(v['id'], v['childStatus'], v['startedByChild'], v['target']) for v in seen] == [(g3, 'active', True, 5)], seen
    assert seen[0]['people'] == [{'userId': I['kid16'], 'status': 'invited'}], seen
    assert 'done' not in json.dumps(seen) and 'progress' not in json.dumps(seen)
    asked = json.loads(service(f"SELECT coop_goal_guardian_goals('{I['parent']}', '{I['kid16']}')"))
    assert [(v['id'], v['childStatus'], v['startedByChild']) for v in asked] == [(g3, 'invited', False)]
    assert asked[0]['people'] == [{'userId': I['kid15'], 'status': 'active'}]
    assert service(f"SELECT decide_coop_goal_invitation('{I['kid16']}', '{g3}', true)") == 'accepted'
    seen = json.loads(service(f"SELECT coop_goal_guardian_goals('{I['parent']}', '{I['kid15']}')"))
    assert seen[0]['people'] == [{'userId': I['kid16'], 'status': 'active'}]
    assert json.loads(service(f"SELECT coop_goal_guardian_goals('{I['parent']}', '{I['kid10']}')")) == []
    rejected(f"SET ROLE service_role; SELECT coop_goal_guardian_goals('{I['adult']}', '{I['kid15']}')", 'COOP_GUARDIAN_NOT_LINKED')
    rejected(f"SET ROLE service_role; SELECT coop_goal_guardian_goals('{I['parent']}', '{I['ana']}')", 'COOP_GUARDIAN_NOT_LINKED')
    # A self-registered teen who linked a Tutor keeps its goals its own (OD-3 Option B).
    run(f"INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{I['parent']}', '{I['ana']}', 'verified', now())")
    assert service(f"SELECT social_tier('{I['ana']}')") == 'teen'
    rejected(f"SET ROLE service_role; SELECT coop_goal_guardian_goals('{I['parent']}', '{I['ana']}')", 'COOP_NOT_ALLOWED')
    run(f"DELETE FROM guardian_links WHERE parent_user_id = '{I['parent']}' AND kid_user_id = '{I['ana']}'")
    for role in ('anon', 'authenticated'):
        rejected(f"SET ROLE {role}; SELECT coop_goal_guardian_goals('{I['parent']}', '{I['kid15']}')", 'permission denied')
    check('the verified Tutor reads the child\'s open goals (target, window, who started it, the child\'s status and each other person as asked or joined, no progress); an unlinked adult and a self-registered teen\'s linked Tutor are refused; no browser role can call it')
    assert service(f"SELECT set_coop_goal_guardian_consent('{I['parent']}', '{I['kid15']}', false)") == 'f'
    assert run(f"SELECT end_reason FROM coop_goal_members WHERE goal_id = '{g3}' AND user_id = '{I['kid15']}'") == 'guardian_off'
    assert run(f"SELECT status FROM coop_goals WHERE id = '{g3}'") == 'closed'
    check('teenage siblings take part once their guardian opts in; anyone leaves at any time; turning the opt-in off ends the child\'s memberships at once')

    g4 = goal('ana', ['cai'])
    service(f"SELECT decide_coop_goal_invitation('{I['cai']}', '{g4}', true)")
    run(f"UPDATE coop_goals SET starts_at = now() - interval '20 days', ends_at = now() - interval '1 day' WHERE id = '{g4}'")
    sweep = json.loads(service('SELECT run_social_graph_retention(500)'))
    assert sweep['coopGoalsReconciled'] >= 1 and run(f"SELECT closed_reason FROM coop_goals WHERE id = '{g4}'") == 'ended'
    run("UPDATE coop_goals SET closed_at = now() - interval '31 days' WHERE status = 'closed'")
    sweep = json.loads(service('SELECT run_social_graph_retention(500)'))
    assert sweep['coopGoalsDeleted'] == 4 and run('SELECT count(*) FROM coop_goals') == '0' and run('SELECT count(*) FROM coop_goal_members') == '0'
    assert sweep['coopConsentsDeleted'] == 0
    run(f"UPDATE coop_goal_guardian_consents SET updated_at = now() - interval '31 days' WHERE kid_user_id = '{I['kid15']}'")
    assert json.loads(service('SELECT run_social_graph_retention(500)'))['coopConsentsDeleted'] == 1
    for action in ('social.coop_goal_created', 'social.coop_member_invited', 'social.coop_member_joined', 'social.coop_member_ended', 'social.coop_goal_closed', 'social.coop_guardian_disabled'):
        assert int(run(f"SELECT count(*) FROM audit_logs WHERE action = '{action}'")) > 0, action
    check('the retention sweep closes goals past their window and deletes closed goals (and their members) after 30 days and a turned-off opt-in after 30 days; every change left an audit row')

    for role in ('anon', 'authenticated'):
        for fn in (f"coop_goal_overview('{I['ana']}')", f"coop_goal_eligible('{I['ana']}')",
                   f"create_coop_goal('{I['ana']}', 10, 14, ARRAY['{I['bea']}']::uuid[])", f"coop_goal_candidates('{I['ana']}')"):
            rejected(f"SET ROLE {role}; SELECT {fn}", 'permission denied')
        for table in ('coop_goals', 'coop_goal_members', 'coop_goal_guardian_consents'):
            rejected(f"SET ROLE {role}; SELECT * FROM {table}", 'permission denied')
    rejected(f"SET ROLE service_role; INSERT INTO coop_goals (ends_at) VALUES (now() + interval '1 day')", 'permission denied')
    rejected(f"SET ROLE service_role; SELECT coop_goal_end_member(gen_random_uuid(), '{I['ana']}', 'left', NULL)", 'permission denied')
    surfaces = json.loads(service('SELECT social_messaging_surfaces()'))
    assert not [name for name in surfaces if 'coop' in name], surfaces
    check('no browser role can read the tables or call the functions; the service role writes only through the functions; the E.10 scan finds no free text in the new tables')

    # ── OD-9 4.2: goals together are a registered data practice ─────────────
    practice = "'sharing.cooperative_goals'"
    assert run(f"SELECT kind || '/' || teen_self_consent FROM data_practices WHERE key = {practice}") == 'sharing_surface/false'
    assert service(f"SELECT coop_goal_eligible('{I['dan']}')") == 't'
    run(f"INSERT INTO legacy_consent_subjects (user_id, age_class) VALUES ('{I['dan']}', 'teen'), ('{I['kid16']}', 'teen')")
    assert service(f"SELECT coop_goal_eligible('{I['dan']}')") == 'f'
    assert service(f"SELECT data_practice_applies('{I['dan']}', {practice})") == 'f'
    rejected(f"SET ROLE service_role; SELECT create_coop_goal('{I['dan']}', 10, 7, ARRAY['{I['ana']}']::uuid[])", 'DATA_PRACTICE_CONSENT_REQUIRED')
    assert I['dan'] not in service(f"SELECT coop_goal_candidates('{I['ana']}')")
    rejected(f"SET ROLE service_role; SELECT create_coop_goal('{I['ana']}', 10, 7, ARRAY['{I['dan']}']::uuid[])", 'COOP_MEMBER_UNAVAILABLE')
    assert json.loads(service(f"SELECT coop_goal_overview('{I['dan']}')"))['eligible'] is False
    # A self-registered migrated teen cannot answer it alone (a Tutor-only practice).
    rejected(f"SET ROLE service_role; SELECT data_practice_set_consent('{I['dan']}', '{I['dan']}', {practice}, true, 1)", 'DATA_PRACTICE_NOT_ALLOWED')
    state = json.loads(service(f"SELECT data_practice_state('{I['dan']}')"))
    assert [p for p in state['practices'] if p['key'] == 'sharing.cooperative_goals'][0]['applies'] is False
    # The verified Tutor's opt-in is recorded as the practice consent; the opt-out revokes it.
    service(f"SELECT set_coop_goal_guardian_consent('{I['parent']}', '{I['kid16']}', true)")
    assert run(f"SELECT grantor_kind || '/' || (granted_by = '{I['parent']}') FROM data_practice_consents WHERE subject_user_id = '{I['kid16']}' AND practice_key = {practice} AND revoked_at IS NULL") == 'tutor/true'
    assert service(f"SELECT data_practice_applies('{I['kid16']}', {practice})") == 't'
    assert service(f"SELECT coop_goal_eligible('{I['kid16']}')") == 't'
    service(f"SELECT set_coop_goal_guardian_consent('{I['parent']}', '{I['kid16']}', false)")
    assert run(f"SELECT count(*) FROM data_practice_consents WHERE subject_user_id = '{I['kid16']}' AND practice_key = {practice} AND revoked_at IS NULL") == '0'
    assert service(f"SELECT coop_goal_eligible('{I['kid16']}')") == 'f'
    assert int(run(f"SELECT count(*) FROM audit_logs WHERE subject = '{I['kid16']}' AND action IN ('data_practice.granted', 'data_practice.revoked') AND detail ->> 'practice' = 'sharing.cooperative_goals'")) == 2
    run(f"DELETE FROM legacy_consent_subjects WHERE user_id IN ('{I['dan']}', '{I['kid16']}')")
    assert service(f"SELECT coop_goal_eligible('{I['dan']}')") == 't'
    check('OD-9 4.2: sharing.cooperative_goals is a registered Tutor-only sharing practice; for a migrated child without it, eligibility, candidates and the overview close, creating is refused by name (DATA_PRACTICE_CONSENT_REQUIRED) and inviting them is simply unavailable; the teen cannot consent alone; the verified Tutor opt-in is recorded (and audited) as the practice consent and the opt-out revokes it; an account the OD-9 step did not mark is unaffected')

    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps({'database': database, 'checks': checks}, indent=2), encoding='utf-8')
    print(f'{len(checks)} checks passed')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
