import { describe, expect, it } from 'vitest';
import {
  initialGovernorState,
  stepGovernor,
  DEMOTE_BELOW_FPS,
  PROMOTE_ABOVE_FPS,
  WINDOWS_TO_DEMOTE,
  WINDOWS_TO_PROMOTE,
  type GovernorState,
} from './governor';

const SLOW = DEMOTE_BELOW_FPS - 10;
const FAST = PROMOTE_ABOVE_FPS + 5;
/** Between the thresholds — the dead band. */
const FINE = (DEMOTE_BELOW_FPS + PROMOTE_ABOVE_FPS) / 2;

function run(state: GovernorState, fps: number, windows: number): GovernorState {
  let next = state;
  for (let i = 0; i < windows; i++) next = stepGovernor(next, fps);
  return next;
}

describe('stepGovernor — demotion', () => {
  it('needs sustained evidence, not one slow window', () => {
    const after1 = stepGovernor(initialGovernorState('high'), SLOW);
    expect(after1.tier).toBe('high');
    expect(after1.badWindows).toBe(1);
  });

  it('demotes once the evidence threshold is met', () => {
    expect(run(initialGovernorState('high'), SLOW, WINDOWS_TO_DEMOTE).tier).toBe('medium');
  });

  /*
   * THE REGRESSION THIS FILE EXISTS FOR. The original implementation mutated
   * the demotion counter inside a React `setState` updater; StrictMode invokes
   * updaters twice, so a single demotion counted as two and latched the tier
   * immediately. A device that hiccuped once was then permanently barred from
   * climbing back. Counting demotions must be a pure function of windows seen.
   */
  it('counts exactly one demotion per tier step', () => {
    const afterOne = run(initialGovernorState('high'), SLOW, WINDOWS_TO_DEMOTE);
    expect(afterOne.demotions).toBe(1);
    expect(afterOne.locked).toBe(false);
  });

  it('latches only after the second real demotion, at the tier it reached', () => {
    const locked = run(initialGovernorState('high'), SLOW, WINDOWS_TO_DEMOTE * 2);
    expect(locked.tier).toBe('low');
    expect(locked.demotions).toBe(2);
    expect(locked.locked).toBe(true);
  });

  it('does not accumulate demotions once already at the floor', () => {
    const floored = run(initialGovernorState('low'), SLOW, WINDOWS_TO_DEMOTE * 3);
    expect(floored.tier).toBe('low');
    expect(floored.demotions).toBe(0);
    expect(floored.locked).toBe(false);
  });
});

describe('stepGovernor — promotion', () => {
  it('promotes only after sustained good windows', () => {
    const almost = run(initialGovernorState('low'), FAST, WINDOWS_TO_PROMOTE - 1);
    expect(almost.tier).toBe('low');
    expect(run(almost, FAST, 1).tier).toBe('medium');
  });

  it('never promotes a locked device', () => {
    const locked = run(initialGovernorState('high'), SLOW, WINDOWS_TO_DEMOTE * 2);
    expect(locked.locked).toBe(true);
    expect(run(locked, FAST, WINDOWS_TO_PROMOTE * 3).tier).toBe('low');
  });
});

describe('stepGovernor — oscillation resistance', () => {
  it('leaves a device sitting in the dead band alone', () => {
    const steady = run(initialGovernorState('medium'), FINE, 50);
    expect(steady.tier).toBe('medium');
    expect(steady.demotions).toBe(0);
  });

  it('does not let isolated slow windows accumulate across healthy ones', () => {
    let state = initialGovernorState('high');
    for (let i = 0; i < 20; i++) {
      state = stepGovernor(state, SLOW);
      state = stepGovernor(state, FINE);
    }
    expect(state.tier).toBe('high');
    expect(state.demotions).toBe(0);
  });
});
