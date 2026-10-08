import { useId, type ReactNode } from 'react';
import { Button, CoinAmount, Copy, Glyph, InlineNotice, LoadingState, Switch, TileButton } from '../design/controls';
import type { MoneyRegister } from '../family/moneyRegister';
import type { Bucket } from '../family/moneyHabitsApi';
import { PocketMark } from '../family/PocketMark';
import { shiftMonth, STATEMENT_MONTHS_BACK, type CoinAccountView, type FreezeHold, type Month, type MonthLine } from './bankingApi';
import '../design/tokens.css';
import '../design/system.css';
import '../family/familyHub.css';
import './coinAccount.css';
import './wallet.css';

/*
 * S07.6, the child's coin account (D.7, D.12).
 *
 * D.7, no unbacked guarantee: the card is drawn flat in a token hue and always
 * labelled a practice card whose coins stay in the app. It carries no card
 * number, no chip and no network mark (a number laid out like a card's implies
 * a real card). The freeze lists only what the server says a freeze holds,
 * each line pinned to its database enforcement (docs/operations/
 * block-d-controls.json); a child is offered "Unfreeze" only for a freeze
 * they set. The spending limit says when it is checked (at approval), which
 * is where the database enforces it. Every control carries `data-control`,
 * and agent/tools/check-no-unbacked-guarantee.mjs refuses one that is not in
 * the registry.
 *
 * D.12, one design, three registers: the copy set, the numbers and the detail
 * come from the reader's register (young: whole coins, what is left, three
 * totals; transition: "of your total" and used of the cap; teen: percentages
 * and the latest lines). The numbers arrive already shaped by Core; this
 * component never derives a figure the register was not given.
 *
 * Nothing here celebrates (OD-7): freezing and unfreezing are informational.
 */

export interface CoinAccountCopy {
  heading: string; practice: string; coinsOnly: string; frozen: string; notFrozen: string; byYou: string; byTutor: string; whileFrozen: string; whatHolds: string;
  /** GAP-FIX-R5: the details toggle while frozen (who froze it, what pauses, who can lift it), 06 §4.4. */
  whyFrozen: string;
  holdRewards: string; holdSplits: string; holdCredits: string; holdShare: string; nothingLost: string; freeze: string; unfreeze: string; onlyTutor: string;
  total: string; freezeCard: string; customize: string; newGoal: string; quick: string; limitHow: string; cardTitle: string; cardDesign: string; controls: string;
  more: string; reward: string; recent: string;
  pockets: string; save: string; spend: string; share: string; coins: string; pocketDetail?: string; limitHeading: string; limitWeekly: string;
  limitMonthly: string; limitWhy: string; limitWhen: string; monthHeading: string; prevMonth: string; nextMonth: string; monthFailed: string; earned: string; spent: string; saved: string; given: string;
  adjusted: string; waiting: string; waitingFrozen: string; noAccount: string; loading: string; failed: string; retry: string; frozenNotice: string;
  unfrozenNotice: string; changeFailed: string; lineTask: string; lineReward: string; lineAllowance: string; lineBonus: string; lineShared: string;
  lineReturned: string; lineFixed: string; lineGoal: string; lineOther: string; lineMoved: string; lineGoalCoins: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const HOLD_KEY: Record<FreezeHold, 'holdRewards' | 'holdSplits' | 'holdCredits' | 'holdShare'> = {
  rewards: 'holdRewards', splits: 'holdSplits', credits: 'holdCredits', share: 'holdShare',
};
const LINE_KEY: Record<string, keyof CoinAccountCopy> = {
  task_approved: 'lineTask', redemption: 'lineReward', allowance: 'lineAllowance', savings_bonus: 'lineBonus', share_gift: 'lineShared',
  share_gift_returned: 'lineReturned', manual_adjustment: 'lineFixed', goal_withdrawal: 'lineGoal', goal_release: 'lineGoal', pocket_move: 'lineMoved', goal_move: 'lineGoalCoins',
};
const POCKETS = ['save', 'spend', 'share'] as const;

/**
 * Whole-number percentages of the pockets that add up to exactly 100
 * (largest remainder): three rounded shares that add to 101 would be a small
 * dishonesty on the one register that reads percentages.
 */
export function pocketPercents(pockets: Record<(typeof POCKETS)[number], number>): Record<(typeof POCKETS)[number], number> {
  const total = POCKETS.reduce((sum, p) => sum + Math.max(0, pockets[p]), 0);
  if (total === 0) return { save: 0, spend: 0, share: 0 };
  const raw = POCKETS.map((p) => ({ p, exact: (Math.max(0, pockets[p]) * 100) / total }));
  const floors = raw.map((r) => ({ ...r, value: Math.floor(r.exact) }));
  let left = 100 - floors.reduce((sum, r) => sum + r.value, 0);
  for (const r of [...floors].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)))) { if (left <= 0) break; r.value += 1; left -= 1; }
  return Object.fromEntries(floors.map((r) => [r.p, r.value])) as Record<(typeof POCKETS)[number], number>;
}

