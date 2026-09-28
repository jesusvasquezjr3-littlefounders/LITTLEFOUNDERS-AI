import { existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * The Mentor stage's per-state stills (Frontend Bible 08 §3, §7; 07 §4), locally
 * and at zero spend: no image model, no paid service.
 *
 * 08 §7: in the fallback (low-power device, no WebGL, data saver, a device that
 * cannot hold 30 fps, a failed renderer) the stage shows "pre-rendered stills
 * and short sequences from the same models and catalogue poses", and while the
 * live model loads "a pre-rendered still of the same character and pose". Each
 * picture here is the rebuilt Mentor stage itself (`MentorStage`), rendering the
 * character's runtime model (`/scenes/<character>.glb`) in ONE catalogue pose,
 * standing on its Diorama, in both colour modes: one still per pose the full
 * stage can play (`stageStates.ts`: the nine states of 08 §3 and §11 in the expressive
 * and the calm register, and the closing gesture for each C.16 script).
 *
 * The pose is captured HELD: the capture tab asks for reduced motion, so the
 * engine holds each gesture at its one representative frame (the same frame a
 * learner with reduced motion sees; 08 §7), instead of catching a moving clip
 * at an arbitrary instant.
 *
 * A VIRTUAL CLOCK, as in render-mentor-chooser.mjs: under the software
 * rasteriser the renderer would measure a low frame rate and demote itself;
 * stepping every frame exactly 1/60 s apart lets it reach its high tier. Only
 * the capture tab is affected.
 *
 * Framing follows the live stage's own default (`defaultStageShot`): the
 * close-up on `diorama-a` for Dr. Rho, Zara and Liruf, and the wide close-up
 * for Dina there, framed in a landscape viewport and cut from its centre (as
 * the chooser does). The files are drafts: `src/rebuild/assets/manifest.json`
 * registers them (`mentor.stageStill`) with `reviewStatus: "draft"` until the
 * owner approves the character-render family (07 §7, OD-14).
 *
 * Prerequisites (gitignored): the runtime models in `public/scenes/` and the
 * Basis transcoder in `public/basis/`; a Vite dev server:
 *   REBUILD_URL=http://localhost:5540 node scripts/render-mentor-stage-stills.mjs
 * Env: STILL_CHARACTERS=rho,zara, STILL_MODES=light, STILL_POSES=think.ponder (subsets); STILL_MANIFEST=1 prints the
 * manifest rows for what exists on disk (no browser).
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5540';
const CHARACTERS = process.env.STILL_CHARACTERS?.split(',') ?? ['rho', 'zara', 'liruf', 'dina'];
const MODES = process.env.STILL_MODES?.split(',') ?? ['light', 'dark'];

/** One request to the preview per catalogue pose the full stage can play (`stageStates.ts`). */
export const STAGE_STILL_POSES = [
  { pose: 'ambient.idle', query: 'state=idle&age=6-9' },
  { pose: 'ambient.listen', query: 'state=listening&age=6-9' },
  { pose: 'think.ponder', query: 'state=thinking&age=6-9' },
  { pose: 'teach.aside', query: 'state=thinking&age=13-17' },
  { pose: 'ambient.idle.happy', query: 'state=speaking&age=6-9' },
  { pose: 'teach.explain', query: 'state=demonstrating&age=6-9' },
  { pose: 'feedback.retry.gentle', query: 'state=encouraging&age=6-9' },
  { pose: 'celebrate.with', query: 'state=celebrating&milestone=lesson-complete&age=6-9' },
  { pose: 'celebrate.applaud', query: 'state=celebrating&milestone=lesson-complete&age=13-17' },
  { pose: 'transition.close.warm', query: 'state=closing&closing=completed&age=6-9' },
  { pose: 'transition.exit', query: 'state=closing&closing=learner_left&age=6-9' },
  { pose: 'transition.pause', query: 'state=closing&closing=safety_stop&age=6-9' },
  // GAP-FIX-R2: the `acknowledging` state (08 §11, a met answer): the quiet happy pose and the calm register's nod.
  { pose: 'feedback.correct.quiet', query: 'state=acknowledging&age=6-9' },
  { pose: 'greet.nod', query: 'state=acknowledging&age=13-17' },
];
const POSES = process.env.STILL_POSES ? STAGE_STILL_POSES.filter((row) => process.env.STILL_POSES.split(',').includes(row.pose)) : STAGE_STILL_POSES;

const SCENE = 'diorama-a';
const SHOTS = { rho: 'closeup', zara: 'closeup', liruf: 'closeup', dina: 'closeup-wide' };
const WIDE = new Set(['dina']);
const VIEW = { width: 400, height: 500 }; // 4:5, captured at dpr 2
const WIDE_VIEW = { width: 700, height: 500 };
const OUT = { width: 400, height: 500 }; // delivered: a phone stage at dpr 1, covered on wider stages
const outDir = resolve('public/rebuild/mentor-stage');
const masterDir = resolve('../audit-results/mentor-stage-masters');
const fileOf = (character, pose, mode) => `${character}-${pose.replace(/\./g, '-')}-${mode}.png`;

if (process.env.STILL_MANIFEST === '1') {
  const rows = [];
  for (const character of CHARACTERS) for (const { pose } of STAGE_STILL_POSES) for (const mode of MODES) {
    const file = join(outDir, fileOf(character, pose, mode));
    let kb;
    try { kb = Math.ceil(statSync(file).size / 1024); } catch { continue; }
    rows.push(JSON.stringify({
      id: `mentor.${character}.stage.${pose}.${mode}`, class: 'B', type: 'render', path: `/rebuild/mentor-stage/${fileOf(character, pose, mode)}`,
      slot: 'mentor.stageStill', aspect: '4:5', modes: mode, character, poseId: pose, sourceModel: `/scenes/${character}.glb`, altKey: 'decorative',
      sizesKb: kb + 2, motionTokens: [],
      generatedBy: `local render: scripts/render-mentor-stage-stills.mjs (MentorStage on ${SCENE}, ${SHOTS[character]}, held pose, virtual clock)`,
      reviewFamily: 'character-renders', reviewStatus: 'draft', approvedBy: null,
    }).replace(/^\{/, '{ ').replace(/\}$/, ' }').replace(/,"/g, ', "').replace(/":/g, '": '));
  }
  console.log(rows.map((row) => `  ${row},`).join('\n'));
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
    await page.send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: 2, mobile: true });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
    for (const character of CHARACTERS) {
      const view = WIDE.has(character) ? WIDE_VIEW : VIEW;
      await page.send('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: 2, mobile: true });
      for (const { pose, query } of POSES) {
        // Resumable: a still already on disk is kept (STILL_FORCE=1 renders it again).
        if (process.env.STILL_FORCE !== '1' && existsSync(join(outDir, fileOf(character, pose, mode)))) continue;
        // A dev-server reload mid-capture (an edit elsewhere) loses the page: try again, up to three times.
        for (let attempt = 1; ; attempt++) {
          try { await capture(page, view, character, pose, query, mode); break; } catch (error) {
            if (attempt >= 3) throw error;
            console.log(`retrying ${character} ${pose} ${mode}: ${error.message}`);
          }
        }
      }
    }
    await page.send('Page.close').catch(() => {});
  }
  writeFileSync(join(masterDir, `report-${CHARACTERS.join('-')}.json`), JSON.stringify({ origin, scene: SCENE, shots: SHOTS, view: VIEW, out: OUT, renders: report }, null, 2));
} finally {
  browser.child.kill();
}

async function capture(page, view, character, pose, query, mode) {
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?screen=mentor-stage&character=${character}&${query}&scene=${SCENE}&shot=${SHOTS[character]}&theme=${mode}&locale=en-US` });
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
  if (!ready) {
    // Evidence for the retry log: what the page showed instead.
    const seen = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return s ? JSON.stringify({ ...s.dataset }) : document.body.innerText.slice(0, 200); })()`).catch(() => 'no page');
    const debug = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
    if (debug) writeFileSync(join(masterDir, `debug-${fileOf(character, pose, mode)}`), Buffer.from(debug.data, 'base64'));
    throw new Error(`${character}/${pose}/${mode}: the held stage never became ready (${seen})`);
  }
  // 6 virtual seconds: the renderer promotes its tier, the camera settles, the light rig eases in (a held pose needs no more).
  for (let s = 0; s < 6; s++) { await page.evaluate('window.__stepFrames(60)'); await wait(40); }
  const state = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return s ? { ...s.dataset } : {}; })()`);
  if (state.renderMode !== 'held' || state.mentorCharacter !== character || state.mentorPose !== pose) throw new Error(`${character}/${pose}/${mode}: ${JSON.stringify(state)}`);
  const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: (view.width - VIEW.width) / 2, y: 0, width: VIEW.width, height: VIEW.height, scale: 1 }, captureBeyondViewport: false });
  const master = join(masterDir, fileOf(character, pose, mode));
  writeFileSync(master, Buffer.from(shot.data, 'base64'));
  const file = join(outDir, fileOf(character, pose, mode));
  await sharp(master).resize(OUT.width, OUT.height, { fit: 'cover', kernel: 'lanczos3' })
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(file);
  const bytes = statSync(file).size;
  report.push({ character, mode, pose, scene: SCENE, shot: SHOTS[character], bytes });
  console.log(`rendered ${character} ${pose} ${mode}: ${Math.ceil(bytes / 1024)} KB`);
}
