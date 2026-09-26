import { app, preview } from './helpers.mjs';

/*
 * Lane 5 (profile): profile, social, settings and the account.
 *
 * W2P.1: the rebuilt own profile (P1), look editor (P2) and Settings (P3) on
 * their real routes; W2P.2: other people's profiles (P6) and the four people
 * lists (P4, P5, P7, P8), for every population they serve (every minor safeguard
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
  // W2P.2, P6 /@username: another person's profile, as each population sees it (Core decides the tier and the connection mode).
  app('/@marta@adult', '/@marta', 'profile-adult', '[data-screen="public-profile"] .lf-profile-stats', { readyAlso: '[data-screen="public-profile"] .lf-profile-badge' }),
  app('/@marta@tutor', '/@marta', 'profile-tutor', '[data-screen="public-profile"] .lf-profile-names .lf-pill'),
  app('/@marta@kid-6-9', '/@marta', 'profile-kid', '[data-screen="public-profile"][data-age-band="6-9"] .lf-profile-connect-note'),
  app('/@rio_montes@adult', '/@rio_montes', 'profile-adult', '[data-screen="public-profile"] .lf-profile-connect .lf-button--accent'),
  app('/@rio_montes@kid-6-9', '/@rio_montes', 'profile-kid', '[data-screen="public-profile"][data-age-band="6-9"] .lf-profile-connect-note'),
  app('/@maria_fernanda_22@self', '/@maria_fernanda_22', 'profile-adult', '[data-screen="public-profile"] .lf-profile-actions a[href="/profile"]'),
  app('/@vanished@adult', '/@vanished', 'profile-adult', '[data-screen="public-profile"] .lf-account-state a'),
  // P4, P5, P7, P8: the people lists.
  app('/profile/followers@adult', '/profile/followers', 'profile-adult', '[data-screen="people-list"] .lf-people-row'),
  app('/profile/followers@teen', '/profile/followers', 'profile-teen', '[data-screen="people-list"] .lf-people-row button'),
  app('/profile/followers@kid-6-9', '/profile/followers', 'profile-kid', '[data-screen="people-list"][data-age-band="6-9"] .lf-people-row'),
  app('/profile/following@adult', '/profile/following', 'profile-adult', '[data-screen="people-list"] .lf-people-row button'),
  app('/profile/following@guest', '/profile/following', 'profile-guest', '[data-screen="people-list"] .lf-state'),
  app('/@marta/followers@adult', '/@marta/followers', 'profile-adult', '[data-screen="people-list"][data-owner="other"] .lf-people-row'),
  app('/@marta/following@kid-6-9', '/@marta/following', 'profile-kid', '[data-screen="people-list"][data-owner="other"] .lf-people-row'),
  // States only a failure reaches, from fixtures.
  ...['loading', 'failed', 'offline', 'noUsername', 'noBadges', 'copied'].map((state) => preview(`own-profile@${state}`, { screen: 'own-profile', state })),
  ...['saving', 'failed', 'loadFailed', 'offline'].map((state) => preview(`look-editor@${state}`, { screen: 'look-editor', state })),
  ...['editing', 'errors', 'loading', 'failed'].map((state) => preview(`account-settings@${state}`, { screen: 'account-settings', state })),
  ...['childSubject', 'asked', 'privateAsked', 'followFailed', 'askFailed', 'reported', 'blockFailed', 'noBadges', 'loading', 'failed', 'offline']
    .map((state) => preview(`public-profile@${state}`, { screen: 'public-profile', state })),
  // The three dialogs of P6: the report, the block confirmation and the confirmation before leaving a child's or a private teen's profile.
  preview('public-profile@report-dialog', { screen: 'public-profile', state: 'adult' }, { open: ['[data-screen="public-profile"] .lf-card button[aria-haspopup="dialog"]:not(.lf-button--danger)'] }),
  preview('public-profile@block-dialog', { screen: 'public-profile', state: 'adult' }, { open: ['[data-screen="public-profile"] .lf-button--danger'] }),
  preview('public-profile@leave-dialog', { screen: 'public-profile', state: 'childFollowed' }, { open: ['[data-screen="public-profile"] .lf-profile-actions .lf-button--secondary'] }),
  ...['unfollowed', 'unfollowFailed', 'emptyOwn', 'emptyPublic', 'unavailable', 'loading', 'failed', 'offline']
    .map((state) => preview(`people-list@${state}`, { screen: 'people-list', state })),
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

const PEOPLE = [
  { userId: '71111111-1111-4111-8111-111111111111', displayName: 'Bartolomeo Alessandro Rodríguez Villanueva', username: 'bartolomeo_villa', avatarOptions: LOOK, isTutor: false },
  { userId: '72222222-2222-4222-8222-222222222222', displayName: 'Jesús Vásquez', username: 'jesus_v', avatarOptions: {}, isTutor: true },
  { userId: '73333333-3333-4333-8333-333333333333', displayName: 'Luz', username: 'luz', avatarOptions: { top: ['bun'], hairColor: ['c93305'] }, isTutor: false },
];
const publicShape = (profile) => ({ displayName: profile.displayName, username: profile.username, cover: profile.cover, avatarOptions: profile.avatarOptions,
  memberSince: '2026-01-10T00:00:00Z', learningStats: { ...profile.learningStats, lastActiveDate: null }, courseBadges: profile.courseBadges });
/*
 * The other people a viewer may open. `marta` is an adult, a verified parent whose Tutor pill Core shows only inside an
 * established relationship (E.5: here, the Tutor viewer's mutual follow); `rio_montes` an independent teen who has not
 * accepted the viewer (E.8's private card).
 */
