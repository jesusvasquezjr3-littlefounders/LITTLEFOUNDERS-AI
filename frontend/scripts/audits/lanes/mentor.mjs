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
  /* W2M.3 (T1a-T1g): the learner's own island, the learning map, the notebook, past talks replayed on the stage, a roleplay
     scene, the first visit's chooser; and the verified Tutor's microphone permission (C.2). */
  screen('personalise-dina-6-9', { age: '6-9', character: 'dina', state: 'openings', sheet: 'personalise' }, { readyAll: ['[data-view="personalise"]'] }),
  screen('map-zara-10-12', { age: '10-12', character: 'zara', state: 'openings', sheet: 'map' }, { readyAll: ['[data-view="map"] .lf-list'] }),
  screen('map-conversing-rho-13-17', { age: '13-17', character: 'rho', state: 'conversing', sheet: 'map' }, { readyAll: ['[data-view="map"] .lf-list'] }),
  screen('notebook-liruf-6-9', { age: '6-9', character: 'liruf', state: 'openings', sheet: 'notebook' }, { readyAll: ['[data-view="notebook"] [data-board-kind]'] }),
  screen('notebook-empty-adult', { age: 'adult', character: 'zara', state: 'openings', sheet: 'notebook', data: 'empty' }, { readyAll: ['[data-view="notebook"] p'] }),
  screen('history-dina-6-9', { age: '6-9', character: 'dina', state: 'openings', sheet: 'history' }, { readyAll: ['[data-view="history"] .lf-list'] }),
  screen('history-failed-10-12', { age: '10-12', character: 'liruf', state: 'openings', sheet: 'history', data: 'failed' }, { readyAll: ['[data-view="history"] .lf-button'] }),
  screen('replay-dina-6-9', { age: '6-9', character: 'dina', state: 'replay' }, { readyAll: ['[data-replay="on"] .lf-mentor-replay'] }),
  screen('replay-rho-13-17', { age: '13-17', character: 'rho', state: 'replay' }, { readyAll: ['[data-replay="on"] .lf-mentor-replay'] }),
  screen('roleplay-dina-zara-6-9', { age: '6-9', character: 'dina', companion: 'zara', state: 'roleplay' }, { readyAll: ['[data-roleplay] .lf-mentor-plate-speaker'] }),
  screen('roleplay-rho-adult', { age: 'adult', character: 'rho', state: 'roleplay' }, { readyAll: ['[data-roleplay] .lf-mentor-plate-speaker'] }),
  screen('first-visit-chooser-rho-6-9', { age: '6-9', character: 'rho', state: 'first-visit' }, { readyAll: ['[role="dialog"] .lf-list'] }),
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
  // Not Lane 2's allocation Mentor (zara, lanes/learn.mjs 'lesson-allocation'): the same learner, lesson and
  // character render the same markup, so this state measures the compact stage with the other articulated Mentor.
  'mentor-compact-adult': { population: 'adult', guest: false, ageBand: 'adult', lesson: 'allocation', graded: true,
    mentorStage: { character: 'rho', scene: 'diorama-b' } },
};

/* The register policy version the UI accepts, read from the generated policy so this answer cannot go stale. */
const POLICY_VERSION = /LEARNER_REGISTER_POLICY_VERSION = '([^']+)'/.exec(
  readFileSync(new URL('../../../src/rebuild/design/learnerRegisterPolicy.generated.ts', import.meta.url), 'utf8'))?.[1];
const REGISTER_FOR_BAND = { '6-9': 'young', '10-12': 'transition', '13-17': 'teen', adult: 'adult' };

