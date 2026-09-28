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

// The section's own names (OD-28 glossary row): the navigation labels and page
// titles of /family-wallet and /wallet carry the Wallet term in every locale.
const CORE_NAV = (wallet, familyCoins, coins) => JSON.stringify({ appShell: { nav: { wallet, familyCoins, coins } } });
const namesGreen = {
  'frontend/src/i18n/en-US/rebuild-core.json': CORE_NAV('Wallet', 'Family wallet', 'Wallet'),
  'frontend/src/i18n/es-MX/rebuild-core.json': CORE_NAV('Cartera', 'Cartera familiar', 'Cartera'),
  'frontend/src/i18n/pt-BR/rebuild-core.json': CORE_NAV('Carteira', 'Carteira da família', 'Carteira'),
  'frontend/src/app-shell/navigation.ts': "export const FAMILY_WALLET_PATH = '/family-wallet';\nconst SLOTS = {\n  coins: { id: 'banking', label: 'coins', path: FAMILY_WALLET_PATH, owner: 'family' },\n  teenWallet: { id: 'wallet', label: 'wallet', path: '/wallet', owner: 'family' },\n};\n",
};

test('the section names that carry the Wallet term stay green', () => {
  assert.deepEqual(run(namesGreen), []);
});

const refusedNames = [
  ['the Tutor tab labelled "Coins"', { 'frontend/src/i18n/en-US/rebuild-core.json': CORE_NAV('Wallet', 'Family wallet', 'Coins') }, /en-US\/rebuild-core.json appShell.nav.coins: names the Wallet section without the glossary term "Coins"/],
  ['a linked teen\'s tab "Monedas de familia"', { 'frontend/src/i18n/es-MX/rebuild-core.json': CORE_NAV('Cartera', 'Monedas de familia', 'Cartera') }, /es-MX\/rebuild-core.json appShell.nav.familyCoins/],
  ['a missing pt-BR label', { 'frontend/src/i18n/pt-BR/rebuild-core.json': JSON.stringify({ appShell: { nav: { wallet: 'Carteira', familyCoins: 'Carteira da família' } } }) }, /pt-BR\/rebuild-core.json appShell.nav.coins: missing/],
  ['a page title "Coins"', { 'frontend/src/i18n/en-US/teenWallet.json': JSON.stringify({ page: { title: 'Coins' } }) }, /en-US\/teenWallet.json page.title: names the Wallet section/],
  ['a Wallet slot on a bank path', { 'frontend/src/app-shell/navigation.ts': "const SLOTS = {\n  coins: { id: 'banking', label: 'coins', path: '/banking', owner: 'family' },\n};\n" }, /the "coins" slot points at "\/banking"/],
];

for (const [name, files, expected] of refusedNames) {
  test(`refuses ${name}`, () => {
    const found = run({ ...namesGreen, ...files });
    assert.equal(found.length, 1, found.join('\n'));
    assert.match(found[0], expected);
  });
}
