// Walks the signed-in application end to end in a real browser, the way a person does: no call to Core is made
// by this tool, every step is a click, a key or a drag on the page. It creates one synthetic account.
//
// What it walks:
//   1. a visitor who opens /home is sent to the site with the sign-in window open;
//   2. signing up from the site (email, code, age) leads to choosing a name and a mentor, with no second question
//      about the age, and then lands on /home;
//   3. the pile: a tap on the cover, the arrow keys, a drag to each side, and a tap on a card that leads somewhere;
//   4. the menu: a destination opens, the sidebar collapses and stays collapsed after a reload (desktop), the dock (phone);
//   5. coming back: a reload of /home stays in, and the site shows a signed-in person the green "keep learning" button
//      in place of its calls to start, which goes to /home;
//   6. signing out from the account menu lands on the site, with no window opened on the person;
//   7. signing in again (no age step this time) lands on /home.
//
// Needs everything running locally: the Supabase stack with its mail catcher (`npm run db:up` in database/), Core
// (`npm run dev` in backend/), the mail service (`npm run dev` in email-server/) and the dev server (`npm run dev` here).
//
//   npm run audit:app                                     1440 and 390 px, light, es-MX
//   npm run audit:app -- --width 390 --lang en-US --theme dark
//
// Screenshots go to frontend/audit-out/app/ (not tracked). The onboarding's own walk ends in the application too:
// `npm run audit:onboarding -- --account` checks that ending.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, parseArgs, run, sleep } from './lib.mjs';

const args = { lang: 'es-MX', ...parseArgs() };
const out = join(dirname(fileURLToPath(import.meta.url)), '../../audit-out/app');
const MAILPIT = typeof args.mailpit === 'string' ? args.mailpit : 'http://localhost:8025';
const DIALOG = `document.querySelector('[data-slot="dialog-content"]')`;
const TOP = `document.querySelector('[data-deck] [data-top]')`;

mkdirSync(out, { recursive: true });

