import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, Card, Checkbox, ConfirmDialog, Dialog, EmptyState, ErrorState, InlineNotice, LoadingState, Pill, ProgressBar, RadioGroup,
  SegmentedControl, TextAreaField } from '../design/controls';
import { CartoonAvatar } from '../account/avatar/CartoonAvatar';
import { resolveLook } from '../account/avatar/avatarKit';
import { REPORT_CATEGORIES, REPORT_NOTE_MAX, type ReportCategory, type ReportCopy } from '../social/ReportDialog';
import '../design/tokens.css';
import '../design/system.css';
import './learnerPage.css';
import './together.css';
import { fill, learnCopy } from './learnCopy';
import type { TogetherGoal, TogetherOutcome, TogetherPerson, TogetherState } from './together';

/*
 * L-04 (owner decision OD-27 (1)) — goals together, at /learn/together, on the
 * learner shell. The one peer mechanic for 13 to 17 year olds: a shared
 * lesson goal with 1 to 4 mutual connections.
 *
 *   - What exists: the goal (a preset number of lessons in 7, 14 or 28 days),
 *     the people in it as cartoon cards, and ONE number, the group total.
 *   - What does not: a per-person count, an order of people by anything but
 *     when they joined, a score, a ranking, a public view, a reward or a
 *     celebration (OD-7's list has no group goal), and any way to send a
 *     person words (E.10). Reaching the goal is said once, as information.
 *   - Safety: anyone leaves at any time; the person who started the goal
 *     removes someone or cancels an ask; anyone reports someone in the goal
 *     (E.3), and may leave in the same step.
 *
 * Presentation only: the host (routes/app/learn/TogetherRoute.tsx, or the
 * preview) owns transport. Core decides eligibility; a closed state says why
 * in general words and never names a rule about another person.
 */

type Copy = (typeof learnCopy)['en-US']['together'];

export interface TogetherViewProps {
  locale: Locale;
  dark: boolean;
  state: TogetherState;
  /** People who may be asked (for a new goal or an open slot); null while unread or unavailable. */
  candidates: TogetherPerson[] | null;
  reportCopy: ReportCopy;
  onBack: () => void;
  onRetry: () => void;
  retrying?: boolean;
  onLoadCandidates: () => void;
  onStart: (target: number, days: number, usernames: string[]) => Promise<TogetherOutcome>;
  onAsk: (goalId: string, username: string) => Promise<TogetherOutcome>;
  onAnswer: (goalId: string, accept: boolean) => Promise<TogetherOutcome>;
  onLeave: (goalId: string) => Promise<TogetherOutcome>;
  onRemove: (goalId: string, username: string) => Promise<TogetherOutcome>;
  onReport: (goalId: string, username: string, category: ReportCategory, note: string | null, leave: boolean) => Promise<TogetherOutcome>;
  fixture?: boolean;
}

function refusalText(t: Copy, outcome: TogetherOutcome): string {
  switch (outcome) {
    case 'member-unavailable': return t.memberUnavailable;
    case 'full': return t.full;
    case 'limit': return t.limit;
    case 'already-asked': return t.alreadyAsked;
    case 'not-eligible': return t.closedBody;
    default: return t.saveFailed;
  }
}

function dateOf(iso: string, locale: Locale): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
}

function names(people: TogetherPerson[], locale: Locale, t: Copy): string {
  const list = people.map((p) => (p.isSelf ? t.you : p.displayName || p.username));
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(list);
}

