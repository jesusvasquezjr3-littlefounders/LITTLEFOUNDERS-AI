#!/usr/bin/env node
/*
 * IndexNow — tell Bing, Yandex, Naver and Seznam that a page changed, instead
 * of waiting to be crawled.
 *
 * WHAT IT IS, AND WHAT IT IS NOT
 *
 * One HTTP POST listing changed URLs, authenticated by a key file served from
 * our own origin: possession of the file at `/<key>.txt` proves control of the
 * site, which is the whole protocol. Submitting participants share the ping,
 * so one call reaches all of them.
 *
 * Google does NOT participate and has said so. Google is covered by the
 * sitemap and by Search Console's own "request indexing" — this closes the
 * OTHER half, where a brand-new domain would otherwise wait weeks for Bing and
 * DuckDuckGo (which is Bing-backed) to come round on their own.
 *
 * WHY IT IS SAFE TO RUN ON EVERY DEPLOY
 *
 * It submits only URLs declared indexable in site.mjs — never a product route,
 * never the noindex shell — so a bug here cannot advertise something private.
 * And it FAILS SOFT by design: a search engine being slow or unreachable must
 * never fail a deploy, so every non-2xx is reported and the exit code stays 0
 * unless `--strict` is passed. That is a deliberate asymmetry, not laziness —
 * the cost of a missed ping is a slower crawl, and the cost of a failed deploy
 * is the site not shipping at all.
 *
 * Run: npm run seo:indexnow            (add --dry-run to print and send nothing)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, absolute, indexablePages } from './site.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(HERE, '../..');

/*
 * The key is PUBLIC by design — it is served at a well-known path so the
 * engine can fetch it back and confirm we control the origin. It is therefore
 * committed rather than held in a secret, which also means the deployed file
 * and the submitted key can never drift apart. It is not a credential: the
 * only thing it authorises is "this site changed", and possession of it grants
 * nothing beyond that.
 *
 * 32 hex characters, which is the format every participant accepts.
 */
export const INDEXNOW_KEY = 'a7f3c19e4b2d48569c0e1f7a3b8d2e64';

const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** The key file, written into dist by the build so it deploys with the site. */
export function writeKeyFile(distDir) {
  mkdirSync(distDir, { recursive: true });
  // Body is the key itself, nothing else — the spec is exact about this.
  writeFileSync(join(distDir, `${INDEXNOW_KEY}.txt`), `${INDEXNOW_KEY}\n`);
  return `${INDEXNOW_KEY}.txt`;
}

/** Every indexable URL, which is the only set this is allowed to submit. */
export function submittableUrls() {
  return indexablePages().map((page) => absolute(page.path));
}

export async function submit({ dryRun = false } = {}) {
  const urlList = submittableUrls();
  const host = new URL(SITE.origin).host;
  const body = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE.origin}/${INDEXNOW_KEY}.txt`,
    urlList,
  };

  if (dryRun) {
    console.log(`indexnow (dry run) — would submit ${urlList.length} URL(s) to ${ENDPOINT}`);
    for (const url of urlList) console.log(`  ${url}`);
    return { ok: true, status: 0, dryRun: true, count: urlList.length };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    /*
     * 200 accepted, 202 accepted-pending-key-validation. Both are success, and
     * 202 is the NORMAL answer the first time a key is seen — treating it as a
     * failure would make the first real submission look broken.
     */
    const ok = res.status === 200 || res.status === 202;
    console.log(`indexnow — ${ok ? 'accepted' : 'refused'} (HTTP ${res.status}) for ${urlList.length} URL(s)`);
    if (!ok) {
      const text = await res.text().catch(() => '');
      console.log(`  ${text.slice(0, 300)}`);
      console.log('  Not fatal: the sitemap still carries these URLs. A refusal usually means the key file is not reachable yet.');
    }
    return { ok, status: res.status, count: urlList.length };
  } catch (error) {
    console.log(`indexnow — could not reach ${ENDPOINT}: ${String(error).slice(0, 160)}`);
    console.log('  Not fatal: a slow or unreachable search engine must never fail a deploy.');
    return { ok: false, status: 0, count: urlList.length };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dryRun = process.argv.includes('--dry-run');
  const strict = process.argv.includes('--strict');
  const result = await submit({ dryRun });
  // Fails a deploy only when explicitly asked to. See the header.
  if (!result.ok && strict) process.exit(1);
}

export { FRONTEND };
