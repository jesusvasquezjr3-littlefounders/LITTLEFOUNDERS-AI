import { useState } from 'react';
import { Button } from '../../../design/controls';
import { useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { Plano } from '../plano/Plano';
import { DataTable, GeomFrame, cellOutline, clampTo, fill, rowRuns, runPolygon, type Cell } from './boardKit';
import { GEOM2_COPY } from './copy';

type AreaSegment = Extract<HorizonteSegment, { type: 'math.area-squares.v2' }>;

const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

/* F2.7 area by squares: an outline on a grid; the learner shades the squares inside. Cells are named by their lower-left corner. */
function AreaSquares({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: AreaSegment }) {
  const { columns, rows, outline } = segment.payload;
  const t = copyText(GEOM2_COPY, document.locale);
  const [shaded, setShaded] = useState<Cell[]>([]);
  const [cursor, setCursor] = useState<Cell>({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;

  const cellAt = (point: Cell): Cell => ({ x: clampTo(Math.floor(point.x), 0, columns - 1), y: clampTo(Math.floor(point.y), 0, rows - 1) });
  const toggle = (at: Cell) => {
    if (locked) return;
    setCursor(at);
    grading.reset();
    setShaded((now) => (now.some((cell) => same(cell, at)) ? now.filter((cell) => !same(cell, at)) : [...now, at]));
  };
  const reset = () => { grading.reset(); setShaded([]); setCursor({ x: 0, y: 0 }); };

  const perRow = Array.from({ length: rows }, (_, index) => rows - 1 - index).map((y) => ({ y, count: shaded.filter((cell) => cell.y === y).length }));
  const status = fill(t.areaFacts, { columns, rows, count: shaded.length, x: cursor.x, y: cursor.y });

  return <GeomFrame screen="area-squares" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={shaded.length > 0} answer={{ points: shaded }} named={{ met: t.metArea, hint: t.hintArea }} changed={shaded.length > 0}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.areaLabel} status={status} hint={t.areaHint}
    onAct={() => toggle(cursor)}
    board={<Plano label={t.areaLabel} domain={{ xMin: 0, xMax: columns, yMin: 0, yMax: rows }} size={{ width: columns * 60, height: rows * 60 }}
      keyStep={1} tickStep={1} xLabel={t.colX} yLabel={t.colY} tableToggle={false}
      layers={{
        regions: rowRuns(shaded).map((run) => ({ id: `shade-${run.x0}-${run.y}`, points: runPolygon(run), series: 1 as const })),
        polylines: [
          { id: 'outline', points: [...outline, outline[0]!], series: 1 },
          { id: 'cursor-cell', points: cellOutline(cursor), series: 'neutral' },
        ],
        handles: [{ id: 'cursor', x: cursor.x, y: cursor.y, label: t.areaCursor, disabled: locked, bounds: { xMin: 0, xMax: columns - 1, yMin: 0, yMax: rows - 1 } }],
      }}
      onHandleChange={(_id, point) => setCursor(cellAt(point))}
      onPlaneTap={(point) => toggle(cellAt(point))} />}
    actions={<>
      <Button size="sm" disabled={locked} onClick={() => toggle(cursor)}>{t.shadeSquare}</Button>
    </>}
    tableNode={<DataTable caption={t.areaCaption} head={[t.colRow, t.colShaded]}
      rows={perRow.map((row) => [fill(t.rowName, { n: row.y + 1 }), String(row.count)])} foot={[t.total, String(shaded.length)]} />} />;
}

export default function AreaSquaresBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.area-squares.v2') return null;
  return <AreaSquares segment={segment} {...rest} />;
}
