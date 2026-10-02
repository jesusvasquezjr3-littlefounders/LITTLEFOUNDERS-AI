import { useState } from 'react';
import { Slider } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { NumberAnswer, readNumberAnswer } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import {
  DIRECTION_OPTIONS, DOMAIN_X, ERROR_OPTIONS, GROWTH_OPTIONS, RIEMANN_N_MAX, SIGN_OPTIONS, SLOPE_MAX, areaOf, derivativeAt, derivativeCoeffs, evalPoly, riemannApprox, secantSlope, signOf,
  type AccumulationPayload, type DerivativeLinkPayload, type RiemannPayload, type SecantPayload,
} from './calculus.generated';
import { COM_COPY } from './copy';
import { Ask, ExPlano, ExplorerShell, choices, sampled, useExplorer, useMoved, yWindow, type Explorer, type KeyMove } from './explorerKit';
import { fill, fmt, word, type Words } from './format';
import { areaSoFar, integral, polynomial, slopeRule } from './notation';
import './explorer.css';

type CalculusSegment = Extract<HorizonteSegment, { type: 'calculus.explorer.v2' }>;
type Props = Omit<HorizonteBoardProps, 'segment'> & { segment: CalculusSegment };
interface Inner extends Props { t: Words }

/** A whole number the learner types. It only counts once it reads as a whole number inside the range Core accepts. */
function useTyped(explorer: Explorer, locale: Locale, range: readonly [number, number]) {
  const [text, setText] = useState('');
  const reading = readNumberAnswer(text, locale, { min: range[0], max: range[1] });
  const value = reading.canonical !== null && Number.isInteger(Number(reading.canonical)) ? Number(reading.canonical) : null;
  return { text, value, set: (next: string) => explorer.change(() => setText(next)), reset: () => setText('') };
}

const cubic = (coeffs: readonly number[]) => (x: number): number => evalPoly(coeffs, x);

/* ── secant to tangent: shrink the gap and the secant's slope settles on one number ── */

/** The gaps the learner steps through, smallest first. */
const GAPS = [0.01, 0.1, 0.5, 1, 2] as const;
const WIDEST = GAPS.length - 1;
const nearestGap = (h: number): number => GAPS.reduce((best, gap, index) => (Math.abs(gap - h) < Math.abs(GAPS[best]! - h) ? index : best), 0);

function Secant({ document, segment, onBack, sequence, onGrade, t }: Inner) {
  const p = segment.payload as SecantPayload;
  const { locale } = document;
  const explorer = useExplorer(segment.id, onGrade);
  const typed = useTyped(explorer, locale, [-SLOPE_MAX, SLOPE_MAX]);
  const [index, setIndex] = useState(WIDEST);
  const gap = (next: number) => explorer.change(() => setIndex(Math.min(WIDEST, Math.max(0, next))));
  const h = GAPS[index]!;
  const f = cubic(p.coeffs);
  const slope = secantSlope(p.coeffs, p.a, h);
  const line = (x: number) => f(p.a) + slope * (x - p.a);
  const xMin = p.a - 3;
  const xMax = p.a + 3;
  const xs = sampled(xMin, xMax, 0.25);
  const { yMin, yMax } = yWindow([...xs.map(f), line(p.a - 1.5), line(p.a + 2.5)]);
  const poly = polynomial(t, p.coeffs);
  const move = (key: KeyMove) => gap(key === 'next' ? index + 1 : key === 'previous' ? index - 1 : key === 'first' ? 0 : WIDEST);
  return <ExplorerShell screen="secant" document={document} segment={segment} onBack={onBack} sequence={sequence} t={t} explorer={explorer}
    predict={{ legend: t.legendSecant, options: choices(t, SIGN_OPTIONS) }}
    changed={explorer.predict !== null || index !== WIDEST || typed.text !== ''} ready={typed.value !== null} need={t.needNumber}
    named={{ met: t.metSecant, hint: t.hintSecant }} heading={t.headingExplore}
    onReset={() => { explorer.clear(); setIndex(WIDEST); typed.reset(); }} onCheck={() => explorer.grading.check({ predict: explorer.predict, value: typed.value })}
    ask={<Ask locale={locale} lead={t.askSlope} math={poly} tail={fill(t.atX, { a: p.a })} />}
    figure={<ExPlano locale={locale} label={t.figureSecant} summary={t.summarySecant} domain={{ xMin, xMax, yMin, yMax }} size={{ width: 720, height: 380 }}
      xLabel="x" yLabel="f" placeOnTap
      layers={{
        curves: [{ id: 'curve', fn: f, from: xMin, to: xMax, samples: 120, series: 1 }],
        polylines: [{ id: 'secant', points: [{ x: p.a - 1.5, y: line(p.a - 1.5) }, { x: p.a + 2.5, y: line(p.a + 2.5) }], series: 2 }],
        points: [{ id: 'at', x: p.a, y: f(p.a), series: 'neutral' }],
        handles: [{ id: 'gap', x: p.a + h, y: f(p.a + h), label: t.handleGap, caption: fmt(locale, h), series: 2, axis: 'x', bounds: { xMin: p.a + GAPS[0], xMax: p.a + GAPS[WIDEST]! }, disabled: explorer.locked }],
      }}
      onHandleChange={(_, point) => gap(nearestGap(point.x - p.a))} onKey={move} />}
    status={fill(t.statusSecant, { f: poly.plain, a: p.a, gap: fmt(locale, h), slope: fmt(locale, slope, 3) })}
    table={{
      caption: t.tableSecant, head: [t.colGap, t.colSlope],
      rows: [...GAPS].reverse().map((value) => [fmt(locale, value), fmt(locale, secantSlope(p.coeffs, p.a, value), 3)]),
    }}
    controls={<>
      <Slider label={t.sliderGap} valueText={fmt(locale, h)} min={0} max={WIDEST} step={1} value={index} onValueChange={gap}
        stepLabels={{ decrease: t.smaller, increase: t.bigger }} disabled={explorer.locked} />
      <NumberAnswer label={t.labelSlope} locale={locale} value={typed.text} onTextChange={typed.set} min={-SLOPE_MAX} max={SLOPE_MAX} disabled={explorer.locked} />
    </>} />;
}

