import { useId, useState, type FormEvent } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import type { Session } from './familyHubApi';
import { BONUS_MAX_COINS, createChore, isValidChore, type ChoreKind, type CreatedChore } from './familyMoneyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyMoney.css';

/*
 * S07.3 (D.10): the Tutor's chore composer. Every chore is tagged as an
 * expected family contribution (unpaid, or a token 1-2 coins) or a bonus task
 * (paid at the rate the Tutor sets). Neither kind is preselected: the SPEC
 * asks that this be presented as a deliberate family choice, "not a
 * scientifically mandated ratio" (Appendix G §1.2), so the composer says so
 * in one line and makes the Tutor pick. Client validation mirrors the server;
 * Core and the database remain the boundary. No celebration (not an OD-7
 * milestone).
 */

export interface ChoreComposerCopy {
  open: string; heading: string; child: string; title: string; kindLegend: string; contribution: string; contributionHint: string;
  bonus: string; bonusHint: string; choice: string; coins: string; tokenCoins: string; none: string; weekly: string; photo: string;
  submit: string; cancel: string; saving: string; added: string; needKind: string; needTitle: string; coinsRange: string; failed: string;
}

type Notice = { text: string; error: boolean } | null;

export function ChoreComposer({ copy, locale, dark, kids, session, onCreated }: {
  copy: ChoreComposerCopy;
  locale: string;
  dark: boolean;
  kids: { id: string; name: string }[];
  session: Session;
  onCreated: (chore: CreatedChore) => void;
}) {
  const ids = { child: useId(), title: useId(), coins: useId(), kind: useId() };
  const [open, setOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState(kids[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ChoreKind | null>(null);
  const [tokenCoins, setTokenCoins] = useState(0);
  const [bonusCoins, setBonusCoins] = useState('');
  const [weekly, setWeekly] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const bonusValue = /^\d{1,3}$/.test(bonusCoins.trim()) ? Number(bonusCoins.trim()) : NaN;
  const rewardCoins = kind === 'contribution' ? tokenCoins : bonusValue;

  function reset() {
    setTitle(''); setKind(null); setTokenCoins(0); setBonusCoins(''); setWeekly(false); setPhoto(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!kind) return setNotice({ text: copy.needKind, error: true });
    if (!title.trim()) return setNotice({ text: copy.needTitle, error: true });
    const input = { assignedTo, title, kind, rewardCoins, recurrence: weekly ? 'weekly' as const : 'once' as const, requiresEvidence: photo };
    if (!isValidChore(input)) return setNotice({ text: kind === 'bonus' ? copy.coinsRange : copy.failed, error: true });
    setBusy(true); setNotice(null);
    const result = await createChore(input, session);
    setBusy(false);
    if (!result.ok) return setNotice({ text: copy.failed, error: true });
    setNotice({ text: copy.added.replace('{title}', result.data.task.title), error: false });
    reset();
    onCreated(result.data.task);
  }

  if (kids.length === 0) return null;
  return <section className="lf-rebuild lf-family-hub lf-family-money-hub" data-family-money="chore-composer" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-label={copy.heading}>
    <Button variant={open ? 'secondary' : 'accent'} aria-expanded={open} onClick={() => { setOpen(!open); setNotice(null); }}>{open ? copy.cancel : copy.open}</Button>
    {notice && <div className="lf-family-hub-notice" role={notice.error ? 'alert' : 'status'}>
      <StatusMark correct={!notice.error} /><Copy role="body">{notice.text}</Copy>
    </div>}
    {open && <form onSubmit={(event) => void submit(event)} noValidate>
      <Copy role="heading" as="h2">{copy.heading}</Copy>
      {kids.length > 1 && <div className="lf-field">
        <label htmlFor={ids.child} data-copy-role="body">{copy.child}</label>
        <select id={ids.child} value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} disabled={busy} className="ugc" data-copy-role="data">
          {kids.map((kid) => <option key={kid.id} value={kid.id}>{kid.name}</option>)}
        </select>
      </div>}
      <div className="lf-field">
        <label htmlFor={ids.title} data-copy-role="body">{copy.title}</label>
        <input id={ids.title} type="text" autoComplete="off" maxLength={120} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <fieldset>
        <legend id={ids.kind} data-copy-role="body">{copy.kindLegend}</legend>
        <Copy role="body">{copy.choice}</Copy>
        <div className="lf-family-money-kinds" role="group" aria-labelledby={ids.kind}>
          {(['contribution', 'bonus'] as const).map((value) => <button key={value} type="button" className="lf-family-money-kind" aria-pressed={kind === value}
            data-copy-role="option" data-kind={value} disabled={busy} onClick={() => { setKind(value); setNotice(null); }}>
            <strong>{kind === value && <StatusMark correct />}{value === 'contribution' ? copy.contribution : copy.bonus}</strong>
            <span data-copy-role="body">{value === 'contribution' ? copy.contributionHint : copy.bonusHint}</span>
          </button>)}
        </div>
      </fieldset>
      {kind === 'contribution' && <fieldset>
        <legend data-copy-role="body">{copy.tokenCoins}</legend>
        <div className="lf-family-hub-options" role="group">
          {[0, 1, 2].map((value) => <Button key={value} aria-pressed={tokenCoins === value} disabled={busy} onClick={() => setTokenCoins(value)}>
            {tokenCoins === value && <StatusMark correct />}{value === 0 ? copy.none : String(value)}
          </Button>)}
        </div>
      </fieldset>}
      {kind === 'bonus' && <div className="lf-field">
        <label htmlFor={ids.coins} data-copy-role="body">{copy.coins}</label>
        <input id={ids.coins} type="number" inputMode="numeric" min={1} max={BONUS_MAX_COINS} step={1} value={bonusCoins} disabled={busy}
          aria-invalid={bonusCoins !== '' && !(bonusValue >= 1 && bonusValue <= BONUS_MAX_COINS) ? true : undefined}
          onChange={(event) => setBonusCoins(event.target.value)} />
      </div>}
      <div className="lf-family-hub-options" role="group">
        <Button aria-pressed={weekly} disabled={busy} onClick={() => setWeekly(!weekly)}>{weekly && <StatusMark correct />}{copy.weekly}</Button>
        <Button aria-pressed={photo} disabled={busy} onClick={() => setPhoto(!photo)}>{photo && <StatusMark correct />}{copy.photo}</Button>
      </div>
      <div className="lf-family-hub-actions">
        <Button type="submit" variant="accent" disabled={busy}>{busy ? copy.saving : copy.submit}</Button>
      </div>
    </form>}
  </section>;
}
