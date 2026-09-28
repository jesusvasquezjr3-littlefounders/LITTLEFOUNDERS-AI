import { useId, type ReactNode } from 'react';
import { seriesTone, type SeriesTone } from './visuals';
import '../learning.css';
import '../growth.css';
import '../growthComparison.css';
import '../goalBullet.css';
import '../numberLine.css';
import '../percentGrid.css';
import '../placeValue.css';
import '../runningLedger.css';
import '../savingsRule.css';
import '../taxBracket.css';
import './pizarron.css';

/*
 * THE LESSON PICTURES OF THE SHARED PIZARRÓN (product B.7: "one component set"
 * for the lessons and the Mentor's board).
 *
 * These are the pictures the lesson boards draw beside their interactive
 * layers (sliders, steppers, predictions, fading). Each one is PRESENTATION
 * ONLY, like the rest of the library: it draws the values it is given, and
 * scaling a length to the board is its only computation. The board keeps its
 * model, its controls and its table; the picture lives here, so the Mentor's
 * board and every lesson draw from one set.
 *
 * Hue rules (05 §2): series are sky, mint and berry in that order, with the
 * pattern channel from the second series on (mint diagonal, berry dots) and
 * the neutral crosshatch overflow for a fourth or later series. `primary`
 * only marks the learner's own selection (a prediction, the placed marker).
 * Money manipulables keep the wallet meanings (mint save, sky spend, berry
 * share).
 */

/** The static-chart wrapper: a described image, marked as a shared Pizarrón picture. */
function Picture({ name, label, className, children }: { name: string; label: string; className?: string; children: ReactNode }) {
  return <div className={className} role="img" aria-label={label} data-pizarron={name}>{children}</div>;
}

/** An SVG-safe id prefix (React ids carry colons). */
function usePatternId(): string {
  return useId().replaceAll(':', '');
}

/**
 * SVG patterns for the second and later series: mint diagonal, berry dots and
 * the neutral crosshatch overflow, drawn on the strong hue with surface marks.
 */
function SeriesPatternDefs({ id }: { id: string }) {
  return <defs>
    <pattern id={`${id}-mint`} patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" className="lf-pz-svg-base--mint" />
      <path d="M-2 8 L8 -2 M2 10 L10 2" className="lf-pz-svg-mark" />
    </pattern>
    <pattern id={`${id}-berry`} patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" className="lf-pz-svg-base--berry" />
      <circle cx="4" cy="4" r="1.5" className="lf-pz-svg-dot" />
    </pattern>
    <pattern id={`${id}-overflow`} patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" className="lf-pz-svg-base--overflow" />
      <path d="M-2 8 L8 -2 M2 10 L10 2 M-2 0 L8 10 M0 -2 L10 8" className="lf-pz-svg-hatch" />
    </pattern>
  </defs>;
}

/** The SVG fill of a series: the first series is solid, the rest carry their pattern. */
function seriesSvgFill(tone: SeriesTone, id: string): string {
  return tone === 'sky' ? 'var(--sky-strong)' : `url(#${id}-${tone})`;
}

// ── Balance meter (the running ledger's balance against zero) ──────────────

/**
 * One balance above or below the zero line. A balance below zero is shown by
 * POSITION under the line (and the words beside it), never by `error` red.
 */
export function BalanceMeterVisual({ label, balance, scale, aboveLabel, zeroLabel, belowLabel }: {
  label: string; balance: number; scale: number; aboveLabel: string; zeroLabel: string; belowLabel: string;
}) {
  const range = Math.max(1, Math.abs(scale));
  const extent = 62 * Math.min(1, Math.abs(balance) / range);
  return <Picture name="balance-meter" label={label} className="lf-ledger-visual">
    <svg viewBox="0 0 220 160" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <line x1="24" y1="80" x2="196" y2="80" className="lf-ledger-zero" />
      <rect x="92" y={balance >= 0 ? 80 - extent : 80} width="36" height={Math.max(extent, 1)} className="lf-ledger-bar" />
      <circle cx="110" cy={80 - (balance >= 0 ? extent : -extent)} r="6" className="lf-ledger-point" />
    </svg>
    <div className="lf-ledger-axis" data-copy-role="data"><span>{aboveLabel}</span><span>{zeroLabel}</span><span>{belowLabel}</span></div>
  </Picture>;
}

