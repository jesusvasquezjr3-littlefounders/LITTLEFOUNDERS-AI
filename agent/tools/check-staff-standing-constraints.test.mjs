import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { checkIncidentResponsePlan, checkStaffStandingConstraints, incidentPlanFailures, mask, topLevelSymbols } from './check-staff-standing-constraints.mjs';

/*
 * G.6 / Appendix N 1.3: the gate must SEE a planted violation, not only pass
 * on the real tree. Each fixture is a minimal backend with a staff router.
 */

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'staff-constraints-'));
  for (const [path, content] of Object.entries({
    'backend/src/services/supabaseRest.ts': "export function serviceRest(path: string) { return fetch(path); }\n",
    ...files,
  })) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const ROUTER = (body, imports = '') => `import { Router } from 'express';\n${imports}\nexport function adminRouter() {\n  const router = Router();\n${body}\n  return router;\n}\n`;

test('the real repository passes', () => {
  assert.deepEqual(checkStaffStandingConstraints(), []);
});

test('a staff route that reads Mentor transcripts two calls deep is caught with its path', () => {
  const root = fixture({
    'backend/src/routes/admin.ts': ROUTER("  router.get('/sessions', async (_req, res) => res.json(await loadSession()));", "import { loadSession } from '../services/tutorView.js';"),
    'backend/src/services/tutorView.ts': "import { serviceRest } from './supabaseRest.js';\n/** tutor_turns in a comment is not a read */\nexport async function loadSession() { return turnsOf('x'); }\nfunction turnsOf(id: string) { return serviceRest(`/tutor_turns?session_id=eq.${id}`); }\nexport function unrelated() { return serviceRest('/wallet_ledger?select=*'); }\n",
  });
  const failures = checkStaffStandingConstraints(root);
  assert.equal(failures.length, 1, failures.join('\n'));
  assert.match(failures[0], /tutorView\.ts#turnsOf reaches the tutor_turns transcript table/);
  assert.match(failures[0], /admin\.ts -> backend\/src\/services\/tutorView\.ts#loadSession -> backend\/src\/services\/tutorView\.ts#turnsOf/);
});

test('a staff route that reads a per-account wallet table or an Oracle transcript endpoint is caught', () => {
  const root = fixture({
    'backend/src/routes/admin.ts': ROUTER("  router.get('/ledger', async (_req, res) => res.json(await serviceRest('/wallet_ledger?kid_user_id=eq.1')));\n  router.get('/t', async (_req, res) => res.json(await fetch(`${ORACLE}/internal/v1/sessions/1/transcript`)));",
      "import { serviceRest } from '../services/supabaseRest.js';\nconst ORACLE = 'http://oracle';"),
  });
  const failures = checkStaffStandingConstraints(root).join('\n');
  assert.match(failures, /a wallet\/banking table \(wallet_ledger/);
  assert.match(failures, /a transcript endpoint/);
});

test('an allowlist entry needs an owner decision', () => {
  const root = fixture({
    'backend/src/routes/admin.ts': ROUTER("  router.get('/ledger', async (_req, res) => res.json(await readLedger()));", "import { readLedger } from '../services/ledger.js';"),
    'backend/src/services/ledger.ts': "import { serviceRest } from './supabaseRest.js';\nexport function readLedger() { return serviceRest('/wallet_ledger?select=id'); }\n",
  });
  assert.equal(checkStaffStandingConstraints(root, { allowlist: [{ symbol: 'backend/src/services/ledger.ts#readLedger', decision: 'OD-99', why: 'scoped review' }] }).length, 0);
  const unjustified = checkStaffStandingConstraints(root, { allowlist: [{ symbol: 'backend/src/services/ledger.ts#readLedger', decision: 'because', why: 'x' }] });
  assert.ok(unjustified.some((f) => /cites no owner decision/.test(f)));
  assert.ok(unjustified.some((f) => /wallet_ledger/.test(f)));
});

test('impersonation routes, fields and identifiers fail; the report category value does not', () => {
  const root = fixture({
    'backend/src/routes/admin.ts': ROUTER("  router.post('/users/:id/impersonate', (_req, res) => res.end());\n  const Body = z.object({ loginAs: z.string() });\n  const CATEGORIES = ['harassment', 'impersonation'];"),
    'backend/src/services/sudo.ts': 'export function actAsUser() { return 1; }\n',
  });
  const failures = checkStaffStandingConstraints(root).join('\n');
  assert.match(failures, /route "\/users\/:id\/impersonate"/);
  assert.match(failures, /request field "loginAs"/);
  assert.match(failures, /identifier "actAsUser"/);
  assert.doesNotMatch(failures, /CATEGORIES/);
});

test('minting a session or a sign-in link for another account fails', () => {
  const root = fixture({
    'backend/src/routes/admin.ts': ROUTER(''),
    'backend/src/services/gotrue.ts': "export function link(email: string) { return fetch('/admin/generate_link', { method: 'POST', body: email }); }\n",
  });
  assert.match(checkStaffStandingConstraints(root).join('\n'), /GoTrue generate_link/);
});

test('the lexer ignores comments and regex literals, and finds functions with object return types', () => {
  const src = "// router.get('/impersonate')\nconst re = /['\"]/g;\nexport async function f(a: string): Promise<{ x: number } | null> { return { x: 1 }; }\nexport const g = (b: number) => { return b; };\n";
  assert.doesNotMatch(mask(src), /impersonate/);
  const symbols = topLevelSymbols(src);
  assert.deepEqual([...symbols.keys()], ['re', 'f', 'g']);
  const [start, end] = symbols.get('f');
  assert.ok(src.slice(start, end).trimEnd().endsWith('}'));
});

// H.5 (b) / Appendix O 1.2: the incident-response plan names its internal
// chain and is reviewed on a cadence. The gate must SEE each planted gap.
const REAL_GOVERNANCE = readFileSync(new URL('../../docs/operations/GOVERNANCE.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const REVIEWED = /Last reviewed: (\d{4}-\d{2}-\d{2})/.exec(REAL_GOVERNANCE)[1];
const dayAfter = (iso, days) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000);

test('the real incident-response plan passes on the day it was reviewed and 366 days later', () => {
  // The real tree is checked against today by `npm run spec:check`; here the clock is pinned.
  assert.deepEqual(checkIncidentResponsePlan(undefined, dayAfter(REVIEWED, 30)), []);
  assert.deepEqual(incidentPlanFailures(REAL_GOVERNANCE, dayAfter(REVIEWED, 0)), []);
  assert.deepEqual(incidentPlanFailures(REAL_GOVERNANCE, dayAfter(REVIEWED, 366)), []);
});

test('a plan last reviewed more than 366 days ago, or in the future, fails', () => {
  assert.match(incidentPlanFailures(REAL_GOVERNANCE, dayAfter(REVIEWED, 367)).join('\n'), /last reviewed 367 days ago/);
  assert.match(incidentPlanFailures(REAL_GOVERNANCE, dayAfter(REVIEWED, -1)).join('\n'), /is in the future/);
  const bogus = REAL_GOVERNANCE.replace(`Last reviewed: ${REVIEWED}`, 'Last reviewed: 2026-02-30');
  assert.match(incidentPlanFailures(bogus, dayAfter(REVIEWED, 0)).join('\n'), /not a real date/);
});

test('a plan without the chain, a role, a channel, a time limit, the cadence or the date fails', () => {
  const at = dayAfter(REVIEWED, 0);
  const failures = (text) => incidentPlanFailures(text, at).join('\n');
  assert.match(failures(REAL_GOVERNANCE.replace('**Internal notification chain.**', '**Who we tell.**')), /no "Internal notification chain"/);
  assert.match(failures(REAL_GOVERNANCE.replace(/^ {2}4\. \*\*Legal\*\*:/m, '  4. **Counsel**:')), /must name, in order, Owner, Engineering lead, Safety\/Trust lead, Legal/);
  assert.match(failures(REAL_GOVERNANCE.replace(/(\*\*Safety\/Trust lead\*\*: within 4 hours of discovery), by direct message\s+plus the `ops-watchdog` issue;/, '$1;')), /Safety\/Trust lead step names no channel/);
  assert.match(failures(REAL_GOVERNANCE.replace('**Engineering lead**: within 1 hour of discovery', '**Engineering lead**: promptly')), /Engineering lead step has no time limit/);
  assert.match(failures(REAL_GOVERNANCE.replace('**Plan review.**', '**Plan.**')), /no "Plan review" cadence/);
  assert.match(failures(REAL_GOVERNANCE.replace('at least once\n  a year', 'now and then')), /must be at least annual/);
  assert.match(failures(REAL_GOVERNANCE.replace('and again after every actual\n  incident', 'and whenever convenient')), /must also follow every actual incident/);
  assert.match(failures(REAL_GOVERNANCE.replace(/Last reviewed: \d{4}-\d{2}-\d{2}/, 'Reviewed recently')), /no "Last reviewed: YYYY-MM-DD" line/);
  assert.match(failures(REAL_GOVERNANCE.replace('## 5. Incident response', '## 5. Backups')), /no "## 5\. Incident response" section/);
});
