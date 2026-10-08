import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * The landing's "value of money" section (owner brief, 2026-10-06): three REAL
 * app screens in a tablet, and a Mentor leaning in from its edge.
 *
 * The screens are the app's own components with fixture data, mounted inside
 * the learner shell at a tablet's width (`src/rebuild/preview/SiteTabletPreview.tsx`,
 * preview entry `rebuild.html?screen=site-tablet&view=`):
 *   wallet   the savings goal under way and the coin card (SavingsGoals, CoinAccount)
 *   recall   the story bringing an earlier decision back as a lesson opens (NarrativeRecallView)
 *   result   the end of a lesson (LessonResultView)
 * Each is rendered in every locale and both colour modes with reduced motion, so
 * every animation is at rest, and delivered as WebP at 1280x960 (a 1024x768
 * viewport at 1.25x) to `public/rebuild/landing/tablet/`. Nothing is drawn over
 * them. The images, not the components, ship: the landing stays light.
 *
 * The Mentor is Zara in the catalogue pose `ambient.curious` ("watching the
 * learner work, from the edge of the frame"), the real model, alone on a
 * transparent canvas, held at the pose's one representative frame, rendered on
 * a virtual clock (as in render-hero-video.mjs) and delivered as WebP with alpha.
 *
 * Prerequisites (gitignored): the runtime models in `public/scenes/` and the
 * Basis transcoder in `public/basis/`; a Vite dev server:
 *   REBUILD_URL=http://localhost:5173 node scripts/render-site-tablet.mjs
 * Env: TABLET_LOCALES=es-MX, TABLET_MODES=light, TABLET_VIEWS=wallet (subsets), TABLET_PEEK=0 to skip the Mentor,
 *      HERO_GPU=software.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5173';
const LOCALES = process.env.TABLET_LOCALES?.split(',') ?? ['es-MX', 'en-US', 'pt-BR'];
const MODES = process.env.TABLET_MODES?.split(',') ?? ['light', 'dark'];
const VIEWS = process.env.TABLET_VIEWS?.split(',') ?? ['wallet', 'recall', 'result', 'board-scale', 'board-partition', 'board-receipt'];
const GPU = process.env.HERO_GPU === 'software' ? 'software' : 'hardware';
const TABLET = { width: 1024, height: 768, scale: 1.25 };
const PEEK = { width: 640, height: 760, scale: 1.5 };
const outDir = resolve('public/rebuild/landing/tablet');
const scratch = resolve('../audit-results/site-tablet');
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


const VIRTUAL_CLOCK = `(() => {
  let now = 0; const base = Date.now(); let queue = [];
  performance.now = () => now;
  Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (count) => { for (let i = 0; i < count; i++) { now += 1000 / 60; const run = queue; queue = []; for (const cb of run) cb(now); } return now; };
})();`;

const browser = await launchBrowser(mkdtempSync(join(scratch, 'chrome-')), { gpuMode: GPU });
try {
  for (const mode of MODES) {
    const page = await openPage(browser.browser, { width: TABLET.width, height: TABLET.height, dark: mode === 'dark' });
    await page.send('Emulation.setDeviceMetricsOverride', { width: TABLET.width, height: TABLET.height, deviceScaleFactor: TABLET.scale, mobile: false });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');

    for (const locale of LOCALES) for (const view of VIEWS) {
      await page.send('Page.navigate', { url: viewUrl(view, mode, locale) });
      let ready = false;
      for (let n = 0; n < 120 && !ready; n++) {
        await wait(250);
        ready = await page.evaluate(READY(view)).catch(() => false);
      }
      if (!ready) throw new Error(`${view}/${locale}/${mode}: the screen never became ready`);
      await wait(isBoard(view) ? 6000 : 900); // lets images, the shell's route entrance and the 3D stage settle
      const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: TABLET.width, height: TABLET.height, scale: 1 }, captureBeyondViewport: false });
      const file = join(outDir, `tablet-${view}-${locale}-${mode}.webp`);
      await sharp(Buffer.from(shot.data, 'base64')).resize(1280, 960, { kernel: 'lanczos3' }).webp({ quality: 80, effort: 6 }).toFile(file);
      console.log(`${view} ${locale} ${mode}: ${Math.ceil(statSync(file).size / 1024)} KB`);
    }
    await page.send('Page.close').catch(() => {});
  }

  // The characters that lean in from outside a screen: Zara over the tablet's edge, and Dina puzzled in the problem section.
  const SUBJECTS = [
    { screen: 'site-peek', query: '', marker: '[data-site-peek]', out: 'peek-zara' },
    { screen: 'site-problem', query: '&who=dina&pose=think.puzzled&fill=0.76', marker: '[data-site-problem]', out: 'problem-dina' },
    // Dina's reactions in the landing's lesson demo: one pose per moment of the story.
    { screen: 'site-problem', query: '&who=dina&pose=ambient.idle.happy&fill=0.9', marker: '[data-site-problem]', out: 'lesson-dina-idle' },
    { screen: 'site-problem', query: '&who=dina&pose=feedback.retry.gentle&fill=0.9', marker: '[data-site-problem]', out: 'lesson-dina-gentle' },
    { screen: 'site-problem', query: '&who=dina&pose=feedback.correct.quiet&fill=0.9', marker: '[data-site-problem]', out: 'lesson-dina-quiet' },
    { screen: 'site-problem', query: '&who=dina&pose=think.ponder&fill=0.9', marker: '[data-site-problem]', out: 'lesson-dina-ponder' },
  ].filter((subject) => !process.env.TABLET_SUBJECTS || process.env.TABLET_SUBJECTS.split(',').includes(subject.out));
  if (process.env.TABLET_PEEK !== '0') for (const subject of SUBJECTS) for (const mode of MODES) {
    const page = await openPage(browser.browser, { width: PEEK.width, height: PEEK.height, dark: mode === 'dark' });
    await page.send('Emulation.setDeviceMetricsOverride', { width: PEEK.width, height: PEEK.height, deviceScaleFactor: PEEK.scale, mobile: false });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
    await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    await page.send('Page.navigate', { url: `${origin}/rebuild.html?screen=${subject.screen}${subject.query}&theme=${mode}&locale=en-US` });
    let ready = false;
    for (let n = 0; n < 480 && !ready; n++) {
      await wait(250);
      await page.evaluate('window.__step && window.__step(2)').catch(() => {});
      ready = await page.evaluate(`!!document.querySelector('${subject.marker} canvas')`).catch(() => false);
    }
    if (!ready) throw new Error(`${subject.screen}/${mode}: the stage never mounted`);
    // The page's own backgrounds would paint over the transparent canvas; the picture is the character alone.
    await page.evaluate("document.head.insertAdjacentHTML('beforeend', '<style>html,body,.lf-rebuild{background:transparent!important}</style>')");
    // Six virtual seconds: the renderer promotes its tier, the camera settles, the light rig eases in (a held pose needs no more).
    for (let s = 0; s < 6; s++) { await page.evaluate('window.__step(60)'); await wait(60); }
    const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: PEEK.width, height: PEEK.height, scale: 1 }, captureBeyondViewport: false });
    const master = join(scratch, `${subject.out}-${mode}.png`);
    writeFileSync(master, Buffer.from(shot.data, 'base64'));
    const file = join(outDir, `${subject.out}-${mode}.webp`);
    let picture = sharp(master).resize(PEEK.width, PEEK.height, { kernel: 'lanczos3' });
    if (subject.screen === 'site-problem') {
      // The character's contact shadow is a plane that the canvas cuts off in a straight line; the picture dissolves toward its edges instead.
      const fade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PEEK.width}" height="${PEEK.height}"><defs><radialGradient id="g" cx="50%" cy="48%" r="50%"><stop offset="0.8" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
      picture = sharp(await picture.png().toBuffer()).composite([{ input: fade, blend: 'dest-in' }]);
    }
    await picture.webp({ quality: 88, alphaQuality: 92, effort: 6 }).toFile(file);
    console.log(`${subject.out} ${mode}: ${Math.ceil(statSync(file).size / 1024)} KB`);
    await page.send('Page.close').catch(() => {});
  }
} finally {
  browser.child.kill();
  await wait(800);
  try { rmSync(scratch, { recursive: true, force: true }); } catch { /* Chrome may still hold its profile; the folder is scratch */ }
}
