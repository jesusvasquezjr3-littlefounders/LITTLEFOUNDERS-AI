#!/usr/bin/env node
/*
 * Regenerates the social share cards from og-card.html — one per locale.
 *
 * WHY THIS IS A SCRIPT AND NOT A ONE-OFF
 *
 * The cards are marketing assets that will change every time the positioning
 * line does, and a binary nobody can rebuild is a binary that goes stale and
 * then quietly misrepresents the product. The previous card outlived its
 * accuracy by months for exactly that reason. This makes regenerating them
 * `npm run seo:cards`, with the copy read from site.mjs so the card and the
 * meta tags cannot claim different things.
 *
 * Drives Chrome over the DevTools Protocol rather than shelling out to
 * `--screenshot`, for one reason worth the extra code: CDP can capture JPEG
 * directly at a chosen quality. `--screenshot` only writes PNG, which for this
 * card is several times heavier than a visually identical JPEG — and a share
 * card an unfurler times out fetching is a share card that does not appear.
 * The server, launcher and client live in cdp.mjs (shared with render-icons.mjs).
 */

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FRONTEND, launchChrome, openPage, startServer, waitFor } from './cdp.mjs';

const OUT_DIR = join(FRONTEND, 'public/og');

const LOCALES = [
  { id: 'en-US', file: 'og-card-en.jpg' },
  { id: 'es-MX', file: 'og-card-es.jpg' },
  { id: 'pt-BR', file: 'og-card-pt.jpg' },
];

const WIDTH = 1200;
const HEIGHT = 630; // 1.91:1 — the ratio Facebook, LinkedIn, X and WhatsApp all want.
const QUALITY = 90;

async function main() {
  const { server, port } = await startServer();
  const userDataDir = join(tmpdir(), `lf-og-cards-${process.pid}`);
  await mkdir(userDataDir, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  let chrome;
  try {
    chrome = await launchChrome(userDataDir);
    const cdp = await openPage(chrome);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

    for (const locale of LOCALES) {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/scripts/seo/og-card.html?locale=${locale.id}` });
      /*
       * Wait for the card to say it is ready rather than for a fixed delay.
       * The template sets data-ready only after it has applied the localised
       * copy, its fonts and every cast image, so a screenshot can never catch
       * the English default sitting in the Spanish card — the exact race a
       * `sleep 2` loses occasionally and silently, producing a wrong asset
       * that looks right.
       */
      await waitFor(cdp, `(document.body?.dataset.ready === 'true' && document.fonts.status === 'loaded') ? document.getElementById('line').textContent : ''`,
        `Card for ${locale.id} (copy, fonts or cast)`);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: QUALITY, captureBeyondViewport: false });
      const bytes = Buffer.from(shot.data, 'base64');
      await writeFile(join(OUT_DIR, locale.file), bytes);
      console.log(`  ${locale.file.padEnd(16)} ${WIDTH}x${HEIGHT}  ${(bytes.length / 1024).toFixed(0)} KB`);
    }

    cdp.close();
  } finally {
    chrome?.child.kill();
    server.close();
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }

  console.log(`seo:cards — ${LOCALES.length} share cards written to public/og/`);
}

await main();
