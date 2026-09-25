import { useId } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import type { MyDecision, ReasonCode } from './familyAutonomyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyAutonomy.css';

/*
 * S07.5 (D.18), the child's side of every decision: what happened to each
 * chore, reward and level request, and for every "not yet" the Tutor's
 * reason and next step, the date to ask again when there is one, and a
 * "Let's talk" button (the child starts the conversation, not only the
 * parent). Items counted under the child's own level are named as such.
 * Nothing celebrates (OD-7). 6-9 band copy.
 */

export interface DecisionNotesCopy {
  heading: string; empty: string; revisit: string; talk: string; talkAsked: string; failed: string; retry: string; loading: string;
  sent_back: string; cancelled: string; denied: string; declined: string; questioned: string; approved: string; self_logged: string;
  preapproved: string; confirmed: string; granted: string;
}
export type ChildCodesCopy = Record<ReasonCode, string>;

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function DecisionNotes({ copy, codes, locale, dark, decisions, loading, failed, busy, onRetry, onTalk }: {
  copy: DecisionNotesCopy;
  codes: ChildCodesCopy;
  locale: string;
  dark: boolean;
  decisions: MyDecision[] | null;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  onRetry: () => void;
  onTalk: (decision: MyDecision) => void;
}) {
  const heading = useId();
  const day = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const shown = (decisions ?? []).filter((d) => d.outcome !== 'approved' || d.reason !== null).slice(0, 8);

  return <section className="lf-rebuild lf-family-hub lf-autonomy" data-autonomy="notes" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={heading}>
    <h2 id={heading} data-copy-role="heading">{copy.heading}</h2>
    {failed ? <>
      <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : loading || !decisions ? <div role="status"><Copy role="body">{copy.loading}</Copy></div>
      : shown.length === 0 ? <Copy role="body">{copy.empty}</Copy> : <ul>{shown.map((d) => <li key={d.id} data-outcome={d.outcome} data-not-yet={d.notYet}>
        <div className="lf-family-hub-row">
          {d.title && <span className="ugc" data-copy-role="data">{d.title}</span>}
          <span className="lf-autonomy-chip" data-copy-role="option">{copy[d.outcome]}</span>
        </div>
        {d.reasonCode && <span data-copy-role="option">{codes[d.reasonCode]}</span>}
        {d.reason && <span className={`ugc ${d.notYet ? 'lf-autonomy-reason' : 'lf-autonomy-voice'}`} data-copy-role="data">{d.reason}</span>}
        {d.revisitOn && <Copy role="body">{fill(copy.revisit, { date: day.format(new Date(`${d.revisitOn}T00:00:00Z`)) })}</Copy>}
        {d.notYet && (d.talk ? <Copy role="body">{copy.talkAsked}</Copy>
          : <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => onTalk(d)}>{copy.talk}</Button></div>)}
      </li>)}</ul>}
  </section>;
}
