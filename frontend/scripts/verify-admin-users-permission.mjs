import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.PERMISSION_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/admin-users-permission');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
let locale = 'en-US', theme = 'light', grant = false, usersReads = 0;
const evidence = [];

await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params;
  const url = new URL(request.url);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) {
      await page.send('Fetch.continueRequest', { requestId });
      return;
    }
    if (!url.pathname.startsWith('/api/v1/')) {
      await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      return;
    }
    let status = 200;
    let body = { data: {}, error: null };
    if (request.method !== 'OPTIONS') {
      if (url.pathname.endsWith('/auth/me')) {
        body.data = {
          profile: { display_name: 'Staff audit', locale, theme, cover: {} },
          roles: ['admin'], adminPermissions: grant ? ['manage_users'] : [],
          avatarOptions: {}, analyticsEnabled: false, isGuest: false,
          newAccount: false, onboardingComplete: true,
        };
      } else if (url.pathname.endsWith('/auth/age-screen')) {
        body.data = { required: false, ageBand: 'adult', protectedOrigin: false };
      } else if (url.pathname.endsWith('/admin/users')) {
        usersReads++;
        if (!grant) throw Error('Users data requested without a grant');
        body.data = { users: [{
          userId: id, displayName: 'Synthetic Staff', username: 'synthetic_staff',
          locale, createdAt: '2026-01-01T00:00:00Z', birthDate: null,
          roles: ['admin'],
        }] };
      } else if (url.pathname.endsWith('/admin/users/timeline')) {
        if (!grant) throw Error('Users timeline requested without a grant');
        body.data = { timeline: [] };
      } else if (url.pathname.includes('/admin/insights/')) {
        status = 403;
        body = { data: null, error: { code: 'FORBIDDEN', message: 'Separate analytics grant required' } };
      } else if (url.pathname.endsWith('/analytics/tracking-decision')) {
        body.data = { excluded: true, degraded: false };
      } else {
        status = 502;
        body = { data: null, error: { code: 'OUTSIDE_AUDIT_SCOPE', message: 'Outside Users permission audit' } };
      }
    }
    await page.send('Fetch.fulfillRequest', {
      requestId, responseCode: status,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: origin },
        { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' },
        { name: 'Access-Control-Allow-Methods', value: 'GET,POST,DELETE,OPTIONS' },
      ],
      body: Buffer.from(JSON.stringify(body)).toString('base64'),
    });
  } catch (error) {
    if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error));
  }
});

async function wait(expression) {
  for (let i = 0; i < 200; i++) {
    try { if (await page.evaluate(expression)) return; }
    catch (error) { if (!/context|navigat|Cannot read properties of null/i.test(String(error))) throw error; }
    await sleep(100);
  }
  throw Error(`Timed out: ${expression}`);
}

try {
  await warmDevServer(page, origin);
  await page.send('Page.navigate', { url: origin });
  await wait('!!document.body');
  for (locale of ['en-US', 'es-MX', 'pt-BR']) {
    for (theme of ['light', 'dark']) {
      for (const width of [375, 1280]) {
        grant = false;
        usersReads = 0;
        const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: false };
        await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
        await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
        await page.send('Page.navigate', { url: `${origin}/admin/users` });
        await wait("location.pathname === '/learn'");
        assert.equal(usersReads, 0, 'Denied route fetched a user directory');
        assert.equal(await page.evaluate("document.querySelectorAll('a[href=" + JSON.stringify('/admin/users') + "]').length"), 0);

        grant = true;
        await page.send('Page.navigate', { url: `${origin}/admin/users` });
        await wait("location.pathname === '/admin/users' && document.body.innerText.includes('Synthetic Staff')");
        assert.ok(usersReads > 0);
        assert.ok(await page.evaluate("document.querySelectorAll('a[href=" + JSON.stringify('/admin/users') + "]').length > 0"));
        const geometry = await page.evaluate('({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth})');
        assert.ok(geometry.scroll <= geometry.client + 1, 'Users permission view has horizontal overflow');
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(out, `${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));

        const readsBeforeRevoke = usersReads;
        grant = false;
        await page.evaluate("window.dispatchEvent(new Event('focus'))");
        await wait("location.pathname === '/learn'");
        assert.equal(usersReads, readsBeforeRevoke, 'Revocation triggered an unauthorized directory read');
        evidence.push({ locale, theme, width, deniedDeepLink: true, grantedView: true, revokedOnRefresh: true, noUnauthorizedRead: true, noOverflow: true });
      }
    }
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  evidence.push({ failed: String(error), state: await page.evaluate('document.body.innerText.slice(0,1800)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({
    provenance: 'Actual app routes in local Chrome with synthetic Core transport; Core API authorization verified separately. Not full-stack or release acceptance.',
    evidence, errors: page.errors,
  }, null, 2));
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
}
console.log(JSON.stringify(evidence));
