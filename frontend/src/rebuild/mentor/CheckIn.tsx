import { ReplyChip } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './checkIn.css';

/*
 * C.19 on the Mentor stage (Frontend Bible 08 §4: "Repair: 'Did that help?'
 * is a turn with chips, not a modal").
 *
 * When the Behavioral Telemetry Layer (C.9) fires its disengagement signal,
 * the SYSTEM asks a written check-in in the Mentor's voice ("Let me check I'm
 * really helping. Are we on the same page?"). The question lives in the
 * speech plate, because it IS the Mentor's turn; this surface carries only the
 * two reply chips, which are `option` controls (Bible 08 §2: 5 words at most
 * for ages 6–9):
 *
 *   aligned      "We're good"  — the plan continues.
 *   misaligned   "Not really"  — the repair: the Mentor tries another way
 *                                 and offers one adaptation the learner can
 *                                 take or leave.
 *
 * The two chips are EQUAL: the same control, the same weight, neither
 * pre-selected, no countdown, no focus stolen. The learner may also ignore
 * them and answer in words, or just answer the lesson. Nothing here names a
 * feeling: the question is about whether the Mentor is helping.
 *
 * The chips are the shared ReplyChip (an option control, never a toggle).
 * Tokens only; every string declares its copy role.
 */

export interface CheckInCopy {
  choiceLabel: string;
  aligned: string;
  misaligned: string;
}

export function CheckInChoice({ copy, locale, dark, disabled = false, onAnswer }: {
  copy: CheckInCopy;
  locale: string;
  dark: boolean;
  disabled?: boolean;
  onAnswer: (aligned: boolean) => void;
}) {
  return <section className="lf-rebuild lf-check-in" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen="mentor-check-in" aria-label={copy.choiceLabel}>
    <div className="lf-check-in-chips" role="group" aria-label={copy.choiceLabel}>
      <ReplyChip className="lf-check-in-chip" data-check-in="aligned" disabled={disabled} onPress={() => onAnswer(true)}>{copy.aligned}</ReplyChip>
      <ReplyChip className="lf-check-in-chip" data-check-in="misaligned" disabled={disabled} onPress={() => onAnswer(false)}>{copy.misaligned}</ReplyChip>
    </div>
  </section>;
}
