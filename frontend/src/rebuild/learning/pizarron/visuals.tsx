import type { CSSProperties, ReactNode } from 'react';
import '../learning.css';
import '../numberLine.css';
import '../growthComparison.css';
import './pizarron.css';

/*
 * THE PIZARRÓN VISUALS: ONE COMPONENT SET FOR LESSONS AND THE MENTOR'S BOARD
 * (product B.7 "unified with the AI Mentor's whiteboard … one component set";
 * Frontend Bible 05; 08 §2 layer 4 "the teaching board (05)").
 *
 * Each visual is PRESENTATION ONLY: it draws the numbers and words it is given
 * and does no arithmetic a learner could be asked to do. Scaling a length to
 * the board (a value over the largest value) is drawing, not arithmetic; a
 * running total, a difference or a unit price always arrives already computed
 * (by Oracle for the Mentor, by the lesson's own model for a lesson).
 *
 * Hue rules (05 §2): only `sky`, `mint` and `berry` encode a data series, in
 * that order, with the pattern channel from the second series on (solid,
 * diagonal, dots); a fourth or later series uses the neutral overflow style
 * (crosshatch) with a direct label. `primary` never encodes data: it only
 * rings the one mark the board SELECTS (the best option, the answer to check).
 * Coins use `reward` with the ridge outline. Every series carries a direct
 * label, never a legend alone.
 *
 * Every visual is a static chart (`role="img"` with a description); the table
 * one press away (`TeachingChartBoard`) is the accessible alternative.
 */

export type SeriesTone = 'sky' | 'mint' | 'berry' | 'overflow';
export const SERIES_TONES = ['sky', 'mint', 'berry'] as const;

/** The series tone of the index-th series: the three series hues in order, then the neutral overflow. */
export function seriesTone(index: number): SeriesTone {
  return index >= 0 && index < SERIES_TONES.length ? SERIES_TONES[index]! : 'overflow';
}

const pct = (share: number) => `${Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0)) * 100}%`;
const clamp01 = (share: number) => Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));

/**
 * A static visual is one image with a description (`role="img"`). An
 * interactive one (a lesson board with drop targets or controls inside,
 * GAP-FIX-R4) is a named group instead: Bible 05 §6, never `role="img"` on
 * something the learner acts on, since it removes the children from the
 * accessibility tree.
 */
function Frame({ name, label, children, className, interactive = false }: { name: string; label: string; children: ReactNode; className?: string; interactive?: boolean }) {
  return <div className={`lf-pz ${className ?? ''}`.trim()} role={interactive ? 'group' : 'img'} aria-label={label} data-pizarron={name}
    data-interactive={interactive ? 'true' : undefined}>{children}</div>;
}

/** What a lesson board attaches to a region or bin it makes a drop target (GAP-FIX-R4, Bible 05 §4). */
export type DropTargetProps = Record<`data-${string}`, string> & { onClick?: () => void; className?: string };

// ── Schema slots (M8: change, group, compare, ratio) ─────────────────────────

export interface SchemaSlot { id: string; label: string; value: string; detail?: string }

/** A problem schema as three slots joined by its two operators (M8, GAP-FIX-R2); the name states the schema's shape. */
export function SchemaSlotsVisual({ label, schema, slots, operators }: { label: string; schema: string; slots: readonly [SchemaSlot, SchemaSlot, SchemaSlot]; operators: readonly [string, string] }) {
  const box = (slot: SchemaSlot) => <div key={slot.id} className="lf-schema-slot" data-slot={slot.id}>
    <span data-copy-role="label">{slot.label}</span><strong data-copy-role="data">{slot.value}</strong>
    {slot.detail ? <span data-copy-role="data">{slot.detail}</span> : null}</div>;
  return <Frame name="schema-slots" label={label} className={`lf-schema-diagram lf-schema-diagram--${schema}`}>
    {box(slots[0])}<div className="lf-schema-operator" aria-hidden="true">{operators[0]}</div>{box(slots[1])}
    <div className="lf-schema-operator" aria-hidden="true">{operators[1]}</div>{box(slots[2])}
  </Frame>;
}

// ── Bars: one bar per row, direct labels ────────────────────────────────────

export interface SeriesBarRow { id: string; label: string; value: string; amount: number; series: SeriesTone; marked?: boolean }

/** Quantities side by side (categories, rankings, chances): each bar carries its own label and value. */
export function SeriesBarsVisual({ label, rows }: { label: string; rows: readonly SeriesBarRow[] }) {
  const max = Math.max(0, ...rows.map((row) => Math.abs(row.amount)));
  return <Frame name="series-bars" label={label}>
    <ul className="lf-pz-bars">
      {rows.map((row) => <li key={row.id} className="lf-pz-bar-row" data-marked={row.marked ? 'true' : undefined} data-series={row.series}>
        <span className="lf-pz-bar-label" data-copy-role="data">{row.label}</span>
        <span className="lf-pz-bar-value" data-copy-role="data">{row.value}</span>
        <span className="lf-pz-bar-track" aria-hidden="true">
          <span className={`lf-pz-bar-fill lf-pz-fill--${row.series}`} style={{ inlineSize: max > 0 ? `${Math.max(2, (Math.abs(row.amount) / max) * 100)}%` : '2%' }} />
        </span>
      </li>)}
    </ul>
  </Frame>;
}