export function lineLabel(copy: CoinAccountCopy, line: Pick<MonthLine, 'reason'>): string {
  return copy[LINE_KEY[line.reason] ?? 'lineOther'] as string;
}

/** The wallet is one screen of tabs (ChildCoins); each tab asks this component for its part of the account. */
export type WalletPart = 'overview' | 'recent' | 'card' | 'activity';

/** What the wallet's quick actions do beyond the account itself: they belong to the screen that hosts it. */
export interface WalletHome {
  have: string; /** The allowance line, already written ("arrives Friday: +10 coins"); null when none is set. */ next: string | null;
  move: string; ask: string; share: string; goal: string; hintSave: string; hintSpend: string; hintShare: string; actions: string; seeAll: string;
}

export interface WalletActions {
  /** The words of the home tab, from the hosting screen (they are the same at every age). */
  home?: WalletHome;
  onMove?: () => void; onShare?: () => void; onSeeAll?: () => void;
  /** Sits under the allowance line in the balance block ("Ask for more"). */
  heroExtra?: ReactNode;
  onCustomize?: () => void; onNewGoal?: () => void; onReward?: () => void;
  /** A pocket tile is a door: Save opens the goals, Share the giving, Spend the rewards. */
  onOpenPocket?: (pocket: Bucket) => void;
}

type Practice = NonNullable<CoinAccountView['account']>;

/** The practice card, drawn flat in a token hue (D.7: no number, no chip, no network mark). */
function PracticeCard({ card, copy }: { card: Practice; copy: CoinAccountCopy }) {
  return <div className="lf-wallet-card" data-control="simulation" data-design={card.design} data-frozen={card.freeze.frozen}>
    <span className="lf-wallet-card-tag" data-copy-role="body">{copy.practice}</span>
    <span className="lf-wallet-card-name" data-copy-role="data">{card.nickname}</span>
    <span className="lf-wallet-card-state" data-copy-role="body">{card.freeze.frozen ? copy.frozen : copy.notFrozen}</span>
  </div>;
}

/** A round action with its word under it: the one pattern every quick action of the wallet follows. */
export function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return <TileButton className="lf-wallet-quick-action" onClick={onClick}>
    <span className="lf-wallet-quick-icon">{icon}</span>
    <span className="lf-wallet-quick-label" data-copy-role="action">{label}</span>
  </TileButton>;
}

/** Explanations never sit in the first view: they open from one quiet "Learn more" line. */
export function MoreInfo({ label, children }: { label: string; children: ReactNode }) {
  return <details className="lf-wallet-how"><summary data-copy-role="action">{label}</summary><div className="lf-wallet-how-body">{children}</div></details>;
}

