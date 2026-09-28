import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkStaffStandingConstraints, mask, topLevelSymbols } from './check-staff-standing-constraints.mjs';

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