// ── Tape / bar model: rows of proportional segments ─────────────────────────

export interface TapeSegment { id: string; label: string; value: string; share: number; series: SeriesTone; unknown?: boolean; marked?: boolean; empty?: boolean }
export interface TapeRow { id: string; label: string; segments: readonly TapeSegment[]; tag?: string; total?: string }

/**
 * The bar (tape) model (05 §7 "Bar and schema models"): each row is a tape
 * whose segments are proportional parts; the unknown is a dashed segment
 * labelled "?". Also the strip for a split of a whole (a budget, a receipt,
 * money kept after spending) and the two sides of an equation.
 */
export function BarModelVisual({ label, rows, note }: { label: string; rows: readonly TapeRow[]; note?: string }) {
  return <Frame name="bar-model" label={label} className="lf-bar-model">
    {rows.map((row) => <div key={row.id} className="lf-bar-model-row">
      <span data-copy-role="data">{row.label}{row.total ? <span className="lf-pz-row-total" data-copy-role="data"> {row.total}</span> : null}</span>
      <div className="lf-bar-model-track lf-pz-track">
        {row.segments.map((segment) => <i key={segment.id}
          className={`lf-pz-seg lf-pz-fill--${segment.series}${segment.unknown ? ' lf-pz-seg--unknown' : ''}${segment.empty ? ' lf-pz-seg--empty' : ''}`}
          data-marked={segment.marked ? 'true' : undefined} style={{ inlineSize: pct(segment.share) }}>
          {segment.unknown || segment.value !== '' ? <span className="lf-pz-seg-text" data-copy-role="data">{segment.unknown ? '?' : segment.value}</span> : null}
        </i>)}
        {row.tag ? <b data-copy-role="data">{row.tag}</b> : null}
      </div>
    </div>)}
    {note ? <p className="lf-pz-note" data-copy-role="data">{note}</p> : null}
  </Frame>;
}

/** The labels of a tape, written out under it (a thin segment cannot hold its own words). */
export function TapeKey({ segments }: { segments: readonly TapeSegment[] }) {
  return <ul className="lf-pz-key">
    {segments.map((segment) => <li key={segment.id} data-marked={segment.marked ? 'true' : undefined}>
      <span className={`lf-pz-swatch lf-pz-fill--${segment.series}${segment.unknown ? ' lf-pz-seg--unknown' : ''}`} aria-hidden="true" />
      <span data-copy-role="data">{segment.label}: {segment.unknown ? '?' : segment.value}</span>
    </li>)}
  </ul>;
}

// ── Number line ─────────────────────────────────────────────────────────────

export interface LineMark { id: string; position: number; label: string; marked?: boolean }
export interface LineJump { id: string; from: number; to: number; label: string }

/**
 * A bounded number line (05 §7 "Number lines"): both ends labelled, marks at
 * their SERVER-COMPUTED positions (0..1), and jumps drawn as arcs between
 * stops (the open number line). Also the timeline (events at positions).
 */
export function NumberLineVisual({ label, minLabel, maxLabel, marks, jumps = [] }: {
  label: string; minLabel: string; maxLabel: string; marks: readonly LineMark[]; jumps?: readonly LineJump[];
}) {
  const x = (position: number) => 24 + 252 * clamp01(position);
  return <Frame name="number-line" label={label} className="lf-pz-line">
    {jumps.length > 0 ? <ul className="lf-pz-line-jumps" aria-hidden="true">
      {jumps.map((jump) => <li key={jump.id} style={{ insetInlineStart: pct((jump.from + jump.to) / 2 * 0.84 + 0.08) }} data-copy-role="data">{jump.label}</li>)}
    </ul> : null}
    <div className="lf-pz-line-plot">
      <svg viewBox="0 0 300 96" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {jumps.map((jump) => <path key={jump.id} className="lf-pz-jump" d={`M ${x(jump.from)} 56 Q ${(x(jump.from) + x(jump.to)) / 2} 14 ${x(jump.to)} 56`} />)}
        <line x1="24" y1="56" x2="276" y2="56" className="lf-number-line-track" />
        <line x1="24" x2="24" y1="42" y2="70" className="lf-number-line-tick" />
        <line x1="276" x2="276" y1="42" y2="70" className="lf-number-line-tick" />
      </svg>
      {/* The points are HTML so they stay round on a stretched line. */}
      <ul className="lf-pz-line-dots" aria-hidden="true">
        {marks.map((mark) => <li key={mark.id} style={{ insetInlineStart: pct(mark.position * 0.84 + 0.08) }} data-marked={mark.marked ? 'true' : undefined} />)}
      </ul>
    </div>
    <ul className="lf-pz-line-marks">
      {/* A label near an end grows inward, so it never runs off the board. */}
      {marks.map((mark) => <li key={mark.id} data-marked={mark.marked ? 'true' : undefined}
        style={mark.position > 0.75 ? { insetInlineEnd: pct(1 - (mark.position * 0.84 + 0.08)) } : { insetInlineStart: pct(mark.position * 0.84 + 0.08) }}
        data-align={mark.position < 0.25 ? 'start' : mark.position > 0.75 ? 'end' : undefined} data-copy-role="data">{mark.label}</li>)}
    </ul>
    <div className="lf-number-line-labels lf-pz-line-ends"><span data-copy-role="data">{minLabel}</span><span data-copy-role="data">{maxLabel}</span></div>
  </Frame>;
}

