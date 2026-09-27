import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * Real-route matrix of the rebuilt sign-in, recovery, verification and
 * onboarding screens (W2 Lane 1, checkpoint W2S.2): A1 Log in, A2 Sign up, A3
 * Forgot password, A4 Reset password, A5 the Google return, A6 Save your
 * progress, A7 Become a Tutor, O1 Onboarding, and the paused-account state, in
 * headless Chrome against a local Vite server, with real pointer and keyboard
 * input. Core is answered in the page by this script (the DevTools Fetch
 * domain): no real Core, database or provider is contacted.
 *
 * Every case x en-US/es-MX/pt-BR x light/dark x 320/375/768/1280 px x normal
 * and 140% text:
 *   - the page's one <h1> is the rebuilt copy, in the page language and mode,
 *     inside the shell the SPEC gives it (the sign-in shell, or the single-state
 *     screen for onboarding and the paused account); one <main>; no legacy body;
 *   - no horizontal overflow; every pressable at least 48 x 48 px; no em dash;
 *     the AI is never "AI Tutor";
 *   - first Tab = the skip link, Enter moves focus to <main>, Tab then reaches
 *     the screen's first control with a visible focus ring;
 *   - 0 axe violations in the shell;
 *   - the population-specific behaviour: a visitor gets Google when Core has it
 *     enabled; a verified parent's status is Core's, not the role; a guest saves
 *     progress; a refused child meets the guest path.
 * At 100% text and 375/1280 px, each case also runs its journey with real
 * presses and typing (the A.2 refusal to onboarding, a wrong password, the
 * recovery email, a reset with the link's token, Google's first return to the
 * mandatory age question (A.3), the Tutor form, the upgrade's failure and
 * retry, the whole onboarding with the Mentor choice) and checks what Core
 * received: the exact payloads, the origin marker, no date of birth where none
 * belongs, no token left in the address bar.
 *
 *   REBUILD_URL=http://localhost:5410 node scripts/verify-identity.mjs
 *   Filters: ID_CASES, ID_LOCALES, ID_THEMES, ID_WIDTHS, ID_TEXT (100,140), ID_JOURNEYS=0
 * Report and failure screenshots: audit-results/identity/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5410';
