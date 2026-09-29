import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Button, ButtonGroup, Card, Checkbox, ChipGroup, ChoiceChip, Copy, DashboardLayout, EmptyState, ErrorState, InlineNotice, ProgressBar, SegmentedControl,
  SelectField, TextField,
} from '../../design/controls';
import { childName, fetchChildren, type Child, type ConsoleTransport } from '../../family/console/consoleApi';
import { ConsoleLink, FailureState, fill, PageLoading, type ConsoleLocale, type PageFailure } from '../../family/console/consoleParts';
import type { CoinCardCopy, TutorCoinsCopy } from '../../family/tasks/taskParts';
import { CardFields } from './cardParts';
import { ChildCoinActivity } from './ChildCoinActivity';
import {
  ALLOWANCE_MAX, CARD_NAME_MAX, fetchSetup, openCard, saveAllowance, saveLimit, validAllowance, type Allowance, type CardDesign, type ChildCoinsSetup,
  type Frequency, type Limit, type LimitWindow,
} from './coinsApi';
import '../../design/tokens.css';
import '../../design/system.css';
import '../../family/console/console.css';
import '../../family/tasks/money.css';

/*
 * F5-P, the Tutor's coin cards (W2F.2): one child at a time (the picker
 * writes `?child=`, like the Family console), rebuilt on the dashboard layout
 * inside the Tutor shell.
 *
 * For the child in view: no card yet offers "Open a coin card" (a name and a
 * colour; a practice card with no number, D.7). With a card, most important
 * first: the freeze card (D.1: it really holds rewards, splits, the
 * scheduled coins and Share gifts; it says who set it and which age view the
 * child reads, D.7, D.12), the allowance, the spending limit with its
 * coaching note (D.23; counted over the last 7 or 30 days and checked when a
 * reward is asked for, which is where the database enforces it), the savings
 * bonus in the framing the child's age calls for (D.11), the coin
 * corrections and goal moves with the goals' provenance (D.5, D.15, D.16),
 * and the Share places with the child's usual split (D.13, D.14). Beside
 * them: the decisions waiting (D.17, D.18) and what the practice covers and
 * does not (D.20).
 *
 * GAP-FIX-R6 (OD-3 §2, Law 5, H-06): right under the freeze card, the
 * child's own coins as the Tutor reads them: the three pockets, the month
 * summary and the latest history, a linked teen's self-directed entries
 * included (ChildCoinActivity). A child with no coin card yet still has
 * pockets, so the read shows beside "Open a coin card" too.
 *
 * Those wave-1 surfaces keep their own data planes and arrive as slots for
 * the child in view; this screen owns the family list, the child's card,
 * allowance and limit. Nothing here authorizes anything: the route admits a
 * parent and Core re-checks the verified guardian link on every request.
 */

export interface TutorCoinsSlots {
  freeze: ReactNode;
  coaching: ReactNode;
  bonus: ReactNode;
  corrections: ReactNode;
  share: ReactNode;
}

type Load = { status: 'loading' } | { status: 'failed'; failure: PageFailure } | { status: 'ready'; children: Child[] };

