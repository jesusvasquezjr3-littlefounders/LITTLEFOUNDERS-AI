import { describe, it, expect } from 'vitest';
import { resolveOptions } from '@/components/lessons/engine/activities/optionSource';

describe('resolveOptions', () => {
    it('returns [] for empty/invalid content', () => {
        expect(resolveOptions(null)).toEqual([]);
        expect(resolveOptions({})).toEqual([]);
    });

    it('reads an array under content.options preserving ids', () => {
        const r = resolveOptions({ options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] });
        expect(r.map(o => o.id)).toEqual(['a', 'b']);
        expect(r[0].text).toBe('A');
    });

    it('honors preferKeys before default keys', () => {
        const r = resolveOptions(
            { items: [{ id: 'x' }], offers: [{ id: 'o1', name: 'Offer 1' }] },
            ['offers'],
        );
        expect(r.map(o => o.id)).toEqual(['o1']);
        expect(r[0].text).toBe('Offer 1');
    });

    it('synthesizes A/B ids for pairwise optionA/optionB', () => {
        const r = resolveOptions({ optionA: { text: 'Buy' }, optionB: { text: 'Rent' } });
        expect(r.map(o => o.id)).toEqual(['A', 'B']);
        expect(r.map(o => o.text)).toEqual(['Buy', 'Rent']);
    });

    it('synthesizes A/B for strategy_a/strategy_b but keeps explicit ids when present', () => {
        const r = resolveOptions({ strategy_a: { id: 'snowball', text: 'Snowball' }, strategy_b: { id: 'avalanche', text: 'Avalanche' } });
        expect(r.map(o => o.id)).toEqual(['snowball', 'avalanche']);
    });

    it('falls back to text for string options', () => {
        const r = resolveOptions({ choices: ['Yes', 'No'] });
        expect(r.map(o => o.text)).toEqual(['Yes', 'No']);
    });
});
