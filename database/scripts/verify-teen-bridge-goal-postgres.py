"""L-12 (owner decision OD-28): an independent teen's "I will try" creates their
own savings goal, enforced by PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): creates a throwaway database, installs a minimal Supabase shim (the
anon/authenticated/service_role roles and an auth schema with users and
uid()/role()), applies EVERY migration in database/migrations in order, seeds
one account per population, and proves at the enforcing boundary
(act_on_learning_bridge_prompt and the learning_bridge_prompts table):

  - before *_teen_bridge_own_goal.sql (a second database stopping at the
    migration before it), a self prompt refuses any goal detail and the table
    refuses a goal on a self prompt: the L-12 gap is reproduced first;
  - an independent teen with a personal wallet acts on a self savings-goal
    prompt with goal details: exactly one goal, owned by the teen, linked by
    result_goal_id, in the same transaction; a replay (even with different
    details) returns the same goal; two concurrent acts create one goal;
  - all-null details still record a commitment only (the pre-L-12 contract an
    older Core relies on); invalid details are refused and change nothing;
  - an earning-task self prompt never creates a task, with or without details;
  - a learner without a personal wallet today (a declared teen whose birth
    date now says 18, an adult) keeps the commitment, gets
    goal_refused = WALLET_HOLDER_REQUIRED, and no goal or wallet row appears;
  - nobody else can act on a self prompt, and no prompt can point at another
    account's goal (the new owner guard, for the service role too); the CHECK
    still refuses a goal on a task prompt and a task on a self prompt;
  - guardian prompts are unchanged: a verified guardian creates the goal or
    task for a parent-created child and for a self-registered teen who linked
    them; a stranger parent is forbidden;
  - no browser role can execute the function or write the table, and the
    trigger function is executable by nobody directly.

Configuration (defaults match the repo's owned audit cluster):
  LF_PG_PSQL   path to psql      (default <repo>/.codex/audit-db/pgsql/bin/psql.exe)
  LF_PG_PORT   port              (default 15483)
  LF_PG_USER   superuser name    (default audit_owner)
  LF_PG_KEEP   set to 1 to keep the throwaway databases for inspection
  LF_PG_REPORT optional path for a JSON report of the passed checks
"""
from concurrent.futures import ThreadPoolExecutor
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
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
TARGET = next(m for m in MIGRATIONS if m.name.endswith('_teen_bridge_own_goal.sql'))
BEFORE = MIGRATIONS[MIGRATIONS.index(TARGET) - 1]


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

checks = []
databases = []


def check(name):
    checks.append(name)
    print('ok -', name)


def fresh(upto):
    database = 'lf_teen_bridge_' + uuid.uuid4().hex[:12]
    sql(f'CREATE DATABASE {database}')
    databases.append(database)
    sql(SHIM, database)
    for migration in MIGRATIONS:
        if migration.name > upto.name:
            break
        try:
            sql(migration.read_text(encoding='utf-8'), database)
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    return database


