import { describe, it, expect } from 'vitest';
import { validateAnswer } from '@/components/lessons/engine/hooks/useLessonState';

// Helper: build a minimal exercise object accepted by validateAnswer.
const ex = (type: string, content: any, correct_answer: any) =>
    ({ id: 1, type, content, correct_answer } as any);

// Each case mirrors a REAL correct_answer shape from the lesson corpus
// (backend/lesson_engine/littlefounders_lessons) confirmed by the 2026-06-16 audit.

describe('validateAnswer — option-based (regression)', () => {
    it('multiple_choice {correctOptionId}', () => {
        const e = ex('multiple_choice', { options: [{ id: 'a' }, { id: 'b' }] }, { correctOptionId: 'a' });
        expect(validateAnswer(e, 'a')).toBe(true);
        expect(validateAnswer(e, 'b')).toBe(false);
    });
    it('multiple_choice {correctOptionIds} multi-answer', () => {
        const e = ex('multiple_choice', { options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, { correctOptionIds: ['a', 'b'] });
        expect(validateAnswer(e, ['a', 'b'])).toBe(true);
        expect(validateAnswer(e, ['a'])).toBe(false);
    });
    it('true_false {isTrue}', () => {
        const e = ex('true_false', { statement: 'x' }, { isTrue: false });
        expect(validateAnswer(e, false)).toBe(true);
        expect(validateAnswer(e, true)).toBe(false);
    });
    it('salary_comparison {correctOption} (was false negative)', () => {
        const e = ex('salary_comparison', { options: [{ id: 'A' }, { id: 'B' }] }, { correctOption: 'A', explanationKey: 'x' });
        expect(validateAnswer(e, 'A')).toBe(true);
        expect(validateAnswer(e, 'B')).toBe(false);
    });
});

describe('validateAnswer — spot_trap (headline false-negative fix)', () => {
    it('{correctOptionId} in options-fallback mode', () => {
        const e = ex('spot_trap', { options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, { correctOptionId: 'a' });
        expect(validateAnswer(e, ['a'])).toBe(true);
        expect(validateAnswer(e, ['b'])).toBe(false);
    });
    it('{targetId} single id', () => {
        const e = ex('spot_trap', { statements: [{ id: 's1' }, { id: 's2' }] }, { targetId: 's2' });
        expect(validateAnswer(e, ['s2'])).toBe(true);
        expect(validateAnswer(e, ['s1'])).toBe(false);
    });
    it('{trapId} single id', () => {
        const e = ex('spot_trap', { messages: [{ id: 'm1' }, { id: 'm2' }] }, { trapId: 'm2' });
        expect(validateAnswer(e, ['m2'])).toBe(true);
    });
    it('{incorrectStatementId} single id', () => {
        const e = ex('spot_trap', { statements: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] }, { incorrectStatementId: 's3' });
        expect(validateAnswer(e, ['s3'])).toBe(true);
        expect(validateAnswer(e, ['s1'])).toBe(false);
    });
    it('{correctTrapIds} array set-equality', () => {
        const e = ex('spot_trap', { messages: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] }, { correctTrapIds: ['t1', 't2'] });
        expect(validateAnswer(e, ['t1', 't2'])).toBe(true);
        expect(validateAnswer(e, ['t1'])).toBe(false);
    });
    it('{correctOptionIds} array', () => {
        const e = ex('spot_trap', { options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, { correctOptionIds: ['a', 'c'] });
        expect(validateAnswer(e, ['a', 'c'])).toBe(true);
    });
    it('fallback from content.isTrap flags', () => {
        const e = ex('spot_trap', { statements: [{ id: 's1', isTrap: false }, { id: 's2', isTrap: true }] }, {});
        expect(validateAnswer(e, ['s2'])).toBe(true);
        expect(validateAnswer(e, ['s1'])).toBe(false);
    });
});

describe('validateAnswer — classification (array-of-objects & name keys)', () => {
    const content = {
        items: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }, { id: 'i4' }],
        categories: [{ id: 'cat1', name: 'ETF' }, { id: 'cat2', name: 'Acción Individual' }],
    };
    const correctMap = { i1: 'cat1', i2: 'cat2', i3: 'cat1', i4: 'cat2' };
    const wrongMap = { i1: 'cat2', i2: 'cat1', i3: 'cat1', i4: 'cat2' };

    it('direct {itemId:catId}', () => {
        const e = ex('classification', content, { i1: 'cat1', i2: 'cat2', i3: 'cat1', i4: 'cat2' });
        expect(validateAnswer(e, correctMap)).toBe(true);
        expect(validateAnswer(e, wrongMap)).toBe(false);
    });
    it('inverted {catId:[itemIds]}', () => {
        const e = ex('classification', content, { cat1: ['i1', 'i3'], cat2: ['i2', 'i4'] });
        expect(validateAnswer(e, correctMap)).toBe(true);
        expect(validateAnswer(e, wrongMap)).toBe(false);
    });
    it('{categoryAssignments:[{itemId,categoryId}]} (was mangled → false negative)', () => {
        const e = ex('classification', content, {
            categoryAssignments: [
                { itemId: 'i1', categoryId: 'cat1' }, { itemId: 'i2', categoryId: 'cat2' },
                { itemId: 'i3', categoryId: 'cat1' }, { itemId: 'i4', categoryId: 'cat2' },
            ],
        });
        expect(validateAnswer(e, correctMap)).toBe(true);
        expect(validateAnswer(e, wrongMap)).toBe(false);
    });
    it('{matches:[{itemId,categoryId}]}', () => {
        const e = ex('classification', content, {
            matches: [
                { itemId: 'i1', categoryId: 'cat1' }, { itemId: 'i2', categoryId: 'cat2' },
                { itemId: 'i3', categoryId: 'cat1' }, { itemId: 'i4', categoryId: 'cat2' },
            ],
        });
        expect(validateAnswer(e, correctMap)).toBe(true);
        expect(validateAnswer(e, wrongMap)).toBe(false);
    });
    it('inverted with category NAME keys → resolved to cat.id', () => {
        const e = ex('classification', content, { ETF: ['i1', 'i3'], 'Acción Individual': ['i2', 'i4'] });
        expect(validateAnswer(e, correctMap)).toBe(true);
        expect(validateAnswer(e, wrongMap)).toBe(false);
    });
    it('nested {classifications:{catId:[itemIds]}}', () => {
        const e = ex('classification', content, { classifications: { cat1: ['i1', 'i3'], cat2: ['i2', 'i4'] } });
        expect(validateAnswer(e, correctMap)).toBe(true);
    });
});

