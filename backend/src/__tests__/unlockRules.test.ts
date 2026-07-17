import { describe, expect, it } from 'vitest';
import { computeAdventureState, computeLessonStates, progressOf } from '../services/unlockRules.js';

describe('computeLessonStates', () => {
  it('marks passed lessons as passed, the first non-passed as current, and everything after as locked', () => {
    const lessons = [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }];
    const { states, currentLessonId } = computeLessonStates(lessons, new Set(['l1', 'l2']));
    expect(states.get('l1')).toBe('passed');
    expect(states.get('l2')).toBe('passed');
    expect(states.get('l3')).toBe('current');
    expect(states.get('l4')).toBe('locked');
    expect(currentLessonId).toBe('l3');
  });

  it('marks the very first lesson current when nothing is passed yet', () => {
    const lessons = [{ id: 'l1' }, { id: 'l2' }];
    const { states, currentLessonId } = computeLessonStates(lessons, new Set());
    expect(states.get('l1')).toBe('current');
    expect(states.get('l2')).toBe('locked');
    expect(currentLessonId).toBe('l1');
  });

  it('marks every lesson passed and reports no current lesson when the course is fully complete', () => {
    const lessons = [{ id: 'l1' }, { id: 'l2' }];
    const { states, currentLessonId } = computeLessonStates(lessons, new Set(['l1', 'l2']));
    expect(states.get('l1')).toBe('passed');
    expect(states.get('l2')).toBe('passed');
    expect(currentLessonId).toBeNull();
  });

  it('defensively marks a not-yet-passed lesson BEFORE the current pointer as available, not locked', () => {
    // Data anomaly: l2 was never marked passed even though l3 is the current
    // pointer (e.g. content reordered after progress was recorded).
    const lessons = [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }];
    const { states } = computeLessonStates(lessons, new Set(['l1', 'l3']));
    // l3 is NOT the first non-passed lesson (l2 is) — l2 is current, l3 stays passed.
    expect(states.get('l1')).toBe('passed');
    expect(states.get('l2')).toBe('current');
    expect(states.get('l3')).toBe('passed');
  });

  it('returns empty state map for an empty course', () => {
    const { states, currentLessonId } = computeLessonStates([], new Set());
    expect(states.size).toBe(0);
    expect(currentLessonId).toBeNull();
  });
});

describe('computeAdventureState', () => {
  it('is available for the first adventure when no lesson is passed yet', () => {
    expect(computeAdventureState(['l1', 'l2'], null, new Set())).toBe('available');
  });

  it('is completed when every own lesson is passed', () => {
    expect(computeAdventureState(['l1', 'l2'], null, new Set(['l1', 'l2']))).toBe('completed');
  });

  it('is locked when the previous adventure has an unpassed lesson', () => {
    expect(computeAdventureState(['l3', 'l4'], ['l1', 'l2'], new Set(['l1']))).toBe('locked');
  });

  it('unlocks once every lesson of the previous adventure is passed', () => {
    expect(computeAdventureState(['l3', 'l4'], ['l1', 'l2'], new Set(['l1', 'l2']))).toBe('available');
  });

  it('treats an adventure with zero lessons as available, never falsely "completed"', () => {
    expect(computeAdventureState([], null, new Set())).toBe('available');
  });
});

describe('progressOf', () => {
  it('computes passed/total/pct', () => {
    expect(progressOf(['l1', 'l2', 'l3', 'l4'], new Set(['l1', 'l2']))).toEqual({ passed: 2, total: 4, pct: 50 });
  });

  it('is zero-safe for an empty lesson list', () => {
    expect(progressOf([], new Set())).toEqual({ passed: 0, total: 0, pct: 0 });
  });
});