class Db:
    def __init__(self, name):
        self.name = name
        self.kc_n = 0

    def run(self, query):
        return sql(query, self.name)

    def service(self, query):
        return self.run('SET ROLE service_role;' + query)

    def as_user(self, role, user_id, query):
        return self.run(f"SET ROLE {role}; SELECT set_config('request.jwt.claim.sub', '{user_id or ''}', false); {query}")

    def rejected(self, query, message):
        try:
            self.run(query)
        except RuntimeError as error:
            assert message in str(error), str(error)
        else:
            raise AssertionError(f'expected {message!r}, the statement succeeded')

    def seed(self):
        """One account per population, a one-lesson course and a verified parent."""
        names = ('teen', 'teen_b', 'aged', 'adult', 'kid', 'linked', 'parent', 'stranger')
        self.u = {name: str(uuid.uuid4()) for name in names}
        u = self.u
        self.course, self.adventure, self.saga, self.topic, self.lesson = (str(uuid.uuid4()) for _ in range(5))
        self.run('INSERT INTO auth.users (id) VALUES ' + ', '.join(f"('{v}')" for v in u.values()) + ';')
        self.run(f"""
INSERT INTO account_age_declarations (user_id, declared_age_band) VALUES
  ('{u['teen']}', '13_to_17'), ('{u['teen_b']}', '13_to_17'), ('{u['aged']}', '13_to_17'), ('{u['linked']}', '13_to_17'),
  ('{u['adult']}', 'adult'), ('{u['kid']}', 'under_13'), ('{u['parent']}', 'adult'), ('{u['stranger']}', 'adult');
UPDATE profiles SET birth_date = current_date - interval '15 years' WHERE user_id = '{u['teen']}';
UPDATE profiles SET birth_date = current_date - interval '18 years 2 days' WHERE user_id = '{u['aged']}';
INSERT INTO user_roles (user_id, role, granted_by) VALUES
  ('{u['parent']}', 'parent', NULL), ('{u['stranger']}', 'parent', NULL);
INSERT INTO parent_verifications (user_id, status, method, given_names, surnames, birth_date) VALUES
  ('{u['parent']}', 'verified', 'local-ocr', 'P', 'One', '1985-03-01'),
  ('{u['stranger']}', 'verified', 'local-ocr', 'S', 'Two', '1984-03-01');
INSERT INTO guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES
  ('{u['parent']}', '{u['kid']}', 'verified', now()), ('{u['parent']}', '{u['linked']}', 'verified', now());
INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{u['kid']}', 'kid', '{u['parent']}');
INSERT INTO courses (id, slug) VALUES ('{self.course}', 'l12-course');
INSERT INTO adventures (id, course_id, position, slug, theme, age_tier, status)
  VALUES ('{self.adventure}', '{self.course}', 1, 'l12-ch', 'archipelago', 'tier1', 'published');
INSERT INTO sagas (id, adventure_id, position, slug) VALUES ('{self.saga}', '{self.adventure}', 1, 'l12-arc');
INSERT INTO topics (id, saga_id, position, slug) VALUES ('{self.topic}', '{self.saga}', 1, 'l12-topic');
INSERT INTO lessons (id, topic_id, position, slug) VALUES ('{self.lesson}', '{self.topic}', 1, 'l12-lesson');
""")

    def offer(self, learner, audience, action):
        """A fresh prompt through the real offer function (one new component each time, no cooldown)."""
        self.kc_n += 1
        key = f'bridge.l12-{self.kc_n}'
        self.run(f"""INSERT INTO kc (key, strand, title, objective, status)
                     VALUES ('{key}', 'money_math', '{{"en-US":"K"}}', '{{"en-US":"K"}}', 'draft');""")
        out = json.loads(self.service(
            f"""SELECT offer_learning_bridge_prompt('{self.u[learner]}', '{audience}',
                  '[{{"kc_key": "{key}", "action": "{action}"}}]'::jsonb,
                  '{self.course}', '{self.topic}', '{self.lesson}', 14, 0)"""))
        assert out.get('offered') is True, out
        return out['prompt_id']

    def insert_prompt(self, learner, audience, action):
        """A prompt written directly (superuser), for the chain whose offer function cannot run."""
        self.kc_n += 1
        key = f'bridge.l12-{self.kc_n}'
        return self.run(f"""INSERT INTO kc (key, strand, title, objective, status)
                              VALUES ('{key}', 'money_math', '{{"en-US":"K"}}', '{{"en-US":"K"}}', 'draft');
                            INSERT INTO learning_bridge_prompts (learner_id, kc_id, action, audience, course_id, topic_id, lesson_id, expires_at)
                              SELECT '{self.u[learner]}', id, '{action}', '{audience}', '{self.course}', '{self.topic}', '{self.lesson}',
                                     now() + interval '14 days' FROM kc WHERE key = '{key}' RETURNING id;""").splitlines()[-1]

    def act(self, prompt, actor, title=None, amount=None, icon=None, recurrence=None):
        lit = lambda v: 'NULL' if v is None else (str(v) if isinstance(v, int) else "'" + v.replace("'", "''") + "'")
        return json.loads(self.service(
            f"SELECT act_on_learning_bridge_prompt('{prompt}', '{self.u[actor]}', {lit(title)}, {lit(amount)}::integer, {lit(icon)}, {lit(recurrence)})"))

    def prompt(self, prompt_id):
        return self.run(f"SELECT status || '|' || coalesce(result_goal_id::text, '-') || '|' || coalesce(result_task_id::text, '-') "
                        f"FROM learning_bridge_prompts WHERE id = '{prompt_id}'")

    def goals(self, who):
        return int(self.run(f"SELECT count(*) FROM savings_goals WHERE kid_user_id = '{self.u[who]}'"))


