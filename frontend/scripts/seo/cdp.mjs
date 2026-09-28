/*
 * The three pieces the SEO asset renderers share (render-cards.mjs for the
 * share cards, render-icons.mjs for the favicons and app icons): a static
 * server for `frontend/`, a headless Chrome launch, and a minimal DevTools
 * Protocol client.
 *
 * No dependencies: Node 22+ ships a WebSocket client, and the static server is
 * twenty lines. Adding puppeteer to build a handful of images would be the
 * expensive kind of convenient.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
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
  '.woff2': 'font/woff2',
};

/**
 * Serves `frontend/` so a template can reference the real fonts and art by
 * path. `routes` answers extra virtual paths (a generated page) first.
 */
export function startServer(routes = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const path = decodeURIComponent(url.pathname);
      if (routes[path]) {
        const { type, body } = routes[path](url.searchParams);
        res.writeHead(200, { 'Content-Type': type }).end(body);
        return;
      }
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
export async function launchChrome(userDataDir) {
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
export function connect(url) {
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

/** Open a fresh page on a launched Chrome and return its CDP client. */
export async function openPage(chrome) {
  const target = await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  return cdp;
}

/** Poll an expression until it returns a truthy value (never a fixed sleep: a slow font would be captured half-loaded). */
export async function waitFor(cdp, expression, what) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    await new Promise((r) => setTimeout(r, 100));
    const probe = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
    if (probe.result?.value) return probe.result.value;
  }
  throw new Error(`${what} never became ready.`);
}