// ── Fractions ───────────────────────────────────────────────────────────────

/** Equal parts of one whole, some shaded (05 §7 "Fractions": the area model). */
export function FractionCellsVisual({ label, parts, shaded, series = 'sky' }: { label: string; parts: number; shaded: number; series?: SeriesTone }) {
  const count = Math.max(1, Math.min(48, Math.round(parts)));
  return <Frame name="fraction-cells" label={label} className="lf-fraction-area">
    <div className="lf-fraction-cells" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, index) => <span key={index}
        className={index < shaded ? `lf-fraction-cell lf-fraction-cell--filled lf-pz-fill--${series}` : 'lf-fraction-cell'} />)}
    </div>
  </Frame>;
}

/** Circle models only for halves, thirds, quarters and sixths (05 §7); any other denominator is the area model. */
export const CIRCLE_DENOMINATORS: readonly number[] = [2, 3, 4, 6];

export function FractionCircleVisual({ label, parts, shaded }: { label: string; parts: number; shaded: number }) {
  if (!CIRCLE_DENOMINATORS.includes(parts)) return <FractionCellsVisual label={label} parts={parts} shaded={shaded} />;
  const slice = (index: number) => {
    const a0 = (index / parts) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((index + 1) / parts) * 2 * Math.PI - Math.PI / 2;
    return `M 60 60 L ${60 + 52 * Math.cos(a0)} ${60 + 52 * Math.sin(a0)} A 52 52 0 0 1 ${60 + 52 * Math.cos(a1)} ${60 + 52 * Math.sin(a1)} Z`;
  };
  return <Frame name="fraction-circle" label={label} className="lf-pz-circle">
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {Array.from({ length: parts }, (_, index) => <path key={index} d={slice(index)} className={index < shaded ? 'lf-pz-slice lf-pz-slice--filled' : 'lf-pz-slice'} />)}
    </svg>
    <span className="lf-pz-circle-text" data-copy-role="data">{shaded}/{parts}</span>
  </Frame>;
}

// ── Ratio lines (the double number line of a ratio table) ───────────────────

export interface RatioTick { id: string; text: string; future?: boolean }
export interface RatioLine { id: string; label: string; ticks: readonly RatioTick[] }
export interface RatioGroup { id: string; title?: string; marked?: boolean; lines: readonly RatioLine[]; unit?: { label: string; value: string } }

/**
 * The ratio table as linked lines (quantity over price), per group; the unit
 * rate written out. Used by the lesson's ratio-table board (with its drag
 * handle as `overlay`) and by the Mentor's unit-price comparison.
 */
export function RatioLinesVisual({ label, groups, overlay }: { label: string; groups: readonly RatioGroup[]; overlay?: ReactNode }) {
  return <div className="lf-ratio-diagram lf-pz-ratio" role="group" aria-label={label} data-pizarron="ratio-lines">
    {groups.map((group) => <div key={group.id} className="lf-pz-ratio-group" data-marked={group.marked ? 'true' : undefined}>
      {group.title ? <p className="lf-pz-ratio-title" data-copy-role="data">{group.title}</p> : null}
      {group.lines.map((line) => <div key={line.id} className="lf-ratio-line"><span data-copy-role="data">{line.label}</span>
        <div className="lf-ratio-ticks" style={{ gridTemplateColumns: `repeat(${Math.max(1, line.ticks.length)}, minmax(0, 1fr))` }}>
          {line.ticks.map((tick) => <span key={tick.id} aria-hidden="true" className={tick.future ? 'lf-ratio-tick--future' : undefined} data-copy-role="data">{tick.text}</span>)}
          {overlay}
        </div></div>)}
      {group.unit ? <p className="lf-ratio-unit" data-copy-role="data">{group.unit.label}: <strong data-copy-role="data">{group.unit.value}</strong></p> : null}
    </div>)}
  </div>;
}

// ── Running ledger ──────────────────────────────────────────────────────────

export interface LedgerEntry { id: string; label: string; change: string; direction: 'in' | 'out'; balance: number; balanceText: string; marked?: boolean }

/**
 * Money in and out with the balance after each entry (the running ledger).
 * A balance below zero is shown by POSITION left of the zero line and a minus
 * sign, never by `error` red (05 §2).
 */
