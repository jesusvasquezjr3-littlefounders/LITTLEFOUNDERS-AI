import { describe, expect, it } from 'vitest';
import { bktUpdate, clampParams, predictCorrect, type BktParams } from '../services/pedagogy/bkt.js';
import { newCard, ratingFromScore, reviewCard } from '../services/pedagogy/fsrs.js';
import { normalizeSpokenNumber } from '../services/pedagogy/normalizeSpoken.js';
import { checkAttempt, type MisconceptionDef } from '../services/pedagogy/checkAnswer.js';

const PARAMS: BktParams = { pL0: 0.25, pT: 0.15, pG: 0.2, pS: 0.1 };

describe('bkt', () => {
  it('a correct answer raises the posterior, a wrong one lowers it', () => {
    const up = bktUpdate(0.5, true, PARAMS);
    const down = bktUpdate(0.5, false, PARAMS);
    expect(up).toBeGreaterThan(0.5);
    expect(down).toBeLessThan(0.5);
  });

  it('converges toward mastery on a run of correct answers', () => {
    let p = PARAMS.pL0;
    for (let i = 0; i < 6; i++) p = bktUpdate(p, true, PARAMS);
    expect(p).toBeGreaterThan(0.9);
  });

  it('never freezes at exactly 0 or 1, so evidence always still moves it', () => {
    let p = 0.999;
    for (let i = 0; i < 20; i++) p = bktUpdate(p, true, PARAMS);
    expect(p).toBeLessThan(1);
    let q = 0.001;
    for (let i = 0; i < 20; i++) q = bktUpdate(q, false, PARAMS);
    expect(q).toBeGreaterThan(0);
    // And it recovers: one wrong answer from near-mastery still descends.
    expect(bktUpdate(p, false, PARAMS)).toBeLessThan(p);
  });

  it('clampParams enforces the degeneracy guards (guess ≤ .30, slip ≤ .10)', () => {
    const clamped = clampParams({ pL0: 0.5, pT: 0.2, pG: 0.9, pS: 0.4 });
    expect(clamped.pG).toBe(0.3);
    expect(clamped.pS).toBe(0.1);
  });

  it('predictCorrect blends knowledge with guess/slip', () => {
    expect(predictCorrect(1, PARAMS)).toBeCloseTo(0.9, 5); // knows, may slip
    expect(predictCorrect(0, PARAMS)).toBeCloseTo(0.2, 5); // guesses
    expect(predictCorrect(0.75, PARAMS)).toBeGreaterThan(0.6);
  });
});

