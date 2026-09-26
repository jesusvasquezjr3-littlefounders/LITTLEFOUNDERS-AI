import { LANES, LANE_SCENARIOS } from './lanes/index.mjs';

/*
 * A synthetic Core for the rebuilt-app audits on AUTHENTICATED routes (S03.5).
 *
 * The audits must measure the rebuilt surfaces where a person meets them: on
 * the real application's routes, inside the legacy app's providers, global CSS
 * and route guards, with a signed-in session. The lane may not run a real Core
 * against a shared database or contact any real service (OD-23), so this does
 * what the existing real-route matrices (verify-age-screen, verify-analytics-
 * choice, ...) do: the browser keeps a synthetic session in the app's own
 * storage key, and every request to Core's `/api/v1/*` is answered here through
 * the DevTools `Fetch` domain. Nothing leaves the machine.
 *
 * Every answer uses Core's real envelope ({ data, error }) and the shapes the
 * app's own tests pin. The lesson documents are the product's own pilot
 * fixtures, produced inside the page by the same modules the preview entry
 * uses (see `loadLessonFixtures`), so the real route renders exactly what the
 * preview audits measured, now through `LessonRoute`, `AuthenticatedLesson-
 * Document` and the design-system root they mount.
 *
 * Unknown endpoints get `{ data: {}, error: null }` and are recorded in
 * `unknownRequests`, so a new dependency of a route is visible in the report
 * instead of silently shaping what was measured.
 *
 * The answers every route needs (the session, the age screen, analytics, the
 * profile) live here; each wave-2 lane answers the endpoints only its routes
 * call from its own `lanes/<lane>.mjs` (`respond`), and declares its
 * scenarios there too.
 */

const LEARNER_ID = '33333333-3333-4333-8333-333333333333';

/** The access token the app stores; Core never sees it (every request is answered locally). */
function token(guest) {
  const payload = Buffer.from(JSON.stringify({ sub: LEARNER_ID, is_anonymous: guest })).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${payload}.synthetic`;
}

/** The storage the app reads on load: its session key, language and mode. */
export function sessionStorageScript({ guest, locale, theme }) {
  const session = { accessToken: token(guest), refreshToken: 'synthetic', expiresAt: Date.now() + 3_600_000, user: { id: LEARNER_ID }, isGuest: guest };
  return `localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('lf.session.v1', ${JSON.stringify(JSON.stringify(session))});
    localStorage.setItem('i18nextLng', ${JSON.stringify(locale)});
    localStorage.setItem('lf-theme', ${JSON.stringify(theme)});`;
}

/** Storage for a route that must render without a session. */
export function signedOutStorageScript({ locale, theme }) {
  return `localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('i18nextLng', ${JSON.stringify(locale)});
    localStorage.setItem('lf-theme', ${JSON.stringify(theme)});`;
}

/**
 * The pilot lesson documents, built inside a page on the dev server by the
 * product's own modules (Vite compiles them), for every locale audited.
 */
export async function loadLessonFixtures(page, locales) {
  return page.evaluate(`(async () => {
    const goal = await import('/src/rebuild/learning/GoalBulletBoard.tsx');
    const allocation = await import('/src/rebuild/learning/AllocationBoard.tsx');
    const machine = await import('/src/rebuild/learning/FunctionMachineBoard.tsx');
    const out = {};
    for (const locale of ${JSON.stringify(locales)}) out[locale] = {
      goal: goal.goalBulletPilotDocument(locale, '6-9'),
      allocation: allocation.allocationPilotDocument(locale, 'adult'),
      functionMachine: machine.functionMachinePilotDocument(locale),
    };
    return JSON.parse(JSON.stringify(out));
  })()`);
}

const AGE_BANDS = { '6-9': 'under_13', '10-12': 'under_13', '13-17': '13_to_17', adult: 'adult' };

/**
 * What each authenticated scenario answers, declared by the lane that owns the
 * route (lanes/<lane>.mjs). `population` is who is signed in (every minor
 * safeguard follows age, not role): a guest before the age screen, a
 * parent-created child, an independent teen, an adult, a verified Tutor, a
 * staff member. Optional fields: `roles` (default ['universal']),
 * `adminPermissions`, `username`.
 */
export const SCENARIOS = LANE_SCENARIOS;

/**
 * Answers every `/api/v1/*` request of `page` from `page.core`
 * ({ scenario, locale, theme, fixtures }); `page.core = null` lets requests
 * through untouched (the preview entry and session-less routes).
 */
export async function installSyntheticCore(page, origin, { unknownRequests }) {
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  page.ws.addEventListener('message', async ({ data }) => {
    const message = JSON.parse(data);
    if (message.method !== 'Fetch.requestPaused' || message.sessionId !== page.sessionId) return;
    const { requestId, request } = message.params;
    const core = page.core;
    try {
      if (!core) return void await page.send('Fetch.continueRequest', { requestId });
      const url = new URL(request.url);
      const reply = (status, body) => page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
        { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin },
        { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: '*' },
      ], body: Buffer.from(JSON.stringify(body)).toString('base64') });
      if (request.method === 'OPTIONS') return void await reply(204, {});
      const answer = respond(core, url.pathname.replace(/^.*\/api\/v1/, ''), request, unknownRequests);
      if (answer === 'hold') return; // the request stays pending: the route shows its opening state
      if (answer.fail) return void await page.send('Fetch.failRequest', { requestId, errorReason: answer.fail });
      await reply(answer.status, answer.body);
    } catch (error) {
      if (!/Invalid InterceptionId|closed|No resource/i.test(String(error))) page.errors.push(`synthetic core: ${error}`);
    }
  });
}