// ── Percent grid (a hundred-grid beside a percent bar) ─────────────────────

/** `percent` cells of a 10 × 10 grid, and the same share as a bar. */
export function PercentGridVisual({ label, percent, percentText, ofHundredText }: {
  label: string; percent: number; percentText: string; ofHundredText: string;
}) {
  const filled = Math.max(0, Math.min(100, Math.round(percent)));
  return <Picture name="percent-grid" label={label} className="lf-percent-plot">
    <svg className="lf-percent-grid" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {Array.from({ length: 100 }, (_, index) => <rect key={index} x={index % 10 * 12 + 1} y={Math.floor(index / 10) * 12 + 1}
        width="10" height="10" rx="2" className={index < filled ? 'lf-percent-cell--filled' : 'lf-percent-cell'} />)}
    </svg>
    <div className="lf-percent-bar-set"><span data-copy-role="data">{percentText}</span>
      <svg className="lf-percent-bar" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <rect x="0" y="8" width="120" height="16" rx="8" className="lf-percent-bar-track" />
        <rect x="0" y="8" width={120 * filled / 100} height="16" rx="8" className="lf-percent-bar-fill" />
      </svg><span data-copy-role="data">{ofHundredText}</span></div>
  </Picture>;
}

// ── Stacked brackets (one whole split into consecutive slices) ─────────────

export interface StackSlice { id: string; amount: number; keyText: string }

/**
 * A whole split into consecutive slices (the tax brackets): each slice is as
 * long as its amount over the whole, in series order with the pattern channel,
 * and each has a written key.
 */
export function StackedSlicesVisual({ label, slices }: { label: string; slices: readonly StackSlice[] }) {
  const id = usePatternId();
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.amount), 0);
  let offset = 0;
  return <Picture name="stacked-slices" label={label} className="lf-tax-chart">
    <svg className="lf-tax-stack" viewBox="0 0 300 72" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <SeriesPatternDefs id={id} />
      {slices.map((slice, index) => {
        const width = total === 0 ? 0 : Math.max(0, slice.amount) / total * 300;
        const x = offset;
        offset += width;
        const tone = seriesTone(index);
        return <rect key={slice.id} className={`lf-tax-slice lf-tax-slice--${tone}`} x={x} y="0" width={width} height="72" fill={seriesSvgFill(tone, id)} />;
      })}
    </svg>
    <div className="lf-tax-legend">{slices.map((slice, index) => <span key={slice.id} data-copy-role="data">
      <i className={`lf-tax-swatch lf-pz-strong--${seriesTone(index)}`} aria-hidden="true" />{slice.keyText}</span>)}</div>
  </Picture>;
}

// ── Base ten (tens rods and ones cubes) ─────────────────────────────────────

/** Tens as rods of ten and ones as single cubes, each group with its written count. */
export function BaseTenVisual({ label, hundreds, tens, ones, hundredsText, tensText, onesText }: {
  label: string; hundreds?: number; tens: number; ones: number; hundredsText?: string; tensText: string; onesText: string;
}) {
  // Bible 05 §7: hundreds are flats (a 10 x 10 square), tens are rods, ones are units.
  const flats = hundredsText !== undefined;
  return <Picture name="base-ten" label={label} className={`lf-place-value-plot${flats ? ' lf-place-value-plot--three' : ''}`}>
    {flats ? <div className="lf-place-value-group"><span data-copy-role="data">{hundredsText}</span>
      <div className="lf-place-value-flats" aria-hidden="true">{Array.from({ length: Math.max(0, hundreds ?? 0) }, (_, index) =>
        <span className="lf-place-value-flat" key={index}>{Array.from({ length: 100 }, (_, cell) => <i key={cell} />)}</span>)}</div>
    </div> : null}
    <div className="lf-place-value-group"><span data-copy-role="data">{tensText}</span>
      <div className="lf-place-value-rods" aria-hidden="true">{Array.from({ length: Math.max(0, tens) }, (_, index) =>
        <span className="lf-place-value-rod" key={index}>{Array.from({ length: 10 }, (_, cell) => <i key={cell} />)}</span>)}</div>
    </div>
    <div className="lf-place-value-group"><span data-copy-role="data">{onesText}</span>
      <div className="lf-place-value-ones" aria-hidden="true">{Array.from({ length: Math.max(0, ones) }, (_, index) => <i key={index} />)}</div>
    </div>
  </Picture>;
}

