// Mutation tests for check-wallet-glossary.mjs (OD-28, H-16): each case plants
// the retired section name in one place a person reads and expects the gate to
// refuse it; the allowed populations (history, rename notes, comments, routes,
// the "not a bank account" disclaimer) must stay green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkWalletGlossary, copyViolation } from './check-wallet-glossary.mjs';

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'wallet-glossary-'));
  const base = {
    'frontend/package.json': '{}',
    'frontend/src/i18n/en-US/common.json': JSON.stringify({ banking: { title: 'Wallet', note: 'Coins stay in the app, not in a bank account.' } }),
    'frontend/src/i18n/es-MX/common.json': JSON.stringify({ banking: { title: 'Cartera' } }),
    'frontend/src/i18n/pt-BR/common.json': JSON.stringify({ banking: { title: 'Carteira' } }),
    'frontend/src/rebuild/banking/api.ts': "// Wallet, formerly Digital Banking\nexport const path = '/banking/overview';\n",
    'backend/package.json': '{}',
    'backend/src/routes/banking.ts': "/* the Digital Banking routes (history) */\nexport const audit = 'banking.frozen';\n",
    'docs/rebuild/sprints/S07.md': 'Digital Banking is kept as the section name.\n',
    'docs/littlefounders-spec/product/13-OWNER-DECISION-LOG.md': 'Digital Banking is renamed Wallet.\n',
    'docs/operations/NOTE.md': 'The Wallet (formerly Digital Banking, OD-28).\n',
  };
  for (const [path, text] of Object.entries({ ...base, ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

function run(files) {
  const root = fixture(files);
  try { return checkWalletGlossary(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('the allowed populations stay green', () => {
  assert.deepEqual(run({}), []);
});

test('the real repository names the money section Wallet everywhere', () => {
  assert.deepEqual(checkWalletGlossary(), []);
});

const refused = [
  ['an en-US title', { 'frontend/src/i18n/en-US/common.json': JSON.stringify({ banking: { title: 'Digital Banking' } }) }, /en-US\/common.json banking.title: retired name/],
  ['an es-MX nested sentence', { 'frontend/src/i18n/es-MX/common.json': JSON.stringify({ kid: { link: ['Ver tu cuenta de Banca Digital'] } }) }, /es-MX\/common.json kid.link\[0\]/],
  ['a pt-BR new namespace', { 'frontend/src/i18n/pt-BR/new.json': JSON.stringify({ t: 'Banco Digital' }) }, /pt-BR\/new.json t: retired name/],
  ['an es-MX "monedero"', { 'frontend/src/i18n/es-MX/common.json': JSON.stringify({ t: 'Mi monedero' }) }, /glossary synonym/],
  ['an es-MX "billetera"', { 'frontend/src/i18n/es-MX/common.json': JSON.stringify({ t: 'Tu billetera' }) }, /glossary synonym/],
  ['a pt-BR "carteira digital"', { 'frontend/src/i18n/pt-BR/common.json': JSON.stringify({ t: 'Sua carteira digital' }) }, /glossary synonym/],
  ['a bare navigation label', { 'frontend/src/i18n/en-US/dashboard.json': JSON.stringify({ nav: { banking: 'Banking' } }) }, /bare banking label/],
  ['an inline SPA string', { 'frontend/src/rebuild/banking/Title.tsx': "export const t = <h1>Digital Banking</h1>;\n" }, /Title.tsx:1: retired name in a string/],
  ['a backend notification string', { 'backend/src/services/notify.ts': "export const subject = 'Your Banca Digital card';\n" }, /notify.ts:1: retired name/],
  ['another service (email server)', { 'email-server/package.json': '{}', 'email-server/src/send.ts': "const s = `Open Banco Digital`;\n" }, /email-server\/src\/send.ts:1/],
  ['an SEO script', { 'frontend/scripts/seo/site.mjs': "export const summary = 'simulated Digital Banking';\n" }, /seo\/site.mjs:1/],
  ['a public email template', { 'frontend/public/email-templates/invite.html': '<p>Digital Banking</p>\n' }, /invite.html:1: retired name in a public file/],
  ['a living doc', { 'docs/operations/NEW.md': '# Digital Banking controls\n' }, /docs\/operations\/NEW.md:1: retired name in a doc/],
  ['the README', { 'README.md': 'The Digital Banking service.\n' }, /README.md:1/],
];

for (const [name, files, expected] of refused) {
  test(`refuses the retired name in ${name}`, () => {
    const found = run(files);
    assert.equal(found.length, 1, found.join('\n'));
    assert.match(found[0], expected);
  });
}

test('the disclaimer and unrelated bank words are not the section name', () => {
  assert.equal(copyViolation('en-US', 'Is this a real bank account?'), null);
  assert.equal(copyViolation('es-MX', 'Banco de respuestas'), null);
  assert.equal(copyViolation('pt-BR', 'Não é uma taxa de juros bancária.'), null);
  assert.equal(copyViolation('en-US', 'Word bank'), null);
});
