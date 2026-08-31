import { describe, expect, it } from 'vitest';
import { buildContextMessage, languageViolation, TUTOR_SYSTEM_PROMPT } from '../tutor/prompt.js';
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
 * Found live, testing as a real logged-in kid account with an en-US
 * profile, 2026-08-30 (HIGH): the context message states the session's
 * language exactly once ("Language: en-US. Answer entirely in this
 * language"); nothing ever checked it. One Spanish learner utterance ("que
 * es un precio?") was enough to make the tutor's VERY NEXT turn — replying
 * to a bare "8" with no language cue of its own — switch entirely to
 * Spanish and stay there until explicitly told "please explain in
 * English". The Spanish-only `tutor:converse` harness could never have
 * caught this: every one of its fixtures locks `locale: 'es-MX'`.
 */
describe('languageViolation catches a turn that drifted away from the session\'s own locale', () => {
  it('catches the exact real turn that surfaced this — Spanish delivered to an en-US session', () => {
    const real =
      'Casi, Explorer. Piensa: el lápiz cuesta 5, tú tienes 3. Si juntas 3 y 2, ¿cuánto da? ' +
      '3 más 2 es 5. Entonces te faltan 2 pesos, no 8. Ahora tú: una goma cuesta 7 pesos y tienes 4. ¿Cuánto te falta?';
    expect(languageViolation(real, 'en-US')).not.toBeNull();
  });

  it('catches English delivered to an es-MX session', () => {
    expect(languageViolation('Of course, that is right! How many do you have left?', 'es-MX')).not.toBeNull();
  });

  it('catches Portuguese delivered to an en-US session', () => {
    expect(languageViolation('Então, você está certo! Não é assim?', 'en-US')).not.toBeNull();
  });

  it('never flags genuine en-US teaching prose, even one using a peso/real loanword', () => {
    expect(
      languageViolation('Great job! If a pencil costs 5 pesos and you have 3, how many more do you need?', 'en-US'),
    ).toBeNull();
  });

  it('never flags genuine es-MX teaching prose', () => {
    expect(
      languageViolation('¡Muy bien! Si un lápiz cuesta 5 pesos y tienes 3, ¿cuántos más necesitas?', 'es-MX'),
    ).toBeNull();
  });

  it('never flags genuine pt-BR teaching prose', () => {
    expect(
      languageViolation('Muito bem! Se um lápis custa 5 reais e você tem 3, quantos faltam?', 'pt-BR'),
    ).toBeNull();
  });
});

/*
 * Found live, testing as a real logged-in kid account, 2026-08-30 (MEDIUM):
 * a turn that set `next: "segment"` also narrated a fully-specified example
 * in `say` — "if you have 10 coins and each sticker costs 5" — before the
 * activity existed. The content ladder then served a published bank lesson
 * (`backend/src/routes/tutor.ts`'s `/segments` handler never reads the
 * `framing`/`rationale` fields it accepts) with its own numbers: "8 coins,
 * toy car, 4 each". The learner read one problem and was shown a different
 * one with no acknowledgment of the switch — to a struggling child this
 * reads as the product being broken, not as a second example. Tier-3
 * (freshly generated) content coincidentally matched because
 * `content/generate.ts` feeds the tutor's own `framing` into the author
 * brief — but nothing does that for tier-1/2 bank content, and the model had
 * no instruction telling it the numbers it invents here go nowhere.
 */
describe('a turn that requests a segment keeps its own transition generic', () => {
  it('tells the model the upcoming activity does not exist yet and to stay generic', () => {
    expect(TUTOR_SYSTEM_PROMPT).toContain('the activity does not exist yet');
    expect(TUTOR_SYSTEM_PROMPT).toContain('keep your');
    expect(TUTOR_SYSTEM_PROMPT).toContain('transition GENERIC');
  });

  it('carves the segment case out of the "numbers are invented" instruction', () => {
    expect(TUTOR_SYSTEM_PROMPT).toContain('narrating AND immediately following through on in the SAME turn');
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
