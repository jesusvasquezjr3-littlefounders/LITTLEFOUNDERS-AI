import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TextField } from '../../../design/controls';
import { MathExpression } from '../../pizarron/MathExpression';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { ALG2_COPY } from './copy';
import {
  analyseLines, EXPRESSION_LIMITS, expressionTaskProblem, isExpressionTask, parseExpression, toLatex, toSpoken,
  type ExpressionTask, type LineReport, type Parsed, type SpokenWords,
} from './expression.generated';
import { slots } from './shared';
import '../horizonte.css';
import './alg2.css';

type ExpressionSegment = Extract<HorizonteSegment, { type: 'math.expression-editor.v2' }>;
type Copy = ReturnType<typeof copyText<typeof ALG2_COPY>>;
interface Row { id: number; text: string }

const BLANK: Row[] = [{ id: 0, text: '' }];

/** The one sentence that says why a line cannot be read, or null when it reads. */
function problemText(t: Copy, report: LineReport, task: ExpressionTask): string | null {
  switch (report.error) {
    case null: return null;
    case 'unbalanced': return t.stepBrackets;
    case 'bad-exponent': return t.stepPower;
    case 'bad-char': case 'unknown-symbol': return slots(t.stepSymbols, { v: task.variable });
    case 'bad-number': return t.stepNumber;
    case 'two-equals': return t.stepTwoEquals;
    case 'too-long': case 'too-complex': case 'complex': return t.stepTooComplex;
    case 'kind': return task.task === 'solve' ? t.stepNeedsEquation : t.stepNeedsExpression;
    default: return t.stepUnreadable;
  }
}

/** The goal of the task in words: what the last line must look like. */
function goalText(t: Copy, task: ExpressionTask): string {
  if (task.form === 'expanded') return t.goalExpanded;
  if (task.form === 'factored') return t.goalFactored;
  return slots(task.form === 'isolated' ? t.goalIsolated : t.goalSeparated, { v: task.variable });
}

function Notation({ parsed, variable, words, fallback, locale }: { parsed: Parsed; variable: string; words: SpokenWords; fallback: string; locale: HorizonteBoardProps['document']['locale'] }) {
  if (!parsed.ok) return null;
  return <p className="lf-alg2-math"><MathExpression tex={toLatex(parsed, variable)} spokenText={toSpoken(parsed, variable, words)} fallback={fallback} locale={locale} /></p>;
}

/*
 * F2.6, D27: a chain of lines the learner types, one step each, with the notation drawn under every line that reads and a
 * plain "same value as the line above" or "not the same" beside it. The browser only reads and compares (advisory: the
 * same bounded engine Core runs, which never evaluates learner text); Core holds the finished-form key and the verdict.
 */
