import type { ReactNode } from 'react';
import type { SeriesTone } from './visuals';
import '../operations/operations.css';
import '../conceptBoards.css';
import './pizarron.css';

/*
 * GAP-FIX-R4 (B.7 "one component set"; Bible 05 §5 and §6): the concept
 * pictures the lesson concept boards used to draw inline, as shared Pizarrón
 * visuals the Mentor's board can use too.
 *
 * - Word labels (axis titles, curve names, asset names) are HTML placed over
 *   the drawing and wrapping; the SVG carries marks only (05 §5).
 * - The drawing is `aria-hidden`; the frame is an image with a description
 *   when static, and a named group when a board lays interactive marks over it
 *   (`overlay`), whose accessible path is the board's own HTML controls
 *   (steppers), never the SVG (05 §6: never `role="img"` on an interactive SVG).
 * - Positions are normalised: x from 0 (left) to 1 (right), y from 0 (bottom)
 *   to 1 (top); the board's model has already done any arithmetic.
 */

const W = 300;
const H = 200;
const px = (x: number) => Math.max(0, Math.min(1, x)) * W;
const py = (y: number) => (1 - Math.max(0, Math.min(1, y))) * H;
const place = (x: number, y: number) => ({ insetInlineStart: `${Math.max(0, Math.min(1, x)) * 100}%`, insetBlockStart: `${(1 - Math.max(0, Math.min(1, y))) * 100}%` });

function Plot({ name, label, interactive, children, labels, overlay }: {
  name: string; label: string; interactive: boolean; children: ReactNode; labels: ReactNode; overlay?: ReactNode;
}) {
  return <div className="lf-pz lf-pz-plot" role={interactive ? 'group' : 'img'} aria-label={label} data-pizarron={name} data-interactive={interactive ? 'true' : undefined}>
    <div className="lf-pz-plot-area">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line className="lf-op-axis" x1="0" y1={H} x2={W} y2={H} /><line className="lf-op-axis" x1="0" y1="0" x2="0" y2={H} />
        {children}
        {overlay}
      </svg>
      <div className="lf-pz-plot-labels" aria-hidden="true">{labels}</div>
    </div>
  </div>;
}

export interface PlotLine { id: string; label: string; from: { x: number; y: number }; to: { x: number; y: number }; series: SeriesTone; labelAt: { x: number; y: number } }

/**
 * Two (or more) straight curves on price-over-quantity axes and the point
 * where they meet (supply and demand). `overlay` receives SVG marks drawn in
 * the same 300 x 200 space (the lesson's curve handles).
 */
export function SupplyDemandVisual({ label, xLabel, yLabel, lines, point, overlay }: {
  label: string; xLabel: string; yLabel: string; lines: readonly PlotLine[]; point: { x: number; y: number }; overlay?: ReactNode;
}) {
  return <Plot name="supply-demand" label={label} interactive={Boolean(overlay)} overlay={overlay} labels={<>
    <span className="lf-pz-plot-axis lf-pz-plot-axis--x" data-copy-role="data">{xLabel}</span>
    <span className="lf-pz-plot-axis lf-pz-plot-axis--y" data-copy-role="data">{yLabel}</span>
    {lines.map((line) => <span key={line.id} className="lf-pz-plot-label" data-series={line.series} style={place(line.labelAt.x, line.labelAt.y)} data-copy-role="data">{line.label}</span>)}
  </>}>
    {lines.map((line, index) => <line key={line.id} className={`lf-op-line${index > 0 ? ' lf-op-line--second' : ''}`}
      x1={px(line.from.x)} y1={py(line.from.y)} x2={px(line.to.x)} y2={py(line.to.y)} />)}
    <line className="lf-concept-guide" x1="0" y1={py(point.y)} x2={px(point.x)} y2={py(point.y)} />
    <circle className="lf-concept-eq" cx={px(point.x)} cy={py(point.y)} r="6" />
  </Plot>;
}

export interface PlotPoint { id: string; label: string; x: number; y: number }

/** Assets on risk (x) and return (y) axes, and the marked point the current mix makes (diversification). */
export function RiskReturnVisual({ label, xLabel, yLabel, points, marked, overlay }: {
  label: string; xLabel: string; yLabel: string; points: readonly PlotPoint[]; marked: { x: number; y: number }; overlay?: ReactNode;
}) {
  return <Plot name="risk-return" label={label} interactive={Boolean(overlay)} overlay={overlay} labels={<>
    <span className="lf-pz-plot-axis lf-pz-plot-axis--x" data-copy-role="data">{xLabel}</span>
    <span className="lf-pz-plot-axis lf-pz-plot-axis--y" data-copy-role="data">{yLabel}</span>
    {points.map((point) => <span key={point.id} className="lf-pz-plot-label" style={place(point.x, point.y)} data-copy-role="data">{point.label}</span>)}
  </>}>
    {points.map((point) => <circle key={point.id} className="lf-concept-asset" cx={px(point.x)} cy={py(point.y)} r="4" />)}
    <circle className="lf-concept-eq" cx={px(marked.x)} cy={py(marked.y)} r="8" />
  </Plot>;
}

export interface ColumnPart { id: string; value: number; series: 'sky' | 'berry' }
export interface Column { id: string; parts: readonly ColumnPart[]; current?: boolean }

/**
 * Stacked columns over time (a loan's payments split into interest and what
 * reached the loan), the current column marked; the key names each part.
 */
export function StackedColumnsVisual({ label, columns, keys }: {
  label: string; columns: readonly Column[]; keys: ReadonlyArray<{ id: string; label: string; series: 'sky' | 'berry' }>;
}) {
  const max = Math.max(1, ...columns.map((column) => column.parts.reduce((sum, part) => sum + part.value, 0)));
  const width = W / Math.max(1, columns.length);
  return <div className="lf-pz" role="img" aria-label={label} data-pizarron="stacked-columns">
    <svg className="lf-concept-bars" viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {columns.map((column, index) => {
        let top = 100;
        return <g key={column.id} className="lf-concept-bar" data-current={column.current || undefined}>
          {column.parts.map((part) => {
            const height = part.value / max * 96;
            top -= height;
            return <rect key={part.id} className={part.series === 'berry' ? 'lf-concept-bar-interest' : 'lf-concept-bar-principal'}
              x={index * width + width * 0.1} y={top} width={width * 0.8} height={height} />;
          })}
        </g>;
      })}
    </svg>
    <ul className="lf-concept-legend">{keys.map((key) => <li key={key.id} data-copy-role="data">
      <i className={`lf-concept-key lf-concept-key--${key.series === 'berry' ? 'interest' : 'principal'}`} aria-hidden="true" />{key.label}</li>)}</ul>
  </div>;
}