/* ── f and f' linked: the flat spots of the curve are where the slope graph crosses zero ── */

function DerivativeLink({ document, segment, onBack, sequence, onGrade, t }: Inner) {
  const p = segment.payload as DerivativeLinkPayload;
  const { locale } = document;
  const explorer = useExplorer(segment.id, onGrade);
  const moved = useMoved(0, explorer);
  const x = moved.value;
  const f = cubic(derivativeCoeffs(p));
  const df = (at: number) => derivativeAt(p, at);
  const xs = sampled(-DOMAIN_X, DOMAIN_X, 0.25);
  const fWindow = yWindow(xs.map(f));
  const dWindow = yWindow(xs.map(df), true);
  const rule = slopeRule(t, p.lead, p.roots);
  const rate = signOf(df(x));
  const rows = sampled(-DOMAIN_X, DOMAIN_X, 1);
  return <ExplorerShell screen="derivative-link" document={document} segment={segment} onBack={onBack} sequence={sequence} t={t} explorer={explorer}
    predict={{ legend: t.legendLink, options: choices(t, DIRECTION_OPTIONS) }}
    changed={explorer.predict !== null || moved.touched} ready={moved.touched} need={t.needMark}
    named={{ met: t.metLink, hint: t.hintLink }} heading={t.headingExplore}
    onReset={() => { explorer.clear(); moved.reset(); }} onCheck={() => explorer.grading.check({ predict: explorer.predict, value: x })}
    ask={<Ask locale={locale} lead={word(t, `askLink:${p.ask}`)} math={rule} />}
    figure={<div className="lf-ex-figures lf-ex-figures--stack">
      <ExPlano locale={locale} label={t.figureCurve} summary={t.summaryCurve} domain={{ xMin: -DOMAIN_X, xMax: DOMAIN_X, ...fWindow }} size={{ width: 720, height: 300 }}
        xLabel="x" yLabel="f" snap={{ x: 1, y: 0 }} tickStep={{ x: 1, y: 0 }} placeOnTap
        layers={{
          curves: [{ id: 'curve', fn: f, samples: 160, series: 1 }],
          handles: [{ id: 'mark', x, y: f(x), label: t.handleMark, caption: String(x), series: 1, axis: 'x', disabled: explorer.locked }],
        }}
        onHandleChange={(_, point) => moved.set(Math.round(point.x))} />
      <ExPlano locale={locale} label={t.figureSlope} summary={t.summarySlope} domain={{ xMin: -DOMAIN_X, xMax: DOMAIN_X, ...dWindow }} size={{ width: 720, height: 240 }}
        xLabel="x" yLabel="f'" tickStep={{ x: 1, y: 0 }}
        layers={{
          curves: [{ id: 'slope', fn: df, samples: 160, series: 2 }],
          points: [{ id: 'now', x, y: df(x), series: 2 }],
        }} />
    </div>}
    status={fill(t.statusLink, { rule: rule.plain, x, f: fmt(locale, f(x)), slope: word(t, `sign:${rate > 0 ? 'positive' : rate < 0 ? 'negative' : 'zero'}`) })}
    table={{
      caption: t.tableLink, head: [t.colX, t.colF, t.colSlope],
      rows: rows.map((at) => [String(at), fmt(locale, f(at)), fmt(locale, df(at))]),
    }}
    controls={<Slider label={t.sliderX} valueText={String(x)} min={-DOMAIN_X} max={DOMAIN_X} step={1} value={x} onValueChange={moved.set}
      stepLabels={{ decrease: t.left, increase: t.right }} disabled={explorer.locked} />} />;
}

