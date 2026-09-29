import { describe, expect, it } from 'vitest';
import { createTimeOnTask, TIME_ON_TASK_IDLE_CAP_MS, TIME_ON_TASK_MAX_SECONDS, watchTimeOnTask } from './timeOnTask';

/*
 * GAP-FIX-R4 (Appendix C 1.2; Appendix P Part 7.5): the v2 step clock that
 * feeds the Session Efficiency Ratio. Idle time is capped, hidden time never
 * counts, and each step restarts the clock.
 */

function fakeClock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('time on task', () => {
  it('counts active time from the step shown to its Check, then restarts', () => {
    const c = fakeClock();
    const clock = createTimeOnTask(c.now);
    for (let i = 0; i < 6; i += 1) { c.advance(5_000); clock.activity(); }
    expect(clock.take()).toBe(30);
    c.advance(4_000);
    expect(clock.take()).toBe(4);
  });

  it('caps an idle gap and never counts hidden time', () => {
    const c = fakeClock();
    const clock = createTimeOnTask(c.now);
    c.advance(10 * 60_000);
    expect(clock.take()).toBe(TIME_ON_TASK_IDLE_CAP_MS / 1000);
    clock.visibility(false);
    c.advance(30 * 60_000);
    clock.visibility(true);
    c.advance(2_000);
    expect(clock.take()).toBe(2);
  });

  it('stays within the bound Core accepts (0-7200)', () => {
    const c = fakeClock();
    const clock = createTimeOnTask(c.now);
    for (let i = 0; i < 20_000; i += 1) { c.advance(1_000); clock.activity(); }
    expect(clock.take()).toBe(TIME_ON_TASK_MAX_SECONDS);
    expect(clock.take()).toBe(0);
  });

  it('reads activity and visibility from the window, and stops on cleanup', () => {
    const c = fakeClock();
    const clock = createTimeOnTask(c.now);
    const stop = watchTimeOnTask(clock);
    c.advance(20_000);
    window.dispatchEvent(new KeyboardEvent('keydown'));
    c.advance(20_000);
    window.dispatchEvent(new Event('pointerdown'));
    expect(clock.take()).toBe(40);
    stop();
    c.advance(120_000);
    window.dispatchEvent(new KeyboardEvent('keydown'));
    // After cleanup no event feeds it: the gap is one capped idle stretch.
    expect(clock.take()).toBe(60);
  });
});