/** The day a movement belongs to, in the reader's own calendar: the key groups rows, the label is "today", "yesterday" or the date. */
function dayOf(iso: string): { key: string; days: number; date: Date } {
  const date = new Date(iso);
  const midnight = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  return { key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`, days: Math.round((midnight(new Date()) - midnight(date)) / 86_400_000), date };
}

/**
 * Movements as rows, grouped by day the way a bank statement is: the day is said once above its rows ("Today", "Yesterday",
 * then the date, from `Intl`, never from copy), and each row has the pocket's own mark, what it was for and the seeds in or out.
 */
function MovementList({ lines, copy, locale }: { lines: MonthLine[]; copy: CoinAccountCopy; locale: string }) {
  const number = new Intl.NumberFormat(locale);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const dated = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const groups: { key: string; label: string; lines: MonthLine[] }[] = [];
  for (const line of lines) {
    const { key, days, date } = dayOf(line.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) { last.lines.push(line); continue; }
    const label = days <= 1 && days >= 0 ? relative.format(-days, 'day') : dated.format(date);
    groups.push({ key, label: label.charAt(0).toLocaleUpperCase(locale) + label.slice(1), lines: [line] });
  }
  return <div className="lf-coin-days">
    {groups.map((group) => <section key={group.key} className="lf-coin-day">
      <h4 className="lf-coin-day-label" data-copy-role="body">{group.label}</h4>
      <ul className="lf-coin-lines">
        {group.lines.map((line) => <li key={line.id} data-pocket={line.bucket}>
          <PocketMark pocket={line.bucket} size="sm" />
          <span className="lf-coin-line-label">
            {/* The name leads (what it was for) and the kind sits under it in grey; with no name, the kind leads. */}
            {line.title ? <span className="ugc lf-coin-line-title" data-copy-role="data">{line.title}</span> : <span data-copy-role="body">{lineLabel(copy, line)}</span>}
            {line.title ? <span className="lf-coin-line-meta"><span data-copy-role="body">{lineLabel(copy, line)}</span></span> : null}
          </span>
          <span data-copy-role="data" className={line.amount >= 0 ? 'lf-family-hub-amount lf-family-hub-amount--credit' : 'lf-family-hub-amount'}>
            {line.amount >= 0 ? '+' : ''}{number.format(line.amount)}</span>
        </li>)}
      </ul>
    </section>)}
  </div>;
}

export function CoinAccount({ copy, register, locale, dark, view, loading, failed, busy, notice, onRetry, onFreeze, month = null, onMonth, part = 'overview', actions, recentLines = null }: {
  copy: CoinAccountCopy;
  register: MoneyRegister;
  locale: string;
  dark: boolean;
  view: CoinAccountView | null;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: { text: string; error: boolean } | null;
  onRetry: () => void;
  onFreeze: (frozen: boolean) => void;
  /** F5-K (W2F.3): another month than the overview's, or its loading/failed state; null shows this month. */
  month?: { statement: Month | null; loading: boolean; failed: boolean } | null;
  /** Ask for another month; null returns to this month. Absent: no paging is offered. */
  onMonth?: (month: string | null) => void;
  /** Which part of the account this tab shows. */
  part?: WalletPart;
  actions?: WalletActions;
  /**
   * The latest movements, newest first, from the full history. A child of 6 to 9 is given totals only in the statement (D.12),
   * but a wallet with no list of what just happened does not feel like one, so the home reads the history itself.
   */
  recentLines?: MonthLine[] | null;
}) {
  const ids = { heading: useId(), holds: useId(), limit: useId(), month: useId() };
  const card = view?.account ?? null;
  const total = view ? view.pockets.save + view.pockets.spend + view.pockets.share : 0;
  const number = new Intl.NumberFormat(locale);
  const limit = view?.spendLimit.configured && !(card?.freeze.frozen && card.freeze.holds.includes('rewards')) ? view.spendLimit : null;
  const percents = view ? pocketPercents(view.pockets) : null;
  const recent = (recentLines ?? view?.statement.lines ?? []).slice(0, 4);
  const home = actions?.home;
  const HINT = { save: home?.hintSave, spend: home?.hintSpend, share: home?.hintShare } as const;

  return <section className="lf-rebuild lf-family-hub lf-coin-account" data-coin-account="child" data-wallet-part={part} data-register={register} data-theme={dark ? 'dark' : 'light'}
    lang={locale} aria-labelledby={ids.heading}>
    <h2 id={ids.heading} className="lf-visually-hidden" data-copy-role="heading">{copy.heading}</h2>
    {failed ? <>
      <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : loading || !view ? <LoadingState label={copy.loading} lines={2} /> : <>
      {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}

      {part === 'overview' && <div className="lf-wallet-home">
        {/* What you have comes first, in one big number; everything else is what you can do with it. */}
        <div className="lf-wallet-hero">
          <span className="lf-wallet-hero-label" data-copy-role="body">{home?.have ?? copy.total}</span>
          <CoinAmount size="lg" className="lf-wallet-balance-count">{number.format(total)}</CoinAmount>
          {/* How the coins are spread over the three pockets, in the pockets' own colours: the number, explained at a glance. */}
          {total > 0 && <div className="lf-wallet-hero-bar" role="img" aria-label={POCKETS.map((pocket) => `${copy[pocket]} ${number.format(view.pockets[pocket])}`).join(', ')}>
            {POCKETS.map((pocket) => view.pockets[pocket] > 0 && <span key={pocket} data-segment={pocket} style={{ flexGrow: view.pockets[pocket] }} />)}
          </div>}
          {home?.next ? <span className="lf-wallet-next" data-copy-role="data">{home.next}</span> : null}
          {actions?.heroExtra}
        </div>
        {home && <ul className="lf-wallet-quick" aria-label={home.actions}>
          <li><QuickAction icon={<Glyph name="refresh" />} label={home.move} onClick={actions?.onMove} /></li>
          <li><QuickAction icon={<PocketMark pocket="spend" size="md" />} label={home.ask} onClick={actions?.onReward} /></li>
          <li><QuickAction icon={<PocketMark pocket="share" size="md" />} label={home.share} onClick={actions?.onShare} /></li>
          <li><QuickAction icon={<Glyph name="plus" />} label={home.goal} onClick={actions?.onNewGoal} /></li>
        </ul>}
        <ul className="lf-wallet-pots" aria-label={copy.pockets}>
          {POCKETS.map((pocket) => <li key={pocket} data-pocket={pocket}>
            <TileButton className="lf-wallet-pot" onClick={() => actions?.onOpenPocket?.(pocket)}>
              <PocketMark pocket={pocket} size="md" />
              <span className="lf-wallet-pot-name" data-copy-role="body">{copy[pocket]}</span>
              <CoinAmount className="lf-wallet-pot-count">{number.format(view.pockets[pocket])}</CoinAmount>
              {HINT[pocket] ? <span className="lf-wallet-pot-hint" data-copy-role="body">{HINT[pocket]}</span> : null}
              {register !== 'young' && copy.pocketDetail && total > 0 ? <span className="lf-wallet-pot-detail" data-copy-role="data">
                {fill(copy.pocketDetail, { count: number.format(view.pockets[pocket]), total: number.format(total), pct: percents![pocket] })}</span> : null}
            </TileButton>
          </li>)}
        </ul>
      </div>}

      {part === 'recent' && recent.length > 0 && <section className="lf-wallet-recent" aria-labelledby={ids.month}>
        <div className="lf-wallet-section-head">
          <h3 id={ids.month} data-copy-role="heading">{copy.recent}</h3>
          {home && actions?.onSeeAll ? <Button size="sm" onClick={actions.onSeeAll}>{home.seeAll}</Button> : null}
        </div>
        <MovementList lines={recent} copy={copy} locale={locale} />
      </section>}

      {part === 'card' && <div className="lf-wallet-cardtab">
        <div className="lf-wallet-side">
          {card ? <PracticeCard card={card} copy={copy} /> : <Copy role="body">{copy.noAccount}</Copy>}
          <MoreInfo label={copy.more}><Copy role="body">{copy.coinsOnly}</Copy></MoreInfo>
        </div>
        <ul className="lf-wallet-rows" aria-label={copy.controls}>
          {card && <li className="lf-wallet-row" data-control="freeze.owner" data-frozen={card.freeze.frozen}>
            {card.freeze.canChange
              ? <Switch label={copy.freezeCard} checked={card.freeze.frozen} onCheckedChange={onFreeze} pending={busy} stateLabels={{ on: copy.frozen, off: copy.notFrozen }} />
              : <><span className="lf-wallet-row-title" data-copy-role="body">{copy.freezeCard}</span><span className="lf-wallet-row-state" data-copy-role="body">{copy.onlyTutor}</span></>}
            {/* W2F.2 (06 §4 layering): what a freeze pauses is one press away, so the first view stays within the child's budget. Who froze
                it, what pauses, that waiting coins wait and that only the Tutor can lift a Tutor's freeze open from "Learn more".
                The list is the server's, never copy's (D.7). */}
            <section className="lf-coin-freeze" data-control="freeze" data-frozen={card.freeze.frozen} data-by={card.freeze.by ?? 'none'} aria-labelledby={ids.holds}>
              <MoreInfo label={card.freeze.frozen ? copy.whyFrozen : copy.whatHolds}>
                {card.freeze.frozen && <Copy role="body">{card.freeze.by === 'you' ? copy.byYou : copy.byTutor}</Copy>}
                <p id={ids.holds} data-copy-role="body">{copy.whileFrozen}</p>
                <ul className="lf-coin-holds">
                  {card.freeze.holds.map((hold) => <li key={hold} data-hold={hold} data-control={`freeze.${hold}`}><span data-copy-role="body">{copy[HOLD_KEY[hold]]}</span></li>)}
                </ul>
                <Copy role="body">{copy.nothingLost}</Copy>
                {view.pendingCredits > 0 && card.freeze.frozen && <Copy role="body">{copy.waitingFrozen}</Copy>}
              </MoreInfo>
            </section>
          </li>}
          <li className="lf-wallet-row lf-wallet-row--split">
            <span className="lf-wallet-row-title" data-copy-role="body">{copy.cardDesign}</span>
            <Button size="sm" onClick={actions?.onCustomize}>{copy.customize}</Button>
          </li>
          {limit && <li className="lf-wallet-row" data-control="spend_limit">
            {/* GAP-FIX-R5 (D.7): while a freeze holds reward requests, "you can spend N more" would promise what the server refuses, so the
                limit is not stated until the freeze ends (the Tutor still sees and sets it; nothing about it changes). */}
            <span className="lf-wallet-row-title" data-copy-role="heading">{copy.limitHeading}</span>
            <Copy role="body">{fill(limit.period === 'weekly' ? copy.limitWeekly : copy.limitMonthly, {
              remaining: number.format(limit.remaining), used: number.format(limit.used ?? 0), cap: number.format(limit.cap ?? 0), pct: limit.usedPercent ?? 0,
            })}</Copy>
            {register !== 'young' && limit.cap !== undefined && <div className="lf-coin-meter" role="img"
              aria-label={fill(limit.period === 'weekly' ? copy.limitWeekly : copy.limitMonthly, { remaining: limit.remaining, used: limit.used ?? 0, cap: limit.cap, pct: limit.usedPercent ?? 0 })}>
              <span style={{ inlineSize: `${limit.cap > 0 ? Math.min(100, ((limit.used ?? 0) * 100) / limit.cap) : 0}%` }} />
            </div>}
            <MoreInfo label={copy.limitHow}><Copy role="body">{copy.limitWhy}</Copy><Copy role="body">{copy.limitWhen}</Copy></MoreInfo>
          </li>}
        </ul>
      </div>}

      {part === 'activity' && <MonthStatement copy={copy} locale={locale} headingId={ids.month} current={view.statement} month={month} onMonth={onMonth} />}
    </>}
  </section>;
}

/*
 * The month (F5-K): this month from the overview, or another month Core
 * shaped in the same register. Paging goes back STATEMENT_MONTHS_BACK months
 * and never past this month (Core refuses both). "Next month" appears only
 * when there is one, so this month's first view gains two words, not four.
 */
function MonthStatement({ copy, locale, headingId, current, month, onMonth }: {
  copy: CoinAccountCopy; locale: string; headingId: string; current: Month;
  month: { statement: Month | null; loading: boolean; failed: boolean } | null; onMonth?: (month: string | null) => void;
}) {
  const number = new Intl.NumberFormat(locale);
  const statement = month?.statement ?? current;
  const earliest = shiftMonth(current.month, -(STATEMENT_MONTHS_BACK - 1));
  const shown = month?.statement ? month.statement.month : current.month;
  const [year, mo] = shown.split('-').map(Number) as [number, number];
  const label = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, mo - 1, 1)));
  const previous = shiftMonth(shown, -1);
  const next = shiftMonth(shown, 1);
  return <section className="lf-coin-month" aria-labelledby={headingId} aria-busy={month?.loading === true} data-month={shown}>
        <h3 id={headingId} data-copy-role="heading">{shown === current.month ? copy.monthHeading : label}</h3>
        {month?.failed && <InlineNotice tone="error" live>{copy.monthFailed}</InlineNotice>}
        <dl className="lf-coin-totals">
          <div><dt data-copy-role="body">{copy.earned}</dt><dd data-copy-role="data">{number.format(statement.earned)}</dd></div>
          <div><dt data-copy-role="body">{copy.spent}</dt><dd data-copy-role="data">{number.format(statement.spent)}</dd></div>
          <div><dt data-copy-role="body">{copy.saved}</dt><dd data-copy-role="data">{number.format(statement.saved)}</dd></div>
          {statement.given !== undefined && <div><dt data-copy-role="body">{copy.given}</dt><dd data-copy-role="data">{number.format(statement.given)}</dd></div>}
          {statement.adjusted !== undefined && statement.adjusted !== 0 && <div><dt data-copy-role="body">{copy.adjusted}</dt>
            <dd data-copy-role="data">{number.format(statement.adjusted)}</dd></div>}
        </dl>
        {statement.lines && statement.lines.length > 0 && <MovementList lines={statement.lines} copy={copy} locale={locale} />}
        {onMonth && <div className="lf-family-hub-actions" data-coin-part="month-paging">
          {previous >= earliest && <Button size="sm" disabled={month?.loading === true} onClick={() => onMonth(previous)}>{copy.prevMonth}</Button>}
          {shown < current.month && <Button size="sm" disabled={month?.loading === true} onClick={() => onMonth(next >= current.month ? null : next)}>{copy.nextMonth}</Button>}
        </div>}
      </section>;
}
