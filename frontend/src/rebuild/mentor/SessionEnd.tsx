import { useId } from 'react';
import { Button, Copy } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './sessionEnd.css';

/*
 * C.8/C.12 and C.16 on the Mentor stage (Frontend Bible 08 §3–4):
 *
 *   SessionEndChoice   the Mentor has just asked "stop here for today, or one
 *                      more?". Two EQUAL choices — same weight, same variant,
 *                      neither pre-selected, no countdown — because the offer
 *                      is never a default-accepted path. The question itself
 *                      lives in the speech plate (the Mentor's turn), so this
 *                      surface carries only the two answers.
 *   SessionClosing     the closing state: one heading and one summary line
 *                      chosen from HOW the session ended (the server's closing
 *                      script), the lesson the next session picks up from as
 *                      data, and one action back to the learning path. It
 *                      never celebrates (no celebration outside the OD-7
 *                      milestone list) and a safety stop gets its own calm
 *                      wording with no topic and no praise.
 *
 * Self-contained for the migration wave: the full composition on the stage
 * (closing gesture, placement beside the character) happens on the finished
 * design system. Tokens only; every string declares its copy role.
 */

export type ClosingScript = 'completed' | 'interrupted' | 'learner_left' | 'safety_stop';
export type EffortAct = 'corroborated' | 'recovered' | 'hint_then_solved' | 'kept_going' | 'talked_through' | 'none';

export interface SessionEndCopy {
  choiceLabel: string;
  stop: string;
  more: string;
  completedTitle: string;
  interruptedTitle: string;
  leftTitle: string;
  safetyTitle: string;
  effort: Record<EffortAct, string>;
  interruptedNext: string;
  interruptedNextNoTopic: string;
  leftBody: string;
  safetyBody: string;
  nextLabel: string;
  backToPath: string;
}

export function SessionEndChoice({ copy, locale, dark, disabled = false, onChoose }: {
  copy: SessionEndCopy;
  locale: string;
  dark: boolean;
  disabled?: boolean;
  onChoose: (stop: boolean) => void;
}) {
  return <section className="lf-rebuild lf-session-end-choice" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen="mentor-session-end-choice" aria-label={copy.choiceLabel}>
    <div className="lf-session-end-options" role="group" aria-label={copy.choiceLabel}>
      <Button disabled={disabled} onClick={() => onChoose(true)}>{copy.stop}</Button>
      <Button disabled={disabled} onClick={() => onChoose(false)}>{copy.more}</Button>
    </div>
  </section>;
}

/** The one summary line of the closing state, from the closing script (and the act a completed close named). */
export function closingLine(copy: SessionEndCopy, script: ClosingScript, effort: EffortAct | null, topic: string | null): {
  title: string;
  body: string;
  topic: string | null;
} {
  switch (script) {
    case 'completed':
      return { title: copy.completedTitle, body: copy.effort[effort ?? 'none'], topic };
    case 'interrupted':
      return { title: copy.interruptedTitle, body: topic ? copy.interruptedNext : copy.interruptedNextNoTopic, topic };
    case 'learner_left':
      return { title: copy.leftTitle, body: copy.leftBody, topic };
    case 'safety_stop':
      // Nothing on this screen invites the learner back into the lesson.
      return { title: copy.safetyTitle, body: copy.safetyBody, topic: null };
  }
}

export function SessionClosing({ copy, locale, dark, script, effort, topic, onBack }: {
  copy: SessionEndCopy;
  locale: string;
  dark: boolean;
  script: ClosingScript;
  effort: EffortAct | null;
  topic: string | null;
  onBack: () => void;
}) {
  const line = closingLine(copy, script, effort, topic);
  const titleId = useId();
  return <section className="lf-rebuild lf-session-closing" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen="mentor-session-closing" data-closing-script={script} aria-labelledby={titleId}>
    <h2 id={titleId} data-copy-role="heading">{line.title}</h2>
    <Copy role="body">{line.body}</Copy>
    {line.topic !== null && <p className="lf-session-closing-topic">
      <span data-copy-role="body">{copy.nextLabel}</span>{' '}
      <strong data-copy-role="data">{line.topic}</strong>
    </p>}
    <Button variant="accent" onClick={onBack}>{copy.backToPath}</Button>
  </section>;
}
