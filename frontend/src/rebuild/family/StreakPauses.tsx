import { useId, useState, type FormEvent } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import type { ChoreStreak, StreakPause } from './familyMoneyApi';
import { PAUSE_MAX_BACKDATE_DAYS, PAUSE_MAX_DAYS } from './familyMoneyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyMoney.css';

/*
 * S07.3 (D.2, Frontend Bible 02 §9.6 rule 3): a Tutor pauses a child's chore
 * streak for a holiday. Paused days neither break the streak nor add to it.
 * A pause lasts 1-21 days and may start up to 7 days back (a pause set after
 * a trip is still honest, because it can never add days). Client validation
 * mirrors the server's; the database enforces every rule for every writer.
 */

export interface StreakPausesCopy {
  open: string; close: string; heading: string; body: string; current: string; restingBest: string; from: string; to: string; submit: string;
  invalid: string; overlap: string; limit: string; saved: string; running: string; upcoming: string; end: string; cancel: string;
  ended: string; cancelled: string; over: string; loading: string; failed: string; saveFailed: string; retry: string;
}

export type PauseNotice = { text: string; error: boolean } | null;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const DAY_MS = 86_400_000;
const epoch = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** The same bounds as Core and the database, measured from the child's local today. */
export function pauseIsValid(startsOn: string, endsOn: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return false;
  const length = epoch(endsOn) - epoch(startsOn) + 1;
  return length >= 1 && length <= PAUSE_MAX_DAYS && epoch(startsOn) >= epoch(today) - PAUSE_MAX_BACKDATE_DAYS;
}

export function StreakPauses({ copy, locale, dark, kidName, open, loading, failed, busy, notice, streak, pauses, onToggle, onRetry, onPause, onEnd }: {
  copy: StreakPausesCopy;
  locale: string;
  dark: boolean;
  kidName: string;
  open: boolean;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: PauseNotice;
  streak: ChoreStreak | null;
  pauses: StreakPause[];
  onToggle: () => void;
  onRetry: () => void;
  onPause: (input: { startsOn: string; endsOn: string }) => void;
  onEnd: (pause: StreakPause) => void;
}) {
  const ids = { from: useId(), to: useId() };
  const today = streak?.today ?? '';
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [invalid, setInvalid] = useState(false);
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const show = (day: string) => date.format(new Date(`${day}T00:00:00Z`));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!pauseIsValid(startsOn, endsOn, today)) return setInvalid(true);
    setInvalid(false);
    onPause({ startsOn, endsOn });
  }

  return <section className="lf-rebuild lf-family-hub lf-family-money-hub" data-family-money="streak-pauses" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-label={fill(copy.heading, { name: kidName })}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.open}</Button>
    {open && <>
      <h2 data-copy-role="heading"><span className="ugc">{fill(copy.heading, { name: kidName })}</span></h2>
      {failed ? <>
        <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
        <Button onClick={onRetry}>{copy.retry}</Button>
      </> : loading || !streak ? <div role="status"><Copy role="body">{copy.loading}</Copy></div> : <>
        <Copy role="body">{copy.body}</Copy>
        <span data-copy-role="data">{streak.status === 'resting' ? fill(copy.restingBest, { count: streak.best }) : fill(copy.current, { count: streak.current })}</span>
        {notice && <div className="lf-family-hub-notice" role={notice.error ? 'alert' : 'status'}>
          <StatusMark correct={!notice.error} /><Copy role="body">{notice.text}</Copy>
        </div>}
        {pauses.length > 0 && <ul>{pauses.map((pause) => <li key={pause.id} data-pause-state={pause.state}>
          <span data-copy-role="data">{pause.state === 'running' ? fill(copy.running, { date: show(pause.endsOn) }) : fill(copy.upcoming, { start: show(pause.startsOn), end: show(pause.endsOn) })}</span>
          <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => onEnd(pause)}>{pause.state === 'running' ? copy.end : copy.cancel}</Button></div>
        </li>)}</ul>}
        <form onSubmit={submit} noValidate>
          <div className="lf-family-money-row">
            <div className="lf-field">
              <label htmlFor={ids.from} data-copy-role="body">{copy.from}</label>
              <input id={ids.from} type="date" value={startsOn} disabled={busy} aria-invalid={invalid || undefined} onChange={(event) => setStartsOn(event.target.value)} />
            </div>
            <div className="lf-field">
              <label htmlFor={ids.to} data-copy-role="body">{copy.to}</label>
              <input id={ids.to} type="date" value={endsOn} min={startsOn || undefined} disabled={busy} aria-invalid={invalid || undefined} onChange={(event) => setEndsOn(event.target.value)} />
            </div>
          </div>
          {invalid && <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.invalid}</Copy></div>}
          <div className="lf-family-hub-actions"><Button type="submit" variant="accent" disabled={busy}>{copy.submit}</Button></div>
        </form>
      </>}
    </>}
  </section>;
}