describe('validateAnswer — quiz_battle (unreachable threshold fix)', () => {
    it('single-question reachable at 100', () => {
        const e = ex('quiz_battle', { question: 'q', options: [{ id: 'a' }] }, { correctOptionId: 'a' });
        expect(validateAnswer(e, 100)).toBe(true);
        expect(validateAnswer(e, 0)).toBe(false);
    });
    it('multi-question threshold scales with question count', () => {
        const e = ex('quiz_battle', { questions: [{}, {}, {}] }, null);
        expect(validateAnswer(e, 300)).toBe(true);
        expect(validateAnswer(e, 200)).toBe(false);
    });
});

describe('validateAnswer — estimation_slider (range shapes)', () => {
    it('{range:[min,max]} array (was false positive accepting everything)', () => {
        const e = ex('estimation_slider', {}, { range: [28, 32] });
        expect(validateAnswer(e, 30)).toBe(true);
        expect(validateAnswer(e, 40)).toBe(false);
    });
    it('{min,max} top-level', () => {
        const e = ex('estimation_slider', {}, { min: 22, max: 22 });
        expect(validateAnswer(e, 22)).toBe(true);
        expect(validateAnswer(e, 23)).toBe(false);
    });
    it('{value,tolerance}', () => {
        const e = ex('estimation_slider', {}, { value: 70, tolerance: 3 });
        expect(validateAnswer(e, 71)).toBe(true);
        expect(validateAnswer(e, 80)).toBe(false);
    });
    it('content.correctRange with null correct_answer', () => {
        const e = ex('estimation_slider', { correctRange: { min: 55, max: 65 } }, null);
        expect(validateAnswer(e, 60)).toBe(true);
        expect(validateAnswer(e, 70)).toBe(false);
    });
    it('correctRangeId against content.ranges', () => {
        const e = ex('estimation_slider', { ranges: [{ id: 'r1', min: 0, max: 30 }, { id: 'r2', min: 30, max: 40 }] }, { correctRangeId: 'r2' });
        expect(validateAnswer(e, 35)).toBe(true);
        expect(validateAnswer(e, 10)).toBe(false);
    });
});

