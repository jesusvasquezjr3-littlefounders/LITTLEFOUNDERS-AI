import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, SegmentedControl } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import { MathExpression } from '../../pizarron/MathExpression';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { Plano, planoWords, type PlanoProps } from '../plano';
import type { Words } from './format';
import type { Notation } from './notation';
import { SpecTable, type TableSpec } from './specTable';
import '../horizonte.css';
import './explorer.css';

/*
 * F2.17: one choice and one whole number. The learner predicts first (a choice), then explores a figure until the
 * number shows. The board sends { predict, value } when both are made; Core holds the key and the rule.
 */

/** The learner's prediction, the grade of the check, and a change that clears the last verdict first. */
export function useExplorer(segmentId: string, onGrade: HorizonteBoardProps['onGrade']) {
  const grading = useSegmentGrade(segmentId, onGrade);
  const locked = grading.pending || grading.met;
  const [predict, setPredict] = useState<string | null>(null);
  const change = (next: () => void) => { grading.reset(); next(); };
  return {
    grading, locked, predict, change,
    choose: (value: string) => change(() => setPredict(value)),
    clear: () => { grading.reset(); setPredict(null); },
  };
}
export type Explorer = ReturnType<typeof useExplorer>;

/** A number the learner moves: it only counts as an answer once they have touched it, so the start is never submitted by accident. */
export function useMoved(start: number, explorer: Explorer) {
  const [value, setValue] = useState(start);
  const [touched, setTouched] = useState(false);
  return {
    value, touched,
    set: (next: number) => explorer.change(() => { setValue(next); setTouched(true); }),
    reset: () => { setValue(start); setTouched(false); },
  };
}

/** What a key does to a moving handle that keeps to a curve of its own (the unit circle). */
export type KeyMove = 'next' | 'previous' | 'first' | 'last';

/**
 * Plano gives every handle its own arrow-key step, which a point that must stay on a circle cannot use. A board that
 * passes `onKey` takes the handle's arrows, Home and End itself, in the capture phase, so Plano never moves it off the circle.
 */
export function ExPlano({ locale, onKey, className, ...props }: PlanoProps & { locale: Locale; onKey?: (move: KeyMove) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const act = useRef(onKey);
  act.current = onKey;
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const listen = (event: KeyboardEvent) => {
      const move = act.current;
      if (!move || !(event.target instanceof Element) || !event.target.closest('.lf-plano-handle') || event.altKey || event.ctrlKey || event.metaKey) return;
      const step: KeyMove | null = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 'next' : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? 'previous'
        : event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : null;
      if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); event.stopPropagation(); return; }
      if (!step) return;
      event.preventDefault();
      event.stopPropagation();
      move(step);
    };
    node.addEventListener('keydown', listen, true);
    return () => node.removeEventListener('keydown', listen, true);
  }, []);
  return <div ref={ref} className={`lf-ex-figure${className ? ` ${className}` : ''}`}><Plano {...props} copy={{ ...planoWords(locale), ...props.copy }} tableToggle={false} /></div>;
}

/** The goal of the step, written as a short phrase around one expression of math. */
export function Ask({ locale, lead, math, tail }: { locale: Locale; lead: string; math: Notation; tail?: string | null }) {
  return <p className="lf-ex-ask">
    <span data-copy-role="body">{lead}</span>
    <MathExpression tex={math.tex} spokenText={math.spoken} fallback={math.plain} locale={locale} />
    {tail ? <span data-copy-role="body">{tail}</span> : null}
  </p>;
}

export interface ExplorerShellProps extends Omit<HorizonteBoardProps, 'segment' | 'onGrade'> {
  screen: string;
  segment: HorizonteSegment;
  t: Words;
  explorer: Explorer;
  /** What the learner predicts: its legend and the choices. */
  predict: { legend: string; options: ReadonlyArray<{ value: string; label: string }> };
  /** Something moved since the start, so Reset is offered. */
  changed: boolean;
  /** The number the learner found is in place, so Check is offered with the prediction. */
  ready: boolean;
  /** What to do first while the number is missing, in the words of this visual. */
  need: string;
  named: { met: string; hint: string };
  onReset: () => void;
  onCheck: () => void;
  heading: string;
  ask?: ReactNode;
  figure: ReactNode;
  /** The facts of the picture in words: the text equivalent. */
  status: string;
  table: TableSpec;
  /** The way to find the number: sliders, a typed number. */
  controls: ReactNode;
}

export function ExplorerShell({
  screen, document, segment, onBack, sequence, t, explorer, predict, changed, ready, need, named, onReset, onCheck, heading, ask, figure, status, table, controls,
}: ExplorerShellProps) {
  const [open, setOpen] = useState(false);
  const { grading, locked } = explorer;
  const missing = explorer.predict === null ? t.needPredict : !ready ? need : null;
  return <BoardShell screen={screen} locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={onReset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={open} onClick={() => setOpen((shown) => !shown)} data-hz-table-toggle="">{open ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={ready && explorer.predict !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={named} onCheck={onCheck} />}>
    <section className="lf-learning-board lf-ex" aria-label={document.title}>
      {ask}
      {figure}
      <p className="lf-ex-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {open ? <SpecTable table={table} /> : null}
    </section>
    <section className="lf-learning-control-strip lf-ex-controls" aria-label={heading}>
      <h2 data-copy-role="heading">{heading}</h2>
      <SegmentedControl legend={predict.legend} name={`${segment.id}-predict`} options={predict.options} value={explorer.predict}
        onValueChange={explorer.choose} disabled={locked} />
      {controls}
      {missing ? <p className="lf-ex-hint" data-copy-role="body">{missing}</p> : null}
    </section>
  </BoardShell>;
}

/** The prediction choices of one visual, in the order the model lists them. */
export const choices = (t: Words, values: readonly string[]): ReadonlyArray<{ value: string; label: string }> => values.map((value) => ({ value, label: (t as Readonly<Record<string, string>>)[`opt:${value}`] ?? value }));

/** An integer window around some values for a y axis: a little room, and the axis itself when asked. */
export function yWindow(values: readonly number[], withZero = false, room = 0.12): { yMin: number; yMax: number } {
  const low = Math.min(...values, ...(withZero ? [0] : []));
  const high = Math.max(...values, ...(withZero ? [0] : []));
  const gap = Math.max(high - low, 1) * room;
  return { yMin: Math.floor(low - gap), yMax: Math.ceil(high + gap) };
}

/** Samples of a function at whole numbers or at a step, for a window or a table. */
export const sampled = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let x = from; x <= to + 1e-9; x += step) out.push(Math.round(x * 1e6) / 1e6);
  return out;
};