export function LedgerVisual({ label, entries, inLabel, outLabel }: { label: string; entries: readonly LedgerEntry[]; inLabel: string; outLabel: string }) {
  const scale = Math.max(1, ...entries.map((entry) => Math.abs(entry.balance)));
  return <Frame name="ledger" label={label}>
    <ol className="lf-pz-ledger">
      {entries.map((entry) => {
        const share = Math.abs(entry.balance) / scale / 2;
        const style: CSSProperties = entry.balance < 0 ? { insetInlineEnd: '50%', inlineSize: pct(share) } : { insetInlineStart: '50%', inlineSize: pct(share) };
        return <li key={entry.id} className="lf-pz-ledger-row" data-marked={entry.marked ? 'true' : undefined} data-direction={entry.direction}>
          <span className="lf-pz-ledger-change" data-copy-role="data">{entry.direction === 'in' ? inLabel : outLabel} {entry.change}</span>
          <span className="lf-pz-ledger-label" data-copy-role="data">{entry.label}</span>
          <span className="lf-pz-ledger-track" aria-hidden="true"><span className="lf-pz-ledger-zero" /><span className="lf-pz-ledger-balance" style={style} /></span>
          <span className="lf-pz-ledger-value" data-copy-role="data">{entry.balanceText}</span>
        </li>;
      })}
    </ol>
  </Frame>;
}

// ── Worked steps ────────────────────────────────────────────────────────────

export interface WorkedStep { id: string; marker: string; expression: string; result?: string; state?: 'complete' | 'active' | 'pending' }
export interface WorkedStepRow { id: string; marker: string; expression: ReactNode; detail?: ReactNode; state?: 'complete' | 'active' | 'pending' }

/**
 * The worked-example step list itself, shared by the Mentor's static board and
 * the lesson's interactive worked example (which puts its prediction or fading
 * field in `detail`). It is not an image, so a field inside it stays reachable.
 */
export function WorkedStepsList({ steps, loop = false }: { steps: readonly WorkedStepRow[]; loop?: boolean }) {
  return <ol className="lf-worked-example-steps" data-loop={loop ? 'true' : undefined} data-pizarron="worked-steps-list">
    {steps.map((step) => <li key={step.id}
      className={`lf-worked-example-step${step.state === 'active' ? ' lf-worked-example-step--active' : step.state === 'complete' ? ' lf-worked-example-step--complete' : ''}`}>
      <span className="lf-worked-example-number" data-copy-role="data">{step.marker}</span>
      <span className="lf-worked-example-expression" data-copy-role="data">{step.expression}</span>
      {step.detail ?? null}
    </li>)}
  </ol>;
}

/** A worked example written out step by step (05 §7 "Worked examples"); also a cycle and an ordered list of stages. */
export function WorkedStepsVisual({ label, steps, loop = false }: { label: string; steps: readonly WorkedStep[]; loop?: boolean }) {
  return <Frame name="worked-steps" label={label}>
    <WorkedStepsList loop={loop} steps={steps.map((step) => ({ id: step.id, marker: step.marker, state: step.state,
      expression: <>{step.expression}{step.result ? <> = <strong data-copy-role="data">{step.result}</strong></> : null}</> }))} />
    {loop ? <span className="lf-pz-loop" data-copy-role="data" aria-hidden="true">↻</span> : null}
  </Frame>;
}

// ── Growth lines ────────────────────────────────────────────────────────────

export interface GrowthSeries { id: string; label: string; values: readonly number[]; endText: string; series: SeriesTone; highlighted?: boolean }

/**
 * Values over time as lines (the growth and growth-comparison chart): x is the
 * period, y the value, each line in its series style (solid, dashed, dotted)
 * with its label and final value written at its end. `shown` hides the points
 * a learner has not revealed yet (your turn).
 */
export function GrowthLinesVisual({ label, series, startLabel, endLabel, maxText, shown, threshold, marker, max: fixedMax, count }: {
  label: string; series: readonly GrowthSeries[]; startLabel: string; endLabel: string; maxText: string; shown?: number;
  /** GAP-FIX-R4: a reference line (the doubling line) with its HTML label, and the flag where a line first reaches it. */
  threshold?: { value: number; label: string }; marker?: number;
  /** GAP-FIX-R4: a fixed scale and period count, so a run and its ghost share one frame (debt payoff). */
  max?: number; count?: number;
}) {
  const length = Math.max(2, count ?? 0, ...series.map((s) => s.values.length));
  // Only what is shown sets the scale: a hidden value must not be readable off the axis.
  const max = fixedMax ?? Math.max(1, threshold?.value ?? 0, ...series.flatMap((s) => (shown === undefined ? s.values : s.values.slice(0, shown))));
  const yOf = (value: number) => 144 - (120 * Math.max(0, Math.min(value, max))) / max;
  const point = (value: number, index: number) => `${24 + (252 * index) / (length - 1)},${yOf(value)}`;
  const dots = length <= 40;
  return <Frame name="growth-lines" label={label} className="lf-pz-growth">
    <div className="lf-growth-compare-chart">
      <svg viewBox="0 0 300 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line x1="24" y1="24" x2="24" y2="144" className="lf-growth-compare-axis" />
        <line x1="24" y1="144" x2="276" y2="144" className="lf-growth-compare-axis" />
        {threshold ? <line x1="24" x2="276" y1={yOf(threshold.value)} y2={yOf(threshold.value)} className="lf-op-threshold-line" /> : null}
        {series.map((s) => {
          const visible = shown === undefined ? s.values : s.values.slice(0, shown);
          return <g key={s.id} className={`lf-pz-growth-line lf-pz-stroke--${s.series}`} data-highlighted={s.highlighted ? 'true' : undefined}>
            <polyline points={visible.map(point).join(' ')} />
            {dots ? visible.map((value, index) => <circle key={index} cx={point(value, index).split(',')[0]} cy={point(value, index).split(',')[1]} r="4" />) : null}
          </g>;
        })}
        {threshold && marker !== undefined && marker >= 0 ? <g className="lf-op-flag" transform={`translate(${24 + (252 * marker) / (length - 1)} ${yOf(threshold.value)})`}>
          <line x1="0" y1="0" x2="0" y2={144 - yOf(threshold.value)} className="lf-op-flag-stem" /><circle r="6" className="lf-op-flag-dot" />
        </g> : null}
      </svg>
      <span className="lf-growth-compare-scale-max" aria-hidden="true" data-copy-role="data">{maxText}</span>
      {threshold ? <span className="lf-pz-threshold-label" aria-hidden="true" data-copy-role="data"
        style={{ insetBlockStart: `${(yOf(threshold.value) / 160) * 100}%` }}>{threshold.label}</span> : null}
    </div>
    <ul className="lf-pz-key">
      {series.map((s) => <li key={s.id} data-marked={s.highlighted ? 'true' : undefined}>
        <span className={`lf-pz-swatch lf-pz-fill--${s.series}`} aria-hidden="true" /><span data-copy-role="data">{s.endText ? `${s.label}: ${s.endText}` : s.label}</span>
      </li>)}
    </ul>
    <div className="lf-growth-compare-axis-labels"><span data-copy-role="data">{startLabel}</span><span data-copy-role="data">{endLabel}</span></div>
  </Frame>;
}

