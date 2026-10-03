import { useState, type CSSProperties, type ReactNode } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { answerOf, canPlace, placePiece, sameSlots, TRAY, unplaced, type Accepts, type Frame, type SlotMap } from './arrange.generated';
import type { Words } from './format';
import { SpecTable, type TableSpec } from './specTable';
import '../horizonte.css';
import './slotBoard.css';

export interface SlotBoardOptions {
  segmentId: string;
  frame: Frame;
  start: SlotMap;
  accepts?: Accepts;
  onGrade: HorizonteBoardProps['onGrade'];
  /** Plain text of a piece: the chip's accessible name. */
  label: (piece: string) => string;
  /** A line under the chip, for what the learner needs and the picture cannot say. */
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
    grading, locked, slots, drag, place, label, note: options.note ?? (() => null), trayLabel,
    tray: unplaced(frame, slots),
    changed: !sameSlots(slots, start),
    reset: () => { grading.reset(); drag.clear(); setSlots(start); },
    moveItem: carried === null ? null : { label: label(carried) },
    moveOptions: targets.map((target) => ({ value: target, label: target === TRAY ? trayLabel! : name(target) })),
    moveTo: (target: string) => { if (carried !== null) { place(carried, target); drag.clear(); } },
  };
}
export type SlotBoard = ReturnType<typeof useSlotBoard>;

/** One chip. `position` says where it stands in an ordered zone, because an order cannot be read from a set of chips. */
export function Piece({ board, id, position }: { board: SlotBoard; id: string; position?: string }) {
  const note = position ?? board.note(id);
  return <span className="lf-piece">
    <span className="lf-hz-handle" data-hz-handle="" data-hz-hit="64"><ChoiceChip {...board.drag.chip(id)} disabled={board.locked}>{board.label(id)}</ChoiceChip></span>
    {note ? <span className="lf-piece-note" data-copy-role="data">{note}</span> : null}
  </span>;
}

export type Cell = readonly [column: number, row: number, columns: number, rows: number];

export function Zone({ board, id, name, note, cell, numbered }: {
  board: SlotBoard; id: string; name: string; note?: string | null; cell?: Cell;
  /** An ordered zone: each chip says its place in the line. */
  numbered?: (position: number) => string;
}) {
  const style = cell ? ({ '--zc': cell[0], '--zr': cell[1], '--zw': cell[2], '--zh': cell[3] } as CSSProperties) : undefined;
  return <div className="lf-slotzone" role="group" aria-label={name} style={style} {...board.drag.target(id)}>
    <h3 data-copy-role="data">{name}</h3>
    {note ? <p className="lf-slotzone-note" data-copy-role="data">{note}</p> : null}
    <div className="lf-slotzone-pieces">{(board.slots[id] ?? []).map((piece, index) => <Piece key={piece} board={board} id={piece} position={numbered?.(index + 1)} />)}</div>
  </div>;
}

export function SlotBoardShell({ screen, document, segment, onBack, sequence, board, t, named, status, table, tray, move = true, heading, aside, children }: Omit<HorizonteBoardProps, 'segment' | 'onGrade'> & {
  screen: string; segment: HorizonteSegment; board: SlotBoard; t: Words; named: { met: string; hint: string }; status: ReactNode; table: TableSpec; tray: boolean; heading: string;
  /** False when no piece is ever carried (a row of switches): the Move to menu has nothing to move. */
  move?: boolean;
  /** Shown under the status: facts the picture alone cannot say, such as a step list. */
  aside?: ReactNode; children: ReactNode;
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
      {aside}
      {open ? <SpecTable table={table} /> : null}
    </section>
    {tray || move ? <section className="lf-learning-control-strip" aria-label={heading}>
      <h2 data-copy-role="heading">{heading}</h2>
      {tray ? <div className="lf-slotboard-tray" role="group" aria-label={t.tray} {...board.drag.target(TRAY)}>
        {board.tray.length > 0 ? board.tray.map((piece) => <Piece key={piece} board={board} id={piece} />) : <p data-copy-role="body">{t.trayEmpty}</p>}
      </div> : null}
      {move ? <MoveToChoice locale={document.locale} item={board.moveItem} options={board.moveOptions} disabled={board.locked} onChange={board.moveTo} /> : null}
    </section> : null}
  </BoardShell>;
}

export const joinNames = (ids: readonly string[], labels: Readonly<Record<string, string>>, none: string): string => (ids.length > 0 ? ids.map((id) => labels[id] ?? id).join(', ') : none);

/** One sentence per zone: the same placement the picture draws, said in words. */
export function describeZones(zones: ReadonlyArray<{ name: string; pieces: readonly string[] }>, label: (piece: string) => string, none: string): string {
  return zones.map((zone) => `${zone.name}: ${zone.pieces.length > 0 ? zone.pieces.map(label).join(', ') : none}.`).join(' ');
}
