import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * The landing's tablet (owner brief, 2026-10-07): the three app screens are not pictures, they are short looping videos of
 * someone using them, with a cursor. Each clip is the app's own screen (the same preview the stills come from,
 * `rebuild.html?screen=site-tablet&view=`) driven by real mouse events over DevTools, so every hover, press and dialog is the
 * product's own, with a drawn cursor and click ring on top (capture only, injected here, never in the product).
 *
 *   wallet   open "Move", point the seeds at a goal, raise the amount, confirm
 *   recall   the story brings an earlier decision back; the cursor answers "Continue"
 *   result   the end of a lesson plays (the Mentor celebrates, the numbers count up) and the cursor goes to Continue
 *
 * The page's frames come from the screencast (the compositor's own, with timestamps), are resampled to a steady 30 fps and
 * encoded to H.264 MP4 by Blender's bundled FFmpeg (scripts/hero-video-encode.py, as the hero does). The still the page paints
 * before the clip plays is `tablet-<view>-<locale>-<mode>.webp` from scripts/render-site-tablet.mjs.
 *
 *   REBUILD_URL=http://localhost:5173 node scripts/render-site-tablet-video.mjs
 * Env: TABLET_LOCALES, TABLET_MODES, TABLET_VIEWS (subsets), TABLET_CRF (default 30), TABLET_KEEP=1 (keep frames), BLENDER.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5173';
const LOCALES = process.env.TABLET_LOCALES?.split(',') ?? ['es-MX', 'en-US', 'pt-BR'];
const MODES = process.env.TABLET_MODES?.split(',') ?? ['light', 'dark'];
const VIEWS = process.env.TABLET_VIEWS?.split(',') ?? ['wallet', 'recall', 'result', 'board-scale', 'board-partition', 'board-receipt'];
const CRF = process.env.TABLET_CRF ?? '30';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const FPS = 30;
const TABLET = { width: 1024, height: 768, scale: 1.25 };
const OUT = { width: 1280, height: 960 };
const outDir = resolve('public/rebuild/landing/tablet');
const scratch = resolve('../audit-results/site-tablet-video');
mkdirSync(outDir, { recursive: true });
mkdirSync(scratch, { recursive: true });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
/* The tablet screens come from two previews: the app's own screens in the learner shell (`site-tablet`), and the real Mentor screen
 * with a board open (`mentor-screen`, views named `board-<kind>`: the Pizarrón on its Diorama with the Mentor beside it). */
const isBoard = (view) => view.startsWith('board-');
const viewUrl = (view, mode, locale) => isBoard(view)
  ? `${origin}/rebuild.html?screen=mentor-screen&state=board&board=${view.slice(6)}&theme=${mode}&locale=${locale}`
  : `${origin}/rebuild.html?screen=site-tablet&view=${view}&theme=${mode}&locale=${locale}`;
const READY = (view) => isBoard(view)
  ? "!!document.querySelector('.lf-mentor-board') && !!document.querySelector('canvas') && document.fonts.status === 'loaded'"
  : "!!document.querySelector('[data-site-tablet]') && document.fonts.status === 'loaded' && !document.querySelector('[aria-busy=\"true\"]')";


/* The cursor and the click ring, drawn over the page for the capture only. It follows the real mouse events. */
const CURSOR = `(() => {
  if (document.getElementById('lf-capture-cursor')) return;
  const style = document.createElement('style');
  style.textContent = '#lf-capture-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);will-change:transform}'
    + '#lf-capture-cursor svg{display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}'
    + '#lf-capture-cursor i{position:absolute;left:-14px;top:-14px;inline-size:28px;block-size:28px;border-radius:50%;background:rgba(92,85,253,.35);transform:scale(0);opacity:0}'
    + '#lf-capture-cursor.down i{animation:lf-ring .45s ease-out}'
    + '@keyframes lf-ring{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.9);opacity:0}}';
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.id = 'lf-capture-cursor';
  el.innerHTML = '<i></i><svg width="30" height="30" viewBox="0 0 30 30"><path d="M5 3 L5 24 L10.5 19 L14 27 L17.5 25.5 L14 17.8 L21.5 17.5 Z" fill="#111329" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
  document.body.appendChild(el);
  const move = (event) => { el.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)'; };
  document.addEventListener('mousemove', move, true);
  document.addEventListener('mousedown', () => { el.classList.remove('down'); void el.offsetWidth; el.classList.add('down'); }, true);
})();`;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

