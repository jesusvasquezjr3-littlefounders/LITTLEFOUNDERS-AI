import { ADAPTATIONS, type Adaptation } from '../context/schema.js';

/*
 * C.19 — THE DISENGAGEMENT CHECK-IN AND REPAIR-INITIATION MOVE
 * (Appendix D §3.7; Block C non-negotiable: "a fired disengagement signal
 * always produces an explicit, humble check-in before the current plan
 * continues").
 *
 * In real conversational-AI transcripts the HUMAN does nearly all of the
 * repair work (Pütz & Esposito, 2024): the model rarely says "let me check I
 * understood you". Here the repair is the SYSTEM's responsibility, not the
 * model's and not the child's:
 *
 *   1. The Behavioral Telemetry Layer (C.9) fires its disengagement signal.
 *   2. The Mentor's reacting turn is told to react in one sentence and ask
 *      nothing (`CHECK_IN_LEAD_INSTRUCTION`); the SYSTEM then adds the
 *      check-in itself — a human-written, pre-generatable line
 *      (`scripted.ts` CHECK_IN), so the move happens on 100% of firings and
 *      never depends on the model choosing to ask.
 *   3. The learner answers with two equal chips (`check_in_response`) or in
 *      words (`classifyCheckInReply`):
 *        aligned     → the plan continues (`CHECK_IN_ALIGNED_INSTRUCTION`);
 *        misaligned  → REPAIR: the plan does NOT continue as if nothing
 *                      happened; the Mentor says it will try another way and
 *                      offers one adaptation (`repairInstruction`), routing
 *                      the signal through the adaptation-offer mechanism,
 *                      the learner-controlled choice Appendix D §1.7 requires;
 *        unclear     → answered as an ordinary turn (they may simply have
 *                      answered the lesson).
 *
 * Nothing in any of these lines, or in what the model is told, describes how
 * the learner feels: the check-in asks whether the MENTOR is helping, which
 * is the humble framing the SPEC names, and every model turn is also checked
 * for affect claims (`affectClaims.ts`).
 */

export const CHECK_IN_LEAD_INSTRUCTION = [
  'CHECK-IN — decided by the system from how this session is going, not by you. React to what the',
  'learner just did in ONE short sentence. Do NOT ask any question, do NOT move on to anything new, do NOT',
  'request or promise an activity, and do NOT describe how they feel, seem, look or sound: the system',
  'follows your sentence with a short check-in question of its own.',
].join(' ');

export const CHECK_IN_ALIGNED_INSTRUCTION = [
  'The learner just confirmed that your help is working for them. Continue the lesson with the next small',
  'step, in one or two short sentences. Do not ask again whether they understand.',
].join(' ');

/**
 * The repair after "not really". Routed through the adaptation-offer
 * mechanism (Appendix D §1.7), excluding every adaptation the learner
 * already declined this session; when none is left, the repair is a fresh
 * explanation instead.
 */
export function repairInstruction(declined: readonly Adaptation[]): string {
  const offerable = ADAPTATIONS.filter((a) => !declined.includes(a));
  const base = [
    'REPAIR — decided by the system: the learner just told you your help is not working for them right now.',
    'Do NOT continue the plan as if nothing happened, do NOT blame them, and do NOT describe how they feel.',
    // Worded "explain", never "let's try": the latter reads as an activity
    // promise to the unkept-promise check and would cost the turn a retry.
    'Say plainly, in one short sentence, that you will explain it a different way.',
  ];
  if (offerable.length === 0) {
    base.push(
      'Then re-explain the same idea with a completely different concrete example and ask ONE short question about it.',
    );
  } else {
    base.push(
      `Then offer ONE adaptation via offerAdaptation — one of: ${offerable.map((a) => a.replace(/_/g, ' ')).join(', ')} —`,
      'as a choice they can take or leave. Ask nothing else and do not request an activity this turn.',
    );
  }
  return base.join(' ');
}
