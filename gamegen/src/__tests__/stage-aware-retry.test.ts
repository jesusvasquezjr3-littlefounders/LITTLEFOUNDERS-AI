// STAGE-AWARE OUTER RETRY — which failures are worth re-paying for.
//
// A slot that fails from a LATE stage (judged / localized / illustrated) is holding a
// judge-approved manifest, and possibly its translations and its Prism sprite URLs, in
// its checkpoint `data`. Re-running it from scratch would re-pay plan + author +
// revise cycles + judge to redo work whose input was fine — so the retry RESUMES at
// the failed stage instead.
//
// Failures from the early stages (pending / planned / authored / simulated) keep the
// measured from-scratch behaviour: a fresh draw converges far better than revising a
// bad draft (the ARCADE_SLOT_ATTEMPTS rationale in env.ts). And the LAST attempt
// always forces a fresh draw, because a DETERMINISTIC late-stage failure — a
// translation that trips the target locale's vocabulary gate every single time —
// otherwise retries into the same wall until the attempts run out.
//
// Pure functions over an in-memory checkpoint: no network, no provider, no spend.

import { describe, expect, it } from 'vitest';

import { getSlot, newRunCheckpoint, setSlotState, type RunParams, type SlotState } from '../pipeline/checkpoint.js';
import { prepareSlotForAttempt } from '../pipeline/run.js';

const PARAMS: RunParams = { kind: 'games', course: 'mi-primer-dinero', locales: ['es-MX', 'en-US', 'pt-BR'], noImages: false };
const SLOT = 'adv/saga/tema/reparte-la-mesada';

/** The paid work a late-stage failure is sitting on. */
const PAID_WORK = {
  skeleton: { rounds: 3 },
  documents: { 'es-MX': { meta: { slug: 'reparte-la-mesada' } } },
  validation: { max_score: 100, min_duration_seconds: 10, max_events: 400 },
  rubric: { concept_fit: 5, kid_safety: 5 },
};

function failedFromStage(stage: SlotState, withData = true) {
  let cp = newRunCheckpoint('games-r1', 'c', PARAMS);
  cp = setSlotState(cp, SLOT, stage, withData ? { data: { ...PAID_WORK } } : {});
  cp = setSlotState(cp, SLOT, 'failed', { error: 'boom', failedFrom: stage });
  return cp;
}

describe('prepareSlotForAttempt — resume late-stage failures', () => {
  it.each<SlotState>(['judged', 'localized', 'illustrated'])(
    'RESUMES a slot that failed from %s, with its paid work intact',
    (stage) => {
      const cp = failedFromStage(stage);

      expect(prepareSlotForAttempt(cp, SLOT, { forceFresh: false })).toBe('resumed');

      const slot = getSlot(cp, SLOT);
      // Restoring the state is what makes processSlot's stage guards skip everything
      // already done — the attempt re-enters exactly at the stage that failed.
      expect(slot.state).toBe(stage);
      expect(slot.data).toMatchObject(PAID_WORK);
      expect(slot.error).toBeUndefined();
      expect(slot.failedFrom).toBeUndefined();
    },
  );

  it.each<SlotState>(['pending', 'planned', 'authored', 'simulated'])(
    'RESETS a slot that failed from %s — a fresh draw converges better than revising a bad one',
    (stage) => {
      const cp = failedFromStage(stage);

      expect(prepareSlotForAttempt(cp, SLOT, { forceFresh: false })).toBe('reset');

      const slot = getSlot(cp, SLOT);
      expect(slot.state).toBe('pending');
      expect(slot.data).toBeUndefined();
    },
  );

  it('the LAST attempt forces a fresh draw even for a resumable failure', () => {
    const cp = failedFromStage('localized');

    expect(prepareSlotForAttempt(cp, SLOT, { forceFresh: true })).toBe('reset');

    expect(getSlot(cp, SLOT).state).toBe('pending');
    expect(getSlot(cp, SLOT).data).toBeUndefined();
  });

  it('RESETS a resumable failure with no data — there is nothing to resume from', () => {
    const cp = failedFromStage('judged', false);
    expect(prepareSlotForAttempt(cp, SLOT, { forceFresh: false })).toBe('reset');
    expect(getSlot(cp, SLOT).state).toBe('pending');
  });

  it('RESETS a legacy failed slot that recorded no failedFrom', () => {
    let cp = newRunCheckpoint('games-r1', 'c', PARAMS);
    cp = setSlotState(cp, SLOT, 'failed', { error: 'boom' });
    expect(prepareSlotForAttempt(cp, SLOT, { forceFresh: false })).toBe('reset');
  });

  it('leaves a slot that is not failed completely untouched', () => {
    let cp = newRunCheckpoint('games-r1', 'c', PARAMS);
    cp = setSlotState(cp, SLOT, 'illustrated', { data: { ...PAID_WORK } });

    expect(prepareSlotForAttempt(cp, SLOT, { forceFresh: false })).toBe('untouched');

    expect(getSlot(cp, SLOT).state).toBe('illustrated');
    expect(getSlot(cp, SLOT).data).toMatchObject(PAID_WORK);
  });

  it('leaves an unseen (pending) slot untouched rather than inventing a reset', () => {
    const cp = newRunCheckpoint('games-r1', 'c', PARAMS);
    expect(prepareSlotForAttempt(cp, 'never/seen/at/all', { forceFresh: false })).toBe('untouched');
  });

  it('a resume → fail → resume cycle never loses the paid work', () => {
    const cp = failedFromStage('judged');

    expect(prepareSlotForAttempt(cp, SLOT, { forceFresh: false })).toBe('resumed');
    // The next attempt dies in localize again.
    setSlotState(cp, SLOT, 'failed', { error: 'localize timed out again', failedFrom: 'judged' });
    expect(prepareSlotForAttempt(cp, SLOT, { forceFresh: false })).toBe('resumed');

    expect(getSlot(cp, SLOT).data).toMatchObject(PAID_WORK);
  });
});
