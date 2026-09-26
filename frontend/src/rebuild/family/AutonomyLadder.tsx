import { useId, useState } from 'react';
import { Button, Copy, InlineNotice, LoadingState, StatusMark, Stepper } from '../design/controls';
import { NotYetForm, type NotYetCopy } from './NotYetForm';
import { LEVEL_LOWER_REASON_CODES, PREAPPROVED_CAP, type Autonomy, type Level, type LevelChange, type NotYet } from './familyAutonomyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyAutonomy.css';

/*
 * S07.5 (D.17), the Tutor's side of the independence ladder for one child:
 * the level in force and what it lets the child do without a tap, the
 * pre-approved amount within the level's cap, the documented rule for the
 * next level with the child's own numbers (each condition named, met or
 * not, never colour alone), "Move up" only when the rule is met (the server
 * decides; a refused move says so), "Move down" only with a reason the
 * child reads, and the recent changes with who made them. Nothing here
 * celebrates (OD-7). Adult band copy.
 */

export interface LadderCopy {
  open: string; close: string; heading: string; body: string; limit: string; limitValue: string; limitCap: string; more: string; less: string;
  saveLimit: string; next: string; age: string; approved: string; share: string; days: string; ready: string; notReady: string; noBirthDate: string;
  top: string; moveUp: string; moveDown: string; lowerTo: string; history: string; change: string; byYou: string; byTutor: string; byChild: string;
  byStaff: string; bySystem: string; saved: string; failed: string; loading: string; retry: string;
}
export interface LevelsCopy { name1: string; name2: string; name3: string; label: string; unlock1: string; unlock2: string; unlock3: string; preapproved: string; always: string }

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const LIMIT_STEP = 5;

export function levelName(copy: Pick<LevelsCopy, 'name1' | 'name2' | 'name3'>, level: Level) {
  return level === 1 ? copy.name1 : level === 2 ? copy.name2 : copy.name3;
}

