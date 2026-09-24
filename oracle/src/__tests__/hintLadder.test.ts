import { describe, expect, it } from 'vitest';
import { HintLadder, HINT_LEVELS, isHintRequest, isTellRequest } from '../tutor/hintLadder.js';

/*
 * C.13: the hint ladder is a first-class object with two hard rules —
 * never repeat a level, and always honor "just tell me". These tests pin
 * the escalation order, the clamping, the escape hatch, per-step isolation
 * and the snapshot round-trip (a parked session must restore identically).
 */

describe('hint request classification', () => {
  it('detects ordinary hint requests across locales', () => {
    for (const text of ['can you help me?', 'no entiendo', 'no entendo', 'me ayudas con esto', "i don't understand"]) {
      expect(isHintRequest(text), text).toBe(true);
    }
  });

  it('treats an explicit tell request as a tell, not a hint', () => {
    expect(isHintRequest('just tell me the answer')).toBe(false);
    expect(isTellRequest('just tell me the answer')).toBe(true);
    expect(isTellRequest('dime la respuesta')).toBe(true);
  });
});

describe('HintLadder escalation', () => {
  it('advances exactly one level per request, in the mandated order, never repeating', () => {
    const ladder = new HintLadder();
    const seen = [ladder.levelFor('s1')];
    for (let i = 0; i < HINT_LEVELS.length; i++) {
      seen.push(ladder.registerHintRequest('s1'));
    }
    expect(seen).toEqual(['reask', 'indirect', 'misconception', 'fill_blank', 'tell', 'tell']);
    expect(ladder.reachedTell('s1')).toBe(true);
  });

  it('honors an explicit tell request from any level, once', () => {
    const ladder = new HintLadder();
    ladder.registerHintRequest('s1');
    expect(ladder.registerTellRequest('s1')).toBe('tell');
    expect(ladder.reachedTell('s1')).toBe(true);
    // Further hint requests stay answered at the bottom, honestly.
    expect(ladder.registerHintRequest('s1')).toBe('tell');
  });

  it('keeps every sub-step independent', () => {
    const ladder = new HintLadder();
    ladder.registerHintRequest('s1');
    ladder.registerTellRequest('s2');
    expect(ladder.levelFor('s1')).toBe('indirect');
    expect(ladder.levelFor('s2')).toBe('tell');
    expect(ladder.levelFor('s3')).toBe('reask');
  });

  it('resets one sub-step without touching others', () => {
    const ladder = new HintLadder();
    ladder.registerTellRequest('s1');
    ladder.registerHintRequest('s2');
    ladder.resetStep('s1');
    expect(ladder.levelFor('s1')).toBe('reask');
    expect(ladder.reachedTell('s1')).toBe(false);
    expect(ladder.levelFor('s2')).toBe('indirect');
  });

  it('round-trips through a plain JSON snapshot', () => {
    const ladder = new HintLadder();
    ladder.registerHintRequest('s1');
    ladder.registerTellRequest('s2');
    const restored = new HintLadder();
    restored.restore(JSON.parse(JSON.stringify(ladder.snapshot())) as ReturnType<HintLadder['snapshot']>);
    expect(restored.snapshot()).toEqual(ladder.snapshot());
    expect(restored.registerHintRequest('s1')).toBe('misconception');
    expect(restored.reachedTell('s2')).toBe(true);
  });
});
