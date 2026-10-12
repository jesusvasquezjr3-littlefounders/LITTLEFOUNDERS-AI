// Every way a person gets from the site into the application, walked in a real browser the way a person does it:
// each step is a click or a key on the page, and the code is read from the local mail catcher.
//
// Each flow is one person with a browser of their own: a new profile with no cookies and nothing stored, checked
// before the first step. A flow that passes only because of what an earlier one left behind proves nothing.
//
//   learner   the learner's button, the onboarding, the account at its end, /home; then the site and the onboarding again
//   parent    the parent's button on a phone, the account, /home with Family
//   later     "later" at the end of the onboarding: in as a guest with no session, a reload, a place, the site, and the
//             account created from inside the application
//   erase     a visitor with nothing chosen is sent to sign in; a guest who erases what they chose is out
//   direct    "Sign in" with no onboarding; an account left at the age step; choosing name and mentor; out and in again
//   deep      a link into the application opened without a session, by a new person and by a returning one
//
// Needs everything running locally, one of each (docs/operations/ENVIRONMENT-SETUP.md): the Supabase stack with its
// mail catcher, Core, the mail service and the dev server on 5173.
//
//   npm run audit:flows                 all of them, one after another
//   npm run audit:flows -- later deep   only these
//
// Nothing here waits a fixed time for the page: an action waits for the thing it acts on, and a check waits, up to
// ten seconds, for what it expects. A check that fails did not see it in that time.
//
// Screenshots go to frontend/audit-out/flows/ (not tracked). It creates synthetic accounts (@example.test).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './lib.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../audit-out/flows');
const SITE = 'http://localhost:5173';
const MAILPIT = 'http://localhost:8025';
const DIALOG = `document.querySelector('[data-slot="dialog-content"]')`;
const AGE = `${DIALOG}?.querySelector('input[inputmode="numeric"]:not([autocomplete="one-time-code"])')`;
let failures = 0;
const check = (label, ok, extra = '') => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra !== '' ? ` (${extra})` : ''}`); };
const PATIENCE = 10000;
// cookies that are not a session: the answer to the cookie banner, and the mark of a device that signed in before
const KEPT = new Set(['lf_cc', 'lf_kd']);

/** Asks again and again until `test` says yes, or the time is up. The page may be between two documents: that is a no. */
async function until(test, ms = PATIENCE) {
  const end = Date.now() + ms;

  for (;;) {
    if (await test().catch(() => false)) return true;

    if (Date.now() > end) return false;

    await sleep(120);
  }
}

mkdirSync(dir, { recursive: true });

async function codeFor(email, since) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const found = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=5`)).json();
    const fresh = (found.messages ?? []).filter((message) => new Date(message.Created).getTime() >= since);

    if (fresh[0]) return (await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json()).Text.match(/\b(\d{6})\b/)[1];

    await sleep(500);
  }

  throw new Error(`no code for ${email}`);
}

