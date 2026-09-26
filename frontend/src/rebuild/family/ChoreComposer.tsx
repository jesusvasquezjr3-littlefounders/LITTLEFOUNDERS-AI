import { useId, useState, type FormEvent } from 'react';
import { Button, Checkbox, Copy, InlineNotice, RadioGroup, SegmentedControl, SelectField, TextField } from '../design/controls';
import type { Session } from './familyHubApi';
import { BONUS_MAX_COINS, createChore, isValidChore, type ChoreKind, type CreatedChore } from './familyMoneyApi';
import { CoachingNote } from './CoachingNote';
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
 * milestone). S07.7 (D.23): pricing guidance sits in the composer itself.
 */

export interface ChoreComposerCopy {
  open: string; heading: string; child: string; title: string; kindLegend: string; contribution: string; contributionHint: string;
  bonus: string; bonusHint: string; choice: string; coins: string; tokenCoins: string; none: string; weekly: string; photo: string;
  submit: string; cancel: string; saving: string; added: string; needKind: string; needTitle: string; coinsRange: string; failed: string;
}

type Notice = { text: string; error: boolean } | null;
type Kind = ChoreKind;
const KINDS: readonly Kind[] = ['contribution', 'bonus'];

export function ChoreComposer({ copy, pricing, locale, dark, kids, session, onCreated }: {
  copy: ChoreComposerCopy;
  /** S07.7 (D.23): how to price a chore and choose its kind, one tap away. */
  pricing?: { open: string; close: string; lines: string[] };
  locale: string;
  dark: boolean;
  kids: { id: string; name: string }[];
  session: Session;
  onCreated: (chore: CreatedChore) => void;
}) {
  const name = useId();
  const [open, setOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState(kids[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ChoreKind | null>(null);
  const [tokenCoins, setTokenCoins] = useState(0);
  const [bonusCoins, setBonusCoins] = useState('');
  const [coinsInvalid, setCoinsInvalid] = useState(false);
  const [weekly, setWeekly] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const bonusValue = /^\d{1,3}$/.test(bonusCoins.trim()) ? Number(bonusCoins.trim()) : NaN;
  const rewardCoins = kind === 'contribution' ? tokenCoins : bonusValue;
  const kindLabel: Record<Kind, string> = { contribution: copy.contribution, bonus: copy.bonus };
  const kindHint: Record<Kind, string> = { contribution: copy.contributionHint, bonus: copy.bonusHint };

  function reset() {
    setTitle(''); setKind(null); setTokenCoins(0); setBonusCoins(''); setCoinsInvalid(false); setWeekly(false); setPhoto(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!kind) return setNotice({ text: copy.needKind, error: true });
    if (!title.trim()) return setNotice({ text: copy.needTitle, error: true });
    const input = { assignedTo, title, kind, rewardCoins, recurrence: weekly ? 'weekly' as const : 'once' as const, requiresEvidence: photo };
    if (!isValidChore(input)) {
      // A bonus task's out-of-range coins are the coins field's own error, drawn under it (02 §9.8).
      if (kind === 'bonus') { setNotice(null); return setCoinsInvalid(true); }
      return setNotice({ text: copy.failed, error: true });
    }
    setBusy(true); setNotice(null); setCoinsInvalid(false);
    const result = await createChore(input, session);
    setBusy(false);
    if (!result.ok) return setNotice({ text: copy.failed, error: true });
    setNotice({ text: copy.added.replace('{title}', result.data.task.title), error: false });
    reset();
    onCreated(result.data.task);
  }

  if (kids.length === 0) return null;
  return <section className="lf-rebuild lf-family-hub" data-family-money="chore-composer" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-label={copy.heading}>
    <Button variant={open ? 'secondary' : 'accent'} aria-expanded={open} onClick={() => { setOpen(!open); setNotice(null); }}>{open ? copy.cancel : copy.open}</Button>
    {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
    {open && <form onSubmit={(event) => void submit(event)} noValidate>
      <Copy role="heading" as="h2">{copy.heading}</Copy>
      {kids.length > 1 && <SelectField label={copy.child} value={assignedTo} disabled={busy} onChange={(event) => setAssignedTo(event.target.value)}
        options={kids.map((kid) => ({ value: kid.id, label: kid.name, role: 'data' as const }))} />}
      <TextField label={copy.title} autoComplete="off" maxLength={120} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
      {/* What each kind means, read before the choice; neither kind is preselected (Appendix G §1.2). */}
      <dl className="lf-family-money-kinds">
        {KINDS.map((value) => <div key={value} className="lf-family-money-kind" data-kind={value} data-chosen={kind === value ? 'true' : 'false'}>
          <dt data-copy-role="option">{kindLabel[value]}</dt>
          <dd data-copy-role="body">{kindHint[value]}</dd>
        </div>)}
      </dl>
      <RadioGroup legend={copy.kindLegend} help={copy.choice} name={`${name}-kind`} value={kind} disabled={busy}
        options={KINDS.map((value) => ({ value, label: kindLabel[value] }))} onValueChange={(value) => { setKind(value); setNotice(null); }} />
      {pricing && <CoachingNote embedded name="pricing" label={pricing.open} close={pricing.close} lines={pricing.lines} locale={locale} dark={dark} />}
      {kind === 'contribution' && <SegmentedControl legend={copy.tokenCoins} name={`${name}-token`} value={String(tokenCoins) as '0' | '1' | '2'} disabled={busy}
        options={([0, 1, 2] as const).map((value) => ({ value: String(value) as '0' | '1' | '2', label: value === 0 ? copy.none : String(value) }))}
        onValueChange={(value) => setTokenCoins(Number(value))} />}
      {kind === 'bonus' && <TextField label={copy.coins} type="number" inputMode="numeric" min={1} max={BONUS_MAX_COINS} step={1} value={bonusCoins} disabled={busy}
        error={coinsInvalid ? copy.coinsRange : undefined} errorLive onChange={(event) => { setBonusCoins(event.target.value); setCoinsInvalid(false); }} />}
      <div className="lf-family-money-checks">
        <Checkbox label={copy.weekly} checked={weekly} disabled={busy} onChange={(event) => setWeekly(event.target.checked)} />
        <Checkbox label={copy.photo} checked={photo} disabled={busy} onChange={(event) => setPhoto(event.target.checked)} />
      </div>
      <div className="lf-family-hub-actions">
        <Button type="submit" variant="accent" pending={busy} pendingLabel={copy.saving}>{copy.submit}</Button>
      </div>
    </form>}
  </section>;
}
