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
 * card is 490 KB against 144 KB for a visually identical JPEG — and a share
 * card an unfurler times out fetching is a share card that does not appear.
 *
 * No dependencies: Node 22+ ships a WebSocket client, and the static server is
 * twenty lines. Adding puppeteer to build one image would be the expensive
 * kind of convenient.
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(HERE, '../..');
const OUT_DIR = join(FRONTEND, 'public/og');

const LOCALES = [
  { id: 'en-US', file: 'og-card-en.jpg' },
  { id: 'es-MX', file: 'og-card-es.jpg' },
  { id: 'pt-BR', file: 'og-card-pt.jpg' },
];

const WIDTH = 1200;
const HEIGHT = 630; // 1.91:1 — the ratio Facebook, LinkedIn, X and WhatsApp all want.
const QUALITY = 90;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** Serves `frontend/` so the card can reference the real logo and mentor art by path. */
function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      // Contain every read inside the frontend directory — this serves the
      // repo, so a `..` in a URL must not be able to walk out of it.
      const target = resolve(join(FRONTEND, path));
      if (!target.startsWith(FRONTEND)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(target);
      res.writeHead(200, { 'Content-Type': MIME[extname(target)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

function chromeBinary() {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `No Chrome or Chromium found. Set CHROME_PATH to its executable.\nLooked in:\n  ${CHROME_CANDIDATES.join('\n  ')}`,
    );
  }
  return found;
}

/** Launch headless Chrome and wait for it to publish the port it chose. */
async function launchChrome(userDataDir) {
  const child = spawn(
    chromeBinary(),
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--force-device-scale-factor=1',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const portFile = join(userDataDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      const port = readFileSync(portFile, 'utf8').split('\n')[0];
      if (port) return { child, port: Number(port) };
    } catch {
      /* not written yet */
    }
  }
  child.kill();
  throw new Error('Chrome started but never published its debugging port.');
}

/** Minimal CDP client: send a command, resolve when its id comes back. */
function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(`${message.error.message} (${JSON.stringify(message.error.data ?? {})})`));
    else waiter.resolve(message.result);
  });

  const ready = new Promise((ok, fail) => {
    socket.addEventListener('open', ok, { once: true });
    socket.addEventListener('error', () => fail(new Error('CDP socket failed to open')), { once: true });
  });

  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close(),
  };
}

async function main() {
  const { server, port } = await startServer();
  const userDataDir = join(tmpdir(), `lf-og-cards-${process.pid}`);
  await mkdir(userDataDir, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  let chrome;
  try {
    chrome = await launchChrome(userDataDir);

    const targets = await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
    const cdp = connect(targets.webSocketDebuggerUrl);
    await cdp.ready;

    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    for (const locale of LOCALES) {
      const url = `http://127.0.0.1:${port}/scripts/seo/og-card.html?locale=${locale.id}`;
      await cdp.send('Page.navigate', { url });

      /*
       * Wait for the card to say it is ready rather than for a fixed delay.
       * The template sets data-ready only after it has applied the localised
       * copy, so a screenshot can never catch the English default sitting in
       * the Spanish card — the exact race a `sleep 2` loses occasionally and
       * silently, producing a wrong asset that looks right.
       */
      let ready = false;
      for (let attempt = 0; attempt < 120 && !ready; attempt += 1) {
        await new Promise((r) => setTimeout(r, 100));
        const probe = await cdp.send('Runtime.evaluate', {
          expression: `(document.body?.dataset.ready === 'true' && document.fonts.status === 'loaded') ? document.getElementById('line').textContent : ''`,
          returnByValue: true,
        });
        ready = Boolean(probe.result?.value);
      }
      if (!ready) throw new Error(`Card for ${locale.id} never became ready (copy or fonts did not load).`);

      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: QUALITY,
        captureBeyondViewport: false,
      });
      const bytes = Buffer.from(shot.data, 'base64');
      await writeFile(join(OUT_DIR, locale.file), bytes);
      console.log(`  ${locale.file.padEnd(16)} ${WIDTH}x${HEIGHT}  ${(bytes.length / 1024).toFixed(0)} KB`);
    }

    cdp.close();
  } finally {
    chrome?.child.kill();
    server.close();
    await rm(userDataDir, { recursive: true, force: true });
  }

  console.log(`seo:cards — ${LOCALES.length} share cards written to public/og/`);
}

await main();
