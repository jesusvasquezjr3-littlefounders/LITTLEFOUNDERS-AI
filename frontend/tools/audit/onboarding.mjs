// Walks the onboarding in a real browser, both walks, with the keyboard only, and checks every screen: axe-core (the
// same rule set as audit:a11y), where the focus lands, that every target is large enough to press, that nothing spills
// sideways, and that the composition's video is there and playing. Screenshots of every screen are saved to look at.
//
// Needs the dev server (`npm run dev` here). With `--account` it also creates an account at the end as a child of 9,
// to check that the answers reach it and that the permission box is still asked: that needs the whole local stack
// (the database with its mail catcher, Core and the mail service; see docs/operations/ENVIRONMENT-SETUP.md).
//
//   npm run audit:onboarding                                 the learner's walk: light, en-US, 1440 px
//   npm run audit:onboarding -- --walk parent --width 390 --lang es-MX --theme dark
//   npm run audit:onboarding -- --matrix                     both walks at 320, 390, 768 and 1440 px, the three languages
//   npm run audit:onboarding -- --account                    add the sign-up of a 9-year-old at the end
//
// Files go to frontend/audit-out/onboarding/ (not tracked).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, launch, parseArgs, sleep } from './lib.mjs';

const args = parseArgs();
const out = join(dirname(fileURLToPath(import.meta.url)), '../../audit-out/onboarding');
const SITE = typeof args.url === 'string' ? args.url.replace(/\/+$/, '') : 'http://localhost:5173';
const MAILPIT = typeof args.mailpit === 'string' ? args.mailpit : 'http://localhost:8025';
const CORE = typeof args.core === 'string' ? args.core : 'http://localhost:4000';

mkdirSync(out, { recursive: true });

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
// With the sign-in window open Radix hides the rest of the page, so these four appear and are not counted (see a11y.mjs).
const EXPECTED_BEHIND_A_WINDOW = new Set(['aria-hidden-focus', 'landmark-one-main', 'page-has-heading-one', 'region']);
const AXE = `(async () => {
  const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
  return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
})()`;

// What a screen looks like to the checks.
const STATE = `(() => {
  const active = document.activeElement;
  const video = document.querySelector('main video');
  const art = document.querySelector('main [role="img"]');
  const small = [...document.querySelectorAll('header button, header a, main button, main a, main input')].filter((e) => e.offsetParent !== null).filter((e) => { const r = e.getBoundingClientRect(); return r.height < 47.5 || r.width < 47.5; }).map((e) => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30));
  const cut = [...document.querySelectorAll('main h1, main p, main span, main label, main button')].filter((e) => e.offsetParent !== null && (e.scrollWidth > e.clientWidth + 1) && getComputedStyle(e).overflow !== 'visible').map((e) => e.textContent.trim().slice(0, 30));

  return {
    step: new URLSearchParams(location.search).get('step'),
    path: location.pathname,
    focus: active === document.body ? 'body' : active.tagName === 'H1' ? 'title' : active.tagName === 'INPUT' ? 'field' : active.tagName.toLowerCase(),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    artShown: art !== null && art.offsetParent !== null,
    artLabel: art?.getAttribute('aria-label') ?? '',
    videoPlaying: video ? !video.paused && video.readyState >= 2 : null,
    small,
    cut,
    progress: document.querySelector('[role="progressbar"]')?.getAttribute('aria-label') ?? '',
    answersInAddress: location.search.replace(/[?&]step=[a-z]+/, '') !== '',
  };
})()`;

let failures = 0;
const fail = (where, what) => { failures++; console.log(`  FAILED ${where}: ${what}`); };

