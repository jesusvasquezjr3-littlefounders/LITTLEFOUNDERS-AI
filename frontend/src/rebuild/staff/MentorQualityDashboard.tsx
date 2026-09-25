import { useId, useState, type ReactNode } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import {
  COUNT_SIGNALS,
  OWNER_ROLES,
  RESOLUTION_NOTE_MAX,
  RESOLUTION_NOTE_MIN,
  SCORE_SIGNALS,
  SIGNAL_CATEGORIES,
  type DashboardFlag,
  type DashboardSignal,
  type FlagKind,
  type MentorQualityDashboardData,
  type OwnerRole,
  type SignalCategory,
  type SignalStatus,
} from './mentorQualityApi';
import '../design/tokens.css';
import '../design/system.css';
import '../mentor/alliance.css';
import './mentorQuality.css';

/*
 * C.24 IN THE REBUILT STAFF CONSOLE: the one place the product/pedagogy team
 * watches the Mentor (Appendix E §3.1 Tier 3). Four panels:
 *
 *   1. STATUS. How fresh the numbers are (Appendix F §1.4: within 24 hours;
 *      older reads "out of date" in words, never looks calm), how the last
 *      hourly check went, and any owner role nobody is named for.
 *   2. NEEDS REVIEW. Every open flag (C.21's anomaly flags), urgent first,
 *      with its owner role. Only the NAMED owner of that role sees the
 *      actions: acknowledge, then resolve with the root cause in words. Core
 *      enforces the same rule against the database; hiding the buttons is a
 *      courtesy, never the control.
 *   3. SIGNALS. Every consolidated signal by category, with its status in
 *      words (a glyph only reinforces "on target" / "needs review"), its
 *      value and its owner. A metric with no data source yet says so.
 *   4. WEEKLY REVIEW. Which named owners signed this week, and the sign-off.
 *
 * Staff-only: no Mentor character, no celebration, no age register; tokens
 * only, light and dark, 48 px targets, keyboard reachable, no motion. Every
 * string declares its copy role; numbers, codes and notes are `data`.
 */

export interface MentorQualityCopy {
  title: string;
  intro: string;
  loading: string;
  loadFailed: string;
  updated: string;
  stale: string;
  never: string;
  lastRun: Record<'ok' | 'partial' | 'failed', string>;
  noOwner: string;
  flagsTitle: string;
  flagsEmpty: string;
  kind: Record<FlagKind, string>;
  severity: Record<'urgent' | 'review', string>;
  flagStatus: Record<'open' | 'acknowledged', string>;
  flagMeta: string;
  acknowledge: string;
  resolve: string;
  noteLabel: string;
  noteHint: string;
  confirmResolve: string;
  cancel: string;
  acknowledged: string;
  resolved: string;
  notOwner: string;
  changed: string;
  actionFailed: string;
  signalsTitle: string;
  category: Record<SignalCategory, string>;
  signalStatus: Record<SignalStatus, string>;
  notComputed: string;
  ownerRole: Record<OwnerRole, string>;
  sample: string;
  reviewTitle: string;
  reviewDone: string;
  reviewMissing: string;
  reviewRate: string;
  signReview: string;
  reviewSigned: string;
  reviewAlready: string;
  signal: Record<string, Record<string, string>>;
}

export type FlagActionResult = 'done' | 'not_owner' | 'changed' | 'failed';
export type ReviewActionResult = 'done' | 'already' | 'not_owner' | 'failed';

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function signalLabel(copy: MentorQualityCopy, id: string): string {
  const [group, name] = id.split('.');
  return copy.signal[group ?? '']?.[name ?? ''] ?? id;
}

function formatValue(id: string, value: number | null, locale: string): string | null {
  if (value === null) return null;
  if (COUNT_SIGNALS.includes(id)) return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  if (SCORE_SIGNALS.includes(id)) return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);
}

function Panel({ locale, dark, screen, children, busy }: { locale: string; dark: boolean; screen: string; children: ReactNode; busy?: boolean }) {
  return <section className="lf-rebuild lf-alliance-panel lf-quality" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen={screen} aria-busy={busy ? true : undefined}>{children}</section>;
}