/** One person: a browser of their own, and what they can do with the page. */
async function person(name, width = 1440, height = 900) {
  const browser = await launch();
  const page = await browser.newPage({ url: `${SITE}/`, width, height, theme: 'light', lang: 'es-MX', settle: 300 });

  await until(() => page.ev("document.querySelector('[data-cta]') !== null"));

  const email = `flow-${name}-${Date.now()}@example.test`;
  const clean = await page.ev("({ cookies: document.cookie, storage: ['lf.session', 'lf.onboarding', 'lf.sidebar'].filter((k) => localStorage.getItem(k) !== null), tab: Object.keys(sessionStorage) })");
  const jar = ((await page.call('Network.getAllCookies')).result?.cookies ?? []).filter((c) => c.domain.includes('localhost') && !KEPT.has(c.name)).map((c) => c.name);

  check(`${name}: starts with no session cookie and nothing stored`, clean.storage.length === 0 && clean.tab.length === 0 && jar.length === 0, JSON.stringify({ ...clean, jar }));
  const me = {
    page, email,
    close: () => browser.close(),
    ev: (expression) => page.ev(expression),
    where: () => page.ev('location.pathname + location.search'),
    /** True once the page shows `expression`. */
    has: (expression, ms) => until(() => page.ev(`!!(${expression})`), ms),
    /** A check that waits for what it expects. `show` is what to print beside it. */
    sees: async (label, test, show) => check(label, await until(test), show ? String(await show().catch(() => '?')) : ''),
    go: async (to) => { await page.call('Page.navigate', { url: `${SITE}${to}` }); await until(() => page.ev("document.readyState === 'complete' && document.getElementById('root')?.childElementCount > 0")); },
    shot: async (label) => { await sleep(350); writeFileSync(`${dir}/${name}-${label}.png`, await page.screenshot()); },
    click: async (expression) => { const found = await me.has(expression); if (found) await page.ev(`(${expression}).click()`); await sleep(120); return found; },
    type: async (expression, text) => { await me.has(expression); await page.ev(`(() => { const e = ${expression}; e.focus(); e.select?.(); })()`); await page.call('Input.insertText', { text }); await sleep(150); },
    escape: async () => { await page.press('Escape'); await me.has(`${DIALOG} === null`); },
    /** The email and the code, in the window that is open. Stops at whatever comes after the code. */
    emailAndCode: async () => {
      const since = Date.now() - 2000;

      await me.click(`[...${DIALOG}.querySelectorAll('button')].find((b) => /email|correo|e-mail/i.test(b.textContent))`);
      await me.type(`${DIALOG}.querySelector('input')`, email);
      await me.click(`${DIALOG}.querySelector('button[type="submit"]:not(:disabled)')`);
      await me.type(`${DIALOG}.querySelector('input[autocomplete="one-time-code"]')`, await codeFor(email, since));
      // the code is checked when its last figure is typed: then the age is asked, or the window closes
      await me.has(`${DIALOG} === null || ${AGE} != null`);
    },
    sayAge: async (age) => {
      await me.type(AGE, String(age));
      await me.click(`${DIALOG}.querySelector('button[type="submit"]:not(:disabled)')`);
      await me.has(`${DIALOG} === null`);
    },
    openSignIn: () => me.click(width < 768 ? `document.querySelector('[data-cta="sign-in"]')` : `[...document.querySelectorAll('header button')].find((b) => /iniciar sesión/i.test(b.textContent))`),
    /** Answers the onboarding up to its last screen. */
    onboard: async (start, age, called, mentor) => {
      if (start) await me.click(`document.querySelector('a[data-cta="${start}"]')`);

      const STEP = "new URLSearchParams(location.search).get('step')";

      await me.has(`location.pathname.startsWith('/onboarding') && ${STEP} !== null && document.querySelector('main h1') !== null`);

      me.seen = [];

      for (let turn = 0; turn < 20; turn++) {
        const step = await page.ev(STEP);
        const title = await page.ev("document.querySelector('main h1')?.innerText ?? ''");

        me.seen.push(step);

        if (step === 'join') return true;

        if (step === 'age') await me.type(`document.querySelector('main input')`, String(age));
        if (step === 'name') await me.type(`document.querySelector('main input')`, called);
        if (step === 'mentor') await me.click(`[...document.querySelectorAll('main [aria-pressed], main [role=radio], main input[type=radio]')][${mentor}]`);

        await me.click(`[...document.querySelectorAll('main button, main a')].find((b) => b.offsetParent !== null && !b.disabled && !b.hasAttribute('aria-pressed') && b.getAttribute('role') !== 'radio' && (b.type === 'submit' || !b.className.includes('-ghost')) && !b.closest('header'))`);
        // the next screen is in once the address names another step and the old screen, which leaves first, is gone
        await me.has(`${STEP} !== ${JSON.stringify(step)} && document.querySelector('main h1') !== null && document.querySelector('main h1').innerText !== ${JSON.stringify(title)}`, 6000);
      }

      return false;
    },
    /** A check on what the home shows, which waits for it. */
    atHome: (label, test) => me.sees(label, async () => test(await me.home()), async () => JSON.stringify(await me.home())),
    /** The names of the cookies a session is made of. */
    sessionCookies: async () => ((await page.call('Network.getAllCookies')).result?.cookies ?? []).filter((c) => c.domain.includes('localhost') && !KEPT.has(c.name)).map((c) => c.name),
    ctas: () => page.ev("[...document.querySelectorAll('[data-cta]')].filter((e) => e.getClientRects().length).map((e) => e.dataset.cta)"),
    home: () => page.ev("({ path: location.pathname, h1: document.querySelector('main h1')?.innerText ?? null, places: document.querySelectorAll('aside [data-slot=sidebar-menu-button]').length, cover: document.querySelector('[data-deck] [data-top]')?.getAttribute('data-card') ?? null, dialog: document.querySelector('[data-slot=\"dialog-content\"]') !== null })"),
  };

  return me;
}

