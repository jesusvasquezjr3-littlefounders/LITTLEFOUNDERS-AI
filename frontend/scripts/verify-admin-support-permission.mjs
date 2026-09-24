import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.PERMISSION_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/admin-support-permission');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
let locale = 'en-US', theme = 'light', grant = false;
let supportReads = 0;
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
          roles: ['admin'], adminPermissions: grant ? ['manage_support'] : ['manage_content'],
          avatarOptions: {}, analyticsEnabled: false, isGuest: false,
          newAccount: false, onboardingComplete: true,
        };
      } else if (url.pathname.endsWith('/auth/age-screen')) {
        body.data = { required: false, ageBand: 'adult', protectedOrigin: false };
      } else if (url.pathname.startsWith('/api/v1/admin/emails') || url.pathname.startsWith('/api/v1/admin/audit')) {
        supportReads++;
        if (!grant) throw Error('Support data requested without a grant');
        if (url.pathname.endsWith('/admin/emails/logs')) {
          body.data = { entries: [], total: 0 };
        } else if (url.pathname.endsWith('/admin/emails/summary')) {
          body.data = { total: 0, statuses: {}, templates: {}, locales: {}, trend: [] };
        } else if (url.pathname.endsWith('/admin/audit')) {
          body.data = { entries: [], total: 0, limit: 50, offset: 0 };
        }
      } else if (url.pathname.endsWith('/analytics/tracking-decision')) {
        body.data = { excluded: true, degraded: false };
      } else {
        status = 502;
        body = { data: null, error: { code: 'OUTSIDE_AUDIT_SCOPE', message: 'Outside Support permission audit' } };
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
  throw Error(`Timed out: ${expression}`);
}

try {
  await warmDevServer(page, origin);
  await page.send('Page.navigate', { url: origin });
  await wait('!!document.body');
  for (locale of ['en-US', 'es-MX', 'pt-BR']) {
    for (theme of ['light', 'dark']) {
      for (const width of [375, 1280]) {
        for (const section of ['emails', 'audit']) {
          grant = false;
          supportReads = 0;
          const path = `/admin/${section}`;
          const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: false };
          await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
          await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
          await page.send('Page.navigate', { url: `${origin}${path}` });
          await wait("location.pathname === '/learn'");
          assert.equal(supportReads, 0, `Denied ${section} route fetched support data`);
          assert.equal(await page.evaluate(`document.querySelectorAll('a[href="${path}"]').length`), 0);

          grant = true;
          await page.send('Page.navigate', { url: `${origin}${path}` });
          await wait(`location.pathname === '${path}' && !!document.querySelector('h1')`);
          for (let i = 0; i < 200 && supportReads === 0; i++) await sleep(100);
          assert.ok(supportReads > 0, `${section} did not request data with a grant`);
          await sleep(300);
          assert.ok(await page.evaluate(`document.querySelectorAll('a[href="${path}"]').length > 0`));
          const geometry = await page.evaluate('({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth})');
          assert.ok(geometry.scroll <= geometry.client + 1, `${section} has horizontal overflow`);
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(join(out, `${section}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));

          const readsBeforeRevoke = supportReads;
          grant = false;
          await page.evaluate("window.dispatchEvent(new Event('focus'))");
          await wait("location.pathname === '/learn'");
          assert.equal(supportReads, readsBeforeRevoke, `Revocation triggered an unauthorized ${section} read`);
          evidence.push({ section, locale, theme, width, deniedDeepLink: true, grantedView: true, revokedOnRefresh: true, noUnauthorizedRead: true, noOverflow: true });
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
    provenance: 'Actual app routes in local Chrome with synthetic Core responses; Core API authorization verified separately. Not full-stack or release acceptance.',
    evidence, errors: page.errors,
  }, null, 2));
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
}
console.log(JSON.stringify({ journeys: evidence.length, failures: evidence.filter((row) => row.failed).length, errors: page.errors.length }));