export function TutorCoins({ copy, colours, locale, dark, transport, selectedId, onSelect, onNavigate, childSlots, aside, verifyHref = '/verify-parent' }: {
  copy: TutorCoinsCopy;
  colours: CoinCardCopy;
  locale: ConsoleLocale;
  dark: boolean;
  transport: ConsoleTransport;
  selectedId: string | null;
  onSelect: (userId: string) => void;
  onNavigate: (href: string) => void;
  /** The wave-1 surfaces for the child in view; `changed` re-reads this child's card. */
  childSlots: (child: Child, changed: () => void) => TutorCoinsSlots;
  /** Family-wide pieces beside the child: the decisions waiting and the scope statement. */
  aside: ReactNode;
  verifyHref?: string;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [retrying, setRetrying] = useState(false);
  const generation = useRef(0);

  const read = useCallback(async () => {
    const current = ++generation.current;
    const result = await fetchChildren(transport);
    if (current !== generation.current) return;
    setRetrying(false);
    setLoad(result.ok ? { status: 'ready', children: result.data } : { status: 'failed', failure: { code: result.code } });
  }, [transport]);

  useEffect(() => {
    void read();
    return () => { generation.current++; };
  }, [read]);

  const root = (body: ReactNode) => <div className="lf-rebuild lf-family-console lf-family-money" data-screen="tutor-coins" data-theme={dark ? 'dark' : 'light'} lang={locale}>
    <header className="lf-console-header"><h1 data-copy-role="heading">{copy.title}</h1></header>
    {body}
  </div>;

  if (load.status === 'loading') return root(<PageLoading label={copy.loading} />);
  if (load.status === 'failed') {
    if (load.failure.code === 'PARENT_VERIFICATION_REQUIRED') {
      return root(<EmptyState heading={copy.verifyTitle} body={copy.verifyBody}
        action={<ConsoleLink href={verifyHref} onNavigate={onNavigate} variant="accent">{copy.verifyAction}</ConsoleLink>} />);
    }
    return root(<FailureState failure={load.failure} copy={copy} retrying={retrying} onRetry={() => { setRetrying(true); void read(); }} />);
  }
  const { children } = load;
  const child = children.find((entry) => entry.userId === selectedId) ?? children[0] ?? null;
  if (!child) {
    return root(<EmptyState heading={copy.emptyTitle} body={copy.emptyBody}
      action={<ConsoleLink href="/family" onNavigate={onNavigate} variant="accent">{copy.emptyAction}</ConsoleLink>} />);
  }

  return root(<DashboardLayout
    primary={<>
      {/* The chips are the children's names; the picker is named for assistive technology, not titled (the first view stays within 40 words). */}
      {children.length > 1 ? <nav className="lf-console-picker" aria-label={copy.children} data-console-part="picker">
        <ChipGroup>
          {children.map((entry) => <ChoiceChip key={entry.userId} selected={entry.userId === child.userId} onToggle={() => onSelect(entry.userId)}>
            <span className="ugc">{childName(entry)}</span>
          </ChoiceChip>)}
        </ChipGroup>
      </nav> : null}
      {/* Keyed by child: a response for one child never lands on another. */}
      <ChildSetup key={child.userId} child={child} copy={copy} colours={colours} locale={locale} transport={transport} slots={childSlots} />
    </>}
    secondary={aside} />);
}

type Setup = { status: 'loading' } | { status: 'failed'; failure: PageFailure } | { status: 'ready'; setup: ChildCoinsSetup };

function ChildSetup({ child, copy, colours, locale, transport, slots }: {
  child: Child; copy: TutorCoinsCopy; colours: CoinCardCopy; locale: ConsoleLocale; transport: ConsoleTransport;
  slots: (child: Child, changed: () => void) => TutorCoinsSlots;
}) {
  const [state, setState] = useState<Setup>({ status: 'loading' });
  const [retrying, setRetrying] = useState(false);
  const [coinsVersion, setCoinsVersion] = useState(0);
  const generation = useRef(0);

  const read = useCallback(async () => {
    const current = ++generation.current;
    const result = await fetchSetup(transport, child.userId);
    if (current !== generation.current) return;
    setRetrying(false);
    if (!result.ok) {
      setState((previous) => previous.status === 'ready' ? previous : { status: 'failed', failure: { code: result.code } });
      return;
    }
    setState({ status: 'ready', setup: result.data });
  }, [transport, child.userId]);

  useEffect(() => {
    void read();
    return () => { generation.current++; };
  }, [read]);

  if (state.status === 'loading') return <PageLoading label={copy.loading} />;
  if (state.status === 'failed') {
    return <ErrorState heading={copy.childFailed} body={state.failure.code === 'NETWORK' ? copy.offlineBody : copy.failedBody}
      retryLabel={copy.retry} retryingLabel={copy.retrying} retrying={retrying} onRetry={() => { setRetrying(true); void read(); }} />;
  }
  const { setup } = state;
  const coins = <ChildCoinActivity child={child} copy={copy} locale={locale} transport={transport} refreshKey={coinsVersion} />;
  if (!setup.card) {
    return <>
      <OpenCard child={child} copy={copy} colours={colours} transport={transport}
        onOpened={(card) => setState({ status: 'ready', setup: { ...setup, card } })} />
      {coins}
    </>;
  }
  // A slot that moved coins (a correction, a goal move, a freeze) re-reads the card and every open part of the coins read.
  const parts = slots(child, () => { void read(); setCoinsVersion((value) => value + 1); });
  return <>
    <div className="lf-money-slot" data-family-part="freeze">{parts.freeze}</div>
    {coins}
    <AllowanceForm child={child} copy={copy} locale={locale} transport={transport} rule={setup.allowance}
      onSaved={(allowance) => setState({ status: 'ready', setup: { ...setup, allowance } })} />
    <LimitForm child={child} copy={copy} transport={transport} limit={setup.limit}
      coaching={parts.coaching} onSaved={(limit) => setState({ status: 'ready', setup: { ...setup, limit } })} />
    <div className="lf-money-slot" data-family-part="bonus">{parts.bonus}</div>
    <div className="lf-money-slot" data-family-part="corrections">{parts.corrections}</div>
    <div className="lf-money-slot" data-family-part="share">{parts.share}</div>
  </>;
}

function OpenCard({ child, copy, colours, transport, onOpened }: {
  child: Child; copy: TutorCoinsCopy; colours: CoinCardCopy; transport: ConsoleTransport; onOpened: (card: { nickname: string; design: CardDesign; frozen: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [design, setDesign] = useState<CardDesign>('indigo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const nickname = name.trim();
    if (nickname.length === 0 || nickname.length > CARD_NAME_MAX) { setError(copy.nameMissing); return; }
    setBusy(true); setError(null);
    const result = await openCard(transport, child.userId, { nickname, cardDesign: design });
    setBusy(false);
    if (!result.ok) { setError(copy.openFailed); return; }
    onOpened(result.data);
  }

  return <Card heading={copy.openTitle}>
    <form className="lf-console-form" data-family-part="open-card" noValidate onSubmit={(event) => void submit(event)}>
      <Copy role="body">{copy.openBody}</Copy>
      {error ? <InlineNotice tone="error" live>{error}</InlineNotice> : null}
      <CardFields labels={copy} colours={colours} name={name} design={design} onName={setName} onDesign={setDesign} disabled={busy} />
      <ButtonGroup><Button type="submit" variant="success" pending={busy} pendingLabel={copy.opening}>{copy.open}</Button></ButtonGroup>
    </form>
  </Card>;
}

const REFUSAL: Record<string, 'needsCard' | 'invalid'> = { CONFLICT: 'needsCard', VALIDATION_ERROR: 'invalid' };
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const count = (value: string) => /^\d{1,7}$/.test(value.trim()) ? Number(value.trim()) : NaN;

function AllowanceForm({ child, copy, locale, transport, rule, onSaved }: {
  child: Child; copy: TutorCoinsCopy; locale: ConsoleLocale; transport: ConsoleTransport; rule: Allowance | null; onSaved: (rule: Allowance) => void;
}) {
  const name = useId();
  const [active, setActive] = useState(rule?.active ?? false);
  const [amount, setAmount] = useState(String(rule?.amount ?? 10));
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'weekly');
  const [day, setDay] = useState(rule?.anchorDay ?? 5);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  function often(next: Frequency) {
    // A weekday (0-6) and a date (1-28) are different things: moving between them starts from a clear default
    // (the 1st, or Friday) instead of reading one as the other, and always stays inside Core's rule.
    if ((next === 'monthly') !== (frequency === 'monthly')) setDay(next === 'monthly' ? 1 : 5);
    setFrequency(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const input = { amount: count(amount), frequency, anchorDay: day, active };
    if (!validAllowance(input)) { setNotice({ text: copy.invalid, error: true }); return; }
    setBusy(true); setNotice(null);
    const result = await saveAllowance(transport, child.userId, input);
    setBusy(false);
    if (!result.ok) { setNotice({ text: copy[REFUSAL[result.code] ?? 'saveFailed'], error: true }); return; }
    setNotice({ text: copy.saved, error: false });
    onSaved(result.data);
  }

  // Core schedules the allowance at midnight UTC on the chosen day (computeNextRunAt): shown in UTC, so Friday reads as Friday everywhere.
  const date = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return <Card heading={copy.allowanceTitle}>
    <form className="lf-console-form" data-family-part="allowance" data-child-id={child.userId} noValidate onSubmit={(event) => void submit(event)}>
      <Copy role="body">{copy.allowanceBody}</Copy>
      <Checkbox label={copy.allowanceSwitch} checked={active} onChange={(event) => setActive(event.target.checked)} disabled={busy} />
      {active ? <>
        <TextField label={copy.amount} help={copy.amountHelp} type="number" inputMode="numeric" min={1} max={ALLOWANCE_MAX} step={1} value={amount}
          disabled={busy} onChange={(event) => setAmount(event.target.value)} />
        <SegmentedControl legend={copy.often} name={`${name}-often`} value={frequency} disabled={busy} onValueChange={often}
          options={[{ value: 'weekly', label: copy.weekly }, { value: 'biweekly', label: copy.biweekly }, { value: 'monthly', label: copy.monthly }]} />
        {frequency === 'monthly'
          ? <SelectField label={copy.monthday} help={copy.monthdayHelp} value={String(day)} disabled={busy} onChange={(event) => setDay(Number(event.target.value))}
            options={Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: String(index + 1), role: 'data' as const }))} />
          : <SelectField label={copy.weekday} value={String(day)} disabled={busy} onChange={(event) => setDay(Number(event.target.value))}
            options={WEEKDAYS.map((key, index) => ({ value: String(index), label: copy.days[key] }))} />}
      </> : null}
      {rule?.active ? <p className="lf-console-muted" data-copy-role="data">{fill(copy.next, { date: date.format(new Date(rule.nextRunAt)) })}</p> : null}
      {notice ? <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice> : null}
      <ButtonGroup><Button type="submit" variant="success" pending={busy} pendingLabel={copy.saving}>{copy.save}</Button></ButtonGroup>
    </form>
  </Card>;
}

function LimitForm({ child, copy, transport, limit, coaching, onSaved }: {
  child: Child; copy: TutorCoinsCopy; transport: ConsoleTransport; limit: Limit; coaching: ReactNode; onSaved: (limit: Limit) => void;
}) {
  const name = useId();
  const [active, setActive] = useState(limit.configured);
  const [period, setPeriod] = useState<LimitWindow>(limit.configured ? limit.period : 'weekly');
  const [cap, setCap] = useState(String(limit.configured ? limit.cap : 50));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const most = count(cap);
    if (!Number.isInteger(most) || most < 1) { setNotice({ text: copy.invalid, error: true }); return; }
    setBusy(true); setNotice(null);
    const result = await saveLimit(transport, child.userId, { period, cap: most, active });
    setBusy(false);
    if (!result.ok) { setNotice({ text: copy[REFUSAL[result.code] ?? 'saveFailed'], error: true }); return; }
    setNotice({ text: copy.saved, error: false });
    onSaved(result.data);
  }

  return <Card heading={copy.limitTitle}>
    <form className="lf-console-form" data-family-part="limit" noValidate onSubmit={(event) => void submit(event)}>
      <Copy role="body">{copy.limitBody}</Copy>
      <div className="lf-money-slot">{coaching}</div>
      <Checkbox label={copy.limitSwitch} checked={active} onChange={(event) => setActive(event.target.checked)} disabled={busy} />
      {active ? <>
        <SegmentedControl legend={copy.window} name={`${name}-window`} value={period} disabled={busy} onValueChange={setPeriod}
          options={[{ value: 'weekly', label: copy.days7 }, { value: 'monthly', label: copy.days30 }]} />
        <TextField label={copy.cap} help={copy.capHelp} type="number" inputMode="numeric" min={1} step={1} value={cap} disabled={busy}
          onChange={(event) => setCap(event.target.value)} />
      </> : null}
      {limit.configured ? <ProgressBar label={copy.usedLabel} value={Math.min(limit.used, limit.cap)} max={limit.cap} tone="reward"
        valueText={fill(copy.usedValue, { used: limit.used, cap: limit.cap })} /> : null}
      {notice ? <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice> : null}
      <ButtonGroup><Button type="submit" variant="success" pending={busy} pendingLabel={copy.saving}>{copy.save}</Button></ButtonGroup>
    </form>
  </Card>;
}
