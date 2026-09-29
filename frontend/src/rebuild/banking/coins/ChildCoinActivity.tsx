import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup, Copy, Disclosure, InlineNotice, LoadingState, Pill } from '../../design/controls';
import { childName, type Child, type ConsoleTransport } from '../../family/console/consoleApi';
import { fill, type ConsoleLocale } from '../../family/console/consoleParts';
import { SELF_DIRECTED_REASONS, type LedgerEntry } from '../../family/familyHubApi';
import { PocketMark } from '../../family/PocketMark';
import { SplitBar } from '../../family/PocketSplit';
import { PocketRow, type TutorCoinsCopy } from '../../family/tasks/taskParts';
import { shiftMonth } from '../bankingApi';
import { fetchChildHistory, fetchChildMonth, fetchChildPockets, monthInWindow, type ChildMonth, type ChildPockets } from './coinsApi';

/*
 * GAP-FIX-R6 (OD-3 §2: the verified parent "manages and sees their
 * children's wallets, tasks and goals"; Law 5: nothing about a child happens
 * out of the parent's sight; Block D monthly statements; H-06): what the
 * Tutor sees of one child's coins on the Wallet screen, read-only.
 *
 *  - the three pockets with our own pocket art and the split bar (02 §4.3);
 *  - the month summary, this month first, paging back as far as Core allows
 *    (the child's own window) and never past this month, every line of the
 *    month with its reason;
 *  - the latest coin history.
 *
 * A linked teen's self-directed entries (coins they logged, their own reward,
 * coins moved out of their own goal) carry no approval step, so they are
 * not decisions in the queue; they appear here after the fact, marked "on
 * their own". The month and the history load only when opened. Nothing here
 * changes anything: Core re-checks the verified guardian link on every read.
 */

type Read<T> = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; data: T };
const FIRST_LINES = 10;
const MORE_LINES = 20;