// ── Waffle (a whole split into categories) ─────────────────────────────────

export interface WaffleCategory { id: string; label: string; value: string; share: number; series: SeriesTone }

/**
 * A whole split into shares on a 10 × 10 grid (the allocation waffle), each
 * category in its series style with a direct label. Cells are assigned by the
 * largest remainder so the grid always shows 100 cells.
 */
export function WaffleVisual({ label, categories }: { label: string; categories: readonly WaffleCategory[] }) {
  const raw = categories.map((c) => clamp01(c.share) * 100);
  const cells = raw.map(Math.floor);
  const order = raw.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest);
  for (let i = 0; cells.reduce((a, b) => a + b, 0) < 100 && raw.some((v) => v > 0) && i < order.length * 2; i++) cells[order[i % order.length]!.index]! += 1;
  const grid = cells.flatMap((count, index) => Array.from({ length: count }, () => categories[index]!.series));
  return <Frame name="waffle" label={label} className="lf-learning-waffle">
    <div className="lf-learning-waffle-grid" aria-hidden="true">
      {Array.from({ length: 100 }, (_, index) => <span key={index} className={`lf-pz-waffle-cell${grid[index] ? ` lf-pz-fill--${grid[index]}` : ''}`} />)}
    </div>
    <ul className="lf-pz-key">
      {categories.map((c) => <li key={c.id}><span className={`lf-pz-swatch lf-pz-fill--${c.series}`} aria-hidden="true" /><span data-copy-role="data">{c.label}: {c.value}</span></li>)}
    </ul>
  </Frame>;
}

// ── Coins ──────────────────────────────────────────────────────────────────

/** `kind: 'bill'` draws a simplified note token in the same reward family (GAP-FIX-R4, Bible 05 §7 Money). */
export interface CoinGroup { id: string; label: string; count: number; subtotal?: string; kind?: 'coin' | 'bill' }

/**
 * Piles of coins or notes (05 §2: coins use `reward` with the ridge outline;
 * notes are simplified tokens of the same family, never the wallet's save or
 * spend hues). Up to 20 are drawn per pile; the count is written. The lesson
 * coin tray ($1, $2) and the Mentor's tokens, trade and change draw with it.
 */
export function CoinGroupsVisual({ label, groups, total, arrow = false, aside }: { label: string; groups: readonly CoinGroup[]; total?: string; arrow?: boolean; aside?: ReactNode }) {
  return <Frame name="coin-groups" label={label}>
    <div className="lf-pz-coins" data-arrow={arrow ? 'true' : undefined}>
      {groups.map((group, groupIndex) => <div key={group.id} className="lf-pz-coin-group" data-kind={group.kind ?? 'coin'}>
        {arrow && groupIndex > 0 ? <span className="lf-pz-coin-arrow" aria-hidden="true" data-copy-role="data">→</span> : null}
        <span className="lf-pz-coin-pile" aria-hidden="true">
          {Array.from({ length: Math.min(20, Math.max(0, group.count)) }, (_, index) => <span key={index} className={group.kind === 'bill' ? 'lf-pz-coin-bill' : 'lf-pz-coin'} />)}
        </span>
        <span data-copy-role="data">{group.count} × {group.label}{group.subtotal ? ` = ${group.subtotal}` : ''}</span>
      </div>)}
      {aside}
    </div>
    {total ? <p className="lf-pz-note" data-copy-role="data">{total}</p> : null}
  </Frame>;
}

