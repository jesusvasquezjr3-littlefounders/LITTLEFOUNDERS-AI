import { useId, useState } from 'react';
import { Button, Chip, CoinAmount, Copy, InlineNotice, LoadingState } from '../design/controls';
import { SuccessWipe } from '../design/motion';
import { NotYetForm, type NotYetCopy } from './NotYetForm';
import { ReflectionStep, type ReflectionCopy } from './ReflectionStep';
import {
  LEVEL_REQUEST_REASON_CODES, REVIEW_REWARD_REASON_CODES, REWARD_REASON_CODES, TASK_REASON_CODES,
  type ChildRewardReason, type Decision, type Level, type NotYet, type Queue, type QueueChore, type QueueReward, type Reflection,
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
 *
 * S07.7 (D.23): every decision starts with the reflective prompt (what would
 * you tell them about this?), before and apart from the reason the child
 * reads. A yes becomes two taps; a "not yet" goes prompt, then reason form.
 */

export interface QueueCopy {
  heading: string; empty: string; chores: string; rewards: string; says: string; wants: string; photo: string; needsPhoto: string; cost: string;
  approve: string; sendBack: string; remove: string; deny: string; open: string; reviews: string; reviewsBody: string; selfLogged: string;
  preapproved: string; looksGood: string; question: string; talk: string; talkPattern: string; talkChild: string; talkTip: string; talked: string;
  dismiss: string; levels: string; levelAsk: string; grant: string; done: string; failed: string; loading: string; retry: string;
  saved_for_it: string; treat: string; need_it: string; for_someone: string; other: string;
}

type NotYetTarget =
  | { kind: 'sendBack' | 'remove'; chore: QueueChore }
  | { kind: 'deny'; reward: QueueReward }
  | { kind: 'question'; review: Decision }
  | { kind: 'decline'; requestId: string };
type YesTarget =
  | { kind: 'approveChore'; chore: QueueChore }
  | { kind: 'approveReward'; reward: QueueReward }
  | { kind: 'confirm'; review: Decision }
  | { kind: 'grant'; requestId: string; level: Level };

/** First the reflective prompt, then (for a "not yet") the reason form. */
type Answering =
  | { stage: 'reflect'; target: NotYetTarget | YesTarget; name: string }
  | { stage: 'reason'; target: NotYetTarget; reflection: Reflection; words: string | null };

export type QueueAction =
  | { kind: 'approveChore'; chore: QueueChore; reflection: Reflection; note: string | null }
  | { kind: 'sendBack' | 'remove'; chore: QueueChore; notYet: NotYet; reflection: Reflection }
  | { kind: 'approveReward'; reward: QueueReward; reflection: Reflection; note: string | null }
  | { kind: 'deny'; reward: QueueReward; notYet: NotYet; reflection: Reflection }
  | { kind: 'confirm'; review: Decision; reflection: Reflection }
  | { kind: 'question'; review: Decision; notYet: NotYet; reflection: Reflection }
  | { kind: 'grant'; requestId: string; level: Level; reflection: Reflection }
  | { kind: 'decline'; requestId: string; notYet: NotYet; reflection: Reflection }
  | { kind: 'closeNudge'; nudgeId: string; outcome: 'talked' | 'dismissed' };

const NOT_YET_KINDS: readonly string[] = ['sendBack', 'remove', 'deny', 'question', 'decline'];
const targetId = (t: NotYetTarget | YesTarget) => ('chore' in t ? t.chore.id : 'reward' in t ? t.reward.id : 'review' in t ? t.review.id : t.requestId);
const targetTitle = (t: NotYetTarget | YesTarget) => ('chore' in t ? t.chore.title : 'reward' in t ? t.reward.title : 'review' in t ? t.review.title : null);

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function DecisionQueue({ copy, notYetCopy, reflectionCopy, levelNames, kidName, locale, dark, queue, loading, failed, busy, notice, onRetry, onAction }: {
  copy: QueueCopy;
  notYetCopy: NotYetCopy;
  reflectionCopy: ReflectionCopy;
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
  // 04 §4.2: an approved chore or reward is covered by the success wipe, which clears to reveal the row as approved.
  // The row stays (as approved) until the wipe ends, even when the refreshed queue no longer lists it.
  const [wipe, setWipe] = useState<{ id: string; title: string; list: 'chores' | 'rewards' } | null>(null);
  const wipeDone = () => setWipe(null);
  const reasonText: Record<ChildRewardReason, string> = { saved_for_it: copy.saved_for_it, treat: copy.treat, need_it: copy.need_it, for_someone: copy.for_someone, other: copy.other };
  const empty = queue !== null && queue.chores.length + queue.rewards.length + queue.reviews.length + queue.nudges.length + queue.levelRequests.length + queue.openChores.length === 0;
  const open = (id: string, kinds: readonly string[]) => answering !== null && targetId(answering.target) === id && kinds.includes(answering.target.kind);
  const reflect = (target: NotYetTarget | YesTarget, childId: string | null) => setAnswering({ stage: 'reflect', target, name: childId ? kidName(childId) : '' });

  /** The row the success wipe reveals once the queue no longer lists it: the same key, now approved. */
  function approvedRow(row: { id: string; title: string }) {
    return <li key={row.id} data-approved="true">
      <div className="lf-family-hub-row">
        <span className="ugc" data-copy-role="data">{row.title}</span>
        <Chip tone="success" glyph="check">{copy.done}</Chip>
      </div>
      <SuccessWipe active label={row.title} onDone={wipeDone} />
    </li>;
  }

  /** The prompt, then either the yes itself or the reason form. */
  function decide(codes: Parameters<typeof NotYetForm>[0]['codes']) {
    if (!answering) return null;
    if (answering.stage === 'reflect') {
      const target = answering.target;
      const notYet = NOT_YET_KINDS.includes(target.kind);
      const noteAllowed = target.kind === 'approveChore' || target.kind === 'approveReward';
      return <ReflectionStep copy={reflectionCopy} name={answering.name} heading={targetTitle(target)} notYet={notYet} noteAllowed={noteAllowed} busy={busy}
        onBack={() => setAnswering(null)}
        onContinue={(reflection, words) => {
          if (notYet) { setAnswering({ stage: 'reason', target: target as NotYetTarget, reflection, words }); return; }
          const note = reflection === 'shared' ? words : null;
          const yes = target as YesTarget;
          setAnswering(null);
          if (yes.kind === 'approveChore') {
            setWipe({ id: yes.chore.id, title: yes.chore.title, list: 'chores' });
            onAction({ kind: 'approveChore', chore: yes.chore, reflection, note });
          } else if (yes.kind === 'approveReward') {
            setWipe({ id: yes.reward.id, title: yes.reward.title ?? '', list: 'rewards' });
            onAction({ kind: 'approveReward', reward: yes.reward, reflection, note });
          }
          else if (yes.kind === 'confirm') onAction({ kind: 'confirm', review: yes.review, reflection });
          else onAction({ kind: 'grant', requestId: yes.requestId, level: yes.level, reflection });
        }} />;
    }
    const { reflection, words } = answering;
    const t = answering.target;
    return <NotYetForm copy={notYetCopy} codes={codes} busy={busy} heading={targetTitle(t) ?? undefined}
      initialReason={reflection === 'shared' ? words ?? undefined : undefined} onCancel={() => setAnswering(null)}
      onSubmit={(notYet) => {
        setAnswering(null);
        if ('chore' in t) onAction({ kind: t.kind, chore: t.chore, notYet, reflection });
        else if ('reward' in t) onAction({ kind: 'deny', reward: t.reward, notYet, reflection });
        else if ('review' in t) onAction({ kind: 'question', review: t.review, notYet, reflection });
        else onAction({ kind: 'decline', requestId: t.requestId, notYet, reflection });
      }} />;
  }

  return <section className="lf-rebuild lf-family-hub lf-autonomy" data-autonomy="queue" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={heading}>
    <h2 id={heading} data-copy-role="heading">{copy.heading}</h2>
    {failed ? <>
      <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : loading || !queue ? <LoadingState label={copy.loading} /> : <>
      {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
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

      {(queue.chores.length > 0 || wipe?.list === 'chores') && <section aria-label={copy.chores} data-queue="chores">
        <h3 data-copy-role="heading">{copy.chores}</h3>
        <ul>{queue.chores.map((c) => <li key={c.id} data-task-id={c.id}>
          <div className="lf-family-hub-row">
            <span className="ugc" data-copy-role="data">{c.title}</span>
            <span className="lf-autonomy-chip" data-copy-role="data">{kidName(c.assignedTo)}</span>
          </div>
          {c.childNote && <span className="ugc lf-autonomy-voice" data-copy-role="data" data-child-voice="note">{fill(copy.says, { name: kidName(c.assignedTo), note: c.childNote })}</span>}
          {c.requiresEvidence && <span className="lf-family-hub-muted" data-copy-role="data">{c.hasEvidence ? copy.photo : copy.needsPhoto}</span>}
          {open(c.id, ['approveChore', 'sendBack', 'remove'])
            ? decide(TASK_REASON_CODES)
            : <div className="lf-family-hub-actions">
              <Button variant="success" disabled={busy || (c.requiresEvidence && !c.hasEvidence)} onClick={() => reflect({ kind: 'approveChore', chore: c }, c.assignedTo)}>{copy.approve}</Button>
              <Button disabled={busy} onClick={() => reflect({ kind: 'sendBack', chore: c }, c.assignedTo)}>{copy.sendBack}</Button>
              <Button disabled={busy} onClick={() => reflect({ kind: 'remove', chore: c }, c.assignedTo)}>{copy.remove}</Button>
            </div>}
          <SuccessWipe active={wipe?.id === c.id} label={c.title} onDone={wipeDone} />
        </li>)}{wipe?.list === 'chores' && !queue.chores.some((c) => c.id === wipe.id) ? approvedRow(wipe) : null}</ul>
      </section>}

      {(queue.rewards.length > 0 || wipe?.list === 'rewards') && <section aria-label={copy.rewards} data-queue="rewards">
        <h3 data-copy-role="heading">{copy.rewards}</h3>
        <ul>{queue.rewards.map((r) => <li key={r.id} data-redemption-id={r.id}>
          <div className="lf-family-hub-row">
            <span className="ugc" data-copy-role="data">{r.title ?? ''}</span>
            {r.cost !== null && <CoinAmount className="lf-family-hub-amount">{fill(copy.cost, { count: r.cost })}</CoinAmount>}
          </div>
          {r.childReasonKind && <span className="lf-autonomy-voice" data-copy-role="data" data-child-voice="reason">
            {fill(copy.wants, { name: kidName(r.kidUserId), reason: reasonText[r.childReasonKind] })}</span>}
          {r.childNote && <span className="ugc lf-autonomy-voice" data-copy-role="data" data-child-voice="note">{fill(copy.says, { name: kidName(r.kidUserId), note: r.childNote })}</span>}
          {open(r.id, ['approveReward', 'deny'])
            ? decide(REWARD_REASON_CODES)
            : <div className="lf-family-hub-actions">
              <Button variant="success" disabled={busy} onClick={() => reflect({ kind: 'approveReward', reward: r }, r.kidUserId)}>{copy.approve}</Button>
              <Button disabled={busy} onClick={() => reflect({ kind: 'deny', reward: r }, r.kidUserId)}>{copy.deny}</Button>
            </div>}
          <SuccessWipe active={wipe?.id === r.id} label={r.title ?? ''} onDone={wipeDone} />
        </li>)}{wipe?.list === 'rewards' && !queue.rewards.some((r) => r.id === wipe.id) ? approvedRow(wipe) : null}</ul>
      </section>}

      {queue.levelRequests.length > 0 && <section aria-label={copy.levels} data-queue="levels">
        <h3 data-copy-role="heading">{copy.levels}</h3>
        <ul>{queue.levelRequests.map((q) => <li key={q.id} data-level-request={q.id}>
          <span data-copy-role="data">{fill(copy.levelAsk, { name: kidName(q.kidUserId), level: levelNames[q.level] })}</span>
          {q.note && <span className="ugc lf-autonomy-voice" data-copy-role="data" data-child-voice="note">{fill(copy.says, { name: kidName(q.kidUserId), note: q.note })}</span>}
          {open(q.id, ['grant', 'decline'])
            ? decide(LEVEL_REQUEST_REASON_CODES)
            : <div className="lf-family-hub-actions">
              <Button variant="success" disabled={busy} onClick={() => reflect({ kind: 'grant', requestId: q.id, level: q.level }, q.kidUserId)}>{copy.grant}</Button>
              <Button disabled={busy} onClick={() => reflect({ kind: 'decline', requestId: q.id }, q.kidUserId)}>{copy.deny}</Button>
            </div>}
        </li>)}</ul>
      </section>}

      {queue.reviews.length > 0 && <section aria-label={copy.reviews} data-queue="reviews">
        <h3 data-copy-role="heading">{copy.reviews}</h3>
        <Copy role="body">{copy.reviewsBody}</Copy>
        <ul>{queue.reviews.map((d) => <li key={d.id} data-review={d.id} data-outcome={d.outcome}>
          <span className="ugc" data-copy-role="data">{fill(d.outcome === 'self_logged' ? copy.selfLogged : copy.preapproved, { name: kidName(d.kidUserId), title: d.title ?? '' })}</span>
          {open(d.id, ['confirm', 'question'])
            ? decide(d.subject === 'task' ? TASK_REASON_CODES : REVIEW_REWARD_REASON_CODES)
            : <div className="lf-family-hub-actions">
              <Button variant="success" disabled={busy} onClick={() => reflect({ kind: 'confirm', review: d }, d.kidUserId)}>{copy.looksGood}</Button>
              <Button disabled={busy} onClick={() => reflect({ kind: 'question', review: d }, d.kidUserId)}>{copy.question}</Button>
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
          {open(c.id, ['remove'])
            ? decide(TASK_REASON_CODES)
            : <div className="lf-family-hub-actions"><Button disabled={busy} onClick={() => reflect({ kind: 'remove', chore: c }, c.assignedTo)}>{copy.remove}</Button></div>}
        </li>)}</ul>
      </section>}
    </>}
  </section>;
}
