import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '../context/schema.js';
import {
  answersDecision,
  classifyExplanation,
  classifyGoalReply,
  conceptsNamed,
  familiesForDecision,
  isDecisionQuestion,
} from '../tutor/explanationLexicon.js';
import { AllianceController, claimsSharedHistory, strictestAllianceMode } from '../tutor/allianceController.js';
import { SelfExplanation } from '../tutor/selfExplanation.js';
import { DispositionObserver, dispositionEffects, type DispositionProfile } from '../tutor/dispositionProfile.js';
import { PedagogicalController } from '../tutor/controller.js';
import type { SessionPlanEntry } from '../core/client.js';
import {
  continuityOpeningResponse,
  renegotiationText,
  selfExplanationText,
} from '../tutor/scripted.js';
import { CHARACTER_IDS } from '../context/schema.js';

/*
 * The unit contract of the C.14 / C.15 / C.7 building blocks: the learner-text
 * readers, the two dialogue-move objects and the disposition effects, each
 * without the turn pipeline (`allianceSession.test.ts` drives that).
 */

describe('C.14 explanation-quality check (Appendix D §3.3: cites the concept, or filler?)', () => {
  const SAVING = ['saving', 'spending', 'sharing', 'time', 'budget'] as const;
  it.each([
    ['en-US', 'Because I want to save some for later', 'concept'],
    ['en-US', "because it's right", 'filler'],
    ['en-US', 'idk', 'filler'],
    ['en-US', 'the blue one', 'filler'],
    ['en-US', 'my favorite color is blue and it looks nice', 'off_concept'],
    ['es-MX', 'porque quiero ahorrar para después', 'concept'],
    ['es-MX', 'porque sí', 'filler'],
    ['es-MX', 'pos nomás', 'filler'],
    ['es-MX', 'me gusta mucho el color azul del dibujo', 'off_concept'],
    ['pt-BR', 'porque eu quero guardar pra depois', 'concept'],
    ['pt-BR', 'porque sim', 'filler'],
    ['pt-BR', 'sei lá', 'filler'],
    ['pt-BR', 'eu gosto muito da cor azul do desenho', 'off_concept'],
  ] as const)('%s: "%s" → %s', (_locale, text, expected) => {
    expect(classifyExplanation(text, SAVING)).toBe(expected);
  });

  it('judges against the decision’s OWN families: "because I want it" names the idea for needs/wants only', () => {
    expect(classifyExplanation('because I want it', ['needs_wants'])).toBe('concept');
    expect(classifyExplanation('because I want to', ['price_value'])).toBe('filler');
  });

  it('a number compared is price/budget reasoning', () => {
    expect(conceptsNamed('8 is less than 10')).toEqual(expect.arrayContaining(['price_value', 'budget']));
    expect(classifyExplanation('cuesta 5 menos que el otro', ['price_value'])).toBe('concept');
  });

  it('only decision activities are decision points', () => {
    for (const type of ['piggy_split', 'needs_wants', 'price_compare', 'budget_fit', 'savings_goal', 'fair_trade', 'best_decision', 'story_branch', 'dialogue_choice', 'would_you_rather']) {
      expect(familiesForDecision(type), type).not.toBeNull();
    }
    for (const type of ['coin_count', 'make_change', 'interest_peek', 'number_line', 'quiz_mcq', null, undefined]) {
      expect(familiesForDecision(type), String(type)).toBeNull();
    }
  });

  it('reads a money-decision question from the Mentor, and a real choice from the learner', () => {
    expect(isDecisionQuestion('You got 20 dollars. Would you save it or spend it?')).toBe(true);
    expect(isDecisionQuestion('Tienes 20 pesos. ¿Los ahorras o los gastas?')).toBe(true);
    expect(isDecisionQuestion('Você ganhou 20 reais. Vai guardar ou gastar?')).toBe(true);
    expect(isDecisionQuestion('How much is 20 plus 5?')).toBe(false);
    expect(isDecisionQuestion('Save or spend is a big choice.')).toBe(false);
    expect(answersDecision('save it', 'Would you save it or spend it?')).toBe(true);
    expect(answersDecision('the bike', 'Would you buy the bike or the ball?')).toBe(true);
    expect(answersDecision('lol', 'Would you save it or spend it?')).toBe(false);
    expect(answersDecision('porque sí', '¿Lo ahorras o lo gastas?')).toBe(false);
  });
});

