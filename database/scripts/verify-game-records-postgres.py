"""Games in /learn (KartRush first): the game_records tables and functions against
real PostgreSQL, over the whole migration chain.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, a minimal Supabase shim with the real default
privileges (so a missing REVOKE would show), EVERY migration applied in order,
then at the enforcing boundary:

  - the registry: the game is live, both data practices are registered in the
    shape Core's registry read accepts, and a migrated child needs a fresh
    Tutor consent for them;
  - the daily cap is atomic: five concurrent session starts at a cap of two
    leave exactly two rows, and starting one closes the earlier open session;
  - heartbeat time is credited only when asked and never more than the cap,
    and a closed session is not credited;
  - a run is recorded once per (user, game, run key) with its best, even when
    the request is repeated after the session closed; a closed, expired or
    foreign session records nothing; the metrics column accepts numbers only;
  - the save is compare-and-set and capped at 64 KB;
  - the AI debrief's daily cap is atomic and a run claims at most one line;
  - a guardian reads and lowers a linked child's limits, a stranger cannot,
    and the platform ceiling is the column CHECK; the change is audited;
  - no API role holds a table privilege or can call a function; the SELECT
    policies show the owner and a verified guardian their rows and nobody else;
  - deleting the account removes every row (cascade); the guardian who set a
    limit may leave without deleting it;
  - the retention sweep trims only what is past its window;
  - replaying the two expand files leaves every function, policy and grant as
    the chain defines them.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP. Run by
database/scripts/learning-db-verify.mjs.
"""

import json
import os
import subprocess
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from lf_pg_replay import assert_unchanged, fingerprint

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
    created_at timestamptz DEFAULT now(), is_anonymous boolean DEFAULT false, banned_until timestamptz);
