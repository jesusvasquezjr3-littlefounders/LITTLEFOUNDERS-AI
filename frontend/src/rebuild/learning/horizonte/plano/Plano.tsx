import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { Button, DataTable, useRebuildEnvironment, type TableColumn } from '../../../design/controls';
import { planoWords, type PlanoCopy } from './copy';
import {
  PLANO_VIEWBOX, assignSeries, buildTableRows, clamp, createFrame, decimalsOf, describePoint, effectiveBounds, formatPlanoValue,
  interpretKey, niceTicks, pathFromPoints, pathFromRuns, pointerToValue, regionPolygon, resolveKeyStep, resolvePoint, sampleCurve, stepFor,
  type PlanoDomain, type PlanoHandleLayer, type PlanoLayers, type PlanoMoveConfig, type PlanoPoint, type PlanoSeries, type PlanoSize,
  type PlanoStep, type PlanoTableRow,
} from './model';
import './plano.css';

/*
 * Plano: the one plane every Horizonte board draws on (F0.2). The model (./model) owns every rule; this file draws
 * the layers and wires the pointer and keyboard to it. The plane is controlled: a handle shows the x and y its layer
 * gives, and a move asks `onHandleChange` for the new point, so a board keeps the learner's answer in its own state.
 *
 * Words and numerals are HTML beside the SVG; marks and handles are HTML over it, so none of them scale with the
 * viewBox. The SVG is aria-hidden: the figure is read through its summary, the focused handle's value, and
 * Show as table, which lists the same layers.
 */

export interface PlanoProps {
  /** The figure's name (a board's copy). */
  label: string;
  /** What the figure shows, in a sentence or two: the takeaway a screen reader cannot get from the picture. */
  summary?: string;
  domain: PlanoDomain;
  layers?: PlanoLayers;
  /** Axis names, written beside the axes. They also name x and y in announcements and the table. */
  xLabel?: string;
  yLabel?: string;
  /** Handles snap to multiples of this step (anchored at 0). Without it they move freely. */
  snap?: PlanoStep | null | false;
  /** Spacing of the gridlines and numerals. Default: a nice step. Pass the snap step to draw the snap grid. */
  tickStep?: PlanoStep;
  /** The fine arrow-key step. Default: the snap step, else about a fiftieth of each span. Shift moves five times as far. */
  keyStep?: PlanoStep;
  /** Most decimals written in announcements and the table. Default 2. */
  digits?: number;
  /** The viewBox. Only its ratio shows. Default 600 by 400. */
  size?: PlanoSize;
  /** A tap or click on the plane moves the selected handle there (within its limits). */
  placeOnTap?: boolean;
  /** Asked for the new point of a handle, after the model has clamped, axis-locked and snapped it. */
  onHandleChange?: (id: string, point: PlanoPoint) => void;
  /** Called with the tapped value, clamped and snapped to the domain, for boards that add a point per tap. */
  onPlaneTap?: (point: PlanoPoint) => void;
  /** Called when the learner picks a different handle (focus, drag, Page Up or Page Down). */
  onActiveChange?: (id: string) => void;
  /** Overrides for the plane's own words, for one locale. */
  copy?: Partial<PlanoCopy>;
  className?: string;
}

const SHAPE: Record<PlanoSeries, 'circle' | 'square' | 'diamond'> = { 1: 'circle', 2: 'square', 3: 'diamond', neutral: 'circle' };
const DASH: Record<PlanoSeries, string | undefined> = { 1: undefined, 2: '10 6', 3: '2 6', neutral: '6 3 1 3' };
const PATTERN = 10;
const same = (a: PlanoPoint, b: PlanoPoint) => a.x === b.x && a.y === b.y;
const NONE: PlanoLayers = {};

interface Drag { id: string; pointerId: number; dx: number; dy: number }
interface LegendEntry { key: string; text: string; series: PlanoSeries; region: boolean }

