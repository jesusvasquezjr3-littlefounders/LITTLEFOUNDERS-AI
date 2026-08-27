#!/usr/bin/env node
/*
 * What the internet ACTUALLY receives, fetched from production.
 *
 * `seo:check` validates the declaration; this validates the delivery, and the
 * gap between the two is where this class of defect lives. Everything can be
 * correct in the repo and still never reach a crawler, because the last mile
 * belongs to the CDN:
 *
 *   - Vercel rewrites every unmatched URL to the SPA shell. Whether
 *     `/how-it-works` finds its own prerendered file or gets swallowed by that
 *     rewrite is decided by Vercel's filesystem-before-rewrites order, which
 *     is behaviour we do not control and cannot assert from a build.
 *   - A `public/` file that fails to copy, a stale deploy, a redirect that
 *     turns the canonical into a 308 — all of them build green.
 *
 * So this asks the site the way a crawler would, and reports what came back.
 * §1.14: verify against production, not against your own reasoning.
 *
 * Run: npm run seo:live            (add a URL argument to check a preview)
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const site = await import(resolve(HERE, '../../frontend/scripts/seo/site.mjs'));

const ORIGIN = (process.argv[2] ?? site.SITE.origin).replace(/\/$/, '');

/*
 * Ask as Googlebot. A site that behaves differently for a crawler than for a
 * browser is the thing we most need to notice, and asking as a browser would
 * hide it — which is exactly how a cloaking accident survives review.
 */
const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/*
 * The same escaping the prerenderer applies.
 *
 * Without it this check reports a false failure on any title containing an
 * ampersand: "Terms & Conditions" is correctly SERVED as
 * `Terms &amp; Conditions`, and comparing against the raw string makes a
 * correct page look like a rewrite that swallowed the file. A checker that
 * cries wolf on a correct deploy gets ignored on the deploy that is wrong.
 */
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const problems = [];
const notes = [];

async function get(path) {
  const url = `${ORIGIN}${path}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    return { ok: res.ok, status: res.status, type: res.headers.get('content-type') ?? '', body: await res.text(), url: res.url };
  } catch (error) {
    return { ok: false, status: 0, type: '', body: '', url, error: String(error).slice(0, 160) };
  }
}

function has(body, needle, label, path) {
  if (!body.includes(needle)) problems.push(`${path}: ${label}`);
}

async function checkPage(page) {
  const path = page.path;
  const meta = site.metaFor(page, site.SITE.canonicalLocale);
  const res = await get(path);

  if (!res.ok) {
    problems.push(`${path}: HTTP ${res.status}${res.error ? ` (${res.error})` : ''}`);
    return;
  }

  /*
   * The decisive assertion. If Vercel's rewrite pre-empted the prerendered
   * file, every page would come back as the SPA shell — same length, same
   * generic title, noindex — and the whole deploy would look fine from a
   * browser while being invisible to search.
   */
  has(res.body, `<title>${esc(meta.title)}</title>`, `served the wrong <title> (rewrite may have pre-empted the prerendered file)`, path);
  has(res.body, `content="${esc(meta.description)}"`, 'no description', path);
  has(res.body, `<link rel="canonical" href="${site.absolute(path)}"`, 'no canonical, or it points elsewhere', path);
  has(res.body, 'property="og:image"', 'no og:image — a shared link will unfurl bare', path);
  has(res.body, 'name="twitter:card" content="summary_large_image"', 'no large Twitter card', path);

  if (page.index) {
    has(res.body, 'application/ld+json', 'no structured data', path);
    if (/<meta name="robots" content="[^"]*noindex/.test(res.body)) {
      problems.push(`${path}: declared indexable but the served page says noindex`);
    }
    // The body shell is the whole point for a consumer that will not run JS.
    if (!res.body.includes(`<h1>${esc(meta.h1)}</h1>`)) {
      problems.push(`${path}: no <h1> in the served HTML — a non-JavaScript reader gets an empty page`);
    }
  } else if (!/<meta name="robots" content="[^"]*noindex/.test(res.body)) {
    problems.push(`${path}: declared non-indexable but the served page does not say noindex`);
  }

  notes.push(`  ${path.padEnd(18)} ${String(res.body.length).padStart(6)} bytes  ${page.index ? 'index' : 'noindex'}`);
}

async function checkFile(path, { type, must = [] }) {
  const res = await get(path);
  if (!res.ok) {
    problems.push(`${path}: HTTP ${res.status}${res.error ? ` (${res.error})` : ''}`);
    return;
  }
  if (type && !res.type.includes(type)) {
    // A text file served as text/html means the SPA fallback answered instead
    // of the real file — the crawler then parses our marketing page as robots.
    problems.push(`${path}: served as "${res.type}", expected ${type} — the SPA fallback probably answered`);
  }
  for (const needle of must) has(res.body, needle, `is missing "${needle}"`, path);
  notes.push(`  ${path.padEnd(18)} ${String(res.body.length).padStart(6)} bytes  ${res.type.split(';')[0]}`);
}

async function checkShareCard() {
  const path = '/og/og-card-en.jpg';
  const res = await fetch(`${ORIGIN}${path}`, { headers: { 'User-Agent': UA } }).catch(() => null);
  if (!res?.ok) {
    problems.push(`${path}: not reachable — every shared link would unfurl without an image`);
    return;
  }
  const bytes = Number(res.headers.get('content-length') ?? 0);
  if (!(res.headers.get('content-type') ?? '').includes('image/')) {
    problems.push(`${path}: served as "${res.headers.get('content-type')}", not an image`);
  }
  // Several unfurlers give up on a slow image and drop the card entirely.
  if (bytes > 800_000) problems.push(`${path}: ${(bytes / 1024).toFixed(0)} KB is large enough for an unfurler to time out`);
  notes.push(`  ${path.padEnd(18)} ${String(bytes).padStart(6)} bytes  ${res.headers.get('content-type')}`);
}

async function checkFallbackIsNoindex() {
  // A URL that matches no prerendered file, so the rewrite must answer.
  const path = '/learn/a-route-that-does-not-exist';
  const res = await get(path);
  if (!res.ok) return; // A 404 is also an acceptable answer.
  if (!/<meta name="robots" content="[^"]*noindex/.test(res.body)) {
    problems.push(`${path}: the SPA fallback is INDEXABLE — every product URL can enter search results`);
  } else {
    notes.push(`  ${'(unmatched route)'.padEnd(18)} ${String(res.body.length).padStart(6)} bytes  noindex`);
  }
}

console.log(`Asking ${ORIGIN} as Googlebot…\n`);

for (const page of site.PAGES) await checkPage(page);
await checkFile('/robots.txt', { type: 'text/plain', must: [`Sitemap: ${site.SITE.origin}/sitemap.xml`, 'GPTBot', 'ClaudeBot'] });
await checkFile('/sitemap.xml', { type: 'xml', must: site.indexablePages().map((p) => `<loc>${site.absolute(p.path)}</loc>`) });
await checkFile('/llms.txt', { type: 'text/plain', must: ['# LittleFounders'] });
await checkFile('/site.webmanifest', { must: ['"name"'] });
await checkShareCard();
await checkFallbackIsNoindex();

console.log(notes.join('\n'));

if (problems.length === 0) {
  console.log(`\nOK    live seo — ${site.PAGES.length} pages, robots, sitemap, llms.txt, manifest and share card all served correctly`);
} else {
  console.error(`\nFAIL  ${problems.length} problem(s) in what production actually serves:\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
