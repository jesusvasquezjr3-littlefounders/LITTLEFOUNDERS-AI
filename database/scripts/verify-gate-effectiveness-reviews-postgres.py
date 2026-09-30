"""Gap-fix round 7 learning: every defect escape opens a gate-effectiveness
review that is owned and closes only with a named outcome (Appendix C Part
1.3 "Defect Escape Rate", Part 3 Stage 6, Part 2.1 criterion 4), against real
PostgreSQL.

Runs against an OWNED native PostgreSQL cluster (never the shared Supabase dev
stack): a throwaway database, a minimal Supabase shim, EVERY migration applied
in order (an escape recorded before the gate_effectiveness_reviews migration
proves the backfill), then at the enforcing boundary:

  - an escape always opens a review: through record_content_defect_escape and
    through a direct service-role insert, in the same transaction, naming the
    gate and the owner from forge_release_gates, audited
    'admin.content.gate_review.opened'; escapes recorded before the migration
    are backfilled open; a second review for one escape is refused;
  - record_content_defect_escape and resolve_gate_effectiveness_review refuse
    an actor without manage_content (a learner, an admin holding only
    view_analytics, no actor);
  - a review cannot close without an outcome, a 10-600 character note, and
    (for gate_changed only) the commit or gate version; a resolved review never
    changes, the table CHECK refuses a resolved row without an outcome even
    from the owner, nothing is deleted, and account erasure only nulls
    resolved_by;
  - gate_effectiveness_reviews_open reports each open review's age in days;
  - no browser role reads the table or calls a function.

Configuration: LF_PG_PSQL, LF_PG_PORT, LF_PG_USER, LF_PG_KEEP. Run by
database/scripts/learning-db-verify.mjs.
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
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb, email_change text DEFAULT '',
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

database = 'lf_gate_reviews_' + uuid.uuid4().hex[:12]
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


NOTE = 'The tone lexicon had no entry for this debt idiom.'

try:
    run(SHIM)
    migrations = sorted((ROOT / 'database/migrations').glob('*.sql'))
    target = next(m for m in migrations if m.name.endswith('_gate_effectiveness_reviews.sql'))
    I = {k: str(uuid.uuid4()) for k in ('boss', 'editor', 'analyst', 'learner', 'lesson', 'lesson2', 'old')}
    for migration in migrations:
        if migration == target:
            # An escape recorded under 0218 alone: the migration must backfill its review.
            run(f"""
            INSERT INTO auth.users (id, email) VALUES ('{I['boss']}', 'boss@littlefounders.ai'), ('{I['editor']}', 'editor@littlefounders.ai'),
                ('{I['analyst']}', 'analyst@littlefounders.ai'), ('{I['learner']}', 'learner@example.com');
            INSERT INTO user_roles (user_id, role, granted_by) VALUES ('{I['boss']}', 'superadmin', NULL), ('{I['editor']}', 'admin', '{I['boss']}'),
                ('{I['analyst']}', 'admin', '{I['boss']}');
            INSERT INTO admin_permissions (user_id, permission) VALUES ('{I['editor']}', 'manage_content'), ('{I['analyst']}', 'view_analytics');
            INSERT INTO content_defect_escapes (id, lesson_id, gate_id, defect_kind, reported_by, reported_at)
            VALUES ('{I['old']}', gen_random_uuid(), 'forge.release.locales-complete', 'copy', '{I['editor']}', now() - interval '120 days');
            """)
        try:
            run(migration.read_text(encoding='utf-8'))
        except RuntimeError as error:
            raise RuntimeError(f'{migration.name} failed to apply: {error}') from error
    check(f'all {len(migrations)} migrations apply in order on PostgreSQL {run("SHOW server_version")}')

    old = run(f"SELECT status || '|' || owner_role || '|' || gate_id FROM gate_effectiveness_reviews WHERE escape_id = '{I['old']}'")
    assert old == 'open|content_engineering|forge.release.locales-complete', old
    assert run(f"SELECT age_days FROM gate_effectiveness_reviews_open() WHERE escape_id = '{I['old']}'") == '120'
    check('an escape recorded before the migration is backfilled with an open review, its owner from forge_release_gates, aged from the report')

    owners = run("SELECT owner_role || ':' || count(*) FROM forge_release_gates GROUP BY owner_role ORDER BY owner_role").splitlines()
    assert owners[0] == 'content_engineering:6' and owners[1].startswith('pedagogical_lead:'), owners
    rejected("UPDATE forge_release_gates SET owner_role = 'nobody' WHERE gate_id = 'forge.gate.12.tone'", 'owner_role_check')
    check('every Forge gate names its owner: the six pipeline-completeness checks content engineering, every content gate the Pedagogical Lead')

    # ── An escape always opens a review ──
    escape = service(f"SELECT record_content_defect_escape('{I['lesson']}', 'forge.gate.12.tone', 'pedagogical', '{I['editor']}')")
    review = run(f"SELECT id || '|' || status || '|' || owner_role || '|' || gate_id FROM gate_effectiveness_reviews WHERE escape_id = '{escape}'").split('|')
    assert review[1:] == ['open', 'pedagogical_lead', 'forge.gate.12.tone'], review
    opened = run(f"SELECT actor_id || '|' || (detail ->> 'escape_id') || '|' || (detail ->> 'owner_role') FROM audit_logs WHERE action = 'admin.content.gate_review.opened' AND subject = '{I['lesson']}'")
    assert opened == f"{I['editor']}|{escape}|pedagogical_lead", opened
    direct = service(f"INSERT INTO content_defect_escapes (lesson_id, gate_id, defect_kind, reported_by) VALUES ('{I['lesson2']}', 'forge.release.distinct-scenes', 'regional', '{I['boss']}') RETURNING id")
    assert run(f"SELECT status || '|' || owner_role FROM gate_effectiveness_reviews WHERE escape_id = '{direct}'") == 'open|content_engineering'
    rejected(f"INSERT INTO gate_effectiveness_reviews (escape_id, gate_id, owner_role) VALUES ('{escape}', 'forge.gate.12.tone', 'pedagogical_lead')",
             'gate_effectiveness_reviews_escape_id_key')
    assert run("SELECT count(*) FROM content_defect_escapes e WHERE NOT EXISTS (SELECT 1 FROM gate_effectiveness_reviews r WHERE r.escape_id = e.id)") == '0'
    check('an escape always opens exactly one owned review in its own transaction, through the recorder or a direct insert, audited as opened')

    # ── Non-staff actors are refused ──
    for actor in (I['learner'], I['analyst']):
        rejected(f"SET ROLE service_role; SELECT record_content_defect_escape('{I['lesson']}', 'forge.gate.12.tone', 'copy', '{actor}')", 'FORBIDDEN')
    rejected(f"SET ROLE service_role; SELECT record_content_defect_escape('{I['lesson']}', 'forge.gate.12.tone', 'copy', NULL)", 'FORBIDDEN')
    rid = review[0]
    resolve = lambda actor, outcome, note, ref='NULL', target=rid: service(
        f"SELECT code FROM resolve_gate_effectiveness_review({actor}, '{target}', {outcome}, {note}, {ref})")
    for actor in (f"'{I['learner']}'", f"'{I['analyst']}'", 'NULL'):
        assert resolve(actor, "'lexicon_extended'", f"'{NOTE}'") == 'FORBIDDEN'
    assert run(f"SELECT status FROM gate_effectiveness_reviews WHERE id = '{rid}'") == 'open'
    check('a learner, an admin without manage_content and no actor can neither record an escape nor resolve its review')

    # ── A review cannot close without an outcome ──
    editor = f"'{I['editor']}'"
    assert resolve(editor, 'NULL', f"'{NOTE}'") == 'INVALID_OUTCOME'
    assert resolve(editor, "'fixed_it'", f"'{NOTE}'") == 'INVALID_OUTCOME'
    assert resolve(editor, "'lexicon_extended'", 'NULL') == 'NOTE_REQUIRED'
    assert resolve(editor, "'lexicon_extended'", "'   short  '") == 'NOTE_REQUIRED'
    assert resolve(editor, "'gate_changed'", f"'{NOTE}'") == 'CHANGE_REF_REQUIRED'
    assert resolve(editor, "'gate_changed'", f"'{NOTE}'", "'  '") == 'CHANGE_REF_REQUIRED'
    assert resolve(editor, "'gate_changed'", f"'{NOTE}'", "'-bad ref'") == 'CHANGE_REF_REQUIRED'
    assert resolve(editor, "'accepted_limitation'", f"'{NOTE}'", "'abc1234'") == 'CHANGE_REF_UNEXPECTED'
    assert service(f"SELECT code FROM resolve_gate_effectiveness_review({editor}, gen_random_uuid(), 'lexicon_extended', '{NOTE}', NULL)") == 'NOT_FOUND'
    assert run(f"SELECT status FROM gate_effectiveness_reviews WHERE id = '{rid}'") == 'open'
    assert run("SELECT count(*) FROM audit_logs WHERE action = 'admin.content.gate_review.resolved'") == '0'
    rejected(f"UPDATE gate_effectiveness_reviews SET status = 'resolved', resolved_at = now(), resolution_note = '{NOTE}' WHERE id = '{rid}'",
             'gate_effectiveness_reviews_lifecycle')
    rejected(f"UPDATE gate_effectiveness_reviews SET status = 'resolved', outcome = 'gate_changed', resolved_at = now(), resolution_note = '{NOTE}' WHERE id = '{rid}'",
             'gate_effectiveness_reviews_lifecycle')
    rejected(f"UPDATE gate_effectiveness_reviews SET outcome = 'lexicon_extended' WHERE id = '{rid}'", 'gate_effectiveness_reviews_lifecycle')
    check('a review cannot close without a closed outcome, a 10-600 character note and, for a changed gate only, its commit or version; the table CHECK refuses it even from the owner')

    # ── Resolution ──
    assert resolve(editor, "'gate_changed'", f"'  {NOTE}  '", "'a1b2c3d4e5f6'") == 'RESOLVED'
    row = run(f"SELECT status || '|' || outcome || '|' || gate_change_ref || '|' || resolution_note || '|' || resolved_by FROM gate_effectiveness_reviews WHERE id = '{rid}'")
    assert row == f"resolved|gate_changed|a1b2c3d4e5f6|{NOTE}|{I['editor']}", row
    audit = json.loads(run(f"SELECT detail FROM audit_logs WHERE action = 'admin.content.gate_review.resolved' AND actor_id = '{I['editor']}'"))
    assert audit['outcome'] == 'gate_changed' and audit['gate_change_ref'] == 'a1b2c3d4e5f6' and audit['escape_id'] == escape and audit['owner_role'] == 'pedagogical_lead', audit
    assert resolve(editor, "'lexicon_extended'", f"'{NOTE}'") == 'ALREADY_RESOLVED'
    assert resolve(f"'{I['boss']}'", "'accepted_limitation'", f"'{NOTE}'", target=run(f"SELECT id FROM gate_effectiveness_reviews WHERE escape_id = '{direct}'")) == 'RESOLVED'
    open_ids = run("SELECT escape_id FROM gate_effectiveness_reviews_open()").splitlines()
    assert open_ids == [I['old']], open_ids
    check('staff resolve a review once, audited with its outcome, reference and owner; the open list drops it')

    # ── Append-only ──
    rejected(f"UPDATE gate_effectiveness_reviews SET resolution_note = 'Rewritten after the fact, quietly.' WHERE id = '{rid}'", 'GATE_REVIEW_RESOLVED')
    rejected(f"UPDATE gate_effectiveness_reviews SET status = 'open', outcome = NULL, gate_change_ref = NULL, resolution_note = NULL, resolved_at = NULL, resolved_by = NULL WHERE id = '{rid}'", 'GATE_REVIEW_RESOLVED')
    rejected(f"UPDATE gate_effectiveness_reviews SET owner_role = 'pedagogical_lead' WHERE escape_id = '{I['old']}'", 'GATE_REVIEW_APPEND_ONLY')
    rejected(f"DELETE FROM gate_effectiveness_reviews WHERE id = '{rid}'", 'GATE_REVIEW_APPEND_ONLY')
    rejected(f"DELETE FROM content_defect_escapes WHERE id = '{escape}'", 'gate_effectiveness_reviews_escape_id_fkey')
    run(f"DELETE FROM user_roles WHERE user_id = '{I['editor']}'; DELETE FROM admin_permissions WHERE user_id = '{I['editor']}'; DELETE FROM auth.users WHERE id = '{I['editor']}'")
    assert run(f"SELECT status || '|' || coalesce(resolved_by::text, 'erased') FROM gate_effectiveness_reviews WHERE id = '{rid}'") == 'resolved|erased'
    check('a resolved review never changes and nothing is deleted; erasing the resolver only nulls resolved_by')

    for role in ('anon', 'authenticated'):
        for query in ('SELECT count(*) FROM gate_effectiveness_reviews', 'SELECT count(*) FROM gate_effectiveness_reviews_open()',
                      f"SELECT * FROM resolve_gate_effectiveness_review('{I['boss']}', '{rid}', 'lexicon_extended', '{NOTE}', NULL)",
                      f"SELECT record_content_defect_escape('{I['lesson']}', 'forge.gate.12.tone', 'copy', '{I['boss']}')"):
            rejected(f'SET ROLE {role}; {query}', 'permission denied')
    check('no browser role reads a review, lists the open ones or calls a writer')
    print(f'\n{len(checks)} checks passed on {database}')
finally:
    if os.environ.get('LF_PG_KEEP') != '1':
        sql(f'DROP DATABASE IF EXISTS {database} WITH (FORCE)')

report = {
    'passed': True,
    'source': 'Every migration applied in order on an owned disposable native PostgreSQL database',
    'checks': checks,
    'limits': 'Minimal Supabase shim; not PostgREST or deployed Core.',
}
if os.environ.get('LF_PG_REPORT'):
    Path(os.environ['LF_PG_REPORT']).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'checks': len(checks)}))