/* ── Riemann sums: more rectangles, a smaller gap, until the estimate is close enough ── */

function slicesOf(p: RiemannPayload, n: number): { x: number; y: number }[][] {
  const f = cubic(p.coeffs);
  const h = (p.to - p.from) / n;
  return Array.from({ length: n }, (_, i) => {
    const x0 = p.from + i * h;
    const x1 = x0 + h;
    if (p.method === 'trapezoid') return [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: f(x1) }, { x: x0, y: f(x0) }];
    const top = f(p.method === 'left' ? x0 : p.method === 'right' ? x1 : (x0 + x1) / 2);
    return [{ x: x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: top }, { x: x0, y: top }];
  });
}

function Riemann({ document, segment, onBack, sequence, onGrade, t }: Inner) {
  const p = segment.payload as RiemannPayload;
  const { locale } = document;
  const explorer = useExplorer(segment.id, onGrade);
  const moved = useMoved(1, explorer);
  const n = moved.value;
  const f = cubic(p.coeffs);
  const area = areaOf(p.coeffs, p.from, p.to);
  const estimate = riemannApprox(p, n);
  const gap = estimate - area;
  const within = Math.abs(gap) <= p.tolerance;
  const { yMin, yMax } = yWindow(sampled(p.from, p.to, 0.25).map(f), true);
  const poly = polynomial(t, p.coeffs);
  return <ExplorerShell screen="riemann" document={document} segment={segment} onBack={onBack} sequence={sequence} t={t} explorer={explorer}
    predict={{ legend: t.legendRiemann, options: choices(t, ERROR_OPTIONS) }}
    changed={explorer.predict !== null || moved.touched} ready={moved.touched} need={t.needN}
    named={{ met: t.metRiemann, hint: t.hintRiemann }} heading={t.headingExplore}
    onReset={() => { explorer.clear(); moved.reset(); }} onCheck={() => explorer.grading.check({ predict: explorer.predict, value: n })}
    ask={<Ask locale={locale} lead={fill(t.askRiemann, { tol: fmt(locale, p.tolerance) })} math={integral(t, p.from, p.to)} tail={word(t, `method:${p.method}`)} />}
    figure={<ExPlano locale={locale} label={t.figureRiemann} summary={t.summaryRiemann} domain={{ xMin: p.from - 1, xMax: p.to + 1, yMin, yMax }} size={{ width: 720, height: 380 }}
      xLabel="x" yLabel="f"
      layers={{
        regions: slicesOf(p, n).map((points, i) => ({ id: `slice-${i}`, points, series: 2 as const })),
        curves: [{ id: 'curve', fn: f, from: p.from, to: p.to, samples: 120, series: 1 }],
      }} />}
    status={fill(t.statusRiemann, {
      f: poly.plain, n, estimate: fmt(locale, estimate), area: fmt(locale, area), gap: fmt(locale, gap),
      state: fill(within ? t.within : t.outside, { tol: fmt(locale, p.tolerance) }),
    })}
    table={{
      caption: t.tableRiemann, head: [t.colWhat, t.colN, t.colEstimate, t.colGap],
      rows: [[t.rowNow, String(n), fmt(locale, estimate), fmt(locale, gap)], [t.rowExact, t.none, fmt(locale, area), '0']],
    }}
    controls={<Slider label={t.sliderN} valueText={String(n)} min={1} max={RIEMANN_N_MAX} step={1} value={n} onValueChange={moved.set}
      stepLabels={{ decrease: t.less, increase: t.more }} disabled={explorer.locked} />} />;
}

