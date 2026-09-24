"""Real atomic-grade regression against the explicitly owned disposable WSL stack."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[2]
WSL = ['wsl.exe', '-d', 'LittleFounders-QA-20260916', '--']
def run(args, input=None):
    result = subprocess.run(WSL + args, input=input, capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

assert run(['cat', '/root/lfqa/AUDIT_OWNER']) == 'LittleFounders isolated audit 2026-09-16'
DOCKER = ['env', 'DOCKER_HOST=unix:///var/run/lfqa-docker.sock', 'docker']
assert run(DOCKER + ['info', '--format', '{{.DockerRootDir}}']) == '/var/lib/lfqa-docker'
def sql(query):
    return run(DOCKER + ['exec', '-i', 'supabase-db', 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'], query)

user = 'e1840000-0000-4000-8000-000000000001'
lesson = 'e1840000-0000-4000-8000-000000000002'
sql(f"""
INSERT INTO auth.users(id) VALUES ('{user}');
INSERT INTO courses(id,slug) VALUES ('e1840000-0000-4000-8000-000000000010','audit-grade');
INSERT INTO adventures(id,course_id,position,slug,theme) VALUES ('e1840000-0000-4000-8000-000000000011','e1840000-0000-4000-8000-000000000010',1,'adventure','archipelago');
INSERT INTO sagas(id,adventure_id,position,slug) VALUES ('e1840000-0000-4000-8000-000000000012','e1840000-0000-4000-8000-000000000011',1,'saga');
INSERT INTO topics(id,saga_id,position,slug) VALUES ('e1840000-0000-4000-8000-000000000013','e1840000-0000-4000-8000-000000000012',1,'topic');
INSERT INTO lessons(id,topic_id,position,slug) VALUES ('{lesson}','e1840000-0000-4000-8000-000000000013',1,'lesson');
""")

def grade(client, run_id, score=0, segment='quiz', hold=True):
    verdict = json.dumps({'correct': score == 100, 'score': score, 'tier': 'perfect' if score == 100 else 'tryAgain', 'allowRetry': True, 'reveal': {'answer': 'synthetic'}})
    query = f"SELECT public.record_lesson_grade('{user}','{lesson}','{run_id}','{segment}',{client},2,0,'{verdict}'::jsonb,'{{}}'::jsonb);"
    return f"BEGIN; SET LOCAL ROLE service_role; {query}" + ('SELECT pg_sleep(0.15);' if hold else '') + 'COMMIT;'

same = 'e1840000-0000-4000-8000-000000000020'
with ThreadPoolExecutor(max_workers=8) as pool:
    replies = list(pool.map(lambda _: json.loads(sql(grade(1, same))), range(8)))
assert all(r == replies[0] for r in replies)
assert replies[0]['verdict']['allowRetry'] is True
assert 'reveal' not in replies[0]['verdict']
assert sql(f"SELECT count(*) FROM lesson_segment_attempts WHERE user_id='{user}' AND run_id='{same}'") == '1'
assert json.loads(sql(grade(1, same, score=100))) == replies[0]

distinct = 'e1840000-0000-4000-8000-000000000021'
with ThreadPoolExecutor(max_workers=8) as pool:
    different = list(pool.map(lambda i: json.loads(sql(grade(i, distinct))), range(1,9)))
assert sum(not r['exhausted'] for r in different) == 2
assert sql(f"SELECT string_agg(attempt_number::text,',' ORDER BY attempt_number) FROM lesson_segment_attempts WHERE user_id='{user}' AND run_id='{distinct}'") == '1,2'
final = [r['verdict'] for r in different if not r['exhausted'] and not r['verdict']['allowRetry']]
assert len(final) == 1 and final[0]['reveal'] == {'answer': 'synthetic'}

failure = 'e1840000-0000-4000-8000-000000000022'
sql("""CREATE FUNCTION public.qa_reject_grade_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected receipt failure'; END $$;
CREATE TRIGGER qa_reject_grade_receipt BEFORE INSERT ON lesson_grade_receipts FOR EACH ROW EXECUTE FUNCTION public.qa_reject_grade_receipt();""")
try:
    sql(grade(1, failure))
    raise AssertionError('Failure injection did not run')
except RuntimeError as error:
    assert 'Injected receipt failure' in str(error)
finally:
    sql('DROP TRIGGER qa_reject_grade_receipt ON lesson_grade_receipts; DROP FUNCTION public.qa_reject_grade_receipt();')
assert sql(f"SELECT count(*) FROM lesson_segment_attempts WHERE user_id='{user}' AND run_id='{failure}'") == '0'
assert sql(f"SELECT count(*) FROM lesson_grade_receipts WHERE user_id='{user}' AND run_id='{failure}'") == '0'
assert sql("SELECT has_function_privilege('authenticated','public.record_lesson_grade(uuid,uuid,uuid,text,integer,integer,integer,jsonb,jsonb)','EXECUTE')") == 'f'
try:
    sql(grade(1, failure).replace('SET LOCAL ROLE service_role', 'SET LOCAL ROLE authenticated'))
    raise AssertionError('Browser role executed the privileged RPC')
except RuntimeError as error:
    assert 'permission denied' in str(error)
assert sql("SELECT has_table_privilege('authenticated','public.lesson_grade_receipts','SELECT')") == 'f'
sql((ROOT/'database/migrations/0084_atomic_segment_grading.sql').read_text(encoding='utf-8'))
assert sql(f"SELECT count(*) FROM lesson_segment_attempts WHERE user_id='{user}'") == '3'

report = {'provenance': 'Real PostgreSQL in isolated full Supabase; all grading calls as service_role', 'sameRequestConcurrency': 8, 'sameRequestAttempts': 1, 'distinctRequestConcurrency': 8, 'acceptedDistinctAttempts': 2, 'changedPayloadReplayPreservesVerdict': True, 'finalRevealGating': True, 'receiptFailureRollsBackAttempt': True, 'browserExecutionDenied': True, 'browserReceiptReadsDenied': True, 'migrationReplayPreservesAttempts': True}
(ROOT/'audit-results/atomic-grade-postgres.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
