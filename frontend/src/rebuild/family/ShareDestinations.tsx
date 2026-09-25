import { useId, useState, type FormEvent } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import { DESTINATION_KINDS, DESTINATION_TITLE_MAX, GIFT_NOTE_MAX, type Destination, type DestinationKind, type Gift, type ShareView, type Split } from './moneyHabitsApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyMoney.css';
import './moneyHabits.css';

/*
 * S07.4 (D.14), the Tutor's side: choose the real places a child's Share coins
 * go (a cause, a gift, a community action), then, for each pledge, say what
 * the family actually did, or return the coins with a reason. The note is
 * required either way, because it is what the child reads. The panel also
 * shows the child's usual split, read-only (D.13: only the child sets it).
 * Honest (D.7): coins are never sent anywhere. Adult band copy.
 */

export interface ShareDestinationsCopy {
  open: string; close: string; heading: string; body: string; honest: string; placeName: string; kind: string; add: string; added: string;
  limit: string; remove: string; removed: string; empty: string; waitingHeading: string; waiting: string; noneWaiting: string; markGiven: string;
  whatHappened: string; giveBack: string; whyBack: string; confirm: string; cancel: string; noteRequired: string; givenNotice: string;
  returnedNotice: string; doneLine: string; returnedLine: string; invalid: string; loading: string; failed: string; retry: string;
  charity: string; gift: string; community: string; usualSplit: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function ShareDestinations({ copy, kidName, locale, dark, open, view, usual, loading, failed, busy, notice,
  onToggle, onRetry, onAdd, onRemove, onSettle }: {
  copy: ShareDestinationsCopy;
  kidName: string;
  locale: string;
  dark: boolean;
  open: boolean;
  view: ShareView | null;
  /** The child's usual split in percent, read-only. */
  usual: Split | null;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onToggle: () => void;
  onRetry: () => void;
  onAdd: (input: { title: string; kind: DestinationKind }) => void;
  onRemove: (destination: Destination) => void;
  onSettle: (gift: Gift, outcome: 'given' | 'returned', note: string) => void;
}) {
  const ids = { heading: useId(), place: useId(), kind: useId(), note: useId() };
  const [place, setPlace] = useState('');
  const [kind, setKind] = useState<DestinationKind | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [settling, setSettling] = useState<{ giftId: string; outcome: 'given' | 'returned' } | null>(null);
  const [note, setNote] = useState('');
  const [noteMissing, setNoteMissing] = useState(false);
  const kindLabel: Record<DestinationKind, string> = { charity: copy.charity, gift: copy.gift, community: copy.community };
  const tutorPlaces = view?.destinations.filter((d) => d.chosenBy === 'tutor' && d.status === 'active') ?? [];
  const byId = new Map((view?.destinations ?? []).map((d) => [d.id, d]));
  const waiting = view?.gifts.filter((g) => g.status === 'pledged' && byId.get(g.destinationId)?.chosenBy === 'tutor') ?? [];
  const settled = view?.gifts.filter((g) => g.status !== 'pledged').slice(0, 10) ?? [];
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });

  function add(event: FormEvent) {
    event.preventDefault();
    const title = place.trim();
    if (!title || title.length > DESTINATION_TITLE_MAX || !kind) { setInvalid(true); return; }
    setInvalid(false);
    onAdd({ title, kind });
    setPlace(''); setKind(null);
  }

  function settle(event: FormEvent, gift: Gift) {
    event.preventDefault();
    if (!settling) return;
    if (!note.trim()) { setNoteMissing(true); return; }
    setNoteMissing(false);
    onSettle(gift, settling.outcome, note.trim());
    setSettling(null); setNote('');
  }

  return <section className="lf-rebuild lf-family-hub lf-money-habits" data-money-habits="share-destinations" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-labelledby={ids.heading}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.open}</Button>
    {open && <>
      <h2 id={ids.heading} data-copy-role="heading">{fill(copy.heading, { name: kidName })}</h2>
      <Copy role="body">{copy.body}</Copy>
      <span className="lf-money-habits-chip" data-copy-role="body">{copy.honest}</span>
      {failed ? <>
        <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
        <Button onClick={onRetry}>{copy.retry}</Button>
      </> : loading || !view ? <div role="status"><Copy role="body">{copy.loading}</Copy></div> : <>
        {usual && <span data-copy-role="data" className="lf-family-hub-muted">
          {fill(copy.usualSplit, { save: Math.round(usual.save / 10), spend: Math.round(usual.spend / 10), share: Math.round(usual.share / 10) })}</span>}
        {notice && <div className="lf-family-hub-notice" role={notice.error ? 'alert' : 'status'}><StatusMark correct={!notice.error} /><Copy role="body">{notice.text}</Copy></div>}

        <section aria-label={copy.waitingHeading}>
          <h3 data-copy-role="heading">{copy.waitingHeading}</h3>
          {waiting.length === 0 ? <Copy role="body">{copy.noneWaiting}</Copy> : <ul>{waiting.map((g) => <li key={g.id} data-gift-status="pledged">
            <span className="ugc" data-copy-role="data">{fill(copy.waiting, { count: g.amount, place: byId.get(g.destinationId)?.title ?? '' })}</span>
            <time data-copy-role="data" className="lf-family-hub-muted" dateTime={g.pledgedAt}>{date.format(new Date(g.pledgedAt))}</time>
            {settling?.giftId === g.id ? <form onSubmit={(event) => settle(event, g)} noValidate>
              <label htmlFor={ids.note} data-copy-role="prompt">{settling.outcome === 'given' ? copy.whatHappened : copy.whyBack}</label>
              <textarea id={ids.note} maxLength={GIFT_NOTE_MAX} value={note} disabled={busy} aria-invalid={noteMissing ? true : undefined}
                onChange={(event) => setNote(event.target.value)} />
              {noteMissing && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.noteRequired}</Copy></div>}
              <div className="lf-family-hub-actions">
                <Button type="submit" variant="success" disabled={busy}>{copy.confirm}</Button>
                <Button disabled={busy} onClick={() => { setSettling(null); setNote(''); setNoteMissing(false); }}>{copy.cancel}</Button>
              </div>
            </form> : <div className="lf-family-hub-actions">
              <Button variant="success" disabled={busy} onClick={() => { setSettling({ giftId: g.id, outcome: 'given' }); setNote(''); setNoteMissing(false); }}>{copy.markGiven}</Button>
              <Button disabled={busy} onClick={() => { setSettling({ giftId: g.id, outcome: 'returned' }); setNote(''); setNoteMissing(false); }}>{copy.giveBack}</Button>
            </div>}
          </li>)}</ul>}
        </section>

        {tutorPlaces.length === 0 ? <Copy role="body">{copy.empty}</Copy> : <ul>{tutorPlaces.map((d) => <li key={d.id} data-destination-kind={d.kind}>
          <div className="lf-family-hub-row">
            <span className="ugc" data-copy-role="data">{d.title}</span>
            <span className="lf-money-habits-chip" data-copy-role="option">{kindLabel[d.kind]}</span>
          </div>
          <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => onRemove(d)}>{copy.remove}</Button></div>
        </li>)}</ul>}

        <form onSubmit={add} noValidate>
          <div className="lf-field">
            <label htmlFor={ids.place} data-copy-role="body">{copy.placeName}</label>
            <input id={ids.place} type="text" autoComplete="off" maxLength={DESTINATION_TITLE_MAX} value={place} disabled={busy}
              aria-invalid={invalid && !place.trim() ? true : undefined} onChange={(event) => setPlace(event.target.value)} />
          </div>
          <fieldset>
            <legend id={ids.kind} data-copy-role="body">{copy.kind}</legend>
            <div className="lf-family-hub-options" role="group" aria-labelledby={ids.kind}>
              {DESTINATION_KINDS.map((k) => <Button key={k} aria-pressed={kind === k} disabled={busy} onClick={() => setKind(k)}>
                {kind === k && <StatusMark correct />}{kindLabel[k]}</Button>)}
            </div>
          </fieldset>
          {invalid && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.invalid}</Copy></div>}
          <div className="lf-family-hub-actions"><Button type="submit" variant="accent" disabled={busy}>{copy.add}</Button></div>
        </form>

        {settled.length > 0 && <ul>{settled.map((g) => <li key={g.id} data-gift-status={g.status}>
          <span className="ugc" data-copy-role="data">{fill(g.status === 'given' ? copy.doneLine : copy.returnedLine, { count: g.amount, place: byId.get(g.destinationId)?.title ?? '' })}</span>
          {g.note && <span className="ugc lf-family-hub-muted" data-copy-role="data">{g.note}</span>}
        </li>)}</ul>}
      </>}
    </>}
  </section>;
}
