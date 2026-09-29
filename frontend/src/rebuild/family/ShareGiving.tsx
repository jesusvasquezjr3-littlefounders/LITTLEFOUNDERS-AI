import { useId, useState, type FormEvent } from 'react';
import { Button, ChipGroup, ChoiceChip, CoinAmount, Copy, ErrorState, InlineNotice, LoadingState, SegmentedControl, TextAreaField, TextField } from '../design/controls';
import { DESTINATION_KINDS, DESTINATION_TITLE_MAX, GIFT_MAX_COINS, GIFT_NOTE_MAX, type Destination, type DestinationKind, type Gift, type ShareView } from './moneyHabitsApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyMoney.css';
import './moneyHabits.css';
import { PocketMark } from './PocketMark';

/*
 * S07.4 (D.14): the Share pocket's real destination, for the child (Appendix
 * G §1.4: a label that never cashes out teaches a child not to trust the
 * others). The child directs Share coins to a place their family chose; the
 * coins leave Share at once and the gift waits until whoever chose the place
 * records what really happened, which the child then reads here. A pledge
 * can be taken back before it happens. A self-registered teen chooses their
 * own places and logs what they did (OD-3 Option B). Honest (D.7): coins
 * stay in the app; the family does the real thing. No celebration, no lives.
 * Copy: youngest band (6-9); the teen's own-place lines: 13-17.
 */

export interface ShareGivingCopy {
  heading: string; body: string; honest: string; available: string; where: string; amount: string; give: string; giving: string; pledged: string;
  empty: string; historyHeading: string; waiting: string; given: string; returned: string; note: string; takeBack: string; takenBack: string;
  notEnough: string; invalid: string; loading: string; failed: string; retry: string; charity: string; gift: string; community: string; coins: string;
}
export interface ShareTeenCopy {
  body: string; honest: string; empty: string; addHeading: string; placeName: string; kind: string; add: string; added: string; limit: string;
  remove: string; removed: string; markGiven: string; whatHappened: string; saveGiven: string; givenNotice: string; noteRequired: string; invalidPlace: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function ShareGiving({ copy, teenCopy, locale, dark, available, view, loading, failed, busy, notice, selfDirected,
  onRetry, onPledge, onTakeBack, onAddPlace, onRemovePlace, onMarkGiven }: {
  copy: ShareGivingCopy;
  teenCopy: ShareTeenCopy;
  locale: string;
  dark: boolean;
  /** Coins in Share now (the wallet's balance). */
  available: number;
  view: ShareView | null;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  /** A self-registered teen: chooses their own places and logs what they did. */
  selfDirected: boolean;
  onRetry: () => void;
  onPledge: (destinationId: string, amount: number) => void;
  onTakeBack: (gift: Gift) => void;
  onAddPlace: (input: { title: string; kind: DestinationKind }) => void;
  onRemovePlace: (destination: Destination) => void;
  onMarkGiven: (gift: Gift, note: string) => void;
}) {
  const ids = { heading: useId(), kind: useId() };
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [place, setPlace] = useState('');
  const [kind, setKind] = useState<DestinationKind | null>(null);
  const [placeInvalid, setPlaceInvalid] = useState(false);
  const [logging, setLogging] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteMissing, setNoteMissing] = useState(false);
  const kindLabel: Record<DestinationKind, string> = { charity: copy.charity, gift: copy.gift, community: copy.community };
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const active = view?.destinations.filter((d) => d.status === 'active') ?? [];
  const byId = new Map((view?.destinations ?? []).map((d) => [d.id, d]));
  const status = { pledged: copy.waiting, given: copy.given, returned: copy.returned };

  function pledge(event: FormEvent) {
    event.preventDefault();
    const n = /^\d{1,4}$/.test(amount.trim()) ? Number(amount.trim()) : null;
    const chosen = destinationId && active.some((d) => d.id === destinationId) ? destinationId : null;
    if (!chosen || n === null || n < 1 || n > Math.min(available, GIFT_MAX_COINS)) { setInvalid(true); return; }
    setInvalid(false);
    onPledge(chosen, n);
    setAmount('');
  }

  function addPlace(event: FormEvent) {
    event.preventDefault();
    const title = place.trim();
    if (!title || title.length > DESTINATION_TITLE_MAX || !kind) { setPlaceInvalid(true); return; }
    setPlaceInvalid(false);
    onAddPlace({ title, kind });
    setPlace(''); setKind(null);
  }

  function logGiven(event: FormEvent, gift: Gift) {
    event.preventDefault();
    if (!note.trim()) { setNoteMissing(true); return; }
    setNoteMissing(false);
    onMarkGiven(gift, note.trim());
    setLogging(null); setNote('');
  }