describe('validateAnswer — shop_sim (id-set shapes)', () => {
    it('{selectedIds} multi-select', () => {
        const e = ex('shop_sim', { products: [{ id: 'prod2' }, { id: 'prod4' }, { id: 'prod1' }] }, { selectedIds: ['prod2', 'prod4'] });
        expect(validateAnswer(e, ['prod2', 'prod4'])).toBe(true);
        expect(validateAnswer(e, ['prod2'])).toBe(false);
    });
    it('{selectedProductId} single', () => {
        const e = ex('shop_sim', { products: [{ id: 'prod2' }] }, { selectedProductId: 'prod2' });
        expect(validateAnswer(e, ['prod2'])).toBe(true);
    });
    it('{validCombinations}', () => {
        const e = ex('shop_sim', { products: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }, { id: 'i4' }], budget: 80 },
            { validCombinations: [['i1', 'i3'], ['i2', 'i3'], ['i4']] });
        expect(validateAnswer(e, ['i4'])).toBe(true);
        expect(validateAnswer(e, ['i1', 'i3'])).toBe(true);
        expect(validateAnswer(e, ['i1', 'i2'])).toBe(false);
    });
});

describe('validateAnswer — portfolio_builder OPTIONS mode (wrapped object)', () => {
    it('accepts { [optionId]: 100 } against {correctOptionId}', () => {
        const e = ex('portfolio_builder', { options: [{ id: 'plan_a' }, { id: 'plan_b' }] }, { correctOptionId: 'plan_b' });
        expect(validateAnswer(e, { plan_b: 100 })).toBe(true);
        expect(validateAnswer(e, { plan_a: 100 })).toBe(false);
    });
    it('assets mode still requires sum ~100', () => {
        const e = ex('portfolio_builder', { assets: [{ id: 'a' }, { id: 'b' }] }, null);
        expect(validateAnswer(e, { a: 60, b: 40 })).toBe(true);
        expect(validateAnswer(e, { a: 60, b: 10 })).toBe(false);
    });
});

describe('validateAnswer — mindset_comparison (id-scheme tolerance)', () => {
    it('{correctOptionId:"mindsetB"} vs component id "B"', () => {
        const e = ex('mindset_comparison', { mindsetA: {}, mindsetB: {} }, { correctOptionId: 'mindsetB' });
        expect(validateAnswer(e, 'B')).toBe(true);
        expect(validateAnswer(e, 'A')).toBe(false);
    });
    it('{correctMindset:"B"}', () => {
        const e = ex('mindset_comparison', { mindsetA: {}, mindsetB: {} }, { correctMindset: 'B' });
        expect(validateAnswer(e, 'B')).toBe(true);
        expect(validateAnswer(e, 'A')).toBe(false);
    });
});

describe('validateAnswer — emergency_fund (id-keyed, exploratory)', () => {
    const content = {
        initialFund: 5000,
        events: [
            { id: 'e1', options: [{ id: 'o1', cost: 1000 }, { id: 'o2', cost: 3000 }] },
            { id: 'e2', options: [{ id: 'o1', cost: 2000 }, { id: 'o2', cost: 6000 }] },
        ],
    };
    it('balance stays >= 0 when decisions keyed by event.id', () => {
        expect(validateAnswer(ex('emergency_fund', content, null), { e1: 'o1', e2: 'o1' })).toBe(true);
    });
    it('balance goes negative → fail', () => {
        expect(validateAnswer(ex('emergency_fund', content, null), { e1: 'o2', e2: 'o2' })).toBe(false);
    });
});