const out = resolve('../audit-results/identity');
mkdirSync(out, { recursive: true });
const list = (name, fallback) => (process.env[name] ? process.env[name].split(',') : fallback);
const LOCALES = list('ID_LOCALES', ['en-US', 'es-MX', 'pt-BR']);
const THEMES = list('ID_THEMES', ['light', 'dark']);
const WIDTHS = list('ID_WIDTHS', ['320', '375', '768', '1280']).map(Number);
const TEXT = list('ID_TEXT', ['100', '140']).map(Number);
const JOURNEYS = process.env.ID_JOURNEYS !== '0';
const copy = Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale) => [locale, {
  ...JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-site.json`), 'utf8')),
}]));

const USER = '44444444-4444-4444-8444-444444444444';
const jwt = (claims) => `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: USER, ...claims })).toString('base64url')}.synthetic`;
const session = (guest) => ({ accessToken: jwt({ is_anonymous: guest, email: guest ? null : 'synthetic@example.test' }), refreshToken: 'synthetic', expiresIn: 3600, user: { id: USER, email: guest ? null : 'synthetic@example.test' } });
const stored = (guest) => JSON.stringify({ ...session(guest), expiresAt: Date.now() + 3_600_000, isGuest: guest });

/*
 * Who is signed in (null: nobody) and how Core answers. `screened`: the age
 * screen's answer; `verified`: GET /verification/parent; `google`: the provider
 * list; `onboarded`: /auth/me's onboardingComplete.
 */
const CASES = [
  { id: 'login', path: '/login', signedIn: null, google: true, shell: 'auth', h1: (c) => c.authLogin.title, first: '[data-auth="google"]', journey: 'wrong-password' },
  { id: 'signup', path: '/signup?intent=tutor', signedIn: null, google: true, shell: 'auth', h1: (c) => c.authSignup.title, first: '[data-auth="google"]', journey: 'refusal' },
  { id: 'forgot', path: '/forgot-password', signedIn: null, shell: 'auth', h1: (c) => c.authForgot.title, first: 'input[type=email]', journey: 'recover' },
  { id: 'reset', path: '/reset-password#access_token=recovery-synthetic&type=recovery', signedIn: null, shell: 'auth', h1: (c) => c.authReset.title, first: 'input[type=password]', journey: 'reset' },
  { id: 'reset-expired', path: '/reset-password', signedIn: null, shell: 'auth', h1: (c) => c.authReset.expiredTitle, first: 'main a[href="/forgot-password"]' },
  { id: 'callback-failed', path: '/auth/callback#error=access_denied', signedIn: null, shell: 'auth', h1: (c) => c.authCallback.failedTitle, first: 'main a[href="/login"]' },
  { id: 'callback-first-google', path: '/login', signedIn: null, shell: 'auth', h1: (c) => c.authLogin.title, first: '#never', journeyOnly: true, journey: 'google-return' },
  { id: 'verify-adult', path: '/verify-parent', signedIn: 'adult', verified: false, screened: 'adult', shell: 'auth', h1: (c) => c.authVerify.title, first: '[data-auth="start"]', journey: 'verify' },
  { id: 'verify-tutor', path: '/verify-parent', signedIn: 'adult', roles: ['parent'], verified: true, screened: 'adult', shell: 'auth', h1: (c) => c.authVerify.alreadyTitle, first: '[data-auth="family"]' },
  { id: 'verify-child', path: '/verify-parent', signedIn: 'adult', roles: ['kid'], verifyError: 'FORBIDDEN', screened: 'under_13', shell: 'auth', h1: (c) => c.authVerify.ineligibleTitle, first: 'main a[href="/learn"]' },
  { id: 'upgrade', path: '/upgrade-account', signedIn: 'guest', screened: '13_to_17', onboarded: true, shell: 'auth', h1: (c) => c.authUpgrade.title, first: 'input[type=email]', journey: 'upgrade' },
  { id: 'onboarding', path: '/onboarding', signedIn: 'guest', screened: 'under_13', protectedOrigin: true, onboarded: false, shell: 'single-state', h1: (c) => c.onboardingFlow.welcomeTitle, first: '[data-onboarding="start"]', journey: 'onboarding' },
  { id: 'suspended', path: '/account-suspended', signedIn: null, shell: 'single-state', h1: (c) => c.kidSuspended.title, first: 'main a[href^="mailto:"]' },
];
const filter = process.env.ID_CASES?.split(',');
const cases = CASES.filter((entry) => !filter || filter.includes(entry.id));

const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const evidence = [];
const journeys = [];
const failures = [];
const unknown = new Set();

/** The Core this run answers from: the case, what it has received, and a small state machine. */
const core = { entry: null, calls: [], signedIn: null, upgradeFailures: 1, onboarded: false };

function answer(path, method, body) {
  const entry = core.entry;
  const ok = (data, status = 200) => ({ status, body: { data, error: null } });
  const fail = (status, code) => ({ status, body: { data: null, error: { code, message: `Synthetic ${code}` } } });
  const guest = core.signedIn === 'guest';
  if (path === '/auth/oauth/providers') return ok({ providers: entry.google ? ['google'] : [] });
  if (path === '/auth/oauth/google') return fail(502, 'UPSTREAM_FAILED');
  if (path === '/auth/login') return fail(401, 'INVALID_CREDENTIALS');
  if (path === '/auth/signup') return fail(403, 'AGE_RESTRICTED');
  if (path === '/auth/guest') { core.signedIn = 'guest'; core.onboarded = false; return ok({ session: session(true) }); }
  if (path === '/auth/recover') return ok({ sent: true });
  if (path === '/auth/reset-password') return ok({ updated: true });
  if (path === '/auth/upgrade') {
    if (core.upgradeFailures > 0) { core.upgradeFailures -= 1; return fail(502, 'DATA_UNAVAILABLE'); }
    core.signedIn = 'adult';
    return ok({ session: session(false) });
  }
  if (path === '/auth/logout') { core.signedIn = null; return ok({}); }
  if (path === '/auth/me') {
    if (!core.signedIn) return fail(401, 'UNAUTHORIZED');
    return ok({ profile: { display_name: 'Synthetic', locale: 'en-US', theme: 'light', cover: {} }, roles: entry.roles ?? ['universal'], adminPermissions: [], avatarOptions: {},
      analyticsEnabled: false, isGuest: guest, newAccount: entry.id === 'callback-first-google', onboardingComplete: guest ? core.onboarded : true });
  }
  if (path === '/auth/age-screen') {
    if (method === 'POST') return ok({ required: false, ageBand: 'adult', protectedOrigin: false });
    // The refused child's protected guest (A.2) is screened by its origin marker: under 13, never asked again.
    const screened = entry.screened ?? (entry.id === 'signup' && core.signedIn === 'guest' ? 'under_13' : null);
    return ok(screened ? { required: false, ageBand: screened, protectedOrigin: entry.protectedOrigin === true || entry.id === 'signup' } : { required: true, ageBand: null, protectedOrigin: false });
  }
  if (path === '/verification/parent') {
    if (method === 'GET') return entry.verifyError ? fail(403, entry.verifyError) : ok({ verified: entry.verified === true });
    return ok({ verified: false, checks: { documentReadable: true, nameMatch: false, birthDateMatch: true, notExpired: true } });
  }
  if (path === '/tutor/preferences') return ok({ character: body?.character ?? 'rho', companion: null, diorama: 'diorama-a', backdrop: 'day', nickname: null, adaptations: [],
    personalized: method === 'PUT', catalog: { characters: ['rho', 'zara', 'liruf', 'dina'], dioramas: [], backdrops: [], adaptations: [], articulates: ['rho', 'zara'] } });
  if (path === '/onboarding/complete') { core.onboarded = true; return ok({ streakDays: 1 }, 201); }
  if (path === '/events') return ok({ accepted: 0 });
  if (path === '/auth/analytics-preference') return ok({ canManage: false, enabled: false, disclosed: true });
  if (path === '/analytics/tracking-decision') return ok({ excluded: false, degraded: false });
  if (path === '/learn/courses') return ok({ courses: [] });
  if (path === '/wallet/access') return ok({ holder: null, familyChild: false });
  if (path === '/learn/register' || path === '/learn/bridges') return ok(path.endsWith('register') ? { register: 'young' } : { bridges: [] });
  if (path === '/profile') return ok({ displayName: 'Synthetic', username: 'synthetic', locale: 'en-US', birthDate: null, cover: {}, avatarOptions: {}, memberSince: '2026-01-10T00:00:00Z',
    email: null, learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0, lastActiveDate: null } });
  unknown.add(`${method} ${path} (${entry.id})`);
  return ok({});
}

async function installCore(page) {
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  page.ws.addEventListener('message', async ({ data }) => {
    const message = JSON.parse(data);
    if (message.method !== 'Fetch.requestPaused' || message.sessionId !== page.sessionId) return;
    const { requestId, request } = message.params;
    try {
      const headers = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin },
        { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: '*' }];
      if (request.method === 'OPTIONS') return void await page.send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: headers });
      const path = new URL(request.url).pathname.replace(/^.*\/api\/v1/, '');
      // A multipart body (the ID photo) may arrive only as postDataEntries.
      const posted = request.postData ?? (request.postDataEntries ?? []).map((entry) => Buffer.from(entry.bytes ?? '', 'base64').toString('latin1')).join('');
      let body = null;
      try { body = posted ? JSON.parse(posted) : null; } catch { body = { raw: posted.slice(0, 2000) }; }
      core.calls.push({ method: request.method, path, body, auth: request.headers?.Authorization ?? request.headers?.authorization ?? null });
      const reply = answer(path, request.method, body);
      await page.send('Fetch.fulfillRequest', { requestId, responseCode: reply.status, responseHeaders: headers, body: Buffer.from(JSON.stringify(reply.body)).toString('base64') });
    } catch (error) {
      if (!/Invalid InterceptionId|closed|No resource/i.test(String(error))) page.errors.push(`synthetic core: ${error}`);
    }
  });
}

async function waitFor(page, expression, what, tries = 300) {
  for (let n = 0; n < tries; n++) {
    try { if (await page.evaluate(`!!(${expression})`)) return; } catch (error) { if (!/context|navigat/i.test(String(error))) throw error; }
    await sleep(50);
  }
  throw new Error(`Timed out: ${what}`);
}

async function press(page, selector) {
  const point = await page.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; });
    if (!e) return { missing: true };
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, top = document.elementFromPoint(x, y);
    return { missing: false, occluded: !(e.contains(top) || top?.contains(e) || (top?.closest('label') && top.closest('label') === e.closest('label'))), x, y };
  })()`);
  if (point.missing) throw new Error(`Missing: ${selector}`);
  if (point.occluded) throw new Error(`Occluded: ${selector}`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function type(page, selector, text) {
  await press(page, selector);
  await page.send('Input.insertText', { text });
}

async function key(page, name, code, keyCode) {
  // Enter carries its character, so a form's implicit submission happens as it does for a person.
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, ...(name === 'Enter' ? { text: '\r' } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode });
}

