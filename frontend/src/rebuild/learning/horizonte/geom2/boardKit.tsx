import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '../../../design/controls';
import type { LessonClientDocument } from '../../lessonDocument';
import type { LessonSequenceControl } from '../../lessonSequence';
import { BoardShell, GradedFoot, type useSegmentGrade } from '../../segmentKit';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { GEOM2_COPY } from './copy';
import '../horizonte.css';
import './geom2.css';

export type Grading = ReturnType<typeof useSegmentGrade>;
export type Copy = ReturnType<typeof copyText<typeof GEOM2_COPY>>;
export interface Cell { x: number; y: number }

/** Fills every {name} slot of an authored string. */
export const fill = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (slot, key: string) => (key in values ? String(values[key]) : slot));

export const clampTo = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
export const pair = (point: Cell): string => `(${point.x}, ${point.y})`;

/** The four corners of one unit cell named by its lower-left corner, closed. */
export const cellOutline = (cell: Cell): Cell[] => [
  { x: cell.x, y: cell.y }, { x: cell.x + 1, y: cell.y }, { x: cell.x + 1, y: cell.y + 1 }, { x: cell.x, y: cell.y + 1 }, { x: cell.x, y: cell.y },
];

/** Cells of one row joined into horizontal bars: far fewer shapes than one per cell. */
export function rowRuns(cells: readonly Cell[]): Array<{ x0: number; x1: number; y: number }> {
  const sorted = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
  const runs: Array<{ x0: number; x1: number; y: number }> = [];
  for (const cell of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.y === cell.y && last.x1 === cell.x) last.x1 = cell.x + 1;
    else runs.push({ x0: cell.x, x1: cell.x + 1, y: cell.y });
  }
  return runs;
}

export const runPolygon = (run: { x0: number; x1: number; y: number }): Cell[] => [
  { x: run.x0, y: run.y }, { x: run.x1, y: run.y }, { x: run.x1, y: run.y + 1 }, { x: run.x0, y: run.y + 1 },
];

/**
 * The outline of a connected set of unit cells (named by lower-left corner): every cell contributes its four edges
 * counterclockwise, shared edges cancel, and what is left is chained from the first one. Corners only.
 */
export function cellsOutline(cells: readonly Cell[]): Cell[] {
  const edges = new Map<string, [Cell, Cell]>();
  for (const { x, y } of cells) {
    const ring: Cell[] = [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 }];
    ring.forEach((from, index) => {
      const to = ring[(index + 1) % 4]!;
      const forward = `${from.x},${from.y}>${to.x},${to.y}`;
      const backward = `${to.x},${to.y}>${from.x},${from.y}`;
      if (edges.has(backward)) edges.delete(backward);
      else edges.set(forward, [from, to]);
    });
  }
  const next = new Map<string, Cell>([...edges.values()].map(([from, to]) => [`${from.x},${from.y}`, to]));
  const start = [...edges.values()][0]?.[0];
  if (!start) return [];
  const loop: Cell[] = [];
  let here = start;
  do {
    loop.push(here);
    const following = next.get(`${here.x},${here.y}`);
    if (!following) break;
    here = following;
  } while (here.x !== start.x || here.y !== start.y);
  return loop.filter((point, index) => {
    const before = loop[(index + loop.length - 1) % loop.length]!;
    const after = loop[(index + 1) % loop.length]!;
    return (point.x - before.x) * (after.y - point.y) - (point.y - before.y) * (after.x - point.x) !== 0;
  });
}

export function DataTable({ caption, head, rows, foot }: { caption: string; head: readonly string[]; rows: readonly (readonly string[])[]; foot?: readonly string[] }) {
  const line = (cells: readonly string[], key: string | number) => <tr key={key}>{cells.map((cell, index) => (index === 0
    ? <th key={index} scope="row" data-copy-role="data">{cell}</th> : <td key={index} data-copy-role="data">{cell}</td>))}</tr>;
  return <table className="lf-hz-table" data-hz-table="">
    <caption data-copy-role="heading">{caption}</caption>
    <thead><tr>{head.map((cell, index) => <th key={index} scope="col" data-copy-role="data">{cell}</th>)}</tr></thead>
    <tbody>{rows.map((cells, index) => line(cells, index))}</tbody>
    {foot ? <tfoot>{line(foot, 'foot')}</tfoot> : null}
  </table>;
}

export interface TableState { open: boolean; toggle: () => void }

/**
 * The anatomy every geom2 board shares: the plane, its spoken status line, the optional table, the board's own actions,
 * the control strip, Reset and Check. Enter or Space on a plane handle runs `onAct` (the same action as its button).
 */
export function GeomFrame({ screen, document, segment, onBack, sequence, grading, canCheck, answer, named, changed, onReset, table, label, status, hint, board, tableNode, actions, onAct }: {
  screen: string; document: LessonClientDocument; segment: HorizonteSegment; onBack: () => void; sequence?: LessonSequenceControl;
  grading: Grading; canCheck: boolean; answer: unknown; named: { met: string; hint: string }; changed: boolean; onReset: () => void;
  table: TableState; label: string; status: string; hint?: string; board: ReactNode; tableNode: ReactNode; actions?: ReactNode; onAct?: () => void;
}) {
  const t = copyText(GEOM2_COPY, document.locale);
  const locked = grading.pending || grading.met;
  const act = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onAct || locked || (event.key !== 'Enter' && event.key !== ' ')) return;
    if ((event.target as HTMLElement).getAttribute('role') !== 'slider') return;
    event.preventDefault();
    onAct();
  };
  return <BoardShell screen={screen} locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={onReset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table.open} onClick={table.toggle} data-hz-table-toggle="">{table.open ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={canCheck && !locked} sequence={sequence} feedback={segment.feedback}
      named={named} onCheck={() => grading.check(answer)} />}>
    <section className="lf-learning-board lf-geom" aria-label={label}>
      <div className="lf-geom-stage" onKeyDown={act}>{board}</div>
      {hint ? <p className="lf-geom-hint" data-copy-role="body">{hint}</p> : null}
      {actions ? <div className="lf-geom-actions">{actions}</div> : null}
      <p className="lf-geom-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {table.open ? tableNode : null}
    </section>
  </BoardShell>;
}
