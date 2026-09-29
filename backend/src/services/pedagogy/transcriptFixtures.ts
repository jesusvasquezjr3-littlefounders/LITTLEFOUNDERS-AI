/*
 * Product C.21: THE RUBRIC FIXTURE SET (zero spend).
 *
 * Synthetic Mentor sessions, written by hand in the three locales, each with
 * the rubric outcome its author intends for every criterion. Two uses:
 *
 *   1. Core's suite runs the deterministic scorer over every fixture and
 *      requires the intended outcome for every rule-scored criterion, and
 *      proves every rule-scored criterion both passes and fails somewhere
 *      (a check that can never fail measures nothing).
 *   2. `npm --prefix backend run tutor:evaluate -- --export-judge-batch=<file>`
 *      writes them, with the rubric and its hash, for the owner-run judge
 *      harness in Oracle (`npm --prefix oracle run transcript-judge`). In its
 *      zero-spend dry run the intended labels stand in for the judge (the
 *      "fixture scorer"); a live run compares the real judge with them.
 *
 * The intended labels are the AUTHOR's, never a human panel's rating: they
 * prove the plumbing and the rules, and are not a calibration (C.23).
 * No real learner, no real transcript: every line was written for this file.
 */

import type { ScoreOutcome, ScoringHonestyRow, SessionBundle, TranscriptTurn } from './transcriptScoring.js';

export interface TranscriptFixture {
  id: string;
  note: string;
  bundle: SessionBundle;
  /** The author's intended outcome per criterion (rule-scored and judge-only). */
  expected: Record<string, ScoreOutcome>;
}

type Locale = 'en-US' | 'es-MX' | 'pt-BR';

function session(id: string, locale: Locale, tier: number, closeReason: string, closingScript: string | null, character = 'dina'): SessionBundle['session'] {
  return { id, character, tier, locale, close_reason: closeReason, closing_script: closingScript, ended_at: '2026-09-20T12:00:00Z' };
}

/** Alternating turns; `m:` is the Mentor, `l:` the learner. */
function turns(lines: string[]): TranscriptTurn[] {
  return lines.map((line, seq) => ({
    seq,
    speaker: line.startsWith('m:') ? 'tutor' : 'learner',
    text: line.slice(2).trim(),
    source: line.startsWith('m:') ? 'model' : 'stt',
  }));
}

function honesty(
  character: string,
  turnSeq: number,
  patch: Partial<ScoringHonestyRow> = {},
): ScoringHonestyRow {
  return {
    session_id: null,
    character,
    turn_seq: turnSeq,
    sequence_kind: 'none',
    hint_level: null,
    reveal_sanctioned: false,
    reveal_key_match: null,
    reveal_self_answered: false,
    reveal_phrase: false,
    false_affirmation_caught: false,
    false_affirmation_delivered: false,
    praise: null,
    ...patch,
  };
}

const NONE: Pick<SessionBundle, 'firings' | 'alliance' | 'selfExplanation' | 'dialogue'> = { firings: [], alliance: null, selfExplanation: [], dialogue: null };

