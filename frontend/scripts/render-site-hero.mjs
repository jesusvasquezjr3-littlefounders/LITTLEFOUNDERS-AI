import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * The public site's hero scenes (Frontend Bible 03 §3.3: "The hero art is
 * portrait (4:5) and allowed to overlap into the next section"; 07 §1 class B:
 * marketing hero and scene art are our own assets, generated in the house style
 * and registered in the manifest; 02 D12), locally and at zero spend: no image
 * model, no paid service (OD-23). GAP-FIX-R5.
 *
 * Each picture is the rebuilt Mentor stage itself (`MentorStage` on the preview
 * entry), rendering ONE Mentor's runtime model (`/scenes/<character>.glb`) in
 * ONE catalogue pose, standing on its Diorama, framed by the stage's own
 * `closeup-wide` shot (off-axis, further back: the Diorama in view) in a portrait 4:5 viewport, in both colour modes. Nothing is
 * drawn over it: no text, no caption (07 §7; the asset gate reads it by OCR).
 * The pipeline is render-mentor-stage-stills.mjs's: a virtual clock (so the
 * software rasteriser reaches the high tier), reduced motion (so the gesture is
 * held at its one representative frame), the stage pinned to the viewport.
 *
 * One scene per public page, so the three heroes do not repeat each other:
 *   landing       Dina, happy idle (ambient.idle.happy)
 *   how-it-works  Dr. Rho, explaining (teach.explain)
 *   families      Zara, a greeting nod (greet.nod)
 * Delivered as WebP at 1x/2x/3x (480x600, 960x1200, 1440x1800) and a PNG at 1x
 * as the fallback, to `public/rebuild/site-hero/`. The files are drafts:
 * `src/rebuild/assets/manifest.json` registers them in the `scenes` review
 * family with `reviewStatus: "draft"` until the owner's style review (07 §7,
 * OD-14). HERO_MANIFEST=1 prints those rows for what exists on disk.
 *
 * Prerequisites (gitignored): the runtime models in `public/scenes/` and the
 * Basis transcoder in `public/basis/`; a Vite dev server:
 *   REBUILD_URL=http://localhost:5700 node scripts/render-site-hero.mjs
 * Env: HERO_PAGES=landing, HERO_MODES=light (subsets).
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5540';
export const SITE_HEROES = [
  { page: 'landing', character: 'dina', pose: 'ambient.idle.happy', query: 'state=speaking&age=6-9' },
  { page: 'how-it-works', character: 'rho', pose: 'teach.explain', query: 'state=demonstrating&age=6-9' },
  { page: 'families', character: 'zara', pose: 'greet.nod', query: 'state=acknowledging&age=13-17' },
];
const PAGES = process.env.HERO_PAGES?.split(',') ?? SITE_HEROES.map((hero) => hero.page);
const MODES = process.env.HERO_MODES?.split(',') ?? ['light', 'dark'];
const SCENE = 'diorama-a';
const SHOT = process.env.HERO_SHOT ?? 'closeup-wide';
const VIEW = { width: 480, height: 600 }; // 4:5, captured at dpr 3
const DENSITIES = [1, 2, 3];
const outDir = resolve('public/rebuild/site-hero');
const masterDir = resolve('../audit-results/site-hero-masters');
const fileOf = (page, mode, ext, density = 1) => `${page}-${mode}${density === 1 ? '' : `@${density}x`}.${ext}`;