export function TogetherView(props: TogetherViewProps) {
  const { locale, dark, state, fixture = false } = props;
  const t = learnCopy[locale].together;
  const status = state.status;
  return <div className="lf-rebuild lf-learner-page lf-together" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-age-band="13-17" data-screen={status === 'ready' ? (fixture ? 'together-preview' : 'together') : `together-${status}`} aria-busy={status === 'loading'}>
    <div className="lf-together-inner">
      <div className="lf-together-top"><Button onClick={props.onBack}>{t.back}</Button></div>
      <h1 data-copy-role="heading">{t.title}</h1>
      {status === 'loading' ? <LoadingState label={t.loading} lines={4} />
        : status === 'offline' || status === 'error' ? <ErrorState heading={t.errorTitle} body={status === 'offline' ? t.offlineBody : t.errorBody}
          retryLabel={t.retry} retryingLabel={t.retrying} retrying={props.retrying} onRetry={props.onRetry} />
          : state.status !== 'ready' || !state.value.eligible
            ? <EmptyState heading={t.closedTitle} body={`${t.closedBody} ${t.closedHint}`} />
            : <Ready {...props} value={state.value} t={t} />}
    </div>
  </div>;
}

function Ready(props: TogetherViewProps & { value: Extract<TogetherState, { status: 'ready' }>['value']; t: Copy }) {
  const { value, t, locale } = props;
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const headingId = useId();
  const say = (outcome: TogetherOutcome, success: string) => setNotice(outcome === 'done' ? { tone: 'success', text: success } : { tone: 'error', text: refusalText(t, outcome) });

  return <>
    <p className="lf-together-intro" data-copy-role="body">{t.intro}</p>
    <p className="lf-together-rules" data-copy-role="body">{t.rules}</p>
    {notice ? <InlineNotice tone={notice.tone} live>{notice.text}</InlineNotice> : null}

    {value.invitations.length > 0 ? <section className="lf-together-section" aria-labelledby={`${headingId}-asked`}>
      <h2 id={`${headingId}-asked`} data-copy-role="heading">{t.invitationsTitle}</h2>
      <ul className="lf-together-list">
        {value.invitations.map((invitation) => <li key={invitation.goalId}>
          <Card tone="sky" heading={fill(t.goalLine, { n: invitation.target, date: dateOf(invitation.endsAt, locale) })} headingLevel={3} as="article">
            {invitation.invitedBy ? <p data-copy-role="body">{fill(t.invitedBy, { name: invitation.invitedBy.displayName || invitation.invitedBy.username })}</p> : null}
            {invitation.members.length > 0 ? <p data-copy-role="body">{fill(t.withPeople, { names: names(invitation.members, locale, t) })}</p> : null}
            <People people={invitation.members} t={t} label={t.membersTitle} />
            <Answer {...props} goalId={invitation.goalId} onDone={say} />
          </Card>
        </li>)}
      </ul>
    </section> : null}

    <section className="lf-together-section" aria-labelledby={`${headingId}-goals`}>
      <h2 id={`${headingId}-goals`} data-copy-role="heading">{t.goalsTitle}</h2>
      {value.goals.length === 0 && !creating ? <EmptyState heading={t.emptyTitle} body={t.emptyBody} /> : null}
      <ul className="lf-together-list">
        {value.goals.map((goal) => <li key={goal.id}><GoalCard {...props} goal={goal} onDone={say} /></li>)}
      </ul>
      {creating
        ? <NewGoal {...props} onClose={() => setCreating(false)} onDone={(outcome) => { say(outcome, t.started); if (outcome === 'done') setCreating(false); }} />
        : value.goals.length < 3 ? <div className="lf-actions"><Button variant="accent" onClick={() => { setNotice(null); setCreating(true); props.onLoadCandidates(); }}>{t.newTitle}</Button></div> : null}
    </section>

    {value.finished.length > 0 ? <section className="lf-together-section" aria-labelledby={`${headingId}-done`}>
      <h2 id={`${headingId}-done`} data-copy-role="heading">{t.finishedTitle}</h2>
      <ul className="lf-together-list">
        {value.finished.map((goal) => <li key={goal.id} className="lf-together-finished">
          <span data-copy-role="body">{fill(t.goalLine, { n: goal.target, date: dateOf(goal.endsAt, locale) })}</span>
          <span data-copy-role="data">{fill(t.finishedLine, { done: goal.done, n: goal.target })}</span>
        </li>)}
      </ul>
    </section> : null}
  </>;
}

