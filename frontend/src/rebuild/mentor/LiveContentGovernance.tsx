import { useId, useState } from 'react';
import { Button, Copy } from '../design/controls';
import type {
  CalibrationState,
  LiveContentStatus,
  PackStatus,
  ReviewDecision,
  RiskCategory,
  SuspensionReason,
  TutorPackSummary,
} from './liveContentApi';
import '../design/tokens.css';
import '../design/system.css';
import './alliance.css';
import './liveContent.css';

/*
 * C.5 / C.6 IN THE STAFF CONSOLE. Three panels a content reviewer (the
 * `manage_content` grant) works from:
 *
 *   1. STATUS. Per content-risk category (everyday / sensitive topics): the
 *      share of live-generated Mentor activities staff review now, its floor
 *      (15% / 50%, Appendix E §3.1.1), whether it was raised after an issue
 *      and how many clean reviews restore it, whether live activities are
 *      paused and why (Stage 7), and the reviews past the SLA; plus the
 *      content judge's calibration.
 *   2. REVIEW. One sampled activity and three EQUAL decisions (approve, a
 *      quality issue, a safety issue). Equal on purpose: a reviewer is never
 *      nudged toward approving. A rejection raises the category's rate at
 *      once (Core decides that; this surface only reports the verdict).
 *   3. PACKS. Curated activity packs waiting for a human release (C.6):
 *      publish or archive. Core re-checks the tutor-pack.v1 contract on the
 *      stored content; a refusal lists every reason.
 *
 * Staff-only, so no Mentor character, no celebration and no age register;
 * tokens only, light and dark, 48 px targets, keyboard reachable. Every
 * string declares its copy role; learner content under review is `data`.
 */

