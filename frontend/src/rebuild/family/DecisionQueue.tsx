import { useId, useState } from 'react';
import { Button, Copy, StatusMark } from '../design/controls';
import { NotYetForm, type NotYetCopy } from './NotYetForm';
import {
  LEVEL_REQUEST_REASON_CODES, REVIEW_REWARD_REASON_CODES, REWARD_REASON_CODES, TASK_REASON_CODES,
  type ChildRewardReason, type Decision, type Level, type NotYet, type Queue, type QueueChore, type QueueReward,
} from './familyAutonomyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyAutonomy.css';

/*
 * S07.5 (D.18), the Tutor's decision queue. Every request arrives with the
 * child's own words next to it (their note, or why they want a reward), so
 * the decision is made on the child's reasoning, not a bare request. A yes
 * is one tap; a "not yet" always opens the reason form (no brush-offs; a
 * chore can be sent back to finish, the visible next step). Items the
 * child's level let through are listed to look at afterwards (D.17), and a
 * pattern of "not yet"s, or the child asking, opens a "talk about it" card.
 * Adult band copy.
 */

export interface QueueCopy {
  heading: string; empty: string; chores: string; rewards: string; says: string; wants: string; photo: string; needsPhoto: string; cost: string;
  approve: string; sendBack: string; remove: string; deny: string; open: string; reviews: string; reviewsBody: string; selfLogged: string;
  preapproved: string; looksGood: string; question: string; talk: string; talkPattern: string; talkChild: string; talkTip: string; talked: string;
  dismiss: string; levels: string; levelAsk: string; grant: string; done: string; failed: string; loading: string; retry: string;
  saved_for_it: string; treat: string; need_it: string; for_someone: string; other: string;
}

type Answering =
  | { kind: 'sendBack' | 'remove'; chore: QueueChore }
  | { kind: 'deny'; reward: QueueReward }
  | { kind: 'question'; review: Decision }
  | { kind: 'decline'; requestId: string };

