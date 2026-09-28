import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildContextMessage,
  MENTOR_TURN_BUDGET,
  mentorTurnBudget,
  mentorTurnBudgetCorrection,
  mentorTurnWordLimit,
  selfNamingViolation,
  TUTOR_SYSTEM_PROMPT,
} from '../tutor/prompt.js';
import { DialogueCalibrationRecorder, DialogueCalibrationSnapshotSchema, dialoguePolicy, resolveCalibration } from '../tutor/dialogueCalibration.js';
import type { TutorContext } from '../context/schema.js';

/*
 * OD-6 and the owner log §5 glossary: the AI character is the Mentor; "Tutor"
 * is the learner's verified parent. OD-13 and Frontend Bible 06 / 08 §2 layer
 * 3: a Mentor turn is at most 2 sentences and 20 words (12 for ages 6-9), one
 * question. Both are Tier 1 prompt rules AND runtime checks.
 */

describe('OD-6: the Mentor names itself as the Mentor', () => {
  it('the persona is the Mentor, never "a tutor character"', () => {
    expect(TUTOR_SYSTEM_PROMPT.startsWith("You are the learner's Mentor, one of the LittleFounders characters.")).toBe(true);
    expect(TUTOR_SYSTEM_PROMPT).not.toMatch(/tutor character/i);
    expect(TUTOR_SYSTEM_PROMPT).toContain('never call yourself a');
    expect(TUTOR_SYSTEM_PROMPT).toContain('"Tutor" means the learner\'s parent');
  });

  it('falls back to "a friendly Mentor character" for an unknown persona', () => {
    const context = {
      nickname: 'Robi', tier: 2, locale: 'en-US', character: 'nobody', intent: 'diagnostic', adaptations: [], courseContext: null,
      skillStates: [], turnHistory: [], planState: null, previousSessions: [], pedagogy: null, openActivity: null, learnerBrief: null,
    } as unknown as TutorContext;
    const message = buildContextMessage(context);
    expect(message).toContain('You are a friendly Mentor character.');
    expect(message).not.toMatch(/tutor character/i);
  });

  it.each([
    ["I'm your tutor, let's count coins.", 'en'],
    ['I am the AI tutor here.', 'en'],
    ['Soy tu tutor y vamos a contar.', 'es'],
    ['Como tu tutora, te ayudo.', 'es'],
    ['Sou seu tutor hoje.', 'pt'],
    ["I'm just a bot, but I can help.", 'en'],
    ['Soy un asistente virtual.', 'es'],
    ['Sou um assistente de estudos.', 'pt'],
    ["I'm your assistant for money.", 'en'],
  ])('catches self-naming: %s', (say) => {
    expect(selfNamingViolation(say)).not.toBeNull();
  });

  it.each([
    'Ask your tutor to approve the task.',
    'Pídele a tu tutor que apruebe la tarea.',
    'Peça ao seu tutor para aprovar.',
    'The shop assistant gives you 3 coins back.',
    'Soy Dina, tu Mentora.',
    "I'm Dr. Rho, your Mentor.",
  ])('leaves talk about the parent or a story alone: %s', (say) => {
    expect(selfNamingViolation(say)).toBeNull();
  });
});

describe('OD-13: the Mentor turn Copy Budget', () => {
  it('asks for the budget in the prompt, not "1-3 short sentences"', () => {
    expect(TUTOR_SYSTEM_PROMPT).toContain('1-2 short sentences, at most 20 words (12 for ages 6-9), and at most one question');
    expect(TUTOR_SYSTEM_PROMPT).not.toContain('1-3 short sentences');
  });

  it('uses 12 words for ages 6-9 (tiers 1-2), 20 above, x1.25 for es-MX and pt-BR', () => {
    expect(mentorTurnWordLimit(1, 'en-US')).toBe(12);
    expect(mentorTurnWordLimit(2, 'en-US')).toBe(12);
    expect(mentorTurnWordLimit(3, 'en-US')).toBe(20);
    expect(mentorTurnWordLimit(1, 'es-MX')).toBe(15);
    expect(mentorTurnWordLimit(3, 'pt-BR')).toBe(25);
  });

  it('passes a turn within budget and names the limit a turn breaks', () => {
    expect(mentorTurnBudget('You have 5 coins. How many are left if you spend 2?', 3, 'en-US').over).toBeNull();
    const long = mentorTurnBudget('One two three four five six seven eight nine ten eleven twelve thirteen.', 1, 'en-US');
    expect(long.over).toBe('words');
    expect(long.wordLimit).toBe(12);
    expect(mentorTurnBudget('Good. You saved 3. Now you have 8.', 3, 'en-US').over).toBe('sentences');
    expect(mentorTurnBudget('How many? And why?', 3, 'en-US').over).toBe('questions');
    // "Dr." and a decimal are not sentence boundaries (same rule as checkCopy).
    expect(mentorTurnBudget('Dr. Rho has 2.50 pesos. What can he buy?', 3, 'en-US').over).toBeNull();
    expect(mentorTurnBudgetCorrection(long)).toContain('within 12 words');
  });

  /*
   * PARITY with the frontend Copy Budget (frontend/src/rebuild/design/copyBudget.ts):
   * the services share no library, so the numbers are read from that file.
   */
  it('matches the frontend copyBudget constants for the mentor role', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(path.resolve(here, '../../../frontend/src/rebuild/design/copyBudget.ts'), 'utf8');
    const app = /const app = \{([^}]*)\}/.exec(source)?.[1] ?? '';
    const sentences = /const sentences = \{([^}]*)\}/.exec(source)?.[1] ?? '';
    expect(Number(/mentor:\s*(\d+)/.exec(app)?.[1])).toBe(MENTOR_TURN_BUDGET.words);
    expect(Number(/mentor:\s*(\d+)/.exec(sentences)?.[1])).toBe(MENTOR_TURN_BUDGET.sentences);
    expect(source).toMatch(new RegExp(`role === 'mentor' \\|\\| role === 'prompt'\\) limit = ${MENTOR_TURN_BUDGET.youngWords}`));
    expect(source).toContain(`context.locale === 'en-US' ? 1 : ${MENTOR_TURN_BUDGET.translatedFactor}`);
    // Word counting is the same expression on both sides.
    expect(source).toContain("/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu");
  });
});

describe('the close record counts what the checks did (M-13 pattern, C.24 tell_honored)', () => {
  it('counts caught and delivered budget, self-naming and tell answers, capped and restorable', () => {
    const calibration = resolveCalibration(null, 2, 'act');
    const recorder = new DialogueCalibrationRecorder(calibration, dialoguePolicy(calibration.band, calibration.variant));
    recorder.noteTellRequest();
    recorder.noteTellDelivered();
    recorder.noteTellRequest();
    recorder.noteTellWithdrawn();
    recorder.noteBudgetCaught();
    recorder.noteBudgetDelivered();
    recorder.noteSelfNamingCaught();
    const report = recorder.report();
    expect(report).toMatchObject({ tellRequests: 2, tellDelivered: 1, tellWithdrawn: 1, budgetCaught: 1, budgetDelivered: 1, selfNamingCaught: 1, selfNamingDelivered: 0 });
    // A snapshot written before these counts still restores (defaults to 0).
    const old = DialogueCalibrationSnapshotSchema.parse({
      hintRequests: 1, tellRequests: 0, controllingCaught: 0, controllingDelivered: 0, pacingOffers: 0, unilateralStyleChanges: 0,
    });
    expect(old.budgetCaught).toBe(0);
    recorder.restore(old);
    expect(recorder.report().tellDelivered).toBe(0);
  });
});