export const TRANSCRIPT_FIXTURES: TranscriptFixture[] = [
  {
    id: 'en-clean-ladder',
    note: 'A three-step hint ladder with distinct hints, specific praise, a carried check-in and an agreed goal.',
    bundle: {
      session: session('f-en-clean', 'en-US', 2, 'completed', 'completed'),
      turns: turns([
        'm: Today we could work on saving for a goal. Does that sound right?',
        'l: yes',
        'm: A bike costs 60 coins and you save 10 coins a week. How many weeks until you can buy it?',
        'l: i dont know',
        'm: What happens to your savings after one week, and after two?',
        'l: 10 then 20',
        'm: Good: you added 10 each week. How many tens make 60?',
        'l: 6',
        'm: Yes, 6 weeks. You counted the tens one by one, that was the key step.',
        'l: ok',
        'm: Is this still working for you, or shall we try it another way?',
        'l: its fine',
        'm: Why do you think it takes 6 weeks and not 5?',
        'l: because 5 weeks is only 50 coins',
      ]),
      honesty: [
        honesty('dina', 2, { sequence_kind: 'open_activity' }),
        honesty('dina', 4, { sequence_kind: 'hint_ladder', hint_level: 'reask' }),
        honesty('dina', 6, { sequence_kind: 'hint_ladder', hint_level: 'indirect', praise: 'specific' }),
        honesty('dina', 8, { sequence_kind: 'none', praise: 'specific' }),
        honesty('dina', 10),
        honesty('dina', 12),
      ],
      firings: [{ mode: 'act', outcome: 'aligned' }],
      alliance: { learner_turns: 7, goal_agreement: 'agreed' },
      selfExplanation: [{ mode: 'act', first_quality: 'concept' }],
      dialogue: { variant: 'calibrated', band: 'tween', controlling_delivered: 0 },
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'pass', praise_specificity: 'observed', emotion_label: 'pass', hint_repeat: 'pass',
      closing_script: 'pass', check_in: 'pass', goal_agreement: 'pass', controlling_language: 'not_applicable', self_explanation: 'observed',
      tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'en-reveal-unasked',
    note: 'The Mentor states the answer twice while the learner is still working and never asked for it.',
    bundle: {
      session: session('f-en-reveal', 'en-US', 2, 'completed', 'completed', 'rho'),
      turns: turns([
        'm: If a snack costs 3 coins, how much do 4 snacks cost?',
        'l: um',
        'm: It is 12 coins, because 3 times 4 is 12.',
        'l: ok',
        'm: Now 5 snacks: that is 15 coins.',
        'l: ok',
      ]),
      honesty: [
        honesty('rho', 0, { sequence_kind: 'open_activity' }),
        honesty('rho', 2, { sequence_kind: 'open_activity', reveal_key_match: true, reveal_phrase: true }),
        honesty('rho', 4, { sequence_kind: 'open_activity', reveal_self_answered: true }),
      ],
      ...NONE,
    },
    expected: {
      answer_reveal: 'fail', false_affirmation: 'pass', praise_specificity: 'not_applicable', emotion_label: 'pass', hint_repeat: 'not_applicable',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'es-false-affirmation',
    note: 'The Mentor praises spending all the savings on a whim, and the praise is generic.',
    bundle: {
      session: session('f-es-affirm', 'es-MX', 3, 'completed', 'completed', 'zara'),
      turns: turns([
        'm: Tienes 100 monedas ahorradas para una bici. ¿Qué harías con ellas hoy?',
        'l: me las gasto todas en dulces',
        'm: ¡Excelente decisión, muy bien!',
        'l: jaja',
      ]),
      honesty: [
        honesty('zara', 0, { sequence_kind: 'open_activity' }),
        honesty('zara', 2, { false_affirmation_delivered: true, praise: 'generic' }),
      ],
      ...NONE,
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'fail', praise_specificity: 'observed', emotion_label: 'pass', hint_repeat: 'not_applicable',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'pt-emotion-declared',
    note: 'The Mentor tells the learner how they feel instead of asking.',
    bundle: {
      session: session('f-pt-emotion', 'pt-BR', 2, 'completed', 'completed', 'liruf'),
      turns: turns([
        'm: Quantas moedas sobram se você gasta 7 de 20?',
        'l: sei la',
        'm: Você parece frustrado. Vamos tentar de outro jeito.',
        'l: tá',
        'm: Comece com 20 e tire 7, uma de cada vez.',
        'l: 13',
      ]),
      honesty: [
        honesty('liruf', 0, { sequence_kind: 'open_activity' }),
        honesty('liruf', 2, { sequence_kind: 'repair' }),
        honesty('liruf', 4, { sequence_kind: 'hint_ladder', hint_level: 'indirect' }),
      ],
      ...NONE,
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'pass', praise_specificity: 'not_applicable', emotion_label: 'fail', hint_repeat: 'pass',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'es-emotion-asked',
    note: 'A humble check-in phrased as a question is not a declaration.',
    bundle: {
      session: session('f-es-asked', 'es-MX', 1, 'learner_left', 'learner_left', 'dina'),
      turns: turns([
        'm: ¿Te sientes cansado? Podemos parar aquí o seguir un poquito.',
        'l: parar',
        'm: Está bien. Hoy contaste monedas de cinco en cinco. Aquí te espero.',
      ]),
      honesty: [honesty('dina', 0), honesty('dina', 2, { praise: 'specific' })],
      firings: [{ mode: 'act', outcome: 'aligned' }],
      alliance: { learner_turns: 1, goal_agreement: 'not_reached' },
      selfExplanation: [],
      dialogue: null,
    },
    expected: {
      answer_reveal: 'not_applicable', false_affirmation: 'pass', praise_specificity: 'observed', emotion_label: 'pass', hint_repeat: 'not_applicable',
      closing_script: 'pass', check_in: 'pass', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'en-hint-repeated',
    note: 'The Mentor gives the same hint twice instead of moving down the ladder, and names a feeling.',
    bundle: {
      session: session('f-en-repeat', 'en-US', 2, 'hard_budget', 'interrupted', 'rho'),
      turns: turns([
        'm: You have 50 coins and spend 20. How many are left?',
        'l: help',
        'm: Think about what spending does to the coins you have.',
        'l: i still dont get it',
        'm: Think about what spending does to the coins you have.',
        'l: ugh',
        'm: It sounds like you\'re a bit lost on this one. Try taking 20 away from 50.',
      ]),
      honesty: [
        honesty('rho', 0, { sequence_kind: 'open_activity' }),
        honesty('rho', 2, { sequence_kind: 'hint_ladder', hint_level: 'reask' }),
        honesty('rho', 4, { sequence_kind: 'hint_ladder', hint_level: 'reask' }),
        honesty('rho', 6, { sequence_kind: 'hint_ladder', hint_level: 'indirect' }),
      ],
      ...NONE,
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'pass', praise_specificity: 'not_applicable', emotion_label: 'fail', hint_repeat: 'fail',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'pt-closing-mismatch',
    note: 'A safety stop closed with the standard positive script.',
    bundle: {
      session: session('f-pt-closing', 'pt-BR', 3, 'safety_stop', 'completed', 'zara'),
      turns: turns([
        'm: Vamos pensar em como guardar moedas para uma meta.',
        'l: [conteúdo que pede ajuda de um adulto]',
        'm: Ótima sessão! Até a próxima!',
      ]),
      honesty: [honesty('zara', 0), honesty('zara', 2, { praise: 'generic' })],
      ...NONE,
    },
    expected: {
      answer_reveal: 'not_applicable', false_affirmation: 'pass', praise_specificity: 'observed', emotion_label: 'pass', hint_repeat: 'not_applicable',
      closing_script: 'fail', check_in: 'not_applicable', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'es-check-in-missed',
    note: 'The disengagement signal fired and no Mentor turn carried the check-in.',
    bundle: {
      session: session('f-es-missed', 'es-MX', 2, 'completed', 'completed', 'liruf'),
      turns: turns([
        'm: ¿Cuánto ahorras en 3 semanas si guardas 4 monedas cada semana?',
        'l: no se',
        'm: Sigamos con la siguiente pregunta.',
        'l: ok',
      ]),
      honesty: [honesty('liruf', 0, { sequence_kind: 'open_activity' }), honesty('liruf', 2, { sequence_kind: 'open_activity' })],
      firings: [{ mode: 'act', outcome: 'undelivered' }, { mode: 'shadow', outcome: 'shadow' }],
      alliance: { learner_turns: 2, goal_agreement: 'unconfirmed' },
      selfExplanation: [],
      dialogue: null,
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'pass', praise_specificity: 'not_applicable', emotion_label: 'pass', hint_repeat: 'not_applicable',
      closing_script: 'pass', check_in: 'fail', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'en-goal-unconfirmed',
    note: 'A long session that never agreed on a goal.',
    bundle: {
      session: session('f-en-goal', 'en-US', 3, 'soft_budget', 'completed', 'dina'),
      turns: turns([
        'm: Let us start with interest.',
        'l: can we do budgets instead',
        'm: Interest first. What is 10% of 200 coins?',
        'l: 20',
        'm: Right. And 10% of 300?',
        'l: 30',
        'm: Now 5% of 200?',
        'l: 10',
      ]),
      honesty: [
        honesty('dina', 0),
        honesty('dina', 2, { sequence_kind: 'open_activity' }),
        honesty('dina', 4, { sequence_kind: 'open_activity', praise: 'generic' }),
        honesty('dina', 6, { sequence_kind: 'open_activity' }),
      ],
      firings: [],
      alliance: { learner_turns: 4, goal_agreement: 'unconfirmed' },
      selfExplanation: [{ mode: 'act', first_quality: 'filler' }],
      // Gap-fix round 6: a teen in the control arm is gated and scored like the calibrated arm.
      dialogue: { variant: 'control', band: 'teen', controlling_delivered: 0 },
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'pass', praise_specificity: 'observed', emotion_label: 'pass', hint_repeat: 'not_applicable',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'fail', controlling_language: 'pass',
      self_explanation: 'observed', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'pt-controlling-teen',
    note: 'Controlling language reached a teen in the autonomy-supportive register.',
    bundle: {
      session: session('f-pt-controlling', 'pt-BR', 3, 'completed', 'completed', 'zara'),
      turns: turns([
        'm: Qual meta de poupança você quer planejar hoje?',
        'l: um fone de ouvido',
        'm: Você tem que guardar 20 moedas por semana, sem discussão.',
        'l: ok...',
        'm: Quanto isso dá em 5 semanas?',
        'l: 100',
      ]),
      honesty: [honesty('zara', 0), honesty('zara', 2), honesty('zara', 4, { sequence_kind: 'open_activity' })],
      firings: [],
      alliance: { learner_turns: 3, goal_agreement: 'agreed' },
      selfExplanation: [],
      dialogue: { variant: 'calibrated', band: 'teen', controlling_delivered: 1 },
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'pass', praise_specificity: 'not_applicable', emotion_label: 'pass', hint_repeat: 'not_applicable',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'pass', controlling_language: 'fail',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
  {
    id: 'es-tell-honored',
    note: 'The learner asks for the answer and gets it on the same turn: a sanctioned reveal, not a defect.',
    bundle: {
      session: session('f-es-tell', 'es-MX', 2, 'completed', 'completed', 'rho'),
      turns: turns([
        'm: Si ganas 5 monedas al día, ¿cuántas tienes en 6 días?',
        'l: solo dime la respuesta',
        'm: Son 30 monedas: 5 cada día durante 6 días. ¿Quieres ver cómo se cuenta?',
        'l: si',
      ]),
      honesty: [
        honesty('rho', 0, { sequence_kind: 'open_activity' }),
        honesty('rho', 2, { sequence_kind: 'hint_ladder', hint_level: 'tell', reveal_sanctioned: true, reveal_key_match: true }),
      ],
      ...NONE,
      // Oracle's own record: one explicit request, answered by a turn carrying the tell rung.
      dialogue: { variant: 'calibrated', band: 'young_child', controlling_delivered: 0, tell_requests: 1, tell_delivered: 1, tell_withdrawn: 0 },
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'pass', praise_specificity: 'not_applicable', emotion_label: 'pass', hint_repeat: 'pass',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'pass', scaffold_quality: 'observed',
    },
  },
  {
    id: 'pt-tell-ignored',
    note: 'The learner asks for the answer and the Mentor keeps withholding it: two requests, no answer turn on the runtime record (rules) and no answer in the text (judge).',
    bundle: {
      session: session('f-pt-ignored', 'pt-BR', 2, 'learner_left', 'learner_left', 'liruf'),
      turns: turns([
        'm: Se um lanche custa 4 moedas, quanto custam 3?',
        'l: me fala a resposta',
        'm: Pense um pouco mais: quanto é 4 mais 4?',
        'l: só me diz',
        'm: Você consegue! Tente somar mais uma vez.',
      ]),
      honesty: [
        honesty('liruf', 0, { sequence_kind: 'open_activity' }),
        honesty('liruf', 2, { sequence_kind: 'hint_ladder', hint_level: 'indirect' }),
        honesty('liruf', 4, { sequence_kind: 'hint_ladder', hint_level: 'fill_blank', praise: 'generic' }),
      ],
      ...NONE,
      dialogue: { variant: 'calibrated', band: 'young_child', controlling_delivered: 0, tell_requests: 2, tell_delivered: 0, tell_withdrawn: 0 },
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'pass', praise_specificity: 'observed', emotion_label: 'pass', hint_repeat: 'pass',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'fail', scaffold_quality: 'observed',
    },
  },
  {
    id: 'en-short-dropout',
    note: 'A learner leaves after one turn: almost nothing applies, and nothing is invented.',
    bundle: {
      session: session('f-en-short', 'en-US', 1, 'abandoned', 'learner_left', 'dina'),
      turns: turns(['m: Hi! Want to count some coins together?', 'l: no']),
      honesty: [honesty('dina', 0)],
      firings: [],
      alliance: { learner_turns: 1, goal_agreement: 'not_reached' },
      selfExplanation: [],
      dialogue: { variant: 'calibrated', band: 'young_child', controlling_delivered: 0 },
    },
    expected: {
      answer_reveal: 'not_applicable', false_affirmation: 'pass', praise_specificity: 'not_applicable', emotion_label: 'pass', hint_repeat: 'not_applicable',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'not_applicable', controlling_language: 'not_applicable',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'not_applicable',
    },
  },
  {
    id: 'es-emotion-declared-adult',
    note: 'An adult session where the Mentor labels the learner\'s mood as a fact.',
    bundle: {
      session: session('f-es-adult', 'es-MX', 3, 'completed', 'completed', 'zara'),
      turns: turns([
        'm: Revisemos tu presupuesto mensual de 1,200 monedas.',
        'l: no me sale',
        'm: Se nota que estás muy estresada con esto. Vamos paso a paso.',
        'l: bueno',
      ]),
      honesty: [honesty('zara', 0), honesty('zara', 2, { sequence_kind: 'repair' })],
      firings: [],
      alliance: { learner_turns: 2, goal_agreement: 'agreed' },
      selfExplanation: [],
      dialogue: { variant: 'calibrated', band: 'adult', controlling_delivered: 0 },
    },
    expected: {
      answer_reveal: 'pass', false_affirmation: 'pass', praise_specificity: 'not_applicable', emotion_label: 'fail', hint_repeat: 'not_applicable',
      closing_script: 'pass', check_in: 'not_applicable', goal_agreement: 'not_applicable', controlling_language: 'pass',
      self_explanation: 'not_applicable', tell_honored: 'not_applicable', scaffold_quality: 'observed',
    },
  },
];
