import { useState } from 'react';
import { Button } from '../../../design/controls';
import { useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { Plano } from '../plano/Plano';
import type { PlanoSeries } from '../plano/model';
import { DataTable, GeomFrame, cellsOutline, clampTo, fill, rowRuns, runPolygon, type Cell } from './boardKit';
import { GEOM2_COPY } from './copy';
import { boundsOf, pointKey } from './geometry.generated';
import { placeTiles } from './tessellationModel.generated';

type TessellationSegment = Extract<HorizonteSegment, { type: 'math.tessellation.v2' }>;

const HUES: readonly PlanoSeries[] = [1, 2, 3];
const slide = (tile: readonly Cell[], anchor: Cell): Cell[] => tile.map((cell) => ({ x: cell.x + anchor.x, y: cell.y + anchor.y }));

/*
 * F2.8 tessellation: a floor of square cells and one tile that is only slid. The learner places copies until the floor
 * is covered; a copy is named by the corner its origin cell is slid to (the anchor), which is the whole answer.
 */
function Tessellation({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: TessellationSegment }) {
  const { floor, tile } = segment.payload;
  const t = copyText(GEOM2_COPY, document.locale);
  const [anchors, setAnchors] = useState<Cell[]>([]);
  const [cursor, setCursor] = useState<Cell>({ x: 0, y: 0 });
  const [refused, setRefused] = useState(false);
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const span = boundsOf(floor);
  const columns = span.maxX + 1;
  const rows = span.maxY + 1;
  const left = floor.length - anchors.length * tile.length;

  const cellAt = (point: Cell, round: (value: number) => number): Cell => ({ x: clampTo(round(point.x), 0, span.maxX), y: clampTo(round(point.y), 0, span.maxY) });
  const change = (next: Cell[]) => { grading.reset(); setRefused(false); setAnchors(next); };
  const place = (at: Cell) => {
    if (locked) return;
    setCursor(at);
    if (placeTiles(segment.payload, [...anchors, at]).kind === 'broken') { setRefused(true); return; }
    change([...anchors, at]);
  };
  const tap = (at: Cell) => {
    if (locked) return;
    const covering = anchors.findIndex((anchor) => slide(tile, anchor).some((cell) => pointKey(cell) === pointKey(at)));
    if (covering >= 0) { setCursor(at); change(anchors.filter((_, index) => index !== covering)); } else place(at);
  };
  const reset = () => { grading.reset(); setRefused(false); setAnchors([]); setCursor({ x: 0, y: 0 }); };

  const preview = cellsOutline(slide(tile, cursor));
  const status = [fill(t.tsFacts, { columns, rows, count: anchors.length, left, x: cursor.x, y: cursor.y }), refused ? t.tsNoFit : ''].filter(Boolean).join(' ');

  return <GeomFrame screen="tessellation" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={anchors.length > 0} answer={{ points: anchors }} named={{ met: t.metTiles, hint: t.hintTiles }} changed={anchors.length > 0 || refused}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.tsLabel} status={status} hint={t.tsHint}
    onAct={() => place(cursor)}
    board={<Plano label={t.tsLabel} domain={{ xMin: 0, xMax: columns, yMin: 0, yMax: rows }} size={{ width: columns * 60, height: rows * 60 }}
      keyStep={1} tickStep={1} xLabel={t.colX} yLabel={t.colY} tableToggle={false}
      layers={{
        regions: [
          ...rowRuns(floor).map((run) => ({ id: `floor-${run.x0}-${run.y}`, points: runPolygon(run), series: 'neutral' as const })),
          ...anchors.map((anchor, index) => ({ id: `tile-${index}`, points: cellsOutline(slide(tile, anchor)), series: HUES[index % HUES.length] })),
        ],
        polylines: [{ id: 'preview', points: [...preview, preview[0]!], series: 3 }],
        handles: [{ id: 'cursor', x: cursor.x, y: cursor.y, label: t.tsCursor, disabled: locked, bounds: { xMin: 0, xMax: span.maxX, yMin: 0, yMax: span.maxY } }],
      }}
      onHandleChange={(_id, point) => { setRefused(false); setCursor(cellAt(point, Math.round)); }}
      onPlaneTap={(point) => tap(cellAt(point, Math.floor))} />}
    actions={<>
      <Button size="sm" disabled={locked} onClick={() => place(cursor)}>{t.placeTile}</Button>
      <Button size="sm" disabled={locked || anchors.length === 0} onClick={() => change(anchors.slice(0, -1))}>{t.removeLast}</Button>
    </>}
    tableNode={<DataTable caption={t.tsCaption} head={[t.colTile, t.colX, t.colY]}
      rows={anchors.map((anchor, index) => [fill(t.tileName, { n: index + 1 }), String(anchor.x), String(anchor.y)])} />} />;
}

export default function TessellationBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.tessellation.v2') return null;
  return <Tessellation segment={segment} {...rest} />;
}
