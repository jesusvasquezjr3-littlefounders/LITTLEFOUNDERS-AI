#!/usr/bin/env node
/*
 * The public surface, checked for the mistakes that are invisible from inside.
 *
 * SEO fails silently. A title nobody notices is thirty characters too long, a
 * page is both listed in the sitemap and forbidden in robots.txt, a locale is
 * missing a description and quietly falls back to English — and everything
 * still builds, still deploys, and still renders perfectly to the one person
 * who checks it in a browser. The cost lands weeks later as traffic that never
 * arrived, which is the hardest kind of defect to attribute.
 *
 * So the rules that are usually left to a person's memory are asserted here.
 * Every one of these has a named consequence; none is a style preference.
 *
 * Run: npm run seo:check      Tested by: check-seo-surface.test.mjs
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SITE_MODULE = resolve(ROOT, 'frontend/scripts/seo/site.mjs');
const ANALYTICS = resolve(ROOT, 'frontend/src/lib/analytics.tsx');

/*
 * Google truncates a title at roughly 580 CSS pixels, which lands near 60
 * characters for a mixed-case Latin string. Past that the brand at the end is
 * the part that disappears, so a long title costs exactly the recognition a
 * new brand is trying to build. 15 is the floor at which a title is carrying
 * no keyword at all.
 */
const TITLE_MAX = 65;
const TITLE_MIN = 15;

/*
 * A description under ~70 characters gets replaced by whatever Google scrapes
 * off the page, so the positioning is lost; over ~165 it is cut mid-sentence,
 * which reads as carelessness in the one sentence a stranger will judge us on.
 */
const DESC_MIN = 70;
const DESC_MAX = 170;

export function auditSite(site) {
  const problems = [];
  const { SITE, PAGES, ELEVATOR, CARD_LINE, CARD_KICKER, SUBJECTS, DISALLOWED_PREFIXES, NOINDEX_PREFIXES } = site;

  const locales = SITE.locales;

  // Every localised block must cover every locale. A missing one is not an
  // error at runtime — it silently serves English to a Spanish reader.
  for (const [name, table] of [['ELEVATOR', ELEVATOR], ['CARD_LINE', CARD_LINE], ['CARD_KICKER', CARD_KICKER], ['SUBJECTS', SUBJECTS], ['languageNames', SITE.languageNames], ['ogLocale', SITE.ogLocale]]) {
    for (const locale of locales) {
      if (!table[locale]) problems.push(`${name} has no entry for ${locale}.`);
    }
  }

  const seen = new Set();
  for (const page of PAGES) {
    if (seen.has(page.path)) problems.push(`Duplicate page declared: ${page.path}`);
    seen.add(page.path);

    if (!page.path.startsWith('/')) problems.push(`Page path must be site-absolute: ${page.path}`);

    for (const locale of locales) {
      const meta = page.meta[locale];
      if (!meta) {
        problems.push(`${page.path} has no ${locale} metadata.`);
        continue;
      }
      for (const field of ['title', 'description', 'h1']) {
        if (!meta[field]?.trim()) problems.push(`${page.path} [${locale}] is missing ${field}.`);
      }
      if (meta.title && (meta.title.length > TITLE_MAX || meta.title.length < TITLE_MIN)) {
        problems.push(
          `${page.path} [${locale}] title is ${meta.title.length} chars (want ${TITLE_MIN}-${TITLE_MAX}): "${meta.title}"`,
        );
      }
      // Only indexable pages are held to the description length: a noindex
      // placeholder has no snippet to lose.
      if (page.index && meta.description && (meta.description.length > DESC_MAX || meta.description.length < DESC_MIN)) {
        problems.push(
          `${page.path} [${locale}] description is ${meta.description.length} chars (want ${DESC_MIN}-${DESC_MAX}).`,
        );
      }
      if (meta.title && !meta.title.includes(SITE.name)) {
        problems.push(`${page.path} [${locale}] title does not carry the brand name.`);
      }
    }

    /*
     * The own-goal this file exists for: a page advertised in the sitemap that
     * robots.txt forbids fetching. The crawler is told to index a URL it is
     * not allowed to read, so it can never see the content OR a noindex, and
     * the URL sits in results as a bare title with no description.
     */
    if (page.index) {
      const blocked = DISALLOWED_PREFIXES.find((prefix) => page.path === prefix || page.path.startsWith(prefix));
      if (blocked) problems.push(`${page.path} is in the sitemap but robots.txt disallows "${blocked}".`);

      const hidden = NOINDEX_PREFIXES.find((prefix) => page.path === prefix || page.path.startsWith(`${prefix}/`));
      if (hidden) problems.push(`${page.path} is marked indexable but sits under the noindex prefix "${hidden}".`);
    }

    if (page.index && !page.agentSummary) {
      problems.push(`${page.path} is indexable but has no agentSummary, so it is absent from llms.txt.`);
    }
  }

  if (!PAGES.some((page) => page.path === '/' && page.index)) {
    problems.push('The site root is not declared indexable — nothing would anchor the domain.');
  }

  if (!/^https:\/\/[^/]+$/.test(SITE.origin)) {
    problems.push(`SITE.origin must be an https origin with no trailing slash: "${SITE.origin}"`);
  }

  return problems;
}

/**
 * The app decides which routes are public marketing surfaces; site.mjs decides
 * which ones the world is told about. Two files that cannot import each other
 * is the shape that drifts, so it is asserted rather than trusted — the same
 * reasoning as `paths:check` on the analytics side.
 */
export function auditRoutes(site, analyticsSource) {
  const match = analyticsSource.match(/const MARKETING_PREFIXES = \[([^\]]+)\]/);
  if (!match) return ['Could not read MARKETING_PREFIXES from frontend/src/lib/analytics.tsx.'];

  const appPrefixes = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  const seoRoots = [...new Set(site.PAGES.map((p) => (p.path === '/' ? '/' : `/${p.path.split('/')[1]}`)))].sort();

  return [
    ...appPrefixes
      .filter((p) => !seoRoots.includes(p))
      .map((p) => `'${p}' is a marketing route in the app but is never declared for search — it can only be found by luck.`),
    ...seoRoots
      .filter((p) => !appPrefixes.includes(p))
      .map((p) => `'${p}' is declared for search but is not a marketing route — the sitemap would advertise a 404.`),
  ];
}

async function main() {
// pathToFileURL, never a bare absolute path: Node's ESM loader takes a URL,
// and on Windows `C:\...` parses as the scheme `c:` -> ERR_UNSUPPORTED_ESM_URL_SCHEME.
// Same family as the `fileURLToPath, never URL.pathname` note in
// database/scripts/check-migrations.mjs, and the reason database/ `npm test`
// could not pass on Windows until 2026-08-23 (RUNBOOK.md).
  const site = await import(pathToFileURL(SITE_MODULE).href);
  const problems = [...auditSite(site), ...auditRoutes(site, readFileSync(ANALYTICS, 'utf8'))];

  if (problems.length === 0) {
    const indexable = site.PAGES.filter((p) => p.index).length;
    console.log(
      `OK    seo surface — ${site.PAGES.length} page(s), ${indexable} indexable, ` +
        `${site.SITE.locales.length} locales, ${site.AI_CRAWLERS.length} AI crawlers allowed`,
    );
    return;
  }

  console.error(`FAIL  the public surface has ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\n  Every rule above is in the header of agent/tools/check-seo-surface.mjs with its consequence.');
  process.exit(1);
}

// Only run when invoked directly, so the test can import the helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
