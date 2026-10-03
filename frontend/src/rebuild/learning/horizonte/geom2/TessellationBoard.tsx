import { useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { Plano } from '../plano/Plano';
import type { PlanoSeries } from '../plano/model';
import { DataTable, GeomFrame, cellsOutline, clampTo, fill, rowRuns, runPolygon, type Cell } from './boardKit';
import { GEOM2_COPY } from './copy';
import { boundsOf, pointKey } from './geometry.generated';
import { copyCells, offeredMotions, orientTile, placeCopies, type TileCopy, type TileMotion } from './tessellationModel.generated';

type TessellationSegment = Extract<HorizonteSegment, { type: 'math.tessellation.v2' }>;

const HUES: readonly PlanoSeries[] = [1, 2, 3];
const MOTION_NAME = { slide: 'moveSlide', turn: 'moveTurn', flip: 'moveFlip' } as const;
const shift = (tile: readonly Cell[], anchor: Cell): Cell[] => tile.map((cell) => ({ x: cell.x + anchor.x, y: cell.y + anchor.y }));

/*
 * F2.8 tessellation: a floor of square cells and one tile. The learner places copies until the floor is covered. A copy is
 * the tile as it is, turned half a turn or flipped over (only the motions the floor offers), slid so the lower-left corner of
 * its box sits on the anchor; the anchors, and the motion of each when more than a slide is offered, are the whole answer.
 * A tap names the square the copy's first square lands on, so a tap never needs the box corner to be free.
 */
function Tessellation({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: TessellationSegment }) {
  const { floor, tile } = segment.payload;
  const t = copyText(GEOM2_COPY, document.locale);
  const offered = offeredMotions(segment.payload);
  const choosing = offered.length > 1;
  const [copies, setCopies] = useState<TileCopy[]>([]);
  const [motion, setMotion] = useState<TileMotion>('slide');
  const [cursor, setCursor] = useState<Cell>({ x: 0, y: 0 });
  const [refused, setRefused] = useState(false);
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const span = boundsOf(floor);
  const columns = span.maxX + 1;
  const rows = span.maxY + 1;
  const left = floor.length - copies.length * tile.length;

  const cellAt = (point: Cell, round: (value: number) => number): Cell => ({ x: clampTo(round(point.x), 0, span.maxX), y: clampTo(round(point.y), 0, span.maxY) });
  const change = (next: TileCopy[]) => { grading.reset(); setRefused(false); setCopies(next); };
  const place = (anchor: Cell) => {
    if (locked) return;
    setCursor({ x: clampTo(anchor.x, 0, span.maxX), y: clampTo(anchor.y, 0, span.maxY) });
    const next = [...copies, { anchor, motion }];
    if (placeCopies(segment.payload, next).kind === 'broken') { setRefused(true); return; }
    change(next);
  };
  const tap = (at: Cell) => {
    if (locked) return;
    const covering = copies.findIndex((copy) => copyCells(tile, copy).some((cell) => pointKey(cell) === pointKey(at)));
    if (covering >= 0) { setCursor(at); change(copies.filter((_, index) => index !== covering)); return; }
    const first = orientTile(tile, motion)[0]!;
    place({ x: at.x - first.x, y: at.y - first.y });
  };
  const pick = (next: TileMotion) => { setRefused(false); setMotion(next); };
  const reset = () => { grading.reset(); setRefused(false); setCopies([]); setMotion('slide'); setCursor({ x: 0, y: 0 }); };

  const preview = cellsOutline(shift(orientTile(tile, motion), cursor));
  const status = [
    fill(t.tsFacts, { columns, rows, count: copies.length, left, x: cursor.x, y: cursor.y }),
    choosing ? fill(t.tsMove, { move: t[MOTION_NAME[motion]] }) : '',
    refused ? t.tsNoFit : '',
  ].filter(Boolean).join(' ');
  const anchors = copies.map((copy) => copy.anchor);

  return <GeomFrame screen="tessellation" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={copies.length > 0} answer={choosing ? { points: anchors, motions: copies.map((copy) => copy.motion) } : { points: anchors }}
    named={{ met: t.metTiles, hint: t.hintTiles }} changed={copies.length > 0 || refused}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.tsLabel} status={status} hint={choosing ? t.tsHintMoves : t.tsHint}
    onAct={() => place(cursor)}
    board={<Plano label={t.tsLabel} domain={{ xMin: 0, xMax: columns, yMin: 0, yMax: rows }} size={{ width: columns * 60, height: rows * 60 }}
      keyStep={1} tickStep={1} xLabel={t.colX} yLabel={t.colY} tableToggle={false}
      layers={{
        regions: [
          ...rowRuns(floor).map((run) => ({ id: `floor-${run.x0}-${run.y}`, points: runPolygon(run), series: 'neutral' as const })),
          ...copies.map((copy, index) => ({ id: `tile-${index}`, points: cellsOutline(copyCells(tile, copy)), series: HUES[index % HUES.length] })),
        ],
        polylines: [{ id: 'preview', points: [...preview, preview[0]!], series: 3 }],
        handles: [{ id: 'cursor', x: cursor.x, y: cursor.y, label: t.tsCursor, disabled: locked, bounds: { xMin: 0, xMax: span.maxX, yMin: 0, yMax: span.maxY } }],
      }}
      onHandleChange={(_id, point) => { setRefused(false); setCursor(cellAt(point, Math.round)); }}
      onPlaneTap={(point) => tap(cellAt(point, Math.floor))} />}
    actions={<>
      {choosing ? <div className="lf-geom-moves" role="group" aria-label={t.tsMotion}>
        {offered.map((name) => <ChoiceChip key={name} selected={motion === name} disabled={locked} onToggle={() => pick(name)}>{t[MOTION_NAME[name]]}</ChoiceChip>)}
      </div> : null}
      <Button size="sm" disabled={locked} onClick={() => place(cursor)}>{t.placeTile}</Button>
      <Button size="sm" disabled={locked || copies.length === 0} onClick={() => change(copies.slice(0, -1))}>{t.removeLast}</Button>
    </>}
    tableNode={<DataTable caption={t.tsCaption} head={choosing ? [t.colTile, t.colMove, t.colX, t.colY] : [t.colTile, t.colX, t.colY]}
      rows={copies.map((copy, index) => [fill(t.tileName, { n: index + 1 }), ...(choosing ? [t[MOTION_NAME[copy.motion]]] : []), String(copy.anchor.x), String(copy.anchor.y)])} />} />;
}

export default function TessellationBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.tessellation.v2') return null;
  return <Tessellation segment={segment} {...rest} />;
}