class Recorder {
  constructor(page) {
    this.page = page;
    this.frames = [];
    this.x = 0;
    this.y = 0;
    page.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.method !== 'Page.screencastFrame' || message.sessionId !== page.sessionId) return;
      this.frames.push({ t: message.params.metadata.timestamp, data: message.params.data });
      void page.send('Page.screencastFrameAck', { sessionId: message.params.sessionId }).catch(() => {});
    });
  }
  async start() {
    this.frames = [];
    await this.page.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: OUT.width, maxHeight: OUT.height, everyNthFrame: 1 });
    this.t0 = Date.now() / 1000;
  }
  async stop() { await this.page.send('Page.stopScreencast'); this.t1 = Date.now() / 1000; }
  mouse(type, x, y, extra = {}) {
    return this.page.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1, ...extra });
  }
  /** A human path: an eased arc from here to there, at the real mouse's pace, paced by the wall clock. */
  async moveTo(x, y, ms = 700) {
    const [x0, y0] = [this.x, this.y];
    const bend = Math.min(60, Math.hypot(x - x0, y - y0) * 0.12) * (x > x0 ? -1 : 1);
    const start = performance.now();
    for (;;) {
      const raw = Math.min(1, (performance.now() - start) / ms);
      const t = ease(raw);
      const arc = Math.sin(Math.PI * t) * bend;
      await this.mouse('mouseMoved', x0 + (x - x0) * t, y0 + (y - y0) * t + arc);
      if (raw >= 1) break;
      await wait(8);
    }
    this.x = x; this.y = y;
  }
  async click(ms = 110) {
    await this.mouse('mousePressed', this.x, this.y);
    await wait(ms);
    await this.mouse('mouseReleased', this.x, this.y);
  }
  /** A glide of the page's own scroller (the tablet's box hides overflow, so the wheel has nothing to move), in small eased steps. */
  async scroll(dy, ms = 800) {
    const found = await this.page.evaluate(`(() => {
      const box = document.querySelector('[data-site-tablet]');
      const e = [box, ...box.querySelectorAll('*')].find((x) => x.scrollHeight > x.clientHeight + 40 && ['auto', 'scroll', 'hidden'].includes(getComputedStyle(x).overflowY));
      window.__scroller = e; window.__from = e ? e.scrollTop : 0; return !!e;
    })()`);
    if (!found) throw new Error('nothing to scroll');
    const start = performance.now();
    for (;;) {
      const raw = Math.min(1, (performance.now() - start) / ms);
      await this.page.evaluate(`window.__scroller.scrollTop = ${dy} * ${ease(raw)} + window.__from`);
      if (raw >= 1) break;
      await wait(16);
    }
  }
  async rect(selector, index = 0) {
    return this.page.evaluate(`(() => { const e = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);
  }
  async pointAt(selector, index = 0, { dx = 0, dy = 0, ms = 700 } = {}) {
    const r = await this.rect(selector, index);
    if (!r) throw new Error(`no element for ${selector}[${index}]`);
    await this.moveTo(r.x + dx, r.y + dy, ms);
  }
  async press(selector, index = 0, opts) { await this.pointAt(selector, index, opts); await wait(120); await this.click(); }
}

/* What each clip does. Selectors are structural (classes and order), so one script serves every language. */
const SCENES = {
  async wallet(r) {
    await r.moveTo(900, 700, 1); // enter from the lower right
    await wait(900);
    await r.press('.lf-wallet-quick li:nth-child(1) button', 0, { ms: 900 });
    await wait(900); // the dialog opens
    // "To where": the second heading's chips; take the first goal.
    const target = await r.page.evaluate(`(() => {
      const heads = [...document.querySelectorAll('[role=dialog] h3')];
      const top = heads[1].getBoundingClientRect().bottom, bottom = heads[2].getBoundingClientRect().top;
      const chips = [...document.querySelectorAll('[role=dialog] .lf-choice-chip')].filter((c) => { const b = c.getBoundingClientRect(); return b.top >= top && b.bottom <= bottom; });
      const goal = chips[2] ?? chips[chips.length - 1]; const b = goal.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    })()`);
    await r.moveTo(target.x, target.y, 800);
    await wait(150); await r.click();
    await wait(600);
    for (let n = 0; n < 4; n++) { await r.pointAt('[role=dialog] .lf-stepper-button', 1, { ms: n === 0 ? 700 : 160 }); await wait(60); await r.click(60); await wait(170); }
    await wait(500);
    await r.press('[role=dialog] .lf-button--success', 0, { ms: 800 });
    await wait(1500); // the dialog closes and the move is confirmed
    await r.moveTo(640, 600, 800);
    await r.scroll(430, 900); // down to the goal that just grew
    await wait(2200);
    await r.scroll(-430, 800);
    await wait(500);
  },
  async recall(r) {
    await r.moveTo(900, 700, 1);
    await wait(3800); // the story's memory is read: the question, the choice, what happened, the change of mind
    await r.press('.lf-recall .lf-actions .lf-button', 0, { ms: 1100 });
    await wait(1600);
  },
  /* The three Pizarrón boards: the Mentor's turn is on screen with its board; the learner asks for the same data as a table, then back to the picture. */
  async board(r) {
    await r.moveTo(900, 700, 1);
    await wait(2600);
    await r.press('.lf-button--sky', 0, { ms: 1100 });
    await wait(2400);
    await r.press('.lf-button--sky', 0, { ms: 500 });
    await wait(2200);
  },
  async result(r) {
    await r.moveTo(900, 700, 1);
    await wait(3200); // the celebration plays: the Mentor, the confetti, the numbers counting up
    await r.pointAt('.lf-result-sheet > .lf-button', 0, { ms: 1100 });
    await wait(1800);
  },
};

const browser = await launchBrowser(mkdtempSync(join(scratch, 'chrome-')), { gpuMode: process.env.HERO_GPU === 'software' ? 'software' : 'hardware' });
try {
  for (const mode of MODES) {
    const page = await openPage(browser.browser, { width: TABLET.width, height: TABLET.height, dark: mode === 'dark' });
    await page.send('Emulation.setDeviceMetricsOverride', { width: TABLET.width, height: TABLET.height, deviceScaleFactor: TABLET.scale, mobile: false });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    const recorder = new Recorder(page);

    for (const locale of LOCALES) for (const view of VIEWS) {
      const label = `${view}-${locale}-${mode}`;
      await page.send('Page.navigate', { url: viewUrl(view, mode, locale) });
      let ready = false;
      for (let n = 0; n < 160 && !ready; n++) {
        await wait(250);
        ready = await page.evaluate(READY(view)).catch(() => false);
      }
      if (!ready) throw new Error(`${label}: the screen never became ready`);
      await wait(isBoard(view) ? 5000 : view === 'result' ? 3500 : 1500); // the 3D model, the images and the entrance settle
      await page.evaluate(CURSOR);
      await recorder.mouse('mouseMoved', 900, 700);
      recorder.x = 900; recorder.y = 700;
      // The result plays from its own mount: replay it once the recorder runs.
      await recorder.start();
      if (view === 'result') await page.evaluate("window.dispatchEvent(new Event('lf-replay'))");
      await (SCENES[view] ?? SCENES.board)(recorder);
      await recorder.stop();

      // Resample the screencast to a steady 30 fps (hold the last frame until the next arrives).
      const frames = recorder.frames;
      if (frames.length < 10) throw new Error(`${label}: only ${frames.length} frames were captured`);
      const first = frames[0].t, last = recorder.t1;
      const total = Math.floor((last - first) * FPS);
      const dir = join(scratch, label);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      let cursor = 0;
      for (let i = 0; i < total; i++) {
        const at = first + i / FPS;
        while (cursor + 1 < frames.length && frames[cursor + 1].t <= at) cursor++;
        const jpg = await sharp(Buffer.from(frames[cursor].data, 'base64')).resize(OUT.width, OUT.height, { fit: 'fill' }).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
        writeFileSync(join(dir, `frame-${String(i).padStart(4, '0')}.jpg`), jpg);
      }
      const base = join(outDir, `tablet-${label}`);
      const run = spawnSync(BLENDER, ['-b', '--factory-startup', '-P', resolve('scripts/hero-video-encode.py'), '--', dir, base, String(FPS), String(OUT.width), String(OUT.height), String(total), CRF, '0'], { encoding: 'utf8' });
      if (run.status !== 0 || !existsSync(`${base}.mp4`)) throw new Error(`${label}: Blender encode failed:\n${run.stdout?.slice(-1200)}\n${run.stderr?.slice(-600)}`);
      console.log(`${label}: ${(total / FPS).toFixed(1)} s, ${frames.length} source frames, ${Math.ceil(statSync(`${base}.mp4`).size / 1024)} KB`);
      if (process.env.TABLET_KEEP !== '1') rmSync(dir, { recursive: true, force: true });
    }
    await page.send('Page.close').catch(() => {});
  }
} finally {
  browser.child.kill();
}
