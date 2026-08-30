import { describe, expect, it } from 'vitest';
import { buildContextMessage, TUTOR_SYSTEM_PROMPT } from '../tutor/prompt.js';
import { buildPlan, planState } from '../tutor/plan.js';
import type { TutorContext } from '../context/schema.js';

/*
 * Found live, testing across many independent scenarios this session,
 * 2026-08-30 (MEDIUM): the whiteboard instruction's own worked example (10
 * pesos, 2 more each week, 3 weeks) appeared verbatim in multiple unrelated
 * conversations — the model was reusing the FORMAT example as if it were
 * real content, since nothing told it not to. This is the static, prefix-
 * cached system prompt (never varies per call), so the fix is an explicit
 * instruction beside the example, not per-call randomization.
 */
describe('the whiteboard example tells the model not to copy its own numbers', () => {
  it('explicitly forbids reusing the "10 pesos, 2 more each week" example verbatim', () => {
    expect(TUTOR_SYSTEM_PROMPT).toContain('invent your OWN different amount, rate and');
    expect(TUTOR_SYSTEM_PROMPT).toContain('is not a personalized example');
    // A first wording pass stopped the LITERAL SENTENCE from recurring but,
    // live, the model kept reaching for the same 10/+2 arithmetic anyway —
    // this stronger callout names the exact numbers to avoid.
    expect(TUTOR_SYSTEM_PROMPT).toContain('NUMBERS 10 AND 2 ARE THE ONES IN THIS EXAMPLE');
  });
});

/*
 * `buildContextMessage` had no direct unit coverage before this file — every
 * prior check exercised it indirectly through a full orchestrator turn. The
 * fix this file proves (round 48, 2026-08-30) is specific to how ONE plan
 * step is rendered for ONE intent, which a full-turn test can assert but
 * cannot isolate as cleanly as calling the real function directly.
 */

const BASE_CONTEXT: TutorContext = {
  nickname: 'Robi',
  tier: 2,
  locale: 'es-MX',
  character: 'rho',
  intent: 'diagnostic',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  turnHistory: [],
  planState: null,
  previousSessions: [],
  pedagogy: null,
  openActivity: null,
  learnerBrief: null,
};

/*
 * Found by adversarial review, round 48 (2026-08-30, MEDIUM): `diagnostic`'s
 * own plan sequence (`tutor/plan.ts`'s `SEQUENCES.diagnostic`) is
 * `['warmup', 'check', 'check', 'explain']` — the only intent where `check`
 * comes before `explain`. `PLAN_STEP_GUIDANCE.check`, shared across every
 * intent, reads "Ask them to USE the idea or explain it back in their own
 * words" — worded for confirming retention of something already taught,
 * which at diagnostic's own step 2 has not happened yet (`explain` is step
 * 4, last). Rendered for a cold-start diagnostic session, the model received
 * three instructions pulling different directions in one prompt: "find out
 * where they stand", "use an idea" that was never taught, and "ask one
 * short diagnostic question".
 */
describe('a diagnostic session\'s "check" step probes, it does not confirm', () => {
  it('does not tell the model to use or explain back an idea nobody has taught yet', () => {
    const plan = buildPlan('diagnostic', null, null);
    expect(plan.steps).toEqual(['warmup', 'check', 'check', 'explain']);
    plan.stepIndex = 1; // the FIRST "check" step — before "explain" ever runs

    const message = buildContextMessage({ ...BASE_CONTEXT, planState: planState(plan) });

    expect(message).not.toContain('Ask them to USE the idea or explain it back in their own words');
    expect(message).toContain('You are on step 2 of 4:');
    expect(message).toContain('finding out what they already know');
  });

  it('leaves every OTHER intent\'s "check" step guidance exactly as it was', () => {
    const plan = buildPlan('course_topic', { courseTitle: 'Dinero', topicTitle: 'Ahorro' }, null);
    plan.stepIndex = plan.steps.indexOf('check');
    expect(plan.stepIndex).toBeGreaterThanOrEqual(0);

    const message = buildContextMessage({
      ...BASE_CONTEXT,
      intent: 'course_topic',
      courseContext: { courseId: null, courseTitle: 'Dinero', topicId: null, topicTitle: 'Ahorro' },
      planState: planState(plan),
    });

    expect(message).toContain('Ask them to USE the idea or explain it back in their own words');
  });
});
