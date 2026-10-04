import { useMemo, useState } from 'react';
import { SegmentedControl, Stepper } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { Plano, type PlanoPoint } from '../plano';
import { ALG2_COPY } from './copy';
import { liesOn, lineText, pointKey, readSystemPayload, sameSpots, type ReadSystem } from './model.generated';
import { clipLine, fmt, slots } from './shared';
import '../horizonte.css';
import './alg2.css';

type SystemSegment = Extract<HorizonteSegment, { type: 'math.line-system.v2' }>;

/*
 * F2.5, D19: two or three lines on the Plano plane and a marker for each place where lines meet. One marker is the
 * handle at a time (a roving handle would break Plano's one-tab-stop rule); the marker control picks which one, and
 * the plane (drag, arrows, tap) and the across and up steppers move it. Markers stay on the grid and never share a
 * spot. The readout says how many lines each marker is on; Core holds the crossings and checks them exactly.
 */
function LineSystem({ document, segment, onBack, sequence, onGrade, system }: Omit<HorizonteBoardProps, 'segment'> & { segment: SystemSegment; system: ReadSystem }) {
  const locale = document.locale;
  const t = copyText(ALG2_COPY, locale);
  const { lines, window: plane, grid, start } = system;
  const [markers, setMarkers] = useState<PlanoPoint[]>(() => start.map((point) => ({ x: point.x, y: point.y })));
  const [selected, setSelected] = useState(0);
  const [refused, setRefused] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = !sameSpots(markers, start);
  const current = markers[selected]!;

  const move = (index: number, point: PlanoPoint) => {
    if (locked) return;
    const key = pointKey(point);
    if (markers.some((other, at) => at !== index && pointKey(other) === key)) { setRefused(true); return; }
    setRefused(false);
    grading.reset();
    setMarkers((all) => all.map((marker, at) => (at === index ? { x: point.x, y: point.y } : marker)));
  };
  const reset = () => { grading.reset(); setRefused(false); setMarkers(start.map((point) => ({ x: point.x, y: point.y }))); };

  const polylines = lines.flatMap((line, index) => {
    const ends = clipLine(line, plane);
    return ends.length === 2 ? [{ id: `line-${index}`, points: ends, label: lineText(line), series: ((index % 3) + 1) as 1 | 2 | 3 }] : [];
  });
  const others = markers.flatMap((marker, index) => (index === selected ? [] : [{ id: `marker-${index}`, x: marker.x, y: marker.y, label: String(index + 1), series: 'neutral' as const }]));
  const handle = { id: `marker-${selected}`, x: current.x, y: current.y, label: slots(t.markerName, { n: selected + 1 }), caption: String(selected + 1), series: 'neutral' as const, disabled: locked };

  return <BoardShell screen="line-system" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metSystem, hint: t.hintSystem }} onCheck={() => grading.check({ points: markers.map(({ x, y }) => ({ x, y })) })} />}>
    <section className="lf-learning-board lf-alg2" aria-label={t.systemName}>
      <Plano label={t.systemName} domain={plane} snap={grid} tickStep={grid} keyStep={grid} digits={2} xLabel="x" yLabel="y" placeOnTap
        layers={{ polylines, points: others, handles: [handle] }}
        onHandleChange={(id, point) => { if (id === handle.id) move(selected, point); }} />
      <ul className="lf-alg2-readout" aria-live="polite" data-hz-text-equivalent="">
        {markers.map((marker, index) => <li key={index} data-copy-role="data">
          {slots(t.markerReadout, { n: index + 1, x: fmt(locale, marker.x), y: fmt(locale, marker.y), k: lines.filter((line) => liesOn(line, marker)).length, m: lines.length })}
        </li>)}
      </ul>
      <p className="lf-alg2-note" role="status" data-copy-role="body">{refused ? t.occupied : ''}</p>
    </section>
    <section className="lf-learning-control-strip lf-alg2-markers" aria-label={t.markersLegend}>
      {markers.length > 1 ? <SegmentedControl legend={t.markersLegend} name={`${segment.id}-marker`} value={String(selected)}
        options={markers.map((_, index) => ({ value: String(index), label: slots(t.markerName, { n: index + 1 }) }))}
        onValueChange={(value) => { setRefused(false); setSelected(Number(value)); }} disabled={locked} /> : null}
      <Stepper label={t.across} valuePlacement="label" value={current.x} valueText={fmt(locale, current.x)} min={plane.xMin} max={plane.xMax} step={grid}
        onValueChange={(x) => move(selected, { x, y: current.y })} labels={{ decrease: t.less, increase: t.more }} disabled={locked} />
      <Stepper label={t.up} valuePlacement="label" value={current.y} valueText={fmt(locale, current.y)} min={plane.yMin} max={plane.yMax} step={grid}
        onValueChange={(y) => move(selected, { x: current.x, y })} labels={{ decrease: t.less, increase: t.more }} disabled={locked} />
    </section>
  </BoardShell>;
}

export default function LineSystemBoard({ segment, ...rest }: HorizonteBoardProps) {
  const system = useMemo(() => (segment.type === 'math.line-system.v2' ? readSystemPayload(segment.payload) : null), [segment]);
  return segment.type === 'math.line-system.v2' && system !== null && typeof system !== 'string' ? <LineSystem segment={segment} system={system} {...rest} /> : null;
}