if (process.env.HERO_MANIFEST === '1') {
  const rows = [];
  for (const { page, character, pose } of SITE_HEROES) for (const mode of MODES) {
    for (const [ext, density] of [...DENSITIES.map((d) => ['webp', d]), ['png', 1]]) {
      const file = join(outDir, fileOf(page, mode, ext, density));
      let kb;
      try { kb = Math.ceil(statSync(file).size / 1024); } catch { continue; }
      rows.push({
        id: `site.hero.${page}.${mode}.${density}x.${ext}`, class: 'B', type: ext, path: `/rebuild/site-hero/${fileOf(page, mode, ext, density)}`,
        slot: 'site.hero', aspect: '4:5', modes: mode, character, poseId: pose, sourceModel: `/scenes/${character}.glb`,
        altKey: `siteHeroArt.${page === 'how-it-works' ? 'howItWorks' : page}`, sizesKb: kb + 2, motionTokens: [],
        generatedBy: `local render: scripts/render-site-hero.mjs (MentorStage on ${SCENE}, ${SHOT} shot, held pose, virtual clock)`,
        reviewFamily: 'scenes', reviewStatus: 'draft', approvedBy: null,
      });
    }
  }
  console.log(rows.map((row) => `  ${JSON.stringify(row).replace(/^\{/, '{ ').replace(/\}$/, ' }').replace(/,"/g, ', "').replace(/":/g, '": ')},`).join('\n'));
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(masterDir, { recursive: true });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const VIRTUAL_CLOCK = `(() => {
  let now = 0; const base = Date.now(); let queue = [];
  performance.now = () => now;
  Date.now = () => base + now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__stepFrames = (count) => { for (let i = 0; i < count; i++) { now += 1000 / 60; const run = queue; queue = []; for (const cb of run) cb(now); } return now; };
})();`;

const browser = await launchBrowser(mkdtempSync(join(masterDir, 'chrome-')));
const report = [];
try {
  for (const mode of MODES) {
    const page = await openPage(browser.browser, { width: VIEW.width, height: VIEW.height, dark: mode === 'dark' });
    await page.send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: 3, mobile: true });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
    for (const hero of SITE_HEROES.filter((row) => PAGES.includes(row.page))) {
      for (let attempt = 1; ; attempt++) {
        try { await capture(page, hero, mode); break; } catch (error) {
          if (attempt >= 3) throw error;
          console.log(`retrying ${hero.page} ${mode}: ${error.message}`);
        }
      }
    }
    await page.send('Page.close').catch(() => {});
  }
  writeFileSync(join(masterDir, 'report.json'), JSON.stringify({ origin, scene: SCENE, shot: SHOT, view: VIEW, densities: DENSITIES, renders: report }, null, 2));
} finally {
  browser.child.kill();
}

async function capture(page, { page: name, character, pose, query }, mode) {
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?screen=mentor-stage&character=${character}&${query}&scene=${SCENE}&shot=${SHOT}&theme=${mode}&locale=en-US` });
  let ready = false;
  for (let n = 0; n < 480 && !ready; n++) {
    await wait(250);
    await page.evaluate(`(() => {
      const stage = document.querySelector('.lf-mentor-stage');
      if (stage && !stage.dataset.pinned) {
        stage.dataset.pinned = '1';
        stage.style.cssText = 'position:fixed;inset:0;inline-size:100vw;block-size:100vh;z-index:2147483647;border-radius:0;';
      }
      if (typeof window.__stepFrames === 'function') window.__stepFrames(2);
    })()`).catch(() => {});
    ready = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return !!s && s.dataset.ready === 'true' && s.dataset.renderMode === 'held' && !s.dataset.stillPose; })()`).catch(() => false);
  }
  if (!ready) throw new Error(`${name}/${mode}: the held stage never became ready`);
  for (let s = 0; s < 6; s++) { await page.evaluate('window.__stepFrames(60)'); await wait(40); }
  const state = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return s ? { ...s.dataset } : {}; })()`);
  if (state.renderMode !== 'held' || state.mentorCharacter !== character || state.mentorPose !== pose) throw new Error(`${name}/${mode}: ${JSON.stringify(state)}`);
  const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: VIEW.width, height: VIEW.height, scale: 1 }, captureBeyondViewport: false });
  const master = join(masterDir, fileOf(name, mode, 'png', 3));
  writeFileSync(master, Buffer.from(shot.data, 'base64'));
  for (const density of DENSITIES) {
    const file = join(outDir, fileOf(name, mode, 'webp', density));
    await sharp(master).resize(VIEW.width * density, VIEW.height * density, { fit: 'cover', kernel: 'lanczos3' }).webp({ quality: 72, effort: 6 }).toFile(file);
    report.push({ page: name, mode, character, pose, density, type: 'webp', bytes: statSync(file).size });
  }
  const png = join(outDir, fileOf(name, mode, 'png'));
  await sharp(master).resize(VIEW.width, VIEW.height, { fit: 'cover', kernel: 'lanczos3' }).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(png);
  report.push({ page: name, mode, character, pose, density: 1, type: 'png', bytes: statSync(png).size });
  console.log(`rendered ${name} ${mode}: ${report.filter((row) => row.page === name && row.mode === mode).map((row) => `${row.type}@${row.density}x ${Math.ceil(row.bytes / 1024)} KB`).join(', ')}`);
}
