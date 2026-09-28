import { useId, useState } from 'react';
import { Button, CoinAmount, Copy, InlineNotice, LoadingState } from '../design/controls';
import type { MoneyRegister } from '../family/moneyRegister';
import { shiftMonth, STATEMENT_MONTHS_BACK, type CoinAccountView, type FreezeHold, type Month, type MonthLine } from './bankingApi';
import '../design/tokens.css';
import '../design/system.css';
import '../family/familyHub.css';
import './coinAccount.css';

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
  holdRewards: string; holdSplits: string; holdCredits: string; holdShare: string; nothingLost: string; freeze: string; unfreeze: string; onlyTutor: string;
  pockets: string; save: string; spend: string; share: string; coins: string; pocketDetail?: string; limitHeading: string; limitWeekly: string;
  limitMonthly: string; limitWhy: string; limitWhen: string; monthHeading: string; prevMonth: string; nextMonth: string; monthFailed: string; earned: string; spent: string; saved: string; given: string;
  adjusted: string; waiting: string; waitingFrozen: string; noAccount: string; loading: string; failed: string; retry: string; frozenNotice: string;
  unfrozenNotice: string; changeFailed: string; lineTask: string; lineReward: string; lineAllowance: string; lineBonus: string; lineShared: string;
  lineReturned: string; lineFixed: string; lineGoal: string; lineOther: string;
}

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const HOLD_KEY: Record<FreezeHold, 'holdRewards' | 'holdSplits' | 'holdCredits' | 'holdShare'> = {
  rewards: 'holdRewards', splits: 'holdSplits', credits: 'holdCredits', share: 'holdShare',
};
const LINE_KEY: Record<string, keyof CoinAccountCopy> = {
  task_approved: 'lineTask', redemption: 'lineReward', allowance: 'lineAllowance', savings_bonus: 'lineBonus', share_gift: 'lineShared',
  share_gift_returned: 'lineReturned', manual_adjustment: 'lineFixed', goal_withdrawal: 'lineGoal', goal_release: 'lineGoal',
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

export function CoinAccount({ copy, register, locale, dark, view, loading, failed, busy, notice, onRetry, onFreeze, month = null, onMonth }: {
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
}) {
  const ids = { heading: useId(), holds: useId(), limit: useId(), month: useId(), list: useId() };
  const [holdsOpen, setHoldsOpen] = useState(false);
  const card = view?.account ?? null;
  const total = view ? view.pockets.save + view.pockets.spend + view.pockets.share : 0;
  const number = new Intl.NumberFormat(locale);
  const count = (n: number) => fill(copy.coins, { count: number.format(n) });
  const percents = view ? pocketPercents(view.pockets) : null;

  return <section className="lf-rebuild lf-family-hub lf-coin-account" data-coin-account="child" data-register={register} data-theme={dark ? 'dark' : 'light'}
    lang={locale} aria-labelledby={ids.heading}>
    <h2 id={ids.heading} data-copy-role="heading">{copy.heading}</h2>
    {failed ? <>
      <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </> : loading || !view ? <LoadingState label={copy.loading} lines={2} /> : <>
      {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}

      {card ? <>
        <div className="lf-coin-card" data-control="simulation" data-design={card.design} data-frozen={card.freeze.frozen}>
          <span className="lf-coin-card-tag" data-copy-role="body">{copy.practice}</span>
          <span className="lf-coin-card-name" data-copy-role="data">{card.nickname}</span>
          <span className="lf-coin-card-state" data-copy-role="body">{card.freeze.frozen ? copy.frozen : copy.notFrozen}</span>
        </div>
        <Copy role="body">{copy.coinsOnly}</Copy>

        <section className="lf-coin-freeze" data-control="freeze" data-frozen={card.freeze.frozen} data-by={card.freeze.by ?? 'none'} aria-labelledby={ids.holds}>
          {card.freeze.frozen && <Copy role="body">{card.freeze.by === 'you' ? copy.byYou : copy.byTutor}</Copy>}
          {/* W2F.2 (06 §4 layering): while nothing is frozen, what a freeze pauses is one press away, so the page's first view stays
              within the child's budget; while frozen it is always shown. The list is the server's, never copy's (D.7). */}
          {!card.freeze.frozen && <div className="lf-family-hub-actions"><Button size="sm" aria-expanded={holdsOpen} aria-controls={ids.list}
            onClick={() => setHoldsOpen((open) => !open)}>{copy.whatHolds}</Button></div>}
          <div id={ids.list} hidden={!card.freeze.frozen && !holdsOpen}>
            <p id={ids.holds} data-copy-role="body">{copy.whileFrozen}</p>
            <ul className="lf-coin-holds">
              {card.freeze.holds.map((hold) => <li key={hold} data-hold={hold} data-control={`freeze.${hold}`}><span data-copy-role="body">{copy[HOLD_KEY[hold]]}</span></li>)}
            </ul>
            <Copy role="body">{copy.nothingLost}</Copy>
          </div>
          {card.freeze.canChange
            ? <div className="lf-family-hub-actions"><Button variant={card.freeze.frozen ? 'success' : 'secondary'} disabled={busy} data-control="freeze.owner"
                onClick={() => onFreeze(!card.freeze.frozen)}>{card.freeze.frozen ? copy.unfreeze : copy.freeze}</Button></div>
            : <p data-control="freeze.owner" data-copy-role="body">{copy.onlyTutor}</p>}
        </section>
      </> : <Copy role="body">{copy.noAccount}</Copy>}

      <section aria-label={copy.pockets} className="lf-coin-pockets">
        <h3 data-copy-role="heading">{copy.pockets}</h3>
        <ul>
          {POCKETS.map((pocket) => <li key={pocket} data-pocket={pocket}>
            <span data-copy-role="body" className="lf-coin-pocket-name">{copy[pocket]}</span>
            <CoinAmount className="lf-coin-pocket-count">{count(view.pockets[pocket])}</CoinAmount>
            {register !== 'young' && copy.pocketDetail && total > 0 && <span data-copy-role="data" className="lf-family-hub-muted">
              {fill(copy.pocketDetail, { count: number.format(view.pockets[pocket]), total: number.format(total), pct: percents![pocket] })}
            </span>}
          </li>)}
        </ul>
        {/* W2F.2: no "N coins wait" line: `pendingCredits` counts payouts, not coins ("1 coins wait" for a 10-coin allowance), and the
            wallet screen shows each waiting payout with its real coins right below the card. The freeze's hold on them is still said. */}
        {view.pendingCredits > 0 && card?.freeze.frozen && <Copy role="body">{copy.waitingFrozen}</Copy>}
      </section>

      {view.spendLimit.configured && <section className="lf-coin-limit" data-control="spend_limit" aria-labelledby={ids.limit}>
        <h3 id={ids.limit} data-copy-role="heading">{copy.limitHeading}</h3>
        <Copy role="body">{fill(view.spendLimit.period === 'weekly' ? copy.limitWeekly : copy.limitMonthly, {
          remaining: number.format(view.spendLimit.remaining), used: number.format(view.spendLimit.used ?? 0), cap: number.format(view.spendLimit.cap ?? 0),
          pct: view.spendLimit.usedPercent ?? 0,
        })}</Copy>
        {register !== 'young' && view.spendLimit.cap !== undefined && <div className="lf-coin-meter" role="img"
          aria-label={fill(view.spendLimit.period === 'weekly' ? copy.limitWeekly : copy.limitMonthly, {
            remaining: view.spendLimit.remaining, used: view.spendLimit.used ?? 0, cap: view.spendLimit.cap, pct: view.spendLimit.usedPercent ?? 0 })}>
          <span style={{ inlineSize: `${view.spendLimit.cap > 0 ? Math.min(100, ((view.spendLimit.used ?? 0) * 100) / view.spendLimit.cap) : 0}%` }} />
        </div>}
        <Copy role="body">{copy.limitWhy}</Copy>
        <Copy role="body">{copy.limitWhen}</Copy>
      </section>}

      <MonthStatement copy={copy} locale={locale} headingId={ids.month} current={view.statement} month={month} onMonth={onMonth} />
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
        {statement.lines && statement.lines.length > 0 && <ul className="lf-coin-lines">
          {statement.lines.map((line) => <li key={line.id} data-pocket={line.bucket}>
            <span data-copy-role="body">{lineLabel(copy, line)}</span>
            <span data-copy-role="data" className={line.amount >= 0 ? 'lf-family-hub-amount lf-family-hub-amount--credit' : 'lf-family-hub-amount'}>
              {line.amount >= 0 ? '+' : ''}{number.format(line.amount)}</span>
          </li>)}
        </ul>}
        {onMonth && <div className="lf-family-hub-actions" data-coin-part="month-paging">
          {previous >= earliest && <Button size="sm" disabled={month?.loading === true} onClick={() => onMonth(previous)}>{copy.prevMonth}</Button>}
          {shown < current.month && <Button size="sm" disabled={month?.loading === true} onClick={() => onMonth(next >= current.month ? null : next)}>{copy.nextMonth}</Button>}
        </div>}
      </section>;
}