export function MentorQualityStatus({ copy, locale, dark, phase, data }: {
  copy: MentorQualityCopy; locale: string; dark: boolean; phase: 'loading' | 'ready' | 'failed'; data: MentorQualityDashboardData | null;
}) {
  const hours = data?.freshness.ageHours === null || data?.freshness.ageHours === undefined ? null : Math.max(0, Math.floor(data.freshness.ageHours));
  return <Panel locale={locale} dark={dark} screen="staff-mentor-quality-status" busy={phase === 'loading'}>
    <h2 data-copy-role="heading">{copy.title}</h2>
    <Copy role="body">{copy.intro}</Copy>
    {phase === 'loading' ? <div role="status"><Copy role="body">{copy.loading}</Copy></div>
      : phase === 'failed' || !data ? <div role="alert"><Copy role="body">{copy.loadFailed}</Copy></div>
        : <div className="lf-quality-facts">
          <p data-copy-role="body" className="lf-quality-fresh" data-stale={data.freshness.stale ? 'true' : 'false'}>
            {hours === null ? copy.never : fill(data.freshness.stale ? copy.stale : copy.updated, { n: hours })}
          </p>
          {data.lastRun ? <p data-copy-role="body" data-run={data.lastRun.status}>{copy.lastRun[data.lastRun.status]}</p> : null}
          {data.reviews.missingRoles.length > 0
            ? <div className="lf-quality-gap"><p data-copy-role="body">{copy.noOwner}</p>
              <p data-copy-role="data">{data.reviews.missingRoles.map((r) => copy.ownerRole[r]).join(', ')}</p></div>
            : null}
        </div>}
  </Panel>;
}

