import { app, preview } from './helpers.mjs';

/*
 * Lane 5 (profile): profile, social, settings and the account.
 *
 * W2P.1: the rebuilt own profile (P1), look editor (P2) and Settings (P3) on
 * their real routes, for every population they serve (every minor safeguard
 * follows age, not role): an adult, a verified parent (the Tutor console), an
 * independent teen (OD-3 Option B, E.8) with an E.13-flagged handle, a
 * parent-created child aged 6-9 (A.6, the youngest copy budget) and a guest.
 * The preview entry adds the states a real route only reaches by failure
 * (loading, failed, offline, a failed save).
 */
export const lane = 'profile';

export const states = [
  // P1 /profile
  app('/profile@adult', '/profile', 'profile-adult', '[data-screen="own-profile"] .lf-profile-stats', { readyAlso: '[data-screen="own-profile"] .lf-profile-badge' }),
  app('/profile@tutor', '/profile', 'profile-tutor', '[data-screen="own-profile"] .lf-pill'),
  app('/profile@teen-flagged', '/profile', 'profile-teen', '[data-screen="own-profile"] .lf-profile-stats',
    { readyAlso: ['[data-social-audit="profile-safety"]', '[data-social-audit="teen-connections"] .lf-social-tier-list li'] }),
  app('/profile@kid-6-9', '/profile', 'profile-kid', '[data-screen="own-profile"][data-age-band="6-9"] .lf-profile-stats'),
  app('/profile@guest', '/profile', 'profile-guest', '[data-screen="own-profile"] .lf-profile-stats'),
  // P2 /profile/avatar
  app('/profile/avatar@adult', '/profile/avatar', 'profile-adult', '[data-screen="look-editor"] .lf-look-part[data-part="accessories"] .lf-picture-input:checked'),
  app('/profile/avatar@kid-6-9', '/profile/avatar', 'profile-kid', '[data-screen="look-editor"][data-age-band="6-9"] .lf-look-part[data-part="cover"]'),
  // P3 /profile/settings: every panel the page composes, in the state Core answers for that population.
  app('/profile/settings@adult', '/profile/settings', 'profile-adult', '[data-screen="settings"] .lf-settings-form',
    { readyAlso: ['[data-screen="settings"] .lf-settings-blocked li', '.lf-disposition dl', '.lf-account-deletion', '.lf-session-preferences'] }),
  app('/profile/settings@teen', '/profile/settings', 'settings-teen', '.lf-analytics-choice [role="switch"]',
    { readyAlso: ['.lf-memory-self-review .lf-memory-note', '[data-screen="settings"] .lf-settings-form', '.lf-disposition dl'] }),
  app('/profile/settings@kid-6-9', '/profile/settings', 'profile-kid', '[data-screen="settings"][data-age-band="6-9"] [data-field="username"]',
    { readyAlso: ['.lf-disposition dl', '.lf-account-deletion'] }),
  app('/profile/settings@guest', '/profile/settings', 'profile-guest', '[data-screen="settings"] .lf-card--primary', { readyAlso: ['.lf-account-deletion'] }),
  // States only a failure reaches, from fixtures.
  ...['loading', 'failed', 'offline', 'noUsername', 'noBadges', 'copied'].map((state) => preview(`own-profile@${state}`, { screen: 'own-profile', state })),
  ...['saving', 'failed', 'loadFailed', 'offline'].map((state) => preview(`look-editor@${state}`, { screen: 'look-editor', state })),
  ...['editing', 'errors', 'loading', 'failed'].map((state) => preview(`account-settings@${state}`, { screen: 'account-settings', state })),
];

const BADGES = [
  { slug: 'financial-education', title: { 'en-US': 'Financial Education', 'es-MX': 'Educación financiera', 'pt-BR': 'Educação financeira' }, badgeAsset: 'course-badges/financial-education.png', completedAt: '2026-08-14T12:00:00Z' },
  { slug: 'first-lemonade-stand', title: { 'en-US': 'Your First Lemonade Stand', 'es-MX': 'Tu primer puesto de limonada', 'pt-BR': 'Sua primeira barraca de limonada' }, badgeAsset: 'course-badges/first-lemonade-stand.png', completedAt: '2026-09-02T12:00:00Z' },
];
const STATS = { xpPoints: 12450, minutesLearned: 1320, lessonsCompleted: 48, streakDays: 12, lastActiveDate: null };
const LOOK = { skinColor: ['d08b5b'], top: ['curly'], hairColor: ['2c1b18'], eyes: ['happy'], eyebrows: ['default'], mouth: ['smile'],
  clothing: ['hoodie'], clothesColor: ['5199e4'], accessories: ['round'], accessoriesProbability: 100, facialHairProbability: 0 };
const BLOCKED = [{ userId: '66666666-6666-4666-8666-666666666666', displayName: 'Bartolomeo Alessandro Rodríguez', username: 'bartolomeo_2014', avatarOptions: {}, isTutor: false }];

const profile = (extra) => ({ displayName: 'María Fernanda de la Cruz Villanueva', username: 'maria_fernanda_22', avatarOptions: LOOK, cover: { preset: 'ocean' },
  learningStats: STATS, courseBadges: BADGES, social: { tier: 'adult', privateProfile: false }, profileReview: { flagged: false, fields: [] }, ...extra });

