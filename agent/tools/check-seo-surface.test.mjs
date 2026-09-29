import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditSite, auditRoutes, auditBrand, auditAgentText } from './check-seo-surface.mjs';

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
    PAGES: [{ path: '/', index: true, lastmod: '2026-08-26', agentSummary: 'The home page.', meta }],
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
  broken.PAGES.push({ path: '/admin/reports', index: true, lastmod: '2026-08-26', agentSummary: 'x', meta: broken.PAGES[0].meta });
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

test('catches a lastmod that is missing or malformed', () => {
  /*
   * The rule exists because the automatic version was WRONG: derived from a
   * file mtime, which a fresh clone resets, so every deploy claimed every page
   * had changed that day. A hand date that is right beats an automatic one
   * that is not — but only if something checks it is a date at all.
   */
  const broken = fixture();
  delete broken.PAGES[0].lastmod;
  assert.match(auditSite(broken).join('\n'), /has no valid lastmod/);

  const malformed = fixture();
  malformed.PAGES[0].lastmod = '26/08/2026';
  assert.match(auditSite(malformed).join('\n'), /has no valid lastmod/);
});

test('catches a lastmod in the future, which is how the mtime bug would look', () => {
  const broken = fixture();
  broken.PAGES[0].lastmod = '2099-01-01';
  assert.match(auditSite(broken).join('\n'), /lastmod in the future/);
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

// Gap-fix round 2 (Frontend Bible 02 D8): the browser chrome, the manifest and the JSON-LD logo are on the rebuilt tokens.
const tokenSheet = readFileSync(resolve(ROOT, 'frontend/src/rebuild/design/tokens.css'), 'utf8');

test('the real site passes the brand audit', () => {
  assert.deepEqual(auditBrand(site, tokenSheet), []);
});

test('a legacy or invented theme colour fails the brand audit', () => {
  for (const themeColor of ['#4f46e5', '#123456', undefined]) {
    const problems = auditBrand({ SITE: { ...site.SITE, themeColor } }, tokenSheet);
    assert.ok(problems.some((p) => p.includes('themeColor')), String(themeColor));
  }
});

test('a non-token manifest background fails the brand audit', () => {
  const problems = auditBrand({ SITE: { ...site.SITE, manifestBackground: '#0b1120' } }, tokenSheet);
  assert.ok(problems.some((p) => p.includes('manifestBackground')));
});

test('the legacy raster logo as the structured-data logo fails the brand audit', () => {
  const problems = auditBrand({ SITE: { ...site.SITE, logoPath: '/logo-main-trimmed.png' } }, tokenSheet);
  assert.ok(problems.some((p) => p.includes('logoPath')));
});

// GAP-FIX-R4 (OD-6, Bible 02 D10 / section 1.1, rule 16): the rendered llms
// files are what assistants repeat to parents. The brief once said "the tutor
// holds a real conversation" and used em dashes; neither can come back.
const seo = await import(pathToFileURL(resolve(ROOT, 'frontend/scripts/seo/build-seo.mjs')).href);
const EM_DASH = String.fromCharCode(0x2014);

test('the rendered llms.txt and llms-full.txt carry no em dash and never call the AI a tutor, in every locale', () => {
  for (const locale of site.SITE.locales) {
    const brief = seo.renderLlmsTxt(locale);
    const full = seo.renderLlmsFullTxt(locale);
    assert.ok(full.startsWith(brief), 'llms-full.txt opens with the brief');
    for (const [label, text] of [['llms.txt', brief], ['llms-full.txt', full]]) {
      assert.deepEqual(auditAgentText(text, `${label} (${locale})`), []);
      assert.ok(!text.includes(EM_DASH), `${label} (${locale}) has an em dash`);
      assert.ok(!/\btutor/.test(text), `${label} (${locale}) says "tutor"`);
    }
    assert.match(brief, /The Mentor holds a real conversation/);
    for (const name of site.MENTORS) assert.ok(brief.includes(name), `${name} is missing from the brief`);
  }
});

test('the agent-text audit catches an em dash, a lowercase tutor and an AI Tutor', () => {
  assert.deepEqual(auditAgentText('The Mentor answers. A Tutor account links a child.', 'ok'), []);
  const dash = auditAgentText(`Four characters ${EM_DASH} Dina, Zara`, 'x');
  assert.equal(dash.length, 1);
  assert.match(dash[0], /em dash/);
  assert.match(auditAgentText('line one\nand the tutor holds a real conversation', 'x')[0], /^x:2 says "tutor"/);
  assert.ok(auditAgentText('Chat with our AI Tutor', 'x').some((p) => p.includes('calls the AI a Tutor')));
  assert.ok(auditAgentText('Habla con la IA-Tutor', 'x').some((p) => p.includes('calls the AI a Tutor')));
  assert.equal(auditAgentText('the tutors and tutores', 'x').length, 2);
});

// GAP-FIX-R5 (OD-27 (3), OD-18, A.1): the brief promised that "the Tutor can see
// everything their child does" and that parent visibility is "a permanent
// property of the product". A teen's story choices stay private, so the claim
// is refused, and the shipped files are proven to fail when it comes back.
test('the agent-text audit refuses a total-visibility claim, and the shipped brief fails when the old sentence returns', () => {
  const old = 'and the Tutor can see everything their child does, every Mentor conversation included.';
  const found = auditAgentText(old, 'x');
  assert.ok(found.some((p) => p.includes('"see everything"')));
  assert.ok(found.some((p) => p.includes('"everything their child does"')));
  assert.ok(auditAgentText('parent visibility is a permanent property of the product', 'x').some((p) => p.includes('permanent property')));
  assert.deepEqual(auditAgentText('a teen\'s story choices stay private; the Tutor approves what the Mentor remembers', 'x'), []);
  for (const locale of site.SITE.locales) {
    const brief = seo.renderLlmsTxt(locale);
    const full = seo.renderLlmsFullTxt(locale);
    assert.doesNotMatch(brief, /everything their child|permanent property/);
    assert.match(brief, /a teen's story choices stay private/);
    // Mutation: the old sentence put back into what ships is caught in both files.
    for (const [label, text] of [['llms.txt', brief], ['llms-full.txt', full]]) {
      const mutated = text.replace('and children learn inside it.', `and children learn inside it, ${old}`);
      assert.notEqual(mutated, text, `${label} (${locale}) still carries the sentence the mutation replaces`);
      assert.ok(auditAgentText(mutated, label).length >= 2, `${label} (${locale}) mutation not caught`);
    }
  }
});
