"""Verify production KC activation on an owned disposable native PostgreSQL DB.

Loads the actual 294-lesson hierarchy, 882 authored documents and graph. All
pedagogical reviews and release attestations here are SYNTHETIC TEST FIXTURES;
they are never exported into the production review packet or live database.
"""
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PSQL = ROOT / '.codex/audit-db/pgsql/bin/psql.exe'
DATA = ROOT / '.codex/audit-db/data'
BASE = [str(PSQL), '-X', '-h', '127.0.0.1', '-p', '15483', '-U', 'audit_owner', '-v', 'ON_ERROR_STOP=1', '-Atq']


def sql(query, database='postgres'):
    result = subprocess.run(BASE + ['-d', database], input=query, text=True, encoding='utf-8', capture_output=True,
                            env={**os.environ, 'PGCLIENTENCODING': 'UTF8'})
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def node(*args, cwd=ROOT):
    result = subprocess.run(['node', *args], cwd=cwd, text=True, encoding='utf-8', capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout


if Path(sql('SHOW data_directory')).resolve() != DATA.resolve():
    raise RuntimeError('Refusing any cluster outside the owned local audit directory')
database = 'lf_kc_activation_' + uuid.uuid4().hex[:12]
sql(f'CREATE DATABASE {database}')
checks = []


def run(query):
    return sql(query, database)


def check(name):
    checks.append(name)
    print('ok -', name, flush=True)


activation_sql = node('agent/tools/render-kc-activation.mjs', '--manifest', 'database/seeds/kc_activation.financial-production.json')


def rejected(message):
    before = run("SELECT md5(jsonb_agg(to_jsonb(k) ORDER BY key)::text) FROM kc k")
    try:
        run(activation_sql)
    except RuntimeError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError('Expected activation refusal: ' + message)
    assert run("SELECT md5(jsonb_agg(to_jsonb(k) ORDER BY key)::text) FROM kc k") == before
    check('atomic refusal: ' + message)


try:
    shim = re.search(r'SHIM = """(.*?)"""', (ROOT / 'database/scripts/verify-data-platform-postgres.py').read_text(encoding='utf-8'), re.S).group(1)
    run(shim)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    for migration in migrations:
        run(migration.read_text(encoding='utf-8'))
    check(f'all {len(migrations)} migrations apply')
    rows = json.loads(node('--import', 'tsx', '--input-type=module', '-e',
        "import {readSeedFiles,kcSeedRows} from './src/scripts/seed-kc-graph.ts'; const {seed,activation}=readSeedFiles(); console.log(JSON.stringify(kcSeedRows(seed.kcs,new Set(activation.activations.map(r=>r.key)))));", cwd=ROOT / 'backend'))
    columns = list(rows['insertRows'][0])
    payload = literal(json.dumps(rows['insertRows']))
    run(f"INSERT INTO kc ({','.join(columns)}) SELECT {','.join(columns)} FROM jsonb_populate_recordset(NULL::kc,{payload}::jsonb) ON CONFLICT(key) DO NOTHING")
    graph = json.loads((ROOT / 'database/seeds/kc_graph.v1.json').read_text(encoding='utf-8'))
    edges = ','.join(f"({literal(a)},{literal(b)})" for a, b in graph['edges'])
    run(f"INSERT INTO kc_edge SELECT a.id,b.id FROM (VALUES {edges}) e(a,b) JOIN kc a ON a.key=e.a JOIN kc b ON b.key=e.b")
    hierarchy_sql = (ROOT / 'coursegen/runs/production-complete/hierarchy.sql').read_text(encoding='utf-8')
    assert hierarchy_sql.rstrip().endswith('ROLLBACK;')
    run(hierarchy_sql.rstrip()[:-len('ROLLBACK;')] + 'COMMIT;')
    hierarchy = json.loads((ROOT / 'coursegen/runs/production-complete/hierarchy.json').read_text(encoding='utf-8'))
    course = hierarchy['tables']['courses'][0]['id']
    ids = json.loads((ROOT / 'coursegen/runs/production-complete/lesson-ids.json').read_text(encoding='utf-8'))
    documents = json.loads((ROOT / 'coursegen/runs/production-complete/documents.json').read_text(encoding='utf-8'))
    for doc in documents:
        doc['lesson_id'] = ids.get(doc['lesson_id'], doc['lesson_id'])
        doc['document']['lesson_id'] = doc['lesson_id']
    doc_payload = literal(json.dumps(documents, ensure_ascii=False))
    run(f"""INSERT INTO lesson_document_versions(lesson_id,locale,version_id,schema_version,document,answer_keys)
        SELECT lesson_id,locale,version_id,schema_version,document,answer_keys
        FROM jsonb_populate_recordset(NULL::lesson_document_versions,{doc_payload}::jsonb);
        INSERT INTO lesson_document_version_current(lesson_id,locale,document_version_id)
        SELECT lesson_id,locale,id FROM lesson_document_versions;""")
    assert run('SELECT count(*) FROM lessons') == '294'
    assert run('SELECT count(*) FROM lesson_document_version_current') == '882'
    check('actual production hierarchy and all 882 localized documents loaded')
    boss, editor, learner = [str(uuid.uuid4()) for _ in range(3)]
    run(f"INSERT INTO auth.users(id,email) VALUES ('{boss}','fixture-boss@littlefounders.ai'),('{editor}','fixture-editor@example.test'),('{learner}','fixture-learner@example.test'); INSERT INTO user_roles(user_id,role,granted_by) VALUES ('{boss}','superadmin',NULL),('{editor}','admin','{boss}'); INSERT INTO admin_permissions(user_id,permission) VALUES ('{editor}','manage_content');")

    def review():
        result = run(f"""SELECT code FROM lessons l CROSS JOIN LATERAL record_lesson_pedagogical_review('{editor}',l.id,NULL,lesson_stage3_fingerprint(l.id),'{boss}',
            (SELECT jsonb_object_agg(item,jsonb_build_object('result','pass','finding','SYNTHETIC LOCAL TEST FIXTURE ONLY: verifies transaction behavior.')) FROM stage3_review_items()),
            (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'resolution','acceptable','note','SYNTHETIC LOCAL TEST ONLY: resolve the fixture flag.')),'[]'::jsonb) FROM stage3_open_items(l.id,NULL))) r""")
        assert all(code == 'RECORDED' for code in result.splitlines()), result

    def attest():
        run(f"""INSERT INTO course_release_verifications(course_id,checks,content_watermark)
            SELECT '{course}',jsonb_agg(jsonb_build_object('gate',gate_id,'ok',true,'fixture','SYNTHETIC LOCAL TEST ONLY') || CASE WHEN gate_id='forge.release.lessons-complete' THEN jsonb_build_object('catalog_fingerprint',forge_release_catalog_fingerprint('{course}')) ELSE '{{}}'::jsonb END),forge_release_content_watermark('{course}') FROM forge_release_gates
            ON CONFLICT(course_id) DO UPDATE SET checks=excluded.checks,content_watermark=excluded.content_watermark,verified_at=now();""")

    rejected('exactly one published course')
    review()
    attest()
    assert run(f"SELECT code FROM release_course('{boss}','{course}')") == 'RELEASED'
    check('synthetic fixture review/attestation releases all 294 through real release_course')
    run('DELETE FROM course_release_verifications')
    rejected('current release attestation')
    attest()
    first = next(iter(ids.values()))
    run(f"UPDATE topics SET status='draft' WHERE id=(SELECT topic_id FROM lessons WHERE id='{first}')")
    rejected('complete published catalog differs')
    run(f"UPDATE topics SET status='published' WHERE id=(SELECT topic_id FROM lessons WHERE id='{first}')")
    first_kc = run(f"SELECT kc_id FROM topic_knowledge_components WHERE topic_id=(SELECT topic_id FROM lessons WHERE id='{first}') AND is_primary")
    run(f"UPDATE topic_knowledge_components SET role='reviews',is_primary=false WHERE topic_id=(SELECT topic_id FROM lessons WHERE id='{first}') AND kc_id='{first_kc}'")
    rejected('exact published teaching lesson')
    run(f"UPDATE topic_knowledge_components SET role='teaches',is_primary=true WHERE topic_id=(SELECT topic_id FROM lessons WHERE id='{first}') AND kc_id='{first_kc}'")
    run(f"INSERT INTO lesson_stage3_review_items(lesson_id,gate,flag_text) VALUES ('{first}',1,'SYNTHETIC TEST: unresolved issue after publication')")
    rejected('current passing Stage 3 review')
    review()
    run(f"DELETE FROM lesson_document_version_current WHERE lesson_id='{first}' AND locale='en-US'")
    review()
    attest()
    rejected('exact published teaching lesson')
    run(f"""BEGIN; SET LOCAL lf.bypass_justification='Synthetic local fixture restoration after missing-locale refusal';
        INSERT INTO lesson_document_version_current(lesson_id,locale,document_version_id)
        SELECT lesson_id,locale,id FROM lesson_document_versions WHERE lesson_id='{first}' AND locale='en-US'; COMMIT;""")
    review()
    attest()
    # Real learner evidence is confined to this disposable test database.
    run(f"""INSERT INTO learner_kc_mastery(user_id,kc_id,p_known,attempts,correct) SELECT '{learner}',id,0.8,3,2 FROM kc LIMIT 3;
        INSERT INTO kc_attempt(user_id,kc_id,source,correct,p_known_before,p_known_after) SELECT user_id,kc_id,'voice_check',true,0.7,0.8 FROM learner_kc_mastery;""")
    evidence = run("SELECT (SELECT jsonb_agg(to_jsonb(m) ORDER BY kc_id) FROM learner_kc_mastery m)::text || (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM kc_attempt a)::text")
    historical = run("SELECT jsonb_agg(to_jsonb(k) ORDER BY key) FROM kc k WHERE key NOT IN (SELECT jsonb_array_elements(" + literal((ROOT / 'database/seeds/kc_activation.financial-production.json').read_text(encoding='utf-8')) + "::jsonb->'activations')->>'key')")
    run(activation_sql)
    assert run("SELECT count(*) FROM kc WHERE status='active' AND skill_key LIKE 'financial-education/fe-production-%'") == '236'
    run(activation_sql)
    assert run("SELECT count(*) FROM audit_logs WHERE action='content.kc_catalog_activated'") == '1'
    check('exactly 236 bridges activate; repeat activation is idempotent')
    state = run("SELECT jsonb_agg(jsonb_build_array(id,key,status,skill_key) ORDER BY key) FROM kc")
    run(f"INSERT INTO kc ({','.join(columns)}) SELECT {','.join(columns)} FROM jsonb_populate_recordset(NULL::kc,{payload}::jsonb) ON CONFLICT(key) DO NOTHING")
    metadata = literal(json.dumps(rows['metadataRows']))
    updates = ','.join(f'{col}=m.{col}' for col in rows['metadataRows'][0] if col != 'key')
    run(f"UPDATE kc k SET {updates} FROM jsonb_populate_recordset(NULL::kc,{metadata}::jsonb) m WHERE m.key=k.key")
    assert run("SELECT jsonb_agg(jsonb_build_array(id,key,status,skill_key) ORDER BY key) FROM kc") == state
    assert run("SELECT (SELECT jsonb_agg(to_jsonb(m) ORDER BY kc_id) FROM learner_kc_mastery m)::text || (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM kc_attempt a)::text") == evidence
    assert run("SELECT jsonb_agg(to_jsonb(k) ORDER BY key) FROM kc k WHERE key NOT IN (SELECT jsonb_array_elements(" + literal((ROOT / 'database/seeds/kc_activation.financial-production.json').read_text(encoding='utf-8')) + "::jsonb->'activations')->>'key')") == historical
    check('reseed preserves all KC UUID/status/bridges; activation preserves unrelated KCs, mastery and attempt evidence')
    # Exercise the actual old-catalog preparation script in the same local DB.
    old_sql = (ROOT / 'coursegen/curriculum-v2/financial-education/hierarchy/hierarchy.seed.sql').read_text(encoding='utf-8')
    assert old_sql.rstrip().endswith('ROLLBACK;')
    run(old_sql.rstrip()[:-len('ROLLBACK;')] + 'COMMIT;')
    old = json.loads((ROOT / 'coursegen/curriculum-v2/financial-education/hierarchy/hierarchy.rows.json').read_text(encoding='utf-8'))
    old_ids = ','.join(literal(row['id']) for row in old['tables']['lessons'])
    old_topics = ','.join(literal(row['id']) for row in old['tables']['topics'])
    old_sagas = ','.join(literal(row['id']) for row in old['tables']['sagas'])
    old_adventures = ','.join(literal(row['id']) for row in old['tables']['adventures'])
    run(f"UPDATE lessons SET status='archived' WHERE id IN ({old_ids}); UPDATE topics SET status='published' WHERE id IN ({old_topics}); UPDATE sagas SET status='published' WHERE id IN ({old_sagas}); UPDATE adventures SET status='published' WHERE id IN ({old_adventures});")
    old_first = old['tables']['lessons'][0]['id']
    run(f"""INSERT INTO lesson_document_versions(lesson_id,locale,version_id,schema_version,document,answer_keys)
        SELECT l.id,locale,'archived-local-test-fixture',2,jsonb_build_object('lesson_id',l.id,'locale',locale),'{{}}'::jsonb
        FROM lessons l CROSS JOIN unnest(ARRAY['en-US','es-MX','pt-BR']) locale WHERE l.id IN ({old_ids});
        INSERT INTO lesson_document_version_current(lesson_id,locale,document_version_id)
        SELECT lesson_id,locale,id FROM lesson_document_versions WHERE lesson_id IN ({old_ids});
        INSERT INTO lesson_segment_attempts(user_id,lesson_id,segment_id,attempt_number,score)
        VALUES ('{learner}','{old_first}','historical-local-fixture',1,80);
        INSERT INTO lesson_v2_runs(user_id,lesson_id,locale,document_version_id,expires_at)
        SELECT '{learner}',lesson_id,locale,id,now()+interval '1 hour' FROM lesson_document_versions WHERE lesson_id='{old_first}' AND locale='en-US';""")
    old_documents = run(f"SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM lesson_document_versions v WHERE lesson_id IN ({old_ids})")
    # A historical KC bridge is distinct from any new teaching competence.
    old_slug = old['tables']['topics'][0]['slug']
    old_key = next(row['key'] for row in graph['kcs'] if row['key'].startswith('life.'))
    run(f"UPDATE kc SET status='active',skill_key='financial-education/{old_slug}' WHERE key={literal(old_key)}")
    old_state = run(f"SELECT jsonb_build_array(id,status) FROM kc WHERE key={literal(old_key)}")
    replacement = (ROOT / 'agent/tools/prepare-financial-catalog-replacement.sql').read_text(encoding='utf-8')
    assert replacement.rstrip().endswith('ROLLBACK;')

    def prepare(actor=boss, persist=False):
        text = replacement.replace(":'actor_id'",literal(actor))
        if persist:
            text = text.rstrip()[:-len('ROLLBACK;')] + 'COMMIT;'
        return run(text)

    for actor, message in [(learner,'authorized content staff actor'),(boss,'never demote a live replacement')]:
        try:
            prepare(actor)
        except RuntimeError as error:
            assert message in str(error), str(error)
        else:
            raise AssertionError(message)
    run(f"SELECT code FROM set_course_status('{boss}','{course}','archived')")
    # An altered archived identity set must be refused before parent/bridge changes.
    run(f"UPDATE lessons SET status='review' WHERE id='{old_first}'")
    try:
        prepare()
    except RuntimeError as error:
        assert 'identities differ' in str(error), str(error)
    else:
        raise AssertionError('Changed archived identity digest accepted')
    run(f"UPDATE lessons SET status='archived' WHERE id='{old_first}'")
    prepare()
    assert run(f"SELECT status FROM courses WHERE id='{course}'") == 'archived'
    assert run(f"SELECT skill_key FROM kc WHERE key={literal(old_key)}") == f'financial-education/{old_slug}'
    check('retirement script refuses wrong actor/live replacement/changed identities; default ROLLBACK preserves state')
    prepare(persist=True)
    prepare(persist=True)
    assert run(f"SELECT status FROM courses WHERE id='{course}'") == 'draft'
    assert run(f"SELECT count(*) FROM lessons WHERE id IN ({old_ids}) AND status='archived'") == '112'
    assert run(f"SELECT count(*) FROM topics WHERE id IN ({old_topics}) AND status<>'archived'") == '0'
    assert run(f"SELECT count(*) FROM sagas WHERE id IN ({old_sagas}) AND status<>'archived'") == '0'
    assert run(f"SELECT count(*) FROM adventures WHERE id IN ({old_adventures}) AND status<>'archived'") == '0'
    assert run(f"SELECT jsonb_build_array(id,status) FROM kc WHERE key={literal(old_key)}") == old_state
    assert run(f"SELECT skill_key IS NULL FROM kc WHERE key={literal(old_key)}") == 't'
    assert run("SELECT count(*) FROM audit_logs WHERE action='content.retired_catalog_prepared'") == '1'
    assert run(f"SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM lesson_document_versions v WHERE lesson_id IN ({old_ids})") == old_documents
    assert run(f"SELECT count(*) FROM lesson_document_version_current WHERE lesson_id IN ({old_ids})") == '336'
    assert run(f"SELECT count(*) FROM lesson_segment_attempts WHERE lesson_id='{old_first}'") == '1'
    assert run(f"SELECT count(*) FROM lesson_v2_runs WHERE lesson_id='{old_first}'") == '1'
    assert run("SELECT (SELECT jsonb_agg(to_jsonb(m) ORDER BY kc_id) FROM learner_kc_mastery m)::text || (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM kc_attempt a)::text") == evidence
    check('actual retirement script archives only old parents, clears stale bridge, preserves112 lessons/KC identity/history; retry is idempotent')
finally:
    sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')

print(json.dumps({'passed': True, 'checks': len(checks), 'limits': 'Owned disposable database; synthetic review/attestation, never production.'}))