export function Plano({
  label, summary, domain, layers = NONE, xLabel, yLabel, snap, tickStep, keyStep, digits = 2, size = PLANO_VIEWBOX,
  placeOnTap = false, onHandleChange, onPlaneTap, onActiveChange, copy, className,
}: PlanoProps) {
  const { locale } = useRebuildEnvironment();
  const words: PlanoCopy = { ...planoWords(locale), ...copy };
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { xMin, xMax, yMin, yMax } = domain;
  const { width, height } = size;
  const frame = useMemo(() => createFrame({ xMin, xMax, yMin, yMax }, { width, height }), [xMin, xMax, yMin, yMax, width, height]);

  const plotRef = useRef<HTMLDivElement>(null);
  const handleRefs = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<Drag | null>(null);
  const picked = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const handles = layers.handles ?? [];
  const enabled = handles.filter((handle) => !handle.disabled);
  const activeId = enabled.find((handle) => handle.id === chosen)?.id ?? enabled[0]?.id ?? null;
  const active = handles.find((handle) => handle.id === activeId);
  const tapEnabled = placeOnTap || Boolean(onPlaneTap);
  const hasContent = [layers.handles, layers.points, layers.polylines, layers.curves, layers.regions].some((layer) => layer && layer.length > 0);

  const xTicks = niceTicks(xMin, xMax, 6, stepFor(tickStep, 'x') ?? undefined);
  const yTicks = niceTicks(yMin, yMax, 5, stepFor(tickStep, 'y') ?? undefined);
  const tickText = (value: number, step: number) => formatPlanoValue(value, locale, decimalsOf(step));
  const yTexts = yTicks.ticks.map((tick) => tickText(tick, yTicks.step));
  const gutter = Math.max(2, ...yTexts.map((text) => text.length)) + 1;
  const keyStepPerAxis = resolveKeyStep(frame.domain, snap, keyStep);

  const series = assignSeries(layers);
  const legend: LegendEntry[] = [];
  const note = (key: string, text: string | undefined, slot: PlanoSeries | undefined, region: boolean) => { if (text && slot) legend.push({ key, text, series: slot, region }); };
  (layers.polylines ?? []).forEach((layer, index) => note(`p:${layer.id}`, layer.label, series.polylines[index], false));
  (layers.curves ?? []).forEach((layer, index) => note(`c:${layer.id}`, layer.label, series.curves[index], false));
  (layers.regions ?? []).forEach((layer, index) => note(`r:${layer.id}`, layer.label, series.regions[index], true));

  const configOf = (handle: PlanoHandleLayer): PlanoMoveConfig => ({ domain: frame.domain, snap, bounds: handle.bounds, axis: handle.axis, step: keyStepPerAxis });
  const say = (handle: PlanoHandleLayer, point: PlanoPoint) => describePoint(point, { locale, digits, xLabel, yLabel, axis: handle.axis });
  const announce = (handle: PlanoHandleLayer, point: PlanoPoint, suffix = '') => setAnnouncement(`${handle.label}: ${say(handle, point)}${suffix}`);
  const valueAt = (clientX: number, clientY: number) => (plotRef.current ? pointerToValue(frame, plotRef.current.getBoundingClientRect(), clientX, clientY) : null);

  const select = (id: string) => {
    if (picked.current === id) return;
    const previous = picked.current ?? activeId;
    picked.current = id;
    setChosen(id);
    if (id !== previous) onActiveChange?.(id);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>, handle: PlanoHandleLayer) => {
    if (handle.disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const result = interpretKey(event.key, event.shiftKey, handle, configOf(handle));
    if (!result) return;
    event.preventDefault();
    if (result.kind === 'switch') {
      const index = enabled.findIndex((entry) => entry.id === handle.id);
      const next = enabled[(index + result.direction + enabled.length) % enabled.length];
      if (next && next.id !== handle.id) {
        select(next.id);
        handleRefs.current.get(next.id)?.focus();
      }
      return;
    }
    const moved = !same(result.point, handle);
    if (moved) onHandleChange?.(handle.id, result.point);
    announce(handle, result.point, moved ? '' : `. ${words.limit}`);
  };

  const onDown = (event: PointerEvent<HTMLDivElement>, handle: PlanoHandleLayer) => {
    if (handle.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    select(handle.id);
    event.currentTarget.focus({ preventScroll: true });
    const at = valueAt(event.clientX, event.clientY);
    if (!at) return;
    drag.current = { id: handle.id, pointerId: event.pointerId, dx: at.x - handle.x, dy: at.y - handle.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(handle.id);
  };

  const onMove = (event: PointerEvent<HTMLDivElement>, handle: PlanoHandleLayer) => {
    const grab = drag.current;
    if (!grab || grab.id !== handle.id || grab.pointerId !== event.pointerId) return;
    const at = valueAt(event.clientX, event.clientY);
    if (!at) return;
    const next = resolvePoint({ x: at.x - grab.dx, y: at.y - grab.dy }, handle, configOf(handle));
    if (!same(next, handle)) onHandleChange?.(handle.id, next);
  };

  const onRelease = (event: PointerEvent<HTMLDivElement>, handle: PlanoHandleLayer) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(null);
    announce(handle, handle);
  };

  const onPlotClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[role="slider"]')) return;
    const at = valueAt(event.clientX, event.clientY);
    if (!at) return;
    onPlaneTap?.(resolvePoint(at, at, { domain: frame.domain, snap }));
    if (!placeOnTap || !active) return;
    const next = resolvePoint(at, active, configOf(active));
    if (!same(next, active)) onHandleChange?.(active.id, next);
    announce(active, next);
  };

  const rows: PlanoTableRow[] = table ? buildTableRows(layers, frame.domain, xTicks.ticks) : [];
  const columns: TableColumn<PlanoTableRow>[] = [
    { key: 'name', label: words.name, value: (row) => row.name, ugc: true },
    { key: 'x', label: xLabel ?? 'x', value: (row) => formatPlanoValue(row.x, locale, digits) },
    { key: 'y', label: yLabel ?? 'y', value: (row) => formatPlanoValue(row.y, locale, digits) },
  ];

  const axisY = frame.y.toPx(clamp(0, yMin, yMax));
  const axisX = frame.x.toPx(clamp(0, xMin, xMax));
  const fromStart = (value: number, min: number, max: number) => `${((value - min) / (max - min)) * 100}%`;
  const patternUrl = (slot: PlanoSeries) => (slot === 2 || slot === 3 ? `url(#plano${uid}-${slot})` : undefined);

  return <figure className={`lf-plano${className ? ` ${className}` : ''}`} aria-labelledby={`${uid}-name`} aria-describedby={summary ? `${uid}-summary` : undefined}>
    <div className="lf-plano-head">
      <figcaption className="lf-plano-caption">
        <span id={`${uid}-name`} className="lf-plano-name" data-copy-role="heading">{label}</span>
        {summary ? <span id={`${uid}-summary`} className="lf-plano-summary" data-copy-role="body">{summary}</span> : null}
      </figcaption>
      {hasContent ? <Button size="sm" onClick={() => setTable((value) => !value)}>{table ? words.chart : words.table}</Button> : null}
    </div>

    {table ? <DataTable caption={label} columns={columns} rows={rows} rowKey={(row) => row.id} /> : <>
      {legend.length > 1 ? <ul className="lf-plano-legend" aria-label={label}>
        {legend.map((entry) => <li key={entry.key} className={`lf-plano-series-${entry.series}`}>
          <svg viewBox="0 0 32 8" aria-hidden="true" focusable="false" className="lf-plano-key">
            {entry.region
              ? <rect className="lf-plano-key-fill" x="0" y="0" width="32" height="8" rx="2" style={{ fill: patternUrl(entry.series) }} />
              : <line className="lf-plano-key-line" x1="0" x2="32" y1="4" y2="4" strokeDasharray={DASH[entry.series]} />}
          </svg>
          <span data-copy-role="body">{entry.text}</span>
        </li>)}
      </ul> : null}

      <div className="lf-plano-frame" style={{ '--plano-gutter': `${gutter}ch` } as CSSProperties}>
        {yLabel ? <span className="lf-plano-axis-name lf-plano-axis-name--y" data-copy-role="data">{yLabel}</span> : null}
        <div className="lf-plano-yaxis" aria-hidden="true">
          {yTicks.ticks.map((tick, index) => <span key={tick} className="lf-plano-tick" data-copy-role="data" style={{ insetBlockStart: fromStart(yMax - tick + yMin, yMin, yMax) }}>{yTexts[index]}</span>)}
        </div>

        <div ref={plotRef} className="lf-plano-plot" data-tap={tapEnabled ? 'true' : undefined} style={{ '--plano-ratio': `${width} / ${height}` } as CSSProperties}
          onClick={tapEnabled ? onPlotClick : undefined}>
          <svg className="lf-plano-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <pattern id={`plano${uid}-2`} className="lf-plano-series-2" width={PATTERN} height={PATTERN} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect className="lf-plano-pattern-ground" width={PATTERN} height={PATTERN} />
                <rect className="lf-plano-pattern-ink" width={PATTERN / 2.5} height={PATTERN} />
              </pattern>
              <pattern id={`plano${uid}-3`} className="lf-plano-series-3" width={PATTERN} height={PATTERN} patternUnits="userSpaceOnUse">
                <rect className="lf-plano-pattern-ground" width={PATTERN} height={PATTERN} />
                <circle className="lf-plano-pattern-ink" cx={PATTERN / 2} cy={PATTERN / 2} r={PATTERN / 5} />
              </pattern>
            </defs>
            {xTicks.ticks.map((tick) => <line key={`x${tick}`} className="lf-plano-grid" x1={frame.x.toPx(tick)} x2={frame.x.toPx(tick)} y1={0} y2={height} />)}
            {yTicks.ticks.map((tick) => <line key={`y${tick}`} className="lf-plano-grid" x1={0} x2={width} y1={frame.y.toPx(tick)} y2={frame.y.toPx(tick)} />)}
            {(layers.regions ?? []).map((region, index) => {
              const slot = series.regions[index]!;
              const pattern = patternUrl(slot);
              return <path key={region.id} className={`lf-plano-region lf-plano-series-${slot}${pattern ? '' : ' lf-plano-region--tint'}`} style={pattern ? { fill: pattern } : undefined}
                d={pathFromPoints(regionPolygon(region), frame, true)} />;
            })}
            <line className="lf-plano-axis" x1={0} x2={width} y1={axisY} y2={axisY} />
            <line className="lf-plano-axis" x1={axisX} x2={axisX} y1={0} y2={height} />
            {(layers.polylines ?? []).map((line, index) => <path key={line.id} className={`lf-plano-line lf-plano-series-${series.polylines[index]}`}
              strokeDasharray={DASH[series.polylines[index]!]} d={pathFromPoints(line.points, frame)} />)}
            {(layers.curves ?? []).map((curve, index) => <path key={curve.id} className={`lf-plano-line lf-plano-series-${series.curves[index]}`}
              strokeDasharray={DASH[series.curves[index]!]}
              d={pathFromRuns(sampleCurve(curve.fn, curve.from ?? xMin, curve.to ?? xMax, { samples: curve.samples, yMin, yMax }), frame)} />)}
          </svg>

          <div className="lf-plano-overlay">
            {(layers.points ?? []).map((point) => {
              const slot = point.series ?? 1;
              const place = frame.percent(point);
              return <span key={point.id} className={`lf-plano-point lf-plano-series-${slot}`} data-shape={SHAPE[slot]} aria-hidden="true"
                style={{ insetInlineStart: `${place.left}%`, insetBlockStart: `${place.top}%` }}>
                <span className="lf-plano-mark" />
                {point.label ? <span className="lf-plano-point-label" data-copy-role="data">{point.label}</span> : null}
              </span>;
            })}
            {handles.map((handle) => {
              const place = frame.percent(handle);
              const bounds = effectiveBounds(frame.domain, handle.bounds);
              const vertical = handle.axis === 'y';
              const isActive = handle.id === activeId;
              return <div key={handle.id} role="slider" tabIndex={isActive ? 0 : -1}
                ref={(node) => { if (node) handleRefs.current.set(handle.id, node); else handleRefs.current.delete(handle.id); }}
                className={`lf-plano-handle${handle.series ? ` lf-plano-series-${handle.series}` : ''}`} data-shape={SHAPE[handle.series ?? 1]}
                data-active={enabled.length > 1 && isActive ? 'true' : undefined} data-dragging={dragging === handle.id ? 'true' : undefined}
                aria-label={handle.label} aria-orientation={vertical ? 'vertical' : 'horizontal'}
                aria-valuemin={vertical ? bounds.yMin : bounds.xMin} aria-valuemax={vertical ? bounds.yMax : bounds.xMax} aria-valuenow={vertical ? handle.y : handle.x}
                aria-valuetext={say(handle, handle)} aria-disabled={handle.disabled ? true : undefined} aria-describedby={`${uid}-hint`}
                style={{ insetInlineStart: `${place.left}%`, insetBlockStart: `${place.top}%` }}
                onFocus={() => select(handle.id)} onKeyDown={(event) => onKey(event, handle)}
                onPointerDown={(event) => onDown(event, handle)} onPointerMove={(event) => onMove(event, handle)}
                onPointerUp={(event) => onRelease(event, handle)} onPointerCancel={(event) => onRelease(event, handle)}>
                {handle.caption ? <span className="lf-plano-handle-caption" data-copy-role="data">{handle.caption}</span> : null}
              </div>;
            })}
          </div>
        </div>

        <div className="lf-plano-xaxis" aria-hidden="true">
          {xTicks.ticks.map((tick) => <span key={tick} className="lf-plano-tick" data-copy-role="data" style={{ insetInlineStart: fromStart(tick, xMin, xMax) }}>{tickText(tick, xTicks.step)}</span>)}
        </div>
        {xLabel ? <span className="lf-plano-axis-name lf-plano-axis-name--x" data-copy-role="data">{xLabel}</span> : null}
      </div>

      {active ? <p className="lf-plano-readout" data-copy-role="data">{`${active.label}: ${say(active, active)}`}</p> : null}
    </>}

    {handles.length ? <p id={`${uid}-hint`} className="lf-visually-hidden">
      <span data-copy-role="body">{words.keys}</span>
      {enabled.length > 1 ? <span data-copy-role="body">{` ${words.switchKeys}`}</span> : null}
      {placeOnTap ? <span data-copy-role="body">{` ${words.tap}`}</span> : null}
    </p> : null}
    <div className="lf-visually-hidden" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
  </figure>;
}