async function codeFor(email) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const found = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`)).json();

    if (found.messages?.[0]) return (await (await fetch(`${MAILPIT}/api/v1/message/${found.messages[0].ID}`)).json()).Text.match(/\b(\d{6})\b/)[1];

    await sleep(400);
  }

  throw new Error(`No code arrived for ${email}. Is the whole stack running?`);
}

/** Walks one path with the keyboard only. Returns the page at the last step. */
async function walk(browser, { walkName, theme, lang, width, age, name, mentorIndex }) {
  const tag = `${walkName}-${width}-${lang}-${theme}`;
  const page = await browser.newPage({ theme, lang, width, url: `${SITE}/onboarding${walkName === 'parent' ? '/parent' : ''}`, settle: 3500 });

  // start clean: nothing this browser kept from an earlier walk
  await page.ev('localStorage.removeItem("lf.onboarding")');
  await page.call('Page.navigate', { url: `${SITE}/onboarding${walkName === 'parent' ? '/parent' : ''}` });
  await sleep(3200);
  await page.ev(axeSource);

  let count = 0;
  const seen = [];
  const examine = async () => {
    await sleep(1300);

    const state = await page.ev(STATE);
    const where = `[${tag}] ${state.step}`;

    count++;
    seen.push(state.step);
    writeFileSync(join(out, `${tag}-${String(count).padStart(2, '0')}-${state.step}.png`), await page.screenshot());

    for (const v of await page.ev(AXE)) fail(where, `${v.impact} ${v.id}: ${v.help} (${v.nodes.join(', ')})`);

    if (state.overflow) fail(where, 'the page scrolls sideways');
    if (state.small.length > 0) fail(where, `targets under 48 px: ${state.small.join(' | ')}`);
    if (state.cut.length > 0) fail(where, `text cut: ${state.cut.join(' | ')}`);
    if (state.answersInAddress) fail(where, 'the address carries more than the step');
    if (!state.progress) fail(where, 'the progress bar has no name');
    // the title takes the focus on a screen with nothing to type; a field takes it where there is one
    if (!['title', 'field'].includes(state.focus)) fail(where, `focus is on ${state.focus}, expected the title or the field`);

    // the composition: hidden only when choosing a mentor on a narrow screen, otherwise there, named and moving
    const hiddenOnPurpose = state.step === 'mentor' && width < 1024;

    if (state.artShown === hiddenOnPurpose) fail(where, hiddenOnPurpose ? 'the group should be hidden here on a phone' : 'the composition is missing');
    if (state.artShown && !state.artLabel) fail(where, 'the composition has no description');
    if (state.artShown && state.videoPlaying === false) fail(where, 'the video is not playing');

    return state;
  };
  /** Tab until the focus is on what `test` describes, as a person with a keyboard would. */
  const tabTo = async (test, label) => {
    for (let i = 0; i < 14; i++) {
      if (await page.ev(`(() => { const e = document.activeElement; return ${test}; })()`)) return true;

      await page.press('Tab');
    }

    fail(`[${tag}]`, `the keyboard never reached ${label}`);

    return false;
  };
  const PRIMARY = `e.closest('main') !== null && (e.tagName === 'BUTTON' || e.tagName === 'A') && !e.disabled && !e.hasAttribute('aria-pressed')`;
  const pressPrimary = async () => { if (await tabTo(PRIMARY, 'the main button')) await page.press('Enter'); };

  await examine();
  await pressPrimary();

  let state = await examine();

  if (state.step !== 'age') fail(`[${tag}]`, `expected the age step, got ${state.step}`);

  await page.call('Input.insertText', { text: String(age) });
  await sleep(250);
  await page.press('Enter');
  state = await examine();

  if (state.step === 'minor') {
    await pressPrimary();
    await sleep(900);
    state = await examine();

    if (state.path !== '/onboarding') fail(`[${tag}]`, 'a minor on the parent walk was not taken to the learner walk');
  }

  if (state.step !== 'name') fail(`[${tag}]`, `expected the name step, got ${state.step}`);

  await page.call('Input.insertText', { text: name });
  await sleep(250);
  await page.press('Enter');
  state = await examine();

  if (state.step !== 'mentor') fail(`[${tag}]`, `expected the mentor step, got ${state.step}`);

  // choose a mentor with the keyboard: Tab to the cards, on to the one wanted, Enter, then the button
  if (await tabTo(`e.hasAttribute('aria-pressed')`, 'a mentor card')) {
    for (let i = 0; i < mentorIndex; i++) await page.press('Tab');

    await page.press('Enter');
    await sleep(300);

    if (!(await page.ev(`document.activeElement.getAttribute('aria-pressed') === 'true'`))) fail(`[${tag}] mentor`, 'Enter did not choose the card');
  }

  await pressPrimary();

  for (let i = 0; i < 8; i++) {
    state = await examine();

    if (state.step === 'join') break;

    await pressPrimary();
  }

  if (state.step !== 'join') fail(`[${tag}]`, `never reached the last step: ${seen.join(' > ')}`);

  console.log(`[${tag}] ${seen.join(' > ')}`);

  return { page, tag };
}

const browser = await launch();

try {
  const walks = typeof args.walk === 'string' ? [args.walk] : args.matrix ? ['learner', 'parent'] : ['learner'];
  const configs = args.matrix
    ? [320, 390, 768, 1440].flatMap((width, i) => LOCALES.map((lang, j) => ({ width, lang, theme: (i + j) % 2 ? 'dark' : 'light' })))
    : [{ width: Number(args.width ?? 1440), lang: args.lang ?? 'en-US', theme: args.theme ?? 'light' }];

  for (const walkName of walks) {
    for (const [i, config] of configs.entries()) {
      const { page } = await walk(browser, { walkName, ...config, age: walkName === 'parent' ? 40 : 15, name: 'Sofía', mentorIndex: i % 4 });

      await page.close();
    }
  }

  // A parent who is under 18: taken to the learner's walk.
  if (args.matrix) {
    const { page } = await walk(browser, { walkName: 'parent', width: 390, lang: 'es-MX', theme: 'light', age: 16, name: 'Max', mentorIndex: 1 });

    await page.close();
  }

  // A child of 9 creates the account at the end: the window still asks the age, already filled in, for the permission box.
  if (args.account) {
    const { page, tag } = await walk(browser, { walkName: 'learner', width: 390, lang: 'es-MX', theme: 'light', age: 9, name: 'Nico', mentorIndex: 2 });
    const DIALOG = `document.querySelector('[data-slot="dialog-content"]')`;
    const email = `onb9-${Date.now()}@example.test`;
    const shot = async (label) => { await sleep(900); writeFileSync(join(out, `${tag}-account-${label}.png`), await page.screenshot()); };
    const axe = async (label) => { for (const v of (await page.ev(AXE)).filter((found) => !EXPECTED_BEHIND_A_WINDOW.has(found.id))) fail(`[${tag}] ${label}`, `${v.impact} ${v.id}: ${v.help}`); };

    await page.ev(`[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && !b.className.includes('-ghost')).click()`);
    await sleep(1800);
    await shot('1-ways');
    await axe('ways to join');

    if (!(await page.ev(`[...${DIALOG}.querySelectorAll('button')].some((b) => /google/i.test(b.textContent))`))) fail(`[${tag}]`, 'the last step does not offer Google');

    await page.ev(`[...${DIALOG}.querySelectorAll('button')].find((b) => /correo|email|e-mail/i.test(b.textContent)).click()`);
    await sleep(900);
    await page.ev(`${DIALOG}.querySelector('input').focus()`);
    await page.call('Input.insertText', { text: email });
    await sleep(300);
    await page.ev(`${DIALOG}.querySelector('button[type="submit"]').click()`);
    await sleep(2500);
    await page.ev(`${DIALOG}.querySelector('input[autocomplete="one-time-code"]').focus()`);
    await page.call('Input.insertText', { text: await codeFor(email) });
    await sleep(3500);
    await shot('2-age-prefilled');
    await axe('age step');

    const ageStep = await page.ev(`(() => { const d = ${DIALOG}; const i = d?.querySelector('input[inputmode="numeric"]:not([autocomplete="one-time-code"])'); return { value: i?.value ?? null, box: d?.querySelector('[data-slot="checkbox"]') !== null, disabled: d?.querySelector('button[type="submit"]')?.disabled ?? null }; })()`);

    if (ageStep.value !== '9') fail(`[${tag}]`, `the age step should show 9 already, shows ${ageStep.value}`);
    if (!ageStep.box || ageStep.disabled !== true) fail(`[${tag}]`, 'under 13 the permission box must be there and the button must wait for it');

    await page.ev(`${DIALOG}.querySelector('[data-slot="checkbox"]').click()`);
    await sleep(300);
    await page.ev(`${DIALOG}.querySelector('button[type="submit"]').click()`);
    await sleep(5000);
    await shot('3-done');

    const account = await page.ev(`fetch('${CORE}/api/v1/auth/session', { credentials: 'include' }).then((r) => r.json()).then((j) => j.data?.account ?? null)`);
    const after = await page.ev(`({ path: location.pathname, kept: localStorage.getItem('lf.onboarding') })`);

    if (!account || account.displayName !== 'Nico' || account.mentor !== 'liruf' || account.type !== 'child' || account.needsAge) fail(`[${tag}]`, `the account did not get the answers: ${JSON.stringify(account)}`);
    if (after.kept !== null) fail(`[${tag}]`, 'the answers are still in the browser after the account took them');
    if (after.path !== '/') fail(`[${tag}]`, `expected the home page at the end, got ${after.path}`);

    console.log(`[${tag}] account: ${JSON.stringify(account && { name: account.displayName, mentor: account.mentor, type: account.type, locale: account.locale })}`);

    // Google at the last step: Core must answer the start with a redirect (to Google when it is configured, back to
    // the site with "unavailable" when it is not). The round trip itself needs a Google client (T-019).
    const google = await fetch(`${CORE}/api/v1/auth/google/start?mode=popup`, { redirect: 'manual' });

    console.log(`[${tag}] Google start: ${google.status} -> ${(google.headers.get('location') ?? '').split('?')[0]}`);

    if (google.status !== 303) fail(`[${tag}]`, 'Core did not answer the Google start with a redirect');

    await page.close();
  }
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nonboarding: no findings.' : `\nonboarding: ${failures} finding(s).`);
process.exitCode = failures === 0 ? 0 : 1;
