import { Slider } from '../../../design/controls';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { COM_COPY } from './copy';
import { Ask, ExPlano, ExplorerShell, choices, sampled, useExplorer, useMoved, type KeyMove } from './explorerKit';
import { fill, fmt, word, type Words } from './format';
import { fnName, trigEquation } from './notation';
import {
  QUADRANT_OPTIONS, TIMES_OPTIONS, levelValue, quadrantOf, trigAt, trigSlope, type CircleWavePayload, type UnitCirclePayload,
} from './trig.generated';
import './explorer.css';

type TrigSegment = Extract<HorizonteSegment, { type: 'trig.unit-circle.v2' }>;
type Props = Omit<HorizonteBoardProps, 'segment'> & { segment: TrigSegment };
interface Inner extends Props { t: Words }

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const spot = (degrees: number) => ({ x: Math.cos(radians(degrees)), y: Math.sin(radians(degrees)) });
const RING = sampled(0, 360, 5).map(spot);
const wrap = (degrees: number): number => ((degrees % 360) + 360) % 360;
/** The angle a point on or near the circle stands for, to the nearest step. */
const angleOf = (point: { x: number; y: number }, step: number): number => wrap(Math.round(((Math.atan2(point.y, point.x) * 180) / Math.PI) / step) * step);

/** Where one arrow, Home or End takes an angle, in whole steps. */
const turned = (angle: number, step: number, move: KeyMove): number => (move === 'next' ? wrap(angle + step) : move === 'previous' ? wrap(angle - step) : move === 'first' ? 0 : 360 - step);

/* ── unit circle: a point that stays on the circle, until the asked function reaches the asked value ── */

function UnitCircle({ document, segment, onBack, sequence, onGrade, t }: Inner) {
  const payload = segment.payload as UnitCirclePayload;
  const { locale } = document;
  const explorer = useExplorer(segment.id, onGrade);
  const moved = useMoved(payload.start, explorer);
  const angle = moved.value;
  const here = spot(angle);
  const goal = levelValue(payload.level, payload.sign);
  const cos = trigAt('cos', angle);
  const sin = trigAt('sin', angle);
  const cosGoal = payload.ask === 'cos';
  const equation = trigEquation(t, payload.ask, payload.level, payload.sign);
  return <ExplorerShell screen="unit-circle" document={document} segment={segment} onBack={onBack} sequence={sequence} t={t} explorer={explorer}
    predict={{ legend: t.legendCircle, options: choices(t, QUADRANT_OPTIONS) }}
    changed={explorer.predict !== null || moved.touched} ready={moved.touched} need={t.needAngle}
    named={{ met: t.metCircle, hint: t.hintCircle }} heading={t.headingExplore}
    onReset={() => { explorer.clear(); moved.reset(); }} onCheck={() => explorer.grading.check({ predict: explorer.predict, value: angle })}
    ask={<Ask locale={locale} lead={t.findAngle} math={equation} tail={payload.side ? word(t, `side:${payload.side}`) : null} />}
    figure={<ExPlano locale={locale} className="lf-ex-figure--circle" label={t.figureCircle} summary={t.summaryCircle}
      domain={{ xMin: -1.4, xMax: 1.4, yMin: -1.4, yMax: 1.4 }} size={{ width: 420, height: 420 }} xLabel="x" yLabel="y" tickStep={0.5} placeOnTap
      layers={{
        polylines: [
          { id: 'ring', points: RING, series: 'neutral' },
          { id: 'goal', points: cosGoal ? [{ x: goal, y: -1.25 }, { x: goal, y: 1.25 }] : [{ x: -1.25, y: goal }, { x: 1.25, y: goal }], series: 2 },
          { id: 'drop', points: cosGoal ? [here, { x: here.x, y: 0 }] : [here, { x: 0, y: here.y }], series: 'neutral' },
          { id: 'radius', points: [{ x: 0, y: 0 }, here], series: 1 },
        ],
        handles: [{ id: 'angle', x: here.x, y: here.y, label: t.handleAngle, caption: `${angle}°`, series: 1, disabled: explorer.locked }],
      }}
      onHandleChange={(_, point) => moved.set(angleOf(point, payload.step))} onKey={(move) => moved.set(turned(angle, payload.step, move))} />}
    status={fill(t.statusCircle, { angle, cos: fmt(locale, cos), sin: fmt(locale, sin), where: word(t, `opt:${quadrantOf(angle)}`) })}
    table={{
      caption: t.tableCircle, head: [t.colWhat, t.colAngle, t.colCos, t.colSin],
      rows: [[t.rowNow, `${angle}°`, fmt(locale, cos), fmt(locale, sin)], [t.rowGoal, t.unknown, cosGoal ? fmt(locale, goal) : t.unknown, cosGoal ? t.unknown : fmt(locale, goal)]],
    }}
    controls={<Slider label={t.sliderAngle} valueText={`${angle}°`} min={0} max={360 - payload.step} step={payload.step} value={angle}
      onValueChange={moved.set} stepLabels={{ decrease: t.less, increase: t.more }} disabled={explorer.locked} />} />;
}