// ── Early number: ten frames, bead strings, arrays, tallies, pictographs ────

/** Ten frames (2 × 5), filled left to right; one frame per ten. */
export function TenFrameVisual({ label, frames, total }: { label: string; frames: readonly number[]; total?: string }) {
  return <Frame name="ten-frame" label={label}>
    <div className="lf-pz-ten-frames">
      {frames.map((count, frame) => <div key={frame} className="lf-pz-ten-frame" aria-hidden="true">
        {Array.from({ length: 10 }, (_, cell) => <span key={cell} className={cell < count ? 'lf-pz-counter lf-pz-counter--on' : 'lf-pz-counter'} />)}
      </div>)}
    </div>
    {total ? <p className="lf-pz-note" data-copy-role="data">{total}</p> : null}
  </Frame>;
}

/** Bead strings: beads in groups of five, alternating solid and outlined (grouping, not a second series). */
export function BeadStringVisual({ label, rows, total }: { label: string; rows: readonly number[]; total?: string }) {
  return <Frame name="bead-string" label={label}>
    <div className="lf-pz-beads">
      {rows.map((count, row) => <div key={row} className="lf-pz-bead-row" aria-hidden="true">
        {Array.from({ length: Math.min(30, Math.max(0, count)) }, (_, bead) => <span key={bead} className={Math.floor(bead / 5) % 2 === 0 ? 'lf-pz-bead' : 'lf-pz-bead lf-pz-bead--alt'} />)}
      </div>)}
    </div>
    {total ? <p className="lf-pz-note" data-copy-role="data">{total}</p> : null}
  </Frame>;
}

