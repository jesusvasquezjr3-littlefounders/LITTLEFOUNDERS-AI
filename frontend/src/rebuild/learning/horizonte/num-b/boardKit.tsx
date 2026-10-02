import type { ReactNode } from 'react';
import type { Locale } from '../../../design/copyBudget';
import { Button, ChoiceChip, TextField } from '../../../design/controls';
import type { LessonClientDocument } from '../../lessonDocument';
import type { LessonSequenceControl } from '../../lessonSequence';
import { BoardShell, GradedFoot, playerCopy, readNumberAnswer, type useDragPlace, type useSegmentGrade } from '../../segmentKit';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { NUM_B_COPY } from './copy';
import '../horizonte.css';
import './numB.css';

export const MAX_TYPED = 999999;

export type Grading = ReturnType<typeof useSegmentGrade>;
export type Drag = ReturnType<typeof useDragPlace<string>>;
export type Copy = ReturnType<typeof copyText<typeof NUM_B_COPY>>;

/** Fills every {name} slot of an authored string. */
export const fill = (text: string, values: Readonly<Record<string, string | number>>): string => text.replace(/\{(\w+)\}/g, (slot, key: string) => (key in values ? String(values[key]) : slot));

/** A typed whole number for the learner's locale: its canonical text, or null while it is empty or out of range. */
export const typedNumber = (text: string, locale: Locale, max = MAX_TYPED, min = 0): string | null => readNumberAnswer(text, locale, { whole: true, min, max }).canonical;

/** A typed whole number with the parse echoed before Check; the visible label is also the accessible name. */
export function NumField({ label, locale, value, onText, disabled, min = 0, max = MAX_TYPED }: {
  label: string; locale: Locale; value: string; onText: (text: string) => void; disabled?: boolean; min?: number; max?: number;
}) {
  const t = playerCopy(locale);
  const reading = readNumberAnswer(value, locale, { whole: true, min, max });
  const echo = reading.canonical === null ? null : new Intl.NumberFormat(locale, { maximumFractionDigits: 12 }).format(Number(reading.canonical));
  const error = reading.problem === null || reading.problem === 'empty' ? undefined : t[reading.problem];
  return <div className="lf-number-answer">
    <TextField label={label} aria-label={label} inputMode="decimal" autoComplete="off" value={value} disabled={disabled} error={error}
      onChange={(event) => onText(event.target.value)} />
    <p className="lf-number-echo" data-copy-role="body" aria-live="polite">{echo ? t.readsAs.replace('{value}', echo) : ' '}</p>
  </div>;
}

/** A carried chip on a 64 px handle; the Move to menu beside it is its keyboard path. */
export function Handle({ drag, id, label, disabled }: { drag: Drag; id: string; label: string; disabled?: boolean }) {
  return <span className="lf-hz-handle" data-hz-handle="" data-hz-hit="64"><ChoiceChip {...drag.chip(id)} disabled={disabled}>{label}</ChoiceChip></span>;
}

export function DataTable({ caption, head, rows, foot }: { caption: string; head: readonly string[]; rows: readonly (readonly string[])[]; foot?: readonly string[] }) {
  const line = (cells: readonly string[], key: string | number) => <tr key={key}>{cells.map((cell, index) => (index === 0
    ? <th key={index} scope="row" data-copy-role="data">{cell}</th> : <td key={index} data-copy-role="data">{cell}</td>))}</tr>;
  return <table className="lf-hz-table" data-hz-table="">
    <caption data-copy-role="heading">{caption}</caption>
    <thead><tr>{head.map((cell, index) => <th key={index} scope="col" data-copy-role="data">{cell}</th>)}</tr></thead>
    <tbody>{rows.map((cells, index) => line(cells, index))}</tbody>
    {foot ? <tfoot>{line(foot, 'foot')}</tfoot> : null}
  </table>;
}

export interface TableState { open: boolean; toggle: () => void }

/** The anatomy every num-b board shares: the board, its spoken status line, the optional table, the control strip, Reset and Check. */
export function NumBFrame({ screen, document, segment, onBack, sequence, grading, canCheck, answer, named, changed, onReset, table, label, status, board, tableNode, children }: {
  screen: string; document: LessonClientDocument; segment: HorizonteSegment; onBack: () => void; sequence?: LessonSequenceControl;
  grading: Grading; canCheck: boolean; answer: unknown; named: { met: string; hint: string }; changed: boolean; onReset: () => void;
  table: TableState; label: string; status: string; board: ReactNode; tableNode: ReactNode; children?: ReactNode;
}) {
  const t = copyText(NUM_B_COPY, document.locale);
  const locked = grading.pending || grading.met;
  return <BoardShell screen={screen} locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={onReset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table.open} onClick={table.toggle} data-hz-table-toggle="">{table.open ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={canCheck && !locked} sequence={sequence} feedback={segment.feedback}
      named={named} onCheck={() => grading.check(answer)} />}>
    <section className="lf-learning-board lf-numb" aria-label={label}>
      {board}
      <p className="lf-numb-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      {table.open ? tableNode : null}
    </section>
    {children}
  </BoardShell>;
}
