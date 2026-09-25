import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * check-account-deletion.mjs — the standing guardrail for Product 10 E.6
 * (Block E standard, component 5: a self-service account-deletion path is a
 * locked-in product constraint, re-reviewed before it changes, never a silent
 * default a future team can quietly remove).
 *
 * Service suites pin behaviour inside each package; this gate pins the facts
 * that span packages and documents:
 *
 *   1. The self-service path exists: Core mounts /api/v1/account and the
 *      internal sweep, the request body demands the explicit acknowledgement,
 *      and a parent-created child and staff are refused there.
 *   2. Every deletion path runs through the one lifecycle: no Core code calls
 *      GoTrue's user delete except the audited rollback of a half-created
 *      child account, and the Tutor's delete-a-child route and A.1's 90-day
 *      purge both call eraseNow.
 *   3. The cascade is complete: the four steps Core runs (oracle, core,
 *      depot, dataintel) are the four complete_account_deletion requires, and
 *      Oracle and the warehouse each expose their erasure endpoint.
 *   4. The stated timeline agrees everywhere: the grace period and the SLA in
 *      Core equal the written policy, and the public FAQ in all three locales
 *      states the grace period instead of "contact us".
 *   5. The daily sweep workflow exists and calls the sweep route.
 *   6. No table can block an erasure: every foreign key to an account
 *      (auth.users or profiles) ends with ON DELETE CASCADE or SET NULL.
 */

function read(root, path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
}

