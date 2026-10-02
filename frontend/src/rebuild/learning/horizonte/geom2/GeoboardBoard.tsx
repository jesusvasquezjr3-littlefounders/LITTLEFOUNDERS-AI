import { useState } from 'react';
import { Button } from '../../../design/controls';
import { useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { Plano } from '../plano/Plano';
import type { PlanoPointLayer } from '../plano/model';
import { DataTable, GeomFrame, clampTo, fill, type Cell } from './boardKit';
import { GEOM2_COPY } from './copy';
import { readBand } from './geoboardModel.generated';
import { isSimplePolygon } from './geometry.generated';

type GeoboardSegment = Extract<HorizonteSegment, { type: 'math.geoboard.v2' }>;

const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

/* F2.7 geoboard: pegs on a square lattice and one rubber band. The band is the pegs the learner picked, in order. */
function Geoboard({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: GeoboardSegment }) {
  const { size } = segment.payload;
  const t = copyText(GEOM2_COPY, document.locale);
  const [band, setBand] = useState<Cell[]>([]);
  const [cursor, setCursor] = useState<Cell>({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const top = size - 1;

  const nearest = (point: Cell): Cell => ({ x: clampTo(Math.round(point.x), 0, top), y: clampTo(Math.round(point.y), 0, top) });
  const edit = (next: Cell[]) => { grading.reset(); setBand(next); };
  const toggle = (at: Cell) => {
    if (locked) return;
    setCursor(at);
    edit(band.some((peg) => same(peg, at)) ? band.filter((peg) => !same(peg, at)) : [...band, at]);
  };
  const reset = () => { grading.reset(); setBand([]); setCursor({ x: 0, y: 0 }); };

  const pegs: PlanoPointLayer[] = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (!band.some((peg) => same(peg, { x, y }))) pegs.push({ id: `peg-${x}-${y}`, x, y, series: 'neutral' });
  const placed: PlanoPointLayer[] = band.map((peg, index) => ({ id: `band-${index}`, x: peg.x, y: peg.y, label: String(index + 1), series: 1 }));
  const crossed = band.length > 2 && !isSimplePolygon(band);
  const problem = band.length === 0 ? '' : band.length < 3 ? t.geoNeed : crossed ? t.geoCross : '';
  const status = [fill(t.geoFacts, { size, count: band.length, x: cursor.x, y: cursor.y }), problem].filter(Boolean).join(' ');

  return <GeomFrame screen="geoboard" document={document} segment={segment} onBack={onBack} sequence={sequence} grading={grading}
    canCheck={readBand({ points: band }, size)?.kind === 'band'} answer={{ points: band }} named={{ met: t.metGeo, hint: t.hintGeo }} changed={band.length > 0}
    onReset={reset} table={{ open, toggle: () => setOpen((now) => !now) }} label={t.geoLabel} status={status} hint={t.geoHint}
    onAct={() => toggle(cursor)}
    board={<Plano label={t.geoLabel} domain={{ xMin: -0.5, xMax: size - 0.5, yMin: -0.5, yMax: size - 0.5 }} size={{ width: 400, height: 400 }}
      snap={1} tickStep={1} xLabel={t.colX} yLabel={t.colY} tableToggle={false}
      layers={{
        points: [...pegs, ...placed],
        polylines: band.length > 1 ? [{ id: 'band', points: band.length > 2 ? [...band, band[0]!] : band, series: 1 }] : [],
        regions: band.length > 2 && !crossed ? [{ id: 'inside', points: band, series: 1 }] : [],
        handles: [{ id: 'cursor', x: cursor.x, y: cursor.y, label: t.geoCursor, disabled: locked, bounds: { xMin: 0, xMax: top, yMin: 0, yMax: top } }],
      }}
      onHandleChange={(_id, point) => setCursor(nearest(point))}
      onPlaneTap={(point) => toggle(nearest(point))} />}
    actions={<>
      <Button size="sm" disabled={locked} onClick={() => toggle(cursor)}>{t.placePeg}</Button>
      <Button size="sm" disabled={locked || band.length === 0} onClick={() => edit(band.slice(0, -1))}>{t.undo}</Button>
    </>}
    tableNode={<DataTable caption={t.geoCaption} head={[t.colPeg, t.colX, t.colY]}
      rows={band.map((peg, index) => [fill(t.pegName, { n: index + 1 }), String(peg.x), String(peg.y)])} />} />;
}

export default function GeoboardBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'math.geoboard.v2') return null;
  return <Geoboard segment={segment} {...rest} />;
}
