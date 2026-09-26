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

export const states = [
  stage('dina-idle-6-9', { age: '6-9', character: 'dina', state: 'idle' }),
  stage('zara-thinking-10-12', { age: '10-12', character: 'zara', state: 'thinking' }),
  stage('rho-demonstrating-board-13-17', { age: '13-17', character: 'rho', state: 'demonstrating', board: '1' }),
  stage('liruf-celebrating-milestone-6-9', { age: '6-9', character: 'liruf', state: 'celebrating', milestone: 'lesson-complete' }),
  stage('zara-celebrating-refused-adult', { age: 'adult', character: 'zara', state: 'celebrating' }),
  stage('dina-closing-safety-6-9', { age: '6-9', character: 'dina', state: 'closing', closing: 'safety_stop' }),
  app('/learn/lesson@mentor-compact-adult', '/learn/lesson/audit-stage-adult', 'mentor-compact-adult', '.lf-mentor-band'),
];

export const scenarios = {
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

export function respond({ scenario, spec, path, ok }) {
  if (path === '/learn/register' && scenario.startsWith('mentor-compact-')) {
    return ok({ register: REGISTER_FOR_BAND[spec.ageBand], copy_band: spec.ageBand, policy_version: POLICY_VERSION, graduation: null });
  }
  return undefined;
}