// ── Savings line (one balance over time) ────────────────────────────────────

export interface LinePoint { x: number; y: number }

/** One series over time, on axes from zero, with the end value marked and both ends of the scale written. */
export function SavingsLineVisual({ label, points, xMax, yMax, yMaxText, startText, endText }: {
  label: string; points: readonly LinePoint[]; xMax: number; yMax: number; yMaxText: string; startText: string; endText: string;
}) {
  const width = Math.max(1, xMax);
  const height = Math.max(1, yMax);
  const last = points.at(-1)?.y ?? 0;
  const polyline = points.map((point) => `${20 + point.x * 270 / width},${140 - point.y * 120 / height}`).join(' ');
  return <>
    <div className="lf-growth-scale-max" data-copy-role="data">{yMaxText}</div>
    <Picture name="savings-line" label={label} className="lf-growth-chart">
      <svg viewBox="0 0 300 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line x1="20" y1="20" x2="20" y2="140" className="lf-growth-axis" />
        <line x1="20" y1="140" x2="290" y2="140" className="lf-growth-axis" />
        <polyline points={polyline} className="lf-growth-line" />
      </svg>
      <span className="lf-growth-point" style={{ left: `${290 / 300 * 100}%`, top: `${(140 - last * 120 / height) / 160 * 100}%` }} aria-hidden="true" />
    </Picture>
    <div className="lf-growth-axis-labels"><span data-copy-role="data">{startText}</span><span data-copy-role="data">{endText}</span></div>
  </>;
}

// ── Growth comparison (two growth rules and the learner's prediction) ──────

export interface ComparePoint { year: number; first: number; second: number }

/**
 * Two series over the same years (simple and compound growth): the first is
 * solid sky, the second dashed mint and drawn only once `showSecond` is true
 * (predict, then reveal). The learner's prediction is their own mark, so it
 * carries `primary`; above the scale it becomes an arrow at the top edge.
 */
export function GrowthCompareVisual({ label, points, years, axisMaximum, showSecond, prediction, predictionAboveScale, maxText }: {
  label: string; points: readonly ComparePoint[]; years: number; axisMaximum: number; showSecond: boolean;
  prediction: number; predictionAboveScale: boolean; maxText: string;
}) {
  const span = Math.max(1, years);
  const top = Math.max(1, axisMaximum);
  const x = (year: number) => 24 + year * 252 / span;
  const y = (value: number) => 144 - value * 120 / top;
  const first = points.map((point) => `${x(point.year)},${y(point.first)}`).join(' ');
  const second = points.map((point) => `${x(point.year)},${y(point.second)}`).join(' ');
  return <Picture name="growth-compare" label={label} className="lf-growth-compare-chart">
    <svg viewBox="0 0 300 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="24" y1="24" x2="24" y2="144" className="lf-growth-compare-axis" />
      <line x1="24" y1="144" x2="276" y2="144" className="lf-growth-compare-axis" />
      <polyline points={first} className="lf-growth-compare-simple" />
      {showSecond ? <polyline points={second} className="lf-growth-compare-compound" /> : null}
      {predictionAboveScale
        ? <path d="M 269 32 L 276 20 L 283 32 Z" className="lf-growth-compare-prediction" />
        : <circle cx="276" cy={y(prediction)} r="6" className="lf-growth-compare-prediction" />}
    </svg>
    <span className="lf-growth-compare-scale-max" aria-hidden="true" data-copy-role="data">{maxText}</span>
  </Picture>;
}

// ── Goal bullet (progress toward a target) ──────────────────────────────────

