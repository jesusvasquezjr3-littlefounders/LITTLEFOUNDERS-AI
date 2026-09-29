import { describe, expect, it } from 'vitest';
import {
  bandFromTier,
  CONTROLLING_GATE_BANDS,
  controllingGateFor,
  controllingLanguage,
  DialogueCalibrationRecorder,
  DialogueCalibrationSnapshotSchema,
  dialoguePolicy,
  DIALOGUE_BANDS,
  EMPTY_DIALOGUE_CALIBRATION,
  resolveCalibration,
  YOUNG_CHILD_LADDER,
  type DialogueCalibration,
} from '../tutor/dialogueCalibration.js';
import { HINT_LEVELS, HINT_LEVEL_WORDING, HintLadder, isValidLadder } from '../tutor/hintLadder.js';
import { buildPlan, recordGrade, stuckInstruction, stuckMove } from '../tutor/plan.js';

/*
 * C.17: age-band dialogue calibration (Appendix D §3.6) — the per-band
 * policy, the shorter younger-child ladder, the ask-first stuck move and the
 * controlling-language check in three locales.
 */

describe('bands and the calibration a session runs with', () => {
  it('an older Core falls back to the tier, and tier 3 never gets the teen or adult register without evidence', () => {
    expect(bandFromTier(1)).toBe('young_child');
    expect(bandFromTier(2)).toBe('young_child');
    expect(bandFromTier(3)).toBe('tween');
    expect(resolveCalibration(undefined, 3, 'act')).toEqual({ band: 'tween', variant: 'calibrated', assignment: 'tier_fallback', experimentId: null });
    expect(resolveCalibration(null, 1, 'act').band).toBe('young_child');
  });

  it("Core's calibration is used as sent; the operator's off forces the uniform control register", () => {
    const fromCore: DialogueCalibration = { band: 'adult', variant: 'control', assignment: 'experiment', experimentId: '44444444-4444-4444-8444-444444444444' };
    expect(resolveCalibration(fromCore, 3, 'act')).toEqual(fromCore);
    expect(resolveCalibration({ ...fromCore, variant: 'calibrated' }, 3, 'off')).toEqual({
      band: 'adult',
      variant: 'control',
      assignment: 'operator_off',
      experimentId: null,
    });
  });
});

