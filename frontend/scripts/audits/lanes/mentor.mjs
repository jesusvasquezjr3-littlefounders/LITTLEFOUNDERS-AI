import { readFileSync } from 'node:fs';
import { app, preview } from './helpers.mjs';

/*
 * Lane 3 (mentor): the Mentor stage (Bible 08) and its session surfaces.
 *
 *   states     the full-size stage on the preview entry, in the states that
 *              change what the learner sees (a refused celebration included),
 *              and the compact stage on the real lesson route, signed in and
 *              answered by the synthetic Core;
 *   scenarios  one learner per age band, each with a lesson that carries a
 *              Mentor stage projection (the lesson document and its graded run
 *              are answered by lanes/learn.mjs from `lesson` and `mentorStage`);
 *   respond    Core's register for these learners (GET /learn/register, B.23),
 *              so the lesson reads in the learner's own register. The Mentor
 *              route's session endpoints arrive with the rebuilt Mentor screen.
 *
 * The audit answers the lesson with the pilot fixtures of synthetic-core.mjs
 * (the allocation document is the adult one), so it audits the compact stage
 * for the adult learner only; scripts/verify-mentor-stage.mjs builds each band's
 * own allocation document for the four populations.
 */
export const lane = 'mentor';

const stage = (id, query, extra = {}) => preview(`mentor-stage@${id}`, { screen: 'mentor-stage', ...query }, extra);
const screen = (id, query, extra = {}) => preview(`mentor-screen@${id}`, { screen: 'mentor-screen', ...query }, extra);

export const states = [
  stage('dina-idle-6-9', { age: '6-9', character: 'dina', state: 'idle' }),
  stage('zara-thinking-10-12', { age: '10-12', character: 'zara', state: 'thinking' }),
  stage('rho-demonstrating-board-13-17', { age: '13-17', character: 'rho', state: 'demonstrating', board: '1' }),
  stage('liruf-celebrating-milestone-6-9', { age: '6-9', character: 'liruf', state: 'celebrating', milestone: 'lesson-complete' }),
  stage('zara-celebrating-refused-adult', { age: 'adult', character: 'zara', state: 'celebrating' }),
  stage('dina-closing-safety-6-9', { age: '6-9', character: 'dina', state: 'closing', closing: 'safety_stop' }),
  app('/learn/lesson@mentor-compact-adult', '/learn/lesson/audit-stage-adult', 'mentor-compact-adult', '.lf-mentor-band'),
  /* W2M.2: the Mentor screen (08 §2-§8) on the preview entry, in the states that change what the learner sees. */
  screen('openings-dina-6-9', { age: '6-9', character: 'dina', state: 'openings' }),
  screen('conversing-rho-10-12', { age: '10-12', character: 'rho', state: 'conversing' }),
  screen('board-zara-13-17', { age: '13-17', character: 'zara', state: 'board', board: 'goal_bar' }),
  screen('board-your-turn-6-9', { age: '6-9', character: 'liruf', state: 'board', board: 'your_turn' }),
  screen('adaptation-liruf-adult', { age: 'adult', character: 'liruf', state: 'adaptation' }),
  screen('check-in-dina-6-9', { age: '6-9', character: 'dina', state: 'check-in' }),
  screen('activity-rho-10-12', { age: '10-12', character: 'rho', state: 'activity' }),
  screen('limit-dina-6-9', { age: '6-9', character: 'dina', state: 'limit' }),
  screen('unavailable-6-9', { age: '6-9', state: 'unavailable' }),
  screen('calibration-zara-6-9', { age: '6-9', character: 'zara', state: 'calibration' }),
  screen('closing-dina-6-9', { age: '6-9', character: 'dina', state: 'closing' }),
  screen('closing-safety-rho-13-17', { age: '13-17', character: 'rho', state: 'closing-safety' }),
  /* The real route, signed in: a child in a family, an independent teen and an adult, answered by the synthetic Core. */
  app('/tutor@mentor-screen-child', '/tutor', 'mentor-screen-child', '.lf-mentor-screen[data-phase="openings"]'),
  app('/tutor@mentor-screen-teen', '/tutor', 'mentor-screen-teen', '.lf-mentor-screen[data-phase="openings"]'),
  app('/tutor@mentor-screen-adult', '/tutor', 'mentor-screen-adult', '.lf-mentor-screen[data-phase="openings"]'),
];