/* ── the fundamental theorem: the area so far grows as fast as the curve is tall ── */

function Accumulation({ document, segment, onBack, sequence, onGrade, t }: Inner) {
  const p = segment.payload as AccumulationPayload;
  const { locale } = document;
  const explorer = useExplorer(segment.id, onGrade);
  const moved = useMoved(p.from, explorer);
  const x = moved.value;
  const f = cubic(p.coeffs);
  const total = (at: number) => areaOf(p.coeffs, p.from, at);
  const xs = sampled(p.from, p.to, 0.25);
  const fWindow = yWindow(xs.map(f), true);
  const aWindow = yWindow([...xs.map(total), p.target, 0]);
  const rate = signOf(f(x));
  const poly = polynomial(t, p.coeffs);
  const domain = { xMin: p.from, xMax: p.to };
  return <ExplorerShell screen="accumulation" document={document} segment={segment} onBack={onBack} sequence={sequence} t={t} explorer={explorer}
    predict={{ legend: t.legendArea, options: choices(t, GROWTH_OPTIONS) }}
    changed={explorer.predict !== null || moved.touched} ready={moved.touched} need={t.needMark}
    named={{ met: t.metArea, hint: t.hintArea }} heading={t.headingExplore}
    onReset={() => { explorer.clear(); moved.reset(); }} onCheck={() => explorer.grading.check({ predict: explorer.predict, value: x })}
    ask={<Ask locale={locale} lead={t.askArea} math={areaSoFar(t, p.from, p.target)} />}
    figure={<div className="lf-ex-figures lf-ex-figures--stack">
      <ExPlano locale={locale} label={t.figureRate} summary={t.summaryRate} domain={{ ...domain, ...fWindow }} size={{ width: 720, height: 260 }} xLabel="x" yLabel="f"
        layers={{
          regions: x > p.from ? [{ id: 'area', between: { upper: f, lower: 0, from: p.from, to: x, samples: 80 }, series: 2 }] : [],
          curves: [{ id: 'rate', fn: f, samples: 120, series: 1 }],
          points: [{ id: 'now', x, y: f(x), series: 1 }],
        }} />
      <ExPlano locale={locale} label={t.figureTotal} summary={t.summaryTotal} domain={{ ...domain, ...aWindow }} size={{ width: 720, height: 300 }} xLabel="x" yLabel="A"
        snap={{ x: 1, y: 0 }} tickStep={{ x: 1, y: 0 }} placeOnTap
        layers={{
          curves: [{ id: 'total', fn: total, samples: 120, series: 1 }],
          polylines: [{ id: 'target', points: [{ x: p.from, y: p.target }, { x: p.to, y: p.target }], series: 2 }],
          handles: [{ id: 'mark', x, y: total(x), label: t.handleMark, caption: String(x), series: 1, axis: 'x', disabled: explorer.locked }],
        }}
        onHandleChange={(_, point) => moved.set(Math.round(point.x))} />
    </div>}
    status={fill(t.statusArea, { f: poly.plain, x, fx: fmt(locale, f(x)), area: fmt(locale, total(x)), target: p.target, rate: word(t, `rate:${rate > 0 ? 'growing' : rate < 0 ? 'shrinking' : 'flat'}`) })}
    table={{
      caption: t.tableArea, head: [t.colX, t.colRateF, t.colArea],
      rows: sampled(p.from, p.to, 1).map((at) => [String(at), fmt(locale, f(at)), fmt(locale, total(at))]),
    }}
    controls={<Slider label={t.sliderX} valueText={String(x)} min={p.from} max={p.to} step={1} value={x} onValueChange={moved.set}
      stepLabels={{ decrease: t.left, increase: t.right }} disabled={explorer.locked} />} />;
}

export default function CalculusBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'calculus.explorer.v2') return null;
  const t = copyText(COM_COPY, rest.document.locale);
  switch (segment.visual.type) {
    case 'secant': return <Secant segment={segment} t={t} {...rest} />;
    case 'derivative-link': return <DerivativeLink segment={segment} t={t} {...rest} />;
    case 'riemann': return <Riemann segment={segment} t={t} {...rest} />;
    default: return <Accumulation segment={segment} t={t} {...rest} />;
  }
}
