import { existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * The compact lesson stage's band stills (Frontend Bible 08 §7, §11; 07 §4;
 * B.8; 02 rule 21), locally and at zero spend: no image model, no paid service.
 *
 * 08 §11 puts the learner's chosen character on the edge of its Diorama inside
 * the lesson band, and 08 §7 says the fallback (while the live model loads, and
 * instead of it on a low-power device, without WebGL or with data saver on)
 * keeps the same layout: a pre-rendered still of the same character and pose.
 * Only Dina had band stills; the other three fell back to the square avatar
 * head crop with no Diorama. This renders every character's band stills.
 *
 * Each picture is the rebuilt Mentor stage itself (`MentorStage`, size
 * `compact`), rendering the character's runtime model (`/scenes/<character>.glb`)
 * on `diorama-a` with the compact stage's own shot (`defaultStageShot` for
 * `compact`: the wide close-up), in one catalogue pose, in both colour modes,
 * framed by a viewport of the band's own shape:
 *
 *   young   343:110  the 6-12 band (expressive register)
 *   teen    343:80   the 13+ band (calm register)
 *   square  1:1      the side column of the wide layout (either register)
 *
 * One still per pose the compact stage can show (`stageStates.ts`: idle,
 * thinking, speaking, encouraging, demonstrating and acknowledging, in the
 * register the band belongs to), so the fallback shows the state the stage is
 * in. The pose is captured HELD (reduced motion emulated) on a VIRTUAL CLOCK,
 * as in render-mentor-stage-stills.mjs, so the software rasteriser does not
 * demote the renderer and the gesture is caught at its representative frame.
 *
 * The files are drafts: `src/rebuild/assets/manifest.json` registers them
 * (`lesson.compactMentorStill`) with `reviewStatus: "draft"` until the owner
 * approves the character-render family (07 §7, OD-14).
 *
 * Prerequisites (gitignored): the runtime models in `public/scenes/` and the
 * Basis transcoder in `public/basis/`; a Vite dev server:
 *   REBUILD_URL=http://localhost:5820 node scripts/render-mentor-lesson-stills.mjs
 * Env: STILL_CHARACTERS=rho,zara, STILL_MODES=light, STILL_POSES=think.ponder, STILL_BANDS=young (subsets);
 * STILL_FORCE=1 renders files already on disk again; STILL_MANIFEST=1 prints the manifest rows for what exists on disk.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5820';
const CHARACTERS = process.env.STILL_CHARACTERS?.split(',') ?? ['rho', 'zara', 'liruf', 'dina'];
const MODES = process.env.STILL_MODES?.split(',') ?? ['light', 'dark'];

/** Every pose the compact stage can hold, with the preview request that plays it (`stageStates.ts`). */
export const LESSON_STILL_POSES = [
  { pose: 'ambient.idle', young: 'state=idle&age=6-9', teen: 'state=idle&age=13-17' },
  { pose: 'think.ponder', young: 'state=thinking&age=6-9' },
  { pose: 'teach.aside', teen: 'state=thinking&age=13-17' },
  { pose: 'ambient.idle.happy', young: 'state=speaking&age=6-9', teen: 'state=speaking&age=13-17' },
  { pose: 'feedback.retry.gentle', young: 'state=encouraging&age=6-9' },
  { pose: 'ambient.listen', teen: 'state=encouraging&age=13-17' },
  { pose: 'teach.explain', young: 'state=demonstrating&age=6-9', teen: 'state=demonstrating&age=13-17' },
  { pose: 'feedback.correct.quiet', young: 'state=acknowledging&age=6-9' },
  { pose: 'greet.nod', teen: 'state=acknowledging&age=13-17' },
];

/** The band shapes: capture viewport (CSS px, dpr 2) and delivered size. */
export const LESSON_BANDS = {
  young: { aspect: '343:110', view: { width: 343, height: 110 }, out: { width: 686, height: 220 } },
  teen: { aspect: '343:80', view: { width: 343, height: 80 }, out: { width: 686, height: 160 } },
  square: { aspect: '1:1', view: { width: 304, height: 304 }, out: { width: 456, height: 456 } },
};
const BANDS = process.env.STILL_BANDS?.split(',') ?? Object.keys(LESSON_BANDS);

/** Which bands show a pose: the band's own register, and the square (the wide layout serves every register). */
const bandsFor = (row) => [...(row.young ? ['young'] : []), ...(row.teen ? ['teen'] : []), 'square'].filter((band) => BANDS.includes(band));
const POSES = process.env.STILL_POSES
  ? LESSON_STILL_POSES.filter((row) => process.env.STILL_POSES.split(',').includes(row.pose)) : LESSON_STILL_POSES;