export function AutonomyLadder({ copy, levels, notYetCopy, kidName, locale, dark, open, view, loading, failed, busy, notice, onToggle, onRetry, onSet }: {
  copy: LadderCopy;
  /** The Tutor-facing unlock lines (levelsTutor) with the shared level names. */
  levels: LevelsCopy;
  notYetCopy: NotYetCopy;
  kidName: string;
  locale: string;
  dark: boolean;
  open: boolean;
  view: { autonomy: Autonomy; changes: LevelChange[] } | null;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onToggle: () => void;
  onRetry: () => void;
  onSet: (input: { level: Level; preapprovedLimit: number; reasonCode?: string; reason?: string }) => void;
}) {
  const heading = useId();
  const [draftLimit, setDraftLimit] = useState<number | null>(null);
  const [lowering, setLowering] = useState(false);
  const a = view?.autonomy ?? null;
  const limit = draftLimit ?? a?.preapprovedLimit ?? 0;
  const cap = a ? PREAPPROVED_CAP[a.level] : 0;
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const by = (c: LevelChange) => c.by === 'system' ? copy.bySystem : c.by === 'staff' ? copy.byStaff : c.by === 'child' ? fill(copy.byChild, { name: kidName }) : c.byMe ? copy.byYou : copy.byTutor;

  return <section className="lf-rebuild lf-family-hub lf-autonomy" data-autonomy="ladder" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={heading}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.open}</Button>
    {open && <>
      <h2 id={heading} data-copy-role="heading">{fill(copy.heading, { name: kidName })}</h2>
      <Copy role="body">{copy.body}</Copy>
      {failed ? <>
        <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
        <Button onClick={onRetry}>{copy.retry}</Button>
      </> : loading || !a ? <LoadingState label={copy.loading} /> : <>
        {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
        <div className="lf-autonomy-level" data-level={a.level}>
          <div className="lf-autonomy-steps" aria-hidden="true">{([1, 2, 3] as const).map((n) => <span key={n} className="lf-autonomy-step" data-reached={n <= a.level} />)}</div>
          <span className="lf-autonomy-level-name" data-copy-role="data">{fill(levels.label, { count: a.level, name: levelName(levels, a.level) })}</span>
          <Copy role="body">{a.level === 1 ? levels.unlock1 : a.level === 2 ? levels.unlock2 : fill(levels.unlock3, { count: a.unlocks.selfLogMaxCoins ?? 0 })}</Copy>
          {a.preapprovedLimit > 0 && <Copy role="body">{fill(levels.preapproved, { count: a.preapprovedLimit })}</Copy>}
          <Copy role="body">{levels.always}</Copy>
        </div>

        {a.level > 1 && <section aria-label={copy.limit} data-autonomy-part="limit">
          {/* The shared -/+ control: a bound disables its button instead of clamping a press. */}
          <Stepper label={copy.limit} value={limit} valueText={fill(copy.limitValue, { count: limit })} min={0} max={cap} step={LIMIT_STEP}
            labels={{ decrease: copy.less, increase: copy.more }} disabled={busy}
            onValueChange={(next) => setDraftLimit(Math.min(cap, Math.max(0, next)))} />
          <span className="lf-family-hub-muted" data-copy-role="body">{fill(copy.limitCap, { count: cap })}</span>
          <div className="lf-family-hub-actions">
            <Button variant="accent" disabled={busy || limit === a.preapprovedLimit}
              onClick={() => { onSet({ level: a.storedLevel, preapprovedLimit: limit }); setDraftLimit(null); }}>{copy.saveLimit}</Button>
          </div>
        </section>}

        {a.next ? <section aria-label={fill(copy.next, { name: levelName(levels, a.next.level) })} data-autonomy-part="next" data-eligible={a.next.eligible}>
          <h3 data-copy-role="heading">{fill(copy.next, { name: levelName(levels, a.next.level) })}</h3>
          <ul className="lf-autonomy-rule">
            <li data-met={a.next.age.ok}><StatusMark correct={a.next.age.ok} /><span data-copy-role="data">{fill(copy.age, { min: a.next.age.min })}</span></li>
            <li data-met={a.next.approved.value >= a.next.approved.min}><StatusMark correct={a.next.approved.value >= a.next.approved.min} />
              <span data-copy-role="data">{fill(copy.approved, { count: a.next.approved.value, min: a.next.approved.min, days: a.next.windowDays })}</span></li>
            <li data-met={a.next.notApproved.ok}><StatusMark correct={a.next.notApproved.ok} />
              <span data-copy-role="data">{fill(copy.share, { count: Math.round(100 / Math.max(1, a.next.notApproved.maxPct)) })}</span></li>
            {a.next.daysAtLevel.min > 0 && <li data-met={a.next.daysAtLevel.ok}><StatusMark correct={a.next.daysAtLevel.ok} />
              <span data-copy-role="data">{fill(copy.days, { count: a.next.daysAtLevel.value, min: a.next.daysAtLevel.min })}</span></li>}
          </ul>
          {a.next.age.value === null && <Copy role="body">{copy.noBirthDate}</Copy>}
          <Copy role="body">{a.next.eligible ? copy.ready : copy.notReady}</Copy>
          <div className="lf-family-hub-actions">
            <Button variant="success" disabled={busy || !a.next.eligible} onClick={() => onSet({ level: a.next!.level, preapprovedLimit: 0 })}>{copy.moveUp}</Button>
          </div>
        </section> : <Copy role="body">{copy.top}</Copy>}

        {a.storedLevel > 1 && (lowering
          ? <NotYetForm copy={notYetCopy} codes={LEVEL_LOWER_REASON_CODES} busy={busy} heading={fill(copy.lowerTo, { name: levelName(levels, (a.storedLevel - 1) as Level) })}
            onCancel={() => setLowering(false)}
            onSubmit={(notYet: NotYet) => {
              const to = (a.storedLevel - 1) as Level;
              onSet({ level: to, preapprovedLimit: Math.min(a.preapprovedLimit, PREAPPROVED_CAP[to]), reasonCode: notYet.reasonCode, reason: notYet.reason });
              setLowering(false);
            }} />
          : <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => setLowering(true)}>{copy.moveDown}</Button></div>)}

        {view!.changes.length > 0 && <section aria-label={copy.history} data-autonomy-part="history">
          <h3 data-copy-role="heading">{copy.history}</h3>
          <ul>{view!.changes.map((c) => <li key={c.id} data-change-by={c.by}>
            <div className="lf-family-hub-row">
              <span data-copy-role="data">{c.fromLevel === c.toLevel
                ? fill(copy.change, { from: fill(copy.limitValue, { count: c.fromLimit }), to: fill(copy.limitValue, { count: c.toLimit }) })
                : fill(copy.change, { from: levelName(levels, c.fromLevel), to: levelName(levels, c.toLevel) })}</span>
              <time className="lf-family-hub-muted" data-copy-role="data" dateTime={c.createdAt}>{date.format(new Date(c.createdAt))}</time>
            </div>
            <span className="lf-family-hub-muted" data-copy-role="data">{by(c)}</span>
            {c.reason && <span className="ugc lf-autonomy-reason" data-copy-role="data">{c.reason}</span>}
          </li>)}</ul>
        </section>}
      </>}
    </>}
  </section>;
}
