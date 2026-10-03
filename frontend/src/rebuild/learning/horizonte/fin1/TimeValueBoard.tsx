import { useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, NumberAnswer, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { FIN1_COPY } from './copy';
import { fill, money, percent, spokenMoney } from './format';
import { TV_VALUE_LIMIT, flowsOf, futureValueCents, paymentWorth, presentValueCents, slotYear, timeValueFrame, type Slots } from './model.generated';
import '../horizonte.css';
import './Fin1Boards.css';

type TimeValueSegment = Extract<HorizonteSegment, { type: 'money.time-value.v2' }>;

const TRAY = 'tray';
const chipId = (piece: string, origin: string) => `${piece}@${origin}`;
const splitChip = (id: string): [string, string] => { const at = id.indexOf('@'); return [id.slice(0, at), id.slice(at + 1)]; };

/*
 * F2.11: payments on a timeline. An order task holds every payment already, one per year, and the learner swaps them; an
 * annuity task starts with an empty timeline and the learner places each equal payment on a year. A chip is dragged onto a
 * year, or picked and sent with "Move to". Each payment shows its worth from the OTHER side than the one asked for (worth
 * at the end when the answer is worth today, and the reverse), so the number the learner types is always one reasoning
 * step away from the figures on the board. The answer is the arrangement plus the typed worth; Core holds the key.
 */
function TimeValue({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: TimeValueSegment }) {
  const locale = document.locale;
  const t = copyText(FIN1_COPY, locale);
  const p = segment.payload;
  const task = p.task;
  const frame = timeValueFrame(p);
  const [slots, setSlots] = useState<Slots>(() => structuredClone(frame.start));
  const [text, setText] = useState('');
  const [value, setValue] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const annuity = task.kind === 'annuity';
  const needed = task.kind === 'order' ? task.amountsCents.length : task.count;
  const placed = Object.values(slots).reduce((sum, list) => sum + list.length, 0);
  const changed = text !== '' || JSON.stringify(slots) !== JSON.stringify(frame.start);
  const measure = p.ask === 'present' ? 'future' : 'present';

  const yearName = (year: number) => (year === 0 ? t.tvYearZero : fillSlot(t.tvYear, year));
  const pieceName = (piece: string) => {
    if (task.kind === 'annuity') return t.tvPayment;
    return fillSlot(task.side === 'receive' ? t.tvPrize : t.tvBill, Number(piece.slice('pay-'.length)));
  };
  const amountOf = (piece: string) => frame.amounts.get(piece) ?? 0;
  const worthOf = (piece: string, year: number) => paymentWorth({ year, cents: amountOf(piece) }, p.rateBps, frame.horizon, measure);
  const chipLabel = (piece: string) => `${pieceName(piece)}: ${money(amountOf(piece), locale, true)}`;

  const change = (next: Slots) => { grading.reset(); setSlots(next); };
  const without = (from: Slots, slot: string): Slots => { const rest = { ...from }; delete rest[slot]; return rest; };
  const place = (item: string, target: string) => {
    const [piece, origin] = splitChip(item);
    if (origin === target) return;
    if (task.kind === 'order') {
      const other = slots[target]?.[0];
      const moving = slots[origin]?.[0];
      if (origin === TRAY || target === TRAY || other === undefined || moving !== piece) return;
      change({ ...slots, [origin]: [other], [target]: [piece] });
      return;
    }
    if (target === TRAY) { if (origin !== TRAY) change(without(slots, origin)); return; }
    if ((slots[target]?.length ?? 0) > 0) return;
    if (origin === TRAY) { if (placed < needed) change({ ...slots, [target]: [piece] }); return; }
    if (slots[origin]?.[0] === piece) change({ ...without(slots, origin), [target]: [piece] });
  };
  const drag = useDragPlace<string>(place, locked);
  const reset = () => { grading.reset(); drag.clear(); setSlots(structuredClone(frame.start)); setText(''); setValue(null); };

  const handle = (piece: string, origin: string) => (
    <span key={chipId(piece, origin)} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
      <ChoiceChip {...drag.chip(chipId(piece, origin))} disabled={locked}>{chipLabel(piece)}</ChoiceChip>
    </span>
  );

  const carried = drag.carried === null ? null : splitChip(drag.carried);
  const moveOptions = [
    ...frame.slotIds.filter((slot) => slot !== carried?.[1]).map((slot) => ({ value: slot, label: yearName(slotYear(slot) ?? 0) })),
    ...(annuity && carried && carried[1] !== TRAY ? [{ value: TRAY, label: t.tvTrayName }] : []),
  ];

  const flows = flowsOf(frame, slots) ?? [];
  const totalCents = (measure === 'present' ? presentValueCents(flows, p.rateBps) : futureValueCents(flows, p.rateBps, frame.horizon)) ?? 0;
  const scale = Math.max(1, ...frame.slotIds.flatMap((slot) => (slots[slot] ?? []).flatMap((piece) => [amountOf(piece), worthOf(piece, slotYear(slot) ?? 0)])));
  const bar = (cents: number) => Math.max(1, Math.round((cents / scale) * 48));

  const worthLegend = measure === 'present' ? t.npLegendWorth : fill(t.tvLegendWorthEnd, { n: frame.horizon });
  const total = measure === 'present' ? fill(t.tvTotalToday, { amount: money(totalCents, locale) }) : fill(t.tvTotalEnd, { n: frame.horizon, amount: money(totalCents, locale) });
  const answerLabel = p.ask === 'present' ? t.tvAnswerToday : fill(t.tvAnswerEnd, { n: frame.horizon });
  const placedYears = frame.slotIds.filter((slot) => (slots[slot]?.length ?? 0) > 0);

  return <BoardShell screen="time-value" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={value !== null && placed === needed && !locked} sequence={sequence} feedback={segment.feedback}
      named={annuity ? { met: t.tvMetAnnuity, hint: t.tvHintAnnuity } : { met: t.tvMetOrder, hint: t.tvHintOrder }}
      onCheck={() => grading.check({ slots: Object.fromEntries(Object.entries(slots).filter(([, list]) => list.length > 0)), value })} />}>
    <section className="lf-learning-board lf-fin" aria-labelledby={`${segment.id}-timeline`}>
      <h2 id={`${segment.id}-timeline`} data-copy-role="heading">{t.tvTimeline}</h2>
      <p data-copy-role="data">{fill(t.tvRate, { rate: percent(p.rateBps, locale) })}</p>
      <div className="lf-fin-legend" data-copy-role="data">
        <span><i className="lf-fin-swatch lf-fin-swatch--cash" aria-hidden="true" />{t.npLegendCash}</span>
        <span><i className="lf-fin-swatch lf-fin-swatch--worth" aria-hidden="true" />{worthLegend}</span>
      </div>
      <ol className="lf-fin-timeline">
        {frame.slotIds.map((slot) => {
          const year = slotYear(slot) ?? 0;
          const piece = slots[slot]?.[0];
          return <li key={slot} className="lf-fin-year" role="group" aria-label={yearName(year)} {...drag.target(slot)}>
            <h3 data-copy-role="data">{yearName(year)}</h3>
            {piece ? handle(piece, slot) : <span className="lf-fin-empty" aria-hidden="true" />}
            {piece ? <>
              <p data-copy-role="data" aria-label={spokenMoney(amountOf(piece), locale)}>{money(amountOf(piece), locale)}</p>
              <p className="lf-fin-worth" data-copy-role="data" aria-label={spokenMoney(worthOf(piece, year), locale)}>{money(worthOf(piece, year), locale)}</p>
              <svg className="lf-fin-year-bars" viewBox="0 0 48 56" aria-hidden="true" focusable="false">
                <rect className="lf-fin-bar--cash" x="4" y={52 - bar(amountOf(piece))} width="18" height={bar(amountOf(piece))} />
                <rect className="lf-fin-bar--worth" x="26" y={52 - bar(worthOf(piece, year))} width="18" height={bar(worthOf(piece, year))} />
              </svg>
            </> : null}
          </li>;
        })}
      </ol>
      <p className="lf-fin-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {total}{annuity ? `. ${fill(t.tvPlaced, { n: placed, total: needed })}` : ''}
      </p>
      {table ? <div className="lf-fin-table-wrap"><table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tvTableCaption}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.tvColYear}</th><th scope="col" data-copy-role="data">{t.tvColPayment}</th>
          <th scope="col" data-copy-role="data">{t.tvColAmount}</th><th scope="col" data-copy-role="data">{measure === 'present' ? t.tvColWorthToday : t.tvColWorthEnd}</th>
        </tr></thead>
        <tbody>{placedYears.map((slot) => {
          const year = slotYear(slot) ?? 0;
          const piece = slots[slot]![0]!;
          return <tr key={slot}>
            <th scope="row" data-copy-role="data">{year}</th><td data-copy-role="data">{pieceName(piece)}</td>
            <td data-copy-role="data">{money(amountOf(piece), locale)}</td><td data-copy-role="data">{money(worthOf(piece, year), locale)}</td>
          </tr>;
        })}</tbody>
        <tfoot><tr><th scope="row" data-copy-role="data">{t.tvTotal}</th><td data-copy-role="data" /><td data-copy-role="data" /><td data-copy-role="data">{money(totalCents, locale)}</td></tr></tfoot>
      </table></div> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.tvTray}>
      <h2 data-copy-role="heading">{t.tvTray}</h2>
      <p className="lf-fin-strip-help" data-copy-role="body">{annuity ? t.tvDragAnnuity : t.tvDragOrder}</p>
      {annuity ? <div className="lf-fin-tray" role="group" aria-label={t.tvTrayName} {...drag.target(TRAY)}>
        {placed < needed ? handle('payment', TRAY) : null}
      </div> : null}
      <MoveToChoice locale={locale} item={carried ? { label: chipLabel(carried[0]) } : null} options={moveOptions} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
    <section className="lf-learning-control-strip lf-fin-answer" aria-label={answerLabel}>
      <NumberAnswer label={answerLabel} locale={locale} value={text} onTextChange={(next) => { grading.reset(); setText(next); }} onChange={setValue}
        min={Number(TV_VALUE_LIMIT.minimum)} max={Number(TV_VALUE_LIMIT.maximum)} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function TimeValueBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'money.time-value.v2' ? <TimeValue segment={segment} {...rest} /> : null;
}