describe('fsrs', () => {
  const NOW = new Date('2026-08-28T12:00:00Z');
  const DAY = 24 * 60 * 60 * 1000;

  it('a good first review schedules days out, an easy one further', () => {
    const good = reviewCard(newCard(NOW), 'good', NOW);
    const easy = reviewCard(newCard(NOW), 'easy', NOW);
    expect(good.state).toBe('review');
    expect(good.dueAt.getTime()).toBeGreaterThan(NOW.getTime() + 2 * DAY);
    expect(easy.dueAt.getTime()).toBeGreaterThan(good.dueAt.getTime());
  });

  it('successful reviews space the card out multiplicatively', () => {
    let card = reviewCard(newCard(NOW), 'good', NOW);
    const firstInterval = card.stability;
    card = reviewCard(card, 'good', new Date(NOW.getTime() + 3 * DAY));
    expect(card.stability).toBeGreaterThan(firstInterval * 1.5);
  });

  it('a lapse collapses stability but does not erase it, and counts the lapse', () => {
    let card = reviewCard(newCard(NOW), 'easy', NOW);
    card = reviewCard(card, 'easy', new Date(NOW.getTime() + 7 * DAY));
    const before = card.stability;
    const lapsed = reviewCard(card, 'again', new Date(NOW.getTime() + 14 * DAY));
    expect(lapsed.state).toBe('relearning');
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.stability).toBeLessThan(before);
    expect(lapsed.stability).toBeGreaterThan(0);
  });

  it('a learner who keeps PASSING at "hard" never has their interval shrink toward the lapse floor', () => {
    // 'hard' still drifts difficulty upward (0.4/review), and difficulty
    // crosses grownStability's old, unclamped breakeven point (3.5) within
    // the FIRST review from the default difficulty of 5 — this was not an
    // edge case. Before the drag floor was clamped to 1/ease, this exact
    // sequence collapsed to the 0.5-day lapse floor by the 5th review, on
    // nothing but a string of correct-but-imperfect answers.
    let card = newCard(NOW);
    let now = NOW;
    let minStabilityAfterFirst = Infinity;
    for (let i = 0; i < 12; i++) {
      card = reviewCard(card, 'hard', now);
      now = card.dueAt;
      if (i > 0) minStabilityAfterFirst = Math.min(minStabilityAfterFirst, card.stability);
    }
    expect(card.state).toBe('review');
    // Never dips below 1 day (the no-growth, no-shrink floor) once difficulty
    // saturates — and never anywhere near the 0.5-day lapse-collapse floor.
    expect(minStabilityAfterFirst).toBeGreaterThanOrEqual(1);
  });

  it('difficulty drifts up on failure and down on ease, inside [1,10]', () => {
    const hardened = reviewCard(newCard(NOW), 'again', NOW);
    expect(hardened.difficulty).toBeGreaterThan(5);
    let card = newCard(NOW);
    for (let i = 0; i < 30; i++) card = reviewCard(card, 'easy', NOW);
    expect(card.difficulty).toBe(1);
  });

  it('ratingFromScore maps the grade contract', () => {
    expect(ratingFromScore(50, 1)).toBe('again');
    expect(ratingFromScore(80, 1)).toBe('hard');
    expect(ratingFromScore(90, 2)).toBe('hard'); // needed a second attempt
    expect(ratingFromScore(90, 1)).toBe('good');
    expect(ratingFromScore(100, 1)).toBe('easy');
  });
});

describe('normalizeSpokenNumber', () => {
  it('reads digit forms first', () => {
    expect(normalizeSpokenNumber('son 42 creo', 'es-MX')).toBe(42);
    expect(normalizeSpokenNumber('3.50', 'en-US')).toBe(3.5);
    expect(normalizeSpokenNumber('3,50', 'pt-BR')).toBe(3.5);
    expect(normalizeSpokenNumber('4 2', 'es-MX')).toBe(42);
  });

  it('reads Spanish number words', () => {
    expect(normalizeSpokenNumber('cuarenta y dos', 'es-MX')).toBe(42);
    expect(normalizeSpokenNumber('veintidós', 'es-MX')).toBe(22);
    expect(normalizeSpokenNumber('quinientos treinta', 'es-MX')).toBe(530);
  });

  it('reads English and Portuguese number words', () => {
    expect(normalizeSpokenNumber('forty two', 'en-US')).toBe(42);
    expect(normalizeSpokenNumber('one hundred and five', 'en-US')).toBe(105);
    expect(normalizeSpokenNumber('quarenta e dois', 'pt-BR')).toBe(42);
  });

  it('honors currency structure', () => {
    expect(normalizeSpokenNumber('tres pesos con cincuenta centavos', 'es-MX')).toBe(3.5);
    expect(normalizeSpokenNumber('cincuenta centavos', 'es-MX')).toBe(0.5);
    expect(normalizeSpokenNumber('tres pesos con cincuenta', 'es-MX')).toBe(3.5);
    expect(normalizeSpokenNumber('two dollars', 'en-US')).toBe(2);
  });

  it('returns null when nothing number-shaped was said — never a guess', () => {
    expect(normalizeSpokenNumber('no sé, explícame otra vez', 'es-MX')).toBeNull();
    expect(normalizeSpokenNumber('', 'en-US')).toBeNull();
    expect(normalizeSpokenNumber('¿me repites la pregunta?', 'es-MX')).toBeNull();
  });

  it('keeps trailing chatter from erasing a parsed number', () => {
    expect(normalizeSpokenNumber('cuarenta y dos creo yo', 'es-MX')).toBe(42);
  });
});