function respond(core, path, request, unknownRequests) {
  const { scenario, locale, theme, fixtures } = core;
  const spec = SCENARIOS[scenario];
  const ok = (data) => ({ status: 200, body: { data, error: null } });
  if (path === '/auth/me') return ok({
    profile: { display_name: 'Synthetic', ...(spec.username ? { username: spec.username } : {}), locale, theme, cover: {} }, roles: spec.roles ?? ['universal'],
    adminPermissions: spec.adminPermissions ?? [], avatarOptions: {},
    analyticsEnabled: false, isGuest: spec.guest, newAccount: false, onboardingComplete: spec.onboarded ?? !spec.guest,
  });
  if (path === '/auth/age-screen') return ok(spec.ageBand
    ? { required: false, ageBand: AGE_BANDS[spec.ageBand], protectedOrigin: spec.ageBand !== 'adult' && spec.ageBand !== '13-17' }
    : { required: true, ageBand: null, protectedOrigin: false });
  if (path === '/auth/analytics-preference') return ok({ canManage: spec.ageBand === '13-17', enabled: false, disclosed: true });
  if (path === '/analytics/tracking-decision') return ok({ excluded: false, degraded: false });
  if (path === '/events') return ok({ accepted: 0 });
  // A scenario may add to (or override) the default own profile and blocked list: `profile`, `blocked` (the profile lane's P1-P3 states).
  if (path === '/profile' && request.method === 'GET') return ok({ displayName: 'Synthetic', username: 'synthetic', locale, birthDate: null, cover: {}, avatarOptions: {},
    memberSince: '2026-01-10T00:00:00Z', email: 'synthetic@example.test',
    learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0, lastActiveDate: null }, ...(spec.profile ?? {}) });
  if (path === '/profile/blocked') return ok({ users: spec.blocked ?? [] });
  for (const lane of LANES) {
    const answer = lane.respond({ core, spec, scenario, locale, theme, fixtures, path, request, ok });
    if (answer !== undefined) return answer;
  }
  unknownRequests.add(`${request.method} ${path} (${scenario})`);
  return ok({});
}
