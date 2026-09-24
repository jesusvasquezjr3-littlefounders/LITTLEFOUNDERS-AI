import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.PERMISSION_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/admin-overview-permissions');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
const families = [
  { grant: 'manage_users', visible: '/admin/users' },
  { grant: 'manage_content', visible: '/admin/content' },
  { grant: 'view_analytics', visible: '/admin/analytics' },
  { grant: 'manage_support', visible: '/admin/emails' },
];
let locale = 'en-US', theme = 'light', grant = null;
let overviewReads = 0, analyticsReads = 0;
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
          roles: ['admin'], adminPermissions: grant ? [grant] : [],
          avatarOptions: {}, analyticsEnabled: false, isGuest: false,
          newAccount: false, onboardingComplete: true,
        };
      } else if (url.pathname.endsWith('/auth/age-screen')) {
        body.data = { required: false, ageBand: 'adult', protectedOrigin: false };
      } else if (url.pathname.endsWith('/api/v1/admin/overview')) {
        overviewReads++;
        if (!grant) throw Error('Overview requested without a staff grant');
        const projection = {};
        if (grant === 'manage_users') projection.users = { total: 2, staff: 1, byRole: { admin: 1, parent: 1 } };
        if (grant === 'manage_content') projection.content = { courses: { published: 1 }, lessons: { published: 3 }, reviewQueue: 1 };
        if (grant === 'manage_support') projection.audit = { total: 7 };
        body.data = projection;
      } else if (url.pathname.endsWith('/api/v1/admin/health/services')) {
        analyticsReads++;
        if (grant !== 'view_analytics') throw Error('Health requested without an analytics grant');
        body.data = { summary: { total: 0, down: 0 }, monitors: [] };
      } else if (url.pathname.endsWith('/api/v1/admin/learning/retention')) {
        analyticsReads++;
        if (grant !== 'view_analytics') throw Error('Retention requested without an analytics grant');
        body.data = { buckets: [], byTopic: [] };
      } else if (url.pathname.endsWith('/analytics/tracking-decision')) {
        body.data = { excluded: true, degraded: false };
      } else {
        status = 502;
        body = { data: null, error: { code: 'OUTSIDE_AUDIT_SCOPE', message: 'Outside Overview permission audit' } };
      }
    }
    await page.send('Fetch.fulfillRequest', {
      requestId, responseCode: status,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: origin },
        { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' },
        { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
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
  throw Error('Timed out: ' + expression);
}

try {
  await warmDevServer(page, origin);
  await page.send('Page.navigate', { url: origin });
  await wait('!!document.body');
  for (locale of ['en-US', 'es-MX', 'pt-BR']) {
    for (theme of ['light', 'dark']) {
      for (const width of [375, 1280]) {
        for (const family of families) {
          grant = null;
          overviewReads = 0;
          analyticsReads = 0;
          const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: false };
          await page.evaluate('localStorage.clear();sessionStorage.clear();localStorage.setItem("lf.session.v1",' + JSON.stringify(JSON.stringify(session)) + ');localStorage.setItem("i18nextLng",' + JSON.stringify(locale) + ');localStorage.setItem("lf-theme",' + JSON.stringify(theme) + ');');
          await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
          await page.send('Page.navigate', { url: origin + '/admin' });
          await wait("location.pathname === '/learn'");
          assert.equal(overviewReads, 0, 'Ungranted Overview requested platform totals');
          assert.equal(analyticsReads, 0);
          assert.equal(await page.evaluate("document.querySelectorAll('a[href=\"/admin\"]').length"), 0);

          grant = family.grant;
          await page.send('Page.navigate', { url: origin + '/admin' });
          await wait("location.pathname === '/admin' && !!document.querySelector('h1')");
          for (let i = 0; i < 200 && overviewReads === 0; i++) await sleep(100);
          assert.ok(overviewReads > 0, 'Granted Overview did not request its projection');
          await sleep(400);
          const links = await page.evaluate("[...document.querySelectorAll('a[href^=\"/admin/\"]')].map((a) => a.getAttribute('href'))");
          assert.ok(links.includes(family.visible), family.grant + ' destination is missing');
          for (const other of families.filter((row) => row.grant !== family.grant)) {
            assert.equal(links.includes(other.visible), false, family.grant + ' exposes ' + other.visible);
          }
          assert.equal(analyticsReads > 0, family.grant === 'view_analytics');
          const geometry = await page.evaluate('({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth})');
          assert.ok(geometry.scroll <= geometry.client + 1, family.grant + ' Overview has horizontal overflow');
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(join(out, family.grant + '-' + locale + '-' + theme + '-' + width + '.png'), Buffer.from(shot.data, 'base64'));

          const readsBeforeRevoke = overviewReads;
          grant = null;
          await page.evaluate("window.dispatchEvent(new Event('focus'))");
          await wait("location.pathname === '/learn'");
          assert.equal(overviewReads, readsBeforeRevoke, 'Revocation requested platform totals again');
          evidence.push({ grant: family.grant, locale, theme, width, deniedWithoutGrant: true, projectedView: true, noCrossFamilyLinks: true, revokedOnRefresh: true, noOverflow: true });
        }
      }
    }
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  evidence.push({ failed: String(error), state: await page.evaluate('document.body.innerText.slice(0,1800)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({
    provenance: 'Actual local app routes in Chrome with synthetic Core projections. Core verifies each projection separately; not full-stack or release acceptance.',
    evidence, errors: page.errors,
  }, null, 2));
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
}
console.log(JSON.stringify({ journeys: evidence.length, failures: evidence.filter((row) => row.failed).length, errors: page.errors.length }));
