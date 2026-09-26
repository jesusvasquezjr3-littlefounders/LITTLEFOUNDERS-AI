import { app, preview } from './helpers.mjs';

/*
 * Lane 2 (learn): the lesson player and teaching boards on the preview entry,
 * at the ages each one serves (as the S05 matrices run them), and the real
 * lesson route in every state it can show (S03.5/S03.6), signed in and
 * answered by the synthetic Core.
 */
export const lane = 'learn';

const lessonSurfaces = [
  ['lesson', ['6-9', 'adult']], ['waffle', ['6-9']], ['donut', ['10-12']], ['ratiotable', ['10-12']], ['timeline', ['6-9', 'adult']],
  ['sequence', ['6-9']], ['numberline', ['6-9', '10-12']], ['goal', ['6-9', 'adult']], ['percent', ['10-12']], ['placevalue', ['6-9']],
  ['rulebuilder', ['10-12']], ['ledger', ['13-17']], ['growthcompare', ['13-17']], ['taxbracket', ['13-17']], ['fractionline', ['10-12']],
  ['fractionarea', ['6-9']], ['barmodel', ['10-12']], ['schemadiagram', ['10-12']], ['workedexample', ['10-12']], ['functionmachine', ['10-12']],
  ['cpafading', ['6-9', '10-12']], ['result', ['6-9']], ['replay', ['6-9']], ['upgrade', ['6-9']], ['invalid', ['6-9']], ['opening', ['6-9']],
  ['offline', ['6-9']], ['loaderror', ['6-9']],
];

export const states = [
  ...lessonSurfaces.flatMap(([screen, ages]) => ages.map((age) => preview(`${screen}@${age}`, { screen, age }))),
  // The lesson route mounts the rebuilt lesson inside the design-system root (S03.6): every screen it can show.
  app('/learn/lesson@goal-6-9', '/learn/lesson/audit-goal', 'lesson-goal', '[data-screen="goal"]'),
  app('/learn/lesson@allocation-adult', '/learn/lesson/audit-allocation', 'lesson-allocation', '[data-screen="lesson"]'),
  app('/learn/lesson@function-machine-10-12', '/learn/lesson/audit-machine', 'lesson-function-machine', '[data-screen="function-machine"]'),
  app('/learn/lesson@opening', '/learn/lesson/audit-opening', 'lesson-opening', '[data-screen="lesson-opening"]'),
  app('/learn/lesson@offline', '/learn/lesson/audit-offline', 'lesson-offline', '[data-screen="lesson-offline"]'),
  app('/learn/lesson@load-error', '/learn/lesson/audit-error', 'lesson-load-error', '[data-screen="lesson-load-error"]'),
  app('/learn/lesson@placement', '/learn/lesson/audit-placement', 'lesson-placement', '[data-screen="lesson-placement"]'),
  app('/learn/lesson@eligibility-required', '/learn/lesson/audit-required', 'lesson-eligibility-required', '[data-screen="lesson-eligibility-required"]'),
  app('/learn/lesson@eligibility-restricted', '/learn/lesson/audit-restricted', 'lesson-eligibility-restricted', '[data-screen="lesson-eligibility-restricted"]'),
  app('/learn/lesson@eligibility-unavailable', '/learn/lesson/audit-unavailable', 'lesson-eligibility-unavailable', '[data-screen="lesson-eligibility-unavailable"]'),
];

export const scenarios = {
  'lesson-goal': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', lesson: 'goal' },
  'lesson-allocation': { population: 'adult', guest: false, ageBand: 'adult', lesson: 'allocation', graded: true, mentorStage: { character: 'zara', scene: 'diorama-a' } },
  'lesson-function-machine': { population: 'parent-created child 10-12', guest: false, ageBand: '10-12', lesson: 'functionMachine', graded: true },
  'lesson-opening': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', hold: true },
  'lesson-offline': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', fail: 'InternetDisconnected' },
  'lesson-load-error': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', error: [500, 'INTERNAL'] },
  'lesson-placement': { population: 'parent-created child 10-12', guest: false, ageBand: '10-12', error: [403, 'PLACEMENT_REQUIRED'] },
  'lesson-eligibility-required': { population: 'adult', guest: false, ageBand: 'adult', error: [403, 'LESSON_AGE_ELIGIBILITY_REQUIRED'] },
  'lesson-eligibility-restricted': { population: 'parent-created child 6-9', guest: false, ageBand: '6-9', error: [403, 'LESSON_AGE_RESTRICTED'] },
  'lesson-eligibility-unavailable': { population: 'independent teen 13-17', guest: false, ageBand: '13-17', error: [409, 'LESSON_ELIGIBILITY_MISSING'] },
};

const RUN_ID = '44444444-4444-4444-8444-444444444444';

/** The lesson document and its server-graded run, from the product's own pilot fixtures. */
export function respond({ spec, locale, fixtures, path, request, ok }) {
  const lesson = path.match(/^\/learn\/lessons\/([^/]+)(\/v2-runs)?$/);
  if (lesson && !lesson[2]) {
    if (spec.hold) return 'hold';
    if (spec.fail) return { fail: spec.fail };
    if (spec.error) return { status: spec.error[0], body: { data: null, error: { code: spec.error[1], message: 'Synthetic refusal' } } };
    if (!spec.lesson) return undefined;
    const document = fixtures[locale][spec.lesson];
    return ok({ lesson: { id: lesson[1], slug: lesson[1] }, locale, document, audio: {}, ...(spec.mentorStage ? { mentor_stage: spec.mentorStage } : {}) });
  }
  if (lesson && lesson[2] && request.method === 'POST' && spec.graded) {
    const document = fixtures[locale][spec.lesson];
    const tokens = Object.fromEntries(document.segments.filter((segment) => segment.grading === 'server').map((segment) => [segment.id, `synthetic-${segment.id}`]));
    return ok({ run_id: RUN_ID, version_id: document.version_id, expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      resumed: false, met_segment_ids: [], attempted_segment_ids: [], attempt_tokens: tokens });
  }
  return undefined;
}