describe('validateAnswer — mystery_investment / interest_calculator (exploratory)', () => {
    it('mystery_investment requires >=1 box (no minBoxes default of 2)', () => {
        expect(validateAnswer(ex('mystery_investment', {}, null), { b1: 5 })).toBe(true);
        expect(validateAnswer(ex('mystery_investment', {}, null), { b1: 0 })).toBe(false);
    });
    it('mystery_investment honors explicit minBoxes', () => {
        expect(validateAnswer(ex('mystery_investment', {}, { minBoxes: 2 }), { b1: 5 })).toBe(false);
        expect(validateAnswer(ex('mystery_investment', {}, { minBoxes: 2 }), { b1: 5, b2: 5 })).toBe(true);
    });
    it('interest_calculator accepts {principal,rate,time} object', () => {
        expect(validateAnswer(ex('interest_calculator', {}, { value: 10226 }), { principal: 10000, rate: 5, time: 1 })).toBe(true);
    });
});

describe('validateAnswer — goal_roadmap content.correct_sequence', () => {
    it('orders via content.correct_sequence positions', () => {
        const content = {
            available_actions: [{ id: 'act1' }, { id: 'act2' }, { id: 'act3' }, { id: 'act4' }],
            correct_sequence: [
                { actionId: 'act3', position: 1 }, { actionId: 'act1', position: 2 },
                { actionId: 'act2', position: 3 }, { actionId: 'act4', position: 4 },
            ],
        };
        const e = ex('goal_roadmap', content, null);
        expect(validateAnswer(e, ['act3', 'act1', 'act2', 'act4'])).toBe(true);
        expect(validateAnswer(e, ['act1', 'act2', 'act3', 'act4'])).toBe(false);
    });
});

describe('validateAnswer — fill_blank (multiple formats)', () => {
    it('free-text {text}', () => {
        const e = ex('fill_blank', { statement: 'La ___ importa' }, { text: 'diferencia' });
        expect(validateAnswer(e, 'diferencia')).toBe(true);
        expect(validateAnswer(e, 'otra')).toBe(false);
    });
    it('null correct_answer with content.blanks[].correctText', () => {
        const e = ex('fill_blank', { statement: 'x', blanks: [{ id: 'b1', correctText: 'interés' }] }, null);
        expect(validateAnswer(e, 'interés')).toBe(true);
        expect(validateAnswer(e, 'capital')).toBe(false);
    });
    it('{blanks:[{id,text}]} as free-text combined', () => {
        const e = ex('fill_blank', { statement: 'x' }, { blanks: [{ id: 'b1', text: 'entender' }, { id: 'b2', text: 'presupuesto' }] });
        expect(validateAnswer(e, 'entender presupuesto')).toBe(true);
    });
    it('{blank1,blank2} multi-key free-text', () => {
        const e = ex('fill_blank', { statement: 'x' }, { blank1: 'sueldo', blank2: 'regularmente' });
        expect(validateAnswer(e, 'sueldo regularmente')).toBe(true);
    });
    it('word-bank: {blankId:wordId} resolved via content.options to text', () => {
        const content = { statement: 'La ____ y el ____', options: [{ id: 'w1', text: 'entender' }, { id: 'w2', text: 'presupuesto' }, { id: 'w3', text: 'gastar' }] };
        const e = ex('fill_blank', content, { blanks: [{ id: 'b1', text: 'entender' }, { id: 'b2', text: 'presupuesto' }] });
        expect(validateAnswer(e, { 0: 'w1', 1: 'w2' })).toBe(true);
        expect(validateAnswer(e, { 0: 'w3', 1: 'w2' })).toBe(false);
    });
});

describe('validateAnswer — regression (already-passing types)', () => {
    it('sequencing {sequence}', () => {
        const e = ex('sequencing', { items: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] }, { sequence: ['s1', 's2', 's3'] });
        expect(validateAnswer(e, ['s1', 's2', 's3'])).toBe(true);
        expect(validateAnswer(e, ['s2', 's1', 's3'])).toBe(false);
    });
    it('tap_action via items.isTarget', () => {
        const e = ex('tap_action', { items: [{ id: 'i1', isTarget: false }, { id: 'i2', isTarget: true }, { id: 'i4', isTarget: true }] }, { targetIds: ['i2', 'i4'] });
        expect(validateAnswer(e, ['i2', 'i4'])).toBe(true);
        expect(validateAnswer(e, ['i1'])).toBe(false);
    });
    it('matching_pairs (self-validating)', () => {
        expect(validateAnswer(ex('matching_pairs', {}, null), true)).toBe(true);
    });
    it('intro_narrative always true', () => {
        expect(validateAnswer(ex('intro_narrative', {}, null), null)).toBe(true);
    });
});