/** A bullet graph: the track, the band up to the target, the progress bar and the target line (shares of the scale, 0–1). */
export function GoalBulletVisual({ label, progress, target }: { label: string; progress: number; target: number }) {
  const clamp = (share: number) => Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
  const goal = 300 * clamp(target);
  return <Picture name="goal-bullet" label={label} className="lf-goal-visual">
    <svg viewBox="0 0 300 84" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {/* The track and the goal band are ground, like gridlines (05 §2): the target line and the fill carry the values. */}
      <rect x="0" y="24" width="300" height="36" rx="12" className="lf-goal-track" data-board-decoration="" />
      <rect x="0" y="24" width={goal} height="36" rx="12" className="lf-goal-band" data-board-decoration="" />
      <rect x="0" y="30" width={300 * clamp(progress)} height="24" rx="8" className="lf-goal-fill" />
      <line x1={goal} x2={goal} y1="14" y2="70" className="lf-goal-target" />
    </svg>
  </Picture>;
}

// ── Number axis (the track a learner places a point on) ────────────────────

/**
 * A number line's track with ticks at the given shares of its length (both
 * ends and the middle by default); the lesson lays its own marker and labels
 * over it.
 */
export function NumberAxisVisual({ label, ticks = [0, 0.5, 1], tall = false }: { label: string; ticks?: readonly number[]; tall?: boolean }) {
  return <Picture name="number-axis" label={label}>
    <svg viewBox="0 0 300 96" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="24" y1="52" x2="276" y2="52" className="lf-number-line-track" />
      {ticks.map((share) => {
        const x = 24 + 252 * Math.max(0, Math.min(1, share));
        return <line key={share} x1={x} x2={x} y1={tall ? 38 : 42} y2={tall ? 66 : 62} className="lf-number-line-tick" />;
      })}
    </svg>
  </Picture>;
}

// ── Addition dots (the concrete and pictorial stages of one addition) ──────

/**
 * Two groups of counters joined by a plus sign: the first group sky, the
 * second mint with its pattern channel. `concrete` draws counters on a mat;
 * `pictorial` draws the flat picture of the same groups.
 */
export function AdditionDotsVisual({ label, left, right, stage }: { label: string; left: number; right: number; stage: 'concrete' | 'pictorial' }) {
  const dots = (count: number, tone: 'left' | 'right') => <div className={`lf-cpa-dots lf-cpa-dots--${tone}`} aria-label={String(count)}>
    {Array.from({ length: Math.max(0, count) }, (_, index) => <span key={index} aria-hidden="true" />)}</div>;
  return <Picture name="addition-dots" label={label} className={stage === 'concrete' ? 'lf-cpa-concrete' : 'lf-cpa-pictorial'}>
    {stage === 'concrete' ? dots(left, 'left') : <div>{dots(left, 'left')}</div>}
    <span aria-hidden="true">+</span>
    {stage === 'concrete' ? dots(right, 'right') : <div>{dots(right, 'right')}</div>}
  </Picture>;
}

// ── Condition rule (two conditions joined by AND / OR, and the outcome) ────

export interface RuleCondition { id: string; label: string; valueText: string }

/** Two written conditions, the link between them (or "?" before one is chosen), and the outcome they give. */
export function ConditionRuleVisual({ label, conditions, linkText, outcomeText }: {
  label: string; conditions: readonly [RuleCondition, RuleCondition]; linkText: string; outcomeText: string;
}) {
  const [first, second] = conditions;
  return <Picture name="condition-rule" label={label} className="lf-rule-plot">
    <div className="lf-rule-conditions">
      <div className="lf-rule-node"><span data-copy-role="data">{first.label}</span><strong data-copy-role="data">{first.valueText}</strong></div>
      <span className="lf-rule-link" data-copy-role="data">{linkText}</span>
      <div className="lf-rule-node"><span data-copy-role="data">{second.label}</span><strong data-copy-role="data">{second.valueText}</strong></div>
    </div>
    <div className="lf-rule-outcome" data-copy-role="data">{outcomeText}</div>
  </Picture>;
}

// ── Function machine (an input, the rule box, the output) ──────────────────

/** An input going through the rule box to its output; the output reads "?" until the lesson has run it. */
export function FunctionMachineVisual({ label, inputText, ruleText, outputText }: { label: string; inputText: string; ruleText: string; outputText: string }) {
  return <Picture name="function-machine" label={label} className="lf-function-machine">
    <span className="lf-function-machine-value" data-copy-role="data">{inputText}</span><span className="lf-function-machine-arrow" aria-hidden="true">→</span>
    <span className="lf-function-machine-core" data-copy-role="label">{ruleText}</span><span className="lf-function-machine-arrow" aria-hidden="true">→</span>
    <span className="lf-function-machine-value" data-copy-role="data">{outputText}</span>
  </Picture>;
}

