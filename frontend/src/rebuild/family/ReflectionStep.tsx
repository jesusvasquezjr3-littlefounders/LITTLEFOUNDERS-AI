import { useId, useState } from 'react';
import { Button } from '../design/controls';
import type { Reflection } from './familyAutonomyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyGovernance.css';

/*
 * S07.7 (D.23), the reflective prompt (Appendix G §4.2). It comes before every
 * Tutor decision on a chore, a reward, a level request or a self-directed
 * item, prior to and separate from the reason the child reads (D.18): the
 * Tutor is asked what they would tell the child about it. What they write
 * stays in this component. It leaves the browser only if the Tutor chooses to
 * send it as their note (a yes) or to use it as the reason (a "not yet");
 * otherwise only the kind of answer is reported ('written' or 'skipped').
 * Adult band copy; no celebration.
 */

export interface ReflectionCopy { prompt: string; hint: string; continue: string; share: string; useAsReason: string; back: string }

export function ReflectionStep({ copy, name, heading, notYet, noteAllowed, busy, onContinue, onBack }: {
  copy: ReflectionCopy;
  /** The child the decision is about. */
  name: string;
  /** A short line naming what is being decided (the chore or reward title). */
  heading?: string | null;
  /** True before a "not yet": the words may become the reason instead of a note. */
  notYet: boolean;
  /** Whether this decision can carry a note to the child. */
  noteAllowed: boolean;
  busy: boolean;
  onContinue: (reflection: Reflection, words: string | null) => void;
  onBack: () => void;
}) {
  const ids = { text: useId(), hint: useId() };
  const [words, setWords] = useState('');
  const written = words.trim().length > 0;
  const canShare = written && (notYet || noteAllowed);
  return <div className="lf-governance-reflection" data-reflection="step">
    {heading ? <span className="ugc lf-family-hub-muted" data-copy-role="data">{heading}</span> : null}
    <div className="lf-field">
      <label htmlFor={ids.text} data-copy-role="prompt">{copy.prompt.replace('{name}', name)}</label>
      <textarea id={ids.text} data-copy-role="data" maxLength={240} value={words} disabled={busy} aria-describedby={ids.hint}
        onChange={(event) => setWords(event.target.value)} />
      <p id={ids.hint} className="lf-family-hub-muted" data-copy-role="body">{copy.hint}</p>
    </div>
    <div className="lf-family-hub-actions">
      <Button variant="accent" disabled={busy} data-reflection-choice={written ? 'written' : 'skipped'}
        onClick={() => onContinue(written ? 'written' : 'skipped', null)}>{copy.continue}</Button>
      {canShare && <Button disabled={busy} data-reflection-choice="shared" onClick={() => onContinue('shared', words.trim())}>
        {notYet ? copy.useAsReason : copy.share}</Button>}
      <Button disabled={busy} onClick={onBack}>{copy.back}</Button>
    </div>
  </div>;
}
