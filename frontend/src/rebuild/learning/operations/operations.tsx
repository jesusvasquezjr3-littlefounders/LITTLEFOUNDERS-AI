import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Button, SegmentedControl, Stepper, Switch } from '../../design/controls';
import { canPick, polyline, stepValue, thresholdIndex, tokensLeft } from './operationsModel';
import './operations.css';

/*
 * GAP-FIX-R1 learning (Appendix A Part 2; B.7 part 2): the eight interaction
 * primitives the first release lacked, plus the drag point they share, as
 * reusable `operation.*.v1` components. Each one:
 *   - starts in its simplest state and carries meaning in every mark;
 *   - offers a tap and keyboard path for every action (shared Buttons,
 *     Steppers, Switches and SegmentedControls; a drag is never the only way);
 *   - says what changed in a polite live region;
 *   - animates only under `prefers-reduced-motion: no-preference`
 *     (operations.css), so reduced motion keeps every state and drops the move.
 * Labels come from the calling board's copy (three locales, Copy Budget);
 * the primitives own no words.
 */

/** Pattern 5: pick a strategy; every branch is simulated and shown side by side. */
export function WhatIfBranch<T extends string>({ legend, branches, chosen, onChoose, render, disabled }: {
  legend: string; branches: ReadonlyArray<{ id: T; label: string }>; chosen: T | null; onChoose: (id: T) => void;
  render: (id: T) => ReactNode; disabled?: boolean;
}) {
  return <div className="lf-op lf-op-branch" data-operation="operation.what-if-branch.v1">
    <SegmentedControl legend={legend} name={`branch-${legend}`} options={branches.map((b) => ({ value: b.id, label: b.label }))} value={chosen} onValueChange={onChoose} disabled={disabled} />
    <div className="lf-op-branch-grid">
      {branches.map((branch) => <section key={branch.id} className="lf-op-branch-card" data-chosen={chosen === branch.id || undefined} aria-label={branch.label}>
        <h3 data-copy-role="heading">{branch.label}</h3>
        {render(branch.id)}
      </section>)}
    </div>
  </div>;
}

/** Pattern 7: one switch swaps two states of the same thing, isolating one variable. */
export function BeforeAfter({ label, stateLabels, before, after, value, onChange }: {
  label: string; stateLabels: { on: string; off: string }; before: ReactNode; after: ReactNode; value: boolean; onChange: (value: boolean) => void;
}) {
  return <div className="lf-op lf-op-toggle" data-operation="operation.before-after.v1">
    <Switch label={label} checked={value} onCheckedChange={onChange} stateLabels={stateLabels} />
    <div className="lf-op-toggle-panel" key={value ? 'after' : 'before'} aria-live="polite">{value ? after : before}</div>
  </div>;
}

/** Pattern 8: an open sandbox with one light goal and cues that appear as the learner explores. */
export function GuidedSandbox({ goalLabel, goal, cues, children }: {
  goalLabel?: string; goal?: string; cues: ReadonlyArray<{ id: string; text: string; active: boolean }>; children: ReactNode;
}) {
  const active = cues.filter((cue) => cue.active);
  return <div className="lf-op lf-op-sandbox" data-operation="operation.guided-sandbox.v1">
    {goal ? <p className="lf-op-goal" data-copy-role="body">{goalLabel ? <strong>{goalLabel}</strong> : null} {goal}</p> : null}
    {children}
    <ul className="lf-op-cues" aria-live="polite">
      {active.map((cue) => <li key={cue.id} data-copy-role="body">{cue.text}</li>)}
    </ul>
  </div>;
}

