import { describe, it, expect } from 'vitest';
import { extractCorrectId } from '@/components/lessons/engine/hooks/useLessonState';

describe('extractCorrectId', () => {
    it('returns undefined for null/non-object inputs', () => {
        expect(extractCorrectId(null)).toBeUndefined();
        expect(extractCorrectId(undefined)).toBeUndefined();
        expect(extractCorrectId('a')).toBeUndefined();
        expect(extractCorrectId(42)).toBeUndefined();
    });

    it('extracts the canonical correctOptionId', () => {
        expect(extractCorrectId({ correctOptionId: 'opt1' })).toBe('opt1');
    });

    it('extracts alternative id field names from DB variations', () => {
        expect(extractCorrectId({ correctChoiceId: 'c2' })).toBe('c2');
        expect(extractCorrectId({ bestOptionId: 'b3' })).toBe('b3');
        expect(extractCorrectId({ correctTrapId: 't1' })).toBe('t1');
        expect(extractCorrectId({ decision: 'yes' })).toBe('yes');
    });

    it('prefers correctOptionId over lower-priority fields', () => {
        expect(extractCorrectId({ correctOptionId: 'a', decision: 'b' })).toBe('a');
    });

    it('returns undefined when no known id field exists', () => {
        expect(extractCorrectId({ unrelated: 'x' })).toBeUndefined();
    });
});