function FlagItem({ copy, locale, flag, canAct, onAcknowledge, onResolve }: {
  copy: MentorQualityCopy; locale: string; flag: DashboardFlag; canAct: boolean;
  onAcknowledge: (id: string) => Promise<FlagActionResult>; onResolve: (id: string, note: string) => Promise<FlagActionResult>;
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'resolving' | FlagActionResult>('idle');
  const [done, setDone] = useState<'acknowledged' | 'resolved' | null>(null);
  const [note, setNote] = useState('');
  const noteId = useId();
  const act = async (fn: () => Promise<FlagActionResult>, next: 'acknowledged' | 'resolved') => {
    setState('saving');
    const result = await fn();
    if (result === 'done') setDone(next);
    setState(result === 'done' ? 'idle' : result);
  };
  const value = formatValue(flag.signalId, flag.value, locale);
  const threshold = formatValue(flag.signalId, flag.threshold, locale);
  const status = done === 'acknowledged' ? 'acknowledged' : flag.status === 'resolved' ? 'acknowledged' : flag.status;
  const noteOk = note.trim().length >= RESOLUTION_NOTE_MIN;
  return <li className="lf-quality-flag" data-flag={flag.id} data-severity={flag.severity} data-status={done ?? flag.status}>
    <p data-copy-role="body">
      <span className="lf-quality-severity">{copy.severity[flag.severity]}</span>{' · '}{copy.kind[flag.kind]}
    </p>
    <h3 data-copy-role="body">{signalLabel(copy, flag.signalId)}</h3>
    {flag.scope !== 'all' || value !== null
      ? <p data-copy-role="data" className="lf-quality-data">
        {[flag.scope !== 'all' ? flag.scope : null, value !== null ? (threshold !== null ? `${value} / ${threshold}` : value) : null].filter(Boolean).join(' · ')}
      </p>
      : null}
    <p data-copy-role="body" className="lf-quality-muted">
      {fill(copy.flagMeta, { role: copy.ownerRole[flag.ownerRole], n: flag.seenCount })} {copy.flagStatus[status as 'open' | 'acknowledged']}
    </p>
    {done === 'resolved' ? <div role="status"><Copy role="body">{copy.resolved}</Copy></div>
      : canAct ? <>
        {done === 'acknowledged' ? <div role="status"><Copy role="body">{copy.acknowledged}</Copy></div> : null}
        {state === 'resolving' ? <div className="lf-quality-resolve">
          <div className="lf-field">
            <label htmlFor={noteId} data-copy-role="body">{copy.noteLabel}</label>
            <textarea id={noteId} data-copy-role="data" value={note} maxLength={RESOLUTION_NOTE_MAX} rows={3} aria-describedby={`${noteId}-hint`}
              onChange={(e) => setNote(e.target.value)} />
            <p id={`${noteId}-hint`} data-copy-role="body">{copy.noteHint}</p>
          </div>
          <div className="lf-quality-actions">
            <Button variant="secondary" disabled={!noteOk} onClick={() => void act(() => onResolve(flag.id, note), 'resolved')}>{copy.confirmResolve}</Button>
            <Button variant="secondary" onClick={() => setState('idle')}>{copy.cancel}</Button>
          </div>
        </div>
          : <div className="lf-quality-actions">
            {flag.status === 'open' && done === null
              ? <Button variant="secondary" disabled={state === 'saving'} onClick={() => void act(() => onAcknowledge(flag.id), 'acknowledged')}>{copy.acknowledge}</Button>
              : null}
            <Button variant="secondary" disabled={state === 'saving'} onClick={() => setState('resolving')}>{copy.resolve}</Button>
          </div>}
        {state === 'not_owner' || state === 'changed' || state === 'failed'
          ? <div role="alert"><Copy role="body">{state === 'not_owner' ? copy.notOwner : state === 'changed' ? copy.changed : copy.actionFailed}</Copy></div>
          : null}
      </> : null}
  </li>;
}

export function MentorQualityFlags({ copy, locale, dark, data, onAcknowledge, onResolve }: {
  copy: MentorQualityCopy; locale: string; dark: boolean; data: MentorQualityDashboardData;
  onAcknowledge: (id: string) => Promise<FlagActionResult>; onResolve: (id: string, note: string) => Promise<FlagActionResult>;
}) {
  const titleId = useId();
  return <Panel locale={locale} dark={dark} screen="staff-mentor-quality-flags">
    <h2 id={titleId} data-copy-role="heading">{copy.flagsTitle}</h2>
    {data.flags.active.length === 0 ? <Copy role="body">{copy.flagsEmpty}</Copy>
      : <ul className="lf-quality-flags" aria-labelledby={titleId}>
        {data.flags.active.map((f) => <FlagItem key={f.id} copy={copy} locale={locale} flag={f}
          canAct={data.viewerOwnerRoles.includes(f.ownerRole)} onAcknowledge={onAcknowledge} onResolve={onResolve} />)}
      </ul>}
  </Panel>;
}

function SignalRow({ copy, locale, signal }: { copy: MentorQualityCopy; locale: string; signal: DashboardSignal }) {
  const status: SignalStatus | null = signal.instrumented === 'not_instrumented' ? 'not_instrumented'
    : signal.instrumented === 'external' ? 'external' : signal.reading?.status ?? null;
  const value = signal.reading ? formatValue(signal.id, signal.reading.value, locale) : null;
  return <div className="lf-disposition-row lf-quality-signal" data-signal={signal.id} data-status={status ?? 'not_computed'}>
    <dt data-copy-role="body">{signalLabel(copy, signal.id)}</dt>
    <dd>
      <span className="lf-quality-status">
        {status === 'ok' || status === 'breach' ? <StatusMark correct={status === 'ok'} /> : null}
        <span data-copy-role="body">{status === null ? copy.notComputed : copy.signalStatus[status]}</span>
      </span>
      {value !== null ? <span data-copy-role="data" className="lf-quality-data">{value}</span> : null}
      {signal.reading && status !== 'not_instrumented' && status !== 'external' && signal.reading.sample > 0
        ? <span data-copy-role="body" className="lf-quality-muted">{fill(copy.sample, { n: signal.reading.sample })}</span> : null}
      <span data-copy-role="body" className="lf-quality-muted">{copy.ownerRole[signal.ownerRole]}</span>
    </dd>
  </div>;
}

export function MentorQualitySignals({ copy, locale, dark, data }: { copy: MentorQualityCopy; locale: string; dark: boolean; data: MentorQualityDashboardData }) {
  return <Panel locale={locale} dark={dark} screen="staff-mentor-quality-signals">
    <h2 data-copy-role="heading">{copy.signalsTitle}</h2>
    {SIGNAL_CATEGORIES.map((category) => {
      const signals = data.signals.filter((s) => s.category === category);
      if (signals.length === 0) return null;
      return <div key={category} className="lf-quality-category" data-category={category}>
        <h3 data-copy-role="heading">{copy.category[category]}</h3>
        <dl className="lf-disposition-list">{signals.map((s) => <SignalRow key={s.id} copy={copy} locale={locale} signal={s} />)}</dl>
      </div>;
    })}
  </Panel>;
}

export function MentorQualityReview({ copy, locale, dark, data, onReview }: {
  copy: MentorQualityCopy; locale: string; dark: boolean; data: MentorQualityDashboardData; onReview: (role: OwnerRole) => Promise<ReviewActionResult>;
}) {
  const [outcome, setOutcome] = useState<Partial<Record<OwnerRole, ReviewActionResult | 'saving'>>>({});
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const signed = (role: OwnerRole) => data.reviews.thisWeek.some((r) => r.role === role) || outcome[role] === 'done';
  const sign = async (role: OwnerRole) => {
    setOutcome((o) => ({ ...o, [role]: 'saving' }));
    const result = await onReview(role);
    setOutcome((o) => ({ ...o, [role]: result }));
  };
  return <Panel locale={locale} dark={dark} screen="staff-mentor-quality-review">
    <h2 data-copy-role="heading">{copy.reviewTitle}</h2>
    {data.reviews.previousRate !== null
      ? <Copy role="body">{fill(copy.reviewRate, { rate: pct.format(data.reviews.previousRate) })}</Copy> : null}
    <ul className="lf-quality-reviews">
      {OWNER_ROLES.filter((role) => data.owners.some((o) => o.role === role)).map((role) => {
        const o = outcome[role];
        return <li key={role} data-role={role} data-signed={signed(role) ? 'true' : 'false'}>
          <p data-copy-role="body">{fill(signed(role) ? copy.reviewDone : copy.reviewMissing, { role: copy.ownerRole[role] })}</p>
          {data.viewerOwnerRoles.includes(role) && !signed(role) && o !== 'already'
            ? <Button variant="secondary" disabled={o === 'saving'} onClick={() => void sign(role)}>{copy.signReview}</Button> : null}
          {o === 'done' ? <div role="status"><Copy role="body">{copy.reviewSigned}</Copy></div> : null}
          {o === 'already' ? <div role="status"><Copy role="body">{copy.reviewAlready}</Copy></div> : null}
          {o === 'not_owner' || o === 'failed' ? <div role="alert"><Copy role="body">{o === 'not_owner' ? copy.notOwner : copy.actionFailed}</Copy></div> : null}
        </li>;
      })}
    </ul>
  </Panel>;
}

/** The whole surface, for the isolated preview and the wave-2 console. */
export function MentorQualityDashboard(props: {
  copy: MentorQualityCopy; locale: string; dark: boolean; phase: 'loading' | 'ready' | 'failed'; data: MentorQualityDashboardData | null;
  onAcknowledge: (id: string) => Promise<FlagActionResult>; onResolve: (id: string, note: string) => Promise<FlagActionResult>;
  onReview: (role: OwnerRole) => Promise<ReviewActionResult>;
}) {
  const { copy, locale, dark, phase, data } = props;
  return <div className="lf-quality-stack">
    <MentorQualityStatus copy={copy} locale={locale} dark={dark} phase={phase} data={data} />
    {phase === 'ready' && data ? <>
      <MentorQualityFlags copy={copy} locale={locale} dark={dark} data={data} onAcknowledge={props.onAcknowledge} onResolve={props.onResolve} />
      <MentorQualityReview copy={copy} locale={locale} dark={dark} data={data} onReview={props.onReview} />
      <MentorQualitySignals copy={copy} locale={locale} dark={dark} data={data} />
    </> : null}
  </div>;
}

/** Maps Core's answer for a flag action onto what the surface says. */
export function flagResultFrom(error: { code: string } | null): FlagActionResult {
  if (error === null) return 'done';
  if (error.code === 'NOT_NAMED_OWNER') return 'not_owner';
  if (error.code === 'ALREADY_DECIDED' || error.code === 'NOT_FOUND') return 'changed';
  return 'failed';
}

export function reviewResultFrom(error: { code: string } | null): ReviewActionResult {
  if (error === null) return 'done';
  if (error.code === 'ALREADY_REVIEWED') return 'already';
  if (error.code === 'NOT_NAMED_OWNER') return 'not_owner';
  return 'failed';
}