function ExpressionEditor({ document, segment, onBack, sequence, onGrade, task }: Omit<HorizonteBoardProps, 'segment'> & { segment: ExpressionSegment; task: ExpressionTask }) {
  const locale = document.locale;
  const t = copyText(ALG2_COPY, locale);
  const [rows, setRows] = useState<Row[]>(BLANK);
  const next = useRef(1);
  const [focusId, setFocusId] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const { variable } = task;
  const words: SpokenWords = {
    plus: t.spokenPlus, minus: t.spokenMinus, times: t.spokenTimes, over: t.spokenOver, power: t.spokenPower,
    equals: t.spokenEquals, open: t.spokenOpen, close: t.spokenClose, negative: t.spokenNegative,
  };

  const given = useMemo(() => parseExpression(task.given, variable), [task.given, variable]);
  const filled = rows.filter((row) => row.text.trim() !== '');
  const analysis = useMemo(() => (filled.length > 0 ? analyseLines(task, filled.map((row) => row.text.trim())) : null), [task, rows]);
  const reportOf = new Map<number, { report: LineReport; parsed: Parsed }>();
  analysis?.lines.forEach((report, at) => reportOf.set(filled[at]!.id, { report, parsed: analysis.parsed[at]! }));
  const changed = rows.length > 1 || rows[0]!.text !== '';

  useEffect(() => {
    if (focusId === null) return;
    listRef.current?.querySelector<HTMLInputElement>(`[data-line-id="${focusId}"] input`)?.focus();
    setFocusId(null);
  }, [focusId]);

  const edit = (id: number, text: string) => { grading.reset(); setRows((all) => all.map((row) => (row.id === id ? { ...row, text } : row))); };
  const addAfter = (id: number) => {
    if (rows.length >= EXPRESSION_LIMITS.maxLines || locked) return;
    const row = { id: next.current++, text: '' };
    grading.reset();
    setRows((all) => { const at = all.findIndex((other) => other.id === id); return [...all.slice(0, at + 1), row, ...all.slice(at + 1)]; });
    setFocusId(row.id);
  };
  const remove = (id: number) => { grading.reset(); setRows((all) => (all.length > 1 ? all.filter((row) => row.id !== id) : all)); };
  const reset = () => { grading.reset(); next.current = 1; setRows(BLANK); };

  return <BoardShell screen="expression-editor" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={analysis !== null && analysis.wellFormed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metExpression, hint: t.hintExpression }} onCheck={() => { if (analysis?.wellFormed) grading.check({ steps: filled.map((row) => row.text.trim()) }); }} />}>
    <section className="lf-learning-board lf-alg2" aria-label={t.stepsName}>
      <div className="lf-alg2-editor">
        <p className="lf-alg2-goal" data-copy-role="body">{goalText(t, task)}</p>
        <ol className="lf-alg2-lines" ref={listRef} data-hz-text-equivalent="">
          <li className="lf-alg2-line lf-alg2-line--start" data-line-state="start">
            <span className="lf-alg2-line-name" data-copy-role="data">{t.startLine}</span>
            <Notation parsed={given} variable={variable} words={words} fallback={task.given} locale={locale} />
          </li>
          {rows.map((row, index) => {
            const found = reportOf.get(row.id);
            const problem = found ? problemText(t, found.report, task) : null;
            const state = !found ? 'empty' : problem ? 'error' : found.report.same ? 'same' : 'differs';
            const message = !found ? null : problem ?? (found.report.same ? t.stepSame : t.stepDiffers);
            const label = slots(t.lineName, { n: index + 1 });
            return <li key={row.id} className="lf-alg2-line" data-line-id={row.id} data-line-state={state}>
              <TextField label={label} value={row.text} disabled={locked} maxLength={EXPRESSION_LIMITS.maxChars}
                autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                aria-describedby={message ? `lf-alg2-${segment.id}-${row.id}` : undefined}
                onChange={(event) => edit(row.id, event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addAfter(row.id); } }} />
              {found && found.parsed.ok && found.report.error === null
                ? <Notation parsed={found.parsed} variable={variable} words={words} fallback={row.text.trim()} locale={locale} /> : null}
              {message ? <p className="lf-alg2-verdict" id={`lf-alg2-${segment.id}-${row.id}`} data-copy-role="body">{message}</p> : null}
              {rows.length > 1 ? <div className="lf-alg2-actions">
                <Button size="sm" disabled={locked} aria-label={`${t.removeLine} ${index + 1}`} onClick={() => remove(row.id)}>{t.removeLine}</Button>
              </div> : null}
            </li>;
          })}
        </ol>
        <div className="lf-alg2-actions">
          <Button size="sm" disabled={locked || rows.length >= EXPRESSION_LIMITS.maxLines} onClick={() => addAfter(rows[rows.length - 1]!.id)}>{t.addLine}</Button>
        </div>
      </div>
    </section>
  </BoardShell>;
}

export default function ExpressionEditorBoard({ segment, ...rest }: HorizonteBoardProps) {
  const task = segment.type === 'math.expression-editor.v2' && isExpressionTask(segment.payload) && !expressionTaskProblem(segment.payload) ? segment.payload : null;
  return segment.type === 'math.expression-editor.v2' && task !== null ? <ExpressionEditor segment={segment} task={task} {...rest} /> : null;
}