// the top card ends above the dock, with the page not scrolled: the pile is whole on a phone's first screen
const FITS = "(() => { const card = document.querySelector('[data-deck] [data-top]')?.getBoundingClientRect(); const dock = [...document.querySelectorAll('div.fixed')].find((d) => d.querySelector('.lf-icon'))?.getBoundingClientRect(); return !!card && !!dock && window.scrollY === 0 && card.bottom <= dock.top + 2; })()";
const FITS_SHOW = "(() => { const card = document.querySelector('[data-deck] [data-top]')?.getBoundingClientRect(); const dock = [...document.querySelectorAll('div.fixed')].find((d) => d.querySelector('.lf-icon'))?.getBoundingClientRect(); return `card ends at ${Math.round(card?.bottom ?? -1)}, dock starts at ${Math.round(dock?.top ?? -1)}`; })()";
const PRIMARY = `[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && !b.className.includes('-ghost'))`;
const LATER = `[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && b.className.includes('-ghost'))`;
const NOTICE = `[...document.querySelectorAll('aside')].find((a) => /guardado en este dispositivo/i.test(a.innerText))`;
const DOCK = "document.querySelectorAll('.lg\\\\:hidden .lf-icon').length";
const same = (list, expected) => JSON.stringify(list) === JSON.stringify(expected);
const SIGN_IN = "[...document.querySelectorAll('header button, [data-cta=\"sign-in\"]')].some((b) => b.getClientRects().length && /iniciar sesión/i.test(b.textContent))";
// the notice: at most 96 px tall, after the greeting's line and before the composition
const SMALL_NOTICE = `(() => { const n = ${NOTICE}?.getBoundingClientRect(); const line = document.querySelector('main h1 + p')?.getBoundingClientRect(); const stage = document.querySelector('main video, main img')?.getBoundingClientRect(); return !!n && !!line && !!stage && n.height <= 96 && n.top >= line.bottom - 1 && n.bottom <= stage.top + 1; })()`;
const SMALL_NOTICE_SHOW = `(() => { const n = ${NOTICE}?.getBoundingClientRect(); return n ? Math.round(n.width) + ' x ' + Math.round(n.height) + ' at ' + Math.round(n.top) : 'no notice'; })()`;
const GREEN = ['keep-learning', 'keep-learning', 'keep-learning'];

/** Opens the account menu and signs out. */
async function signOut(me) {
  await me.has(`[...document.querySelectorAll('button')].find((b) => /^cuenta$/i.test(b.getAttribute('aria-label') ?? ''))`);
  await me.ev(`[...document.querySelectorAll('button')].find((b) => /^cuenta$/i.test(b.getAttribute('aria-label') ?? '')).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))`);
  await me.click(`[...document.querySelectorAll('[role=menuitem]')].find((b) => /cerrar sesión/i.test(b.textContent))`);
}

