import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoleplayDirector } from '../useRoleplayDirector';
import { ROLEPLAY_SCENES } from '../scenes';

const SCENE_ID = 'lemonade_change';
const SCENE = ROLEPLAY_SCENES[SCENE_ID]!;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRoleplayDirector', () => {
  it('is idle when no scene is playing', () => {
    const { result } = renderHook(() => useRoleplayDirector(null, 1, 'rho', 'liruf'));
    expect(result.current).toEqual({ active: false, titleKey: null, beat: null, perCharacter: {} });
  });

  it('starts on the first beat, attributed to whichever real character plays that role', () => {
    const { result } = renderHook(() => useRoleplayDirector(SCENE_ID, 1, 'rho', 'liruf'));

    expect(result.current.active).toBe(true);
    expect(result.current.beat).toBe(SCENE.beats[0]);
    // beat 1's speaker is 'companion' in scenes.ts — resolved to the real companion id.
    expect(result.current.perCharacter).toEqual({
      liruf: { emotion: SCENE.beats[0]!.emotion, action: SCENE.beats[0]!.action, actionKey: 0 },
    });
  });

  it('advances to the next beat once the current one\'s duration elapses, and not before', () => {
    const { result } = renderHook(() => useRoleplayDirector(SCENE_ID, 1, 'rho', 'liruf'));
    const first = result.current.beat;

    act(() => {
      vi.advanceTimersByTime(first!.durationMs - 1);
    });
    expect(result.current.beat).toBe(first);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.beat).toBe(SCENE.beats[1]);
    expect(result.current.active).toBe(true);
  });

  it('resolves a "lead" beat to the real lead id, not the companion', () => {
    const { result } = renderHook(() => useRoleplayDirector(SCENE_ID, 1, 'rho', 'liruf'));
    act(() => {
      vi.advanceTimersByTime(SCENE.beats[0]!.durationMs);
    });
    // beat 2 is spoken by 'lead' in scenes.ts.
    expect(result.current.beat).toBe(SCENE.beats[1]);
    expect(Object.keys(result.current.perCharacter)).toEqual(['rho']);
  });

  it('becomes inactive once every beat has played, rather than looping or holding the last one', () => {
    const { result } = renderHook(() => useRoleplayDirector(SCENE_ID, 1, 'rho', 'liruf'));

    // Each advance must be its OWN `act()`: the effect that re-arms the next
    // beat's timer only runs after React commits the `setIndex` from the
    // PREVIOUS one, so batching every advance into one `act()` would fire
    // only the first-ever-scheduled timeout.
    for (const step of SCENE.beats) {
      act(() => {
        vi.advanceTimersByTime(step.durationMs);
      });
    }

    expect(result.current).toEqual({ active: false, titleKey: null, beat: null, perCharacter: {} });
  });

  it('never attributes a beat to a role with no real character standing in it (no companion picked)', () => {
    const { result } = renderHook(() => useRoleplayDirector(SCENE_ID, 1, 'rho', null));
    // beat 1 is 'companion', and there is none.
    expect(result.current.perCharacter).toEqual({});
    expect(result.current.active).toBe(true);
  });

  /*
   * Regression: `sceneId` used to be the only trigger, so the conversation's
   * very next ordinary turn — which never repeats `roleplayScene`, by the
   * prompt's own design (scenes.ts's header) — read as "cancel the scene
   * already playing" and cut a 4-beat performance off after one line.
   * `turnSeq` is what tells a genuinely NEW request for a scene apart from
   * an unrelated later turn that simply has nothing to say about roleplay.
   */
  it('keeps playing to its own natural completion when a LATER turn carries no roleplayScene at all', () => {
    const { result, rerender } = renderHook(
      ({ scene, seq }) => useRoleplayDirector(scene, seq, 'rho', 'liruf'),
      { initialProps: { scene: SCENE_ID as typeof SCENE_ID | null, seq: 1 } },
    );
    expect(result.current.beat).toBe(SCENE.beats[0]);

    // The very next turn (seq 2) is ordinary — no roleplayScene.
    rerender({ scene: null, seq: 2 });
    expect(result.current.active).toBe(true);
    expect(result.current.beat).toBe(SCENE.beats[0]);

    // The scene keeps advancing on its own clock, unaffected.
    act(() => {
      vi.advanceTimersByTime(SCENE.beats[0]!.durationMs);
    });
    expect(result.current.beat).toBe(SCENE.beats[1]);
  });

  it('restarts from beat 0 when a NEW turn requests the SAME scene id again', () => {
    const { result, rerender } = renderHook(
      ({ scene, seq }) => useRoleplayDirector(scene, seq, 'rho', 'liruf'),
      { initialProps: { scene: SCENE_ID as typeof SCENE_ID | null, seq: 1 } },
    );
    act(() => {
      vi.advanceTimersByTime(SCENE.beats[0]!.durationMs);
    });
    expect(result.current.beat).toBe(SCENE.beats[1]);

    // A genuinely NEW turn (seq 2) asks for the SAME scene again — a fresh performance.
    rerender({ scene: SCENE_ID, seq: 2 });
    expect(result.current.beat).toBe(SCENE.beats[0]);
  });

  it('does NOT restart when the same (scene, seq) pair simply re-renders', () => {
    const { result, rerender } = renderHook(
      ({ scene, seq }) => useRoleplayDirector(scene, seq, 'rho', 'liruf'),
      { initialProps: { scene: SCENE_ID as typeof SCENE_ID | null, seq: 1 } },
    );
    act(() => {
      vi.advanceTimersByTime(SCENE.beats[0]!.durationMs);
    });
    expect(result.current.beat).toBe(SCENE.beats[1]);

    // Same trigger, re-rendered (e.g. an unrelated parent state change) —
    // must not reset an in-progress performance back to beat 0.
    rerender({ scene: SCENE_ID, seq: 1 });
    expect(result.current.beat).toBe(SCENE.beats[1]);
  });
});
