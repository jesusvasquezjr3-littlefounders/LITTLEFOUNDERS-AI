/* Local browser audit. API fixtures are intercepted; no database or provider is contacted. */
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const output = resolve('../audit-results');
mkdirSync(output, { recursive: true });
const profileDir = mkdtempSync(join(output, 'browser-profile-'));
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const origin = 'http://127.0.0.1:5177';
const runName = (process.env.AUDIT_RUN ?? 'platform-browser').replace(/[^a-z0-9-]/gi, '-');
const locale = process.env.AUDIT_LOCALE ?? 'en-US';
const theme = process.env.AUDIT_THEME ?? 'dark';
const browserName = process.env.AUDIT_BROWSER ?? 'Chrome';
const rows = [];
const requests = [];
const browser = await launchBrowser(profileDir);
const page = await openPage(browser.browser, { width: 1440, height: 900, dark: false });
let role = 'visitor';
let mode = 'empty';
const kids = [1, 2].map((n) => ({ userId: `kid-${n}`, displayName: `Learner ${n}`, username: `learner_${n}`, analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 0, taskStreakDays: 0 }));
function fixture(path) {
  if (path === '/auth/me') return { profile: { display_name: 'Audit learner', username: 'audit', locale, theme: 'light', cover: {} }, roles: role === 'guest' ? ['universal'] : [role], avatarOptions: {}, analyticsEnabled: false, onboardingComplete: role !== 'guest' };
  if (mode === 'error') return null;
  if (path === '/family/kids') return { kids: mode === 'family' ? kids : [] };
  if (path === '/learn/courses') return { courses: [] };
  if (path === '/profile') return { displayName: 'Audit learner', username: 'audit', locale, birthDate: null, cover: {}, avatarOptions: {}, memberSince: '2026-01-01', email: 'audit@example.invalid', followers: 0, following: 0, learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0, lastActiveDate: null }, courseBadges: [] };
  if (/\/(followers|following|blocked)$/.test(path)) return { users: [] };
  if (path === '/tasks' || path === '/tasks/mine') return { tasks: [] };
  if (/^\/tasks\/catalog/.test(path)) return { items: [] };
  if (/^\/tasks\/redemptions/.test(path)) return { redemptions: [] };
  if (path === '/tasks/goals') return { goals: [] };
  if (path === '/tasks/wallet') return { balances: { save: 0, spend: 0, share: 0 } };
  if (path === '/tasks/wallet/ledger') return { entries: [] };
  if (path === '/banking/account') return { account: null };
  return null;
}
await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async (event) => {
  try {
  const message = JSON.parse(event.data);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params;
  const url = new URL(request.url);
  if (url.origin === origin || url.protocol === 'data:') {
    await page.send('Fetch.continueRequest', { requestId });
    return;
  }
  if (url.pathname.startsWith('/api/v1/')) {
    const path = url.pathname.slice('/api/v1'.length);
    requests.push({ role, mode, method: request.method, path });
    const data = fixture(path);
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'OPTIONS' || data ? 200 : 503,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: '*' }],
      body: Buffer.from(JSON.stringify(data ? { data, error: null } : { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Audit service unavailable' } })).toString('base64') });
  } else {
    await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
  }
  } catch (error) {
    // A navigation can cancel an intercepted request before its reply is sent.
    if (!/Invalid InterceptionId|Session closed|Target closed/.test(String(error))) throw error;
  }
});

