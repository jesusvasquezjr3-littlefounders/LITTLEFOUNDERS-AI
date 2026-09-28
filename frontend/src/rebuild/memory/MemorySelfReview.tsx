import { useEffect, useRef } from 'react';
import { Button, Copy, InlineNotice, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './memorySelfReview.css';

/*
 * THE TEEN'S OWN MEMORY GATE (OD-18, C.4).
 *
 * A self-reviewing teen (13-17, no linked guardian) is the reviewer of their
 * OWN Mentor memory notes: every proposed note parks until the teen approves
 * or deletes it. This is the surface for that decision, built from the
 * Frontend Bible (02) with no legacy component imports (rule 23).
 *
 * The wire shape mirrors `PendingMemoryNote` in tutorApi.ts on purpose
 * (hand-mirrored wire shapes are this repo's convention, not drift).
 *
 * Nothing here celebrates: an approval is an informational status line, the
 * same feedback grammar the guardian gate uses. The one destructive-looking
 * action ("Delete") is a secondary button, not an error fill, because the
 * proposal was never applied to anything - rejecting it destroys no stored
 * data (Bible 02 §9.5 reserves the error hue for destructive actions).
 */

export type MemoryStore = 'learner' | 'pedagogy';
const STORES: readonly MemoryStore[] = ['learner', 'pedagogy'];

export interface MemoryProposal {
  id: string;
  /** Which of the Mentor's two notes this replaces (C.4): who the teen is, or how they learn best. */
  store: MemoryStore;
  /** The note as proposed: what the Mentor would hold about this teen. */
  proposed: string;
  /** What it would replace. `null` when there is no note yet. */
  expectedBefore: string | null;
  sessionId: string | null;
  createdAt: string;
}

export type Verdict = 'approved' | 'rejected';
export type SettledVerdict = 'kept' | 'deleted';

export interface MemorySelfReviewCopy {
  title: string;
  help: string;
  learnerStore: string;
  pedagogyStore: string;
  currentLabel: string;
  currentEmpty: string;
  empty: string;
  loading: string;
  loadFailed: string;
  retry: string;
  proposedOn: string;
  replacesLabel: string;
  approve: string;
  delete: string;
  deciding: string;
  kept: string;
  deleted: string;
  changed: string;
  outOfDate: string;
  decisionFailed: string;
}

export function MemorySelfReview({ copy, locale, dark, phase, notes, current, deciding, settled, failedId, notice, noticeKind, onDecide, onRetry }: {
  copy: MemorySelfReviewCopy;
  locale: string;
  dark: boolean;
  phase: 'loading' | 'failed' | 'ready';
  notes: MemoryProposal[];
  /** Both notes as they stand today (null: no note yet). */
  current: Record<MemoryStore, string | null>;
  /** The proposal id whose decision is in flight; its actions are disabled. */
  deciding: string | null;
  /** Notes decided in this visit, so a settled row reads as settled. */
  settled: Record<string, SettledVerdict>;
  /** The note id whose decision the server refused (not a conflict). */
  failedId: string | null;
  notice: string | null;
  noticeKind: 'alert' | 'status' | null;
  onDecide: (id: string, verdict: Verdict) => void;
  onRetry: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const lastAction = useRef<HTMLButtonElement | null>(null);
  /*
   * When a decision settles, the pressed button is replaced by a status line,
   * which drops focus back to <body>. Hand it to the next actionable control
   * instead, so a keyboard teen is never stranded mid-queue.
   */
  useEffect(() => {
    if (!deciding && lastAction.current && document.activeElement === document.body) {
      const target = lastAction.current.isConnected ? lastAction.current : root.current?.querySelector('button');
      target?.focus();
    }
  }, [deciding]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return <section ref={root} className="lf-rebuild lf-memory-self-review" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-label={copy.title} aria-busy={phase === 'loading'}>
    <Copy role="heading" as="h2">{copy.title}</Copy>
    {phase === 'loading' ? <LoadingState label={copy.loading} lines={2} /> : phase === 'failed' ? <>
      <InlineNotice tone="error" live>{copy.loadFailed}</InlineNotice>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : <>
      <Copy role="body">{copy.help}</Copy>
      {notice && <InlineNotice tone={noticeKind === 'alert' ? 'error' : 'info'} live>{notice}</InlineNotice>}
      {STORES.map((store) => {
        const now = current[store];
        const waiting = notes.filter((note) => note.store === store);
        return <div key={store} className="lf-memory-store" data-memory-store={store}>
          <h3 className="lf-memory-store-title" data-copy-role="heading">{store === 'learner' ? copy.learnerStore : copy.pedagogyStore}</h3>
          <div className="lf-memory-current">
            <Copy role="body">{copy.currentLabel}</Copy>
            {now === null ? <Copy role="body">{copy.currentEmpty}</Copy> : <Copy role="data">{now}</Copy>}
          </div>
          {waiting.length === 0 ? (now === null ? null : <Copy role="body">{copy.empty}</Copy>) : (
            <ul className="lf-memory-queue">
              {waiting.map((note) => {
                const verdict = settled[note.id];
                const busy = deciding === note.id;
                const outOfDate = note.expectedBefore !== now;
                return <li key={note.id} className="lf-memory-note" data-memory-note={note.id}>
                  <div className="lf-memory-note-meta">
                    <Copy role="body">{copy.proposedOn}</Copy>
                    <time dateTime={note.createdAt} data-copy-role="data">{date.format(new Date(note.createdAt))}</time>
                    {outOfDate && !verdict && <span className="lf-memory-chip"><Copy role="body" as="span">{copy.outOfDate}</Copy></span>}
                  </div>
                  <Copy role="data">{note.proposed}</Copy>
                  {note.expectedBefore !== null && <div className="lf-memory-before">
                    <Copy role="body">{copy.replacesLabel}</Copy>
                    <Copy role="data">{note.expectedBefore}</Copy>
                  </div>}
                  <div className="lf-memory-note-actions">
                    {verdict ? <InlineNotice tone="success" live>{verdict === 'kept' ? copy.kept : copy.deleted}</InlineNotice> : <>
                      <Button variant="success" disabled={busy} onClick={(event) => { lastAction.current = event.currentTarget; onDecide(note.id, 'approved'); }}>{copy.approve}</Button>
                      <Button disabled={busy} onClick={(event) => { lastAction.current = event.currentTarget; onDecide(note.id, 'rejected'); }}>{copy.delete}</Button>
                    </>}
                  </div>
                  {busy && <InlineNotice tone="info" live>{copy.deciding}</InlineNotice>}
                  {failedId === note.id && <InlineNotice tone="error" live>{copy.decisionFailed}</InlineNotice>}
                </li>;
              })}
            </ul>
          )}
        </div>;
      })}
    </>}
  </section>;
}
