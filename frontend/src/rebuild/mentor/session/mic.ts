import type { MicBlockedReason } from './micForPhase';
import type { StartSessionInput } from './tutorApi';
import type { TutorOffers } from './types';

/*
 * The three answers Core gives about the microphone, and the one opening the
 * microphone press starts.
 *
 * BOTH OF THESE USED TO LIVE INSIDE `OfferChips`, which is where the orb used
 * to live. The orb belongs to the stage now (`stage/StageShell.tsx`), so the
 * shell needs the same two answers, and a second copy of either is the kind of
 * duplication that drifts in one direction only: the copy nobody is looking at
 * keeps saying yes after the original has started saying no.
 */

/** Core's answers, verbatim (`backend/src/routes/tutor.ts`, `microphoneBlockedBy`). */
const MIC_BLOCKED_REASONS: readonly string[] = ['POLICY_BLOCKED', 'CONSENT_REQUIRED', 'VOICE_UNAVAILABLE'];

/** Narrows a wire string to the orb's vocabulary, or null when it is not one. */
export function narrowBlockedReason(value: string | null): MicBlockedReason | null {
  return value !== null && MIC_BLOCKED_REASONS.includes(value) ? (value as MicBlockedReason) : null;
}

/**
 * Why the microphone is off before a session exists, or null when it is not.
 *
 * Policy is checked FIRST upstream, and this mirrors that order rather than
 * re-deciding it: telling a family to ask a grown-up when the answer would
 * still be no wastes their time and reads as a permission that does not work.
 */
export function micBlockedReason(
  voiceAvailable: boolean,
  blockedBy: string | null,
): MicBlockedReason | null {
  if (blockedBy === 'POLICY_BLOCKED') return 'POLICY_BLOCKED';
  if (blockedBy === 'CONSENT_REQUIRED') return 'CONSENT_REQUIRED';
  if (blockedBy !== null || !voiceAvailable) return 'VOICE_UNAVAILABLE';
  return null;
}

/**
 * The same question, answered from the offers the arrival screen was handed.
 *
 * A tutor that cannot open a session at all cannot open a spoken one either, so
 * the orb is dashed and disabled then too. It borrows the voice-unavailable
 * line rather than inventing a fourth reason, and the plate beside it says what
 * is actually happening. An orb that looked live and did nothing would be the
 * same broken promise as an orb that was not there.
 */
export function micBlockedForOffers(offers: TutorOffers): MicBlockedReason | null {
  return (
    micBlockedReason(offers.voiceAvailable, offers.microphoneBlockedBy) ??
    (offers.canStart ? null : 'VOICE_UNAVAILABLE')
  );
}

/**
 * The opening a press of the microphone starts, when the learner pressed the
 * orb rather than choosing an opening chip.
 *
 * Open conversation when this learner may have one, and the course-topic
 * opening otherwise — which is the first chip `OfferChips` always builds, so
 * the orb starts the same thing the top of the list offers rather than
 * inventing a fifth intent nobody can see.
 */
export function primaryOpening(offers: TutorOffers): Omit<StartSessionInput, 'wantsVoice'> {
  return offers.canAskOpen ? { intent: 'open' } : { intent: 'course_topic' };
}