const publicRoutes = ['/', '/how-it-works', '/families', '/faq', '/legal/terms', '/legal/privacy', '/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback', '/badge/invalid', '/missing/route'];
const protectedRoutes = ['/learn', '/learn/audit-course', '/learn/audit-course/placement', '/learn/audit-course/territory', '/learn/lesson/invalid', '/tutor', '/tasks', '/banking', '/family', '/family/kid-1/territory', '/family/kid-1/tutor', '/profile', '/profile/avatar', '/profile/settings', '/profile/followers', '/profile/following', '/audit', '/audit/followers', '/audit/following', '/verify-parent', '/upgrade-account', '/onboarding', '/admin', '/admin/content', '/admin/users', '/admin/emails', '/admin/insights', '/admin/intel', '/admin/analytics', '/admin/generation', '/admin/audit', '/admin/roles'];
const viewports = [[1440, 900], [1024, 768], [844, 390], [390, 844], [320, 844]];
try {
  await warmDevServer(page, origin);
  for (const [width, height] of viewports) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const scenarios = process.env.AUDIT_QUICK
      ? [['visitor', 'empty', ['/', '/families', '/faq', '/legal/privacy', '/login']], ['parent', 'family', ['/family']], ['kid', 'empty', ['/profile', '/profile/settings']], ['kid', 'error', ['/tasks', '/banking']]]
      : width === 1440 || width === 390
      ? [['visitor', 'empty', [...publicRoutes, ...protectedRoutes]], ['kid', 'empty', protectedRoutes], ['parent', 'empty', protectedRoutes], ['parent', 'family', ['/family']], ['guest', 'empty', ['/learn', '/onboarding']], ['universal', 'empty', ['/tasks', '/family', '/admin/roles']], ['kid', 'error', ['/learn', '/tasks', '/banking', '/profile', '/profile/settings']]]
      : [['visitor', 'empty', publicRoutes], ['kid', 'empty', ['/learn', '/tasks', '/banking', '/profile/settings']], ['parent', 'family', ['/family']]];
    for (const [nextRole, nextMode, routes] of scenarios) {
      role = nextRole;
      mode = nextMode;
      await page.evaluate(`localStorage.clear(); ${role === 'visitor' ? '' : `localStorage.setItem('lf.session.v1', ${JSON.stringify(JSON.stringify({ accessToken: 'audit-token', refreshToken: 'audit-refresh', expiresAt: Date.now() + 3600000, user: { id: `audit-${role}` }, isGuest: role === 'guest' }))});`}`);
      await page.evaluate(`localStorage.setItem('lf-theme', ${JSON.stringify(theme)}); localStorage.setItem('i18nextLng', ${JSON.stringify(locale)})`);
      for (const route of routes) {
        page.errors.length = 0;
        page.failedRequests.length = 0;
        await page.send('Page.navigate', { url: origin + route });
        for (let i = 0; i < 100; i++) {
          await sleep(100);
          if (await page.evaluate(`document.readyState === 'complete' && (document.querySelector('#root')?.textContent?.length ?? 0) > 30`)) break;
        }
        await sleep(450);
        const state = await page.evaluate(`({ path: location.pathname, title: document.title, text: document.querySelector('#root')?.innerText?.slice(0, 500), overflow: document.documentElement.scrollWidth > innerWidth + 1, links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')), buttons: [...document.querySelectorAll('button')].map(b=>({name:b.getAttribute('aria-label') || b.innerText,disabled:b.disabled})) })`);
        await page.evaluate(axe);
        const violations = await page.evaluate(`axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})))`);
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        const focus = await page.evaluate(`({tag:document.activeElement?.tagName, name:document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.slice(0,100)})`);
        const rendered = await page.evaluate(`({actualLocale:document.documentElement.lang,actualTheme:document.documentElement.classList.contains('dark')?'dark':'light'})`);
        const row = { viewport: `${width}x${height}`, role, mode, route, theme, locale, ...rendered, ...state, violations, focus, errors: [...page.errors], failedRequests: [...page.failedRequests] };
        rows.push(row);
        if ((route === '/family' && mode === 'family') || (role === 'visitor' && route === '/login') || state.overflow || violations.length || page.errors.length) {
          const name = `${runName}-${width}-${role}-${mode}-${route.replaceAll('/', '_') || 'home'}.png`;
          const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(join(output, name), Buffer.from(data, 'base64'));
          row.screenshot = name;
        }
        writeFileSync(join(output, `${runName}.json`), JSON.stringify({ provenance: `Local ${browserName}; intercepted API fixtures; no real providers or database`, rows, requests }, null, 2));
        console.log(`${width} ${role} ${mode} ${route} -> ${state.path}: axe=${violations.length} overflow=${state.overflow} errors=${page.errors.length}`);
      }
    }
  }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
  await sleep(1000);
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
const failingRows = rows.filter((row) => row.overflow || row.violations.length || row.errors.length);
console.log(`Platform audit: ${rows.length} rendered cases; ${failingRows.length} cases with findings.`);
process.exitCode = failingRows.length ? 1 : 0;
