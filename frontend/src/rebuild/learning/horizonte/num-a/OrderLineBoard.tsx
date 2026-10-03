import { useMemo, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { TableToggle, decimalText, fillSlots } from './boardKit';
import { orderLabelled, orderMarkUnits, orderOccupant, orderPieceId, orderPlace, orderRemove, orderResponse, orderSetup, orderSlotId } from './order-model.generated';
import type { OrderPlacement } from './order-model.generated';
import { NUM_A_COPY } from './copy';
import '../horizonte.css';
import './NumShared.css';
import './Order.css';

type OrderSegment = Extract<HorizonteSegment, { type: 'math.number-line.order.v2' }>;

const TRAY = 'tray';
const unitsOf = (item: string) => Number(item.slice('n-'.length));

/*
 * F1.3: a line of equal gaps with only its ends (and often its middle) labelled, and a few given numbers to place on its marks.
 * The learner taps a number and then a mark, drags it, or uses its "Move to" menu; the scorer checks every position. Core holds the key.
 */
function OrderLine({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: OrderSegment }) {
  const t = copyText(NUM_A_COPY, document.locale);
  const setup = useMemo(() => orderSetup(segment.payload)!, [segment.payload]);
  const [placement, setPlacement] = useState<OrderPlacement>({});
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const marks = Array.from({ length: setup.count + 1 }, (_, index) => index);
  const written = (units: number) => decimalText(document.locale, units / 10 ** setup.scale, setup.scale);
  const placed = setup.values.filter((units) => placement[units] !== undefined);
  const waiting = setup.values.filter((units) => placement[units] === undefined);
  const listed = (items: string[]) => (items.length > 0 ? items.join('; ') : t.noneYet);
  const summary = `${fillSlots(t.orderRange, written(orderMarkUnits(setup, 0)), written(orderMarkUnits(setup, setup.count)), written(setup.step))}. `
    + `${t.placedLabel}: ${listed(placed.map((units) => fillSlots(t.numberOnMark, written(units), placement[units]!)))}. `
    + `${t.leftLabel}: ${listed(waiting.map(written))}.`;

  const change = (next: OrderPlacement) => { grading.reset(); setPlacement(next); };
  const place = (item: string, target: string) => {
    const units = unitsOf(item);
    if (target === TRAY) { if (placement[units] !== undefined) change(orderRemove(placement, units)); return; }
    const mark = Number(target.slice('m-'.length));
    if (placement[units] !== mark) change(orderPlace(placement, units, mark));
  };
  const drag = useDragPlace<string>(place, locked);
  const reset = () => { grading.reset(); drag.clear(); setPlacement({}); };
  const options = [{ value: TRAY, label: t.trayName }, ...marks.map((index) => ({ value: orderSlotId(index), label: fillSlot(t.markName, index) }))];

  const landing = (id: string) => {
    const target = drag.target(id) as ReturnType<typeof drag.target> & { onClick?: () => void };
    return {
      ...target,
      onClick: (event: MouseEvent<HTMLElement>) => {
        const handle = (event.target as Element).closest('.lf-hz-handle');
        if (handle?.getAttribute('data-order-chip') === drag.carried) return;
        target.onClick?.();
      },
    };
  };
  const chip = (units: number) => <span className="lf-hz-handle" data-hz-handle="" data-hz-hit="64" data-order-chip={orderPieceId(units)}>
    <ChoiceChip {...drag.chip(orderPieceId(units))} disabled={locked}>{written(units)}</ChoiceChip>
  </span>;

  return <BoardShell screen="order-number-line" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={placed.length === 0 || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={waiting.length === 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metOrder, hint: t.hintOrder }} onCheck={() => grading.check(orderResponse(placement))} />}>
    <section className="lf-learning-board lf-num-board" aria-label={t.orderLine}>
      <div className="lf-num-scroll">
        <ol className="lf-order-line" style={{ '--marks': setup.count + 1 } as CSSProperties}>
          {marks.map((index) => {
            const occupant = orderOccupant(placement, index);
            return <li key={index} className="lf-order-mark" aria-label={fillSlot(t.markName, index)} {...landing(orderSlotId(index))}>
              <div className="lf-order-slot">{occupant === undefined ? <span className="lf-order-empty" aria-hidden="true" /> : chip(occupant)}</div>
              <span className="lf-order-axis" aria-hidden="true" />
              {orderLabelled(setup, index) ? <span className="lf-order-number" data-copy-role="data">{written(orderMarkUnits(setup, index))}</span> : null}
            </li>;
          })}
        </ol>
      </div>
      <p className="lf-num-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{summary}</p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.orderCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colNumber}</th><th scope="col" data-copy-role="data">{t.colMark}</th></tr></thead>
        <tbody>{setup.values.map((units) => <tr key={units}>
          <th scope="row" data-copy-role="data">{written(units)}</th>
          <td data-copy-role="data">{placement[units] === undefined ? t.notPlaced : placement[units]}</td>
        </tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.orderTray}>
      <h2 data-copy-role="heading">{t.orderTray}</h2>
      <div className="lf-order-tray" {...landing(TRAY)}>
        {waiting.map((units) => <span key={units}>{chip(units)}</span>)}
      </div>
      <MoveToChoice locale={document.locale} item={drag.carried === null ? null : { label: written(unitsOf(drag.carried)) }} options={options} disabled={locked}
        onChange={(value) => { if (drag.carried) { place(drag.carried, value); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function OrderLineBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.number-line.order.v2' ? <OrderLine segment={segment} {...rest} /> : null;
}
