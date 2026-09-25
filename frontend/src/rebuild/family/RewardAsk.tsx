import { useId, useState, type FormEvent } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import { CHILD_NOTE_MAX_CHARS, CHILD_REWARD_REASONS, type ChildRewardReason } from './familyAutonomyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyAutonomy.css';

/*
 * S07.5 (D.18, D.17), asking for a reward: the child says why (one tap from
 * a short list a young child can read, nothing preselected, plus a few
 * words if they like), and that reasoning reaches the Tutor with the
 * request. The answer is the server's: approved by the child's level at
 * once, or asked and waiting. The spending limit and a hold are named
 * plainly. Nothing celebrates (OD-7). 6-9 band copy.
 */

export interface RewardAskCopy {
  ask: string; asking: string; why: string; note: string; send: string; cancel: string; pickOne: string; approved: string; asked: string;
  limit: string; hold: string; failed: string;
  saved_for_it: string; treat: string; need_it: string; for_someone: string; other: string;
}

export function RewardAsk({ copy, title, locale, dark, busy, disabled, result, onAsk }: {
  copy: RewardAskCopy;
  title: string;
  locale: string;
  dark: boolean;
  busy: boolean;
  /** Not enough coins, or already asked: the ask is not offered. */
  disabled: boolean;
  result: 'approved' | 'asked' | 'limit' | 'hold' | 'failed' | null;
  onAsk: (input: { reasonKind: ChildRewardReason; note: string | null }) => void;
}) {
  const ids = { legend: useId(), note: useId() };
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ChildRewardReason | null>(null);
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!kind) { setMissing(true); return; }
    setMissing(false);
    onAsk({ reasonKind: kind, note: note.trim() || null });
  }

  const outcome = result === 'approved' ? copy.approved : result === 'asked' ? copy.asked : null;
  const problem = result === 'limit' ? copy.limit : result === 'hold' ? copy.hold : result === 'failed' ? copy.failed : null;
  return <div className="lf-rebuild lf-family-hub lf-autonomy lf-autonomy-inline" data-autonomy="reward-ask" data-theme={dark ? 'dark' : 'light'} lang={locale} role="group" aria-label={title}>
    {outcome ? <div className="lf-family-hub-notice" role="status"><StatusMark correct /><Copy role="body">{outcome}</Copy></div>
      : open ? <form onSubmit={submit} noValidate>
        <fieldset>
          <legend id={ids.legend} data-copy-role="prompt">{copy.why}</legend>
          <div className="lf-family-hub-options" role="group" aria-labelledby={ids.legend}>
            {CHILD_REWARD_REASONS.map((k) => <Button key={k} aria-pressed={kind === k} disabled={busy} data-child-reason={k} onClick={() => { setKind(k); setMissing(false); }}>
              {kind === k && <StatusMark correct />}{copy[k]}</Button>)}
          </div>
        </fieldset>
        <label htmlFor={ids.note} data-copy-role="body">{copy.note}</label>
        <textarea data-copy-role="data" id={ids.note} maxLength={CHILD_NOTE_MAX_CHARS} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} />
        {missing && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.pickOne}</Copy></div>}
        <div className="lf-family-hub-actions">
          <Button type="submit" variant="accent" disabled={busy}>{busy ? copy.asking : copy.send}</Button>
          <Button disabled={busy} onClick={() => { setOpen(false); setKind(null); setNote(''); setMissing(false); }}>{copy.cancel}</Button>
        </div>
      </form> : <div className="lf-family-hub-actions"><Button variant="accent" disabled={busy || disabled} onClick={() => setOpen(true)}>{copy.ask}</Button></div>}
    {problem && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{problem}</Copy></div>}
  </div>;
}