export interface LiveContentCopy {
  title: string;
  intro: string;
  judgeLabel: string;
  judge: Record<CalibrationState, string>;
  category: Record<RiskCategory, string>;
  rate: string;
  open: string;
  reason: Record<SuspensionReason, string>;
  elevated: string;
  overdue: string;
  nothingOverdue: string;
  loading: string;
  loadFailed: string;
  reviewTitle: string;
  reviewLabel: string;
  approve: string;
  quality: string;
  safety: string;
  decided: string;
  alreadyDecided: string;
  decideFailed: string;
  packsTitle: string;
  packsEmpty: string;
  packMeta: string;
  publish: string;
  archive: string;
  published: string;
  archived: string;
  refused: string;
  packFailed: string;
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function LiveContentStatusPanel({ copy, locale, dark, phase, status }: {
  copy: LiveContentCopy;
  locale: string;
  dark: boolean;
  phase: 'loading' | 'ready' | 'failed';
  status: LiveContentStatus | null;
}) {
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return <section className="lf-rebuild lf-alliance-panel lf-live-content" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen="staff-live-content-status" aria-busy={phase === 'loading'}>
    <h2 data-copy-role="heading">{copy.title}</h2>
    <Copy role="body">{copy.intro}</Copy>
    {phase === 'loading' ? <div role="status"><Copy role="body">{copy.loading}</Copy></div>
      : phase === 'failed' || !status ? <div role="alert"><Copy role="body">{copy.loadFailed}</Copy></div>
        : <>
          <dl className="lf-disposition-list">
            <div className="lf-disposition-row" data-judge={status.calibration.state}>
              <dt data-copy-role="body">{copy.judgeLabel}</dt>
              <dd data-copy-role="body">{fill(copy.judge[status.calibration.state], { n: status.calibration.ageDays ?? 0 })}</dd>
            </div>
          </dl>
          <ul className="lf-live-categories">
            {status.categories.map((c) => <li key={c.category} className="lf-live-category"
              data-category={c.category} data-suspended={c.suspended ? 'true' : 'false'}>
              <h3 data-copy-role="heading">{copy.category[c.category]}</h3>
              <p data-copy-role="body" className="lf-live-state">
                {c.suspended ? copy.reason[c.reasons[0] ?? 'uncalibrated'] : copy.open}
              </p>
              <p data-copy-role="body">{fill(copy.rate, { rate: pct.format(c.rate), floor: pct.format(c.floor) })}</p>
              {c.elevated ? <p data-copy-role="body">{fill(copy.elevated, { n: c.decisionsToRestore })}</p> : null}
              <p data-copy-role="body">{c.overdue > 0 ? fill(copy.overdue, { n: c.overdue }) : copy.nothingOverdue}</p>
            </li>)}
          </ul>
        </>}
  </section>;
}

export type DecisionResult = 'recorded' | 'already' | 'failed';

export function LiveReviewDecision({ copy, locale, dark, item, onDecide }: {
  copy: LiveContentCopy;
  locale: string;
  dark: boolean;
  item: { id: string; category: RiskCategory; prompt: string };
  onDecide: (decision: ReviewDecision) => Promise<DecisionResult>;
}) {
  const [state, setState] = useState<'open' | 'saving' | DecisionResult>('open');
  const titleId = useId();
  const decide = async (decision: ReviewDecision) => {
    setState('saving');
    setState(await onDecide(decision));
  };
  const done = state === 'recorded' || state === 'already';
  return <section className="lf-rebuild lf-alliance-panel lf-live-content" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen="staff-live-content-review" aria-labelledby={titleId}>
    <h2 id={titleId} data-copy-role="heading">{copy.reviewTitle}</h2>
    <p data-copy-role="body" className="lf-live-tag">{copy.category[item.category]}</p>
    <blockquote className="lf-live-item" data-copy-role="data">{item.prompt}</blockquote>
    {done
      ? <div role="status"><Copy role="body">{state === 'recorded' ? copy.decided : copy.alreadyDecided}</Copy></div>
      : <>
        <div className="lf-alliance-chips lf-alliance-chips--three" role="group" aria-label={copy.reviewLabel}>
          {(['approve', 'quality', 'safety'] as const).map((d) => <button key={d} type="button"
            className="lf-button lf-alliance-chip lf-live-decision" data-copy-role="action" data-decision={d}
            disabled={state === 'saving'} onClick={() => void decide(d)}>{copy[d]}</button>)}
        </div>
        {state === 'failed' ? <div role="alert"><Copy role="body">{copy.decideFailed}</Copy></div> : null}
      </>}
  </section>;
}

export type PackResult = { ok: true } | { ok: false; failures?: string[] };

export function PackRelease({ copy, locale, dark, packs, onStatus }: {
  copy: LiveContentCopy;
  locale: string;
  dark: boolean;
  packs: TutorPackSummary[];
  onStatus: (packId: string, status: PackStatus) => Promise<PackResult>;
}) {
  const [outcome, setOutcome] = useState<Record<string, { status: PackStatus | 'saving' | 'failed'; failures?: string[] }>>({});
  const act = async (id: string, status: PackStatus) => {
    setOutcome((o) => ({ ...o, [id]: { status: 'saving' } }));
    const result = await onStatus(id, status);
    setOutcome((o) => ({ ...o, [id]: result.ok ? { status } : { status: 'failed', failures: result.failures } }));
  };
  return <section className="lf-rebuild lf-alliance-panel lf-live-content" lang={locale} data-theme={dark ? 'dark' : 'light'}
    data-screen="staff-live-content-packs">
    <h2 data-copy-role="heading">{copy.packsTitle}</h2>
    {packs.length === 0 ? <Copy role="body">{copy.packsEmpty}</Copy>
      : <ul className="lf-live-packs">
        {packs.map((p) => {
          const o = outcome[p.id];
          return <li key={p.id} className="lf-live-pack" data-pack={p.id}>
            <p data-copy-role="data" className="lf-live-pack-key">{p.kc_key ?? p.skill_key}</p>
            <p data-copy-role="body">{fill(copy.packMeta, { tier: p.tier, locale: p.locale, count: p.pack.segments.length })}</p>
            {o?.status === 'published' || o?.status === 'archived'
              ? <div role="status"><Copy role="body">{o.status === 'published' ? copy.published : copy.archived}</Copy></div>
              : <div className="lf-live-pack-actions">
                <Button variant="secondary" disabled={o?.status === 'saving'} onClick={() => void act(p.id, 'published')}>{copy.publish}</Button>
                <Button variant="secondary" disabled={o?.status === 'saving'} onClick={() => void act(p.id, 'archived')}>{copy.archive}</Button>
              </div>}
            {o?.status === 'failed' ? <div role="alert" className="lf-live-refusal">
              <Copy role="body">{o.failures && o.failures.length > 0 ? copy.refused : copy.packFailed}</Copy>
              {o.failures && o.failures.length > 0
                ? <ul>{o.failures.map((f) => <li key={f} data-copy-role="data">{f}</li>)}</ul> : null}
            </div> : null}
          </li>;
        })}
      </ul>}
  </section>;
}
