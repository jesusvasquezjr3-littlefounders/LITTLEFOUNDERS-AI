// Walks the sign-in window end to end in a real browser, saves a screenshot of every step so the flow can be
// looked at, and runs axe-core on each step (the same rule set as audit:a11y). It creates one synthetic account.
//
// Needs everything running locally: the Supabase stack with its mail catcher (`npm run db:up` in
// database/), Core (`npm run dev` in backend/) and the dev server (`npm run dev` here).
//
//   npm run audit:signin                                  light, en-US, 1440 px
//   npm run audit:signin -- --width 390 --lang es-MX --theme dark
//   npm run audit:signin -- --age 16                      (default 9, which shows the permission box)
//
// Files go to frontend/audit-out/signin/ (not tracked).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, parseArgs, run, sleep } from './lib.mjs';

const args = parseArgs();
const out = join(dirname(fileURLToPath(import.meta.url)), '../../audit-out/signin');
const MAILPIT = typeof args.mailpit === 'string' ? args.mailpit : 'http://localhost:8025';
const AGE = String(args.age ?? 9);

mkdirSync(out, { recursive: true });

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
// With a window or a menu open Radix hides the rest of the page, so these four appear and are not counted (see a11y.mjs).
const EXPECTED_BEHIND_A_WINDOW = new Set(['aria-hidden-focus', 'landmark-one-main', 'page-has-heading-one', 'region']);
const AXE = `(async () => {
  const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
  return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
})()`;

/** The newest six-digit code the mail catcher holds for an address. */
async function codeFor(email) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const found = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`)).json();
    const id = found.messages?.[0]?.ID;

    if (id) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const match = `${message.Text ?? ''} ${message.HTML ?? ''}`.match(/\b(\d{6})\b/);

      if (match) return match[1];
    }

    await sleep(500);
  }

  throw new Error(`No code arrived for ${email}. Is the mail catcher running at ${MAILPIT}?`);
}

const DIALOG = `document.querySelector('[data-slot="dialog-content"]')`;
const clickIn = (scope, pattern) => `[...${scope}.querySelectorAll('button')].find((b) => ${pattern}.test(b.textContent)).click()`;

await run('signin', args, async (page, config) => {
  const name = (step) => join(out, `${config.width}-${config.lang}-${config.theme}-${step}.png`);
  const problems = [];
  const shot = async (step) => {
    await sleep(700);
    writeFileSync(name(step), await page.screenshot());

    for (const v of (await page.ev(AXE)).filter((found) => !EXPECTED_BEHIND_A_WINDOW.has(found.id))) {
      problems.push(`${step}: ${v.impact} ${v.id}: ${v.help} (${v.nodes.join(', ')})`);
    }
  };
  const type = async (selector, text) => {
    await page.ev(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await page.call('Input.insertText', { text });
    await sleep(250);
  };
  const email = `walk${Date.now()}@example.test`;
  // A check waits for what it expects, up to eight seconds.
  const expect = async (label, expression) => {
    for (const end = Date.now() + 8000; ;) {
      if (await page.ev(expression).catch(() => false)) return;

      if (Date.now() > end) break;

      await sleep(150);
    }

    problems.push(label);
  };

  await page.ev(axeSource);

  // Open the window from wherever the button is at this width.
  await page.ev(config.width < 768
    ? `document.querySelector('[data-cta="sign-in"]').click()`
    : `[...document.querySelectorAll('header button')].find((b) => /sign in|iniciar sesión|entrar/i.test(b.textContent)).click()`);
  await shot('1-choose');
  await expect('the window opened', `${DIALOG} !== null`);

  await page.ev(clickIn(DIALOG, '/email|correo|e-mail/i'));
  await shot('2-identifier');
  await expect('the send button waits for an answer', `${DIALOG}.querySelector('button[type="submit"]').disabled === true`);

  await type('[data-slot="dialog-content"] input', email);
  await page.ev(`${DIALOG}.querySelector('button[type="submit"]').click()`);
  await sleep(2500);
  await shot('3-code');
  await expect('the code step is showing', `${DIALOG}.querySelector('input[autocomplete="one-time-code"]') !== null`);

  // A wrong code first: the answer must be a sentence in the window, not a crash.
  await type('[data-slot="dialog-content"] input[autocomplete="one-time-code"]', '000000');
  await sleep(1800);
  await shot('4-code-wrong');
  await expect('a wrong code shows a message', `${DIALOG}.querySelector('[role="alert"]').textContent.trim().length > 0`);

  await type('[data-slot="dialog-content"] input[autocomplete="one-time-code"]', await codeFor(email));
  await sleep(2500);
  await shot('5-age');
  await expect('the age step is showing', `${DIALOG}.querySelector('input[inputmode="numeric"]:not([autocomplete="one-time-code"])') !== null`);

  // An age nobody has: the friendly nudge, and the button stays disabled.
  await type('[data-slot="dialog-content"] input[inputmode="numeric"]', '250');
  await shot('6-age-impossible');
  await expect('an impossible age keeps the button disabled', `${DIALOG}.querySelector('button[type="submit"]').disabled === true`);

  await page.ev(`(() => { const input = ${DIALOG}.querySelector('input[inputmode="numeric"]'); input.focus(); input.select(); })()`);
  await page.call('Input.insertText', { text: AGE });
  await sleep(400);

  if (Number(AGE) < 13) {
    await shot('7-age-permission');
    await expect('under 13 the button waits for the permission box', `${DIALOG}.querySelector('button[type="submit"]').disabled === true`);
    await page.ev(`${DIALOG}.querySelector('[data-slot="checkbox"]').click()`);
    await sleep(300);
  }

  await shot('8-age-ready');
  await page.ev(`${DIALOG}.querySelector('button[type="submit"]').click()`);
  await sleep(2500);
  await shot('9-signed-in');
  await expect('the window closed', `${DIALOG} === null`);
  // A person who signs in from the site is taken into the application (D-051); an account this new has no name
  // and no mentor, so it chooses them first. That walk is audit:app's; this one goes back to the site.
  await expect('a new account is taken to choose its name and mentor', `location.pathname === '/onboarding'`);
  await page.call('Page.navigate', { url: new URL('/', config.url).href });
  await sleep(3500);
  await page.ev(axeSource);
  await expect('the account button replaced Sign in', `document.querySelector('header button[aria-haspopup="menu"]:last-of-type') !== null`);

  // The account menu, then sign out.
  await page.ev(`(() => { const b = [...document.querySelectorAll('header button[aria-haspopup="menu"]')].at(-1); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })); })()`);
  await shot('10-account-menu');
  await page.ev(`document.querySelector('[data-slot="dropdown-menu-item"]').click()`);
  await sleep(1800);
  await shot('11-signed-out');
  await expect('signing out returns to the site', `location.pathname === '/'`);
  await expect('signing out brings Sign in back', config.width < 768
    ? `document.querySelector('[data-cta="sign-in"]') !== null`
    : `[...document.querySelectorAll('header button')].some((b) => /sign in|iniciar sesión|entrar/i.test(b.textContent))`);

  for (const problem of problems) console.log(`[${describe(config)}] FAILED: ${problem}`);

  console.log(`[${describe(config)}] ${problems.length === 0 ? 'walked every step' : `${problems.length} step(s) failed`}; screenshots in ${out}`);

  return problems.length;
}, [390, 1440]);
