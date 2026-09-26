import { ReplyChip } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './alliance.css';

/*
 * C.15 on the Mentor stage: the goal-agreement opening move (Appendix D
 * §3.4; Frontend Bible 08 §2 response area).
 *
 * On the learner's first message the Mentor restates, in the learner's own
 * words, what the session is for ("So today you want to figure out whether to
 * save for the bike, right?"). That question is the Mentor's turn and lives in
 * the speech plate; this surface carries only the two reply chips, which are
 * `option` controls within the youngest band's budget:
 *
 *   agree   "Yes, that's it"  — the lesson starts on the agreed goal.
 *   other   "Something else"  — the Mentor asks what they would like instead,
 *                               and their answer becomes the goal.
 *
 * The two chips are EQUAL: the same control, the same weight, neither
 * pre-selected, no countdown, no focus stolen, not a modal. The learner may
 * also answer in words. The chips are the shared ReplyChip (an option
 * control, never a toggle). Tokens only; every string declares its copy role.
 */

export interface GoalCheckCopy {
  choiceLabel: string;
  agree: string;
  other: string;
}

export function GoalCheckChoice({ copy, locale, dark, disabled = false, onAnswer }: {
  copy: GoalCheckCopy;
  locale: string;
  dark: boolean;
  disabled?: boolean;
  onAnswer: (agreed: boolean) => void;
}) {
  return <section className="lf-rebuild lf-alliance-panel" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen="mentor-goal-check" aria-label={copy.choiceLabel}>
    <div className="lf-alliance-chips" role="group" aria-label={copy.choiceLabel}>
      <ReplyChip className="lf-alliance-chip" data-goal="agree" disabled={disabled} onPress={() => onAnswer(true)}>{copy.agree}</ReplyChip>
      <ReplyChip className="lf-alliance-chip" data-goal="other" disabled={disabled} onPress={() => onAnswer(false)}>{copy.other}</ReplyChip>
    </div>
  </section>;
}