const SCENE = 'diorama-a';
const SHOT = 'closeup-wide';
const outDir = resolve('public/rebuild/mentor-stills');
const masterDir = resolve('../audit-results/mentor-lesson-still-masters');
export const lessonStillFile = (character, band, pose, mode) => `${character}-${band}-${pose.replace(/\./g, '-')}-${mode}.png`;
export const lessonStillId = (character, band, pose, mode) => `lesson.${character}.${band}.${pose}.${mode}`;

if (process.env.STILL_MANIFEST === '1') {
  const rows = [];
  for (const character of CHARACTERS) for (const row of LESSON_STILL_POSES) for (const band of bandsFor(row)) for (const mode of MODES) {
    const file = join(outDir, lessonStillFile(character, band, row.pose, mode));
    let kb;
    try { kb = Math.ceil(statSync(file).size / 1024); } catch { continue; }
    rows.push(JSON.stringify({
      id: lessonStillId(character, band, row.pose, mode), class: 'B', type: 'render', path: `/rebuild/mentor-stills/${lessonStillFile(character, band, row.pose, mode)}`,
      slot: 'lesson.compactMentorStill', aspect: LESSON_BANDS[band].aspect, modes: mode, character, poseId: row.pose, sourceModel: `/scenes/${character}.glb`, altKey: 'decorative',
      sizesKb: kb + 2, motionTokens: [],
      generatedBy: `local render: scripts/render-mentor-lesson-stills.mjs (MentorStage compact on ${SCENE}, ${SHOT}, held pose, virtual clock)`,
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
    const page = await openPage(browser.browser, { width: 343, height: 110, dark: mode === 'dark' });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (!await warmDevServer(page, origin)) throw new Error('The dev server never mounted the app');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: VIRTUAL_CLOCK });
    for (const character of CHARACTERS) {
      for (const row of POSES) {
        for (const band of bandsFor(row)) {
          if (process.env.STILL_FORCE !== '1' && existsSync(join(outDir, lessonStillFile(character, band, row.pose, mode)))) continue;
          const query = band === 'square' ? (row.young ?? row.teen) : row[band];
          for (let attempt = 1; ; attempt++) {
            try { await capture(page, character, band, row.pose, query, mode); break; } catch (error) {
              if (attempt >= 3) throw error;
              console.log(`retrying ${character} ${band} ${row.pose} ${mode}: ${error.message}`);
            }
          }
        }
      }
    }
    await page.send('Page.close').catch(() => {});
  }
  writeFileSync(join(masterDir, `report-${CHARACTERS.join('-')}.json`), JSON.stringify({ origin, scene: SCENE, shot: SHOT, bands: LESSON_BANDS, renders: report }, null, 2));
} finally {
  browser.child.kill();
}

async function capture(page, character, band, pose, query, mode) {
  const { view, out } = LESSON_BANDS[band];
  await page.send('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: 2, mobile: true });
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?screen=mentor-stage&size=compact&character=${character}&${query}&scene=${SCENE}&shot=${SHOT}&theme=${mode}&locale=en-US` });
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
  const file = lessonStillFile(character, band, pose, mode);
  if (!ready) {
    const seen = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return s ? JSON.stringify({ ...s.dataset }) : document.body.innerText.slice(0, 200); })()`).catch(() => 'no page');
    throw new Error(`${file}: the held compact stage never became ready (${seen})`);
  }
  // 6 virtual seconds: the renderer promotes its tier, the camera settles, the light rig eases in.
  for (let s = 0; s < 6; s++) { await page.evaluate('window.__stepFrames(60)'); await wait(40); }
  const state = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return s ? { ...s.dataset } : {}; })()`);
  if (state.renderMode !== 'held' || state.mentorCharacter !== character || state.mentorPose !== pose || state.mentorStage !== 'compact') {
    throw new Error(`${file}: ${JSON.stringify(state)}`);
  }
  const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: view.width, height: view.height, scale: 1 }, captureBeyondViewport: false });
  const master = join(masterDir, file);
  writeFileSync(master, Buffer.from(shot.data, 'base64'));
  const target = join(outDir, file);
  await sharp(master).resize(out.width, out.height, { fit: 'cover', kernel: 'lanczos3' })
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(target);
  const bytes = statSync(target).size;
  report.push({ character, band, mode, pose, scene: SCENE, shot: SHOT, bytes });
  console.log(`rendered ${file}: ${Math.ceil(bytes / 1024)} KB`);
}