function People({ people, t, label }: { people: TogetherPerson[]; t: Copy; label: string }) {
  return <ul className="lf-together-people" aria-label={label}>
    {people.map((person) => <li key={person.username} className="lf-together-person">
      <CartoonAvatar look={resolveLook(person.avatarOptions, person.username)} size="sm" />
      <span data-copy-role="data">{person.isSelf ? t.you : person.displayName || person.username}</span>
    </li>)}
  </ul>;
}

function Answer({ goalId, t, onAnswer, onDone }: TogetherViewProps & { goalId: string; t: Copy; onDone: (o: TogetherOutcome, text: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function answer(accept: boolean) {
    setBusy(true);
    const outcome = await onAnswer(goalId, accept);
    setBusy(false);
    onDone(outcome, accept ? t.joined : t.declined);
  }
  return <div className="lf-actions">
    <Button variant="accent" pending={busy} disabled={busy} onClick={() => void answer(true)}>{t.join}</Button>
    <Button disabled={busy} onClick={() => void answer(false)}>{t.decline}</Button>
  </div>;
}

function GoalCard(props: TogetherViewProps & { goal: TogetherGoal; t: Copy; onDone: (o: TogetherOutcome, text: string) => void }) {
  const { goal, t, locale, onDone } = props;
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState<TogetherPerson | null>(null);
  const [reporting, setReporting] = useState<TogetherPerson | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const others = goal.members.filter((m) => !m.isSelf);
  const alreadyIn = new Set([...goal.members, ...goal.invited].map((p) => p.username));

  async function run(action: () => Promise<TogetherOutcome>, success: string) {
    setBusy(true);
    const outcome = await action();
    setBusy(false);
    onDone(outcome, success);
    return outcome;
  }

  return <Card tone="mint" heading={fill(t.goalLine, { n: goal.target, date: dateOf(goal.endsAt, locale) })} headingLevel={3} as="article">
    <ProgressBar label={t.progressLabel} value={Math.min(goal.done, goal.target)} max={goal.target} tone="mint"
      valueText={fill(t.progressValue, { done: goal.done, n: goal.target })} />
    {goal.reached ? <InlineNotice tone="info">{t.reached}</InlineNotice> : null}
    <h4 className="lf-together-subhead" data-copy-role="heading">{t.membersTitle}</h4>
    <ul className="lf-together-people" aria-label={t.membersTitle}>
      {goal.members.map((person) => <li key={person.username} className="lf-together-person">
        <CartoonAvatar look={resolveLook(person.avatarOptions, person.username)} size="sm" />
        <span data-copy-role="data">{person.isSelf ? t.you : person.displayName || person.username}</span>
        {!person.isSelf && goal.createdByMe ? <Button size="sm" disabled={busy} onClick={() => setRemoving(person)}>{t.remove}</Button> : null}
      </li>)}
      {goal.invited.map((person) => <li key={person.username} className="lf-together-person">
        <CartoonAvatar look={resolveLook(person.avatarOptions, person.username)} size="sm" />
        <span data-copy-role="data">{person.displayName || person.username}</span>
        <Pill tone="sky">{t.waiting}</Pill>
        {goal.createdByMe || person.mine
          ? <Button size="sm" disabled={busy} onClick={() => void run(() => props.onRemove(goal.id, person.username), t.removed)}>{t.withdraw}</Button> : null}
      </li>)}
    </ul>
    {asking ? <AskSomeone candidates={props.candidates} t={t} exclude={alreadyIn} onClose={() => setAsking(false)}
      onPick={async (username) => { const outcome = await run(() => props.onAsk(goal.id, username), t.invited); if (outcome === 'done') setAsking(false); }} /> : null}
    <div className="lf-actions lf-together-goal-actions">
      {goal.canInvite && !asking ? <Button disabled={busy} onClick={() => { setAsking(true); props.onLoadCandidates(); }}>{t.invite}</Button> : null}
      {others.length > 0 ? <Button disabled={busy} onClick={() => setReporting(others[0] ?? null)}>{t.report}</Button> : null}
      <Button disabled={busy} onClick={() => setLeaving(true)}>{t.leave}</Button>
    </div>
    <ConfirmDialog open={leaving} heading={t.leaveTitle} consequence={t.leaveBody} keepLabel={t.stay} confirmLabel={t.leaveYes} pendingLabel={t.leaveYes}
      pending={busy} destructive onKeep={() => setLeaving(false)}
      onConfirm={() => void run(() => props.onLeave(goal.id), t.left).then(() => setLeaving(false))} />
    <ConfirmDialog open={removing !== null} heading={fill(t.removeTitle, { name: removing?.displayName || removing?.username || '' })} consequence={t.removeBody}
      keepLabel={t.stay} confirmLabel={t.removeYes} pendingLabel={t.removeYes} pending={busy} destructive onKeep={() => setRemoving(null)}
      onConfirm={() => { const target = removing; if (target) void run(() => props.onRemove(goal.id, target.username), t.removed).then(() => setRemoving(null)); }} />
    {reporting ? <ReportFromGoal {...props} people={others} initial={reporting} onClose={() => setReporting(null)}
      onSent={() => { setReporting(null); onDone('done', t.reported); }} /> : null}
  </Card>;
}

function AskSomeone({ candidates, exclude, t, onPick, onClose }: {
  candidates: TogetherPerson[] | null; exclude: Set<string>; t: Copy; onPick: (username: string) => Promise<void>; onClose: () => void;
}) {
  const name = useId();
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const people = (candidates ?? []).filter((p) => !exclude.has(p.username));
  if (candidates === null) return <LoadingState label={t.loading} lines={2} />;
  return <div className="lf-together-ask">
    {people.length === 0 ? <p data-copy-role="body">{t.noPeople}</p>
      : <RadioGroup legend={t.newPeople} name={`${name}-ask`} value={choice} disabled={busy} onValueChange={setChoice}
        options={people.map((p) => ({ value: p.username, label: p.displayName || p.username }))} />}
    <div className="lf-actions">
      {people.length > 0 ? <Button variant="accent" pending={busy} pendingLabel={t.invite} disabled={!choice || busy}
        onClick={async () => { if (!choice) return; setBusy(true); await onPick(choice); setBusy(false); }}>{t.invite}</Button> : null}
      <Button disabled={busy} onClick={onClose}>{t.cancel}</Button>
    </div>
  </div>;
}

function NewGoal({ value, candidates, t, locale, onStart, onClose, onDone }: TogetherViewProps & {
  value: Extract<TogetherState, { status: 'ready' }>['value']; t: Copy; onClose: () => void; onDone: (outcome: TogetherOutcome) => void;
}) {
  const name = useId();
  const [target, setTarget] = useState(String(value.options.targets[1] ?? value.options.targets[0]));
  const [days, setDays] = useState(String(value.options.days[1] ?? value.options.days[0]));
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const max = value.options.maxPeople - 1;
  const number = new Intl.NumberFormat(locale);

  async function start() {
    if (picked.length === 0) { setMissing(true); return; }
    setBusy(true);
    const outcome = await onStart(Number(target), Number(days), picked);
    setBusy(false);
    onDone(outcome);
  }

  return <form className="lf-together-new" aria-label={t.newTitle} onSubmit={(event) => { event.preventDefault(); void start(); }}>
    <h3 data-copy-role="heading">{t.newTitle}</h3>
    <SegmentedControl legend={t.newTarget} name={`${name}-target`} value={target} disabled={busy} onValueChange={setTarget}
      options={value.options.targets.map((n) => ({ value: String(n), label: fill(t.lessonsOption, { n: number.format(n) }) }))} />
    <SegmentedControl legend={t.newDays} name={`${name}-days`} value={days} disabled={busy} onValueChange={setDays}
      options={value.options.days.map((n) => ({ value: String(n), label: fill(t.daysOption, { n: number.format(n) }) }))} />
    <fieldset className="lf-together-pick">
      <legend data-copy-role="body">{t.newPeople}</legend>
      <p data-copy-role="body">{t.peopleHelp}</p>
      {candidates === null ? <LoadingState label={t.loading} lines={2} />
        : candidates.length === 0 ? <p data-copy-role="body">{t.noPeople}</p>
          : candidates.map((person) => <Checkbox key={person.username} label={person.displayName || person.username}
            checked={picked.includes(person.username)} disabled={busy || (!picked.includes(person.username) && picked.length >= max)}
            onChange={(event) => { setMissing(false); setPicked((prev) => event.target.checked ? [...prev, person.username] : prev.filter((u) => u !== person.username)); }} />)}
      {missing ? <InlineNotice tone="error" live>{t.pickPeople}</InlineNotice> : null}
    </fieldset>
    <div className="lf-actions">
      <Button type="submit" variant="accent" pending={busy} pendingLabel={t.starting} disabled={busy || candidates === null || candidates.length === 0}>{t.start}</Button>
      <Button type="button" disabled={busy} onClick={onClose}>{t.cancel}</Button>
    </div>
  </form>;
}

function ReportFromGoal({ goal, people, initial, reportCopy, t, onReport, onClose, onSent }: TogetherViewProps & {
  goal: TogetherGoal; people: TogetherPerson[]; initial: TogetherPerson; t: Copy; onClose: () => void; onSent: () => void;
}) {
  const name = useId();
  const [who, setWho] = useState<string | null>(initial.username);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState('');
  const [leave, setLeave] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<'reason' | 'failed' | null>(null);

  async function send() {
    if (!category || !who) { setError('reason'); return; }
    setSending(true);
    setError(null);
    const trimmed = note.trim();
    const outcome = await onReport(goal.id, who, category, trimmed === '' ? null : trimmed.slice(0, REPORT_NOTE_MAX), leave);
    setSending(false);
    if (outcome === 'done') onSent(); else setError('failed');
  }

  return <Dialog open heading={reportCopy.title} description={reportCopy.body} onClose={sending ? undefined : onClose}
    actions={<>
      <Button onClick={onClose} disabled={sending}>{reportCopy.cancel}</Button>
      <Button variant="accent" pending={sending} pendingLabel={reportCopy.sending} onClick={() => void send()}>{reportCopy.send}</Button>
    </>}>
    <div className="lf-report-form">
      {people.length > 1 ? <RadioGroup legend={t.membersTitle} name={`${name}-who`} value={who} disabled={sending} onValueChange={setWho}
        options={people.map((p) => ({ value: p.username, label: p.displayName || p.username }))} /> : null}
      <RadioGroup legend={reportCopy.reason} name={`${name}-category`} value={category} disabled={sending}
        error={error === 'reason' ? reportCopy.reasonRequired : undefined}
        onValueChange={(value) => { setCategory(value); if (error === 'reason') setError(null); }}
        options={REPORT_CATEGORIES.map((value) => ({ value, label: reportCopy.categories[value] }))} />
      <TextAreaField label={reportCopy.note} help={reportCopy.noteHelp} value={note} maxLength={REPORT_NOTE_MAX} disabled={sending}
        onChange={(event) => setNote(event.target.value)} />
      <Checkbox label={t.reportLeave} checked={leave} disabled={sending} onChange={(event) => setLeave(event.target.checked)} />
      {error === 'failed' ? <InlineNotice tone="error" live>{reportCopy.failed}</InlineNotice> : null}
    </div>
  </Dialog>;
}