  return <section className="lf-rebuild lf-family-hub lf-money-habits" data-money-habits="share-giving" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-labelledby={ids.heading} data-pocket="share">
    <div className="lf-pocket-heading"><PocketMark pocket="share" /><h2 id={ids.heading} data-copy-role="heading">{copy.heading}</h2></div>
    <Copy role="body">{selfDirected ? teenCopy.body : copy.body}</Copy>
    <span className="lf-money-habits-chip" data-copy-role="body">{selfDirected ? teenCopy.honest : copy.honest}</span>
    {failed ? <ErrorState heading={copy.failed} retryLabel={copy.retry} retryingLabel={copy.loading} onRetry={onRetry} />
      : loading || !view ? <LoadingState label={copy.loading} lines={2} /> : <>
      <p className="lf-money-habits-available" data-copy-role="data">{fill(copy.available, { count: available })}</p>
      {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}

      {active.length === 0 ? <Copy role="body">{selfDirected ? teenCopy.empty : copy.empty}</Copy> : <form onSubmit={pledge} noValidate>
        {/* The family's places are pick chips: named by the family, as many as they chose, wrapping on a phone. */}
        <fieldset>
          <legend data-copy-role="body">{copy.where}</legend>
          <ChipGroup>
            {active.map((d) => <ChoiceChip key={d.id} selected={destinationId === d.id} disabled={busy} onToggle={() => { setDestinationId(d.id); setInvalid(false); }}>
              <span className="ugc">{d.title}</span>
            </ChoiceChip>)}
          </ChipGroup>
        </fieldset>
        <TextField label={copy.amount} type="number" inputMode="numeric" min={1} max={Math.max(1, Math.min(available, GIFT_MAX_COINS))} step={1} value={amount}
          disabled={busy || available < 1} onChange={(event) => setAmount(event.target.value)} />
        {/* One sentence for the pair: a chosen place and a whole number of coins the Share pocket holds. */}
        {invalid && <InlineNotice tone="error" live>{copy.invalid}</InlineNotice>}
        <div className="lf-family-hub-actions"><Button type="submit" variant="accent" disabled={available < 1} pending={busy} pendingLabel={copy.giving}>{copy.give}</Button></div>
      </form>}

      {selfDirected && <form onSubmit={addPlace} noValidate aria-label={teenCopy.addHeading}>
        <h3 data-copy-role="heading">{teenCopy.addHeading}</h3>
        <TextField label={teenCopy.placeName} autoComplete="off" maxLength={DESTINATION_TITLE_MAX} value={place} disabled={busy}
          onChange={(event) => setPlace(event.target.value)} />
        <SegmentedControl legend={teenCopy.kind} name={ids.kind} value={kind} disabled={busy}
          options={DESTINATION_KINDS.map((k) => ({ value: k, label: kindLabel[k] }))} onValueChange={setKind} />
        {placeInvalid && <InlineNotice tone="error" live>{teenCopy.invalidPlace}</InlineNotice>}
        <div className="lf-family-hub-actions"><Button type="submit" disabled={busy}>{teenCopy.add}</Button></div>
        {active.length > 0 && <ul>{active.filter((d) => d.chosenBy === 'holder').map((d) => <li key={d.id} data-destination-kind={d.kind}>
          <div className="lf-family-hub-row">
            <span className="ugc" data-copy-role="data">{d.title}</span>
            <span className="lf-money-habits-chip" data-copy-role="option">{kindLabel[d.kind]}</span>
          </div>
          <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => onRemovePlace(d)}>{teenCopy.remove}</Button></div>
        </li>)}</ul>}
      </form>}

      {view.gifts.length > 0 && <section aria-label={copy.historyHeading}>
        <h3 data-copy-role="heading">{copy.historyHeading}</h3>
        <ul>{view.gifts.map((g) => {
          const place = byId.get(g.destinationId);
          const ownPlace = selfDirected && place?.chosenBy === 'holder';
          return <li key={g.id} data-gift-status={g.status}>
            <div className="lf-family-hub-row">
              <span className="ugc" data-copy-role="data">{place?.title ?? ''}</span>
              <CoinAmount className="lf-family-hub-amount">{fill(copy.coins, { count: g.amount })}</CoinAmount>
              <span className="lf-money-habits-chip" data-copy-role="option">{status[g.status]}</span>
            </div>
            {g.note && g.status === 'given' && <span className="ugc" data-copy-role="data">{fill(copy.note, { note: g.note })}</span>}
            <time data-copy-role="data" className="lf-family-hub-muted" dateTime={g.settledAt ?? g.pledgedAt}>{date.format(new Date(g.settledAt ?? g.pledgedAt))}</time>
            {g.status === 'pledged' && <div className="lf-family-hub-actions">
              {ownPlace && <Button variant="success" disabled={busy} aria-expanded={logging === g.id}
                onClick={() => { setLogging(logging === g.id ? null : g.id); setNote(''); setNoteMissing(false); }}>{teenCopy.markGiven}</Button>}
              <Button disabled={busy} onClick={() => onTakeBack(g)}>{copy.takeBack}</Button>
            </div>}
            {ownPlace && logging === g.id && <form onSubmit={(event) => logGiven(event, g)} noValidate>
              <TextAreaField label={teenCopy.whatHappened} maxLength={GIFT_NOTE_MAX} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} />
              {noteMissing && <InlineNotice tone="error" live>{teenCopy.noteRequired}</InlineNotice>}
              <div className="lf-family-hub-actions"><Button type="submit" variant="success" disabled={busy}>{teenCopy.saveGiven}</Button></div>
            </form>}
          </li>;
        })}</ul>
      </section>}
    </>}
  </section>;
}