/** Pattern 10: a continuous series with a marker that appears exactly where it first reaches the threshold. */
export function ThresholdPlot({ values, threshold, max, revealed, title, labels }: {
  values: readonly number[]; threshold: number; max: number; revealed: boolean; title: string;
  labels: { threshold: string; crossed: (index: number) => string; notYet: string };
}) {
  const at = thresholdIndex(values, threshold);
  const width = 300; const height = 140; const span = Math.max(1, values.length - 1);
  const y = height - Math.min(threshold, max) / max * height;
  const status = !revealed ? '' : at < 0 ? labels.notYet : labels.crossed(at);
  return <figure className="lf-op lf-op-threshold" data-operation="operation.threshold-marker.v1">
    <svg viewBox={`-8 -12 ${width + 16} ${height + 24}`} role="img" aria-label={`${title}. ${status}`}>
      <line className="lf-op-axis" x1="0" y1={height} x2={width} y2={height} />
      <line className="lf-op-threshold-line" x1="0" y1={y} x2={width} y2={y} />
      <text className="lf-op-label" x="2" y={y - 4}>{labels.threshold}</text>
      <polyline className="lf-op-line" points={polyline(values, width, height, max)} />
      {revealed && at >= 0 ? <g className="lf-op-flag" transform={`translate(${at / span * width} ${y})`}>
        <line x1="0" y1="0" x2="0" y2={height - y} className="lf-op-flag-stem" />
        <circle r="6" className="lf-op-flag-dot" />
      </g> : null}
    </svg>
    <figcaption className="lf-op-status" aria-live="polite" data-copy-role="data">{status}</figcaption>
  </figure>;
}

/** Pattern 11: spend a few discrete tokens among options; what was given up stays visible. */
export function TradeOffChooser({ legend, tokens, options, picked, onChange, labels }: {
  legend: string; tokens: number; options: ReadonlyArray<{ id: string; label: string; cost: number }>; picked: readonly string[];
  onChange: (picked: string[]) => void; labels: { left: (n: number) => string; cost: (n: number) => string; gaveUp: string };
}) {
  const left = tokensLeft(options, picked, tokens);
  const given = options.filter((option) => !picked.includes(option.id));
  return <div className="lf-op lf-op-tokens" data-operation="operation.trade-off-chooser.v1" role="group" aria-label={legend}>
    <div className="lf-op-token-row" aria-hidden="true">
      {Array.from({ length: tokens }, (_, index) => <span key={index} className="lf-op-token" data-spent={index >= left || undefined} />)}
    </div>
    <p className="lf-op-status" aria-live="polite" data-copy-role="data">{labels.left(left)}</p>
    <div className="lf-op-token-options">
      {options.map((option) => {
        const on = picked.includes(option.id);
        return <Button key={option.id} variant={on ? 'sky' : 'secondary'} aria-pressed={on} disabled={!canPick(option, options, picked, tokens)}
          onClick={() => onChange(on ? picked.filter((id) => id !== option.id) : [...picked, option.id])}>
          {`${option.label} · ${labels.cost(option.cost)}`}
        </Button>;
      })}
    </div>
    {left === 0 ? <div className="lf-op-gave-up"><h3 data-copy-role="heading">{labels.gaveUp}</h3>
      <ul>{given.map((option) => <li key={option.id} data-copy-role="data">{option.label}</li>)}</ul></div> : null}
  </div>;
}

/** Pattern 2: a point dragged along one axis (or moved with the arrow keys), stepping on the grid. */
export function DragPoint({ x, y, value, min, max, step = 1, axis, length, label, valueText, onChange, disabled }: {
  x: number; y: number; value: number; min: number; max: number; step?: number; axis: 'x' | 'y'; length: number; label: string; valueText: string;
  onChange: (value: number) => void; disabled?: boolean;
}) {
  const dragging = useRef<{ start: number; origin: number } | null>(null);
  const onKey = (event: KeyboardEvent<SVGGElement>) => {
    const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (delta === undefined || disabled) return;
    event.preventDefault();
    onChange(stepValue(value, delta, min, max, step));
  };
  const scale = (event: PointerEvent<SVGGElement>) => {
    const svg = (event.currentTarget as SVGGElement).ownerSVGElement;
    const box = svg?.getBoundingClientRect();
    const view = svg?.viewBox.baseVal;
    return box && view && box.width > 0 ? (axis === 'x' ? view.width / box.width : view.height / box.height) : 1;
  };
  return <g className="lf-op-drag" data-operation="operation.drag-point.v1" role="slider" tabIndex={disabled ? -1 : 0} aria-label={label}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText} aria-disabled={disabled || undefined}
    transform={`translate(${x} ${y})`} onKeyDown={onKey}
    onPointerDown={(event) => { if (disabled) return; (event.currentTarget as Element).setPointerCapture?.(event.pointerId); dragging.current = { start: axis === 'x' ? event.clientX : event.clientY, origin: value }; }}
    onPointerMove={(event) => {
      if (!dragging.current) return;
      const moved = ((axis === 'x' ? event.clientX : event.clientY) - dragging.current.start) * scale(event);
      const perUnit = length / Math.max(1, max - min);
      onChange(stepValue(dragging.current.origin + (axis === 'x' ? moved : -moved) / perUnit, 0, min, max, step));
    }}
    onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
    <circle className="lf-op-drag-hit" r="24" />
    <circle className="lf-op-drag-dot" r="8" />
  </g>;
}