export function ChildCoinActivity({ child, copy, locale, transport, refreshKey = 0 }: {
  child: Child; copy: TutorCoinsCopy; locale: ConsoleLocale; transport: ConsoleTransport;
  /** Bumped when something on the screen moved this child's coins (a correction, a goal move): every open part re-reads. */
  refreshKey?: number;
}) {
  const [pockets, setPockets] = useState<Read<ChildPockets>>({ status: 'loading' });
  const [monthOpen, setMonthOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [month, setMonth] = useState<Read<ChildMonth> | null>(null);
  const [history, setHistory] = useState<Read<LedgerEntry[]> | null>(null);
  const generations = useRef({ pockets: 0, month: 0, history: 0 });

  const readPockets = useCallback(async () => {
    const mine = ++generations.current.pockets;
    const result = await fetchChildPockets(transport, child.userId);
    if (mine !== generations.current.pockets) return;
    setPockets((previous) => result.ok ? { status: 'ready', data: result.data } : previous.status === 'ready' ? previous : { status: 'failed' });
  }, [transport, child.userId]);

  const readMonth = useCallback(async (which: string | null) => {
    const mine = ++generations.current.month;
    setMonth((previous) => previous?.status === 'ready' ? previous : { status: 'loading' });
    const result = await fetchChildMonth(transport, child.userId, which);
    if (mine !== generations.current.month) return;
    if (!result.ok) { setMonth({ status: 'failed' }); return; }
    // This month is whatever Core says it is (UTC), learned from the first read; paging is bounded by it.
    if (which === null) setCurrent(result.data.month);
    setMonth({ status: 'ready', data: result.data });
  }, [transport, child.userId]);

  const readHistory = useCallback(async () => {
    const mine = ++generations.current.history;
    setHistory((previous) => previous?.status === 'ready' ? previous : { status: 'loading' });
    const result = await fetchChildHistory(transport, child.userId);
    if (mine !== generations.current.history) return;
    setHistory(result.ok ? { status: 'ready', data: result.data } : { status: 'failed' });
  }, [transport, child.userId]);

  // What is open, for a re-read after a coin movement (kept beside the state, written only by the handlers below).
  const view = useRef<{ monthOpen: boolean; historyOpen: boolean; shown: string | null }>({ monthOpen: false, historyOpen: false, shown: null });

  useEffect(() => {
    void readPockets();
    if (view.current.monthOpen) void readMonth(view.current.shown);
    if (view.current.historyOpen) void readHistory();
  }, [readPockets, readMonth, readHistory, refreshKey]);

  useEffect(() => {
    const live = generations.current;
    return () => { live.pockets++; live.month++; live.history++; };
  }, []);

  function toggleMonth() {
    view.current.monthOpen = !monthOpen;
    if (monthOpen) { generations.current.month++; setMonthOpen(false); return; }
    setMonthOpen(true);
    void readMonth(shown);
  }

  function toggleHistory() {
    view.current.historyOpen = !historyOpen;
    if (historyOpen) { generations.current.history++; setHistoryOpen(false); return; }
    setHistoryOpen(true);
    void readHistory();
  }

  function page(to: string) {
    const which = to === current ? null : to;
    view.current.shown = which;
    setShown(which);
    setMonth({ status: 'loading' });
    void readMonth(which);
  }

  const heading = fill(copy.coinsTitle, { name: childName(child) });
  if (pockets.status !== 'ready') {
    return <section className="lf-money-pockets" data-family-part="child-coins" data-child-id={child.userId} aria-label={heading} aria-busy={pockets.status === 'loading'}>
      <h2 data-copy-role="heading" className="ugc">{heading}</h2>
      {pockets.status === 'loading' ? <LoadingState label={copy.loadingCoins} lines={2} /> : <>
        <InlineNotice tone="error" live>{copy.coinsFailed}</InlineNotice>
        <ButtonGroup><Button onClick={() => { setPockets({ status: 'loading' }); void readPockets(); }}>{copy.retry}</Button></ButtonGroup>
      </>}
    </section>;
  }

  return <div className="lf-money-coins" data-family-part="child-coins" data-child-id={child.userId}>
    <PocketRow pockets={pockets.data} copy={copy.pockets} heading={heading} action={<>
      <SplitBar values={pockets.data} />
      <div data-coins-toggle="month">
        <Disclosure summary={copy.monthTitle} open={monthOpen} onToggle={toggleMonth} headingLevel={3}>
          {monthOpen ? <MonthPart copy={copy} locale={locale} read={month} current={current} onPage={page} onRetry={() => void readMonth(shown)} /> : null}
        </Disclosure>
      </div>
      <div data-coins-toggle="history">
        <Disclosure summary={copy.historyTitle} open={historyOpen} onToggle={toggleHistory} headingLevel={3}>
          {historyOpen ? <HistoryPart copy={copy} locale={locale} read={history} onRetry={() => void readHistory()} /> : null}
        </Disclosure>
      </div>
    </>} />
  </div>;
}

function MonthPart({ copy, locale, read, current, onPage, onRetry }: {
  copy: TutorCoinsCopy; locale: ConsoleLocale; read: Read<ChildMonth> | null; current: string | null; onPage: (month: string) => void; onRetry: () => void;
}) {
  if (!read || read.status === 'loading') return <LoadingState label={copy.loadingCoins} lines={2} />;
  if (read.status === 'failed') return <Failed copy={copy} onRetry={onRetry} />;
  const statement = read.data;
  const [year, mo] = statement.month.split('-').map(Number) as [number, number];
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, mo - 1, 1)));
  const number = new Intl.NumberFormat(locale);
  const previous = shiftMonth(statement.month, -1);
  const next = shiftMonth(statement.month, 1);
  const totals: [string, number][] = [[copy.earned, statement.earned], [copy.spent, statement.spent], [copy.savedNet, statement.saved]];
  if (statement.given !== 0) totals.push([copy.given, statement.given]);
  if (statement.adjusted !== 0) totals.push([copy.adjusted, statement.adjusted]);
  return <section className="lf-money-month" data-coins-part="month" data-month={statement.month} aria-label={label}>
    <p className="lf-money-title" data-copy-role="data">{label}</p>
    <dl className="lf-money-totals">
      {totals.map(([name, value]) => <div key={name}><dt data-copy-role="option">{name}</dt><dd data-copy-role="data">{number.format(value)}</dd></div>)}
    </dl>
    {statement.entries.length === 0 ? <Copy role="body">{copy.monthEmpty}</Copy> : <CoinLines copy={copy} locale={locale} entries={statement.entries} />}
    {current ? <ButtonGroup>
      {monthInWindow(previous, current) ? <Button size="sm" data-coins-control="previous-month" onClick={() => onPage(previous)}>{copy.prevMonth}</Button> : null}
      {monthInWindow(next, current) ? <Button size="sm" data-coins-control="next-month" onClick={() => onPage(next)}>{copy.nextMonth}</Button> : null}
    </ButtonGroup> : null}
  </section>;
}