export type QueueAction =
  | { kind: 'approveChore'; chore: QueueChore }
  | { kind: 'sendBack' | 'remove'; chore: QueueChore; notYet: NotYet }
  | { kind: 'approveReward'; reward: QueueReward }
  | { kind: 'deny'; reward: QueueReward; notYet: NotYet }
  | { kind: 'confirm'; review: Decision }
  | { kind: 'question'; review: Decision; notYet: NotYet }
  | { kind: 'grant'; requestId: string; level: Level }
  | { kind: 'decline'; requestId: string; notYet: NotYet }
  | { kind: 'closeNudge'; nudgeId: string; outcome: 'talked' | 'dismissed' };

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function DecisionQueue({ copy, notYetCopy, levelNames, kidName, locale, dark, queue, loading, failed, busy, notice, onRetry, onAction }: {
  copy: QueueCopy;
  notYetCopy: NotYetCopy;
  levelNames: Record<Level, string>;
  kidName: (id: string) => string;
  locale: string;
  dark: boolean;
  queue: Queue | null;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onRetry: () => void;
  onAction: (action: QueueAction) => void;
}) {
  const heading = useId();
  const [answering, setAnswering] = useState<Answering | null>(null);
  const reasonText: Record<ChildRewardReason, string> = { saved_for_it: copy.saved_for_it, treat: copy.treat, need_it: copy.need_it, for_someone: copy.for_someone, other: copy.other };
  const empty = queue !== null && queue.chores.length + queue.rewards.length + queue.reviews.length + queue.nudges.length + queue.levelRequests.length + queue.openChores.length === 0;
  const same = (a: Answering | null, kind: Answering['kind'], id: string) => a !== null && a.kind === kind
    && ('chore' in a ? a.chore.id : 'reward' in a ? a.reward.id : 'review' in a ? a.review.id : a.requestId) === id;
  const form = (codes: Parameters<typeof NotYetForm>[0]['codes'], title: string | null, done: (notYet: NotYet) => void) =>
    <NotYetForm copy={notYetCopy} codes={codes} busy={busy} heading={title ?? undefined} onCancel={() => setAnswering(null)}
      onSubmit={(notYet) => { done(notYet); setAnswering(null); }} />;

  return <section className="lf-rebuild lf-family-hub lf-autonomy" data-autonomy="queue" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={heading}>
    <h2 id={heading} data-copy-role="heading">{copy.heading}</h2>
    {failed ? <>
      <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : loading || !queue ? <div role="status"><Copy role="body">{copy.loading}</Copy></div> : <>
      {notice && <div className="lf-family-hub-notice" role={notice.error ? 'alert' : 'status'}><StatusMark correct={!notice.error} /><Copy role="body">{notice.text}</Copy></div>}
      {empty && <Copy role="body">{copy.empty}</Copy>}

      {queue.nudges.length > 0 && <section aria-label={copy.talk} data-queue="talk">
        <h3 data-copy-role="heading">{copy.talk}</h3>
        {queue.nudges.map((n) => <div key={n.id} className="lf-autonomy-talk" data-nudge-origin={n.origin}>
          <Copy role="body">{n.origin === 'pattern'
            ? fill(copy.talkPattern, { count: n.denials ?? 0, name: kidName(n.kidUserId) })
            : fill(copy.talkChild, { name: kidName(n.kidUserId), title: n.decision?.title ?? '' })}</Copy>
          {n.decision?.reason && <span className="ugc lf-autonomy-reason" data-copy-role="data">{n.decision.reason}</span>}
          <Copy role="body">{copy.talkTip}</Copy>
          <div className="lf-family-hub-actions">
            <Button variant="success" disabled={busy} onClick={() => onAction({ kind: 'closeNudge', nudgeId: n.id, outcome: 'talked' })}>{copy.talked}</Button>
            <Button disabled={busy} onClick={() => onAction({ kind: 'closeNudge', nudgeId: n.id, outcome: 'dismissed' })}>{copy.dismiss}</Button>
          </div>
        </div>)}
      </section>}

      {queue.chores.length > 0 && <section aria-label={copy.chores} data-queue="chores">
        <h3 data-copy-role="heading">{copy.chores}</h3>
        <ul>{queue.chores.map((c) => <li key={c.id} data-task-id={c.id}>
          <div className="lf-family-hub-row">
            <span className="ugc" data-copy-role="data">{c.title}</span>
            <span className="lf-autonomy-chip" data-copy-role="data">{kidName(c.assignedTo)}</span>
          </div>
          {c.childNote && <span className="ugc lf-autonomy-voice" data-copy-role="data" data-child-voice="note">{fill(copy.says, { name: kidName(c.assignedTo), note: c.childNote })}</span>}
          {c.requiresEvidence && <span className="lf-family-hub-muted" data-copy-role="data">{c.hasEvidence ? copy.photo : copy.needsPhoto}</span>}
          {same(answering, 'sendBack', c.id) || same(answering, 'remove', c.id)
            ? form(TASK_REASON_CODES, c.title, (notYet) => onAction({ kind: answering!.kind as 'sendBack' | 'remove', chore: c, notYet }))
            : <div className="lf-family-hub-actions">
              <Button variant="success" disabled={busy || (c.requiresEvidence && !c.hasEvidence)} onClick={() => onAction({ kind: 'approveChore', chore: c })}>{copy.approve}</Button>
              <Button disabled={busy} onClick={() => setAnswering({ kind: 'sendBack', chore: c })}>{copy.sendBack}</Button>
              <Button disabled={busy} onClick={() => setAnswering({ kind: 'remove', chore: c })}>{copy.remove}</Button>
            </div>}
        </li>)}</ul>
      </section>}

      {queue.rewards.length > 0 && <section aria-label={copy.rewards} data-queue="rewards">
        <h3 data-copy-role="heading">{copy.rewards}</h3>
        <ul>{queue.rewards.map((r) => <li key={r.id} data-redemption-id={r.id}>
          <div className="lf-family-hub-row">
            <span className="ugc" data-copy-role="data">{r.title ?? ''}</span>
            {r.cost !== null && <span className="lf-family-hub-amount" data-copy-role="data">{fill(copy.cost, { count: r.cost })}</span>}
          </div>
          {r.childReasonKind && <span className="lf-autonomy-voice" data-copy-role="data" data-child-voice="reason">
            {fill(copy.wants, { name: kidName(r.kidUserId), reason: reasonText[r.childReasonKind] })}</span>}
          {r.childNote && <span className="ugc lf-autonomy-voice" data-copy-role="data" data-child-voice="note">{fill(copy.says, { name: kidName(r.kidUserId), note: r.childNote })}</span>}
          {same(answering, 'deny', r.id)
            ? form(REWARD_REASON_CODES, r.title, (notYet) => onAction({ kind: 'deny', reward: r, notYet }))
            : <div className="lf-family-hub-actions">
              <Button variant="success" disabled={busy} onClick={() => onAction({ kind: 'approveReward', reward: r })}>{copy.approve}</Button>
              <Button disabled={busy} onClick={() => setAnswering({ kind: 'deny', reward: r })}>{copy.deny}</Button>
            </div>}
        </li>)}</ul>
      </section>}

      {queue.levelRequests.length > 0 && <section aria-label={copy.levels} data-queue="levels">
        <h3 data-copy-role="heading">{copy.levels}</h3>
        <ul>{queue.levelRequests.map((q) => <li key={q.id} data-level-request={q.id}>
          <span data-copy-role="data">{fill(copy.levelAsk, { name: kidName(q.kidUserId), level: levelNames[q.level] })}</span>
          {q.note && <span className="ugc lf-autonomy-voice" data-copy-role="data" data-child-voice="note">{fill(copy.says, { name: kidName(q.kidUserId), note: q.note })}</span>}
          {same(answering, 'decline', q.id)
            ? form(LEVEL_REQUEST_REASON_CODES, null, (notYet) => onAction({ kind: 'decline', requestId: q.id, notYet }))
            : <div className="lf-family-hub-actions">
              <Button variant="success" disabled={busy} onClick={() => onAction({ kind: 'grant', requestId: q.id, level: q.level })}>{copy.grant}</Button>
              <Button disabled={busy} onClick={() => setAnswering({ kind: 'decline', requestId: q.id })}>{copy.deny}</Button>
            </div>}
        </li>)}</ul>
      </section>}

      {queue.reviews.length > 0 && <section aria-label={copy.reviews} data-queue="reviews">
        <h3 data-copy-role="heading">{copy.reviews}</h3>
        <Copy role="body">{copy.reviewsBody}</Copy>
        <ul>{queue.reviews.map((d) => <li key={d.id} data-review={d.id} data-outcome={d.outcome}>
          <span className="ugc" data-copy-role="data">{fill(d.outcome === 'self_logged' ? copy.selfLogged : copy.preapproved, { name: kidName(d.kidUserId), title: d.title ?? '' })}</span>
          {same(answering, 'question', d.id)
            ? form(d.subject === 'task' ? TASK_REASON_CODES : REVIEW_REWARD_REASON_CODES, d.title, (notYet) => onAction({ kind: 'question', review: d, notYet }))
            : <div className="lf-family-hub-actions">
              <Button variant="success" disabled={busy} onClick={() => onAction({ kind: 'confirm', review: d })}>{copy.looksGood}</Button>
              <Button disabled={busy} onClick={() => setAnswering({ kind: 'question', review: d })}>{copy.question}</Button>
            </div>}
        </li>)}</ul>
      </section>}

      {queue.openChores.length > 0 && <section aria-label={copy.open} data-queue="open">
        <h3 data-copy-role="heading">{copy.open}</h3>
        <ul>{queue.openChores.map((c) => <li key={c.id} data-task-id={c.id}>
          <div className="lf-family-hub-row">
            <span className="ugc" data-copy-role="data">{c.title}</span>
            <span className="lf-autonomy-chip" data-copy-role="data">{kidName(c.assignedTo)}</span>
          </div>
          {same(answering, 'remove', c.id)
            ? form(TASK_REASON_CODES, c.title, (notYet) => onAction({ kind: 'remove', chore: c, notYet }))
            : <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => setAnswering({ kind: 'remove', chore: c })}>{copy.remove}</Button></div>}
        </li>)}</ul>
      </section>}
    </>}
  </section>;
}
