import { describe, expect, it } from 'vitest';
import { dPrime, gradeV2Response, parseLocaleNumber, sameAnswer, scoreV2Visual, v2DiagnosticFamily } from '../services/v2VisualScorer.js';

/*
 * GAP-FIX-R1 learning: the first-release logic and money families (Appendix
 * P Part 8), the formerly ungraded visuals (Parts 1, 4.2, 7), the locale
 * number parser (Part 5) and the closed diagnostic codes (Part 4.5).
 */

describe('locale numbers (Appendix P Part 5)', () => {
  it('parses each launch locale to one canonical decimal and refuses ambiguity', () => {
    expect(parseLocaleNumber('12.5', 'en-US')).toBe('12.5');
    expect(parseLocaleNumber('12.50', 'en-US')).toBe('12.5');
    expect(parseLocaleNumber('1,234.5', 'es-MX')).toBe('1234.5');
    expect(parseLocaleNumber('12,5', 'pt-BR')).toBe('12.5');
    expect(parseLocaleNumber('1.234,50', 'pt-BR')).toBe('1234.5');
    expect(parseLocaleNumber('-3', 'en-US')).toBe('-3');
    expect(parseLocaleNumber('007', 'en-US')).toBe('7');
    for (const [text, locale] of [['12,5', 'en-US'], ['1,23.4', 'en-US'], ['12.5', 'pt-BR'], ['', 'en-US'], ['1e3', 'es-MX'], ['abc', 'pt-BR']] as const) {
      expect(parseLocaleNumber(text, locale), `${text} in ${locale}`).toBeNull();
    }
  });

  it('compares answers as exact rationals, text only when not numeric', () => {
    expect(sameAnswer('12.5', '12.50')).toBe(true);
    expect(sameAnswer('1/2', '0.5')).toBe(true);
    expect(sameAnswer('40', '40.0')).toBe(true);
    expect(sameAnswer('0.1', '0.10000000001')).toBe(false);
    expect(sameAnswer('Sale price', 'sale price')).toBe(true);
  });

  it('marks a pt-BR "12,5" typed answer met once canonicalised (the old raw-match bug)', () => {
    const payload = { response_step_ids: ['step-two', 'step-three'] };
    const rubric = { expectedValues: { 'step-two': '12.5', 'step-three': '25' } };
    const values = { 'step-two': parseLocaleNumber('12,5', 'pt-BR')!, 'step-three': parseLocaleNumber('25,00', 'pt-BR')! };
    expect(scoreV2Visual('math.worked-example.v2', payload, { values }, rubric)).toBe('met');
    expect(gradeV2Response('math.worked-example.v2', payload, { values: { ...values, 'step-three': '24' } }, rubric).diagnostic).toBe('partial');
  });
});