describe('dialoguePolicy — the four registers and the control arm', () => {
  it('the younger child gets the shorter ladder (no indirect hint), direct wording and "together" framing', () => {
    const p = dialoguePolicy('young_child', 'calibrated');
    expect(p.ladder).toEqual(['reask', 'misconception', 'fill_blank', 'tell']);
    expect(p.levelWording.reask).toMatch(/together/);
    expect(p.levelWording.fill_blank).toMatch(/together/);
    expect(p.registerNote).toMatch(/let's do this one together/);
    expect(p.askBeforePacing).toBe(false);
    expect(p.controllingGate).toBe(false);
    expect(p.strategyOverlay('SOCRATIC')).toMatch(/do the first step together/);
    expect(p.strategyOverlay('RESCUE')).toBeNull();
  });

  it('the tween keeps the full ladder and the original wording, with a choice of approach', () => {
    const p = dialoguePolicy('tween', 'calibrated');
    expect(p.ladder).toEqual(HINT_LEVELS);
    expect(p.levelWording).toEqual(HINT_LEVEL_WORDING);
    expect(p.registerNote).toMatch(/choice of approach/);
    expect(p.askBeforePacing).toBe(false);
  });

  it('the teen and the adult get autonomy-supportive wording, ask-first pacing and the controlling-language gate', () => {
    for (const band of ['teen', 'adult'] as const) {
      const p = dialoguePolicy(band, 'calibrated');
      expect(p.ladder).toEqual(HINT_LEVELS);
      expect(p.levelWording.indirect).toMatch(/as an option/);
      expect(p.levelWording.tell).toMatch(/with the reason/);
      expect(p.askBeforePacing).toBe(true);
      expect(p.controllingGate).toBe(true);
      expect(p.registerNote).toMatch(/never use controlling phrasing/i);
      expect(p.strategyOverlay('RESCUE')).toMatch(/ASK whether they want it/);
      expect(p.strategyOverlay('FADED')).toMatch(/ASK/);
      expect(p.strategyOverlay('SOCRATIC')).toBeNull();
    }
    expect(dialoguePolicy('teen', 'calibrated').registerNote).toMatch(/never childish/);
  });

  it('control is the uniform pre-C.17 register for every band', () => {
    for (const band of DIALOGUE_BANDS) {
      const p = dialoguePolicy(band, 'control');
      expect(p.ladder).toEqual(HINT_LEVELS);
      expect(p.levelWording).toEqual(HINT_LEVEL_WORDING);
      expect(p.registerNote).toBeNull();
      expect(p.askBeforePacing).toBe(false);
      expect(p.strategyOverlay('RESCUE')).toBeNull();
    }
  });

  it('the controlling-language gate follows the band in BOTH arms (C.17 Tier 1, OD-26 opened the control arm to teens)', () => {
    expect(CONTROLLING_GATE_BANDS).toEqual(['teen', 'adult']);
    for (const variant of ['calibrated', 'control'] as const) {
      expect(dialoguePolicy('teen', variant).controllingGate).toBe(true);
      expect(dialoguePolicy('adult', variant).controllingGate).toBe(true);
      expect(dialoguePolicy('tween', variant).controllingGate).toBe(false);
      expect(dialoguePolicy('young_child', variant).controllingGate).toBe(false);
    }
    for (const band of DIALOGUE_BANDS) expect(controllingGateFor(band)).toBe(band === 'teen' || band === 'adult');
  });

  it('no register note names an age, a band or the learner — it says how to speak, not who they are', () => {
    for (const band of DIALOGUE_BANDS) {
      const note = dialoguePolicy(band, 'calibrated').registerNote ?? '';
      expect(note).not.toMatch(/\b(?:\d{1,2}|years?|old|ages?|teens?|teenagers?|child|children|kids?|adults?|young|band|tier)\b/i);
    }
  });
});

describe('the hint ladder in the younger-child register (C.13 × C.17)', () => {
  it('escalates re-ask → targeted hint → fill in the blank → tell, never repeating a rung', () => {
    const ladder = new HintLadder(YOUNG_CHILD_LADDER);
    expect(ladder.rungCount).toBe(4);
    expect(ladder.levelFor('s')).toBe('reask');
    expect(ladder.registerHintRequest('s')).toBe('misconception');
    expect(ladder.registerHintRequest('s')).toBe('fill_blank');
    expect(ladder.registerHintRequest('s')).toBe('tell');
    expect(ladder.reachedTell('s')).toBe(true);
    expect(ladder.registerHintRequest('s')).toBe('tell');
    // The full ladder needs one more request to reach the tell.
    const full = new HintLadder();
    expect([full.registerHintRequest('s'), full.registerHintRequest('s'), full.registerHintRequest('s'), full.registerHintRequest('s')]).toEqual([
      'indirect',
      'misconception',
      'fill_blank',
      'tell',
    ]);
  });

  it('"just tell me" is still honoured once, immediately', () => {
    const ladder = new HintLadder(YOUNG_CHILD_LADDER);
    expect(ladder.registerTellRequest('s')).toBe('tell');
    expect(ladder.levelFor('s')).toBe('tell');
  });

  it('a malformed ladder (reordered, missing the tell, repeating a rung) falls back to the full one', () => {
    expect(isValidLadder(YOUNG_CHILD_LADDER)).toBe(true);
    expect(isValidLadder(['reask', 'tell'])).toBe(true);
    for (const bad of [['tell', 'reask'], ['reask', 'indirect'], ['reask', 'fill_blank', 'misconception', 'tell'], ['reask', 'reask', 'tell'], ['indirect', 'tell']] as const) {
      expect(isValidLadder(bad)).toBe(false);
      expect(new HintLadder(bad).rungCount).toBe(HINT_LEVELS.length);
    }
  });
});

describe('the ask-first stuck move (teens, adults)', () => {
  const stuckPlan = (failures: number) => {
    const plan = buildPlan('course_topic', null, 'skill-x');
    for (let i = 0; i < failures; i += 1) recordGrade(plan, 'skill-x', false);
    return plan;
  };

  it('the default register keeps its exact pre-C.17 behaviour: a unilateral change of approach, then an offer', () => {
    const plan = stuckPlan(2);
    const move = stuckMove(plan, 'skill-x');
    expect(move.kind).toBe('style_change');
    expect(move.text).toMatch(/change the approach entirely/);
    const offer = stuckInstruction(stuckPlan(3), 'skill-x');
    expect(offer).toBe(
      'The learner has now missed this skill 3 times and different explanations were tried. Reassure them warmly that this one is genuinely tricky, and offer ONE adaptation via offerAdaptation (pick the one you judge most likely to help). Do not request another activity this turn.',
    );
  });

  it('ask-first skips the unilateral change: the first stuck point is an accept/decline offer with a reason', () => {
    const plan = stuckPlan(2);
    const move = stuckMove(plan, 'skill-x', { askFirst: true });
    expect(move.kind).toBe('offer');
    expect(move.text).toMatch(/offer ONE adaptation via offerAdaptation/);
    expect(move.text).toMatch(/why you suggest it, and change nothing until they accept/);
    expect(move.text).not.toMatch(/change the approach entirely/);
    expect(plan.stylesTried).toEqual([]);
  });

  it('ask-first with every adaptation declined keeps teaching without another offer', () => {
    const plan = stuckPlan(2);
    plan.declinedAdaptations.push('slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing');
    const move = stuckMove(plan, 'skill-x', { askFirst: true });
    expect(move.kind).toBe('no_offer_left');
    expect(move.text).toMatch(/Do NOT offer another adaptation/);
  });
});

describe('controllingLanguage — Reeve & Jang markers, declarative sentences, three locales', () => {
  it.each([
    ['You need to divide it first.', 'you need to'],
    ['You have to save half.', 'you have to'],
    ['You must count the coins again.', 'you must'],
    ['You should check the price.', 'you should'],
    ["You've got to add them.", "you've got to"],
    ['Tienes que dividir entre cuatro.', 'tienes que'],
    ['Primero debes restar el precio.', 'debes'],
    ['Necesitas sumar las monedas.', 'necesitas sumar'],
    ['Tenés que ahorrar la mitad.', 'tenes que'],
    ['Você tem que somar tudo.', 'voce tem que'],
    ['Você precisa guardar metade.', 'voce precisa'],
    ['Primeiro você deve contar.', 'voce deve'],
  ])('flags %s', (say, marker) => {
    expect(controllingLanguage(say)).toBe(marker);
  });

  it.each([
    'You could try dividing it first.',
    'One option is to save half. Want to try?',
    'Do you need to see it again?',
    '¿Necesitas ayuda con esto?',
    '¿Tienes que pagarlo hoy?',
    'Hay que sumar las monedas primero.',
    'O número tem que ser inteiro.',
    'Você quer tentar de novo?',
    'Podrías intentar restar primero.',
    'Quizás te ayude contar hacia arriba.',
    'Nice work — you divided it into four equal parts.',
  ])('does not flag %s', (say) => {
    expect(controllingLanguage(say)).toBeNull();
  });

  it('finds the order in a later declarative sentence after an allowed question', () => {
    expect(controllingLanguage('Want a hint? You have to start with the price.')).toBe('you have to');
  });
});

describe('the calibration record', () => {
  it('counts what the policy did, with labels and numbers only', () => {
    const calibration: DialogueCalibration = { band: 'teen', variant: 'calibrated', assignment: 'not_eligible', experimentId: null };
    const recorder = new DialogueCalibrationRecorder(calibration, dialoguePolicy('teen', 'calibrated'));
    recorder.noteHintRequest();
    recorder.noteHintRequest();
    recorder.noteTellRequest();
    recorder.noteControllingCaught();
    recorder.noteStuckMove('offer');
    recorder.noteStuckMove('style_change');
    recorder.noteStuckMove('none');
    expect(recorder.report()).toEqual({
      ...calibration,
      ladderRungs: 5,
      hintRequests: 2,
      tellRequests: 1,
      controllingCaught: 1,
      controllingDelivered: 0,
      pacingOffers: 1,
      unilateralStyleChanges: 1,
      tellDelivered: 0,
      tellWithdrawn: 0,
      budgetCaught: 0,
      budgetDelivered: 0,
      selfNamingCaught: 0,
      selfNamingDelivered: 0,
    });
    const restored = new DialogueCalibrationRecorder(calibration, dialoguePolicy('teen', 'calibrated'));
    restored.restore(DialogueCalibrationSnapshotSchema.parse(JSON.parse(JSON.stringify(recorder.snapshot()))));
    expect(restored.report()).toEqual(recorder.report());
    expect(DialogueCalibrationSnapshotSchema.parse(EMPTY_DIALOGUE_CALIBRATION)).toEqual(EMPTY_DIALOGUE_CALIBRATION);
  });
});