/*
 * `profile` and `blocked` extend synthetic-core's default own profile; `deletion`
 * is what GET /account/deletion answers; `disposition` whether the learner has a
 * profile yet; `memory` whether GET /tutor/memory-proposals is theirs (OD-18).
 */
export const scenarios = {
  'settings-teen': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', memory: true,
    profile: profile({ displayName: 'Rio Montes', username: 'rio_montes', birthDate: '2010-06-02', social: { tier: 'teen', privateProfile: true } }), deletion: 'grace' },
  'profile-adult': { population: 'adult', guest: false, ageBand: 'adult', mentor: 'liruf', profile: profile({ birthDate: null }), blocked: BLOCKED, deletion: 'grace' },
  'profile-tutor': { population: 'verified parent (Tutor)', guest: false, ageBand: 'adult', roles: ['parent'], profile: profile({ displayName: 'Jesús Vásquez' }), deletion: 'grace' },
  'profile-teen': { population: 'independent teen 13-17, E.13-flagged handle', guest: false, ageBand: '13-17', mentor: 'dina', teenRequests: true,
    profile: profile({ displayName: 'Rio Montes', username: 'rio_ig_2010', cover: { preset: 'grape' }, social: { tier: 'teen', privateProfile: true },
      profileReview: { flagged: true, fields: ['username'] } }), deletion: 'grace' },
  'profile-kid': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', roles: ['kid'], mentor: 'zara',
    profile: profile({ displayName: 'Valentina', username: 'vale_rocket', birthDate: '2017-03-14', cover: { preset: 'forest' }, social: { tier: 'guardian', privateProfile: true },
      avatarOptions: { skinColor: ['ffdbb4'], top: ['bun'], hairColor: ['c93305'], eyes: ['default'], mouth: ['twinkle'], clothing: ['overall'], clothesColor: ['ffafb9'] } }),
    deletion: 'kid' },
  'profile-guest': { population: 'guest (age screen: adult, onboarding finished)', guest: true, onboarded: true, ageBand: 'adult',
    profile: profile({ displayName: 'Guest', username: null, courseBadges: [], learningStats: { ...STATS, xpPoints: 30, lessonsCompleted: 1, minutesLearned: 4, streakDays: 1 },
      social: { tier: 'closed', privateProfile: true }, avatarOptions: {} }), deletion: 'guest' },
};

const MEMORY_NOTE = { 'en-US': 'Saving for a bike.', 'es-MX': 'Ahorra para una bici.', 'pt-BR': 'Poupa para uma bicicleta.' };
const refuse = (status, code) => ({ status, body: { data: null, error: { code, message: 'Synthetic refusal' } } });

function deletionAnswer(kind) {
  if (kind === 'kid') return { deletion: null, eligibility: { allowed: false, reason: 'kid' } };
  const guest = kind === 'guest';
  return { deletion: null, eligibility: { allowed: true, population: guest ? 'guest' : 'adult', graceDays: guest ? 0 : 14, immediate: guest,
    reauth: guest ? 'none' : 'password', children: { lastTutorOf: 0, sharedTutorOf: 0 } } };
}

export function respond({ spec, locale, path, request, ok }) {
  // The teen's own Mentor-memory review queue (OD-18): one proposed note. Anyone else's queue is not theirs.
  if (path === '/tutor/memory-proposals' && request.method === 'GET') {
    if (!spec.memory) return refuse(403, 'FORBIDDEN');
    return ok({ proposals: [{ id: '55555555-5555-4555-8555-555555555555', proposed: MEMORY_NOTE[locale], expectedBefore: null, sessionId: null, createdAt: '2026-09-20T10:00:00Z' }], current: null });
  }
  if (path === '/tutor/disposition' && request.method === 'GET') return ok({ exists: true, current: true, sessionsObserved: 6, helpStyle: 'independent', persistence: 'persists',
    explanation: 'unknown', persistentlyDeclined: ['less_text'], typicalReplySeconds: 12, personas: [], effects: [], updatedAt: '2026-09-20T10:00:00Z' });
  // Every Settings page composes the deletion panel: a scenario without its own answer gets its population's.
  if (path === '/account/deletion' && request.method === 'GET') {
    return ok(deletionAnswer(spec.deletion ?? ((spec.roles ?? []).includes('kid') ? 'kid' : spec.guest ? 'guest' : 'grace')));
  }
  if (path === '/profile/connection-requests' && request.method === 'GET') return ok({ nextOffset: null, requests: spec.teenRequests
    ? [{ requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', requestedAt: '2026-09-24T10:00:00Z', requester: { username: 'omar_valdes_rios', displayName: 'Omar Alejandro Valdés' } }] : [] });
  if (path === '/profile/followers' && request.method === 'GET') return ok({ users: [] });
  if (path === '/profile' && request.method === 'PATCH') return ok({ updated: true });
  if ((path === '/profile/avatar' || path === '/profile/cover') && request.method === 'PUT') return ok({ updated: true });
  return undefined;
}
