import { describe, expect, it } from 'vitest';
import { newRunCheckpoint, setSlotState, getSlot, type RunParams } from '../pipeline/checkpoint.js';
import { prepareSlotForAttempt } from '../pipeline/run.js';

/*
 * Stage-aware outer retry (2026-07-26 orchestration review). A slot that fails
 * from a LATE stage (reviewed/localized/illustrated) holds judge-approved work
 * in its checkpoint data — the retry must resume it, not re-pay
 * plan+write+revise+judge from scratch. Early-stage failures (the judge
 * rejected the draft, write exhausted) keep the measured from-scratch behavior.
 */

const params: RunParams = { course: 'c', locales: ['es-MX', 'en-US', 'pt-BR'], noImages: false, register: 'kid' };

function failedCheckpoint(failedFrom: string, withData = true) {
  let cp = newRunCheckpoint('r1', 'c', params);
  cp = setSlotState(cp, 'a/s/t/l', failedFrom as never, withData ? { data: { skeleton: {}, documents: { 'es-MX': {} } } } : {});
  cp = setSlotState(cp, 'a/s/t/l', 'failed', { error: 'boom', failedFrom: failedFrom as never });
  return cp;
}

describe('checkpoint: failedFrom lives and dies with the failed state', () => {
  it('records failedFrom on the failed transition and keeps the data payload', () => {
    const cp = failedCheckpoint('reviewed');
    const slot = getSlot(cp, 'a/s/t/l');
    expect(slot.state).toBe('failed');
    expect(slot.failedFrom).toBe('reviewed');
    expect(slot.data).toBeDefined(); // failure never wipes the judge-approved work
  });

  it('clears failedFrom (and error) on any successful transition', () => {
    let cp = failedCheckpoint('reviewed');
    cp = setSlotState(cp, 'a/s/t/l', 'localized', {});
    const slot = getSlot(cp, 'a/s/t/l');
    expect(slot.failedFrom).toBeUndefined();
    expect(slot.error).toBeUndefined();
  });
});

describe('prepareSlotForAttempt: resume late-stage failures, reset early-stage ones', () => {
  it.each(['reviewed', 'localized', 'illustrated'])('RESUMES a slot that failed from %s (data preserved)', (stage) => {
    const cp = failedCheckpoint(stage);
    const prep = prepareSlotForAttempt(cp, 'a/s/t/l', { forceFresh: false });
    expect(prep).toBe('resumed');
    const slot = getSlot(cp, 'a/s/t/l');
    expect(slot.state).toBe(stage); // stage guards in processSlot now skip everything already done
    expect(slot.data).toBeDefined();
    expect(slot.error).toBeUndefined();
  });

  it.each(['pending', 'planned', 'written'])('RESETS a slot that failed from %s — from-scratch is the measured-better path', (stage) => {
    const cp = failedCheckpoint(stage);
    const prep = prepareSlotForAttempt(cp, 'a/s/t/l', { forceFresh: false });
    expect(prep).toBe('reset');
    const slot = getSlot(cp, 'a/s/t/l');
    expect(slot.state).toBe('pending');
    expect(slot.data).toBeUndefined();
  });

  it('RESETS even a resumable failure when forceFresh (the last attempt always gets a fresh draw)', () => {
    const cp = failedCheckpoint('reviewed');
    const prep = prepareSlotForAttempt(cp, 'a/s/t/l', { forceFresh: true });
    expect(prep).toBe('reset');
    expect(getSlot(cp, 'a/s/t/l').state).toBe('pending');
  });

  it('RESETS a resumable failure whose data is missing (nothing to resume from)', () => {
    const cp = failedCheckpoint('reviewed', false);
    const prep = prepareSlotForAttempt(cp, 'a/s/t/l', { forceFresh: false });
    expect(prep).toBe('reset');
  });

  it('RESETS a legacy failed slot with no failedFrom recorded (pre-upgrade checkpoint)', () => {
    let cp = newRunCheckpoint('r1', 'c', params);
    cp = setSlotState(cp, 'a/s/t/l', 'failed', { error: 'boom' }); // no failedFrom
    const prep = prepareSlotForAttempt(cp, 'a/s/t/l', { forceFresh: false });
    expect(prep).toBe('reset');
  });

  it('leaves a non-failed slot untouched', () => {
    let cp = newRunCheckpoint('r1', 'c', params);
    cp = setSlotState(cp, 'a/s/t/l', 'reviewed', { data: { skeleton: {} } });
    const prep = prepareSlotForAttempt(cp, 'a/s/t/l', { forceFresh: false });
    expect(prep).toBe('untouched');
    expect(getSlot(cp, 'a/s/t/l').state).toBe('reviewed');
  });
});
