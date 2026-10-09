// Shared helpers for the frontend audit tools (frontend/tools/audit). Developer tools, not a CI gate and
// not a test suite: they open the running dev server in headless Chrome, driven over its DevTools protocol,
// and report measurements. See docs/engineering/FRONTEND-TOOLKIT.md.
//
// Needs: the dev server running (`npm run dev`) and Chrome installed (set CHROME_PATH if it is somewhere
// unusual). Node 24 provides the WebSocket client; no other dependency is used here.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_URL = 'http://localhost:5173/';
export const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
export const WIDTHS = [320, 390, 768, 1024, 1440];

// What the app reads before the first paint (see index.html and src/theme/useTheme.tsx, src/lib/visitor.ts).
const THEME_KEY = 'lf-theme';
const LANGUAGE_KEY = 'i18nextLng';
const CONSENT_COOKIE = 'lf_cc';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `--flag` and `--key value` pairs from the command line. */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};

  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;

    const key = argv[i].slice(2);
    const next = argv[i + 1];

    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }

  return args;
}

/**
 * The page configurations to visit. One configuration from `--theme`, `--lang`, `--width` (defaults light,
 * en-US, 1440), or with `--matrix` every width in `widths` across the three languages, alternating light and
 * dark unless `--themes light,dark` asks for both everywhere.
 */
export function configurations(args, widths = WIDTHS) {
  const url = typeof args.url === 'string' ? args.url : DEFAULT_URL;
  const consent = typeof args.consent === 'string' ? args.consent : 'denied';

  if (!args.matrix) {
    return [{ theme: args.theme ?? 'light', lang: args.lang ?? 'en-US', width: Number(args.width ?? 1440), url, consent }];
  }

  const themes = typeof args.themes === 'string' ? args.themes.split(',') : null;
  const out = [];
  let index = 0;

  for (const width of widths) {
    for (const lang of LOCALES) {
      for (const theme of themes ?? [index % 2 === 0 ? 'light' : 'dark']) out.push({ theme, lang, width, url, consent });
      index++;
    }
  }

  return out;
}

export const describe = (config) => `${config.width}px ${config.theme} ${config.lang}`;

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));

  if (!found) throw new Error('Chrome not found. Install it or set CHROME_PATH.');

  return found;
}

const KEYS = {
  Tab: { key: 'Tab', code: 'Tab', vk: 9 },
  Enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
};

/** Starts headless Chrome once; `newPage(config)` opens a page with the theme, language and consent set before it loads. */
export async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'lf-audit-'));
  const chrome = spawn(chromePath(), [
    '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  let port;

  for (let i = 0; i < 100 && !port; i++) {
    try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await sleep(100); }
  }

  if (!port) { chrome.kill(); throw new Error('Chrome did not start.'); }

  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);

  await new Promise((resolve) => { ws.onopen = resolve; });

  let nextId = 0;
  const pending = new Map();

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  };

  const send = (method, params = {}, sessionId) => new Promise((resolve) => {
    const id = ++nextId;

    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

  async function newPage({ theme = 'light', lang = 'en-US', width = 1440, height, consent = 'denied', url = DEFAULT_URL, settle = 5000 } = {}) {
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);

    await call('Emulation.setDeviceMetricsOverride', { width, height: height ?? (width < 600 ? 780 : 900), deviceScaleFactor: 1, mobile: width < 600 });
    await call('Page.enable');

    const cookie = consent === 'unset' ? '' : `document.cookie="${CONSENT_COOKIE}=${consent}; path=/";`;

    await call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem("${THEME_KEY}","${theme}");localStorage.setItem("${LANGUAGE_KEY}","${lang}");${cookie}` });
    await call('Page.navigate', { url });
    await sleep(settle);

    /** Evaluates an expression in the page and returns its JSON-able value. */
    const ev = async (expression) => {
      const reply = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });

      if (reply.result.exceptionDetails) throw new Error(`Page script failed: ${JSON.stringify(reply.result.exceptionDetails).slice(0, 300)}`);

      return reply.result.result.value;
    };

    return {
      ev,
      call,
      /** A real key press (Tab, Enter, Escape, ArrowDown). */
      async press(name) {
        const k = KEYS[name];

        await call('Input.dispatchKeyEvent', { type: 'keyDown', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, text: k.text });
        await call('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.vk });
        await sleep(350);
      },
      /** Scrolls the whole page once so reveal-on-scroll content is in, then back to the top. */
      async scrollThrough() {
        const total = await ev('document.documentElement.scrollHeight');

        for (let y = 0; y < total; y += 400) { await ev(`window.scrollTo(0, ${y})`); await sleep(300); }

        await ev('window.scrollTo(0, 0)');
        await sleep(1000);
      },
      async screenshot({ fullPage = false, clip } = {}) {
        const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage, clip });

        return Buffer.from(shot.result.data, 'base64');
      },
      close: () => send('Target.closeTarget', { targetId }),
    };
  }

  return {
    newPage,
    async close() {
      ws.close();
      chrome.kill();
      await sleep(300);

      try { rmSync(profile, { recursive: true, force: true }); } catch { /* the profile is a temp folder; the OS cleans it */ }
    },
  };
}

/** Opens one page per configuration, runs `visit(page, config)`, and always cleans up. Exit code 1 when anything was reported. */
export async function run(title, args, visit, widths) {
  const browser = await launch();
  let failures = 0;

  try {
    for (const config of configurations(args, widths)) {
      const page = await browser.newPage(config);

      try { failures += (await visit(page, config)) ?? 0; } finally { await page.close(); }
    }
  } finally {
    await browser.close();
  }

  console.log(failures === 0 ? `\n${title}: no findings.` : `\n${title}: ${failures} finding(s).`);
  process.exitCode = failures === 0 ? 0 : 1;
}

/** The two states of the page that open on top of it, for checks that look at them. */
export const OPEN_PREFERENCES = `[...document.querySelectorAll('button')].find((b) => /preferences|preferencias|preferências/i.test(b.textContent)).click()`;
export const OPEN_SIGN_IN = `[...document.querySelectorAll('header button')].find((b) => /sign in|iniciar sesión|entrar/i.test(b.getAttribute('aria-label') || b.textContent)).click()`;
export const CLOSE_WITH_ESCAPE = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`;
export const OPEN_LANGUAGE_MENU = `document.querySelector('header button[aria-label^="Language"], header button[aria-label^="Idioma"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))`;