const SUBJECTS = {
  marta: (tier, spec) => {
    const tutorViewer = (spec.roles ?? []).includes('parent');
    return { visibility: 'full', ...publicShape({ displayName: 'Marta Solís Echeverría', username: 'marta', cover: { preset: 'sunset' },
      avatarOptions: { skinColor: ['ae5d29'], top: ['bob'], hairColor: ['2c1b18'], clothing: ['blazerAndShirt'], clothesColor: ['25557c'] },
      learningStats: { xpPoints: 3120, minutesLearned: 410, lessonsCompleted: 22, streakDays: 5 }, courseBadges: BADGES.slice(0, 1) }),
    isFollowing: tutorViewer, requiresGuardianApproval: false, connection: tier === 'guardian' ? 'managed' : 'follow', isSelf: false, isTutor: tutorViewer };
  },
  rio_montes: (tier) => ({ visibility: 'private', username: 'rio_montes', cover: { preset: 'grape' }, avatarOptions: { top: ['shortCurly'], clothing: ['hoodie'] },
    isSelf: false, isFollowing: false, requiresGuardianApproval: false, connection: tier === 'guardian' ? 'managed' : 'teenRequest', requestPending: false }),
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
  // W2P.2: the people lists and other people's profiles, answered by the viewer's tier as Core would (E.1, E.5, E.8, E.9).
  const viewerTier = spec.profile?.social?.tier ?? 'adult';
  if ((path === '/profile/followers' || path === '/profile/following') && request.method === 'GET') {
    if (viewerTier === 'closed') return ok({ users: [] });
    return ok({ users: path.endsWith('followers') ? PEOPLE : PEOPLE.slice(0, 2) });
  }
  const profileMatch = /^\/profiles\/([a-z0-9_]+)(?:\/(followers|following))?$/.exec(path);
  if (profileMatch && request.method === 'GET') {
    const [, handle, list] = profileMatch;
    const self = handle === spec.profile?.username;
    // A guest has no social layer, and a vanished handle is one NOT_FOUND, never saying why.
    if (viewerTier === 'closed' || !(self || handle in SUBJECTS)) return refuse(404, 'NOT_FOUND');
    if (list) return handle === 'rio_montes' ? refuse(404, 'NOT_FOUND') : ok({ users: list === 'followers' ? PEOPLE : PEOPLE.slice(1) });
    if (self) return ok({ visibility: 'full', ...publicShape(spec.profile), isFollowing: false, requiresGuardianApproval: false, connection: 'none', isSelf: true, isTutor: false });
    return ok(SUBJECTS[handle](viewerTier, spec));
  }
  if (path === '/profile' && request.method === 'PATCH') return ok({ updated: true });
  if ((path === '/profile/avatar' || path === '/profile/cover') && request.method === 'PUT') return ok({ updated: true });
  return undefined;
}