// ── Wallet allocation (save, spend, share) ──────────────────────────────────

export type WalletPocket = 'save' | 'spend' | 'share';
export interface PocketAmount { id: WalletPocket; amount: number }

/** Wallet patterns: spend sky diagonal, share berry dots (save is solid mint). */
function WalletPatternDefs({ id }: { id: string }) {
  return <defs>
    <pattern id={`${id}-spend`} patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" className="lf-learning-pattern-spend-base" />
      <path d="M-2 8 L8 -2 M2 10 L10 2" className="lf-learning-pattern-spend-line" />
    </pattern>
    <pattern id={`${id}-share`} patternUnits="userSpaceOnUse" width="8" height="8">
      <rect width="8" height="8" className="lf-learning-pattern-share-base" />
      <circle cx="4" cy="4" r="1.5" className="lf-learning-pattern-share-dot" />
    </pattern>
  </defs>;
}

/** Rows of a ten-by-ten waffle, one row per unit, filled save, spend, share and then left over. */
export function AllocationWaffleVisual({ label, pockets, keyText }: { label: string; pockets: readonly PocketAmount[]; keyText: string }) {
  const bounds: { id: WalletPocket; end: number }[] = [];
  let running = 0;
  for (const pocket of pockets) { running += Math.max(0, pocket.amount); bounds.push({ id: pocket.id, end: running }); }
  return <Picture name="allocation-waffle" label={label} className="lf-learning-waffle">
    <div className="lf-learning-waffle-grid" aria-hidden="true">
      {Array.from({ length: 100 }, (_, index) => {
        const row = Math.floor(index / 10);
        const kind = bounds.find((bound) => row < bound.end)?.id ?? 'left';
        return <span key={index} className={`lf-learning-waffle-cell lf-learning-waffle-cell--${kind}`} />;
      })}
    </div>
    <span className="lf-learning-waffle-key" data-copy-role="data">{keyText}</span>
  </Picture>;
}

/** A ring split into the wallet pockets as shares of the whole, with the whole written in the middle. */
export function AllocationDonutVisual({ label, pockets, total, totalText }: { label: string; pockets: readonly PocketAmount[]; total: number; totalText: string }) {
  const id = usePatternId();
  const ringLength = 2 * Math.PI * 42;
  const whole = Math.max(1, total);
  let prior = 0;
  return <Picture name="allocation-donut" label={label} className="lf-learning-donut">
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <WalletPatternDefs id={`${id}-donut`} />
      <circle cx="60" cy="60" r="42" className="lf-learning-donut-track" />
      {pockets.map((pocket) => {
        const start = prior;
        prior += Math.max(0, pocket.amount);
        return <circle key={pocket.id} cx="60" cy="60" r="42" className="lf-learning-donut-segment"
          stroke={pocket.id === 'save' ? 'var(--mint-strong)' : `url(#${id}-donut-${pocket.id})`}
          strokeDasharray={`${ringLength * Math.max(0, pocket.amount) / whole} ${ringLength}`}
          strokeDashoffset={-ringLength * start / whole} />;
      })}
    </svg>
    <span className="lf-learning-donut-total" data-copy-role="data">{totalText}</span>
  </Picture>;
}

/** One bar from zero to the whole, split into the wallet pockets. */
export function AllocationStackVisual({ label, pockets, total }: { label: string; pockets: readonly PocketAmount[]; total: number }) {
  const id = usePatternId();
  const whole = Math.max(1, total);
  let prior = 0;
  return <Picture name="allocation-stack" label={label} className="lf-learning-chart">
    <svg viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <WalletPatternDefs id={id} />
      <rect x="0" y="12" width="300" height="40" rx="20" className="lf-learning-chart-track" />
      {pockets.map((pocket) => {
        const start = prior;
        prior += Math.max(0, pocket.amount);
        return <rect key={pocket.id} x={300 * start / whole} y="12" width={300 * Math.max(0, pocket.amount) / whole} height="40"
          fill={pocket.id === 'save' ? 'var(--mint)' : `url(#${id}-${pocket.id})`} />;
      })}
    </svg>
  </Picture>;
}
