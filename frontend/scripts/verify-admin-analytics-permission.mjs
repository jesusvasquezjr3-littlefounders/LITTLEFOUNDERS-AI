import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.PERMISSION_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/admin-analytics-permission');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
let locale = 'en-US', theme = 'light', grant = false;
let analyticsReads = 0, exclusionReads = 0;
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
          roles: ['admin'], adminPermissions: grant ? ['view_analytics'] : ['manage_content'],
          avatarOptions: {}, analyticsEnabled: false, isGuest: false,
          newAccount: false, onboardingComplete: true,
        };
      } else if (url.pathname.endsWith('/auth/age-screen')) {
        body.data = { required: false, ageBand: 'adult', protectedOrigin: false };
      } else if (url.pathname.includes('/admin/analytics/exclusions')) {
        exclusionReads++;
        throw Error('Read-only Analytics screen requested exclusion tooling');
      } else if (url.pathname.startsWith('/api/v1/admin/analytics')
        || url.pathname.startsWith('/api/v1/admin/intel')
        || url.pathname.startsWith('/api/v1/admin/insights')
        || url.pathname.endsWith('/api/v1/admin/health/services')) {
        analyticsReads++;
        if (!grant) throw Error('Analytics data requested without a grant');
        status = 502;
        body = { data: null, error: { code: 'AUDIT_FIXTURE', message: 'Permission journey uses synthetic transport' } };
      } else if (url.pathname.endsWith('/analytics/tracking-decision')) {
        body.data = { excluded: true, degraded: false };
      } else {
        status = 502;
        body = { data: null, error: { code: 'OUTSIDE_AUDIT_SCOPE', message: 'Outside Analytics permission audit' } };
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
        for (const section of ['analytics', 'intel', 'insights']) {
          grant = false;
          analyticsReads = 0;
          exclusionReads = 0;
          const path = `/admin/${section}`;
          const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: false };
          await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
          await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
          await page.send('Page.navigate', { url: `${origin}${path}` });
          await wait("location.pathname === '/learn'");
          assert.equal(analyticsReads, 0, `Denied ${section} route fetched analytics data`);
          if (section !== 'insights') {
            assert.equal(await page.evaluate(`document.querySelectorAll('a[href="${path}"]').length`), 0);
          }

          grant = true;
          await page.send('Page.navigate', { url: `${origin}${path}` });
          const destination = section === 'insights' ? '/admin/intel' : path;
          await wait(`location.pathname === '${destination}' && !!document.querySelector('h1')`);
          for (let i = 0; i < 200 && analyticsReads === 0; i++) await sleep(100);
          assert.ok(analyticsReads > 0, `${section} did not request analytics data with a grant`);
          // Intelligence opens several independent read panels. Let their
          // initial requests settle before testing a subsequent revocation.
          await sleep(700);
          assert.equal(exclusionReads, 0, 'Read-only analytics view opened support tooling');
          if (section !== 'insights') {
            assert.ok(await page.evaluate(`document.querySelectorAll('a[href="${path}"]').length > 0`));
          }
          const geometry = await page.evaluate('({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth})');
          assert.ok(geometry.scroll <= geometry.client + 1, `${section} has horizontal overflow`);
          if (section !== 'insights') {
            const shot = await page.send('Page.captureScreenshot', { format: 'png' });
            writeFileSync(join(out, `${section}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
          }

          const readsBeforeRevoke = analyticsReads;
          grant = false;
          await page.evaluate("window.dispatchEvent(new Event('focus'))");
          await wait("location.pathname === '/learn'");
          assert.equal(analyticsReads, readsBeforeRevoke, `Revocation triggered an unauthorized ${section} read`);
          evidence.push({ section, locale, theme, width, deniedDeepLink: true, grantedRoute: true, revokedOnRefresh: true, noUnauthorizedRead: true, noExclusionTooling: true, noOverflow: true });
        }
      }
    }
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  const geometry = await page.evaluate(`({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 20).map((element) => ({ tag: element.tagName, className: String(element.className).slice(0, 120),
        right: Math.round(element.getBoundingClientRect().right), scrollWidth: element.scrollWidth,
        text: element.textContent?.trim().slice(0, 70), parent: String(element.parentElement?.className).slice(0, 90) }))
  })`).catch(() => null);
  evidence.push({ failed: String(error), geometry, state: await page.evaluate('document.body.innerText.slice(0,1800)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({
    provenance: 'Actual app routes in local Chrome with synthetic Core responses. Core authorization is verified separately; these pages deliberately show upstream-unavailable fixtures, not production data.',
    evidence, errors: page.errors,
  }, null, 2));
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
}
console.log(JSON.stringify({ journeys: evidence.length, failures: evidence.filter((row) => row.failed).length, errors: page.errors.length }));