export const scenarios = {
  // W2M.2: the Mentor route itself. `mentor` is the saved choice lanes/core.mjs answers from GET /tutor/preferences.
  'mentor-screen-child': { population: 'parent-created child 6-9 (guardian link)', guest: false, ageBand: '6-9', roles: ['kid'], mentor: 'dina', mentorRoute: true },
  'mentor-screen-teen': { population: 'independent teen 13-17 (no guardian link)', guest: false, ageBand: '13-17', roles: ['universal'],
    wallet: { holder: 'teen', familyChild: false }, mentor: 'zara', mentorRoute: true, microphoneBlockedBy: 'POLICY_BLOCKED' },
  'mentor-screen-adult': { population: 'adult', guest: false, ageBand: 'adult', roles: ['universal'], mentor: 'rho', mentorRoute: true },
  'mentor-compact-6-9': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', lesson: 'allocation', graded: true,
    mentorStage: { character: 'dina', scene: 'diorama-a' } },
  'mentor-compact-10-12': { population: 'parent-created child 10-12', guest: false, ageBand: '10-12', lesson: 'allocation', graded: true,
    mentorStage: { character: 'liruf', scene: 'diorama-b' } },
  'mentor-compact-13-17': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', lesson: 'allocation', graded: true,
    mentorStage: { character: 'rho', scene: 'diorama-a' } },
  'mentor-compact-adult': { population: 'adult', guest: false, ageBand: 'adult', lesson: 'allocation', graded: true,
    mentorStage: { character: 'zara', scene: 'diorama-b' } },
};

/* The register policy version the UI accepts, read from the generated policy so this answer cannot go stale. */
const POLICY_VERSION = /LEARNER_REGISTER_POLICY_VERSION = '([^']+)'/.exec(
  readFileSync(new URL('../../../src/rebuild/design/learnerRegisterPolicy.generated.ts', import.meta.url), 'utf8'))?.[1];
const REGISTER_FOR_BAND = { '6-9': 'young', '10-12': 'transition', '13-17': 'teen', adult: 'adult' };

export function respond({ scenario, spec, path, request, ok }) {
  if (spec.mentorRoute) {
    // Starting a session hands back an Oracle socket on a host the verify harness (scripts/verify-mentor-screen.mjs) fakes; nothing leaves the machine.
    if (path === '/tutor/sessions' && request.method === 'POST') return ok({
      sessionId: `audit-${scenario}`, socketUrl: 'ws://mentor.test/socket', socketExpiresAt: '2099-01-01T00:00:00Z', character: spec.mentor,
      companion: null, diorama: 'diorama-a', backdrop: 'day', locale: 'en-US', voiceAvailable: !spec.microphoneBlockedBy,
      microphoneAvailable: false, microphoneBlockedBy: spec.microphoneBlockedBy ?? null,
    });
    if (/^\/tutor\/sessions\/[^/]+\/alliance-check$/.test(path) && request.method === 'POST') return ok({ recorded: true });
    if (path === '/learn/register') return ok({ register: REGISTER_FOR_BAND[spec.ageBand], copy_band: spec.ageBand, policy_version: POLICY_VERSION, graduation: null });
    if (path === '/tutor/age-calibration') return ok({ required: false, tier: spec.ageBand === '6-9' ? 2 : 3 });
    if (path === '/tutor/offers') return ok({
      locale: 'en-US', lastSession: null, intelDegraded: false, canStart: true, startBlockedBy: null, sessionCapResetAt: null,
      voiceAvailable: !spec.microphoneBlockedBy, microphoneBlockedBy: spec.microphoneBlockedBy ?? null,
      weakSkills: [{ skillKey: 'money/change', title: null, courseId: null, topicId: null, recommendedAction: 'practice', reasonCode: 'audit' }],
      faqIds: ['what_is_saving'], canAskOpen: true,
    });
  }
  if (path === '/learn/register' && scenario.startsWith('mentor-compact-')) {
    return ok({ register: REGISTER_FOR_BAND[spec.ageBand], copy_band: spec.ageBand, policy_version: POLICY_VERSION, graduation: null });
  }
  return undefined;
}