const TARGETS = `[...document.querySelectorAll('[data-shell] :is(a[href], button, input, select, [role=button])')]
  .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') && !e.classList.contains('lf-skip-link'); })
  .map((e) => { const t = e.matches('input[type=radio], input[type=checkbox], input[type=file]') ? (e.closest('label') ?? e) : e; const r = t.getBoundingClientRect(); return { w: r.width, h: r.height, label: (t.textContent || t.getAttribute('aria-label') || t.tagName).trim().slice(0, 40) }; })
  .filter((t) => t.w < 47.5 || t.h < 47.5)`;
const H1 = "[...document.querySelectorAll('h1')].map((h) => h.textContent.trim())";

/* ---- Journeys: real presses and typing, then what Core received ---- */
const JOURNEY = {
  async 'wrong-password'(page, c) {
    await type(page, 'input[autocomplete=username]', 'kiddo_7');
    await type(page, 'input[type=password]', 'not-this-one');
    await press(page, '[data-auth="submit"]');
    await waitFor(page, "document.querySelector('[data-shell=\"auth\"] [role=alert]')", 'wrong-password alert');
    assert.equal(await page.evaluate("document.querySelector('[role=alert]').textContent.trim()"), c.authCommon.errors.INVALID_CREDENTIALS);
    const login = core.calls.find((call) => call.path === '/auth/login');
    assert.deepEqual(login.body, { identifier: 'kiddo_7', password: 'not-this-one' }, 'a username signs in through Core\'s identifier');
    assert.equal(await page.evaluate('location.pathname'), '/login');
    // Google: a start Core cannot hand an authorize URL for says so and can be pressed again.
    await press(page, '[data-auth="google"]');
    await waitFor(page, `[...document.querySelectorAll('[role=alert]')].some((e) => e.textContent.includes(${JSON.stringify(c.authCommon.googleFailed)}))`, 'google failure');
    return { loginBody: 'identifier+password', googleFailureSaid: true };
  },
  async refusal(page, c) {
    assert.equal(await page.evaluate("document.querySelector('[data-auth=\"parent-intent\"]').checked"), true, '?intent=tutor pre-ticks the intent');
    await type(page, 'input[autocomplete=name]', 'Synthetic');
    await type(page, 'input[type=email]', 'synthetic@example.test');
    await type(page, 'input[type=password]', 'synthetic-password');
    await type(page, '[data-date-part=day]', '1');
    await type(page, '[data-date-part=month]', '1');
    await type(page, '[data-date-part=year]', '2018');
    await press(page, '[data-auth="submit"]');
    await waitFor(page, `document.activeElement?.tagName === 'H1' && document.activeElement.textContent.trim() === ${JSON.stringify(c.authSignup.refusedTitle)}`, 'refusal heading focused');
    const signup = core.calls.find((call) => call.path === '/auth/signup');
    assert.equal(signup.body.birthDate, '2018-01-01');
    assert.equal(signup.body.parentIntent, true);
    assert.equal(await page.evaluate("!!document.querySelector('input[type=email]')"), false, 'the refused form is gone');
    await press(page, '[data-auth="why"]');
    await waitFor(page, "document.querySelector('[role=dialog]')", 'why sheet');
    await key(page, 'Escape', 'Escape', 27);
    await waitFor(page, "!document.querySelector('[role=dialog]')", 'why sheet closes');
    await press(page, '[data-auth="guest"]');
    await waitFor(page, "location.pathname === '/onboarding' && document.querySelector('[data-screen=onboarding]')", 'protected guest reaches onboarding');
    const guests = core.calls.filter((call) => call.path === '/auth/guest');
    assert.deepEqual(guests.map((call) => call.body), [{ under13Origin: true }], 'only the origin marker, never the date');
    assert.equal(await page.evaluate("!!document.querySelector('.lf-age-date')"), false, 'the protected guest is never asked for a second date');
    assert.equal(core.calls.filter((call) => call.path === '/events').length, 0, 'no optional analytics event');
    return { signupBirthDate: 'sent to Core only on the sign-up request', guestBody: guests[0].body };
  },
  async recover(page, c) {
    await type(page, 'input[type=email]', 'someone@example.test');
    await press(page, '[data-auth="submit"]');
    await waitFor(page, `document.activeElement?.tagName === 'H1' && document.activeElement.textContent.trim() === ${JSON.stringify(c.authForgot.sentTitle)}`, 'sent heading focused');
    assert.deepEqual(core.calls.find((call) => call.path === '/auth/recover').body, { email: 'someone@example.test' });
    return { recoverBody: 'email' };
  },
  async reset(page, c) {
    assert.equal(await page.evaluate('location.hash'), '', 'the recovery token left the address bar');
    await type(page, 'input[type=password]', 'brand-new-pass');
    await press(page, '[data-auth="submit"]');
    await waitFor(page, `document.activeElement?.tagName === 'H1' && document.activeElement.textContent.trim() === ${JSON.stringify(c.authReset.doneTitle)}`, 'done heading focused');
    const reset = core.calls.find((call) => call.path === '/auth/reset-password');
    assert.deepEqual(reset.body, { password: 'brand-new-pass' });
    assert.equal(reset.auth, 'Bearer recovery-synthetic', 'the link\'s recovery session authorises the one reset');
    return { tokenScrubbed: true };
  },
  async 'google-return'(page) {
    // Google hands the session back in the fragment: a first sign-in lands on Learn behind the mandatory age question (A.3).
    core.signedIn = 'adult';
    const fragment = new URLSearchParams({ access_token: session(false).accessToken, refresh_token: 'synthetic', expires_in: '3600', token_type: 'bearer' });
    await page.send('Page.navigate', { url: `${origin}/auth/callback#${fragment}` });
    await waitFor(page, "location.pathname === '/learn' && document.querySelectorAll('.lf-age-date input').length === 3", 'first Google return meets the age question', 2400);
    assert.equal(await page.evaluate('location.hash'), '', 'tokens scrubbed');
    assert.equal(core.calls.filter((call) => /^\/learn\/(courses|register|bridges)/.test(call.path) || call.path.startsWith('/tutor/')).length, 0, 'no product content before screening');
    assert.equal(await page.evaluate("document.querySelectorAll('main').length"), 1, 'the age question is its own single-state screen');
    return { landsOn: '/learn behind the age question', productRequestsBeforeScreening: 0 };
  },
  async verify(page, c) {
    await press(page, '[data-auth="start"]');
    await waitFor(page, "document.querySelector('[data-screen=verify-form]')", 'form opens');
    await type(page, 'input[autocomplete=given-name]', 'Ana');
    await type(page, 'input[autocomplete=family-name]', 'Ruiz');
    await type(page, '[data-date-part=day]', '4');
    await type(page, '[data-date-part=month]', '7');
    await type(page, '[data-date-part=year]', '1988');
    await page.evaluate(`(() => { const input = document.querySelector('input[type=file]'); const data = new DataTransfer();
      data.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'id-front.png', { type: 'image/png' })); input.files = data.files;
      input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(page, `document.querySelector('.lf-id-document-name')?.textContent === 'id-front.png'`, 'file chosen');
    await press(page, '[data-auth="submit"]');
    await waitFor(page, "document.querySelector('[data-verify-failed]')", 'failed checks named');
    assert.ok(await page.evaluate(`document.body.innerText.includes(${JSON.stringify(c.authVerify.checks.nameMatch)})`));
    const post = core.calls.find((call) => call.path === '/verification/parent' && call.method === 'POST');
    assert.ok(post.body?.raw?.includes('name="givenNames"') && post.body.raw.includes('name="document"'), 'multipart with the document');
    assert.ok(!/name="documentType"/.test(post.body.raw), 'no document type (A.5)');
    return { multipart: 'givenNames, surnames, birthDate, document', failedChecksNamed: true };
  },
  async upgrade(page, c) {
    await type(page, 'input[type=email]', 'saved@example.test');
    await type(page, 'input[type=password]', 'longenough1');
    await press(page, '[data-auth="submit"]');
    await waitFor(page, "document.querySelector('[data-shell=\"auth\"] [role=alert]')", 'failure said');
    assert.equal(await page.evaluate('location.pathname'), '/upgrade-account', 'a failed save keeps the form');
    assert.equal(await page.evaluate("document.querySelector('input[type=email]').value"), 'saved@example.test');
    await press(page, '[data-auth="submit"]');
    await waitFor(page, "location.pathname === '/learn'", 'saved account lands on Learn', 2400);
    const upgrades = core.calls.filter((call) => call.path === '/auth/upgrade');
    assert.equal(upgrades.length, 2);
    assert.ok(upgrades.every((call) => call.body.email === 'saved@example.test' && !('birthDate' in call.body)), 'no date of birth on the upgrade');
    void c;
    return { upgradeAttempts: 2, landsOn: '/learn' };
  },
  async onboarding(page, c) {
    const o = c.onboardingFlow;
    await press(page, '[data-onboarding="start"]');
    await waitFor(page, "document.querySelector('[data-screen=onboarding][data-step=name]') && document.activeElement?.tagName === 'H1'", 'name step, heading focused');
    await type(page, 'input[autocomplete=given-name]', 'Alessandro');
    await key(page, 'Enter', 'Enter', 13);
    await waitFor(page, "document.querySelector('[data-step=mentor]')", 'mentor step');
    await press(page, '.lf-list-item:nth-child(2) .lf-list-row--pressable');
    await waitFor(page, `[...document.querySelectorAll('.lf-pill')].some((e) => e.textContent.trim() === ${JSON.stringify(o.chosen)})`, 'Zara chosen');
    assert.deepEqual(core.calls.find((call) => call.path === '/tutor/preferences' && call.method === 'PUT').body, { character: 'zara' });
    await press(page, '[data-onboarding="continue"]');
    await waitFor(page, "document.querySelector('[data-step=discovery]')", 'discovery step');
    await press(page, '.lf-radio-option:nth-child(5)');
    await press(page, '[data-onboarding="continue"]');
    await waitFor(page, "document.querySelector('[data-step=account]')", 'account step');
    await press(page, '[data-onboarding="later"]');
    await waitFor(page, "location.pathname === '/learn'", 'lands on Learn', 2400);
    const complete = core.calls.find((call) => call.path === '/onboarding/complete');
    assert.deepEqual(Object.keys(complete.body).sort(), ['accountOfferChoice', 'discoveryChannel', 'displayName', 'localDate']);
    assert.equal(complete.body.displayName, 'Alessandro');
    assert.equal(complete.body.discoveryChannel, 'school');
    assert.equal(complete.body.accountOfferChoice, 'later');
    return { preferences: { character: 'zara' }, complete: 'displayName, discoveryChannel, accountOfferChoice, localDate' };
  },
};

try {
  const warm = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await warm.send('Page.close').catch(() => {});
  const page = await openPage(browser.browser, { width: 375, height: 800, dark: false, newWindow: true, isolated: true });
  await installCore(page);
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');

  /** Load the case fresh (Core's state machine reset), in a locale, mode and width. */
  async function load(entry, locale, theme, width, where) {
    page.errors.length = 0;
    core.entry = entry; core.calls = []; core.signedIn = entry.signedIn; core.upgradeFailures = 1; core.onboarded = entry.onboarded ?? false;
    await page.send('Network.clearBrowserCookies');
    // A first visit to a public page would show the cookie choice over the form; it is M8's to verify (verify-public-site).
    await page.send('Network.setCookie', { name: 'lf_cc', value: 'denied', url: origin });
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (await page.evaluate('location.origin').catch(() => '') !== origin) {
      await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
      await waitFor(page, `location.origin === ${JSON.stringify(origin)}`, 'origin');
    }
    await page.evaluate(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('i18nextLng', ${JSON.stringify(locale)}); localStorage.setItem('lf-theme', ${JSON.stringify(theme)});
      ${entry.signedIn ? `localStorage.setItem('lf.session.v1', ${JSON.stringify(stored(entry.signedIn === 'guest'))});` : ''}`);
    const url = new URL(entry.path, origin); url.searchParams.set('lng', locale);
    await page.send('Page.navigate', { url: url.toString() });
    await waitFor(page, `document.querySelector('[data-shell="${entry.shell}"] h1') && document.documentElement.lang === ${JSON.stringify(locale)}`, `${where}: page`, 2400);
    await page.evaluate('document.fonts.ready');
    await waitFor(page, "!document.documentElement.classList.contains('theme-transitioning')", `${where}: theme settled`);
    if (entry.google) await waitFor(page, "document.querySelector('[data-auth=\"google\"]')", `${where}: Google shown when Core enables it`);
    await sleep(150);
  }

  const jsErrors = () => page.errors.filter((error) => !/Failed to load resource|net::ERR|synthetic core|Download the React DevTools/i.test(error));

  /*
   * The layout matrix: the page loads once per case, locale and mode; each width and text size is then applied in
   * place (the layouts answer the `app` container, so a resize is what a person turning a tablet sees) and every
   * check runs again. axe runs once per width at 100% text (text size changes no role, name or contrast pair).
   */
  for (const entry of cases.filter((candidate) => !candidate.journeyOnly)) for (const locale of LOCALES) for (const theme of THEMES) {
    const c = copy[locale];
    try {
      await load(entry, locale, theme, WIDTHS[0], `${entry.id} ${locale} ${theme}`);
    } catch (error) {
      for (const width of WIDTHS) for (const text of TEXT) failures.push(`${entry.id} ${locale} ${theme} ${width}px ${text}%: ${error.message}`);
      process.stdout.write('F');
      continue;
    }
    for (const width of WIDTHS) for (const text of TEXT) {
      const where = `${entry.id} ${locale} ${theme} ${width}px ${text}%`;
      try {
        await page.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
        await page.evaluate(`document.documentElement.style.fontSize = ${text === 100 ? "''" : `'${text}%'`}; window.scrollTo(0, 0)`);
        await sleep(120);
        const state = await page.evaluate(`(() => {
          const shell = document.querySelector('[data-shell]');
          const root = shell.closest('.lf-rebuild');
          return {
            lang: root.getAttribute('lang'), theme: root.dataset.theme, shell: shell.dataset.shell, h1: ${H1},
            mains: document.querySelectorAll('main').length, legacy: !!document.querySelector('[data-legacy-body]'), overflow: document.documentElement.scrollWidth - innerWidth,
            small: ${TARGETS},
            em: /—/.test(document.querySelector('main').innerText),
            aiTutor: /\\b(AI|IA) Tutor\\b|\\bTutor (de )?IA\\b/.test(document.body.innerText),
          };
        })()`);
        assert.equal(state.lang, locale, 'page language');
        assert.equal(state.theme, theme, 'page mode');
        assert.equal(state.shell, entry.shell, 'the shell the SPEC gives this screen');
        assert.deepEqual(state.h1, [entry.h1(c)], 'one <h1>, the rebuilt copy');
        assert.equal(state.mains, 1, 'one <main>');
        assert.equal(state.legacy, false, 'no legacy body');
        assert.ok(state.overflow <= 1, `horizontal overflow ${state.overflow}px`);
        assert.deepEqual(state.small, [], 'targets under 48 px');
        assert.equal(state.em, false, 'no em dash');
        assert.equal(state.aiTutor, false, 'the AI is never "AI Tutor" (OD-6)');
        if (entry.id === 'verify-tutor') assert.equal(core.calls.some((call) => call.path === '/verification/parent'), true, 'the Tutor status is Core\'s answer');

        if (text === 100) {
          await page.evaluate(axeSource);
          const axe = await page.evaluate("axe.run({ include: [['[data-shell]']] }, { resultTypes: ['violations'] })");
          assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} (${n.any?.[0]?.message ?? ''})`).join(', ')}`), [], 'axe violations');
        }

        // Keyboard: the skip link first, Enter to <main>, then Tab reaches the screen's first control, with a ring.
        // Reset the sequential-focus starting point to the top of the page (a blur alone leaves it on the last control).
        await page.evaluate("window.scrollTo(0, 0); document.activeElement?.blur(); document.body.setAttribute('tabindex', '-1'); document.body.focus(); document.body.removeAttribute('tabindex')");
        await key(page, 'Tab', 'Tab', 9);
        assert.equal(await page.evaluate("document.activeElement?.classList.contains('lf-skip-link') ?? false"), true, 'first Tab reaches the skip link');
        await key(page, 'Enter', 'Enter', 13);
        await waitFor(page, "document.activeElement?.tagName === 'MAIN'", `${where}: skip link moves focus to <main>`, 40);
        let reached = false;
        for (let n = 0; n < 40 && !reached; n++) {
          await key(page, 'Tab', 'Tab', 9);
          reached = await page.evaluate(`document.activeElement?.matches(${JSON.stringify(entry.first)}) ?? false`);
        }
        assert.ok(reached, `Tab reaches ${entry.first}`);
        const ring = await page.evaluate(`(() => { const e = document.activeElement; const s = getComputedStyle(e); const well = e.closest('.lf-id-document-drop, .lf-radio-option');
          return s.outlineStyle !== 'none' || s.boxShadow !== 'none' || (well && getComputedStyle(well).outlineStyle !== 'none'); })()`);
        assert.ok(ring, 'the focused control shows a focus ring');
        if (width === 375 && text === 100) {
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(join(out, `${entry.id}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
        assert.deepEqual(jsErrors(), [], 'JS errors');
        evidence.push({ case: entry.id, population: entry.signedIn ? `${entry.signedIn}${entry.roles ? ` (${entry.roles.join(',')})` : ''}` : 'visitor (signed out)', locale, theme, width, text, overflow: state.overflow, axe: text === 100 ? 0 : 'n/a' });
        process.stdout.write('.');
      } catch (error) {
        failures.push(`${where}: ${error.message}${page.errors.length ? ` [page errors: ${page.errors.slice(0, 3).join(' | ').slice(0, 600)}]` : ''}`);
        const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
        if (shot) writeFileSync(join(out, `FAIL-${entry.id}-${locale}-${theme}-${width}-${text}.png`), Buffer.from(shot.data, 'base64'));
        process.stdout.write('F');
      }
    }
  }

  /*
   * The journeys, each on a fresh load: every locale and mode on a phone (375 px), and English on a desktop (1280 px).
   */
  const journeyRuns = JOURNEYS ? LOCALES.flatMap((locale) => THEMES.map((theme) => [locale, theme, 375])).concat(THEMES.map((theme) => ['en-US', theme, 1280])) : [];
  for (const entry of cases.filter((candidate) => candidate.journey)) for (const [locale, theme, width] of journeyRuns) {
    const where = `${entry.id} journey ${locale} ${theme} ${width}px`;
    try {
      await load(entry, locale, theme, width, where);
      const result = await JOURNEY[entry.journey](page, copy[locale]);
      assert.deepEqual(jsErrors(), [], 'JS errors');
      journeys.push({ case: entry.id, journey: entry.journey, locale, theme, width, ...result });
      process.stdout.write('j');
    } catch (error) {
      failures.push(`${where}: ${error.message}${page.errors.length ? ` [page errors: ${page.errors.slice(0, 3).join(' | ').slice(0, 600)}]` : ''}`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) writeFileSync(join(out, `FAIL-${entry.id}-journey-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      process.stdout.write('J');
    }
  }
  await page.send('Page.close').catch(() => {});
} catch (error) {
  failures.push(`setup: ${error.message}`);
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({
    provenance: 'Real routes on a local Vite server in headless Chrome, real pointer and keyboard input; Core answered in the page by the script; not full-stack',
    origin, date: new Date().toISOString(), configurations: evidence.length, journeys: journeys.length, failures, evidence, journeyEvidence: journeys,
    unansweredCoreRequests: [...unknown].sort(),
  }, null, 1));
  browser.child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
console.log(`\n${evidence.length} configurations and ${journeys.length} journeys passed; ${failures.length} failed`);
if (failures.length) { console.log(failures.slice(0, 30).join('\n')); process.exitCode = 1; }
if (unknown.size) console.log(`Answered with an empty envelope: ${[...unknown].sort().join('; ')}`);
