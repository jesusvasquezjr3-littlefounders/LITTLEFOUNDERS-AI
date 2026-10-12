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
  const page = await browser.newPage({ url: `${SITE}/`, width, height, theme: 'light', lang: 'es-MX', settle: 3500 });
  const email = `flow-${name}-${Date.now()}@example.test`;
  const clean = await page.ev("({ cookies: document.cookie, storage: ['lf.session', 'lf.onboarding', 'lf.sidebar'].filter((k) => localStorage.getItem(k) !== null), tab: Object.keys(sessionStorage) })");
  const jar = ((await page.call('Network.getAllCookies')).result?.cookies ?? []).filter((c) => c.domain.includes('localhost') && c.name !== 'lf_cc');

  check(`${name}: starts with no session cookie and nothing stored`, clean.storage.length === 0 && clean.tab.length === 0 && jar.length === 0, JSON.stringify({ ...clean, jar: jar.map((c) => c.name) }));
  const me = {
    page, email,
    close: () => browser.close(),
    ev: (expression) => page.ev(expression),
    where: () => page.ev('location.pathname + location.search'),
    go: async (to) => { await page.call('Page.navigate', { url: `${SITE}${to}` }); await sleep(4000); },
    shot: async (label) => { await sleep(600); writeFileSync(`${dir}/${name}-${label}.png`, await page.screenshot()); },
    click: async (expression, wait = 1200) => { const found = await page.ev(`(() => { const e = ${expression}; if (!e) return false; e.click(); return true; })()`); await sleep(wait); return found; },
    type: async (expression, text) => { await page.ev(`(() => { const e = ${expression}; e.focus(); e.select?.(); })()`); await page.call('Input.insertText', { text }); await sleep(350); },
    escape: async () => { await page.press('Escape'); await sleep(900); },
    /** The email and the code, in the window that is open. Stops at whatever comes after the code. */
    emailAndCode: async () => {
      const since = Date.now() - 2000;

      await me.click(`[...${DIALOG}.querySelectorAll('button')].find((b) => /email|correo|e-mail/i.test(b.textContent))`, 900);
      await me.type(`${DIALOG}.querySelector('input')`, email);
      await me.click(`${DIALOG}.querySelector('button[type="submit"]')`, 3000);
      await me.type(`${DIALOG}.querySelector('input[autocomplete="one-time-code"]')`, await codeFor(email, since));
      await sleep(3500);
    },
    sayAge: async (age) => {
      await me.type(AGE, String(age));
      await me.click(`${DIALOG}.querySelector('button[type="submit"]')`, 4500);
    },
    openSignIn: () => me.click(width < 768 ? `document.querySelector('[data-cta="sign-in"]')` : `[...document.querySelectorAll('header button')].find((b) => /iniciar sesión/i.test(b.textContent))`),
    /** Answers the onboarding up to its last screen. */
    onboard: async (start, age, called, mentor) => {
      if (start) await me.click(`document.querySelector('a[data-cta="${start}"]')`, 4000);

      me.seen = [];

      for (let turn = 0; turn < 20; turn++) {
        const step = await page.ev("new URLSearchParams(location.search).get('step')");

        me.seen.push(step);

        if (step === 'join') return true;

        if (step === 'age') await me.type(`document.querySelector('main input')`, String(age));
        if (step === 'name') await me.type(`document.querySelector('main input')`, called);
        if (step === 'mentor') await me.click(`[...document.querySelectorAll('main [aria-pressed], main [role=radio], main input[type=radio]')][${mentor}]`, 600);

        await me.click(`[...document.querySelectorAll('main button, main a')].find((b) => b.offsetParent !== null && !b.disabled && !b.hasAttribute('aria-pressed') && b.getAttribute('role') !== 'radio' && (b.type === 'submit' || !b.className.includes('-ghost')) && !b.closest('header'))`, 1700);
      }

      return false;
    },
    ctas: () => page.ev("[...document.querySelectorAll('[data-cta]')].filter((e) => e.getClientRects().length).map((e) => e.dataset.cta)"),
    home: () => page.ev("({ path: location.pathname, h1: document.querySelector('main h1')?.innerText ?? null, places: document.querySelectorAll('aside [data-slot=sidebar-menu-button]').length, cover: document.querySelector('[data-deck] [data-top]')?.getAttribute('data-card') ?? null, dialog: document.querySelector('[data-slot=\"dialog-content\"]') !== null })"),
  };

  return me;
}