/* ── circle to wave: the same angle on the circle and on the wave it unrolls into ── */

function CircleWave({ document, segment, onBack, sequence, onGrade, t }: Inner) {
  const payload = segment.payload as CircleWavePayload;
  const { locale } = document;
  const explorer = useExplorer(segment.id, onGrade);
  const moved = useMoved(payload.start, explorer);
  const angle = moved.value;
  const here = spot(angle);
  const value = trigAt(payload.fn, angle);
  const goal = levelValue(payload.level, payload.sign);
  const slope = trigSlope(payload.fn, angle);
  const cosFn = payload.fn === 'cos';
  const equation = trigEquation(t, payload.fn, payload.level, payload.sign);
  const direction = Math.abs(slope) < 1e-9 ? 'level' : slope > 0 ? 'rising' : 'falling';
  const top = 360 - payload.step;
  return <ExplorerShell screen="circle-wave" document={document} segment={segment} onBack={onBack} sequence={sequence} t={t} explorer={explorer}
    predict={{ legend: t.legendWave, options: choices(t, TIMES_OPTIONS) }}
    changed={explorer.predict !== null || moved.touched} ready={moved.touched} need={t.needAngle}
    named={{ met: t.metWave, hint: t.hintWave }} heading={t.headingExplore}
    onReset={() => { explorer.clear(); moved.reset(); }} onCheck={() => explorer.grading.check({ predict: explorer.predict, value: angle })}
    ask={<Ask locale={locale} lead={t.findAngle} math={equation} tail={payload.slope ? word(t, `slope:${payload.slope}`) : null} />}
    figure={<div className="lf-ex-figures lf-ex-figures--circle-wave">
      <ExPlano locale={locale} className="lf-ex-figure--circle" label={t.figureRing}
        domain={{ xMin: -1.4, xMax: 1.4, yMin: -1.4, yMax: 1.4 }} size={{ width: 420, height: 420 }} xLabel="x" yLabel="y" tickStep={0.5}
        layers={{
          polylines: [
            { id: 'ring', points: RING, series: 'neutral' },
            { id: 'goal', points: cosFn ? [{ x: goal, y: -1.25 }, { x: goal, y: 1.25 }] : [{ x: -1.25, y: goal }, { x: 1.25, y: goal }], series: 2 },
            { id: 'radius', points: [{ x: 0, y: 0 }, here], series: 1 },
          ],
          points: [{ id: 'now', x: here.x, y: here.y, series: 1 }],
        }} />
      <ExPlano locale={locale} label={t.figureWave} summary={t.summaryWave}
        domain={{ xMin: 0, xMax: 360, yMin: -1.3, yMax: 1.3 }} size={{ width: 720, height: 300 }} xLabel="θ°" yLabel={fnName(t, payload.fn)} tickStep={{ x: 90, y: 0.5 }}
        snap={{ x: payload.step, y: 0 }} placeOnTap
        layers={{
          curves: [{ id: 'wave', fn: (x) => trigAt(payload.fn, x), from: 0, to: 360, samples: 120, series: 1 }],
          polylines: [{ id: 'goal', points: [{ x: 0, y: goal }, { x: 360, y: goal }], series: 2 }],
          handles: [{ id: 'angle', x: angle, y: value, label: t.handleAngle, caption: `${angle}°`, series: 1, axis: 'x', bounds: { xMin: 0, xMax: top }, disabled: explorer.locked }],
        }}
        onHandleChange={(_, point) => moved.set(Math.min(top, Math.max(0, Math.round(point.x / payload.step) * payload.step)))} />
    </div>}
    status={fill(t.statusWave, { angle, fn: fnName(t, payload.fn), value: fmt(locale, value), direction: word(t, `dir:${direction}`) })}
    table={{
      caption: t.tableWave, head: [t.colWhat, t.colAngle, fnName(t, payload.fn)],
      rows: [[t.rowNow, `${angle}°`, fmt(locale, value)], [t.rowGoal, t.unknown, fmt(locale, goal)]],
    }}
    controls={<Slider label={t.sliderAngle} valueText={`${angle}°`} min={0} max={top} step={payload.step} value={angle}
      onValueChange={moved.set} stepLabels={{ decrease: t.less, increase: t.more }} disabled={explorer.locked} />} />;
}

export default function TrigBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'trig.unit-circle.v2') return null;
  const t = copyText(COM_COPY, rest.document.locale);
  return segment.visual.type === 'unit-circle' ? <UnitCircle segment={segment} t={t} {...rest} /> : <CircleWave segment={segment} t={t} {...rest} />;
}
