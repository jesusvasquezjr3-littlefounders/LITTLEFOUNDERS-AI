import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Locale } from '../../../design/copyBudget';
import type { LessonClientDocument } from '../../lessonDocument';
import type { LessonSequenceControl } from '../../lessonSequence';
import { BoardShell, GradedFoot, useSegmentGrade, type OnGradeSegment } from '../../segmentKit';
import type { HorizonteSegment } from '../contract';
import { Plano, planoWords, type PlanoProps, type PlanoStep } from '../plano';
import { PLANE1_COPY } from './copy';
import '../horizonte.css';
import './plane1.css';

export const fmt = (locale: Locale, value: number, digits = 2): string => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Object.is(value, -0) ? 0 : value);

export const slots = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole));

/** A step of one when the span is short enough to show every whole number, else the plane picks a nice step. */
export const tickEvery = (span: number): number => (span <= 12 ? 1 : 0);

/** The grid step that snaps one axis to whole numbers and leaves the other one free (a non-positive step means no grid). */
export const wholeOn = (axis: 'x' | 'y'): PlanoStep => (axis === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 });

/** The smallest 1, 2, 2.5, 5 or 10 times a power of ten that holds the value: a tidy top for an axis. */
export function niceCeil(value: number): number {
  if (!(value > 0)) return 1;
  const unit = 10 ** Math.floor(Math.log10(value));
  const mantissa = value / unit;
  return ([1, 2, 2.5, 5, 10].find((candidate) => mantissa <= candidate + 1e-9) ?? 10) * unit;
}

type Words = { readonly [K in 'sayEquals' | 'sayPlus' | 'sayMinus']: string };

/** The line y = mx + b as it is written and as it is spoken, both without a zero term or a one in front of x. */
export function equation(words: Words, m: number, b: number): { text: string; spoken: string } {
  const say = (value: number) => (value < 0 ? `${words.sayMinus} ${-value}` : String(value));
  const unit = Math.abs(m) === 1;
  const written = m === 0 ? '' : unit ? `${m < 0 ? '-' : ''}x` : `${m}x`;
  const spoken = m === 0 ? '' : unit ? `${m < 0 ? `${words.sayMinus} ` : ''}x` : `${say(m)} x`;
  const lead = `y ${words.sayEquals}`;
  if (!written) return { text: `y = ${b}`, spoken: `${lead} ${say(b)}` };
  if (b === 0) return { text: `y = ${written}`, spoken: `${lead} ${spoken}` };
  return b > 0
    ? { text: `y = ${written} + ${b}`, spoken: `${lead} ${spoken} ${words.sayPlus} ${b}` }
    : { text: `y = ${written} - ${-b}`, spoken: `${lead} ${spoken} ${words.sayMinus} ${-b}` };
}

/** Math the eye reads as symbols and the ear reads as words (the board's `spokenText`). */
export function Spoken({ text, spoken }: { text: string; spoken: string }) {
  return <span role="img" aria-label={spoken}>{text}</span>;
}

/** A fraction written n/d and spoken "n over d". */
export function Fraction({ n, d, over }: { n: number | string; d: number | string; over: string }) {
  return <Spoken text={`${n}/${d}`} spoken={slots(over, { n, d })} />;
}

/**
 * The shared plane of the board. A point label sits on the right of its mark; past the middle of the plane it is marked
 * to sit on the left instead, so no label runs off the edge of a narrow figure. Plano renders its marks itself, so the
 * mark is set from outside and kept when Plano swaps the figure for its table and back.
 */
export function PlaneFigure({ locale, copy, ...props }: PlanoProps & { locale: Locale }) {
  const ref = useRef<HTMLDivElement>(null);
  const { xMin, xMax } = props.domain;
  const flips = (props.layers?.points ?? []).map((point) => ((point.x - xMin) / (xMax - xMin) > 0.5 ? '1' : '0')).join('');
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const apply = () => root.querySelectorAll('.lf-plano-point').forEach((mark, index) => mark.toggleAttribute('data-flip', flips[index] === '1'));
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(root, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [flips]);
  return <div ref={ref} className="lf-p1-figure"><Plano {...props} copy={{ ...planoWords(locale), ...copy }} /></div>;
}

/** A small table the learner can read beside the graph: the first column heads each row. */
export function ValueTable({ caption, columns, rows }: { caption: string; columns: readonly string[]; rows: readonly (readonly ReactNode[])[] }) {
  return <div className="lf-p1-scroll"><table className="lf-hz-table" data-hz-table="">
    <caption data-copy-role="heading">{caption}</caption>
    <thead><tr>{columns.map((column) => <th key={column} scope="col" data-copy-role="data">{column}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, at) => at === 0
      ? <th key={at} scope="row" data-copy-role="data">{cell}</th>
      : <td key={at} data-copy-role="data">{cell}</td>)}</tr>)}</tbody>
  </table></div>;
}

/** The grade of a board: whether the answer is locked, and a change that clears the last verdict first. */
export function usePlaneGrade(segmentId: string, onGrade: OnGradeSegment | undefined) {
  const grading = useSegmentGrade(segmentId, onGrade);
  const locked = grading.pending || grading.met;
  const change = (next: () => void) => { grading.reset(); next(); };
  return { grading, locked, change };
}

export interface PlaneBoardProps {
  screen: string;
  document: LessonClientDocument;
  segment: HorizonteSegment;
  onBack: () => void;
  sequence?: LessonSequenceControl;
  grading: ReturnType<typeof useSegmentGrade>;
  /** The learner moved something since the start: Reset is offered. */
  changed: boolean;
  /** Check is offered. Default: the same as `changed`. */
  canCheck?: boolean;
  named: { met: string; hint: string };
  label: string;
  onReset: () => void;
  onCheck: () => void;
  figure: ReactNode;
  /** The numbers of the picture in words: the text equivalent of the plane. */
  status: ReactNode;
  /** Facts and tables under the status. */
  aside?: ReactNode;
  controls: ReactNode;
}

export function PlaneBoard({ screen, document, segment, onBack, sequence, grading, changed, canCheck, named, label, onReset, onCheck, figure, status, aside, controls }: PlaneBoardProps) {
  const { locale } = document;
  const locked = grading.pending || grading.met;
  return <BoardShell screen={screen} locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={onReset} resetDisabled={!changed || locked}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={(canCheck ?? changed) && !locked} sequence={sequence} feedback={segment.feedback}
      named={named} onCheck={onCheck} />}>
    <section className="lf-learning-board lf-p1" aria-label={label}>
      {figure}
      <p className="lf-p1-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {aside}
    </section>
    <section className="lf-learning-control-strip" aria-label={PLANE1_COPY.controlsLabel[locale]}>{controls}</section>
  </BoardShell>;
}
