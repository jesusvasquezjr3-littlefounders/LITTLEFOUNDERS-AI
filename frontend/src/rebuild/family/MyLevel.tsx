import { useId, useState, type FormEvent } from 'react';
import { Button, Copy, InlineNotice, LoadingState, StatusMark, TextAreaField } from '../design/controls';
import { levelName, type LevelsCopy } from './AutonomyLadder';
import { CHILD_NOTE_MAX_CHARS, type Autonomy, type LevelChange } from './familyAutonomyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyAutonomy.css';

/*
 * S07.5 (D.17), the child's own level: its name and what it lets them do
 * without asking, their own progress toward the next level (numbers they
 * can check themselves: a self-monitoring tool, Appendix G §4.4), a way to
 * ask for the next level in their own words at any time (the child-voice
 * mechanism), and a way to step down on their own. When a level went down,
 * they read who moved it and why. Nothing celebrates (OD-7). 6-9 band copy.
 */

export interface MyLevelCopy {
  heading: string; approved: string; age: string; days: string; share: string; ready: string; ask: string; why: string;
  send: string; sending: string; cancel: string; asked: string; pending: string; top: string; stepDown: string; stepDownPrompt: string;
  confirm: string; stay: string; steppedDown: string; byTutor: string; byYou: string; byStaff: string; bySystem: string;
  loading: string; failed: string; retry: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function MyLevel({ copy, levels, locale, dark, view, loading, failed, busy, notice, onRetry, onAsk, onStepDown }: {
  copy: MyLevelCopy;
  /** The child-facing level names and unlock lines. */
  levels: LevelsCopy;
  locale: string;
  dark: boolean;
  view: { autonomy: Autonomy; changes: LevelChange[] } | null;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onRetry: () => void;
  onAsk: (note: string | null) => void;
  onStepDown: () => void;
}) {
  const ids = { heading: useId(), next: useId() };
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const a = view?.autonomy ?? null;
  const last = view?.changes[0] ?? null;
  const lastWentDown = last !== null && last.toLevel < last.fromLevel;

  function ask(event: FormEvent) {
    event.preventDefault();
    onAsk(note.trim() || null);
    setAsking(false); setNote('');
  }

  return <section className="lf-rebuild lf-family-hub lf-autonomy" data-autonomy="my-level" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.heading}>
    {failed ? <>
      <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : loading || !a ? <LoadingState label={copy.loading} /> : <>
      {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
      <div className="lf-autonomy-level" data-level={a.level}>
        <div className="lf-autonomy-steps" aria-hidden="true">{([1, 2, 3] as const).map((n) => <span key={n} className="lf-autonomy-step" data-reached={n <= a.level} />)}</div>
        <h2 id={ids.heading} className="lf-autonomy-level-name" data-copy-role="heading">{fill(levels.label, { count: a.level, name: levelName(levels, a.level) })}</h2>
        <Copy role="body">{a.level === 1 ? levels.unlock1 : a.level === 2 ? levels.unlock2 : fill(levels.unlock3, { count: a.unlocks.selfLogMaxCoins ?? 0 })}</Copy>
        {a.preapprovedLimit > 0 && <Copy role="body">{fill(levels.preapproved, { count: a.preapprovedLimit })}</Copy>}
      </div>

      {lastWentDown && last && <div className="lf-autonomy-reason" data-last-change={last.by}>
        <Copy role="body">{fill(last.by === 'tutor' ? copy.byTutor : last.by === 'staff' ? copy.byStaff : last.by === 'system' ? copy.bySystem : copy.byYou,
          { name: levelName(levels, last.toLevel) })}</Copy>
        {last.reason && <span className="ugc" data-copy-role="data">{last.reason}</span>}
      </div>}

      {a.next ? <section aria-labelledby={ids.next} data-autonomy-part="next" data-eligible={a.next.eligible}>
        <ul className="lf-autonomy-rule">
          <li data-met={a.next.approved.value >= a.next.approved.min}><StatusMark correct={a.next.approved.value >= a.next.approved.min} />
            <span id={ids.next} data-copy-role="data">{fill(copy.approved, { count: Math.min(a.next.approved.value, a.next.approved.min), min: a.next.approved.min, name: levelName(levels, a.next.level) })}</span></li>
          {!a.next.notApproved.ok && <li data-met="false"><StatusMark correct={false} /><span data-copy-role="body">{copy.share}</span></li>}
          {!a.next.age.ok && a.next.age.value !== null && <li data-met="false"><StatusMark correct={false} /><span data-copy-role="body">{fill(copy.age, { count: a.next.age.min })}</span></li>}
          {!a.next.daysAtLevel.ok && <li data-met="false"><StatusMark correct={false} />
            <span data-copy-role="body">{fill(copy.days, { count: Math.max(0, a.next.daysAtLevel.min - a.next.daysAtLevel.value) })}</span></li>}
        </ul>
        {a.request ? <Copy role="body">{copy.pending}</Copy> : asking ? <form onSubmit={ask} noValidate>
          <TextAreaField data-copy-role="data" label={copy.why} maxLength={CHILD_NOTE_MAX_CHARS} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} />
          <div className="lf-family-hub-actions">
            <Button type="submit" variant="accent" pending={busy} pendingLabel={copy.sending}>{copy.send}</Button>
            <Button disabled={busy} onClick={() => { setAsking(false); setNote(''); }}>{copy.cancel}</Button>
          </div>
        </form> : <>
          {a.next.eligible && <Copy role="body">{copy.ready}</Copy>}
          <div className="lf-family-hub-actions"><Button variant={a.next.eligible ? 'accent' : 'secondary'} data-level-control="ask" disabled={busy} onClick={() => setAsking(true)}>{copy.ask}</Button></div>
        </>}
      </section> : <Copy role="body">{copy.top}</Copy>}

      {a.storedLevel > 1 && (confirming ? <div className="lf-autonomy-not-yet" role="group" aria-label={copy.stepDown}>
        <Copy role="prompt">{fill(copy.stepDownPrompt, { name: levelName(levels, (a.storedLevel - 1) as 1 | 2) })}</Copy>
        <div className="lf-family-hub-actions">
          <Button disabled={busy} onClick={() => { onStepDown(); setConfirming(false); }}>{copy.confirm}</Button>
          <Button variant="accent" disabled={busy} onClick={() => setConfirming(false)}>{copy.stay}</Button>
        </div>
      </div> : <div className="lf-family-hub-actions"><Button data-level-control="step-down" disabled={busy} onClick={() => setConfirming(true)}>{copy.stepDown}</Button></div>)}
    </>}
  </section>;
}
