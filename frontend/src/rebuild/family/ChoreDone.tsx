import { useId, useState, type FormEvent } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import { CHILD_NOTE_MAX_CHARS } from './familyAutonomyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyAutonomy.css';

/*
 * S07.5 (D.17, D.18), marking a chore done: one tap, or with a short note
 * for the Tutor in the child's own words (surfaced to the Tutor at decision
 * time). Afterwards the child reads what the server decided: counted under
 * their level (the Tutor looks later) or sent to the Tutor. 6-9 band copy.
 */

export interface ChoreDoneCopy { markDone: string; marking: string; addNote: string; notePrompt: string; cancel: string; counted: string; sent: string; failed: string }

export function ChoreDone({ copy, title, locale, dark, busy, result, onDone }: {
  copy: ChoreDoneCopy;
  title: string;
  locale: string;
  dark: boolean;
  busy: boolean;
  /** What the server decided for this chore, once it answered. */
  result: 'counted' | 'sent' | 'failed' | null;
  onDone: (note: string | null) => void;
}) {
  const ids = { note: useId() };
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    onDone(note.trim() || null);
  }

  return <div className="lf-rebuild lf-family-hub lf-autonomy lf-autonomy-inline" data-autonomy="chore-done" data-theme={dark ? 'dark' : 'light'} lang={locale} role="group" aria-label={title}>
    {result === 'counted' || result === 'sent'
      ? <div className="lf-family-hub-notice" role="status"><StatusMark correct /><Copy role="body">{result === 'counted' ? copy.counted : copy.sent}</Copy></div>
      : writing ? <form onSubmit={submit} noValidate>
        <label htmlFor={ids.note} data-copy-role="prompt">{copy.notePrompt}</label>
        <textarea data-copy-role="data" id={ids.note} maxLength={CHILD_NOTE_MAX_CHARS} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} />
        <div className="lf-family-hub-actions">
          <Button type="submit" variant="success" disabled={busy}>{busy ? copy.marking : copy.markDone}</Button>
          <Button disabled={busy} onClick={() => { setWriting(false); setNote(''); }}>{copy.cancel}</Button>
        </div>
      </form> : <div className="lf-family-hub-actions">
        <Button variant="success" disabled={busy} onClick={() => onDone(null)}>{busy ? copy.marking : copy.markDone}</Button>
        <Button disabled={busy} onClick={() => setWriting(true)}>{copy.addNote}</Button>
      </div>}
    {result === 'failed' && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>}
  </div>;
}