CREATE TABLE auth.audit_log_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payload json, created_at timestamptz DEFAULT now());
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE auth.refresh_tokens (id bigserial PRIMARY KEY, token text, user_id varchar(255),
    revoked boolean DEFAULT false, session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
"""

database = 'lf_game_records_' + uuid.uuid4().hex[:12]
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


def start(user, cap, ref=None, minutes=25, expires="now() + interval '2 hours'", mentor='rho'):
    ref = ref or uuid.uuid4().hex
    return service(
        f"SELECT id FROM start_game_session_checked('{user}', 'kartrush', now() - interval '1 day', {cap}, '{ref}', "
        f"'{mentor}', 'en-US', '6-9', 'b1', {minutes}, {expires})")


def finish(session, reason='soft'):
    """The learner ends a session on purpose, as the SPA does at a break card or a hard stop."""
    run(f"UPDATE game_sessions SET ended_at = now(), close_reason = '{reason}' WHERE id = '{session}' AND ended_at IS NULL")


def run_args(session, user, key, finish=90000, laps=(30000, 30000, 30000), lens='neutral', metrics="'{}'::jsonb", track='jungleNeck'):
    lap_sql = ','.join(str(x) for x in laps)
    return (f"SELECT record_game_run('{session}', '{user}', 'kartrush', '{key}', 'single', '{track}', 'rho', 'fossilRunner', '150cc', "
            f"{finish}, {min(laps)}, ARRAY[{lap_sql}], 3, '{lens}', {metrics})")


try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    parts = [m for m in migrations if m.name.endswith('_game_records.sql') or m.name.endswith('_game_records_functions.sql')]
    # The retention sweep is a contract file applied by hand (held out of the auto-apply push), so
    # its checks run only when the file is present in the chain.
    HAS_RETENTION = any(m.name.endswith('_game_records_retention.sql') for m in migrations)
    assert len(parts) == 2, parts
    for migration in migrations:
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    K, OTHER, G, STRANGER, ADULT, G2, MIGRATED, CAPPED, REOPEN, REOPEN2 = (str(uuid.uuid4()) for _ in range(10))
    run(f"""
    INSERT INTO auth.users (id, email) VALUES ('{K}', 'k@kids.invalid'), ('{OTHER}', 'o@kids.invalid'), ('{G}', 'g@example.com'),
        ('{STRANGER}', 's@example.com'), ('{ADULT}', 'a@example.com'), ('{G2}', 'g2@example.com'), ('{MIGRATED}', 'm@kids.invalid'),
        ('{CAPPED}', 'c@kids.invalid'), ('{REOPEN}', 'r@kids.invalid'), ('{REOPEN2}', 'r2@kids.invalid');
    INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{G}', 'parent', NULL), ('{G2}', 'parent', NULL);
    INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
        ('{G}', '{K}', 'verified', now()), ('{G2}', '{K}', 'pending', NULL);
    """)

    # ── 1. Registry ─────────────────────────────────────────────────────────
    assert run("SELECT status FROM game_catalog WHERE game_id = 'kartrush'") == 'live'
    rows = run("SELECT key, kind, requirement, teen_self_consent, consent_source FROM data_practices WHERE key IN ('game_play_records', 'game_ai_debrief') ORDER BY key")
    assert rows == 'game_ai_debrief|learner_record|G8/OD-9|f|data_practice_consents\ngame_play_records|learner_record|G6/OD-9|f|data_practice_consents', rows
    assert run("SELECT max(char_length(requirement)) <= 16 FROM data_practices") == 't'
    check('kartrush is live; game_play_records and game_ai_debrief are registered as learner records no teen can consent to alone, within the label length Core reads')

    # ── 2. Atomic daily cap ─────────────────────────────────────────────────
    # A session the learner finished on purpose is not reopened, so each start below is a new one.
    first = start(K, 2)
    finish(first)
    second = start(K, 2)
    assert first and second and first != second
    assert run(f"SELECT close_reason FROM game_sessions WHERE id = '{first}'") == 'soft'
    assert run(f"SELECT ended_at IS NULL FROM game_sessions WHERE id = '{second}'") == 't'
    c1 = start(CAPPED, 2)
    finish(c1)
    c2 = start(CAPPED, 2)
    finish(c2)
    assert c1 and c2 and c1 != c2
    assert start(CAPPED, 2) == '', 'the third session of the day must be refused'
    assert run(f"SELECT count(*) FROM game_sessions WHERE user_id = '{CAPPED}'") == '2'
    check('a third session in the learner-local day is refused once the first two were finished on purpose')

    with ThreadPoolExecutor(max_workers=5) as pool:
        refused = list(pool.map(lambda _: start(CAPPED, 2), range(5)))
    assert refused == [''] * 5, refused
    with ThreadPoolExecutor(max_workers=5) as pool:
        created = list(pool.map(lambda _: start(OTHER, 2), range(5)))
    assert len({c for c in created}) == 1 and all(created), created
    assert run(f"SELECT count(*) FROM game_sessions WHERE user_id = '{OTHER}'") == '1'
    check('five concurrent starts at a full cap are all refused, and five concurrent starts for a new learner leave exactly one session (a double tap is one session)')
    assert start(ADULT, 2, minutes=10)
    assert run(f"SELECT max_minutes FROM game_sessions WHERE user_id = '{ADULT}'") == '10'
    assert start(MIGRATED, 0) == '', 'a guardian cap of zero admits nobody'
    check('the guardian-lowered minute limit is stored with the session, and a cap of zero admits no session')

    # ── 2b. A refresh or a quick trip away does not use a slot ──────────────
    def row(session, columns):
        return run(f"SELECT {columns} FROM game_sessions WHERE id = '{session}'")

    r1 = start(REOPEN, 2, ref='ref-before-1', mentor='rho')
    run(f"UPDATE game_sessions SET active_seconds = 120 WHERE id = '{r1}'")
    r1b = start(REOPEN, 2, ref='ref-after-02', mentor='zara')
    assert r1b == r1, 'a refresh must return the same session'
    assert run(f"SELECT count(*) FROM game_sessions WHERE user_id = '{REOPEN}'") == '1'
    assert row(r1, "session_ref || '|' || mentor || '|' || active_seconds") == 'ref-after-02|zara|120'
    left = int(row(r1, 'round(extract(epoch FROM expires_at - now()))::int'))
    assert 25 * 60 - 120 + 50 <= left <= 25 * 60 - 120 + 61, left
    check('a refresh reopens the same session: no new row, the new ref and Mentor, active time kept, life = the remaining budget + 60 s')

    finish(r1, 'left')
    assert row(r1, 'ended_at IS NOT NULL') == 't'
    assert start(REOPEN, 2) == r1
    assert row(r1, "ended_at IS NULL AND close_reason IS NULL") == 't'
    check('a session closed as left a moment ago comes back open, with its close reason cleared')

    run(f"UPDATE game_sessions SET last_heartbeat_at = now() - interval '11 minutes' WHERE id = '{r1}'")
    r2 = start(REOPEN, 2)
    assert r2 and r2 != r1 and row(r1, 'close_reason') == 'left'
    assert start(REOPEN, 2) == r2, 'at the cap the latest session still reopens'
    assert run(f"SELECT count(*) FROM game_sessions WHERE user_id = '{REOPEN}'") == '2'
    finish(r2)
    assert start(REOPEN, 2) == ''
    check('at the daily cap a refresh still reopens the latest session (no slot used); once it was finished on purpose a new session is refused')

    previous = start(REOPEN2, 9)
    for reason in ('soft', 'hard', 'idle'):
        finish(previous, reason)
        fresh = start(REOPEN2, 9)
        assert fresh and fresh != previous and row(previous, 'close_reason') == reason, reason
        previous = fresh
    check('a session closed as soft, hard or idle is never reopened (the next start is a new session)')

    for label, change in (('a heartbeat past 10 minutes', "last_heartbeat_at = now() - interval '10 minutes 5 seconds'"),
                          ('no active time left', 'active_seconds = max_minutes * 60'),
                          ('an expiry long past', "expires_at = now() - interval '11 minutes'")):
        stale = start(REOPEN2, 99)
        run(f"UPDATE game_sessions SET {change} WHERE id = '{stale}'")
        fresh = start(REOPEN2, 99)
        assert fresh and fresh != stale and row(stale, 'close_reason') == 'left', label
    lowered = start(REOPEN2, 99)
    run(f"UPDATE game_sessions SET active_seconds = 400 WHERE id = '{lowered}'")
    assert start(REOPEN2, 99, minutes=6) != lowered, 'a guardian-lowered limit that the session already used up'
    keep = start(REOPEN2, 99, minutes=10)
    assert row(keep, 'max_minutes') == '6', 'a lowered limit is never raised back on a reopen'
    check('a stale heartbeat, an exhausted budget, a long-expired session and a lowered limit already used up each start a new session and close the stale one as left; a lowered limit carries over')

    # ── 3. Heartbeat time ───────────────────────────────────────────────────
    S = second
    run(f"UPDATE game_sessions SET last_heartbeat_at = now() - interval '40 seconds' WHERE id = '{S}'")
    beat = json.loads(service(f"SELECT credit_game_session('{S}', '{K}', true, 90)"))
    assert 39 <= beat['active_seconds'] <= 42, beat
    run(f"UPDATE game_sessions SET last_heartbeat_at = now() - interval '40 seconds' WHERE id = '{S}'")
    hidden = json.loads(service(f"SELECT credit_game_session('{S}', '{K}', false, 90)"))
    assert hidden['active_seconds'] == beat['active_seconds'], hidden
    run(f"UPDATE game_sessions SET last_heartbeat_at = now() - interval '600 seconds' WHERE id = '{S}'")
    capped = json.loads(service(f"SELECT credit_game_session('{S}', '{K}', true, 90)"))
    assert capped['active_seconds'] - beat['active_seconds'] == 90, capped
    run(f"UPDATE game_sessions SET last_active_at = now() - interval '11 minutes' WHERE id = '{S}'")
    gap = json.loads(service(f"SELECT credit_game_session('{S}', '{K}', true, 90)"))
    assert gap['prev_active_at'] < gap['now'], gap
    rejected(f"SET ROLE service_role; SELECT credit_game_session('{S}', '{OTHER}', true, 90)", 'GAME_SESSION_NOT_FOUND')
    check('a heartbeat credits elapsed seconds only when visible and focused, never more than the cap, reports the previous activity stamp, and refuses a session that is not the caller\'s')

    # ── 4. Runs ─────────────────────────────────────────────────────────────
    r1 = json.loads(service(run_args(S, K, 'run-000001', finish=95000, laps=(31000, 32000, 32000))))
    assert r1['duplicate'] is False and r1['new_best'] is True, r1
    again = json.loads(service(run_args(S, K, 'run-000001', finish=1000, laps=(30000,))))
    assert again['duplicate'] is True and again['run_id'] == r1['run_id'] and again['new_best'] is True, again
    assert run(f"SELECT count(*) FROM game_runs WHERE user_id = '{K}'") == '1'
    assert run(f"SELECT finish_ms FROM game_runs WHERE id = '{r1['run_id']}'") == '95000'
    faster = json.loads(service(run_args(S, K, 'run-000002', finish=90000)))
    slower = json.loads(service(run_args(S, K, 'run-000003', finish=99000)))
    assert faster['new_best'] is True and slower['new_best'] is False, (faster, slower)
    other_track = json.loads(service(run_args(S, K, 'run-000004', finish=99000, track='glacier')))
    assert other_track['new_best'] is True
    best = run(f"SELECT best_finish_ms || '|' || best_lap_ms || '|' || runs FROM game_progress WHERE user_id = '{K}' AND track_id = 'jungleNeck'")
    assert best == '90000|30000|3', best
    assert run(f"SELECT count(*) FROM game_progress WHERE user_id = '{K}'") == '2'
    check('a run is stored once per run key (a repeat returns the stored run), bests are kept per track and only ever improve, and a slower run still counts')

    rejected(f"""INSERT INTO game_runs (session_id, user_id, game_id, run_key, mode, track_id, character, kart_body, speed_class,
        finish_ms, best_lap_ms, lap_ms, rank, lens) VALUES ('{S}', '{K}', 'kartrush', 'run-000001', 'single', 'jungleNeck', 'rho',
        'fossilRunner', '150cc', 90000, 30000, ARRAY[30000], 3, 'neutral')""", 'game_runs_run_key_once')
    check('the unique key (user, game, run key) holds against a direct insert')

    for label, metrics in (('text value', """'{"itemHoldMs": "12"}'::jsonb"""), ('nested object', """'{"a": {"b": 1}}'::jsonb"""),
                           ('array', "'[1,2]'::jsonb"), ('bad key', """'{"item hold": 1}'::jsonb"""), ('null value', """'{"a": null}'::jsonb"""),
                           ('huge number', """'{"a": 1e15}'::jsonb""")):
        rejected(f"SET ROLE service_role; {run_args(S, K, 'run-bad-' + label.replace(' ', '-'), metrics=metrics)}", 'game_runs_metrics_check')
    good = json.loads(service(run_args(S, K, 'run-000005', metrics="""'{"itemHoldMs": 4100, "driftT3": 2, "ratio": 0.5}'::jsonb""")))
    assert good['duplicate'] is False
    assert run("SELECT game_metrics_valid('{}'::jsonb), game_metrics_valid(NULL::jsonb)") == 't|f'
    check('the metrics column accepts a bounded object of numbers and rejects text, nesting, arrays, odd keys, nulls and absurd magnitudes')

    rejected(f"SET ROLE service_role; {run_args(S, OTHER, 'run-foreign1')}", 'GAME_SESSION_NOT_FOUND')
    service(f"SELECT end_game_session('{S}', '{K}', 'hard')")
    service(f"SELECT end_game_session('{S}', '{K}', 'left')")
    assert run(f"SELECT close_reason FROM game_sessions WHERE id = '{S}'") == 'hard'
    rejected(f"SET ROLE service_role; {run_args(S, K, 'run-closed01')}", 'GAME_SESSION_CLOSED')
    dup_closed = json.loads(service(run_args(S, K, 'run-000001')))
    assert dup_closed['duplicate'] is True and dup_closed['run_id'] == r1['run_id']
    expired = start(STRANGER, 2, expires="now() - interval '1 minute'")
    assert expired
    rejected(f"SET ROLE service_role; {run_args(expired, STRANGER, 'run-expired1')}", 'GAME_SESSION_EXPIRED')
    rejected(f"SET ROLE service_role; SELECT end_game_session('{S}', '{K}', 'bored')", 'GAME_INVALID')
    closed_credit = json.loads(service(f"SELECT credit_game_session('{S}', '{K}', true, 90)"))
    assert closed_credit['ended_at'] is not None and closed_credit['close_reason'] == 'hard'
    check('closing is idempotent (first reason wins); a closed, expired or foreign session records nothing, yet a repeated run key still answers with the stored run')

    # ── 5. Save: compare-and-set ────────────────────────────────────────────
    assert json.loads(service(f"SELECT save_game_snapshot('{K}', 'kartrush', 0, '{{\"hints\": [1]}}'::jsonb)")) == {'ok': True, 'revision': 1}
    assert json.loads(service(f"SELECT save_game_snapshot('{K}', 'kartrush', 0, '{{\"hints\": [2]}}'::jsonb)")) == {'ok': False, 'revision': 1}
    assert json.loads(service(f"SELECT save_game_snapshot('{K}', 'kartrush', 1, '{{\"hints\": [3]}}'::jsonb)")) == {'ok': True, 'revision': 2}
    assert json.loads(service(f"SELECT save_game_snapshot('{OTHER}', 'kartrush', 5, '{{}}'::jsonb)")) == {'ok': False, 'revision': 0}
    assert run(f"SELECT save->'hints'->>0 FROM game_saves WHERE user_id = '{K}'") == '3'
    big = "x" * 70000
    rejected(f"SET ROLE service_role; SELECT save_game_snapshot('{K}', 'kartrush', 2, jsonb_build_object('a', '{big}'))", 'GAME_INVALID')
    rejected(f"SET ROLE service_role; SELECT save_game_snapshot('{K}', 'kartrush', 2, '[1]'::jsonb)", 'GAME_INVALID')
    rejected(f"INSERT INTO game_saves (user_id, game_id, save) VALUES ('{OTHER}', 'kartrush', jsonb_build_object('a', '{big}'))", 'game_saves_save_check')
    with ThreadPoolExecutor(max_workers=4) as pool:
        raced = list(pool.map(lambda _: json.loads(service(f"SELECT save_game_snapshot('{K}', 'kartrush', 2, '{{\"n\": 1}}'::jsonb)")), range(4)))
    assert sum(1 for r in raced if r['ok']) == 1, raced
    assert run(f"SELECT revision FROM game_saves WHERE user_id = '{K}'") == '3'
    check('the save is compare-and-set: a stale revision is refused with the current one, four concurrent writers at one revision yield one winner, and 64 KB is the cap')

    # ── 6. AI debrief cap ───────────────────────────────────────────────────
    open_session = start(G, 2)
    ids = [json.loads(service(run_args(open_session, G, f'run-ai-{i:04d}')))['run_id'] for i in range(3)]
    assert service(f"SELECT claim_game_ai_line('{G}', '{ids[0]}', now() - interval '1 day', 2)") == 't'
    assert service(f"SELECT claim_game_ai_line('{G}', '{ids[0]}', now() - interval '1 day', 2)") == 'f'
    assert service(f"SELECT claim_game_ai_line('{G}', '{ids[1]}', now() - interval '1 day', 2)") == 't'
    assert service(f"SELECT claim_game_ai_line('{G}', '{ids[2]}', now() - interval '1 day', 2)") == 'f'
    assert service(f"SELECT claim_game_ai_line('{OTHER}', '{ids[2]}', now() - interval '1 day', 9)") == 'f'
    assert run(f"SELECT count(*) FROM game_runs WHERE user_id = '{G}' AND ai_line_at IS NOT NULL") == '2'
    check('the AI debrief line is claimed once per run and capped per learner per day; another learner cannot claim a run that is not theirs')

    # ── 7. Guardian limits ──────────────────────────────────────────────────
    assert json.loads(service(f"SELECT game_play_limits_read('{G}', '{K}')")) == {'maxSessionsPerDay': 2, 'maxSessionMinutes': 25}
    assert json.loads(service(f"SELECT game_play_limits_write('{G}', '{K}', 1, 10)")) == {'maxSessionsPerDay': 1, 'maxSessionMinutes': 10}
    assert json.loads(service(f"SELECT game_play_limits_read('{G}', '{K}')")) == {'maxSessionsPerDay': 1, 'maxSessionMinutes': 10}
    for who in (STRANGER, G2):
        rejected(f"SET ROLE service_role; SELECT game_play_limits_read('{who}', '{K}')", 'GAME_GUARDIAN_NOT_LINKED')
        rejected(f"SET ROLE service_role; SELECT game_play_limits_write('{who}', '{K}', 0, 5)", 'GAME_GUARDIAN_NOT_LINKED')
    for sessions, minutes in ((3, 10), (-1, 10), (1, 4), (1, 26)):
        rejected(f"SET ROLE service_role; SELECT game_play_limits_write('{G}', '{K}', {sessions}, {minutes})", 'GAME_INVALID')
    rejected(f"UPDATE learner_play_limits SET max_session_minutes = 40 WHERE user_id = '{K}'", 'learner_play_limits_max_session_minutes_check')
    assert run(f"SELECT count(*) FROM audit_logs WHERE action = 'games.play_limits_set' AND actor_id = '{G}' AND subject = '{K}'") == '1'
    check('a verified guardian reads and lowers a child\'s limits; a stranger and a pending link are refused; the ceiling (2 sessions, 25 minutes) is a CHECK; the change is audited')

    # ── 8. No API role; policies ────────────────────────────────────────────
    for table in ('game_catalog', 'game_sessions', 'game_runs', 'game_progress', 'game_saves', 'learner_play_limits'):
        for role in ('anon', 'authenticated'):
            rejected(f'SET ROLE {role}; SELECT count(*) FROM {table}', 'permission denied')
            rejected(f'SET ROLE {role}; DELETE FROM {table}', 'permission denied')
        assert run(f"SELECT relrowsecurity FROM pg_class WHERE oid = 'public.{table}'::regclass") == 't', table
    fns = run("SELECT string_agg(p.oid::regprocedure::text, ';') FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace "
              "AND p.proname IN ('start_game_session_checked','credit_game_session','end_game_session','record_game_run','save_game_snapshot',"
              "'claim_game_ai_line','game_play_limits_read','game_play_limits_write','sweep_game_records')").split(';')
    assert len(fns) == (9 if HAS_RETENTION else 8), fns
    for fn in fns:
        for role in ('anon', 'authenticated'):
            assert run(f"SELECT has_function_privilege('{role}', '{fn}', 'EXECUTE')") == 'f', (role, fn)
        assert run(f"SELECT has_function_privilege('service_role', '{fn}', 'EXECUTE')") == 't', fn
    check('anon and authenticated hold no privilege on any table or function of the feature (the default Supabase grants are revoked); RLS is on everywhere')

    # The service role (Core) reads, records the self-report and the AI cost on a run, each value CHECKed.
    rid = run("SELECT id FROM game_runs WHERE run_key = 'run-000002'")
    service(f"UPDATE game_runs SET reflection = 'b', ai_cost_usd = 0.0002 WHERE id = '{rid}'")
    assert run(f"SELECT reflection || '|' || ai_cost_usd FROM game_runs WHERE id = '{rid}'") == 'b|0.000200'
    rejected(f"SET ROLE service_role; UPDATE game_runs SET reflection = 'great' WHERE id = '{rid}'", 'game_runs_reflection_check')
    rejected(f"SET ROLE service_role; UPDATE game_runs SET ai_cost_usd = -1 WHERE id = '{rid}'", 'game_runs_ai_cost_usd_check')
    for table in ('game_sessions', 'game_runs', 'game_progress', 'game_saves', 'learner_play_limits'):
        assert run(f"SELECT has_table_privilege('service_role', 'public.{table}', 'SELECT')") == 't', table
    check('the service role can read every table and record the self-report and the AI cost on a run, each value CHECKed')

    def visible(viewer, table='game_runs', column='user_id', subject=K):
        return run(f"""BEGIN; GRANT SELECT ON {table} TO authenticated; SET LOCAL ROLE authenticated;
            SET LOCAL request.jwt.claim.sub = '{viewer}'; SELECT count(*) FROM {table} WHERE {column} = '{subject}'; ROLLBACK;""").splitlines()[-1]
    assert visible(K) == '5' and visible(G) == '5', (visible(K), visible(G))
    assert visible(OTHER) == '0' and visible(STRANGER) == '0' and visible(G2) == '0'
    for table in ('game_sessions', 'game_progress', 'game_saves', 'learner_play_limits'):
        assert int(visible(K, table)) >= 1 and visible(OTHER, table) == '0' and visible(STRANGER, table) == '0', table
    check('with a SELECT grant added, the policies show a learner and a verified guardian the rows, and another learner, a stranger and a pending guardian none')

    # ── 9. Replay leaves the chain unchanged ───────────────────────────────
    before = fingerprint(sql, database)
    for part in parts:
        run(part.read_text(encoding='utf-8'))
    assert_unchanged(before, fingerprint(sql, database))
    assert run("SELECT count(*) FROM game_catalog") == '1' and run("SELECT count(*) FROM data_practices WHERE key LIKE 'game\\_%'") == '2'
    check('replaying the expand files is idempotent and leaves every function, policy and grant as the chain defines them')

    # ── 10. Retention sweep (contract file, applied by hand) ───────────────
    if HAS_RETENTION:
        run(f"""
        UPDATE game_sessions SET started_at = now() - interval '401 days' WHERE id = '{first}';
        UPDATE game_runs SET created_at = now() - interval '401 days' WHERE run_key = 'run-000003';
        UPDATE game_progress SET last_played_at = now() - interval '25 months' WHERE user_id = '{K}' AND track_id = 'glacier';
        UPDATE game_saves SET updated_at = now() - interval '25 months' WHERE user_id = '{K}';
        """)
        swept = json.loads(service('SELECT sweep_game_records()'))
        assert swept == {'runs': 1, 'sessions': 1, 'progress': 1, 'saves': 1}, swept
        assert run(f"SELECT count(*) FROM game_runs WHERE user_id = '{K}'") == '4'
        assert json.loads(service('SELECT sweep_game_records()')) == {'runs': 0, 'sessions': 0, 'progress': 0, 'saves': 0}
        rejected('SET ROLE authenticated; SELECT sweep_game_records()', 'permission denied')
        check('the sweep removes only runs and sessions past 400 days and saves and bests past 24 months, once, and only for the service role')

    # ── 11. Erasure ─────────────────────────────────────────────────────────
    run(f"DELETE FROM auth.users WHERE id = '{G}'")
    assert run(f"SELECT set_by IS NULL FROM learner_play_limits WHERE user_id = '{K}'") == 't'
    check('a guardian who leaves keeps the child\'s limit in place (set_by is cleared, the row stays)')
    for user in (K, OTHER, ADULT, STRANGER, CAPPED, REOPEN, REOPEN2):
        run(f"DELETE FROM auth.users WHERE id = '{user}'")
    left = run("SELECT (SELECT count(*) FROM game_sessions) + (SELECT count(*) FROM game_runs) + (SELECT count(*) FROM game_progress) "
               "+ (SELECT count(*) FROM game_saves) + (SELECT count(*) FROM learner_play_limits)")
    assert left == '0', left
    check('deleting the accounts removes every session, run, best, save and limit (cascade)')

    print(json.dumps({'database': database, 'checks': checks}, indent=2))
    print(f'game-records PostgreSQL verification OK — {len(checks)} checks')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