/* W2M.3 fixtures: what Core answers for the learner's map, notebook and one past talk (no Core, no Oracle: OD-23). */
const node = (kcKey, title, state, skillKey = `money/${kcKey}`) => ({ kcId: kcKey, kcKey, strand: 'money_math', title, state, mastery: null, attempts: 0, skillKey });
const MAP = {
  nodes: [node('count', 'Count coins', 'mastered'), node('add', 'Add prices', 'needs_review'), node('change', 'Give change by counting up', 'in_progress'),
    node('save', 'Save for a goal', 'available'), node('budget', 'Plan a budget', 'locked')],
  edges: [{ from: 'count', to: 'add' }, { from: 'add', to: 'change' }, { from: 'count', to: 'save' }, { from: 'change', to: 'budget' }, { from: 'save', to: 'budget' }],
  continueTarget: { kcKey: 'add', title: 'Add prices', reason: 'review_due', skillKey: 'money/add' },
  review: { count: 1 },
};
const GOAL_BOARD = { kind: 'goal_bar', goal: { label: 'Bike', value: 120 }, saved: { label: 'Saved', value: 45 }, remaining: 75, savedFraction: 0.375, label: 'My goal', currency: 'USD' };
const pastSession = (spec) => ({ id: 'past-1', locale: 'en-US', character: spec.mentor, companion: null, diorama: 'diorama-a', intent: 'course_topic',
  startedAt: '2026-09-24T16:00:00Z', endedAt: '2026-09-24T16:12:00Z', closeReason: 'completed', turnCount: 3, segmentCount: 0, xpAwarded: 0 });
const pastTranscript = (spec) => {
  const turn = (seq, speaker, text, minute, extra = {}) => ({ id: `t${seq}`, seq, speaker, text, emotion: speaker === 'tutor' ? 'happy' : null,
    action: speaker === 'tutor' ? 'idle' : null, audio_path: null, source: 'live', created_at: `2026-09-24T16:0${minute}:00Z`, whiteboard: null,
    demonstrate: null, roleplay_scene: null, point_at: null, ...extra });
  return { session: pastSession(spec), segments: [], turns: [
    turn(1, 'tutor', 'Shall we plan how to save for the bike?', 0), turn(2, 'learner', 'Yes!', 1),
    turn(3, 'tutor', 'Look at the board. You have saved 45 of 120.', 2, { emotion: 'encouraging', action: 'point', whiteboard: GOAL_BOARD }),
  ] };
};

export function respond({ scenario, spec, fixtures, path, request, ok }) {
  if (spec.mentorRoute) {
    // Starting a session hands back an Oracle socket on a host the verify harness (scripts/verify-mentor-screen.mjs) fakes; nothing leaves the machine.
    if (path === '/tutor/sessions' && request.method === 'POST') return ok({
      sessionId: `audit-${scenario}`, socketUrl: 'ws://mentor.test/socket', socketExpiresAt: '2099-01-01T00:00:00Z', character: spec.mentor,
      // Core starts a session with the learner's saved island: a friend saved earlier on this page stands in it.
      companion: fixtures?.mentorPreferences?.companion ?? null, diorama: 'diorama-a', backdrop: 'day', locale: 'en-US', voiceAvailable: !spec.microphoneBlockedBy,
      microphoneAvailable: false, microphoneBlockedBy: spec.microphoneBlockedBy ?? null,
    });
    if (/^\/tutor\/sessions\/[^/]+\/alliance-check$/.test(path) && request.method === 'POST') return ok({ recorded: true });
    // W2M.3 (T1a, T1e-T1g): the learner's island, the learning map, the notebook and past talks.
    if (path === '/tutor/preferences' && request.method === 'PUT') {
      const patch = JSON.parse(request.postData ?? '{}');
      if (fixtures) fixtures.mentorPreferences = { ...fixtures.mentorPreferences, ...patch };
      return ok({ character: spec.mentor, companion: null, diorama: 'diorama-a', backdrop: 'day', nickname: null, adaptations: [], ...patch });
    }
    if (path === '/tutor/map') return ok(MAP);
    if (path === '/tutor/plan') return ok({ plan: { content: GOAL_BOARD, sessionId: 'past-1', updatedAt: '2026-09-20T15:00:00Z' } });
    if (path === '/tutor/notebook' && request.method === 'GET') return ok({ entries: [{ id: 'k1', whiteboard: GOAL_BOARD, sessionId: 'past-1', turnSeq: 3, keptAt: '2026-09-22T16:30:00Z' }] });
    if (path === '/tutor/notebook' && request.method === 'POST') return ok({ kept: true });
    if (path === '/tutor/sessions' && request.method === 'GET') return ok({ sessions: [pastSession(spec)] });
    if (path === '/tutor/sessions/past-1' && request.method === 'GET') return ok(pastTranscript(spec));
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
