import { useId, useState, type FormEvent } from 'react';
import { Button, InlineNotice, RadioGroup, TextAreaField } from '../design/controls';
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
 *
 * S03.6: the reasons are the shared RadioGroup; a missing pick is a retry
 * notice and a limit or hold is information, never the error hue (SH-02);
 * only a failed request is an error.
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
  const name = useId();
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
    {outcome ? <InlineNotice tone="success" live>{outcome}</InlineNotice>
      : open ? <form onSubmit={submit} noValidate>
        <RadioGroup legend={copy.why} name={name} value={kind} disabled={busy}
          options={CHILD_REWARD_REASONS.map((k) => ({ value: k, label: copy[k] }))} onValueChange={(k) => { setKind(k); setMissing(false); }} />
        <TextAreaField data-copy-role="data" label={copy.note} maxLength={CHILD_NOTE_MAX_CHARS} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} />
        {missing && <InlineNotice tone="retry" live>{copy.pickOne}</InlineNotice>}
        <div className="lf-family-hub-actions">
          <Button type="submit" variant="accent" pending={busy} pendingLabel={copy.asking}>{copy.send}</Button>
          <Button disabled={busy} onClick={() => { setOpen(false); setKind(null); setNote(''); setMissing(false); }}>{copy.cancel}</Button>
        </div>
      </form> : <div className="lf-family-hub-actions"><Button variant="accent" disabled={busy || disabled} onClick={() => setOpen(true)}>{copy.ask}</Button></div>}
    {problem && <InlineNotice tone={result === 'failed' ? 'error' : 'info'} live>{problem}</InlineNotice>}
  </div>;
}
