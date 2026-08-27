import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditSite, auditRoutes } from './check-seo-surface.mjs';

/*
 * A gate is only worth what its own tests are worth.
 *
 * `check-seo-surface` guards failures that are invisible from a browser, which
 * means a bug in the GATE is equally invisible — a checker that silently
 * passes everything looks exactly like a clean site. So each rule is proven to
 * fire on a fixture that breaks it, not just to stay quiet on the real one.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

// pathToFileURL, never a bare absolute path: Node's ESM loader takes a URL,
// and on Windows `C:\...` parses as the scheme `c:` -> ERR_UNSUPPORTED_ESM_URL_SCHEME.
// Same family as the `fileURLToPath, never URL.pathname` note in
// database/scripts/check-migrations.mjs, and the reason database/ `npm test`
// could not pass on Windows until 2026-08-23 (RUNBOOK.md).
const site = await import(pathToFileURL(resolve(ROOT, 'frontend/scripts/seo/site.mjs')).href);

/** A minimal valid site, so each test can break exactly one thing. */
function fixture(overrides = {}) {
  const locales = ['en-US', 'es-MX', 'pt-BR'];
  const meta = Object.fromEntries(
    locales.map((id) => [
      id,
      {
        title: 'Financial literacy for kids and teens | LittleFounders',
        description:
          'Kids do not watch lessons here — they make decisions and live the results. Four mentors, a tutor that answers, and real money skills. Free to start.',
        h1: 'Financial learning',
      },
    ]),
  );
  const table = Object.fromEntries(locales.map((id) => [id, 'x']));
  return {
    SITE: {
      origin: 'https://littlefounders.ai',
      name: 'LittleFounders',
      locales,
      languageNames: table,
      ogLocale: table,
    },
    PAGES: [{ path: '/', index: true, agentSummary: 'The home page.', meta }],
    ELEVATOR: table,
    CARD_LINE: table,
    CARD_KICKER: table,
    SUBJECTS: table,
    DISALLOWED_PREFIXES: ['/admin'],
    NOINDEX_PREFIXES: ['/signup'],
    ...overrides,
  };
}

test('the real site passes its own audit', () => {
  assert.deepEqual(auditSite(site), []);
});

test('the real site agrees with the app about which routes are marketing', () => {
  const source = readFileSync(resolve(ROOT, 'frontend/src/lib/analytics.tsx'), 'utf8');
  assert.deepEqual(auditRoutes(site, source), []);
});

test('every indexable page appears in llms.txt, or the agent surface is silently incomplete', () => {
  const missing = site.PAGES.filter((page) => page.index && !page.agentSummary);
  assert.deepEqual(missing, [], 'an indexable page with no agentSummary is invisible to llms.txt');
});

test('catches a page the sitemap advertises and robots.txt forbids', () => {
  // The own-goal: told to index a URL it may never fetch, a crawler can see
  // neither the content nor a noindex, and lists a bare title forever.
  const broken = fixture();
  broken.PAGES.push({ path: '/admin/reports', index: true, agentSummary: 'x', meta: broken.PAGES[0].meta });
  assert.match(auditSite(broken).join('\n'), /robots\.txt disallows "\/admin"/);
});

test('catches a title long enough for the brand to be truncated away', () => {
  const broken = fixture();
  broken.PAGES[0].meta['es-MX'].title = `${'A'.repeat(80)} | LittleFounders`;
  assert.match(auditSite(broken).join('\n'), /title is 97 chars/);
});

test('catches a description too short to survive as a snippet', () => {
  const broken = fixture();
  broken.PAGES[0].meta['pt-BR'].description = 'Curto demais.';
  assert.match(auditSite(broken).join('\n'), /description is 13 chars/);
});

test('catches a locale left behind', () => {
  const broken = fixture();
  delete broken.PAGES[0].meta['pt-BR'];
  delete broken.ELEVATOR['pt-BR'];
  const report = auditSite(broken).join('\n');
  assert.match(report, /has no pt-BR metadata/);
  assert.match(report, /ELEVATOR has no entry for pt-BR/);
});

test('catches a title that forgot the brand', () => {
  const broken = fixture();
  broken.PAGES[0].meta['en-US'].title = 'Financial literacy for kids and teens';
  assert.match(auditSite(broken).join('\n'), /does not carry the brand name/);
});

test('catches a marketing route the app has and search was never told about', () => {
  const source = "const MARKETING_PREFIXES = ['/', '/how-it-works', '/families', '/faq', '/legal', '/pricing'];";
  assert.match(auditRoutes(site, source).join('\n'), /'\/pricing' is a marketing route in the app/);
});

test('catches a sitemap entry the app does not route, which would advertise a 404', () => {
  const source = "const MARKETING_PREFIXES = ['/', '/how-it-works', '/families', '/faq'];";
  assert.match(auditRoutes(site, source).join('\n'), /'\/legal' is declared for search but is not a marketing route/);
});

test('every AI crawler named in robots.txt is a real, distinct token', () => {
  // A typo here is a silent no-op: the crawler simply falls through to the
  // `*` block, and nothing anywhere reports that the rule never matched.
  const seen = new Set();
  for (const agent of [...site.SEARCH_CRAWLERS, ...site.AI_CRAWLERS]) {
    assert.match(agent, /^[A-Za-z][A-Za-z0-9._-]*$/, `"${agent}" is not a valid user-agent token`);
    assert.ok(!seen.has(agent), `"${agent}" is listed twice`);
    seen.add(agent);
  }
  assert.ok(site.AI_CRAWLERS.length >= 10, 'the AI crawler allowlist looks truncated');
});

test('the share card exists for every locale it is offered in', () => {
  for (const locale of site.SITE.locales) {
    assert.ok(site.CARD_LINE[locale], `no share-card line for ${locale}`);
  }
});