/** Pattern 12: a whole curve shifts by steps; the dependent marker follows (the board redraws from its model). */
export function CurveShift({ label, value, max, valueText, labels, onChange, disabled }: {
  label: string; value: number; max: number; valueText: string; labels: { decrease: string; increase: string }; onChange: (value: number) => void; disabled?: boolean;
}) {
  return <div className="lf-op lf-op-shift" data-operation="operation.curve-shift.v1">
    <Stepper label={label} value={value} valueText={valueText} min={-max} max={max} onValueChange={onChange} labels={labels} disabled={disabled} />
  </div>;
}

export type ReactivePart = string | { id: string; value: number; min: number; max: number; step: number; label: string; text: string };
/** Pattern 14: numbers inside a sentence are themselves controls; changing one rewrites the sentence and the linked chart. */
export function ReactiveText({ parts, labels, onChange, result }: {
  parts: readonly ReactivePart[]; labels: { decrease: string; increase: string }; onChange: (id: string, value: number) => void; result?: ReactNode;
}) {
  return <div className="lf-op lf-op-reactive" data-operation="operation.reactive-text.v1" data-copy-role="body">
    {parts.map((part, index) => typeof part === 'string'
      ? <span key={index}>{part}</span>
      : <Stepper key={part.id} className="lf-op-inline" label={part.label} labelHidden value={part.value} valueText={part.text} min={part.min} max={part.max} step={part.step}
        onValueChange={(value) => onChange(part.id, value)} labels={labels} />)}
    {result === undefined ? null : <span className="lf-op-reactive-result" aria-live="polite">{result}</span>}
  </div>;
}

/** Pattern 15: keeps the previous distinct run as a ghost while the current run is drawn over it. */
export function useGhost<T>(key: string, run: T): T | null {
  const [state, setState] = useState<{ key: string; run: T; ghost: T | null }>({ key, run, ghost: null });
  if (state.key !== key) {
    setState({ key, run, ghost: state.run });
    return state.run;
  }
  return state.ghost;
}
export function GhostTracePlot({ current, ghost, max, count, title, labels }: {
  current: readonly number[]; ghost: readonly number[] | null; max: number; count: number; title: string; labels: { current: string; ghost: string; summary: string };
}) {
  const id = useId();
  const width = 300; const height = 140;
  return <figure className="lf-op lf-op-ghost" data-operation="operation.ghost-trace.v1">
    <svg viewBox={`-4 -4 ${width + 8} ${height + 8}`} role="img" aria-label={title} aria-describedby={id}>
      <line className="lf-op-axis" x1="0" y1={height} x2={width} y2={height} />
      {ghost ? <polyline className="lf-op-line lf-op-line--ghost" points={polyline(ghost, width, height, max, count)} /> : null}
      <polyline className="lf-op-line" key={current.join(',')} points={polyline(current, width, height, max, count)} />
    </svg>
    <ul className="lf-op-legend">
      <li data-copy-role="data"><span className="lf-op-key" aria-hidden="true" />{labels.current}</li>
      {ghost ? <li data-copy-role="data"><span className="lf-op-key lf-op-key--ghost" aria-hidden="true" />{labels.ghost}</li> : null}
    </ul>
    <figcaption id={id} className="lf-op-status" aria-live="polite" data-copy-role="data">{labels.summary}</figcaption>
  </figure>;
}

/** Pattern 16 (reused): a near and a far view of the same process. */
export function ScaleToggle<T extends string>({ legend, options, value, onChange }: {
  legend: string; options: ReadonlyArray<{ value: T; label: string }>; value: T; onChange: (value: T) => void;
}) {
  return <SegmentedControl legend={legend} name={`scale-${legend}`} options={options} value={value} onValueChange={onChange} size="compact" />;
}
