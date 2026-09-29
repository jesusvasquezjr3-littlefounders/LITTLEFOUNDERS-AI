"""Shared by the Block D verifiers: replay a slice of the migration chain on a
database that already holds the whole chain, without regressing it.

Re-applying "every migration from X on" is not a sound idempotency test once
the chain holds expand/contract pairs: an expand step that alters a column its
contract step later dropped cannot run a second time (0199 after 0200), and
the migration runner never replays an applied migration anyway. Replaying
only the migrations under test is not sound either: an old CREATE OR REPLACE
would put an older function body, trigger or policy back, and every later
check would test code production no longer runs.

replay_set() returns the migrations under test plus every later migration
that redefines a function, a trigger or a policy any of them defines, closed
transitively, in chain order, so the last definition applied for each object
is the latest one. fingerprint() lists every public function definition,
trigger, policy and API-role privilege, and assert_unchanged() names each one
a replay changed, so a verifier can assert the replay left the schema exactly
as production has it.
"""
import re

OBJECTS = [
    ('fn', re.compile(r'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z_0-9]+)\s*\(', re.IGNORECASE)),
    ('trigger', re.compile(r'CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+([a-z_0-9]+)', re.IGNORECASE)),
    ('trigger', re.compile(r'DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?([a-z_0-9]+)', re.IGNORECASE)),
    ('policy', re.compile(r'CREATE\s+POLICY\s+"?([a-z_0-9]+)"?', re.IGNORECASE)),
    ('policy', re.compile(r'DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"?([a-z_0-9]+)"?', re.IGNORECASE)),
]


def defined_objects(migration):
    text = migration.read_text(encoding='utf-8')
    return {(kind, name.lower()) for kind, pattern in OBJECTS for name in pattern.findall(text)}


def replay_set(migrations, seeds):
    """seeds: the migrations under test. Returns them plus the later redefinitions that keep the chain's latest objects, in chain order."""
    chosen = {m.name for m in seeds}
    defines = {m.name: defined_objects(m) for m in migrations}
    first = min(chosen)
    changed = True
    while changed:
        changed = False
        names = set().union(*(defines[n] for n in chosen))
        for m in migrations:
            if m.name >= first and m.name not in chosen and defines[m.name] & names:
                chosen.add(m.name)
                changed = True
    return [m for m in migrations if m.name in chosen]


SNAPSHOT = """
SELECT 'fn ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f'
UNION ALL
SELECT 'trigger ' || t.tgrelid::regclass::text || '.' || t.tgname || ' ' || t.tgenabled::text || ' ' || md5(pg_get_triggerdef(t.oid))
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
UNION ALL
SELECT 'policy ' || concat_ws('|', tablename, policyname, permissive, roles::text, cmd, md5(coalesce(qual, '')), md5(coalesce(with_check, '')))
FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT 'grant ' || concat_ws('|', table_name, grantee, privilege_type)
FROM information_schema.role_table_grants WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role')
UNION ALL
SELECT 'column-grant ' || concat_ws('|', table_name, column_name, grantee, privilege_type)
FROM information_schema.column_privileges WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role')
UNION ALL
SELECT 'execute ' || concat_ws('|', p.oid::regprocedure::text, r.rolname)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND p.prokind = 'f' AND r.rolname IN ('anon', 'authenticated', 'service_role')
  AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
"""


def fingerprint(sql, database):
    """Every public function body, trigger (and whether it is enabled), policy and API-role privilege, one sorted line each."""
    return '\n'.join(sorted(sql(SNAPSHOT, database).splitlines()))


def assert_unchanged(before, after):
    if after != before:
        was, now = set(before.splitlines()), set(after.splitlines())
        lines = [f'  - {x}' for x in sorted(was - now)] + [f'  + {x}' for x in sorted(now - was)]
        raise AssertionError('the replay changed a function, trigger, policy or grant (a replayed migration regressed the chain):\n'
                             + '\n'.join(lines[:40]))
