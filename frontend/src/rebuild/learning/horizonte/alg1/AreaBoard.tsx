import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { areaGrid, areaPieces, areaTargets, readArea, readTerm, type AreaPayload } from './area.generated';
import { ALG1_COPY } from './copy';
import { Handle, Notation, slotsOf, termText, type Placement } from './shared';
import '../horizonte.css';
import './AlgebraBoards.css';

type AreaSegment = Extract<HorizonteSegment, { type: 'math.area-model.v2' }>;

const DEGREE_CELL = ['lf-area-cell--d0', 'lf-area-cell--d1', 'lf-area-cell--d2'] as const;

const HINT = { cells: ['metCells', 'hintCells'], edges: ['metEdges', 'hintEdges'], square: ['metSquare', 'hintSquare'] } as const;

function Backdrop() {
  return <svg className="lf-area-back" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect width="10" height="10" /></svg>;
}

function Area({ document, segment, area, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: AreaSegment; area: AreaPayload }) {
  const t = copyText(ALG1_COPY, document.locale);
  const pieces = useMemo(() => areaPieces(area), [area]);
  const targets = useMemo(() => areaTargets(area), [area]);
  const home = useMemo<Placement>(() => Object.fromEntries(pieces.map((piece) => [piece.id, 'tray'])), [pieces]);
  const [placement, setPlacement] = useState<Placement>(home);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const occupant = (slot: string) => pieces.find((piece) => placement[piece.id] === slot);
  const placed = targets.filter((slot) => occupant(slot)).length;
  const label = (slot: string): string => {
    const [kind, first, second] = slot.split('-');
    if (kind === 'row') return fillSlot(t.row, Number(first) + 1);
    if (kind === 'col') return fillSlot(t.column, Number(first) + 1);
    if (kind === 'cell') return `${fillSlot(t.row, Number(first) + 1)}, ${fillSlot(t.column, Number(second) + 1)}`;
    return slot === 'corner' ? t.corner : t.constant;
  };

  const place = (item: string, target: string) => {
    if (placement[item] === undefined || placement[item] === target) return;
    if (target !== 'tray' && !targets.includes(target)) return;
    const next: Record<string, string> = { ...placement, [item]: target };
    const sitting = target === 'tray' ? undefined : occupant(target);
    if (sitting) next[sitting.id] = 'tray';
    grading.reset(); setPlacement(next);
  };
  const drag = useDragPlace<string>(place, locked);
  const reset = () => { grading.reset(); drag.clear(); setPlacement(home); };

  const carried = drag.carried;
  const carriedPiece = pieces.find((piece) => piece.id === carried);
  const options = carriedPiece === undefined ? [] : [
    ...targets.filter((slot) => slot !== placement[carriedPiece.id]).map((slot) => ({ value: slot, label: label(slot) })),
    ...(placement[carriedPiece.id] === 'tray' ? [] : [{ value: 'tray', label: t.backToPieces }]),
  ];

  const spot = (slot: string): ReactNode => {
    const piece = occupant(slot);
    return <div key={slot} className="lf-area-cell" role="group" aria-label={label(slot)} {...drag.target(slot)}>
      <Backdrop />
      {piece ? <Handle chip={drag.chip(piece.id)} disabled={locked}>{termText(piece.cls)}</Handle> : null}
    </div>;
  };
  const fixed = (text: string, degree: number, key: string): ReactNode => <div key={key} className={`lf-area-cell ${DEGREE_CELL[degree] ?? ''}`} data-copy-role="data"><Backdrop />{text}</div>;
  const head = (text: string, key: string): ReactNode => <div key={key} className="lf-area-head" data-copy-role="data">{text}</div>;

  const { rows, cols } = areaGrid(area);
  const half = area.fill === 'square' ? area.b / 2 : 0;
  const columnHead = (j: number): ReactNode => area.fill === 'cells' ? head(termText(area.cols[j]!), `c${j}`) : area.fill === 'edges' ? spot(`col-${j}`) : head(j === 0 ? 'x' : String(half), `c${j}`);
  const rowHead = (i: number): ReactNode => area.fill === 'cells' ? head(termText(area.rows[i]!), `r${i}`) : area.fill === 'edges' ? spot(`row-${i}`) : head(i === 0 ? 'x' : String(half), `r${i}`);
  const body = (i: number, j: number): ReactNode => {
    if (area.fill === 'cells') return spot(`cell-${i}-${j}`);
    if (area.fill === 'edges') { const face = area.cells[i * 2 + j]!; return fixed(termText(face), readTerm(face)!.d, `b${i}${j}`); }
    return i === 1 && j === 1 ? spot('corner') : fixed(i === 0 && j === 0 ? 'x²' : `${half}x`, i === 0 && j === 0 ? 2 : 1, `b${i}${j}`);
  };
  const tracks = Array.from({ length: cols }, (_, j) => {
    const degree = area.fill === 'cells' ? readTerm(area.cols[j]!)!.d : area.fill === 'square' ? (j === 0 ? 1 : 0) : 1;
    return degree === 0 ? 'minmax(var(--hz-hit), 2fr)' : 'minmax(var(--hz-hit), 3fr)';
  });
  const [met, hint] = HINT[area.fill];

  return <BoardShell screen="area-model" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={pieces.every((piece) => placement[piece.id] === 'tray') || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={placed > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t[met], hint: t[hint] }} onCheck={() => grading.check({ slots: slotsOf(placement, pieces.map((piece) => piece.id)) })} />}>
    <section className="lf-learning-board lf-alg" aria-label={t.areaCaption}>
      <Notation notation={segment.notation} locale={document.locale} />
      <div className="lf-area-grid" style={{ gridTemplateColumns: `var(--hz-hit) ${tracks.join(' ')}` }}>
        <span aria-hidden="true" />
        {Array.from({ length: cols }, (_, j) => columnHead(j))}
        {Array.from({ length: rows }, (_, i) => [rowHead(i), ...Array.from({ length: cols }, (__, j) => body(i, j))])}
      </div>
      {area.fill === 'square' ? <div className="lf-area-constant">
        <span data-copy-role="data">{`(x + ${half})² +`}</span>{spot('constant')}
      </div> : null}
      <p className="lf-alg-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{t.areaPlaced} {placed} {t.areaOf} {targets.length}</p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.areaCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colPlace}</th><th scope="col" data-copy-role="data">{t.colPiece}</th></tr></thead>
        <tbody>{targets.map((slot) => <tr key={slot}>
          <th scope="row" data-copy-role="data">{label(slot)}</th><td data-copy-role="data">{occupant(slot) ? termText(occupant(slot)!.cls) : t.empty}</td>
        </tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.piecesTray}>
      <h2 data-copy-role="heading">{t.piecesTray}</h2>
      <div className="lf-alg-chips lf-area-tray" role="group" aria-label={t.piecesTray} {...drag.target('tray')}>
        {pieces.filter((piece) => placement[piece.id] === 'tray').map((piece) => <Handle key={piece.id} chip={drag.chip(piece.id)} disabled={locked}>{termText(piece.cls)}</Handle>)}
      </div>
      <MoveToChoice locale={document.locale} item={carriedPiece ? { label: termText(carriedPiece.cls) } : null} options={options} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function AreaBoard({ segment, ...rest }: HorizonteBoardProps) {
  const area = useMemo(() => (segment.type === 'math.area-model.v2' ? readArea(segment.payload) : null), [segment]);
  return segment.type === 'math.area-model.v2' && area ? <Area segment={segment} area={area} {...rest} /> : null;
}
