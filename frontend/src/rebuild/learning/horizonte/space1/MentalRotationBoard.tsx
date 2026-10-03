import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { readRotationPayload, type RotationPayload } from './rotationRules.generated';
import { VoxelFigure } from './VoxelFigure';
import { axisNote, cellsText, fill, space1Text, targetId, targetLetter } from './space1Text';
import { ANGLES, isAngle, turnFigure, type Angle, type TargetId } from './voxels.generated';
import { TableScroll } from './TableScroll';
import '../horizonte.css';
import './space1.css';

type RotationSegment = Extract<HorizonteSegment, { type: 'geometry.mental-rotation.v2' }>;

const LAST: Angle = 270;
const clampAngle = (value: number): Angle => (isAngle(value) ? value : value <= 0 ? 0 : LAST);

/** The turn a pointer at (x, y) asks for, relative to the dial's centre: 0 at the top, clockwise, snapped to the four stops. */
function angleAt(rect: DOMRect, x: number, y: number): Angle | null {
  if (rect.width === 0 || rect.height === 0) return null;
  const degrees = (Math.atan2(x - (rect.left + rect.width / 2), -(y - (rect.top + rect.height / 2))) * 180) / Math.PI;
  return clampAngle((((Math.round(degrees / 90) * 90) % 360) + 360) % 360);
}

const RING = 33;
const place = (angle: Angle): CSSProperties => {
  const radians = (angle * Math.PI) / 180;
  return { '--x': `${50 + RING * Math.sin(radians)}%`, '--y': `${50 - RING * Math.cos(radians)}%` } as CSSProperties;
};

/*
 * F4.4: a figure of cubes turns about one named axis through four stops (90 degrees each). The learner sets the turn on a dial
 * (drag, arrow keys, or "Move to") and the figure is redrawn at that angle; the task is to pick the shape it becomes and to give
 * the turn. The answer is the shape and the angle; Core holds the key, the browser never says met.
 */
