import { useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { basketCost, basketCount, basketToSlots, readStallPayload, type Basket, type StallGoal, type StallId, type StallPayload } from './stall.generated';
import { fill, itemName, money, space1Text, spokenMoney, type Space1Text } from './space1Text';
import '../horizonte.css';
import './space1.css';

type StallSegment = Extract<HorizonteSegment, { type: 'money.market-stall.v2' }>;
type Region = 'shelf' | 'basket';

const BAR = { width: 300, height: 64, y: 32, thick: 14, edge: 34 } as const;

/** The marker a goal draws on the cost bar. A change goal marks only what the buyer pays: the cost to reach is never drawn. */
function marker(goal: StallGoal, t: Space1Text): { at: number; label: string } {
  if (goal.kind === 'exact') return { at: goal.total, label: t.stlMarkGoal };
  if (goal.kind === 'most') return { at: goal.budget, label: t.stlMarkBudget };
  return { at: goal.paid, label: t.stlMarkPaid };
}

function goalText(goal: StallGoal, t: Space1Text, locale: Locale): string {
  if (goal.kind === 'exact') return fill(t.stlGoalExact, { amount: money(goal.total, locale, true) });
  if (goal.kind === 'most') return fill(t.stlGoalMost, { amount: money(goal.budget, locale, true) });
  return fill(t.stlGoalChange, { paid: money(goal.paid, locale, true), change: money(goal.change, locale, true) });
}

/*
 * F4.6, the stall: items with prices sit on a shelf and the learner fills a basket (drag, tap then tap, or the Move to menu)
 * to hit an exact total, to get a given change, or to buy the most items a budget allows. Many baskets can be right, so the
 * answer is the basket and Core checks the rule; the cost bar only restates the sum the basket already is.
 */
function MarketStall({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: StallSegment; payload: StallPayload }) {
  const locale = document.locale;
  const t = space1Text(locale);
  const { items, goal } = payload;
  const [basket, setBasket] = useState<Basket>({});
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const count = basketCount(basket);
  const cost = basketCost(items, basket);
  const stock = (id: string) => items.find((item) => item.id === id)?.stock ?? 0;

  const place = (piece: string, target: Region) => {
    const [from, id = ''] = piece.split(':');
    if (from === target) return;
    const held = basket[id] ?? 0;
    if (target === 'basket' ? held >= stock(id) : held <= 0) return;
    grading.reset();
    setBasket({ ...basket, [id]: held + (target === 'basket' ? 1 : -1) });
  };
  const drag = useDragPlace<Region>(place, locked);
  const reset = () => { grading.reset(); drag.clear(); setBasket({}); };

  const carried = drag.carried;
  const carriedId = carried?.split(':')[1] ?? '';
  const carriedFrom = carried?.split(':')[0];
  const moveOptions: { value: Region; label: string }[] = carried === null ? []
    : carriedFrom === 'shelf' ? [{ value: 'basket', label: t.stlBasketHeading }] : [{ value: 'shelf', label: t.stlShelfHeading }];

  const bought = items.filter((item) => (basket[item.id] ?? 0) > 0);
  const limit = goal.kind === 'exact' ? goal.total : goal.kind === 'most' ? goal.budget : goal.paid;
  const left = goal.kind === 'change' ? goal.paid - cost : null;
  const over = goal.kind === 'change' ? Math.max(cost - goal.paid, 0) : Math.max(cost - limit, 0);
  const tail = left !== null && left >= 0 ? fill(t.stlChange, { amount: money(left, locale) }) : over > 0 ? fill(t.stlOver, { amount: money(over, locale) }) : '';
  const status = `${fill(t.stlItems, { n: count })}. ${fill(t.stlCost, { amount: money(cost, locale) })}${tail ? `. ${tail}` : ''}`;
  const spoken = `${t.stlBarLabel}. ${fill(t.stlItems, { n: count })}. ${fill(t.stlCost, { amount: spokenMoney(cost, locale) })}`;

  const mark = marker(goal, t);
  const scale = Math.max(goal.kind === 'change' ? goal.paid : Math.ceil(limit * 1.25), cost);
  const at = (cents: number) => Math.min((BAR.width * cents) / scale, BAR.width);
  const markAt = at(mark.at);
  const labelAt = Math.min(Math.max(markAt, BAR.edge), BAR.width - BAR.edge);
  const named = goal.kind === 'most' ? { met: t.metStallMost, hint: t.hintStallMost } : { met: t.metStall, hint: t.hintStall };

  return <BoardShell screen="market-stall" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={count === 0 || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={count > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={named} onCheck={() => grading.check({ slots: basketToSlots(basket) })} />}>
    <section className="lf-learning-board lf-stl" aria-label={document.title}>
      <p data-copy-role="body">{goalText(goal, t, locale)}</p>
      <svg className="lf-stl-bar" viewBox={`0 0 ${BAR.width} ${BAR.height}`} role="img" aria-label={spoken} focusable="false" data-copy-role="data">
        <rect className="lf-stl-track" x="0" y={BAR.y} width={BAR.width} height={BAR.thick} rx="7" />
        {left !== null && left > 0 ? <rect className="lf-stl-change" x={at(cost)} y={BAR.y} width={BAR.width - at(cost)} height={BAR.thick} /> : null}
        <rect className="lf-stl-fill" data-over={over > 0 ? 'true' : 'false'} x="0" y={BAR.y} width={at(cost)} height={BAR.thick} rx="7" />
        <line className="lf-stl-mark" x1={markAt} y1={BAR.y - 8} x2={markAt} y2={BAR.y + BAR.thick + 8} />
        <text className="lf-stl-mark-label" x={labelAt} y={BAR.y - 14} textAnchor="middle">{mark.label}</text>
      </svg>
      <p className="lf-stl-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      <div className="lf-stl-basket" role="group" aria-label={t.stlBasketHeading} {...drag.target('basket')}>
        <h2 data-copy-role="heading">{t.stlBasketHeading}</h2>
        {bought.length === 0 ? <p data-copy-role="data">{t.stlEmpty}</p> : <ul className="lf-stl-rows">
          {bought.map((item) => <li key={item.id}>
            <span className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
              <ChoiceChip {...drag.chip(`basket:${item.id}`)} disabled={locked}>{itemName(t, item.id)} {fill(t.stlInBasket, { n: basket[item.id] ?? 0 })}</ChoiceChip>
            </span>
            <span className="lf-stl-line" data-copy-role="data">{money(item.price * (basket[item.id] ?? 0), locale)}</span>
            <Button size="sm" variant="secondary" disabled={locked} aria-label={fill(t.stlRemoveLabel, { item: itemName(t, item.id) })} onClick={() => place(`basket:${item.id}`, 'shelf')}>{t.stlRemove}</Button>
          </li>)}
        </ul>}
      </div>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.stlTableCaption}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.stlColItem}</th><th scope="col" data-copy-role="data">{t.stlColPrice}</th><th scope="col" data-copy-role="data">{t.stlColStock}</th>
          <th scope="col" data-copy-role="data">{t.stlColCount}</th><th scope="col" data-copy-role="data">{t.stlColCost}</th>
        </tr></thead>
        <tbody>
          {items.map((item) => <tr key={item.id}>
            <th scope="row" data-copy-role="data">{itemName(t, item.id)}</th><td data-copy-role="data">{money(item.price, locale)}</td><td data-copy-role="data">{item.stock}</td>
            <td data-copy-role="data">{basket[item.id] ?? 0}</td><td data-copy-role="data">{money(item.price * (basket[item.id] ?? 0), locale)}</td>
          </tr>)}
          <tr><th scope="row" data-copy-role="data">{t.stlTotal}</th><td data-copy-role="data" /><td data-copy-role="data" /><td data-copy-role="data">{count}</td><td data-copy-role="data">{money(cost, locale)}</td></tr>
        </tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.stlShelfHeading}>
      <h2 data-copy-role="heading">{t.stlShelfHeading}</h2>
      <p data-copy-role="body">{t.stlHelp}</p>
      <div className="lf-stl-shelf" role="group" aria-label={t.stlShelfHeading} {...drag.target('shelf')}>
        {items.map((item) => {
          const remaining = item.stock - (basket[item.id] ?? 0);
          return <span key={item.id} className="lf-stl-piece">
            <span className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
              <ChoiceChip {...drag.chip(`shelf:${item.id}`)} disabled={locked || remaining <= 0}>{itemName(t, item.id)} {money(item.price, locale)}</ChoiceChip>
            </span>
            <span className="lf-stl-note" data-copy-role="data">{fill(t.stlOnShelf, { n: remaining })}</span>
          </span>;
        })}
      </div>
      <MoveToChoice locale={locale} item={carried === null ? null : { label: itemName(t, carriedId as StallId) }} options={moveOptions} disabled={locked}
        onChange={(target) => { if (carried !== null) { place(carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function MarketStallBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'money.market-stall.v2') return null;
  const payload = readStallPayload(segment.payload);
  return payload ? <MarketStall segment={segment} payload={payload} {...rest} /> : null;
}
