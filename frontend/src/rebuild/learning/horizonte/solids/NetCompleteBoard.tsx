import { useMemo, useState, type CSSProperties } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { FoldedCube } from './FoldedCube';
import { NetArea } from './NetArea';
import { NET_PIECE, NET_SQUARES, cellKey, gridSlotId, parseGridSlot, type NetCell } from './net.generated';
import { PAIR_OF, foldOf } from './netFold';
import type { CompleteNet } from './rules.generated';
import { fill, solidsText } from './solidsText';
import '../horizonte.css';
import './solids.css';

type NetSegment = Extract<HorizonteSegment, { type: 'geometry.cube-net.v2' }>;

/*
 * F4.2, completion mode: some squares of a net are fixed on a grid and the learner adds the rest so the six fold into a cube. Tapping a
 * grid square adds or removes it; a square chip can also be dragged or placed with "Move to". The folded cube beside the grid shows where
 * each square lands, as feedback on the learner's own layout. Core decides whether the net is a cube net.
 */
export function NetCompleteBoard({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: NetSegment; payload: CompleteNet }) {
  const t = solidsText(document.locale);
  const [added, setAdded] = useState<readonly NetCell[]>([]);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const { cols, rows } = payload.grid;
  const fixedKeys = useMemo(() => new Set(payload.fixed.map(cellKey)), [payload.fixed]);
  const squares = useMemo(() => [...payload.fixed, ...added], [payload.fixed, added]);
  const keys = new Set(squares.map(cellKey));
  const full = squares.length >= NET_SQUARES;
  const fold = useMemo(() => foldOf(squares), [squares]);
  const pairAt = new Map(squares.map((square, index) => [cellKey(square), fold.faces[index] ?? null] as const));
  const foldText = { join: t.foldJoin, overlap: t.foldOverlap, more: t.foldMore, ok: t.foldOk }[fold.state];
  const where = (col: number, row: number) => ({ c: col + 1, r: row + 1 });

  const edit = (next: readonly NetCell[]) => { grading.reset(); setAdded(next); };
  const toggle = (col: number, row: number) => {
    const key = cellKey([col, row]);
    if (locked || fixedKeys.has(key)) return;
    if (keys.has(key)) edit(added.filter((square) => cellKey(square) !== key));
    else if (!full) edit([...added, [col, row]]);
  };
  const place = (_item: string, target: string) => {
    const square = parseGridSlot(target);
    if (square && !keys.has(cellKey(square))) toggle(square[0], square[1]);
  };
  const drag = useDragPlace<string>(place, locked);
  const reset = () => { grading.reset(); drag.clear(); setAdded([]); };
  const empty = Array.from({ length: cols * rows }, (_, index) => [index % cols, Math.floor(index / cols)] as const).filter(([col, row]) => !keys.has(cellKey([col, row])));

  return <BoardShell screen="cube-net" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={added.length === 0 || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={full && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metNetComplete, hint: t.hintNetComplete }}
      onCheck={() => grading.check({ slots: Object.fromEntries(squares.map(([col, row]) => [gridSlotId(col, row), [NET_PIECE]])) })} />}>
    <section className="lf-learning-board lf-net" aria-label={t.gridName}>
      <div className="lf-net-grid" role="group" aria-label={t.gridName} style={{ '--cols': cols } as CSSProperties}>
        {Array.from({ length: cols * rows }, (_, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const key = cellKey([col, row]);
          const given = fixedKeys.has(key);
          const filled = keys.has(key);
          const face = pairAt.get(key);
          const label = fill(given ? t.gridCellGiven : filled ? t.gridCellSquare : t.gridCellEmpty, where(col, row));
          return <div key={key} className="lf-net-cell" {...drag.target(gridSlotId(col, row))}>
            <button type="button" className="lf-net-square" aria-label={label} data-copy-role="data"
              data-state={given ? 'given' : filled ? 'square' : 'empty'} data-pair={face ? PAIR_OF[face] : undefined}
              aria-disabled={locked || given || (!filled && full)} onClick={() => { if (!drag.carried) toggle(col, row); }} />
          </div>;
        })}
      </div>
      <p className="lf-solid-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{fill(t.squaresCount, { n: squares.length })}. {foldText}</p>
      <FoldedCube t={t} faces={fold.faces} />
      <NetArea t={t} edge={payload.edge} locale={document.locale} />
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.gridName}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.colSquare}</th><th scope="col" data-copy-role="data">{t.colColumn}</th><th scope="col" data-copy-role="data">{t.colRow}</th>
        </tr></thead>
        <tbody>{squares.map(([col, row], index) => <tr key={cellKey([col, row])}>
          <th scope="row" data-copy-role="data">{index + 1}{fixedKeys.has(cellKey([col, row])) ? ` (${t.given})` : ''}</th>
          <td data-copy-role="data">{col + 1}</td><td data-copy-role="data">{row + 1}</td>
        </tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.squaresHeading}>
      <h2 data-copy-role="heading">{t.squaresHeading}</h2>
      <p data-copy-role="body">{t.placeSquareHint}</p>
      <div className="lf-net-tray">
        <span className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip('square')} disabled={locked || full}>{t.addSquare}</ChoiceChip>
        </span>
      </div>
      <MoveToChoice locale={document.locale} item={drag.carried ? { label: t.addSquare } : null} disabled={locked || full}
        options={empty.map(([col, row]) => ({ value: gridSlotId(col, row), label: fill(t.cellName, where(col, row)) }))}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}