try:
    # ── 1. Reproduce the L-12 gap on the chain before this migration ─────────
    before = Db(fresh(BEFORE))
    check(f'the chain through {BEFORE.name} applies ({MIGRATIONS.index(BEFORE) + 1} migrations)')
    before.seed()
    # 0127's offer function cannot run on PostgreSQL at all (fixed by the target migration).
    before.rejected(f"""SET ROLE service_role; SELECT offer_learning_bridge_prompt('{before.u['teen']}', 'self',
                          '[{{"kc_key": "bridge.none", "action": "savings_goal"}}]'::jsonb, '{before.course}', '{before.topic}', '{before.lesson}', 14, 0)""",
                    'WITH ORDINALITY cannot be used with a column definition list')
    check(f'before {TARGET.name}: offer_learning_bridge_prompt (0127) fails on every call ("WITH ORDINALITY cannot be used with a column '
          'definition list"), so no bridge prompt of any audience can be stored (defect reproduced)')
    p = before.insert_prompt('teen', 'self', 'savings_goal')
    before.rejected(f"SET ROLE service_role; SELECT act_on_learning_bridge_prompt('{p}', '{before.u['teen']}', 'Bike', 100, 'star', NULL)",
                    'a self prompt creates nothing')
    assert before.act(p, 'teen')['goal_id'] is None and before.goals('teen') == 0
    goal = before.service(f"INSERT INTO savings_goals (kid_user_id, title, target) VALUES ('{before.u['teen']}', 'Own', 50) RETURNING id").splitlines()[-1]
    before.rejected(f"UPDATE learning_bridge_prompts SET result_goal_id = '{goal}' WHERE id = '{p}'", 'learning_bridge_prompts_goal_guardian')
    check(f'before {TARGET.name}: an independent teen who holds a wallet (and can create a goal in it) gets NO goal from "I will try": '
          'the function refuses any detail on a self prompt and the CHECK refuses a goal on it (L-12 gap reproduced)')

    # ── 2. The full chain ────────────────────────────────────────────────────
    db = Db(fresh(MIGRATIONS[-1]))
    check(f'all {len(MIGRATIONS)} migrations apply in order on PostgreSQL {db.run("SHOW server_version")}')
    db.seed()
    u = db.u
    kinds = {k: db.service(f"SELECT coalesce(wallet_holder_kind('{v}'), 'none')").splitlines()[-1] for k, v in u.items()}
    assert kinds == {'teen': 'teen', 'teen_b': 'teen', 'aged': 'none', 'adult': 'none', 'kid': 'managed_child', 'linked': 'teen',
                     'parent': 'none', 'stranger': 'none'}, kinds
    check(f'populations seeded; wallet holders by the database\'s own rule: {kinds}')

    # Structure and privileges.
    constraints = db.run("SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint "
                         "WHERE conrelid = 'public.learning_bridge_prompts'::regclass AND contype = 'c'")
    assert 'learning_bridge_prompts_goal_savings' in constraints and 'learning_bridge_prompts_goal_guardian' not in constraints, constraints
    assert 'learning_bridge_prompts_task_guardian' in constraints, constraints
    assert db.run("SELECT count(*) FROM pg_trigger WHERE tgname = 'learning_bridge_prompt_goal_guard' AND NOT tgisinternal") == '1'
    fn = 'public.act_on_learning_bridge_prompt(uuid, uuid, text, integer, text, text)'
    privileges = {role: db.run(f"SELECT has_function_privilege('{role}', '{fn}', 'EXECUTE')") for role in ('anon', 'authenticated', 'service_role')}
    assert privileges == {'anon': 'f', 'authenticated': 'f', 'service_role': 't'}, privileges
    guard = {role: db.run(f"SELECT has_function_privilege('{role}', 'public.guard_learning_bridge_prompt_goal()', 'EXECUTE')")
             for role in ('anon', 'authenticated', 'service_role')}
    assert set(guard.values()) == {'f'}, guard
    assert db.run("SELECT prosecdef FROM pg_proc WHERE oid = 'public.act_on_learning_bridge_prompt(uuid, uuid, text, integer, text, text)'::regprocedure") == 't'
    check('the goal CHECK is now learning_bridge_prompts_goal_savings (the task CHECK is unchanged), the owner guard trigger exists, '
          'the function stays SECURITY DEFINER and executable by service_role only, and the guard function by nobody')

    # ── 3. The independent teen with a wallet ─────────────────────────────
    p1 = db.offer('teen', 'self', 'savings_goal')
    out = db.act(p1, 'teen', '  My savings goal  ', 100, 'star')
    assert out['status'] == 'acted' and out['replayed'] is False and out['goal_id'] and out['goal_refused'] is None and out['task_id'] is None, out
    row = db.run(f"SELECT kid_user_id || '|' || title || '|' || target || '|' || icon || '|' || status FROM savings_goals WHERE id = '{out['goal_id']}'")
    assert row == f"{u['teen']}|My savings goal|100|star|active", row
    assert db.prompt(p1) == f"acted|{out['goal_id']}|-"
    assert db.run(f"SELECT closed_by FROM learning_bridge_prompts WHERE id = '{p1}'") == u['teen']
    replay = db.act(p1, 'teen', 'Something else', 7, 'bike')
    assert replay == {'status': 'acted', 'replayed': True, 'task_id': None, 'goal_id': out['goal_id']}, replay
    assert db.goals('teen') == 1
    assert db.as_user('authenticated', u['teen'], f"SELECT result_goal_id FROM learning_bridge_prompts WHERE id = '{p1}'").splitlines()[-1] == out['goal_id']
    assert db.as_user('authenticated', u['teen'], f"SELECT count(*) FROM savings_goals WHERE id = '{out['goal_id']}'").splitlines()[-1] == '1'
    check('independent teen with a personal wallet: "I will try" creates exactly one goal owned by the teen (trimmed title, target, icon), '
          'closes the prompt with it in the same transaction, and a replay with other details returns the same goal; '
          'the teen reads both through their own RLS')

    # Real concurrency: two acts on one fresh prompt.
    p2 = db.offer('teen_b', 'self', 'savings_goal')
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: db.act(p2, 'teen_b', 'Race', 30, 'gift'), range(2)))
    assert sorted(r['replayed'] for r in results) == [False, True], results
    assert results[0]['goal_id'] == results[1]['goal_id'] and db.goals('teen_b') == 1, results
    check('two concurrent "I will try" acts on the same prompt (two connections) create one goal; the second is a replay of the first')

    # All-null details: the pre-L-12 contract.
    p3 = db.offer('teen', 'self', 'savings_goal')
    out3 = db.act(p3, 'teen')
    assert out3['status'] == 'acted' and out3['goal_id'] is None and out3['goal_refused'] is None, out3
    assert db.goals('teen') == 1 and db.prompt(p3) == 'acted|-|-'
    check('all-null details (what an older Core sends) still record the commitment only: no goal')

    # Invalid details refuse and change nothing.
    p4 = db.offer('teen', 'self', 'savings_goal')
    bad = [("''", 100, "'star'", 'NULL'), ("'   '", 100, "'star'", 'NULL'), (f"'{'x' * 81}'", 100, "'star'", 'NULL'),
           ("'Bike'", 0, "'star'", 'NULL'), ("'Bike'", 100001, "'star'", 'NULL'), ("'Bike'", 'NULL', "'star'", 'NULL'),
           ("'Bike'", 100, "'car'", 'NULL'), ("'Bike'", 100, 'NULL', 'NULL'), ("'Bike'", 100, "'star'", "'once'")]
    for title, amount, icon, recurrence in bad:
        db.rejected(f"SET ROLE service_role; SELECT act_on_learning_bridge_prompt('{p4}', '{u['teen']}', {title}, {amount}, {icon}, {recurrence})",
                    'invalid savings goal')
    assert db.prompt(p4) == 'open|-|-' and db.goals('teen') == 1
    check(f'{len(bad)} invalid goal details (empty or blank or 81-character title, target 0, 100001 or missing, unknown or missing icon, '
          'a recurrence) are refused with 22023 and leave the prompt open and no goal')

    # Earning-task self prompts: tasks stay guardian-only.
    p5 = db.offer('teen', 'self', 'earning_task')
    db.rejected(f"SET ROLE service_role; SELECT act_on_learning_bridge_prompt('{p5}', '{u['teen']}', 'Mow', 10, NULL, 'once')", 'creates no task')
    db.rejected(f"SET ROLE service_role; SELECT act_on_learning_bridge_prompt('{p5}', '{u['teen']}', 'Mow', 10, 'star', NULL)", 'creates no task')
    out5 = db.act(p5, 'teen')
    assert out5['task_id'] is None and out5['goal_id'] is None and db.prompt(p5) == 'acted|-|-'
    assert db.run(f"SELECT count(*) FROM tasks WHERE assigned_to = '{u['teen']}'") == '0'
    check('an earning-task self prompt refuses task-shaped and goal-shaped details alike and, acted on, records a commitment and creates no task')

    # ── 4. No wallet today: the commitment stays, no goal, no wallet ──────
    for who in ('aged', 'adult'):
        p6 = db.offer(who, 'self', 'savings_goal')
        out6 = db.act(p6, who, 'Bike', 100, 'bike')
        assert out6['status'] == 'acted' and out6['goal_id'] is None and out6['goal_refused'] == 'WALLET_HOLDER_REQUIRED', out6
        assert db.prompt(p6) == 'acted|-|-' and db.goals(who) == 0
        assert db.run(f"SELECT count(*) FROM wallet_ledger WHERE kid_user_id = '{u[who]}'") == '0'
        assert db.act(p6, who, 'Bike', 100, 'bike') == {'status': 'acted', 'replayed': True, 'task_id': None, 'goal_id': None}
    check('a declared teen whose birth date now says 18, and an adult holding a self prompt through a Core defect: the commitment is recorded, '
          'goal_refused = WALLET_HOLDER_REQUIRED, no goal and no wallet row; the function never creates a wallet')

    # ── 5. Nobody else; never someone else's goal ─────────────────────────
    p7 = p4  # still open (every invalid act above was refused); one open prompt per action holds for this teen
    for actor in ('teen_b', 'parent', 'stranger', 'kid', 'adult'):
        assert db.act(p7, actor, 'Mine', 10, 'star') == {'status': 'forbidden'}, actor
    assert db.prompt(p7) == 'open|-|-' and db.goals('teen_b') == 1 and db.goals('teen') == 1
    other_goal = db.run(f"SELECT id FROM savings_goals WHERE kid_user_id = '{u['teen_b']}'")
    db.rejected(f"SET ROLE service_role; UPDATE learning_bridge_prompts SET status = 'acted', closed_at = now(), result_goal_id = '{other_goal}' WHERE id = '{p7}'",
                'BRIDGE_GOAL_NOT_LEARNERS')
    db.rejected(f"SET ROLE service_role; UPDATE learning_bridge_prompts SET result_goal_id = '{other_goal}' WHERE id = '{p1}'", 'BRIDGE_GOAL_NOT_LEARNERS')
    own_goal = db.run(f"SELECT result_goal_id FROM learning_bridge_prompts WHERE id = '{p1}'")
    db.rejected(f"SET ROLE service_role; UPDATE learning_bridge_prompts SET result_goal_id = '{own_goal}' WHERE id = '{p5}'",
                'learning_bridge_prompts_goal_savings')
    db.rejected(f"SET ROLE service_role; UPDATE learning_bridge_prompts SET learner_id = '{u['teen_b']}' WHERE id = '{p1}'", 'BRIDGE_GOAL_NOT_LEARNERS')
    check('another teen, a verified parent, a stranger parent, a child and an adult are all forbidden on a teen\'s self prompt and create nothing; '
          'the service role cannot point a prompt at another account\'s goal (BRIDGE_GOAL_NOT_LEARNERS, also by moving the learner) '
          'nor put a goal on a task prompt (CHECK)')

    # ── 6. Guardian prompts unchanged ─────────────────────────────────────
    g1 = db.offer('kid', 'guardian', 'savings_goal')
    assert db.act(g1, 'stranger', 'Bike', 120, 'bike') == {'status': 'forbidden'}
    assert db.act(g1, 'kid', 'Bike', 120, 'bike') == {'status': 'forbidden'}
    gout = db.act(g1, 'parent', 'Bike', 120, 'bike')
    assert gout['status'] == 'acted' and gout['goal_id'] and gout['goal_refused'] is None
    assert db.run(f"SELECT kid_user_id FROM savings_goals WHERE id = '{gout['goal_id']}'") == u['kid']
    assert db.act(g1, 'parent', 'Bike', 120, 'bike')['replayed'] is True and db.goals('kid') == 1
    db.rejected(f"SET ROLE service_role; SELECT act_on_learning_bridge_prompt('{db.offer('kid', 'guardian', 'savings_goal')}', '{u['parent']}', NULL, NULL, NULL, NULL)",
                'invalid savings goal')
    g2 = db.offer('kid', 'guardian', 'earning_task')
    tout = db.act(g2, 'parent', 'Water the plants', 10, None, 'weekly')
    assert tout['task_id'] and db.run(f"SELECT assigned_by || '|' || assigned_to FROM tasks WHERE id = '{tout['task_id']}'") == f"{u['parent']}|{u['kid']}"
    # Tasks stay guardian-only as a database fact: no writer can hang a task on a self prompt.
    db.rejected(f"SET ROLE service_role; UPDATE learning_bridge_prompts SET result_task_id = '{tout['task_id']}' WHERE id = '{p5}'",
                'learning_bridge_prompts_task_guardian')
    g3 = db.offer('linked', 'guardian', 'savings_goal')
    assert db.act(g3, 'linked', 'Camp', 300, 'trip') == {'status': 'forbidden'}
    lout = db.act(g3, 'parent', 'Camp', 300, 'trip')
    assert db.run(f"SELECT kid_user_id FROM savings_goals WHERE id = '{lout['goal_id']}'") == u['linked']
    assert json.loads(db.service(f"SELECT offer_learning_bridge_prompt('{u['linked']}', 'self', '[{{\"kc_key\": \"bridge.l12-1\", \"action\": \"savings_goal\"}}]'::jsonb, "
                                 f"'{db.course}', '{db.topic}', '{db.lesson}', 14, 0)"))['reason'] == 'audience'
    check('guardian prompts unchanged: the verified guardian creates the goal for a parent-created child (a replay creates nothing; '
          'no details are refused) and a real task; a self-registered teen who linked them gets guardian prompts only (a self offer is refused), '
          'and the guardian creates that teen\'s goal; a stranger parent and the learner are forbidden')

    # ── 7. Browser roles ─────────────────────────────────────────────────
    for role in ('anon', 'authenticated'):
        db.rejected(f"SET ROLE {role}; SELECT set_config('request.jwt.claim.sub', '{u['teen']}', false); "
                            f"SELECT act_on_learning_bridge_prompt('{p7}', '{u['teen']}', 'Mine', 10, 'star', NULL)", 'permission denied')
    before_row = db.prompt(p7)
    db.as_user('authenticated', u['teen'], f"UPDATE learning_bridge_prompts SET status = 'acted', closed_at = now(), result_goal_id = '{own_goal}' WHERE id = '{p7}'")
    db.as_user('authenticated', u['teen'], f"DELETE FROM learning_bridge_prompts WHERE id = '{p7}'")
    fresh_kc = db.run("INSERT INTO kc (key, strand, title, objective, status) VALUES "
                      "('bridge.l12-browser', 'money_math', '{\"en-US\":\"K\"}', '{\"en-US\":\"K\"}', 'draft') RETURNING id").splitlines()[-1]
    prompts_before = db.run('SELECT count(*) FROM learning_bridge_prompts')
    try:
        db.run(f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '{u['teen']}', false); "
                f"INSERT INTO learning_bridge_prompts (learner_id, kc_id, action, audience, course_id, topic_id, expires_at, status, closed_at, result_goal_id) "
                f"VALUES ('{u['teen']}', '{fresh_kc}', 'savings_goal', 'self', '{db.course}', '{db.topic}', now() + interval '1 day', 'acted', now(), '{own_goal}')")
        raise AssertionError('a browser insert succeeded')
    except RuntimeError as error:
        assert 'row-level security' in str(error) or 'permission denied' in str(error), str(error)
    assert db.run('SELECT count(*) FROM learning_bridge_prompts') == prompts_before
    assert db.prompt(p7) == before_row == 'open|-|-'
    check('anon and authenticated cannot execute act_on_learning_bridge_prompt (permission denied); the teen\'s own browser session cannot '
          'update, delete or insert a prompt (RLS: select only), so the link to a goal is written only by the function')

    # ── 8. The offer function itself, now runnable ────────────────────────
    order = json.loads(db.service(
        f"""SELECT offer_learning_bridge_prompt('{u['teen_b']}', 'self',
              '[{{"kc_key": "bridge.missing", "action": "savings_goal"}}, {{"kc_key": "bridge.l12-2", "action": "earning_task"}},
                {{"kc_key": "bridge.l12-1", "action": "savings_goal"}}, {{"kc_key": "bridge.l12-3", "action": "earning_task"}},
                {{"kc_key": "bridge.l12-4", "action": "earning_task"}}]'::jsonb,
              '{db.course}', '{db.topic}', '{db.lesson}', 14, 30)"""))
    assert order['offered'] is True and order['kc_key'] == 'bridge.l12-3' and order['action'] == 'earning_task', order
    again = json.loads(db.service(
        f"""SELECT offer_learning_bridge_prompt('{u['teen_b']}', 'self', '[{{"kc_key": "bridge.l12-4", "action": "earning_task"}}]'::jsonb,
              '{db.course}', '{db.topic}', '{db.lesson}', 14, 30)"""))
    assert again == {'offered': False, 'reason': 'none_eligible'}, again
    check('offer_learning_bridge_prompt now runs: it walks the candidates in their given order, skipping an unknown component, a component '
          'that already prompted this learner and an action inside its 30-day cooldown, offers the first eligible one, and then holds '
          'one open prompt per action')

    # ── 9. L-13 needs no migration: the journal stays owner-only under RLS ──
    kid_lesson_rows = db.service(
        f"""SELECT record_learner_decisions('{u['kid']}', '{db.course}', '{db.topic}', '{db.lesson}', 'en-US',
              '[{{"segment_id": "price", "decision_point": "decision", "segment_type": "story_branch",
                 "situation_text": "What price?", "choice_id": "p10", "choice_text": "10 coins", "outcome_text": "Two buy."}}]'::jsonb)""")
    assert kid_lesson_rows == '1', kid_lesson_rows
    assert db.as_user('authenticated', u['kid'], 'SELECT count(*) FROM learner_decision_journal').splitlines()[-1] == '1'
    assert db.as_user('authenticated', u['parent'], 'SELECT count(*) FROM learner_decision_journal').splitlines()[-1] == '0'
    assert db.as_user('anon', None, 'SELECT count(*) FROM learner_decision_journal').splitlines()[-1] == '0'
    assert db.service(f"SELECT choice_text FROM learner_decision_journal WHERE user_id = '{u['kid']}'") == '10 coins'
    check('L-13 widens no database policy: a child\'s story decision is recorded, the child reads it, the child\'s own verified guardian and anon '
          'read nothing through the browser; only the service role (Core, after its own L-13 check) reads it')

    # ── 10. Appendix C metric reads the self goal as a conversion ────────
    metrics = json.loads(db.service("SELECT learning_narrative_metrics(now() - interval '1 day', now() + interval '1 day')"))
    assert metrics['bridge_prompts_converted_7d'] == 5, metrics
    check(f'learning_narrative_metrics counts the teens\' own goals as conversions next to the guardian goals and task: {metrics}')

    report = {'databases': databases, 'server': db.run('SHOW server_version'), 'checks': checks}
    if os.environ.get('LF_PG_REPORT'):
        Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'checks': len(checks)}, indent=2))
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        for database in databases:
            sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')
