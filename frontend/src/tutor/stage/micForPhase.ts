import type { MicBlockedReason, MicOrbState } from '@/tutor/hud/MicOrb';
import type { StagePhase } from './phases';

/*
 * What the microphone IS, in every phase of the route.
 *
 * WHY THIS IS A FUNCTION AND NOT AN `&&`. The orb used to be mounted in exactly
 * two layers — the introduction and the conversation — so `arriving`,
 * `personalizing`, `closing` and `unavailable` had no microphone on screen at
 * all. That includes the FIRST screen a new learner ever sees. The owner's
 * report of the shipped build was, verbatim, "en ningun momento se ve el acceso
 * a microfono", and it was accurate twice over: the control was hidden when it
 * did not work, and it was absent wherever nobody had thought to mount it.
 *
 * /ORACLE.md §14.1 answers the first half: always rendered, in all five states,
 * saying why when the answer is no. This file answers the second half by making
 * "which state is the orb in right now" a total function over the phase
 * vocabulary — so a new phase cannot be added without deciding what the
 * microphone does in it, and every phase can be enumerated in a test.
 *
 * IT RETURNS KEYS, NOT SENTENCES. Nothing here calls `t()`, so the whole
 * mapping is pure and testable without an i18n runtime, and the copy stays
 * where the three locales can be checked against each other.
 */

export interface StageMicInput {
  phase: StagePhase;
  /**
   * Core's answer for this learner, when it has given one. Null means Core has
   * not refused; it does NOT mean a socket exists.
   */
  blockedBy: MicBlockedReason | null;
  /**
   * True when a live socket says a hold would actually record something.
   * Only ever true during `conversing`.
   */
  live: boolean;
  /** True while the learner is holding it. */
  recording: boolean;
  /** True while a turn has been sent and the tutor has not answered. */
  awaitingReply: boolean;
  /** True while the tutor's clip is playing. */
  speaking: boolean;
  /** True while a session start is in flight. */
  starting: boolean;
}

export interface StageMicPlan {
  state: MicOrbState;
  /** Core's reason, passed through to the orb when it is the reason. */
  blockedReason: MicBlockedReason | null;
  /** i18n key for the reason line when the block is a phase, not a policy. */
  blockedKey: string | null;
  /** i18n key for the resting line, or null for the orb's own default. */
  idleKey: string | null;
}

/** Nothing can be recorded before a session exists, and the orb says so. */
const BEFORE = 'tutor.mic.beforeConversation';

export function micForPhase(input: StageMicInput): StageMicPlan {
  const blocked = (blockedKey: string | null, blockedReason: MicBlockedReason | null = null): StageMicPlan => ({
    state: 'unavailable',
    blockedReason,
    blockedKey,
    idleKey: null,
  });

  switch (input.phase) {
    case 'arriving':
      // The island is still resolving behind the veil. Saying "no voice
      // provider" here would be a guess about infrastructure when the truth is
      // simply that nothing has started.
      return blocked('tutor.mic.stageArriving');

    case 'personalizing':
      return blocked(BEFORE);

    case 'introducing':
      /*
       * The one press that is not a recording. There is no socket yet, so a
       * hold has nothing to hold onto: the press OPENS the conversation in
       * which holding becomes real, and the resting line says that rather than
       * asking a child to hold a button with nothing behind it.
       */
      if (input.blockedBy !== null) {
        return { ...blocked(null, input.blockedBy), idleKey: null };
      }
      return {
        state: input.starting ? 'thinking' : 'idle',
        blockedReason: null,
        blockedKey: null,
        idleKey: 'tutor.introduce.startTalking',
      };

    case 'conversing':
      /*
       * `live` is the socket's own answer and it can go false mid-session — a
       * guardian revoking consent, a provider going down. When it does, the orb
       * stays exactly where it is and reports Core's reason; it does not vanish
       * and take the learner's only spoken channel with it silently.
       */
      if (!input.live) return blocked(null, input.blockedBy ?? 'VOICE_UNAVAILABLE');
      if (input.recording) return { state: 'listening', blockedReason: null, blockedKey: null, idleKey: null };
      if (input.awaitingReply) return { state: 'thinking', blockedReason: null, blockedKey: null, idleKey: null };
      if (input.speaking) return { state: 'speaking', blockedReason: null, blockedKey: null, idleKey: null };
      // Null idleKey means the orb's own "Hold to talk", which is literally
      // true here and nowhere else.
      return { state: 'idle', blockedReason: null, blockedKey: null, idleKey: null };

    case 'closing':
      return blocked('tutor.mic.afterConversation');

    case 'unavailable':
      // The Tutor API itself could not be reached, so the honest answer really
      // is the voice one: nothing spoken is available right now.
      return blocked(null, 'VOICE_UNAVAILABLE');
  }
}