describe('C.15 goal reply and the no-false-familiarity check', () => {
  it.each([
    ['yes', 'agree'],
    ["yeah that's it", 'agree'],
    ['exacto', 'agree'],
    ['sí, eso', 'agree'],
    ['isso mesmo', 'agree'],
    ['no, something else', 'other'],
    ["that's not right", 'other'],
    ['mejor otra cosa', 'other'],
    ['prefiero vender limonada', 'other'],
    ['não, outra coisa', 'other'],
    ['the bike is 60 dollars', 'unclear'],
    ['', 'unclear'],
  ] as const)('"%s" → %s', (text, expected) => {
    expect(classifyGoalReply(text)).toBe(expected);
  });

  it.each([
    ['Last time we worked on saving. Ready?', true],
    ['I remember you from before!', true],
    ['Good to see you again, Robi.', true],
    ['La vez pasada vimos cómo ahorrar.', true],
    ['¿Te acuerdas de cuando hicimos la alcancía?', true],
    ['Da última vez a gente viu como poupar.', true],
    ['Que bom te ver de novo!', true],
    // The learner's OWN history with other Mentors may be named; this session's own past is fine.
    ['I see you practised saving before. What shall we try?', false],
    ['We already counted the coins today, so now the change.', false],
    ['Veo que ya practicaste ahorrar antes.', false],
  ] as const)('shared-history claim: "%s" → %s', (say, expected) => {
    expect(claimsSharedHistory(say)).toBe(expected);
  });
});

describe('the Alliance Controller object', () => {
  it('goal lifecycle: pending → proposed → agreed; the report maps every end state', () => {
    const a = new AllianceController('act', 'continuing');
    expect(a.goalPromptDue).toBe(true);
    expect(a.report().goalAgreement).toBe('not_reached');
    a.noteLearnerTurn();
    a.markGoalProposed();
    expect(a.report().goalAgreement).toBe('unconfirmed');
    a.answerGoal('agree');
    expect(a.report()).toMatchObject({ goalAgreement: 'agreed', goalSettledAtTurn: 2 });
    a.answerGoal('other'); // no longer open: ignored
    expect(a.report().goalAgreement).toBe('agreed');
  });

  it('renegotiation fires on the defined decline pattern, at most maxRenegotiations times, and is judged by its window', () => {
    const a = new AllianceController('act', null);
    a.noteDeclined();
    expect(a.renegotiationDue).toBe(false);
    a.noteDeclined();
    expect(a.renegotiationDue).toBe(true);
    a.markRenegotiationDelivered();
    a.answerRenegotiation(true);
    for (let i = 0; i < 4; i += 1) a.noteLearnerTurn();
    expect(a.report().renegotiations[0]).toMatchObject({ outcome: 'answered', improved: true });
    a.noteDeclined();
    a.noteDeclined();
    a.markRenegotiationDelivered();
    a.answerRenegotiation(false);
    a.noteDisengagement();
    a.noteDeclined();
    a.noteDeclined(); // third pattern: over the cap of 2
    expect(a.report().renegotiations).toHaveLength(2);
    expect(a.report().renegotiations[1]).toMatchObject({ outcome: 'unanswered', improved: false });
  });

  it('a renegotiation never delivered reports undelivered after a missed turn, session_ended otherwise', () => {
    const missed = new AllianceController('act', null);
    missed.noteDeclined();
    missed.noteDeclined();
    missed.noteTurnWithoutRenegotiation();
    expect(missed.report().renegotiations[0]!.outcome).toBe('undelivered');
    const ended = new AllianceController('act', null);
    ended.noteDeclined();
    ended.noteDeclined();
    expect(ended.report().renegotiations[0]!.outcome).toBe('session_ended');
  });

  it('modes: shadow records, off does nothing; the stricter mode wins', () => {
    const shadow = new AllianceController('shadow', 'persona_switch');
    shadow.noteDeclined();
    shadow.noteDeclined();
    expect(shadow.renegotiationDue).toBe(false);
    expect(shadow.continuityOpening).toBeNull();
    expect(shadow.continuityNote()).toBe('');
    shadow.noteOpening();
    expect(shadow.report()).toMatchObject({ continuityMove: 'shadow', renegotiations: [expect.objectContaining({ outcome: 'shadow' })] });
    const off = new AllianceController('off', 'first_meeting');
    off.noteDeclined();
    off.noteDeclined();
    expect(off.goalPromptDue).toBe(false);
    expect(off.report().renegotiations).toEqual([]);
    expect(strictestAllianceMode('act', 'shadow')).toBe('shadow');
    expect(strictestAllianceMode('off', 'act')).toBe('off');
  });

  it('continuity: who needs an introduction, a reconnection or nothing', () => {
    expect(new AllianceController('act', 'first_meeting').continuityOpening).toBe('introduce');
    expect(new AllianceController('act', 'persona_switch').continuityOpening).toBe('introduce');
    expect(new AllianceController('act', 'memory_gap').continuityOpening).toBe('reconnect');
    expect(new AllianceController('act', 'continuing').continuityOpening).toBeNull();
    const unknown = new AllianceController('act', null);
    unknown.noteOpening();
    expect(unknown.report().continuityMove).toBe('unknown');
  });
});