describe('formerly ungraded visuals are server-graded with impossible-state rejection', () => {
  it('M5 place value grades the trade sequence and the digits', () => {
    // The 10-29 pilot: loose ones traded for tens.
    const payload = { mode: 'compose', hundreds: 0, tens: 0, ones: 23, subtrahend: 0 };
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: ['ten', 'ten'], hundreds: '0', tens: '2', ones: '3' }, { trades: 2 })).toBe('met');
    expect(gradeV2Response('math.place-value.v2', payload, { trades: ['ten'], hundreds: '0', tens: '1', ones: '13' }, { trades: 2 }).diagnostic).toBe('structure');
    expect(gradeV2Response('math.place-value.v2', payload, { trades: ['ten', 'ten'], hundreds: '0', tens: '2', ones: '4' }, { trades: 2 }).diagnostic).toBe('value');
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: ['ten', 'ten', 'ten'], hundreds: '0', tens: '3', ones: '0' }, { trades: 2 })).toBe('invalid');
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: ['ten', 'ten'], hundreds: '0', tens: '2', ones: '3' }, { trades: 1 })).toBe('invalid');
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: ['borrow-ten'], hundreds: '0', tens: '0', ones: '23' })).toBe('invalid');
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: 2, hundreds: '0', tens: '2', ones: '3' })).toBe('invalid');
  });

  it('M5 composes three places: ten ones for a ten, ten tens for a hundred (GAP-FIX-R2)', () => {
    const payload = { mode: 'compose', hundreds: 1, tens: 12, ones: 15, subtrahend: 0 }; // 235
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: ['ten', 'hundred'], hundreds: '2', tens: '3', ones: '5' }, { trades: 2 })).toBe('met');
    expect(gradeV2Response('math.place-value.v2', payload, { trades: ['ten'], hundreds: '1', tens: '13', ones: '5' }, { trades: 2 }).diagnostic).toBe('structure');
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: ['hundred', 'hundred'], hundreds: '3', tens: '0', ones: '15' })).toBe('invalid');
    expect(scoreV2Visual('math.place-value.v2', { ...payload, subtrahend: 5 }, { trades: [], hundreds: '0', tens: '0', ones: '0' })).toBe('invalid');
  });

  it('M5 replays a subtraction with borrows: 1.00 - 0.37 as 100 - 37 cents (GAP-FIX-R2)', () => {
    const payload = { mode: 'subtract', hundreds: 1, tens: 0, ones: 0, subtrahend: 37 };
    const borrows = ['borrow-hundred', 'borrow-ten'];
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: borrows, hundreds: '0', tens: '6', ones: '3' }, { trades: 2 })).toBe('met');
    expect(gradeV2Response('math.place-value.v2', payload, { trades: ['borrow-hundred'], hundreds: '0', tens: '7', ones: '0' }, { trades: 2 }).diagnostic).toBe('structure');
    expect(gradeV2Response('math.place-value.v2', payload, { trades: borrows, hundreds: '0', tens: '7', ones: '3' }, { trades: 2 }).diagnostic).toBe('value');
    // A borrow with nothing to borrow from, or an up-trade in a subtraction, is impossible.
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: ['borrow-ten'], hundreds: '0', tens: '0', ones: '0' })).toBe('invalid');
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: ['ten'], hundreds: '0', tens: '0', ones: '0' })).toBe('invalid');
    // The rubric's count must be the fewest borrows the subtraction needs.
    expect(scoreV2Visual('math.place-value.v2', payload, { trades: borrows, hundreds: '0', tens: '6', ones: '3' }, { trades: 3 })).toBe('invalid');
  });

  it('M14 ratio table grades the pair and the missing value', () => {
    const payload = { itemsPerPack: 3, pricePerPack: 15, minimumPacks: 1, maximumPacks: 4 };
    expect(scoreV2Visual('math.ratio-table.v2', payload, { packs: 3, price: '45' }, { target_packs: 3 })).toBe('met');
    expect(scoreV2Visual('math.ratio-table.v2', payload, { packs: 3, price: '40' }, { target_packs: 3 })).toBe('review');
    expect(scoreV2Visual('math.ratio-table.v2', payload, { packs: 5, price: '75' }, { target_packs: 3 })).toBe('invalid');
  });

  it('M15 percent grid snaps to the step and checks the amount', () => {
    const payload = { baseUnits: 200, step: 5 };
    expect(scoreV2Visual('visual.percent-grid.v2', payload, { percent: 25, amount: '50' }, { target_percent: 25 })).toBe('met');
    expect(scoreV2Visual('visual.percent-grid.v2', payload, { percent: 27, amount: '54' }, { target_percent: 25 })).toBe('invalid');
    expect(gradeV2Response('visual.percent-grid.v2', payload, { percent: 20, amount: '40' }, { target_percent: 25 }).diagnostic).toBe('structure');
  });

  it('M19 grades a committed prediction within the private tolerance', () => {
    const payload = { principalMinor: 10_000, minimumRateBps: 100, maximumRateBps: 1_000, rateStepBps: 100, minimumYears: 1, maximumYears: 10,
      yearStep: 1, predictionStepMinor: 100, predictionMaximumMinor: 30_000 };
    // 10,000 at 5% for 10 years compounds to 16,289.
    expect(scoreV2Visual('visual.growth-comparison.v2', payload, { rateBps: 500, years: 10, predictionMinor: 16_300 }, { tolerance_minor: 100 })).toBe('met');
    expect(gradeV2Response('visual.growth-comparison.v2', payload, { rateBps: 500, years: 10, predictionMinor: 15_000 }, { tolerance_minor: 100 }).diagnostic).toBe('tolerance');
    expect(scoreV2Visual('visual.growth-comparison.v2', payload, { rateBps: 550, years: 10, predictionMinor: 16_300 }, { tolerance_minor: 100 })).toBe('invalid');
  });

  it('M20 grades tax owed and the marginal rate', () => {
    const payload = { minimumIncomeMinor: 0, maximumIncomeMinor: 100_000, incomeStepMinor: 1_000,
      brackets: [{ upToMinor: 20_000, rateBasisPoints: 0 }, { upToMinor: 50_000, rateBasisPoints: 1_000 }, { upToMinor: null, rateBasisPoints: 2_000 }] };
    expect(scoreV2Visual('visual.tax-bracket.v2', payload, { incomeMinor: 60_000, taxMinor: '5000', marginalBps: 2_000 }, { income_minor: 60_000 })).toBe('met');
    expect(gradeV2Response('visual.tax-bracket.v2', payload, { incomeMinor: 60_000, taxMinor: '5000', marginalBps: 1_000 }, { income_minor: 60_000 }).diagnostic).toBe('partial');
  });

  it('L2 compiles the learner rule and runs it on held-out cases (Part 4.6)', () => {
    const payload = { goal: 20 };
    const rubric = { comparator: '>=', threshold: 20, link: 'and', held_out: [
      { saved: 25, goal_day: true }, { saved: 19, goal_day: true }, { saved: 30, goal_day: false }, { saved: 20, goal_day: true }] };
    // Semantically the same rule written differently is met.
    expect(scoreV2Visual('logic.savings-rule.v2', payload, { comparator: '>', threshold: 19, link: 'and' }, rubric)).toBe('met');
    expect(gradeV2Response('logic.savings-rule.v2', payload, { comparator: '>=', threshold: 20, link: 'or' }, rubric).diagnostic).toBe('structure');
    expect(scoreV2Visual('logic.savings-rule.v2', payload, { comparator: '>=', threshold: 20, link: 'and' },
      { ...rubric, held_out: [{ saved: 25, goal_day: true }, { saved: 30, goal_day: true }] })).toBe('invalid');
  });

  it('keeps the running ledger conserved and the goal bullet on its grid', () => {
    const ledger = { initial: 10, sale: 6, cost: 4, maxEntries: 4 };
    expect(scoreV2Visual('money.running-ledger.v2', ledger, { entries: ['sale', 'sale', 'cost'], balance: '18' }, { target_balance: 18 })).toBe('met');
    expect(gradeV2Response('money.running-ledger.v2', ledger, { entries: ['sale', 'sale', 'cost'], balance: '17' }, { target_balance: 18 }).diagnostic).toBe('value');
    expect(scoreV2Visual('money.running-ledger.v2', ledger, { entries: ['sale', 'sale', 'sale', 'sale', 'cost'], balance: '30' }, { target_balance: 18 })).toBe('invalid');
    expect(scoreV2Visual('visual.goal-bullet.v2', { minimum: 0, maximum: 100, step: 5 }, { value: 60 }, { minimum_value: 50 })).toBe('met');
    expect(scoreV2Visual('visual.goal-bullet.v2', { minimum: 0, maximum: 100, step: 5 }, { value: 62 }, { minimum_value: 50 })).toBe('invalid');
  });
});