const flows = {
  // 1. the learner's button, the onboarding, the account at its end
  async learner() {
    const me = await person('learner');

    check('learner: the onboarding reaches its last screen', await me.onboard('start-learner', 15, 'Nico', 2), await me.where());
    await me.shot('1-join');
    await me.click(`[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && !b.className.includes('-ghost'))`, 1800);
    await me.emailAndCode();

    if (await me.ev(`${AGE} != null`)) await me.sayAge(15);

    const home = await me.home();

    check('learner: lands on /home, greeted by name, five places, the cover on top', home.path === '/home' && /Nico/.test(home.h1 ?? '') && home.places === 5 && home.cover === 'cover' && !home.dialog, JSON.stringify(home));
    await me.shot('2-home');

    // with the session: the site and the onboarding
    await me.go('/');
    check('learner: back on the site every call to action is the green one', JSON.stringify(await me.ctas()) === JSON.stringify(['keep-learning', 'keep-learning', 'keep-learning']), JSON.stringify(await me.ctas()));
    await me.shot('3-site');
    await me.click(`document.querySelector('[data-cta="keep-learning"][data-origin="landing-hero"]')`, 2500);
    check('learner: the green button goes to /home', (await me.where()) === '/home', await me.where());
    await me.go('/onboarding');
    check('learner: the onboarding is not walked twice', (await me.where()) === '/home', await me.where());
    await me.go('/onboarding/parent');
    check('learner: nor the parent one', (await me.where()) === '/home', await me.where());
    await me.close();
  },

  // 2. the parent's button, on a phone
  async parent() {
    const me = await person('parent', 390, 800);

    check('parent: the onboarding reaches its last screen', await me.onboard('start-parent', 36, 'Laura', 0), await me.where());
    await me.click(`[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && !b.className.includes('-ghost'))`, 1800);
    await me.emailAndCode();

    if (await me.ev(`${AGE} != null`)) await me.sayAge(36);

    const home = await me.home();
    const dock = await me.ev("document.querySelectorAll('.lg\\\\:hidden .lf-icon').length");

    check('parent: lands on /home, greeted by name, with Family in the dock', home.path === '/home' && /Laura/.test(home.h1 ?? '') && dock === 6 && !home.dialog, `${JSON.stringify(home)} dock ${dock}`);
    await me.shot('1-home');
    await me.go('/');
    check('parent: the bar of the phone is the green button', (await me.ev("document.querySelector('[data-fab] [data-cta]')?.dataset.cta")) === 'keep-learning');
    await me.shot('2-site');
    await me.close();
  },

  // 3. "later" at the end of the onboarding: in as a guest, then the account from inside
  async later() {
    const me = await person('later');
    const NOTICE = `[...document.querySelectorAll('aside')].find((a) => /guardado en este dispositivo/i.test(a.innerText))`;

    await me.onboard('start-learner', 16, 'Max', 1);
    await me.shot('0-join');
    await me.click(`[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && b.className.includes('-ghost'))`, 4500);

    let home = await me.home();

    check('later: goes into the application as a guest, greeted by name, cover on top', home.path === '/home' && /Max/.test(home.h1 ?? '') && home.places === 5 && home.cover === 'cover' && !home.dialog, JSON.stringify(home));
    check('later: no session was made', ((await me.page.call('Network.getAllCookies')).result?.cookies ?? []).filter((c) => c.domain.includes('localhost') && c.name !== 'lf_cc').length === 0);
    check('later: the guest is told what is kept, with the way to create the account', await me.ev(`!!${NOTICE} && [...${NOTICE}.querySelectorAll('button')].length === 2`));
    await me.shot('1-guest-home');
    await me.go('/home');
    home = await me.home();
    check('later: a reload keeps the guest in', home.path === '/home' && /Max/.test(home.h1 ?? '') && !home.dialog, JSON.stringify(home));
    await me.go('/wallet');
    check('later: a guest opens a place', (await me.where()) === '/wallet' && (await me.ev("document.querySelector('main h1')?.innerText")) === 'Cartera', await me.where());
    await me.go('/family');
    check('later: but not Family', (await me.where()) === '/home', await me.where());
    await me.go('/');
    check('later: on the site every call to action is the green one', JSON.stringify(await me.ctas()) === JSON.stringify(['keep-learning', 'keep-learning', 'keep-learning']), JSON.stringify(await me.ctas()));
    await me.shot('2-site');
    await me.click(`document.querySelector('[data-cta="keep-learning"][data-origin="landing-hero"]')`, 3000);
    check('later: which goes back to /home', (await me.where()) === '/home', await me.where());

    // the account, from inside the application
    check('later: the notice opens the window', await me.click(`[...${NOTICE}.querySelectorAll('button')].find((b) => !b.className.includes('-ghost'))`, 1800) && await me.ev(`${DIALOG} !== null`));
    await me.emailAndCode();

    if (await me.ev(`${AGE} != null`)) await me.sayAge(16);

    await sleep(2500);
    home = await me.home();

    const account = await me.ev(`fetch('http://localhost:4000/api/v1/auth/session', { credentials: 'include' }).then((r) => r.json()).then((j) => j.data?.account ?? null)`);

    check('later: with the account the person is still on /home, by the same name', home.path === '/home' && /Max/.test(home.h1 ?? '') && !home.dialog, JSON.stringify(home));
    check('later: the account received the name and the mentor', account?.displayName === 'Max' && account?.mentor === 'rho' && account?.needsAge === false, JSON.stringify(account && { name: account.displayName, mentor: account.mentor, needsAge: account.needsAge }));
    check('later: the answers left the browser and the notice is gone', await me.ev(`localStorage.getItem('lf.onboarding') === null && !${NOTICE}`));
    await me.shot('3-account-home');
    await me.close();
  },

  // 3b. a guest who erases what they chose, and a visitor who never walked the onboarding
  async erase() {
    const me = await person('erase', 390, 800);
    const NOTICE = `[...document.querySelectorAll('aside')].find((a) => /guardado en este dispositivo/i.test(a.innerText))`;

    await me.go('/home');
    check('visitor: with nothing chosen, /home sends to the site with the window open', (await me.where()) === '/' && await me.ev(`${DIALOG} !== null`), await me.where());
    await me.escape();
    await me.onboard('start-parent', 40, 'Rosa', 0);
    await me.click(`[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && b.className.includes('-ghost'))`, 4500);

    const home = await me.home();

    check('guest parent: in on /home on a phone, greeted by name', home.path === '/home' && /Rosa/.test(home.h1 ?? '') && !home.dialog, JSON.stringify(home));
    check('guest parent: the dock has five places (Family needs an account)', (await me.ev("document.querySelectorAll('.lg\\\\:hidden .lf-icon').length")) === 5);
    check('guest: nothing scrolls sideways', (await me.ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')) <= 0);
    await me.shot('1-guest-phone');
    await me.click(`[...${NOTICE}.querySelectorAll('button')].find((b) => b.className.includes('-ghost'))`, 2500);
    check('erase: erasing ends the visit, on the site, with no window', (await me.where()) === '/' && await me.ev(`${DIALOG} === null`), await me.where());
    check('erase: nothing is left in the browser', await me.ev(`localStorage.getItem('lf.onboarding') === null`));
    check('erase: the calls to action are the visitor\'s again', (await me.ctas()).includes('start-parent') && !(await me.ctas()).includes('keep-learning'), JSON.stringify(await me.ctas()));
    await me.close();
  },

  // 4. "Sign in" with no onboarding, and an account left half way
  async direct() {
    const me = await person('direct');

    await me.openSignIn();
    await me.emailAndCode();
    check('direct: a new account is asked its age', await me.ev(`${AGE} != null`));

    // the person leaves at the age step and comes back another moment
    await me.go('/');
    check('half: coming back, the window asks the age by itself', await me.ev(`${AGE} != null`));
    await me.escape();
    check('half: the window can be closed', await me.ev(`${DIALOG} === null`));
    check('half: every call to action is the green "finish your account"', JSON.stringify(await me.ctas()) === JSON.stringify(['finish-account', 'finish-account', 'finish-account']), JSON.stringify(await me.ctas()));
    await me.shot('1-half');
    await me.click(`document.querySelector('[data-cta="finish-account"][data-origin="landing-hero"]')`, 1500);
    check('half: the green button opens the age step', await me.ev(`${AGE} != null`));
    await me.sayAge(15);

    check('new: an account with no name and no mentor is taken to the onboarding', (await me.ev('location.pathname')) === '/onboarding', await me.where());
    check('new: which reaches its last screen', await me.onboard(null, 0, 'Sofi', 3), await me.where());
    check('new: without asking the age again', !me.seen.includes('age') && me.seen.includes('name') && me.seen.includes('mentor'), me.seen.join(' > '));
    await me.shot('2-join');
    await me.click(`[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && !b.className.includes('-ghost'))`, 4500);

    const home = await me.home();

    check('new: and ends on /home, greeted by name', home.path === '/home' && /Sofi/.test(home.h1 ?? '') && home.cover === 'cover' && !home.dialog, JSON.stringify(home));
    await me.shot('3-home');
    await me.go('/onboarding');
    check('new: the onboarding is not walked twice', (await me.where()) === '/home', await me.where());

    // signing out, and in again
    await me.ev(`[...document.querySelectorAll('button')].find((b) => /^cuenta$/i.test(b.getAttribute('aria-label') ?? '')).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))`);
    await sleep(900);
    await me.click(`[...document.querySelectorAll('[role=menuitem]')].find((b) => /cerrar sesión/i.test(b.textContent))`, 6000);
    check('out: signing out lands on the site with no window', (await me.where()) === '/' && await me.ev(`${DIALOG} === null`), await me.where());
    check('out: the calls to action are the visitor\'s again', JSON.stringify(await me.ctas()) === JSON.stringify(['start-parent', 'start-learner', 'start-parent', 'start-learner']), JSON.stringify(await me.ctas()));
    await me.openSignIn();
    await me.emailAndCode();
    check('again: signing in again lands on /home with no age step', (await me.where()) === '/home' && await me.ev(`${DIALOG} === null`), await me.where());
    await me.close();
  },

  // 5. a link into the application, opened without a session
  async deep() {
    const me = await person('deep');

    await me.go('/wallet');
    check('deep: a visitor who opens /wallet is on the site with the window open', (await me.where()) === '/' && await me.ev(`${DIALOG} !== null`), await me.where());
    await me.shot('1-window');
    try { await me.emailAndCode(); } catch (error) { await me.shot('2-stuck'); console.log('     window says:', await me.ev(`${DIALOG}?.innerText`)); throw error; }
    await me.sayAge(20);
    check('deep: a new account chooses its name and mentor first', (await me.ev('location.pathname')) === '/onboarding', await me.where());
    await me.onboard(null, 0, 'Ana', 0);
    await me.click(`[...document.querySelectorAll('main button')].find((b) => b.offsetParent !== null && !b.className.includes('-ghost'))`, 4500);
    check('deep: and then is on the place the link named', (await me.where()) === '/wallet' && (await me.ev("document.querySelector('main h1')?.innerText")) === 'Cartera', await me.where());
    await me.shot('3-wallet');

    // the same link once the account exists: out, the link again, in
    await me.ev(`[...document.querySelectorAll('button')].find((b) => /^cuenta$/i.test(b.getAttribute('aria-label') ?? '')).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))`);
    await sleep(900);
    await me.click(`[...document.querySelectorAll('[role=menuitem]')].find((b) => /cerrar sesión/i.test(b.textContent))`, 6000);
    await me.go('/tasks');
    await me.emailAndCode();
    check('deep: a returning person goes straight to the place of the link', (await me.where()) === '/tasks', await me.where());
    await me.go('/');
    await me.click(`document.querySelector('[data-cta="keep-learning"]')`, 2500);
    check('deep: and later the green button goes to /home, not to an old link', (await me.where()) === '/home', await me.where());
    await me.close();
  },
};

for (const name of process.argv.length > 2 ? process.argv.slice(2) : Object.keys(flows)) {
  try { await flows[name](); } catch (error) { failures++; console.log(`FAIL ${name}: stopped: ${error.message}`); }
}

console.log(failures === 0 ? `
flows: no findings.` : `
flows: ${failures} finding(s).`);
process.exit(failures === 0 ? 0 : 1);
