import type { ReactNode } from 'react';
import { Button } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';

export const VIEW_W = 640;
export const PAD = 28;

export const fmt = (locale: Locale, value: number, digits = 2): string => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Object.is(value, -0) ? 0 : value);

export const slots = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole));

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

export function Chart({ label, height, children }: { label: string; height: number; children: ReactNode }) {
  return <svg className="lf-stats-chart" viewBox={`0 0 ${VIEW_W} ${height}`} role="img" aria-label={label} focusable="false" data-copy-role="data">{children}</svg>;
}

export function AxisTicks({ ticks, x, y }: { ticks: readonly number[]; x: (value: number) => number; y: number }) {
  return <g className="lf-stats-ticks">
    <line x1={PAD} x2={VIEW_W - PAD} y1={y} y2={y} />
    {ticks.map((value) => <g key={value}>
      <line x1={x(value)} x2={x(value)} y1={y} y2={y + 8} />
      <text x={x(value)} y={y + 32} textAnchor="middle">{value}</text>
    </g>)}
  </g>;
}

export function TableToggle({ open, onToggle, show, hide }: { open: boolean; onToggle: () => void; show: string; hide: string }) {
  return <Button size="sm" aria-expanded={open} onClick={onToggle} data-hz-table-toggle="">{open ? hide : show}</Button>;
}
