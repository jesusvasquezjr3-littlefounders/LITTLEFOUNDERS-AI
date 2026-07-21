/*
 * /DESIGN.md §Components — TrendChart (console-only): minimal inline SVG
 * area chart for timeseries. `primary` stroke over a `primary/10` fill, no
 * axis chrome beyond first/last caption labels, never a third-party lib.
 */

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendChartProps {
  points: TrendPoint[];
  /** Accessible description of what the series measures. */
  ariaLabel: string;
  className?: string;
}

const W = 600;
const H = 140;
const PAD = 4;

export function TrendChart({ points, ariaLabel, className }: TrendChartProps) {
  if (points.length === 0) return null;

  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const coords = points.map((p, i) => `${(PAD + i * stepX).toFixed(1)},${y(p.value).toFixed(1)}`);
  const line = `M${coords.join(' L')}`;
  const area = `${line} L${(PAD + (points.length - 1) * stepX).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
        className="block h-28 w-full sm:h-36"
      >
        <path d={area} className="fill-primary/10" />
        <path d={line} className="fill-none stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex items-center justify-between">
        <span className="lf-caption text-content-faint">{points[0]?.label}</span>
        <span className="lf-caption text-content-faint">{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