export function checkAccountDeletion(root) {
  const failures = [];

  // 1. The self-service path exists.
  const app = read(root, 'backend/src/app.ts');
  if (!/app\.use\('\/api\/v1\/account', accountRouter\(\)\)/.test(app)) failures.push('backend/src/app.ts: /api/v1/account (self-service deletion) is not mounted');
  if (!/app\.use\('\/api\/v1\/internal\/account-deletions', accountDeletionSweepRouter\(\)\)/.test(app)) failures.push('backend/src/app.ts: the account-deletion sweep is not mounted');
  const route = read(root, 'backend/src/routes/account.ts');
  if (!/acknowledge: z\.literal\(true\)/.test(route) || !/\}\)\s*\.strict\(\)/.test(route)) failures.push('backend/src/routes/account.ts: the request must demand acknowledge:true in a .strict() body');
  if (!/roles\.includes\('kid'\)\) return \{ allowed: false, reason: 'kid' \}/.test(route) || !/fail\(res, 403, 'KID_DELETION_BY_TUTOR'/.test(route)) failures.push('backend/src/routes/account.ts: a parent-created child must be refused (its Tutor deletes it)');
  if (!/roles\.includes\('superadmin'\)\) return \{ allowed: false, reason: 'staff' \}/.test(route)) failures.push('backend/src/routes/account.ts: staff must be refused (a superadmin removes staff accounts)');

  // 2. One lifecycle for every deletion path.
  for (const file of walk(resolve(root, 'backend/src')).filter((f) => f.endsWith('.ts') && !/[\\/]__tests__[\\/]/.test(f))) {
    const source = readFileSync(file, 'utf8');
    const name = relative(root, file).replaceAll('\\', '/');
    for (const match of source.matchAll(/adminDeleteUser\(/g)) {
      if (name === 'backend/src/services/gotrue.ts') continue;
      const after = source.slice(match.index, match.index + 400);
      if (!after.includes("'family.kid_create.rolled_back'")) {
        failures.push(`${name}: deletes an account through GoTrue directly; every deletion goes through the E.6 erasure lifecycle (eraseNow / runAccountErasure)`);
      }
    }
  }
  const family = read(root, 'backend/src/routes/family.ts');
  const kidDelete = family.slice(family.indexOf("router.delete('/kids/:kidId'"), family.indexOf("router.delete('/kids/:kidId'") + 2000);
  if (!/eraseNow\(/.test(kidDelete)) failures.push('backend/src/routes/family.ts: a Tutor deleting a child must use the erasure lifecycle (eraseNow)');
  if (!/eraseNow\(/.test(read(root, 'backend/src/services/guardianLifecycle.ts'))) failures.push('backend/src/services/guardianLifecycle.ts: the A.1 90-day purge must use the erasure lifecycle (eraseNow)');

  // 3. The cascade is complete.
  const lifecycle = read(root, 'backend/src/services/accountDeletion.ts');
  const coreSteps = /type StepName = ([^;]+);/.exec(lifecycle)?.[1]?.match(/'([a-z]+)'/g)?.map((s) => s.slice(1, -1)).sort() ?? [];
  const migrations = readdirSync(resolve(root, 'database/migrations')).filter((f) => f.endsWith('.sql')).map((f) => read(root, `database/migrations/${f}`));
  const required = migrations.map((sql) => /steps \?& ARRAY\[([^\]]+)\]/.exec(sql)?.[1]).find(Boolean)?.match(/'([a-z]+)'/g)?.map((s) => s.slice(1, -1)).sort() ?? [];
  if (required.length === 0) failures.push('database/migrations: complete_account_deletion must require every erasure step');
  else if (JSON.stringify(coreSteps) !== JSON.stringify(required)) failures.push(`erasure steps disagree: Core runs [${coreSteps}], completion requires [${required}]`);
  for (const step of ['oracle', 'core', 'depot', 'dataintel']) {
    if (!coreSteps.includes(step)) failures.push(`backend/src/services/accountDeletion.ts: the ${step} erasure step is missing`);
  }
  if (!migrations.some((sql) => /CREATE OR REPLACE FUNCTION public\.erase_account_data/.test(sql) && /DELETE FROM public\.learner_memory_ledger/.test(sql))) {
    failures.push('database/migrations: erase_account_data must remove the Mentor memory ledger (no foreign key cascades it)');
  }
  if (!/router\.post\('\/erasure'/.test(read(root, 'oracle/src/routes/erasure.ts'))) failures.push('oracle/src/routes/erasure.ts: Oracle must expose POST /erasure');
  if (!/app\.use\('\/api\/v1\/tutor', erasureRouter\(\)\)/.test(read(root, 'oracle/src/app.ts'))) failures.push('oracle/src/app.ts: the erasure route is not mounted behind the internal key');
  if (!/router\.post\('\/erasure'/.test(read(root, 'dataintel/src/routes/queries.ts'))) failures.push('dataintel/src/routes/queries.ts: the warehouse must expose POST /erasure');

  // 4. The stated timeline agrees everywhere.
  const grace = Number(/export const ACCOUNT_DELETION_GRACE_DAYS = (\d+);/.exec(lifecycle)?.[1]);
  const sla = Number(/export const ACCOUNT_DELETION_SLA_HOURS = (\d+);/.exec(lifecycle)?.[1]);
  const policy = read(root, 'docs/rebuild/policies/ACCOUNT-DELETION.md');
  if (!Number.isInteger(grace) || !policy.includes(`${grace}-day grace period`)) failures.push(`docs/rebuild/policies/ACCOUNT-DELETION.md: must state the ${grace}-day grace period Core enforces`);
  if (!Number.isInteger(sla) || !policy.includes(`within ${sla} hours`)) failures.push(`docs/rebuild/policies/ACCOUNT-DELETION.md: must state the ${sla}-hour completion SLA Core measures`);
  if (!/Standing constraint/i.test(policy)) failures.push('docs/rebuild/policies/ACCOUNT-DELETION.md: must record self-service deletion as a standing constraint');
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) {
    const faq = JSON.parse(read(root, `frontend/src/i18n/${locale}/marketing.json`));
    const answer = String(findKey(faq, 'deleteAccount')?.answer ?? '');
    if (!answer.includes(String(grace))) failures.push(`frontend/src/i18n/${locale}/marketing.json: the deletion FAQ must state the ${grace}-day timeline`);
    if (/contact us|nos escribes|nos escreve/i.test(answer)) failures.push(`frontend/src/i18n/${locale}/marketing.json: the deletion FAQ still sends people to "contact us"`);
    // Signing in alone keeps nothing: it opens the deletion screen, and only
    // "Keep account" cancels. The public answer must name that step.
    const keep = { 'en-US': /\bkeep\b/i, 'es-MX': /\bconserv/i, 'pt-BR': /\bmant(?:enha|er)\b/i }[locale];
    if (!keep.test(answer)) failures.push(`frontend/src/i18n/${locale}/marketing.json: the deletion FAQ must say the account is kept only by choosing to keep it, not by signing in`);
    // The marketing Copy Budget the FAQ audit applies: at most 25 words and
    // two sentences (x1.25 words for es-MX and pt-BR).
    const words = (answer.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
    const sentences = (answer.match(/[.!?](\s|$)/g) ?? []).length;
    const limit = Math.floor(25 * (locale === 'en-US' ? 1 : 1.25));
    if (words > limit || sentences > 2) failures.push(`frontend/src/i18n/${locale}/marketing.json: the deletion FAQ answer is over the Copy Budget (${words}/${limit} words, ${sentences}/2 sentences)`);
  }

  // 5. The sweep runs.
  const workflow = read(root, '.github/workflows/account-deletion.yml');
  if (!/schedule:\s*\n\s*- cron:/.test(workflow) || !workflow.includes('/api/v1/internal/account-deletions/run')) {
    failures.push('.github/workflows/account-deletion.yml: the daily sweep must be scheduled and call the sweep route');
  }

  // 6. No table can block an erasure.
  failures.push(...accountForeignKeyFailures(root));

  return failures;
}

/*
 * 6. Every column that points at an account lets go of it. The erasure ends
 * by deleting the auth.users row; a foreign key with NO ACTION or RESTRICT
 * on any table makes that delete fail, so that account can never be erased.
 * S08.5 found eight such columns (0114 re-declares them ON DELETE SET NULL).
 * A table added later, by any lane, must cascade or set null too.
 *
 * Every declaration of `REFERENCES auth.users` or `REFERENCES profiles` in
 * the migrations is read in apply order. For each table and column, the
 * last declaration wins: a later ALTER that re-declares the key with a
 * delete action fixes an earlier one.
 */
export function accountForeignKeyFailures(root) {
  const dir = resolve(root, 'database/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const last = new Map();
  const name = (raw) => raw.replaceAll('"', '').replace(/\s/g, '').replace(/^public\./i, '').toLowerCase();
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/--[^\n]*/g, '');
    const events = [
      ...[...sql.matchAll(/\balter\s+table(?:\s+if\s+exists)?(?:\s+only)?\s+("?\w+"?(?:\s*\.\s*"?\w+"?)?)\s+rename\s+to\s+("?\w+"?)/gi)]
        .map((m) => ({ index: m.index, rename: [name(m[1]), name(m[2])] })),
      ...[...sql.matchAll(/\breferences\s+("?auth"?\s*\.\s*"?users"?|(?:"?public"?\s*\.\s*)?"?profiles"?)\b/gi)]
        .map((m) => ({ index: m.index, match: m })),
    ].sort((a, b) => a.index - b.index);
    for (const event of events) {
      if (event.rename) {
        // A renamed table keeps its constraints (0082 renames banca_accounts).
        const [from, to] = event.rename;
        for (const [key, value] of [...last]) {
          if (key.startsWith(`${from}.`)) {
            last.delete(key);
            last.set(`${to}.${key.slice(from.length + 1)}`, value);
          }
        }
        continue;
      }
      const match = event.match;
      const rest = sql.slice(match.index);
      const clause = rest.slice(0, rest.search(/[,;]|$/));
      const allowed = /\bon\s+delete\s+(cascade|set\s+null)\b/i.test(clause);
      const before = sql.slice(0, match.index);
      const line = before.slice(before.lastIndexOf('\n') + 1);
      const column = (/foreign\s+key\s*\(\s*"?(\w+)"?\s*\)\s*$/i.exec(before.slice(-200))
        ?? /(?:^|[,(]|\badd\s+column(?:\s+if\s+not\s+exists)?)\s*"?(\w+)"?\s+uuid\b[^,]*$/i.exec(line))?.[1]?.toLowerCase() ?? '?';
      const tables = [...before.matchAll(/\b(?:create\s+table(?:\s+if\s+not\s+exists)?|alter\s+table(?:\s+only)?(?:\s+if\s+exists)?)\s+("?[\w]+"?(?:\s*\.\s*"?[\w]+"?)?)/gi)];
      const table = name(tables.at(-1)?.[1] ?? '?');
      last.set(`${table}.${column}`, { file, allowed });
    }
  }
  const failures = [];
  for (const [key, { file, allowed }] of last) {
    if (!allowed) {
      failures.push(`database/migrations/${file}: ${key} references an account without ON DELETE CASCADE or SET NULL; erasing that account would fail (E.6 one lifecycle)`);
    }
  }
  return failures;
}

function findKey(value, key) {
  if (!value || typeof value !== 'object') return null;
  if (key in value) return value[key];
  for (const child of Object.values(value)) {
    const found = findKey(child, key);
    if (found) return found;
  }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const failures = checkAccountDeletion(root);
  if (failures.length) {
    console.error('account-deletion check FAILED:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log('account-deletion check OK: self-service path, one lifecycle, four-step cascade, stated timeline, daily sweep, no foreign key that blocks an erasure');
}