describe('the self-explanation object', () => {
  const FAMILIES = ['saving'] as const;
  it('pending → open → (filler) follow-up due → open → explained by the Mentor; never loops', () => {
    const s = new SelfExplanation('act');
    expect(s.consider({ source: 'activity', families: FAMILIES, verifiedWrong: false, scaffolded: false })).toBe(true);
    expect(s.promptDue).toBe(true);
    s.markPromptDelivered();
    expect(s.awaitingExplanation).toBe(true);
    expect(s.readReply('porque sí', { misconception: false, help: false })).toMatchObject({ kind: 'followup', quality: 'filler' });
    s.markFollowupDelivered();
    expect(s.readReply('no sé', { misconception: false, help: false })).toMatchObject({ kind: 'explain' });
    expect(s.awaitingExplanation).toBe(false);
    expect(s.readReply('ahorrar', { misconception: false, help: false })).toBeNull();
    expect(s.report().events[0]).toMatchObject({ firstQuality: 'filler', followupQuality: 'filler', outcome: 'explained_by_mentor' });
  });

  it('spacing, the cap, supersede and not-delivered', () => {
    const s = new SelfExplanation('act', { maxPerSession: 2, minSpacingTurns: 3 });
    expect(s.consider({ source: 'activity', families: FAMILIES, verifiedWrong: true, scaffolded: false })).toBe(true);
    expect(s.variant).toBe('how');
    s.markPromptNotDelivered();
    s.noteLearnerTurn();
    expect(s.consider({ source: 'activity', families: FAMILIES, verifiedWrong: false, scaffolded: false })).toBe(false); // spacing
    for (let i = 0; i < 3; i += 1) s.noteLearnerTurn();
    expect(s.consider({ source: 'conversation', families: FAMILIES, verifiedWrong: false, scaffolded: true })).toBe(true);
    expect(s.variant).toBe('scaffolded');
    s.supersede();
    for (let i = 0; i < 3; i += 1) s.noteLearnerTurn();
    expect(s.consider({ source: 'activity', families: FAMILIES, verifiedWrong: false, scaffolded: false })).toBe(false); // cap
    expect(s.report().events.map((e) => e.outcome)).toEqual(['undelivered', 'superseded']);
  });
});