function HistoryPart({ copy, locale, read, onRetry }: { copy: TutorCoinsCopy; locale: ConsoleLocale; read: Read<LedgerEntry[]> | null; onRetry: () => void }) {
  if (!read || read.status === 'loading') return <LoadingState label={copy.loadingCoins} lines={2} />;
  if (read.status === 'failed') return <Failed copy={copy} onRetry={onRetry} />;
  return <section className="lf-money-month" data-coins-part="history" aria-label={copy.historyTitle}>
    {read.data.length === 0 ? <Copy role="body">{copy.historyEmpty}</Copy> : <CoinLines copy={copy} locale={locale} entries={read.data} />}
  </section>;
}

function Failed({ copy, onRetry }: { copy: TutorCoinsCopy; onRetry: () => void }) {
  return <>
    <InlineNotice tone="error" live>{copy.readFailed}</InlineNotice>
    <ButtonGroup><Button size="sm" onClick={onRetry}>{copy.retry}</Button></ButtonGroup>
  </>;
}

/** The lines, newest first: the pocket's own mark, what happened, whether the child did it on their own, the coins, the reason and the day. */
function CoinLines({ copy, locale, entries }: { copy: TutorCoinsCopy; locale: ConsoleLocale; entries: LedgerEntry[] }) {
  const [limit, setLimit] = useState(FIRST_LINES);
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const pocket = (bucket: LedgerEntry['bucket']) => copy.pockets[bucket];
  return <>
    <ul className="lf-money-lines">
      {entries.slice(0, limit).map((entry) => {
        const own = SELF_DIRECTED_REASONS.includes(entry.reason);
        return <li key={entry.id} data-pocket={entry.bucket} data-ledger-reason={entry.reason} data-self-directed={own ? 'true' : undefined}>
          <div className="lf-money-line">
            <PocketMark pocket={entry.bucket} size="sm" />
            <span className="lf-money-line-label" data-copy-role="option">{copy.reasons[entry.reason]}</span>
            {own ? <Pill tone="sky" role="option">{copy.onOwn}</Pill> : null}
            <span data-copy-role="data" className="lf-money-line-amount">
              {entry.amount > 0 ? `+${entry.amount}` : `−${Math.abs(entry.amount)}`} {pocket(entry.bucket)}
            </span>
          </div>
          {entry.note ? <span data-copy-role="data" className="ugc">{fill(copy.note, { note: entry.note })}</span> : null}
          <time data-copy-role="data" className="lf-console-muted" dateTime={entry.createdAt}>{date.format(new Date(entry.createdAt))}</time>
        </li>;
      })}
    </ul>
    {entries.length > limit ? <ButtonGroup>
      <Button size="sm" data-coins-control="more" onClick={() => setLimit((value) => value + MORE_LINES)}>{copy.showMore}</Button>
    </ButtonGroup> : null}
  </>;
}
