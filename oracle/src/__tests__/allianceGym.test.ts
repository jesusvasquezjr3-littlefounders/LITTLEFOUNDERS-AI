import { describe, expect, it } from 'vitest';
import { ALLIANCE_DEFAULTS } from '../tutor/allianceController.js';
import { SELF_EXPLANATION_DEFAULTS } from '../tutor/selfExplanation.js';
import { ALLIANCE_PERSONAS, runAllianceGym, runAlliancePersona, type AlliancePersona } from '../tutor/allianceGym.js';

/*
 * C.15 DoD (b) and (c), C.14: the Alliance Controller and the self-explanation
 * move against Appendix F Part 3 Stage 2's simulated learners. Every persona
 * passes on the proposed defaults AND is proven able to FAIL: a persona no
 * regression can turn red is decoration.
 */

const persona = (name: string): AlliancePersona => ALLIANCE_PERSONAS.find((p) => p.name === name)!;
const EMOTION_LABEL = /frustrat|bored|angry|sad|upset|anxious|tired|emotion|mood|feel/i;

describe('the Alliance Controller and the self-explanation move against the simulated learners', () => {
  it('passes every persona on the proposed defaults', () => {
    const { ok, reports } = runAllianceGym();
    expect(reports.flatMap((r) => r.problems.map((p) => `${r.persona}: ${p}`))).toEqual([]);
    expect(reports.map((r) => r.persona).sort()).toEqual(
      ['concept_explainer', 'filler_explainer', 'frustrated', 'masking', 'persona_switcher', 'reactant_teen', 'repeated_decliner', 'steady'],
    );
    expect(ok).toBe(true);
  });

  it('no record, for any persona, carries an emotion label or learner text', () => {
    for (const p of ALLIANCE_PERSONAS) {
      const result = runAlliancePersona(p);
      const record = JSON.stringify({ alliance: result.alliance, selfExplanation: result.selfExplanation });
      expect(record, p.name).not.toMatch(EMOTION_LABEL);
      for (const act of p.acts) if ('text' in act) expect(record, p.name).not.toContain(act.text);
    }
  });
});

describe('every persona can turn red (mutation checks)', () => {
  it('repeated_decliner: a deaf trigger never renegotiates', () => {
    expect(runAlliancePersona(persona('repeated_decliner'), { ...ALLIANCE_DEFAULTS, renegotiateAfterDeclines: 99 }).problems).not.toEqual([]);
  });
  it('reactant_teen: a window that closes too early reads a later decline as "improved"', () => {
    expect(runAlliancePersona(persona('reactant_teen'), { ...ALLIANCE_DEFAULTS, improvementWindow: 1 }).problems).not.toEqual([]);
  });
  it('persona_switcher: the same history marked "continuing" is neither introduced nor guarded', () => {
    expect(runAlliancePersona({ ...persona('persona_switcher'), continuity: 'continuing' }).problems).not.toEqual([]);
  });
  it('filler_explainer: no spacing re-interrogates the learner', () => {
    expect(runAlliancePersona(persona('filler_explainer'), ALLIANCE_DEFAULTS, { ...SELF_EXPLANATION_DEFAULTS, minSpacingTurns: 0 }).problems).not.toEqual([]);
  });
  it('concept_explainer and frustrated: a move that never prompts fails them', () => {
    const never = { ...SELF_EXPLANATION_DEFAULTS, maxPerSession: 0 };
    expect(runAlliancePersona(persona('concept_explainer'), ALLIANCE_DEFAULTS, never).problems).not.toEqual([]);
    expect(runAlliancePersona(persona('frustrated'), ALLIANCE_DEFAULTS, never).problems).not.toEqual([]);
  });
  it('masking: a vague reply read as agreement fails it', () => {
    const misread: AlliancePersona = {
      ...persona('masking'),
      acts: persona('masking').acts.map((a) => (a.kind === 'goal_reply' ? { ...a, text: 'yes' } : a)),
    };
    expect(runAlliancePersona(misread).problems).not.toEqual([]);
  });
  it('steady: a hair-trigger renegotiates with a learner who accepts', () => {
    expect(runAlliancePersona(persona('steady'), { ...ALLIANCE_DEFAULTS, renegotiateAfterDeclines: 1 }).problems).not.toEqual([]);
  });
});
