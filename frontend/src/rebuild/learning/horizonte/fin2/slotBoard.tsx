import { useState, type CSSProperties, type ReactNode } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { answerOf, canPlace, placePiece, sameSlots, TRAY, unplaced, type Accepts } from './placement.generated';
import type { Locale } from '../../../design/copyBudget';
import type { FIN2_COPY } from './copy';
import type { Frame, SlotMap } from './slots.generated';
import '../horizonte.css';
import './slotBoard.css';

export type Words = { readonly [K in keyof typeof FIN2_COPY]: string };

const CURRENCY = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' } as const;
export const money = (locale: Locale, amount: number): string => new Intl.NumberFormat(locale, { style: 'currency', currency: CURRENCY[locale], maximumFractionDigits: 0 }).format(amount);

/** A copy string whose key is built at run time, such as a zone name. */
export const word = (t: Words, key: string): string => (t as Readonly<Record<string, string>>)[key] ?? key;
export interface TableSpec { caption: string; head: readonly string[]; rows: ReadonlyArray<readonly string[]> }

export interface SlotBoardOptions {
  segmentId: string;
  frame: Frame;
  start: SlotMap;
  accepts?: Accepts;
  onGrade: HorizonteBoardProps['onGrade'];
  /** Plain text of a piece: the chip's accessible name. */
  label: (piece: string) => string;
  /** A line under the chip, for what the learner needs and the chart cannot say. */
  note?: (piece: string) => string | null;
  /** Display name of a slot, for the Move to menu. */
  name: (slot: string) => string;
  /** The Move to entry that takes a piece back to the tray; null when pieces never leave the board. */
  trayLabel: string | null;
}

/** One arrangement board: chips in zones, placed by drag, by tap then zone, or by the Move to menu; the answer is the slot map. */
export function useSlotBoard(options: SlotBoardOptions) {
  const { frame, start, accepts, label, name, trayLabel } = options;
  const grading = useSegmentGrade(options.segmentId, options.onGrade);
  const locked = grading.pending || grading.met;
  const [slots, setSlots] = useState<SlotMap>(start);
  const place = (piece: string, target: string) => {
    const next = placePiece(frame, slots, piece, target, accepts);
    if (next === slots) return;
    grading.reset();
    setSlots(next);
  };
  const drag = useDragPlace<string>(place, locked);
  const carried = drag.carried;
  const targets = carried === null ? [] : [...(trayLabel === null ? [] : [TRAY]), ...frame.slotIds].filter((target) => canPlace(frame, slots, carried, target, accepts));
  return {
    grading, locked, slots, drag, label, note: options.note ?? (() => null), trayLabel,
    tray: unplaced(frame, slots),
    changed: !sameSlots(slots, start),
    reset: () => { grading.reset(); drag.clear(); setSlots(start); },
    moveItem: carried === null ? null : { label: label(carried) },
    moveOptions: targets.map((target) => ({ value: target, label: target === TRAY ? trayLabel! : name(target) })),
    moveTo: (target: string) => { if (carried !== null) { place(carried, target); drag.clear(); } },
  };
}
export type SlotBoard = ReturnType<typeof useSlotBoard>;

export function Piece({ board, id }: { board: SlotBoard; id: string }) {
  const note = board.note(id);
  return <span className="lf-piece">
    <span className="lf-hz-handle" data-hz-handle="" data-hz-hit="64"><ChoiceChip {...board.drag.chip(id)} disabled={board.locked}>{board.label(id)}</ChoiceChip></span>
    {note ? <span className="lf-piece-note" data-copy-role="data">{note}</span> : null}
  </span>;
}

export type Cell = readonly [column: number, row: number, columns: number, rows: number];

export function Zone({ board, id, name, note, cell }: { board: SlotBoard; id: string; name: string; note?: string | null; cell?: Cell }) {
  const style = cell ? ({ '--zc': cell[0], '--zr': cell[1], '--zw': cell[2], '--zh': cell[3] } as CSSProperties) : undefined;
  return <div className="lf-slotzone" role="group" aria-label={name} style={style} {...board.drag.target(id)}>
    <h3 data-copy-role="data">{name}</h3>
    {note ? <p className="lf-slotzone-note" data-copy-role="data">{note}</p> : null}
    <div className="lf-slotzone-pieces">{(board.slots[id] ?? []).map((piece) => <Piece key={piece} board={board} id={piece} />)}</div>
  </div>;
}

export function SlotBoardShell({ screen, document, segment, onBack, sequence, board, t, named, status, table, tray, heading, children }: Omit<HorizonteBoardProps, 'segment' | 'onGrade'> & {
  screen: string; segment: HorizonteSegment; board: SlotBoard; t: Words; named: { met: string; hint: string }; status: ReactNode; table: TableSpec; tray: boolean; heading: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { grading } = board;
  return <BoardShell screen={screen} locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={board.reset} resetDisabled={!board.changed || board.locked}
    controls={<Button size="sm" aria-expanded={open} onClick={() => setOpen((shown) => !shown)} data-hz-table-toggle="">{open ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={board.changed && !board.locked} sequence={sequence} feedback={segment.feedback}
      named={named} onCheck={() => grading.check(answerOf(board.slots))} />}>
    <section className="lf-learning-board lf-slotboard" aria-label={document.title}>
      {children}
      <p className="lf-slotboard-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {open ? <div className="lf-slotboard-tablewrap" role="region" aria-label={table.caption} tabIndex={0}>
        <table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{table.caption}</caption>
          <thead><tr>{table.head.map((cell, index) => <th key={index} scope="col" data-copy-role="data">{cell}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0
            ? <th key={column} scope="row" data-copy-role="data">{cell}</th>
            : <td key={column} data-copy-role="data">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={heading}>
      <h2 data-copy-role="heading">{heading}</h2>
      {tray ? <div className="lf-slotboard-tray" role="group" aria-label={t.tray} {...board.drag.target(TRAY)}>
        {board.tray.length > 0 ? board.tray.map((piece) => <Piece key={piece} board={board} id={piece} />) : <p data-copy-role="body">{t.trayEmpty}</p>}
      </div> : null}
      <MoveToChoice locale={document.locale} item={board.moveItem} options={board.moveOptions} disabled={board.locked} onChange={board.moveTo} />
    </section>
  </BoardShell>;
}

export const joinNames = (ids: readonly string[], labels: Readonly<Record<string, string>>, none: string): string => (ids.length > 0 ? ids.map((id) => labels[id] ?? id).join(', ') : none);

/** One sentence per zone: the same placement the chart draws, said in words. */
export function describeZones(zones: ReadonlyArray<{ name: string; pieces: readonly string[] }>, label: (piece: string) => string, none: string): string {
  return zones.map((zone) => `${zone.name}: ${zone.pieces.length > 0 ? zone.pieces.map(label).join(', ') : none}.`).join(' ');
}