const flows = {
  // 1. the learner's button, the onboarding, the account at its end
  async learner() {
    const me = await person('learner');

    check('learner: the onboarding reaches its last screen', await me.onboard('start-learner', 15, 'Nico', 2), await me.where());
    await me.shot('1-join');
    await me.click(PRIMARY);
    await me.emailAndCode();

    if (await me.ev(`${AGE} != null`)) await me.sayAge(15);

    await me.atHome('learner: lands on /home, greeted by name, five places, the cover on top', (home) => home.path === '/home' && /Nico/.test(home.h1 ?? '') && home.places === 5 && home.cover === 'cover' && !home.dialog);
    await me.shot('2-home');

    // with the session: the site and the onboarding
    await me.go('/');
    await me.sees('learner: back on the site every call to action is the green one', async () => same(await me.ctas(), GREEN), async () => JSON.stringify(await me.ctas()));
    await me.shot('3-site');
    await me.click(`document.querySelector('[data-cta="keep-learning"][data-origin="landing-hero"]')`);
    await me.sees('learner: the green button goes to /home', async () => (await me.where()) === '/home', me.where);
    await me.go('/onboarding');
    await me.sees('learner: the onboarding is not walked twice', async () => (await me.where()) === '/home', me.where);
    await me.go('/onboarding/parent');
    await me.sees('learner: nor the parent one', async () => (await me.where()) === '/home', me.where);
    await me.close();
  },

  // 2. the parent's button, on a phone
  async parent() {
    const me = await person('parent', 390, 800);

    check('parent: the onboarding reaches its last screen', await me.onboard('start-parent', 36, 'Laura', 0), await me.where());
    await me.click(PRIMARY);
    await me.emailAndCode();

    if (await me.ev(`${AGE} != null`)) await me.sayAge(36);

    await me.atHome('parent: lands on /home, greeted by name', (home) => home.path === '/home' && /Laura/.test(home.h1 ?? '') && !home.dialog);
    await me.sees('parent: with Family in the dock', async () => (await me.ev(DOCK)) === 6, () => me.ev(DOCK));
    await me.sees('parent: the pile of the home is whole on the first screen of a phone', async () => await me.ev(FITS), () => me.ev(FITS_SHOW));
    await me.shot('1-home');
    await me.go('/');
    await me.sees('parent: the bar of the phone is the green button', async () => (await me.ev("document.querySelector('[data-fab] [data-cta]')?.dataset.cta")) === 'keep-learning');
    await me.shot('2-site');
    await me.close();
  },

  // 3. "later" at the end of the onboarding: in as a guest, then the account from inside
  async later() {
    const me = await person('later');

    await me.onboard('start-learner', 16, 'Max', 1);
    await me.shot('0-join');
    await me.click(LATER);
    await me.atHome('later: goes into the application as a guest, greeted by name, cover on top', (home) => home.path === '/home' && /Max/.test(home.h1 ?? '') && home.places === 5 && home.cover === 'cover' && !home.dialog);
    check('later: no session was made', (await me.sessionCookies()).length === 0);
    await me.sees('later: the guest is told what is kept, with the way to create the account', () => me.ev(`!!${NOTICE} && [...${NOTICE}.querySelectorAll('button')].length === 2`));
    check('later: a guest is not offered to sign in: they are in', !(await me.ev(SIGN_IN)));
    await me.shot('1-guest-home');
    await me.go('/home');
    await me.atHome('later: a reload keeps the guest in', (home) => home.path === '/home' && /Max/.test(home.h1 ?? '') && !home.dialog);
    await me.go('/wallet');
    await me.sees('later: a guest opens a place', async () => (await me.where()) === '/wallet' && (await me.ev("document.querySelector('main h1')?.innerText")) === 'Cartera', me.where);
    await me.go('/family');
    await me.sees('later: but not Family', async () => (await me.where()) === '/home', me.where);
    await me.go('/');
    await me.sees('later: on the site every call to action is the green one', async () => same(await me.ctas(), GREEN), async () => JSON.stringify(await me.ctas()));
    check('later: nor on the site', !(await me.ev(SIGN_IN)));
    await me.shot('2-site');
    await me.click(`document.querySelector('[data-cta="keep-learning"][data-origin="landing-hero"]')`);
    await me.sees('later: which goes back to /home', async () => (await me.where()) === '/home', me.where);

    // the account, from inside the application
    await me.click(`${NOTICE}.querySelector('button:not([data-erase])')`);
    await me.sees('later: the notice opens the window', () => me.ev(`${DIALOG} !== null`));
    await me.emailAndCode();

    if (await me.ev(`${AGE} != null`)) await me.sayAge(16);

    const account = () => me.ev(`fetch('http://localhost:4000/api/v1/auth/session', { credentials: 'include' }).then((r) => r.json()).then((j) => j.data?.account ?? null)`);

    await me.sees('later: the account received the name and the mentor', async () => { const a = await account(); return a?.displayName === 'Max' && a?.mentor === 'rho' && a?.needsAge === false; }, async () => { const a = await account(); return JSON.stringify(a && { name: a.displayName, mentor: a.mentor, needsAge: a.needsAge }); });
    await me.atHome('later: with the account the person is still on /home, by the same name', (home) => home.path === '/home' && /Max/.test(home.h1 ?? '') && !home.dialog);
    await me.sees('later: the answers left the browser and the notice is gone', () => me.ev(`localStorage.getItem('lf.onboarding') === null && !${NOTICE}`));
    await me.shot('3-account-home');
    await me.close();
  },

  // 3b. a guest who erases what they chose, and a visitor who never walked the onboarding
  async erase() {
    const me = await person('erase', 390, 800);

    await me.go('/home');
    await me.sees('visitor: with nothing chosen, /home sends to the site with the window open', async () => (await me.where()) === '/' && await me.ev(`${DIALOG} !== null`), me.where);
    await me.escape();
    await me.onboard('start-parent', 40, 'Rosa', 0);
    await me.click(LATER);
    await me.atHome('guest parent: in on /home on a phone, greeted by name', (home) => home.path === '/home' && /Rosa/.test(home.h1 ?? '') && !home.dialog);
    await me.sees('guest parent: the dock has five places (Family needs an account)', async () => (await me.ev(DOCK)) === 5, () => me.ev(DOCK));
    check('guest: nothing scrolls sideways', (await me.ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')) <= 0);
    await me.shot('1-guest-phone');
    await me.sees('guest: the notice is one small line, under the greeting and above the composition', () => me.ev(SMALL_NOTICE), () => me.ev(SMALL_NOTICE_SHOW));

    // erasing asks first, and the safe answer is the one in hand
    await me.click(`${NOTICE}.querySelector('[data-erase]')`);
    await me.sees('erase: it asks before erasing, with the button that keeps everything in focus', () => me.ev(`${DIALOG} !== null && document.activeElement === ${DIALOG}.querySelector('[data-keep]')`));
    await me.shot('2-asking');
    check('erase: nothing was erased yet', await me.ev(`localStorage.getItem('lf.onboarding') !== null`));
    await me.escape();
    await me.sees('erase: closing the window keeps everything', async () => (await me.where()) === '/home' && await me.ev(`${DIALOG} === null && localStorage.getItem('lf.onboarding') !== null`), me.where);
    await me.click(`${NOTICE}.querySelector('[data-erase]')`);
    await me.click(`${DIALOG}.querySelector('[data-keep]')`);
    await me.sees('erase: so does the button that keeps', async () => (await me.where()) === '/home' && await me.ev(`${DIALOG} === null && localStorage.getItem('lf.onboarding') !== null`), me.where);
    await me.click(`${NOTICE}.querySelector('[data-erase]')`);
    await me.click(`${DIALOG}.querySelector('[data-confirm-erase]')`);
    await me.sees('erase: erasing ends the visit, on the site, with no window', async () => (await me.where()) === '/' && await me.ev(`${DIALOG} === null`), me.where);
    check('erase: nothing is left in the browser', await me.ev(`localStorage.getItem('lf.onboarding') === null`));
    await me.sees('erase: the calls to action are the visitor\'s again', async () => { const ctas = await me.ctas(); return ctas.includes('start-parent') && !ctas.includes('keep-learning'); }, async () => JSON.stringify(await me.ctas()));
    await me.close();
  },

  // 4. "Sign in" with no onboarding, and an account left half way
  async direct() {
    const me = await person('direct');

    await me.openSignIn();
    await me.emailAndCode();
    await me.sees('direct: a new account is asked its age', () => me.ev(`${AGE} != null`));

    // the person leaves at the age step and comes back another moment
    await me.go('/');
    await me.sees('half: coming back, the window asks the age by itself', () => me.ev(`${AGE} != null`));
    await me.escape();
    await me.sees('half: the window can be closed', () => me.ev(`${DIALOG} === null`));
    await me.sees('half: every call to action is the green "finish your account"', async () => same(await me.ctas(), ['finish-account', 'finish-account', 'finish-account']), async () => JSON.stringify(await me.ctas()));
    await me.shot('1-half');
    await me.click(`document.querySelector('[data-cta="finish-account"][data-origin="landing-hero"]')`);
    await me.sees('half: the green button opens the age step', () => me.ev(`${AGE} != null`));
    await me.sayAge(15);

    await me.sees('new: an account with no name and no mentor is taken to the onboarding', async () => (await me.ev('location.pathname')) === '/onboarding', me.where);
    check('new: which reaches its last screen', await me.onboard(null, 0, 'Sofi', 3), await me.where());
    check('new: without asking the age again', !me.seen.includes('age') && me.seen.includes('name') && me.seen.includes('mentor'), me.seen.join(' > '));
    await me.shot('2-join');
    await me.click(PRIMARY);
    await me.atHome('new: and ends on /home, greeted by name', (home) => home.path === '/home' && /Sofi/.test(home.h1 ?? '') && home.cover === 'cover' && !home.dialog);
    await me.shot('3-home');
    await me.go('/onboarding');
    await me.sees('new: the onboarding is not walked twice', async () => (await me.where()) === '/home', me.where);

    // signing out, and in again
    await signOut(me);
    await me.sees('out: signing out lands on the site with no window', async () => (await me.where()) === '/' && await me.ev(`${DIALOG} === null`), me.where);
    await me.sees('out: the calls to action are the visitor\'s again', async () => same(await me.ctas(), ['start-parent', 'start-learner', 'start-parent', 'start-learner']), async () => JSON.stringify(await me.ctas()));
    check('out: no session is left', (await me.sessionCookies()).length === 0, (await me.sessionCookies()).join(','));
    await me.openSignIn();
    await me.emailAndCode();
    await me.sees('again: signing in again lands on /home with no age step', async () => (await me.where()) === '/home' && await me.ev(`${DIALOG} === null`), me.where);
    await me.close();
  },

  // 5. a link into the application, opened without a session
  async deep() {
    const me = await person('deep');

    await me.go('/wallet');
    await me.sees('deep: a visitor who opens /wallet is on the site with the window open', async () => (await me.where()) === '/' && await me.ev(`${DIALOG} !== null`), me.where);
    await me.shot('1-window');
    await me.emailAndCode();
    await me.sayAge(20);
    await me.sees('deep: a new account chooses its name and mentor first', async () => (await me.ev('location.pathname')) === '/onboarding', me.where);
    await me.onboard(null, 0, 'Ana', 0);
    await me.click(PRIMARY);
    await me.sees('deep: and then is on the place the link named', async () => (await me.where()) === '/wallet' && (await me.ev("document.querySelector('main h1')?.innerText")) === 'Cartera', me.where);
    await me.shot('3-wallet');

    // the same link once the account exists: out, the link again, in
    await signOut(me);
    await me.sees('deep: signed out', async () => (await me.where()) === '/', me.where);
    await me.go('/tasks');
    await me.has(`${DIALOG} !== null`);
    await me.emailAndCode();
    await me.sees('deep: a returning person goes straight to the place of the link', async () => (await me.where()) === '/tasks', me.where);
    await me.go('/');
    await me.click(`document.querySelector('[data-cta="keep-learning"]')`);
    await me.sees('deep: and later the green button goes to /home, not to an old link', async () => (await me.where()) === '/home', me.where);
    await me.close();
  },
};

const started = Date.now();

for (const name of process.argv.length > 2 ? process.argv.slice(2) : Object.keys(flows)) {
  try { await flows[name](); } catch (error) { failures++; console.log(`FAIL ${name}: stopped: ${error.message}`); }
}

console.log(`\nflows: ${failures === 0 ? 'no findings' : `${failures} finding(s)`}, in ${Math.round((Date.now() - started) / 1000)} s.`);
process.exit(failures === 0 ? 0 : 1);
