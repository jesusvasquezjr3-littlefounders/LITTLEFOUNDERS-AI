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
const BUILD_MODULE = resolve(ROOT, 'frontend/scripts/seo/build-seo.mjs');
const ANALYTICS = resolve(ROOT, 'frontend/src/lib/analytics.tsx');
const TOKENS = resolve(ROOT, 'frontend/src/rebuild/design/tokens.css');

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

    /*
     * `lastmod` has to be a real, past date. It first derived itself from a
     * file's mtime, which a fresh git clone resets to the checkout time — so
     * every deploy silently claimed every page had changed that day. A crawler
     * that catches lastmod lying stops reading it at all, which costs us the
     * field on the day a page genuinely does change.
     */
    if (!/^\d{4}-\d{2}-\d{2}$/.test(page.lastmod ?? '')) {
      problems.push(`${page.path} has no valid lastmod (want YYYY-MM-DD, got ${JSON.stringify(page.lastmod)}).`);
    } else if (page.lastmod > new Date().toISOString().slice(0, 10)) {
      problems.push(`${page.path} has a lastmod in the future (${page.lastmod}).`);
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
 * Browser chrome, the web app manifest and the structured-data logo are the
 * brand as the world first sees it, before any page renders. Frontend Bible
 * 02 D8 puts marketing on the one design system, so the theme colour and the
 * manifest background must be colours of the rebuilt token sheet (the legacy
 * indigo #4f46e5 and splash #0b1120 were not), and the logo must be our own
 * mark's raster, never the legacy raster logo.
 */
export function auditBrand(site, tokenSheet) {
  const tokens = new Set([...tokenSheet.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()));
  const problems = [];
  for (const [name, value] of [['themeColor', site.SITE.themeColor], ['manifestBackground', site.SITE.manifestBackground]]) {
    if (typeof value !== 'string' || !tokens.has(value.toLowerCase())) {
      problems.push(`SITE.${name} ${JSON.stringify(value)} is not a colour of frontend/src/rebuild/design/tokens.css.`);
    }
  }
  if (typeof site.SITE.logoPath !== 'string' || !/^\/icon-\d+\.png$/.test(site.SITE.logoPath)) {
    problems.push(`SITE.logoPath ${JSON.stringify(site.SITE.logoPath)} must be one of the brand mark's rasters (/icon-<size>.png, scripts/seo/render-icons.mjs).`);
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

const EM_DASH = String.fromCharCode(0x2014);

/**
 * llms.txt and llms-full.txt are read by assistants that then describe the
 * product to a parent in their own words, so a wrong word here is repeated
 * everywhere. OD-6 and Frontend Bible 02 D10 / section 1.1: "Tutor" is only
 * the verified parent (capitalised, the account), and the AI is the Mentor;
 * the brief once said "the tutor holds a real conversation". Bible 02 rule 16:
 * no em dash. `label` names the file in the message.
 *
 * GAP-FIX-R5 (OD-27 (3), OD-18, A.1): the brief once promised that the Tutor
 * "can see everything their child does" and that parent visibility is "a
 * permanent property of the product". Neither is true: a teen's story choices
 * stay private from every Tutor, and an independent teen reviews their own
 * Mentor notes. A total-visibility claim is refused in every locale's brief.
 */
const OVERCLAIMS = [
  [/\bsees? everything\b/i, 'promises total visibility ("see everything")'],
  [/\beverything (?:their|your|a|the) (?:child|children|kid|kids)\b/i, 'promises total visibility ("everything their child does")'],
  [/\bpermanent property\b/i, 'calls parent visibility a "permanent property" of the product'],
];

export function auditAgentText(text, label) {
  const problems = [];
  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    const at = `${label}:${index + 1}`;
    if (line.includes(EM_DASH)) problems.push(`${at} uses an em dash (Bible 02 rule 16): ${JSON.stringify(line.slice(0, 120))}`);
    for (const match of line.matchAll(/\btutor(?:es|s|a|as)?\b/g)) {
      problems.push(`${at} says "${match[0]}": the AI is the Mentor, and "Tutor" (capitalised) is only the verified parent (OD-6): ${JSON.stringify(line.slice(0, 120))}`);
    }
    if (/\b(?:AI|IA)[\s-]+Tutor\b|\bTutor[\s-]+(?:AI|IA)\b/i.test(line)) {
      problems.push(`${at} calls the AI a Tutor (OD-6): ${JSON.stringify(line.slice(0, 120))}`);
    }
    for (const [pattern, what] of OVERCLAIMS) {
      if (pattern.test(line)) problems.push(`${at} ${what}; a teen's story choices stay private (OD-27 (3), OD-18): ${JSON.stringify(line.slice(0, 120))}`);
    }
  }
  return problems;
}

async function main() {
// pathToFileURL, never a bare absolute path: Node's ESM loader takes a URL,
// and on Windows `C:\...` parses as the scheme `c:` -> ERR_UNSUPPORTED_ESM_URL_SCHEME.
// Same family as the `fileURLToPath, never URL.pathname` note in
// database/scripts/check-migrations.mjs, and the reason database/ `npm test`
// could not pass on Windows until 2026-08-23 (RUNBOOK.md).
  const site = await import(pathToFileURL(SITE_MODULE).href);
  const seo = await import(pathToFileURL(BUILD_MODULE).href);
  const agentText = site.SITE.locales.flatMap((locale) => [
    ...auditAgentText(seo.renderLlmsTxt(locale), `llms.txt (${locale})`),
    ...auditAgentText(seo.renderLlmsFullTxt(locale), `llms-full.txt (${locale})`),
  ]);
  const problems = [...auditSite(site), ...auditRoutes(site, readFileSync(ANALYTICS, 'utf8')), ...auditBrand(site, readFileSync(TOKENS, 'utf8')), ...agentText];

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