/** The newest six-digit code the mail catcher holds for an address, sent after `since`. */
async function codeFor(email, since) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const found = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=5`)).json();
    const fresh = (found.messages ?? []).filter((message) => new Date(message.Created).getTime() >= since);

    if (fresh[0]) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json();
      const match = `${message.Text ?? ''}`.match(/\b(\d{6})\b/);

      if (match) return match[1];
    }

    await sleep(500);
  }

  throw new Error(`No code arrived for ${email}. Are the mail service and the mail catcher running?`);
}

await run('app', args, async (page, config) => {
  const isPhone = config.width < 1024;
  const tag = `${config.width}-${config.lang}-${config.theme}`;
  const problems = [];
  const expect = async (label, expression, show) => {
    if (await page.ev(expression)) return;

    problems.push(show ? `${label} (${JSON.stringify(await page.ev(show))})` : label);
  };
  const shot = async (step) => { await sleep(500); writeFileSync(join(out, `${tag}-${step}.png`), await page.screenshot()); };
  const path = () => page.ev('location.pathname');
  const go = async (to) => { await page.call('Page.navigate', { url: new URL(to, config.url).href }); await sleep(4000); };
  const type = async (selector, text) => {
    await page.ev(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await page.call('Input.insertText', { text });
    await sleep(300);
  };
  const key = async (name, code, keyCode) => {
    for (const kind of ['keyDown', 'keyUp']) await page.call('Input.dispatchKeyEvent', { type: kind, key: name, code, windowsVirtualKeyCode: keyCode, ...(name === 'Enter' && kind === 'keyDown' ? { text: String.fromCharCode(13) } : {}) });

    await sleep(900);
  };
  const mouse = (kind, x, y, buttons) => page.call('Input.dispatchMouseEvent', { type: kind, x, y, button: kind === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: kind === 'mouseMoved' ? 0 : 1, pointerType: 'mouse' });
  const middle = (expression) => page.ev(`(() => { const r = ${expression}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const tap = async (expression) => { const at = await middle(expression); await mouse('mouseMoved', at.x, at.y, 0); await mouse('mousePressed', at.x, at.y, 1); await mouse('mouseReleased', at.x, at.y, 0); await sleep(900); };
  /** Presses on the top card, carries it `by` pixels sideways and lets go. */
  const drag = async (by) => {
    const at = await middle(TOP);

    await mouse('mouseMoved', at.x, at.y, 0);
    await mouse('mousePressed', at.x, at.y, 1);

    for (let step = 1; step <= 10; step++) { await mouse('mouseMoved', at.x + (by * step) / 10, at.y, 1); await sleep(25); }

    await mouse('mouseReleased', at.x + by, at.y, 0);
    await sleep(1000);
  };
  const signIn = async (email, age) => {
    const since = Date.now() - 2000;

    await page.ev(isPhone && config.width < 768
      ? `document.querySelector('[data-cta="sign-in"]').click()`
      : `[...document.querySelectorAll('header button')].find((b) => /sign in|iniciar sesión|entrar/i.test(b.textContent)).click()`);
    await sleep(1200);
    await page.ev(`[...${DIALOG}.querySelectorAll('button')].find((b) => /email|correo|e-mail/i.test(b.textContent)).click()`);
    await sleep(800);
    await type('[data-slot="dialog-content"] input', email);
    await page.ev(`${DIALOG}.querySelector('button[type="submit"]').click()`);
    await sleep(3000);
    await type('[data-slot="dialog-content"] input[autocomplete="one-time-code"]', await codeFor(email, since));
    await sleep(3000);

    if (age === null) return;

    await expect('a new account is asked its age', `${DIALOG}?.querySelector('input[inputmode="numeric"]:not([autocomplete="one-time-code"])') != null`);
    await page.ev(`(() => { const input = ${DIALOG}.querySelector('input[inputmode="numeric"]'); input.focus(); input.select(); })()`);
    await page.call('Input.insertText', { text: String(age) });
    await sleep(500);
    await page.ev(`${DIALOG}.querySelector('button[type="submit"]').click()`);
    await sleep(4000);
  };
  const email = `app${Date.now()}${config.width}@example.test`;

  // 1. a visitor
  await go('/home');
  await expect('a visitor who opens /home is sent to the site', `location.pathname === '/'`, 'location.pathname');
  await expect('with the sign-in window open', `${DIALOG} !== null`);
  await page.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await go('/');

  // 2. signing up from the site
  await signIn(email, 15);
  await expect('a new account is taken to choose its name and mentor', `location.pathname === '/onboarding'`, 'location.pathname');

  const walked = [];

  for (let turn = 0; turn < 20; turn++) {
    const step = await page.ev(`new URLSearchParams(location.search).get('step')`);

    walked.push(step);

    if (step === 'name') await type('main input', 'Nico');
    if (step === 'mentor') await page.ev(`document.querySelectorAll('main [aria-pressed], main [role=radio], main input[type=radio]')[2].click()`);

    await sleep(500);
    await page.ev(`[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && !b.disabled && !b.hasAttribute('aria-pressed') && b.getAttribute('role') !== 'radio' && !b.className.includes('-ghost')).click()`);
    await sleep(step === 'join' ? 4500 : 1700);

    if (step === 'join') break;
  }

  if (walked.includes('age')) problems.push('the onboarding asked the age of an account that had already said it');

  await shot('0-chosen');
  await expect('choosing a name and a mentor lands on /home', `location.pathname === '/home'`, 'location.pathname + location.search');
  await expect('greeted by the name just chosen', `/Nico/.test(document.querySelector('main h1')?.innerText ?? '')`, `document.querySelector('main h1')?.innerText`);
  await expect('the sign-in window is closed', `${DIALOG} === null`);
  await expect('the pile is dealt, cover on top', `${TOP}?.getAttribute('data-card') === 'cover'`, `${TOP}?.getAttribute('data-card') ?? 'no pile'`);
  await expect('the composition of the day is shown', `(() => { const v = document.querySelector('main video, main img'); return !!v && /\\/stage\\/loops\\/[a-z-]+-(light|dark)/.test(v.currentSrc || v.src || v.poster || ''); })()`);
  await shot('1-home');

  // 3. the pile, handled like cards
  await tap(TOP);
  await expect('a tap on the cover passes it', `${TOP}.getAttribute('data-card') === 'learn'`, `${TOP}.getAttribute('data-card')`);
  await shot('2-second-card');
  await drag(-200);
  await expect('a drag to the left passes a card', `${TOP}.getAttribute('data-card') === 'mentor'`, `${TOP}.getAttribute('data-card')`);
  await drag(200);
  await expect('a drag to the right brings the last one back', `${TOP}.getAttribute('data-card') === 'learn'`, `${TOP}.getAttribute('data-card')`);
  await drag(-40);
  await expect('a card let go too early comes back', `${TOP}.getAttribute('data-card') === 'learn'`, `${TOP}.getAttribute('data-card')`);
  await page.ev(`document.querySelector('[data-deck]').focus()`);
  await key('ArrowRight', 'ArrowRight', 39);
  await key('ArrowRight', 'ArrowRight', 39);
  await expect('the arrow keys pass cards', `${TOP}.getAttribute('data-card') === 'wallet'`, `${TOP}.getAttribute('data-card')`);
  await key('ArrowLeft', 'ArrowLeft', 37);
  await expect('and go back', `${TOP}.getAttribute('data-card') === 'mentor'`, `${TOP}.getAttribute('data-card')`);
  await expect('a screen reader is told the card', `/\\b2\\b|\\b3\\b/.test(document.querySelector('[data-deck]').getAttribute('aria-label'))`, `document.querySelector('[data-deck]').getAttribute('aria-label')`);
  await expect('only the top card is face up', `[...document.querySelectorAll('[data-deck] [data-card]')].filter((c) => !c.hasAttribute('data-top')).every((c) => c.getAttribute('aria-hidden') === 'true')`);
  await key('Enter', 'Enter', 13);
  await expect('Enter plays the top card', `location.pathname === '/mentor'`, 'location.pathname');
  await go('/home');
  await tap(TOP);
  await tap(TOP);
  await expect('a tap on a card that leads somewhere goes there', `location.pathname === '/learn'`, 'location.pathname');
  await shot('3-destination');

  // 4. the menu
  if (isPhone) {
    await page.ev(`[...document.querySelectorAll('[data-part="item"]')].find((b) => b.getAttribute('aria-pressed') === 'false').click()`);
    await sleep(1200);
    await expect('the dock opens a place', `location.pathname !== '/learn'`, 'location.pathname');
    await expect('the dock shows no words', `[...document.querySelectorAll('[data-part="label"]')].every((l) => getComputedStyle(l).display === 'none')`);
  } else {
    await page.ev(`document.querySelector('aside a[href="/wallet"]').click()`);
    await sleep(1200);
    await expect('the sidebar opens a place', `location.pathname === '/wallet'`, 'location.pathname');
    await page.ev(`document.querySelector('[data-slot="sidebar-trigger"]').click()`);
    await sleep(900);
    await expect('the sidebar collapses', `document.querySelector('aside').offsetWidth < 120`);
    await go('/home');
    await expect('and stays collapsed after a reload', `document.querySelector('aside').offsetWidth < 120`);
    await page.ev(`document.querySelector('[data-slot="sidebar-trigger"]').click()`);
    await expect('the sidebar follows the color mode', `(() => { const [r, g, b] = getComputedStyle(document.querySelector('aside')).backgroundColor.match(/\\d+/g).map(Number); const isLightPanel = r + g + b > 600; return isLightPanel === ${config.theme === 'light'}; })()`, `getComputedStyle(document.querySelector('aside')).backgroundColor`);
  }

  // 5. coming back
  await go('/home');
  await expect('a reload of /home stays in', `location.pathname === '/home' && ${TOP} !== null`, 'location.pathname');
  await go('/');
  await expect('a signed-in person can still read the site', `location.pathname === '/'`, 'location.pathname');
  await expect('the site no longer asks them to start or to sign in', `document.querySelectorAll('[data-cta="start-parent"], [data-cta="start-learner"], [data-cta="sign-in"]').length === 0 && ![...document.querySelectorAll('header button')].some((b) => /sign in|iniciar sesión|entrar/i.test(b.textContent))`);
  await expect('it offers the green button instead', `(() => { const links = [...document.querySelectorAll('[data-cta="keep-learning"]')].filter((l) => l.offsetParent !== null); if (links.length === 0) return false; return links.every((l) => { const [r, g, b] = getComputedStyle(l).backgroundColor.match(/[0-9]+/g).map(Number); return g > r + 40 && g > b; }); })()`, `[...document.querySelectorAll('[data-cta="keep-learning"]')].map((l) => getComputedStyle(l).backgroundColor)`);
  await shot('4-site-signed-in');
  await page.ev(`[...document.querySelectorAll('[data-cta="keep-learning"]')].find((l) => l.offsetParent !== null).click()`);
  await sleep(2500);
  await expect('and it goes to /home', `location.pathname === '/home'`, 'location.pathname');

  // 6. signing out
  await page.ev(`(() => { const b = [...document.querySelectorAll('header button[aria-haspopup="menu"]')].at(-1); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); })()`);
  await sleep(700);
  await page.ev(`document.querySelector('[data-slot="dropdown-menu-item"]').click()`);
  await sleep(2500);
  await expect('signing out lands on the site', `location.pathname === '/'`, 'location.pathname');
  await expect('and opens no window on the person', `${DIALOG} === null`);
  await shot('5-signed-out');

  // 7. signing in again
  await signIn(email, null);
  await sleep(1500);
  await expect('signing in again lands on /home, with no age step', `location.pathname === '/home' && ${DIALOG} === null`, 'location.pathname');
  await shot('6-back-in');

  if ((await path()) === '/home') {
    await page.ev(`(() => { const b = [...document.querySelectorAll('header button[aria-haspopup="menu"]')].at(-1); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); })()`);
    await sleep(700);
    await page.ev(`document.querySelector('[data-slot="dropdown-menu-item"]').click()`);
    await sleep(1500);
  }

  for (const problem of problems) console.log(`[${describe(config)}] FAILED: ${problem}`);

  console.log(`[${describe(config)}] ${problems.length === 0 ? 'walked every step' : `${problems.length} step(s) failed`}; screenshots in ${out}`);

  return problems.length;
}, [1440, 390]);