/** An array: rows × columns of equal groups, with the value of one and the total written. */
export function ArrayVisual({ label, rows, columns, caption }: { label: string; rows: number; columns: number; caption: readonly string[] }) {
  const r = Math.max(1, Math.min(12, rows));
  const c = Math.max(1, Math.min(12, columns));
  return <Frame name="array" label={label}>
    <div className="lf-pz-array" style={{ gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))` }} aria-hidden="true">
      {Array.from({ length: r * c }, (_, index) => <span key={index} className="lf-pz-counter lf-pz-counter--on" />)}
    </div>
    <ul className="lf-pz-caption">{caption.map((line, index) => <li key={index} data-copy-role="data">{line}</li>)}</ul>
  </Frame>;
}

export interface TallyRow { id: string; label: string; fives: number; ones: number; count: string }

/** Tally marks in bundles of five (four strokes and a crossing one). */
export function TallyVisual({ label, rows }: { label: string; rows: readonly TallyRow[] }) {
  return <Frame name="tally" label={label}>
    <ul className="lf-pz-tally">
      {rows.map((row) => <li key={row.id}>
        <span data-copy-role="data">{row.label}</span>
        <svg viewBox={`0 0 ${Math.max(1, row.fives * 34 + row.ones * 8)} 28`} className="lf-pz-tally-marks" aria-hidden="true" focusable="false"
          style={{ inlineSize: `${Math.max(8, row.fives * 34 + row.ones * 8)}px` }}>
          {Array.from({ length: row.fives }, (_, five) => <g key={five} transform={`translate(${five * 34} 0)`}>
            {[3, 9, 15, 21].map((x) => <line key={x} x1={x} x2={x} y1="3" y2="25" />)}
            <line x1="0" y1="22" x2="25" y2="6" />
          </g>)}
          {Array.from({ length: row.ones }, (_, one) => <line key={one} x1={row.fives * 34 + one * 8 + 3} x2={row.fives * 34 + one * 8 + 3} y1="3" y2="25" />)}
        </svg>
        <span data-copy-role="data">{row.count}</span>
      </li>)}
    </ul>
  </Frame>;
}

export interface PictographRow { id: string; label: string; count: number; total: string }

/** A pictograph: one symbol per unit, with the key saying what one symbol is worth. */
export function PictographVisual({ label, rows, keyText }: { label: string; rows: readonly PictographRow[]; keyText: string }) {
  return <Frame name="pictograph" label={label}>
    <ul className="lf-pz-picto">
      {rows.map((row) => <li key={row.id}>
        <span data-copy-role="data">{row.label}</span>
        <span className="lf-pz-picto-icons" aria-hidden="true">{Array.from({ length: Math.min(24, Math.max(0, row.count)) }, (_, index) => <span key={index} className="lf-pz-counter lf-pz-counter--on" />)}</span>
        <span data-copy-role="data">{row.total}</span>
      </li>)}
    </ul>
    <p className="lf-pz-note" data-copy-role="data"><span className="lf-pz-counter lf-pz-counter--on" aria-hidden="true" /> {keyText}</p>
  </Frame>;
}

// ── Balance scale and Venn ──────────────────────────────────────────────────

/** A balance: the heavier side sinks; each pan names its side and value; the difference is written. */
export function BalanceScaleVisual({ label, left, right, tilt, difference }: {
  label: string; left: { label: string; value: string }; right: { label: string; value: string }; tilt: 'left' | 'right' | 'level'; difference: string;
}) {
  const angle = tilt === 'left' ? -8 : tilt === 'right' ? 8 : 0;
  return <Frame name="balance-scale" label={label} className="lf-pz-scale">
    <svg viewBox="0 0 300 150" aria-hidden="true" focusable="false">
      <path d="M 150 60 L 132 136 L 168 136 Z" className="lf-pz-scale-post" />
      <g transform={`rotate(${angle} 150 60)`}>
        <line x1="40" y1="60" x2="260" y2="60" className="lf-pz-scale-beam" />
        <path d="M 16 90 Q 40 112 64 90 Z" className="lf-pz-scale-pan lf-pz-fill-svg--sky" />
        <path d="M 236 90 Q 260 112 284 90 Z" className="lf-pz-scale-pan lf-pz-fill-svg--mint" />
        <line x1="40" y1="60" x2="40" y2="90" className="lf-pz-scale-cord" /><line x1="260" y1="60" x2="260" y2="90" className="lf-pz-scale-cord" />
      </g>
    </svg>
    <div className="lf-pz-scale-sides">
      <span data-series="sky" data-copy-role="data">{left.label}: {left.value}</span>
      <span data-series="mint" data-copy-role="data">{right.label}: {right.value}</span>
    </div>
    <p className="lf-pz-note" data-copy-role="data">{difference}</p>
  </Frame>;
}

export type VennRegionKey = 'left' | 'both' | 'right' | 'neither';
type VennRegion = { count: string; items: readonly string[] };

/**
 * Two sets and their regions: each region lists its items and its count (the
 * circles are outlines, sky and dashed mint). GAP-FIX-R4 (Appendix P L5): the
 * relation draws the three Euler layouts - `overlap` (two crossing circles),
 * `subset` (the left set nested inside the right; no "only left" region) and
 * `disjoint` (two circles apart; no "both" region) - and an optional `neither`
 * region. A lesson board passes `targetProps` to make the regions drop targets
 * and `overlay` for its own controls; the visual is then a group, not an image.
 * The Mentor's venn and the lesson's Euler board draw with this one component.
 */
export function VennVisual({ label, leftLabel, rightLabel, bothLabel, neitherLabel, regions, relation = 'overlap', targetProps, overlay }: {
  label: string; leftLabel: string; rightLabel: string; bothLabel: string; neitherLabel?: string;
  regions: Partial<Record<VennRegionKey, VennRegion>> & { both?: VennRegion };
  relation?: 'overlap' | 'subset' | 'disjoint';
  targetProps?: (key: VennRegionKey) => DropTargetProps | undefined; overlay?: ReactNode;
}) {
  const names: Record<VennRegionKey, string> = { left: leftLabel, both: bothLabel, right: rightLabel, neither: neitherLabel ?? '' };
  const shown: VennRegionKey[] = (relation === 'subset' ? ['both', 'right'] : relation === 'disjoint' ? ['left', 'right'] : ['left', 'both', 'right'] as VennRegionKey[])
    .concat(neitherLabel !== undefined ? ['neither'] : []) as VennRegionKey[];
  const region = (key: VennRegionKey) => {
    const content = regions[key] ?? { count: '0', items: [] };
    const extra = targetProps?.(key);
    return <div key={key} {...extra} className={`lf-pz-venn-region lf-pz-venn-region--${key}${extra?.className ? ` ${extra.className}` : ''}`}>
      <strong data-copy-role="data">{names[key]} · {content.count}</strong>
      <ul>{content.items.map((item, index) => <li key={index} data-copy-role="data">{item}</li>)}</ul>
    </div>;
  };
  return <Frame name="venn" label={label} className={`lf-pz-venn lf-pz-venn--${relation}`} interactive={Boolean(targetProps || overlay)}>
    <svg viewBox="0 0 300 150" aria-hidden="true" focusable="false">
      {relation === 'subset' ? <>
        <ellipse cx="150" cy="75" rx="140" ry="70" className="lf-pz-venn-set lf-pz-stroke--mint" />
        <ellipse cx="150" cy="82" rx="66" ry="40" className="lf-pz-venn-set lf-pz-stroke--sky" />
      </> : relation === 'disjoint' ? <>
        <circle cx="78" cy="75" r="64" className="lf-pz-venn-set lf-pz-stroke--sky" />
        <circle cx="222" cy="75" r="64" className="lf-pz-venn-set lf-pz-stroke--mint" />
      </> : <>
        <circle cx="115" cy="75" r="66" className="lf-pz-venn-set lf-pz-stroke--sky" />
        <circle cx="185" cy="75" r="66" className="lf-pz-venn-set lf-pz-stroke--mint" />
      </>}
    </svg>
    <div className="lf-pz-venn-regions" data-regions={shown.length}>{shown.map(region)}</div>
    {overlay}
  </Frame>;
}

// ── Sorting, dealing, chance and text cards ────────────────────────────────

/** `marked` rings the one bin the board selects (the "it depends" bin keeps an outline, never a hue). */
export interface SortBin { id: string; label: string; count?: string; items: readonly string[]; marked?: boolean }

/**
 * Things sorted into labelled groups (the Mentor's two bins, the lesson's L10
 * and $10 sorts). A lesson board passes `targetProps` to make each bin a drop
 * target (GAP-FIX-R4); the visual is then a group, not an image.
 */
export function SortBinsVisual({ label, bins, targetProps }: { label: string; bins: readonly SortBin[]; targetProps?: (id: string) => DropTargetProps | undefined }) {
  return <Frame name="sort-bins" label={label} interactive={Boolean(targetProps)}>
    <div className="lf-pz-bins">
      {bins.map((bin) => {
        const extra = targetProps?.(bin.id);
        return <div key={bin.id} {...extra} className={`lf-pz-bin${bin.marked ? ' lf-pz-bin--rest' : ''}${extra?.className ? ` ${extra.className}` : ''}`}>
          <strong data-copy-role="data">{bin.label}{bin.count ? ` · ${bin.count}` : ''}</strong>
          <ul>{bin.items.map((item, index) => <li key={index} data-copy-role="data">{item}</li>)}</ul>
        </div>;
      })}
    </div>
  </Frame>;
}

/** Sharing out equally: each group gets the same number of counters; what is left over sits apart. */
export function DealVisual({ label, bins, perBin, remainder, remainderLabel, total }: {
  label: string; bins: readonly string[]; perBin: number; remainder: number; remainderLabel: string; total: string;
}) {
  const pile = (count: number) => <span className="lf-pz-deal-pile" aria-hidden="true">
    {Array.from({ length: Math.min(20, Math.max(0, count)) }, (_, index) => <span key={index} className="lf-pz-counter lf-pz-counter--on" />)}
  </span>;
  return <Frame name="deal" label={label}>
    <div className="lf-pz-bins">
      {bins.map((bin, index) => <div key={index} className="lf-pz-bin"><strong data-copy-role="data">{bin} · {perBin}</strong>{pile(perBin)}</div>)}
      {remainder > 0 ? <div className="lf-pz-bin lf-pz-bin--rest"><strong data-copy-role="data">{remainderLabel} · {remainder}</strong>{pile(remainder)}</div> : null}
    </div>
    <p className="lf-pz-note" data-copy-role="data">{total}</p>
  </Frame>;
}

export interface ChanceOutcome { id: string; label: string; count: number; countText: string; series: SeriesTone }

/** Chance as an icon array of 100 in rows of ten (05 §7 "Probability"): counts first ("12 of 100"). */
export function IconArrayVisual({ label, outcomes }: { label: string; outcomes: readonly ChanceOutcome[] }) {
  const cells = outcomes.flatMap((outcome) => Array.from({ length: Math.max(0, outcome.count) }, () => outcome.series)).slice(0, 100);
  return <Frame name="icon-array" label={label}>
    <div className="lf-pz-icons" aria-hidden="true">
      {Array.from({ length: 100 }, (_, index) => <span key={index} className={`lf-pz-icon${cells[index] ? ` lf-pz-fill--${cells[index]}` : ''}`} />)}
    </div>
    <ul className="lf-pz-key">
      {outcomes.map((o) => <li key={o.id}><span className={`lf-pz-swatch lf-pz-fill--${o.series}`} aria-hidden="true" /><span data-copy-role="data">{o.label}: {o.countText}</span></li>)}
    </ul>
  </Frame>;
}

export interface TextCard { id: string; title: string; lines: readonly string[]; marked?: boolean }

/** Words side by side (two outcomes, the two sides of a trade, a price tag, the L1 rule cards): neutral cards, no hue meaning. */
export function TextCardsVisual({ label, cards, joiner }: { label: string; cards: readonly TextCard[]; joiner?: string }) {
  return <Frame name="text-cards" label={label}>
    <div className="lf-pz-cards">
      {cards.map((card, index) => <div key={card.id} className="lf-pz-card-slot">
        {joiner && index > 0 ? <span className="lf-pz-card-joiner" aria-hidden="true" data-copy-role="data">{joiner}</span> : null}
        <div className="lf-pz-card" data-marked={card.marked ? 'true' : undefined}>
          <strong data-copy-role="data">{card.title}</strong>
          {card.lines.map((line, lineIndex) => <p key={lineIndex} data-copy-role="data">{line}</p>)}
        </div>
      </div>)}
    </div>
  </Frame>;
}

/** A container filling up (a ten frame, a bar or a jar), for the learner's own fill. */
export function FillContainerVisual({ label, container, capacity, filled }: { label: string; container: 'ten_frame' | 'bar' | 'jar'; capacity: number; filled: number }) {
  if (container === 'ten_frame') {
    const frames = Array.from({ length: Math.max(1, Math.ceil(capacity / 10)) }, (_, frame) => Math.max(0, Math.min(10, filled - frame * 10)));
    return <TenFrameVisual label={label} frames={frames} />;
  }
  const share = capacity > 0 ? filled / capacity : 0;
  return <Frame name="fill-container" label={label} className={`lf-pz-fill-box lf-pz-fill-box--${container}`}>
    <span className="lf-pz-fill-level lf-pz-fill--sky" style={container === 'jar' ? { blockSize: pct(share) } : { inlineSize: pct(share) }} aria-hidden="true" />
  </Frame>;
}