describe('first-release logic and money families (Appendix P Part 8)', () => {
  it('L1 grades the flipped-card set', () => {
    const payload = { cardIds: ['card-even', 'card-odd', 'card-red', 'card-blue'] };
    const rubric = { must_flip_ids: ['card-even', 'card-blue'] };
    expect(scoreV2Visual('logic.rule-checker.v2', payload, { flipped: ['card-blue', 'card-even'] }, rubric)).toBe('met');
    expect(gradeV2Response('logic.rule-checker.v2', payload, { flipped: ['card-even', 'card-red'] }, rubric).diagnostic).toBe('partial');
    expect(gradeV2Response('logic.rule-checker.v2', payload, { flipped: ['card-even'] }, rubric).diagnostic).toBe('miss');
    expect(scoreV2Visual('logic.rule-checker.v2', payload, { flipped: ['card-green'] }, rubric)).toBe('invalid');
    expect(scoreV2Visual('logic.rule-checker.v2', payload, { flipped: ['card-even'] }, { must_flip_ids: payload.cardIds })).toBe('invalid');
  });

  it('L5 rejects impossible Euler regions for the declared relation', () => {
    const payload = { relation: 'subset', itemIds: ['item-dog', 'item-cat', 'item-car'] };
    const rubric = { regions: { 'item-dog': 'both', 'item-cat': 'second', 'item-car': 'neither' } };
    expect(scoreV2Visual('logic.euler.v2', payload, { placements: { 'item-dog': 'both', 'item-cat': 'second', 'item-car': 'neither' } }, rubric)).toBe('met');
    expect(scoreV2Visual('logic.euler.v2', payload, { placements: { 'item-dog': 'first', 'item-cat': 'second', 'item-car': 'neither' } }, rubric)).toBe('invalid');
  });

  it('L6 / $9 grade path and outcome per scenario and refuse impossible walks', () => {
    const payload = { start: 'q-need', nodes: [
      { id: 'q-need', yes: 'q-money', no: 'out-wait' }, { id: 'q-money', yes: 'out-buy', no: 'out-save' },
      { id: 'out-wait' }, { id: 'out-buy' }, { id: 'out-save' }], scenarioIds: ['case-shoes'] };
    const rubric = { paths: { 'case-shoes': ['q-need', 'q-money', 'out-save'] } };
    expect(scoreV2Visual('money.spend-decision.v2', payload, { paths: { 'case-shoes': ['q-need', 'q-money', 'out-save'] } }, rubric)).toBe('met');
    expect(gradeV2Response('money.spend-decision.v2', payload, { paths: { 'case-shoes': ['q-need', 'out-wait'] } }, rubric).diagnostic).toBe('outcome');
    expect(scoreV2Visual('logic.flowchart.v2', payload, { paths: { 'case-shoes': ['q-need', 'out-save'] } }, rubric)).toBe('invalid');
  });

  it('L10 / $10 grade (bin, reason) pairs including the it-depends bin', () => {
    const payload = { binIds: ['bin-need', 'bin-want', 'bin-depends'], itemIds: ['item-water', 'item-game'], reasonIds: ['why-health', 'why-fun'] };
    const rubric = { accepted: { 'item-water': [{ bin: 'bin-need', reason: 'why-health' }], 'item-game': [{ bin: 'bin-want', reason: 'why-fun' }, { bin: 'bin-depends', reason: 'why-fun' }] } };
    expect(scoreV2Visual('money.needs-wants.v2', payload, { placements: { 'item-water': { bin: 'bin-need', reason: 'why-health' }, 'item-game': { bin: 'bin-depends', reason: 'why-fun' } } }, rubric)).toBe('met');
    expect(gradeV2Response('money.needs-wants.v2', payload, { placements: { 'item-water': { bin: 'bin-need', reason: 'why-fun' }, 'item-game': { bin: 'bin-want', reason: 'why-fun' } } }, rubric).diagnostic).toBe('reason');
    expect(gradeV2Response('logic.sort-by-rule.v2', payload, { placements: { 'item-water': { bin: 'bin-want', reason: 'why-health' }, 'item-game': { bin: 'bin-want', reason: 'why-fun' } } }, rubric).diagnostic).toBe('bin');
  });

  it('L12 / $11 report hits, false alarms and d′; genuine messages must exist', () => {
    const payload = { messageIds: ['msg-prize', 'msg-grandma', 'msg-bank', 'msg-school'] };
    const rubric = { scam_ids: ['msg-prize', 'msg-bank'] };
    const perfect = gradeV2Response('money.scam-check.v2', payload, { flagged: ['msg-prize', 'msg-bank'] }, rubric);
    expect(perfect.verdict).toBe('met');
    expect(perfect.detection).toEqual({ hits: 2, misses: 0, false_alarms: 0, correct_rejections: 2 });
    const alarm = gradeV2Response('logic.scam-spotter.v2', payload, { flagged: ['msg-prize', 'msg-bank', 'msg-school'] }, rubric);
    expect(alarm.diagnostic).toBe('false_alarm');
    expect(dPrime(perfect.detection!)).toBeGreaterThan(dPrime(alarm.detection!));
    expect(scoreV2Visual('money.scam-check.v2', payload, { flagged: [] }, { scam_ids: payload.messageIds })).toBe('invalid');
  });

  it('$1 / $2 use integer minor units with conservation', () => {
    const tray = { denominations: [{ value: 25, available: 3 }, { value: 10, available: 3 }, { value: 5, available: 3 }, { value: 1, available: 5 }] };
    expect(scoreV2Visual('money.coin-tray.v2', tray, { counts: { 25: 1, 10: 1, 5: 0, 1: 2 } }, { target_minor: 37, fewest: true })).toBe('met');
    expect(gradeV2Response('money.coin-tray.v2', tray, { counts: { 25: 0, 10: 3, 5: 1, 1: 2 } }, { target_minor: 37, fewest: true }).diagnostic).toBe('partial');
    expect(scoreV2Visual('money.coin-tray.v2', tray, { counts: { 25: 4, 10: 0, 5: 0, 1: 0 } }, { target_minor: 37, fewest: false })).toBe('invalid');
    const change = { ...tray, price: 63, paid: 100 };
    expect(scoreV2Visual('money.making-change.v2', change, { counts: { 25: 1, 10: 1, 5: 0, 1: 2 } }, { change_minor: 37 })).toBe('met');
    expect(scoreV2Visual('money.making-change.v2', change, { counts: { 25: 1, 10: 1, 5: 0, 1: 2 } }, { change_minor: 36 })).toBe('invalid');
  });

  it('story choices are graded by id only', () => {
    const payload = { choiceIds: ['choice-share', 'choice-keep'] };
    expect(scoreV2Visual('story.would-you-rather.v2', payload, { choice: 'choice-keep' }, { acceptable_choice_ids: ['choice-share', 'choice-keep'] })).toBe('met');
    expect(scoreV2Visual('story.branch.v2', payload, { choice: 'choice-steal' }, { acceptable_choice_ids: ['choice-share'] })).toBe('invalid');
  });

  it('splits diagnostics into structure and answer families', () => {
    expect(v2DiagnosticFamily('structure')).toBe('structure');
    expect(v2DiagnosticFamily('bin')).toBe('structure');
    expect(v2DiagnosticFamily('value')).toBe('answer');
    expect(v2DiagnosticFamily('none')).toBeNull();
  });
});
