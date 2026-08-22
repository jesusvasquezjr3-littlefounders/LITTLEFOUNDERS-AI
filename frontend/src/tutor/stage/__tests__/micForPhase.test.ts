import { describe, expect, it } from 'vitest';
import { auditionFor, STAGE_PHASES, type StagePhase } from '../phases';
import { micForPhase, type StageMicInput } from '../micForPhase';

/*
 * THE MICROPHONE EXISTS IN EVERY PHASE, AND SAYS WHY WHEN IT CANNOT BE USED.
 *
 * The orb used to be mounted in exactly two layers, so `arriving`,
 * `personalizing`, `closing` and `unavailable` had no microphone on screen at
 * all — including the first screen a new learner ever sees. The owner's report
 * was, verbatim, "en ningun momento se ve el acceso a microfono".
 *
 * The reason a test can catch that now is that "which state is the orb in" is a
 * TOTAL function over the phase vocabulary rather than an `&&` at two call
 * sites. These tests walk STAGE_PHASES, so a seventh phase added without a
 * decision about the microphone fails here rather than shipping silent.
 */

function input(overrides: Partial<StageMicInput> = {}): StageMicInput {
  return {
    phase: 'conversing',
    blockedBy: null,
    live: true,
    recording: false,
    awaitingReply: false,
    speaking: false,
    starting: false,
    ...overrides,
  };
}

describe('micForPhase', () => {
  it('gives every phase a state, and never leaves a blocked orb without a reason', () => {
    for (const phase of STAGE_PHASES) {
      const plan = micForPhase(input({ phase, live: phase === 'conversing' }));
      expect(plan.state, phase).toBeTruthy();
      if (plan.state === 'unavailable') {
        // A dashed orb with no line is the "unfalsifiable absent control" of
        // /ORACLE.md §14.1 wearing a ring: the learner cannot tell a broken
        // microphone from one that is simply not available yet.
        expect(plan.blockedReason ?? plan.blockedKey, phase).not.toBeNull();
      }
    }
  });

  /*
   * WHICH PHASES HAVE A MICROPHONE AT ALL, enumerated, because both possible
   * mistakes here have already shipped. Mounting it in two layers left four
   * phases with none. Mounting it in every phase put a disabled 96 px orb on top
   * of the goodbye's plate, its indigo button and its own reason line at 375 px.
   * The list is written out rather than derived so that a change to it is an
   * edit somebody made on purpose.
   */
  it('names exactly the phases the orb appears in', () => {
    const present = STAGE_PHASES.filter((phase) => micForPhase(input({ phase })).present);
    expect(present).toEqual(['arriving', 'personalizing', 'introducing', 'conversing', 'unavailable']);
  });

  it('still explains itself in the phase it is absent from', () => {
    // `present: false` removes a CONTROL, not a decision: the state and the
    // reason stay filled in, so a caller that ignores the flag renders exactly
    // what it rendered before rather than a nameless orb.
    expect(micForPhase(input({ phase: 'closing', live: false }))).toMatchObject({
      present: false,
      state: 'unavailable',
      blockedKey: 'tutor.mic.afterConversation',
    });
  });

  it('gives the unreachable-API phase ONE sentence, and it is the phase’s own', () => {
    /*
     * `unavailable` used to carry two: a layer plate reading
     * "We can't open the tutor right now" and, under it, the orb saying "no
     * voice provider is configured". They overlapped at both widths, and only
     * one of them was even true — the Tutor API could not be reached at all.
     */
    expect(micForPhase(input({ phase: 'unavailable', live: false }))).toMatchObject({
      present: true,
      state: 'unavailable',
      blockedReason: null,
      blockedKey: 'tutor.page.unavailable',
    });
  });

  it('is honest before a session exists rather than blaming the voice provider', () => {
    // "No provider is configured" is a confident wrong sentence on a screen
    // where nothing has started. These two phases say what actually happened.
    expect(micForPhase(input({ phase: 'arriving', live: false }))).toMatchObject({
      state: 'unavailable',
      blockedReason: null,
      blockedKey: 'tutor.mic.stageArriving',
    });
    expect(micForPhase(input({ phase: 'personalizing', live: false }))).toMatchObject({
      state: 'unavailable',
      blockedKey: 'tutor.mic.beforeConversation',
    });
    expect(micForPhase(input({ phase: 'closing', live: false }))).toMatchObject({
      state: 'unavailable',
      blockedKey: 'tutor.mic.afterConversation',
    });
  });

  it('is live on the introduction, where the press opens the conversation', () => {
    const plan = micForPhase(input({ phase: 'introducing', live: false }));
    expect(plan.state).toBe('idle');
    // NOT "hold to talk": there is no socket, so nothing can be held. The orb
    // says what the press actually does instead of asking a child to hold a
    // button with nothing behind it.
    expect(plan.idleKey).toBe('tutor.introduce.startTalking');
  });

  it('reports Core’s own refusal on the introduction, not a phase excuse', () => {
    // `CONSENT_REQUIRED` is a product surface, not an error: it is the one place
    // a child learns that their guardian can turn this on (/ORACLE.md §14.1).
    const plan = micForPhase(input({ phase: 'introducing', live: false, blockedBy: 'CONSENT_REQUIRED' }));
    expect(plan).toMatchObject({ state: 'unavailable', blockedReason: 'CONSENT_REQUIRED', blockedKey: null });
  });

  it('walks the five states of a live conversation', () => {
    expect(micForPhase(input({ recording: true })).state).toBe('listening');
    expect(micForPhase(input({ awaitingReply: true })).state).toBe('thinking');
    expect(micForPhase(input({ speaking: true })).state).toBe('speaking');
    expect(micForPhase(input()).state).toBe('idle');
    // Consent revoked mid-session: the orb stays exactly where it is and
    // reports the reason rather than vanishing with the learner's only spoken
    // channel.
    expect(micForPhase(input({ live: false, blockedBy: 'CONSENT_REQUIRED' }))).toMatchObject({
      state: 'unavailable',
      blockedReason: 'CONSENT_REQUIRED',
    });
  });

  it('falls back to the voice reason when a live socket says no for no stated reason', () => {
    expect(micForPhase(input({ live: false })).blockedReason).toBe('VOICE_UNAVAILABLE');
  });
});

/*
 * THE CANDIDATES ARE ON THE ISLAND WHILE THEY ARE BEING CHOSEN FROM.
 *
 * The picker hung a name plate at each stage mark while the scene rendered only
 * the tutor and their companion, so two of the four plates named empty ground.
 * The decision is a function so it can be asserted without a WebGL context.
 */
describe('auditionFor', () => {
  const CAST = ['dina', 'liruf', 'rho', 'zara'] as const;

  it('stands the whole cast up during personalization', () => {
    expect(auditionFor('personalizing', CAST)).toEqual(CAST);
  });

  it('stands nobody extra up in any other phase', () => {
    for (const phase of STAGE_PHASES.filter((p): p is StagePhase => p !== 'personalizing')) {
      expect(auditionFor(phase, CAST), phase).toBeNull();
    }
  });

  it('returns null rather than an empty cast when the catalog has not arrived', () => {
    // An empty audition would be read by the scene as "place nobody", which is
    // an island with no tutor on it. Null is read as "the ordinary cast".
    expect(auditionFor('personalizing', undefined)).toBeNull();
    expect(auditionFor('personalizing', [])).toBeNull();
  });
});
