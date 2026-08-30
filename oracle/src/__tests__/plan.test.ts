import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  noteConversationTurn,
  OFFER_ADAPTATION_THRESHOLD,
  planState,
  recordGrade,
  STUCK_THRESHOLD,
  stuckInstruction,
} from '../tutor/plan.js';
import { PlanStateSchema } from '../context/schema.js';

/*
 * The lesson plan is the difference between a lesson and a playlist
 * (/ORACLE.md §9.3), and everything about it is deterministic — which is what
 * makes it testable without a model, and what makes "the tutor noticed the
 * learner was stuck" arithmetic rather than hope.
 */

const COURSE = { courseTitle: 'Dinero inteligente', topicTitle: 'Ahorro' };

describe('building a plan', () => {
  it('derives the objective from OUR titles, never inventing one', () => {
    expect(buildPlan('course_topic', COURSE, null).objective).toContain('Ahorro');
    expect(buildPlan('weak_skill', null, 'money.saving').objective).toContain('money.saving');
    expect(buildPlan('open', null, null).objective).toContain('whatever the learner brings');
  });

  /*
   * Found by adversarial review, round 40 (2026-08-30, HIGH): `faq`'s
   * skillKey is a published FAQ id (e.g. "why_prices_change"), not a title —
   * before this map existed it fell straight through to `subject` and the
   * model was handed the raw slug as the whole lesson objective, never told
   * it names a QUESTION, in a session whose spoken locale it does not even
   * match.
   */
  it('turns a published FAQ id into a readable topic, never the raw slug', () => {
    const objective = buildPlan('faq', null, 'why_prices_change').objective;
    expect(objective).toContain('why prices change');
    expect(objective).not.toContain('why_prices_change');
  });

  it('degrades to no subject for an FAQ id outside the closed set, rather than showing the raw slug', () => {
    const objective = buildPlan('faq', null, 'not_a_real_faq_id').objective;
    expect(objective).not.toContain('not_a_real_faq_id');
    expect(objective).toContain('whatever the learner brings');
  });

  it('always projects into the sealed schema — the plan cannot outgrow its gate', () => {
    for (const intent of ['course_topic', 'weak_skill', 'faq', 'open', 'diagnostic'] as const) {
      const plan = buildPlan(intent, COURSE, 'money.saving');
      expect(PlanStateSchema.safeParse(planState(plan)).success).toBe(true);
    }
  });
});

describe('grades move the plan', () => {
  it('advances on a correct answer and clears the failure streak', () => {
    const plan = buildPlan('course_topic', COURSE, null);
    recordGrade(plan, 'money.saving', false);
    recordGrade(plan, 'money.saving', true);
    expect(plan.stepIndex).toBe(1);
    expect(plan.failures.get('money.saving')).toBeUndefined();
    expect(plan.stuckSkillKey).toBeNull();
  });

  it('stays on the step and marks the skill stuck after repeated misses', () => {
    const plan = buildPlan('course_topic', COURSE, null);
    for (let i = 0; i < STUCK_THRESHOLD; i += 1) recordGrade(plan, 'money.saving', false);
    expect(plan.stepIndex).toBe(0);
    expect(plan.stuckSkillKey).toBe('money.saving');
  });

  it('recovering from stuck clears the styles tried, so the next struggle starts fresh', () => {
    const plan = buildPlan('course_topic', COURSE, null);
    recordGrade(plan, 'money.saving', false);
    recordGrade(plan, 'money.saving', false);
    stuckInstruction(plan, 'money.saving');
    expect(plan.stylesTried.length).toBeGreaterThan(0);
    recordGrade(plan, 'money.saving', true);
    expect(plan.stylesTried).toHaveLength(0);
  });
});

describe('the stuck instruction', () => {
  it('says nothing before the threshold — one miss is not a pattern', () => {
    const plan = buildPlan('course_topic', COURSE, null);
    recordGrade(plan, 'money.saving', false);
    expect(stuckInstruction(plan, 'money.saving')).toBeNull();
  });

  it('rotates through explanation styles instead of repeating one louder', () => {
    const plan = buildPlan('course_topic', COURSE, null);
    recordGrade(plan, 'money.saving', false);
    recordGrade(plan, 'money.saving', false);
    const first = stuckInstruction(plan, 'money.saving');
    expect(first).toContain('change the approach');
    // The style it just used is recorded, so the next one differs.
    expect(plan.stylesTried).toHaveLength(1);
  });

  it('moves from re-explaining to OFFERING an adaptation, never imposing one', () => {
    const plan = buildPlan('course_topic', COURSE, null);
    for (let i = 0; i < OFFER_ADAPTATION_THRESHOLD; i += 1) recordGrade(plan, 'money.saving', false);
    const instruction = stuckInstruction(plan, 'money.saving');
    // Offered via the turn schema's offerAdaptation — the learner still says
    // yes or no (/ORACLE.md §11). The instruction must never say "apply".
    expect(instruction).toContain('offerAdaptation');
    expect(instruction).not.toContain('apply the adaptation');
  });
});

describe('talk-only steps still move', () => {
  it('advances after two conversational exchanges, so no lesson stalls in explain', () => {
    const plan = buildPlan('open', null, null); // explain, practice, check
    noteConversationTurn(plan);
    expect(plan.stepIndex).toBe(0);
    noteConversationTurn(plan);
    expect(plan.stepIndex).toBe(1);
  });

  it('gives practice a longer leash, then moves anyway — a model that never requests a segment cannot pin the plan', () => {
    const plan = buildPlan('open', null, null);
    noteConversationTurn(plan);
    noteConversationTurn(plan); // now on practice
    noteConversationTurn(plan);
    noteConversationTurn(plan);
    expect(plan.stepIndex).toBe(1);
    noteConversationTurn(plan);
    expect(plan.stepIndex).toBe(2);
  });

  it('never advances past the final step', () => {
    const plan = buildPlan('faq', null, null);
    for (let i = 0; i < 20; i += 1) noteConversationTurn(plan);
    expect(plan.stepIndex).toBe(plan.steps.length - 1);
  });
});