describe('checkAttempt', () => {
  const CHANGE_CATALOG: MisconceptionDef[] = [
    {
      id: 'mid-1',
      code: 'adds-instead-of-counts-up',
      distractorPatterns: { numeric: ['a+b'] },
    },
    {
      id: 'mid-2',
      code: 'returns-payment',
      distractorPatterns: { numeric: ['b'] },
    },
  ];

  // Change-making: price a=7, paid b=10, correct change=3.
  const OPS = { a: 7, b: 10 };

  it('a correct numeric answer is correct, no misconception', () => {
    const res = checkAttempt(
      { kind: 'numeric', submitted: 3, expected: 3, operands: OPS },
      CHANGE_CATALOG,
    );
    expect(res).toEqual({ correct: true, misconceptionId: null, misconceptionCode: null });
  });

  it('detects the add-instead-of-subtract wrong idea (17 = 7 + 10)', () => {
    const res = checkAttempt(
      { kind: 'numeric', submitted: 17, expected: 3, operands: OPS },
      CHANGE_CATALOG,
    );
    expect(res.correct).toBe(false);
    expect(res.misconceptionCode).toBe('adds-instead-of-counts-up');
  });

  it('detects returning the full payment (10)', () => {
    const res = checkAttempt(
      { kind: 'numeric', submitted: 10, expected: 3, operands: OPS },
      CHANGE_CATALOG,
    );
    expect(res.misconceptionCode).toBe('returns-payment');
  });

  it('a plain wrong answer matches no pattern and carries no diagnosis', () => {
    const res = checkAttempt(
      { kind: 'numeric', submitted: 5, expected: 3, operands: OPS },
      CHANGE_CATALOG,
    );
    expect(res.correct).toBe(false);
    expect(res.misconceptionCode).toBeNull();
  });

  it('a pattern that would predict the CORRECT answer never fires', () => {
    // If a-b equals expected, the a-b "misconception" is not a misconception.
    const catalog: MisconceptionDef[] = [
      { id: 'x', code: 'subtracts', distractorPatterns: { numeric: ['b-a'] } },
    ];
    const res = checkAttempt(
      { kind: 'numeric', submitted: 3, expected: 3, operands: OPS },
      catalog,
    );
    expect(res.correct).toBe(true);
  });

  it('relational patterns fire on the submitted value (overshoot)', () => {
    const catalog: MisconceptionDef[] = [
      { id: 'y', code: 'overshoots-target', distractorPatterns: { numeric: ['gt_target'] } },
    ];
    const res = checkAttempt(
      { kind: 'numeric', submitted: 12, expected: 10, operands: { target: 10 } },
      catalog,
    );
    expect(res.misconceptionCode).toBe('overshoots-target');
  });

  it('an unknown pattern is skipped, never guessed', () => {
    const catalog: MisconceptionDef[] = [
      { id: 'z', code: 'weird', distractorPatterns: { numeric: ['made-up-pattern'] } },
    ];
    const res = checkAttempt(
      { kind: 'numeric', submitted: 5, expected: 3, operands: OPS },
      catalog,
    );
    expect(res.misconceptionCode).toBeNull();
  });

  it('option attempts match by distractor tag', () => {
    const catalog: MisconceptionDef[] = [
      { id: 'w', code: 'revenue-as-profit', distractorPatterns: { option_tags: ['revenue-as-profit'] } },
    ];
    const wrong = checkAttempt(
      { kind: 'option', correct: false, chosenTags: ['revenue-as-profit'] },
      catalog,
    );
    expect(wrong.misconceptionCode).toBe('revenue-as-profit');
    const untagged = checkAttempt({ kind: 'option', correct: false, chosenTags: [] }, catalog);
    expect(untagged.misconceptionCode).toBeNull();
    const right = checkAttempt({ kind: 'option', correct: true, chosenTags: [] }, catalog);
    expect(right.correct).toBe(true);
  });

  it('money tolerance forgives float dust, not real differences', () => {
    const res = checkAttempt(
      { kind: 'numeric', submitted: 3.499999999, expected: 3.5, operands: {}, toleranceCents: 0 },
      [],
    );
    expect(res.correct).toBe(true);
    const off = checkAttempt(
      { kind: 'numeric', submitted: 3.4, expected: 3.5, operands: {}, toleranceCents: 0 },
      [],
    );
    expect(off.correct).toBe(false);
  });
});
