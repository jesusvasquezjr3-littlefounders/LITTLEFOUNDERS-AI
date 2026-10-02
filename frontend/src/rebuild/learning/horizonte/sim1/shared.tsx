import type { ReactNode } from 'react';
import { Button } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import type { Fraction } from './model.generated';

export const VIEW_W = 640;
export const PAD = 28;

export const fmt = (locale: Locale, value: number, digits = 1): string => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Object.is(value, -0) ? 0 : value);

export const slots = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole));

/** A share from 0 to 1 written as a percentage in the learner's own number format. */
export const percent = (locale: Locale, share: number, digits = 1): string => `${fmt(locale, share * 100, digits)}%`;

/** The chance as plain readable words and a percentage ("2 in 3 (66.7%)"), never as symbols a screen reader would spell out. */
export const chanceText = (template: string, locale: Locale, chance: Fraction): string =>
  slots(template, { a: fmt(locale, chance.num, 0), b: fmt(locale, chance.den, 0), p: percent(locale, chance.num / chance.den) });

/** The stop the run slider sits on: 0 is not started, 1 is the first stop. */
export const runCount = (stops: readonly number[], index: number): number => (index === 0 ? 0 : (stops[index - 1] as number));

const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50] as const;

/** Tick values from `min` in whole steps, as few as it takes to keep the labels apart. */
export function tickValues(min: number, max: number, limit: number): number[] {
  const step = TICK_STEPS.find((candidate) => Math.floor((max - min) / candidate) + 1 <= limit) ?? TICK_STEPS[TICK_STEPS.length - 1]!;
  const ticks: number[] = [];
  for (let value = min; value <= max; value += step) ticks.push(value);
  return ticks;
}

export const linePath = (points: ReadonlyArray<readonly [number, number]>): string =>
  points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

/** The run lengths a line is drawn at: every count up to `points`, then a geometric grid that always ends on `count`. */
export function traceIndices(count: number, points = 120): number[] {
  if (count <= points) return Array.from({ length: count }, (_, index) => index + 1);
  const picked = new Set<number>([1, count]);
  for (let step = 1; step < points - 1; step += 1) picked.add(Math.round(Math.exp((Math.log(count) * step) / (points - 1))));
  return [...picked].sort((a, b) => a - b);
}

export function Chart({ label, height, children }: { label: string; height: number; children: ReactNode }) {
  return <svg className="lf-sim-chart" viewBox={`0 0 ${VIEW_W} ${height}`} role="img" aria-label={label} focusable="false" data-copy-role="data">{children}</svg>;
}

export function TableToggle({ open, onToggle, show, hide }: { open: boolean; onToggle: () => void; show: string; hide: string }) {
  return <Button size="sm" aria-expanded={open} onClick={onToggle} data-hz-table-toggle="">{open ? hide : show}</Button>;
}

const SHARE_LEFT = 64;
const SHARE_TOP = 16;
const SHARE_H = 170;

/**
 * The running share of a seeded run on a log axis from one trial to the last stop, with the chance, the tolerance band around it
 * and the fewest trials marked. `hits[t]` is how many of the first t + 1 trials counted; only the first `count` are drawn.
 */
export function ShareChart({ label, locale, hits, count, chance, tolerance, floor, stops }: {
  label: string; locale: Locale; hits: ArrayLike<number>; count: number; chance: Fraction; tolerance: number; floor: number; stops: readonly number[];
}) {
  const right = VIEW_W - PAD;
  const base = SHARE_TOP + SHARE_H;
  const span = Math.log(stops[stops.length - 1] as number);
  const x = (trials: number) => SHARE_LEFT + (Math.log(Math.max(1, trials)) / span) * (right - SHARE_LEFT);
  const y = (share: number) => SHARE_TOP + (1 - share) * SHARE_H;
  const share = chance.num / chance.den;
  const points = traceIndices(count).map((trials) => [x(trials), y((hits[trials - 1] as number) / trials)] as const);
  const last = points[points.length - 1];
  let lastLabel = -Infinity;
  const labelled = stops.filter((stop) => { const at = x(stop); if (at - lastLabel < 58) return false; lastLabel = at; return true; });
  return <Chart label={label} height={base + 44}>
    <rect className="lf-sim-band" x={SHARE_LEFT} width={right - SHARE_LEFT} y={y(Math.min(1, share + tolerance / 100))} height={y(Math.max(0, share - tolerance / 100)) - y(Math.min(1, share + tolerance / 100))} />
    <g className="lf-sim-ticks">
      {[0, 0.5, 1].map((level) => <g key={level}>
        <line className="lf-sim-grid" x1={SHARE_LEFT} x2={right} y1={y(level)} y2={y(level)} />
        <text x={SHARE_LEFT - 8} y={y(level) + 7} textAnchor="end">{percent(locale, level, 0)}</text>
      </g>)}
      <line x1={SHARE_LEFT} x2={right} y1={base} y2={base} />
      {stops.map((stop) => <line key={stop} x1={x(stop)} x2={x(stop)} y1={base} y2={base + 8} />)}
      {labelled.map((stop) => <text key={stop} x={x(stop)} y={base + 32} textAnchor="middle">{fmt(locale, stop, 0)}</text>)}
    </g>
    <line className="lf-sim-chance" x1={SHARE_LEFT} x2={right} y1={y(share)} y2={y(share)} />
    <line className="lf-sim-floor" x1={x(floor)} x2={x(floor)} y1={SHARE_TOP} y2={base} />
    {points.length > 1 ? <path className="lf-sim-line" d={linePath(points)} /> : null}
    {last ? <circle className="lf-sim-now" cx={last[0]} cy={last[1]} r={6} /> : null}
  </Chart>;
}