function MentalRotation({ document, segment, payload, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: RotationSegment; payload: RotationPayload }) {
  const locale = document.locale;
  const t = space1Text(locale);
  const { axis, figure, targets } = payload;
  const [angle, setAngle] = useState<Angle>(0);
  const [pick, setPick] = useState<'' | TargetId>('');
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const dial = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const turned = useMemo(() => turnFigure(figure, axis, angle / 90), [figure, axis, angle]);
  const changed = angle !== 0 || pick !== '';

  const turn = (next: Angle) => { if (next !== angle) { grading.reset(); setAngle(next); } };
  const choose = (id: TargetId) => { grading.reset(); setPick((current) => (current === id ? '' : id)); };
  const reset = () => { grading.reset(); setAngle(0); setPick(''); };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (locked || event.altKey || event.ctrlKey || event.metaKey) return;
    const next = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? clampAngle(angle + 90)
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? clampAngle(angle - 90)
        : event.key === 'Home' ? 0 : event.key === 'End' ? LAST : null;
    if (next === null) return;
    event.preventDefault();
    turn(next);
  };
  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const rect = dial.current?.getBoundingClientRect();
    const next = rect ? angleAt(rect, event.clientX, event.clientY) : null;
    if (next !== null) turn(next);
  };

  const dialValue = fill(t.rotDialValue, { n: angle });
  const picked = fill(t.rotPicked, { id: pick === '' ? t.rotNone : targetLetter(pick) });
  const shapeLabel = (index: number) => fill(t.rotShapeLabel, { id: targetLetter(targetId(index)), n: targets[index]!.length });

  return <BoardShell screen="mental-rotation" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={pick !== '' && angle > 0 && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metRotation, hint: t.hintRotation }} onCheck={() => grading.check({ pick, angle })} />}>
    <section className="lf-learning-board lf-rot" aria-label={t.rotHeading}>
      <div className="lf-rot-stage">
        <VoxelFigure cells={turned} axis={axis} className="lf-vox" label={fill(t.rotFigureLabel, { angle, n: turned.length })} />
      </div>
      <p data-copy-role="body">{axisNote(t, axis)}</p>
      <p className="lf-rot-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{fill(t.rotStatus, { angle, picked })}</p>
      {table ? <>
        <TableScroll label={t.rotTableCaption}><table className="lf-hz-table" data-hz-table="">
          <caption data-copy-role="heading">{t.rotTableCaption}</caption>
          <thead><tr>
            <th scope="col" data-copy-role="data">{t.rotColShape}</th><th scope="col" data-copy-role="data">{t.rotColCubes}</th>
            <th scope="col" data-copy-role="data">{t.rotColPlaces}</th>
          </tr></thead>
          <tbody>
            <tr><th scope="row" data-copy-role="data">{t.rotFigureRow}</th><td data-copy-role="data">{figure.length}</td><td data-copy-role="data">{cellsText(figure)}</td></tr>
            <tr><th scope="row" data-copy-role="data">{t.rotTurnedRow}</th><td data-copy-role="data">{turned.length}</td><td data-copy-role="data">{cellsText(turned)}</td></tr>
            {targets.map((cells, index) => <tr key={targetId(index)}>
              <th scope="row" data-copy-role="data">{fill(t.rotShapeName, { id: targetLetter(targetId(index)) })}</th>
              <td data-copy-role="data">{cells.length}</td><td data-copy-role="data">{cellsText(cells)}</td>
            </tr>)}
          </tbody>
        </table></TableScroll>
        <p data-copy-role="body">{t.rotCoords}</p>
      </> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.rotDialHeading}>
      <h2 data-copy-role="heading">{t.rotDialHeading}</h2>
      <div className="lf-rot-dial" ref={dial} data-angle={angle}
        onPointerDown={(event) => { if (locked) return; dragging.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); follow(event); }}
        onPointerMove={(event) => { if (dragging.current) follow(event); }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
        <svg className="lf-rot-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle className="lf-rot-track" cx="50" cy="50" r={RING} />
          {ANGLES.map((stop) => <circle key={stop} className="lf-rot-stop" data-on={stop <= angle ? 'true' : 'false'} cx={50 + RING * Math.sin((stop * Math.PI) / 180)} cy={50 - RING * Math.cos((stop * Math.PI) / 180)} r="3" />)}
        </svg>
        <span className="lf-hz-handle lf-rot-handle" data-hz-handle="" data-hz-hit="64" style={place(angle)}>
          <span role="slider" tabIndex={0} className="lf-rot-knob" aria-label={t.rotDialLabel} aria-valuemin={0} aria-valuemax={LAST} aria-valuenow={angle}
            aria-valuetext={dialValue} aria-disabled={locked} onKeyDown={onKeyDown} />
        </span>
        <span className="lf-rot-value" data-copy-role="data" aria-hidden="true">{dialValue}</span>
      </div>
      <p data-copy-role="body">{t.rotDialKeys}</p>
      <MoveToChoice locale={locale} item={{ label: t.rotDialLabel }} disabled={locked}
        options={ANGLES.map((stop) => ({ value: String(stop), label: fill(t.rotDialValue, { n: stop }) }))}
        onChange={(value) => turn(clampAngle(Number(value)))} />
    </section>
    <section className="lf-learning-control-strip" aria-label={t.rotTargetsHeading}>
      <h2 data-copy-role="heading">{t.rotTargetsHeading}</h2>
      <div className="lf-rot-targets">
        {targets.map((cells, index) => {
          const id = targetId(index);
          return <ChoiceChip key={id} selected={pick === id} onToggle={() => { if (!locked) choose(id); }} disabled={locked}>
            <VoxelFigure cells={cells} className="lf-vox lf-rot-target" />
            <b aria-hidden="true">{targetLetter(id)}</b>
            <span className="lf-sp-sr">{shapeLabel(index)}</span>
          </ChoiceChip>;
        })}
      </div>
    </section>
  </BoardShell>;
}

export default function MentalRotationBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'geometry.mental-rotation.v2') return null;
  const payload = readRotationPayload(segment.payload);
  return payload ? <MentalRotation segment={segment} payload={payload} {...rest} /> : null;
}
