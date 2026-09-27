"""B.13 x OD-28 (owner review item L-12): an independent teen's "I will try" on a
savings-goal bridge prompt creates the teen's own goal, enforced by PostgreSQL.

Applies the ACTUAL migration chain (every file in database/migrations, in
order) to a fresh database on an owned native PostgreSQL cluster, over the
same minimal Supabase shim the teen-wallet verifier uses, then calls
public.act_on_learning_bridge_prompt as the service role (Core) with every
population and shape that matters:

  * a wallet-holding teen names a goal: one goal in the teen's own wallet,
    recorded in result_self_goal_id, and a replay returns the same goal;
  * a teen answers with no details: the commitment alone, nothing created;
  * a teen sends details on a task prompt: refused, no task (OD-3);
  * someone else acts on the teen's prompt: forbidden;
  * a self prompt whose learner the wallet does not admit (an adult):
    'no_wallet', nothing written, the prompt still open;
  * the guardian path is unchanged (result_goal_id, verified link only);
  * the new CHECK refuses a self goal on a guardian prompt;
  * the browser roles cannot call the function at all.

Cluster selection (never the shared Docker stack):
  LF_PG_BIN   directory holding psql.exe (default: .codex/audit-db/pgsql/bin)
  LF_PG_PORT  loopback port (default 15483)
  LF_PG_USER  superuser (default audit_owner)
  LF_PG_DATA  the data directory the server must report (ownership check)
"""
from pathlib import Path
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
MIGRATIONS = sorted((ROOT / 'database/migrations').glob('*.sql'))
BASE = [str(BIN / 'psql.exe' if (BIN / 'psql.exe').exists() else BIN / 'psql'), '-X', '-h', '127.0.0.1', '-p', PORT,
        '-U', USER, '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


if Path(sql('SHOW data_directory')).resolve() != DATA.resolve():
    raise RuntimeError('Refusing an unowned database cluster')

SHIM = (ROOT / 'database/scripts/verify-teen-wallet-postgres.py').read_text(encoding='utf-8').split('SHIM = """')[1].split('"""')[0]

db = 'lf_teen_bridge_' + uuid.uuid4().hex
sql(f'CREATE DATABASE {db}')
checks = []
try:
    sql(SHIM, db)
    for migration in MIGRATIONS:
        sql(migration.read_text(encoding='utf-8'), db)

    ids = {name: str(uuid.uuid4()) for name in ['teen', 'adult', 'kid', 'parent', 'stranger', 'course', 'adventure', 'saga', 'topic', 'lesson']}
    kcs = [str(uuid.uuid4()) for _ in range(6)]
    users = ", ".join(f"('{ids[n]}', '{n}@example.test')" for n in ['teen', 'adult', 'kid', 'parent', 'stranger'])
    sql(f"""
INSERT INTO auth.users (id, email) VALUES {users};
INSERT INTO public.profiles (user_id) VALUES ('{ids['teen']}'), ('{ids['adult']}'), ('{ids['kid']}'), ('{ids['parent']}'), ('{ids['stranger']}')
  ON CONFLICT (user_id) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id IN ('{ids['teen']}', '{ids['adult']}', '{ids['stranger']}');
INSERT INTO public.account_age_declarations (user_id, declared_age_band) VALUES
  ('{ids['teen']}', '13_to_17'), ('{ids['adult']}', 'adult'), ('{ids['kid']}', 'under_13'), ('{ids['parent']}', 'adult'), ('{ids['stranger']}', 'adult');
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['parent']}', 'parent') ON CONFLICT DO NOTHING;
INSERT INTO public.guardian_links (parent_user_id, kid_user_id, verification_status, verified_at) VALUES ('{ids['parent']}', '{ids['kid']}', 'verified', now());
INSERT INTO public.user_roles (user_id, role) VALUES ('{ids['kid']}', 'kid') ON CONFLICT DO NOTHING;
INSERT INTO public.courses (id, slug) VALUES ('{ids['course']}', 'bridge-course');
INSERT INTO public.adventures (id, course_id, position, slug, theme) VALUES ('{ids['adventure']}', '{ids['course']}', 1, 'ch', 'forest');
INSERT INTO public.sagas (id, adventure_id, position, slug) VALUES ('{ids['saga']}', '{ids['adventure']}', 1, 'arc');
INSERT INTO public.topics (id, saga_id, position, slug) VALUES ('{ids['topic']}', '{ids['saga']}', 1, 'save');
INSERT INTO public.kc (id, key, strand, title, objective) VALUES
""" + ",\n".join(f"  ('{k}', 'kc.bridge{i}', 'money_life', '{{}}', '{{}}')" for i, k in enumerate(kcs)) + ";", db)

    def prompt(learner, kc, action, audience):
        return sql(f"""INSERT INTO public.learning_bridge_prompts (learner_id, kc_id, action, audience, course_id, topic_id, expires_at)
VALUES ('{learner}', '{kc}', '{action}', '{audience}', '{ids['course']}', '{ids['topic']}', now() + interval '14 days') RETURNING id;""", db).splitlines()[-1]

    def act(prompt_id, actor, title=None, amount=None, icon=None, recurrence=None):
        lit = lambda v: 'NULL' if v is None else (str(v) if isinstance(v, int) else "'" + v + "'")
        out = sql(f"SET ROLE service_role; SELECT public.act_on_learning_bridge_prompt('{prompt_id}', '{actor}', {lit(title)}, {lit(amount)}::int, {lit(icon)}, {lit(recurrence)});", db)
        return json.loads(out.splitlines()[-1])

    def refused(fn, token):
        try:
            fn()
        except RuntimeError as error:
            assert token in str(error), f'expected {token}, got {error}'
            return
        raise AssertionError(f'expected refusal {token}')

    # 1. A wallet-holding teen names a goal; a replay returns it.
    teen_goal = prompt(ids['teen'], kcs[0], 'savings_goal', 'self')
    first = act(teen_goal, ids['teen'], 'New headphones', 300, 'gift')
    assert first['status'] == 'acted' and first['replayed'] is False and first['goal_id'], first
    row = sql(f"SELECT kid_user_id, title, target, icon FROM public.savings_goals WHERE id = '{first['goal_id']}';", db)
    assert row == f"{ids['teen']}|New headphones|300|gift", row
    assert sql(f"SELECT result_self_goal_id, result_goal_id IS NULL, result_task_id IS NULL, status FROM public.learning_bridge_prompts WHERE id = '{teen_goal}';", db) \
        == f"{first['goal_id']}|t|t|acted"
    again = act(teen_goal, ids['teen'], 'Again', 5, 'star')
    assert again == {'status': 'acted', 'replayed': True, 'task_id': None, 'goal_id': first['goal_id']}, again
    assert sql(f"SELECT count(*) FROM public.savings_goals WHERE kid_user_id = '{ids['teen']}';", db) == '1'
    checks.append('a wallet-holding teen creates one own goal from a savings prompt; a replay returns the same goal')

    # 2. No details: the commitment alone.
    teen_commit = prompt(ids['teen'], kcs[1], 'savings_goal', 'self')
    commit = act(teen_commit, ids['teen'])
    assert commit['status'] == 'acted' and commit['goal_id'] is None, commit
    assert sql(f"SELECT count(*) FROM public.savings_goals WHERE kid_user_id = '{ids['teen']}';", db) == '1'
    checks.append('a teen answering with no details records the commitment and creates nothing')

    # 3. Details on a self task prompt: refused, no task.
    teen_task = prompt(ids['teen'], kcs[2], 'earning_task', 'self')
    refused(lambda: act(teen_task, ids['teen'], 'Mow', 10, None, 'once'), 'a self task prompt creates nothing')
    refused(lambda: act(teen_task, ids['teen'], 'Mow', 10, 'star'), 'a self task prompt creates nothing')
    assert sql('SELECT count(*) FROM public.tasks;', db) == '0'
    checks.append('a self task prompt with details is refused and no task exists (OD-3)')

    # 4. Someone else acting on the teen's prompt.
    teen_other = prompt(ids['teen'], kcs[3], 'savings_goal', 'self')
    assert act(teen_other, ids['stranger'], 'Mine', 10, 'star') == {'status': 'forbidden'}
    assert act(teen_other, ids['parent'], 'Mine', 10, 'star') == {'status': 'forbidden'}
    refused(lambda: act(teen_other, ids['teen'], 'x' * 81, 10, 'star'), 'invalid savings goal')
    refused(lambda: act(teen_other, ids['teen'], 'Bike', 0, 'star'), 'invalid savings goal')
    refused(lambda: act(teen_other, ids['teen'], 'Bike', 10, 'car'), 'invalid savings goal')
    assert sql(f"SELECT status FROM public.learning_bridge_prompts WHERE id = '{teen_other}';", db) == 'open'
    checks.append('only the teen acts on their prompt, and malformed goals are refused')

    # 5. A self prompt whose learner the wallet does not admit.
    adult_prompt = prompt(ids['adult'], kcs[4], 'savings_goal', 'self')
    assert act(adult_prompt, ids['adult'], 'Car', 100, 'star') == {'status': 'no_wallet'}
    assert sql(f"SELECT count(*) FROM public.savings_goals WHERE kid_user_id = '{ids['adult']}';", db) == '0'
    assert sql(f"SELECT status FROM public.learning_bridge_prompts WHERE id = '{adult_prompt}';", db) == 'open'
    checks.append("no wallet, no goal: 'no_wallet', nothing written, the prompt still open")

    # 6. The guardian path is unchanged, and the new CHECK holds.
    kid_prompt = prompt(ids['kid'], kcs[5], 'savings_goal', 'guardian')
    assert act(kid_prompt, ids['stranger'], 'Bike', 120, 'bike') == {'status': 'forbidden'}
    guardian = act(kid_prompt, ids['parent'], 'Bike', 120, 'bike')
    assert guardian['status'] == 'acted' and guardian['goal_id'], guardian
    assert sql(f"SELECT result_goal_id, result_self_goal_id IS NULL FROM public.learning_bridge_prompts WHERE id = '{kid_prompt}';", db) == f"{guardian['goal_id']}|t"
    refused(lambda: sql(f"UPDATE public.learning_bridge_prompts SET result_self_goal_id = '{guardian['goal_id']}' WHERE id = '{kid_prompt}';", db),
            'learning_bridge_prompts_self_goal')
    checks.append('the verified guardian path is unchanged and a self goal can never sit on a guardian prompt')

    # 7. The browser roles cannot call the function.
    for role in ['anon', 'authenticated']:
        refused(lambda: sql(f"SET ROLE {role}; SELECT public.act_on_learning_bridge_prompt('{teen_other}', '{ids['teen']}', 'Bike', 10, 'star', NULL);", db),
                'permission denied')
    checks.append('anon and authenticated cannot execute the function')

    print(json.dumps({'database': 'fresh, full chain', 'migrations': len(MIGRATIONS), 'checks': checks}, indent=2))
finally:
    sql(f'DROP DATABASE IF EXISTS {db} WITH (FORCE)')