describe('C.7 disposition effects — bounded and interpretable', () => {
  const base: DispositionProfile = {
    sessionsObserved: 5,
    helpStyle: 'independent',
    persistence: 'persists',
    explanation: 'explains',
    persistentlyDeclined: [],
    typicalTypedReplyMs: null,
    typicalSpokenReplyMs: null,
  };

  it('a null profile changes nothing', () => {
    expect(dispositionEffects(null)).toMatchObject({ stuckDegradeAfter: 3, scaffoldedExplanations: false, seededDeclines: [], idleNudgeFloorMs: null, applied: [] });
  });

  it('each trait maps to exactly one bounded effect', () => {
    expect(dispositionEffects({ ...base, persistence: 'disengages_early' }).stuckDegradeAfter).toBe(2);
    expect(dispositionEffects({ ...base, persistence: 'disengages_early', helpStyle: 'tell_early' }).stuckDegradeAfter).toBe(1);
    expect(dispositionEffects({ ...base, explanation: 'needs_scaffold' }).applied).toEqual(['scaffolded_explanation']);
    expect(dispositionEffects({ ...base, persistentlyDeclined: ['less_text', 'less_text'] }).seededDeclines).toEqual(['less_text']);
    expect(dispositionEffects({ ...base, typicalTypedReplyMs: 30_000 }).idleNudgeFloorMs).toBe(45_000);
    expect(dispositionEffects({ ...base, typicalSpokenReplyMs: 90_000 }).idleNudgeFloorMs).toBe(60_000); // capped
  });

  it('the controller degrades SOCRATIC to FADED sooner for an early disengager (read beside mastery)', () => {
    const plan: SessionPlanEntry[] = [
      { kcId: 'kc-1', kcKey: 'save.basics', skillKey: null, objective: 'Save', mode: 'new', reason: 'frontier', pKnown: 0.7, targetDifficulty: 3, prereqKcIds: [], misconceptions: [] } as unknown as SessionPlanEntry,
    ];
    const strategiesAfter = (degrade: number): string[] => {
      const c = new PedagogicalController(plan, [], { stuckDegradeAfter: degrade });
      const out: string[] = [];
      for (let i = 0; i < 3; i += 1) out.push(c.decide({ kind: 'conversation_turn' }, 1_000 + i * 70_000).strategy);
      return out;
    };
    const firstFaded = (degrade: number) => strategiesAfter(degrade).indexOf('FADED');
    // The default degrades on the third turn without progress; the disposition moves it one turn earlier.
    expect(strategiesAfter(3)).toEqual(['SOCRATIC', 'SOCRATIC', 'FADED']);
    expect(firstFaded(2)).toBe(firstFaded(3) - 1);
    expect(firstFaded(1)).toBe(firstFaded(3) - 2);
    expect(new PedagogicalController(plan, [], { stuckDegradeAfter: 7 }).decide({ kind: 'conversation_turn' }, 0).strategy).toBe('SOCRATIC');
  });

  it('the observer reports medians and closed labels, and ignores absences', () => {
    const o = new DispositionObserver(true, dispositionEffects({ ...base, typicalTypedReplyMs: 30_000 }));
    o.noteLearnerTurn({ source: 'typed', replyMs: 4_000, hint: true, tell: false });
    o.noteLearnerTurn({ source: 'typed', replyMs: 6_000, hint: false, tell: true });
    o.noteLearnerTurn({ source: 'typed', replyMs: 3_600_000, hint: false, tell: false }); // an absence
    o.noteAdaptation('more_visual', false);
    o.noteIdleNudgePaced();
    expect(o.report()).toEqual({
      learnerTurns: 3,
      hintRequests: 1,
      tellRequests: 1,
      typedReplyMs: 5_000,
      spokenReplyMs: null,
      acceptedAdaptations: [],
      declinedAdaptations: ['more_visual'],
      profileReceived: true,
      applied: ['idle_nudge_paced'],
    });
  });
});

describe('the new written lines fit the Mentor copy budget for ages 6–9 (Bible 06 §3.1)', () => {
  const words = (text: string) => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  const sentences = (text: string) => text.split(/[.!?…]+(?:\s|$)/u).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
  const limit = (locale: Locale) => Math.ceil(12 * (locale === 'en-US' ? 1 : 1.25));
  it('every self-explanation, renegotiation and continuity line', () => {
    for (const locale of LOCALES) {
      const texts = [
        selfExplanationText(locale, 'why'),
        selfExplanationText(locale, 'how'),
        selfExplanationText(locale, 'scaffolded'),
        renegotiationText(locale),
        ...CHARACTER_IDS.flatMap((c) => [
          continuityOpeningResponse(c, locale, 'introduce').say,
          continuityOpeningResponse(c, locale, 'reconnect').say,
        ]),
      ];
      for (const text of texts) {
        expect(words(text), `${locale}: "${text}"`).toBeLessThanOrEqual(limit(locale));
        expect(sentences(text), `${locale}: "${text}"`).toBeLessThanOrEqual(2);
        expect((text.match(/\?/g) ?? []).length, text).toBeLessThanOrEqual(1);
        expect(text.includes('—'), text).toBe(false);
        // About the method and the reasoning, never about how the learner feels.
        expect(text).not.toMatch(/tired|bored|frustrat|sad|cansad|aburrid|triste|frustrad/i);
      }
      // An introduction never claims a shared history.
      for (const c of CHARACTER_IDS) expect(claimsSharedHistory(continuityOpeningResponse(c, locale, 'introduce').say)).toBe(false);
    }
  });
});
