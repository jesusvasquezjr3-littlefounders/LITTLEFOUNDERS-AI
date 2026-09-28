import { useMemo, useState } from 'react';
import type { Locale } from '../../design/copyBudget';
import { Button, ProgressBar, SegmentedControl, Stepper } from '../../design/controls';
import { TeachingChartBoard } from '../../learning/TeachingChartBoard';
import type { TutorWhiteboardWire } from '../session/types';
import { boardFormat, boardModel, type BoardModel, type BoardRow, type BoardWords } from './boardModel';
import '../../learning/learning.css';
import './mentorScreen.css';

/*
 * The board on demand (Frontend Bible 08 §2 layer 4; 05): what the Mentor is
 * demonstrating, drawn in the shared Pizarrón board frame the lesson player
 * uses (`learning/TeachingChartBoard`: the title, the picture, and the same
 * data as a table one press away). The board holds the visual; the character
 * holds the voice. Every value is Oracle's own server-computed figure
 * (`boardModel.ts`); nothing here recalculates.
 *
 * Four shapes are the learner's to act on (Oracle's class II instruments):
 * sorting things into groups (`grab`), filling a container (`fill`), picking a
 * path to compare (`whatif`) and showing the next value after the Mentor's
 * worked ones (`your_turn`). Their state is local to the turn that drew them,
 * as it always was: nothing is graded or sent.
 */

export interface MentorBoardCopy {
  showTable: string;
  showPicture: string;
  item: string;
  value: string;
  showNext: string;
  takeBack: string;
  filled: string;
  more: string;
  less: string;
  fillLabel: string;
  grabLegend: string;
  pick: string;
  yourTurn: string;
  words: BoardWords;
}

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);

/** One bar per numeric row: the label and the value are written, the bar is their picture. */
function Bars({ rows }: { rows: readonly BoardRow[] }) {
  const max = Math.max(...rows.map((row) => Math.abs(row.amount ?? 0)), 0);
  return <ul className="lf-mentor-board-bars">
    {rows.map((row) => <li key={row.id} className="lf-mentor-board-bar-row" data-marked={row.marked ? 'true' : undefined}>
      <span className="lf-mentor-board-bar-label" data-copy-role="data">{row.label}</span>
      <span className="lf-mentor-board-bar-value" data-copy-role="data">{row.value}</span>
      {row.amount !== undefined && max > 0
        ? <span className="lf-mentor-board-bar-track" aria-hidden="true">
          <span className={`lf-mentor-board-bar-fill lf-mentor-board-bar-fill--${row.tone ?? 'primary'}`}
            style={{ inlineSize: `${Math.max(2, Math.round((Math.abs(row.amount) / max) * 100))}%` }} />
        </span>
        : null}
    </li>)}
  </ul>;
}

/** Rows that are words, not quantities: a definition list. */
function Rows({ rows }: { rows: readonly BoardRow[] }) {
  return <dl className="lf-mentor-board-list">
    {rows.map((row) => <div key={row.id} className="lf-mentor-board-list-row" data-marked={row.marked ? 'true' : undefined}>
      <dt data-copy-role="data">{row.label}</dt>
      <dd data-copy-role="data">{row.value}</dd>
    </div>)}
  </dl>;
}

function GrabBoard({ board, copy }: { board: Extract<TutorWhiteboardWire, { kind: 'grab' }>; copy: MentorBoardCopy }) {
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const options = board.binLabels.map((label, index) => ({ value: String(index), label }));
  return <div className="lf-mentor-board-controls">
    {board.items.map((item, index) => <SegmentedControl key={`${item}-${index}`} name={`grab-${index}`}
      legend={fill(copy.grabLegend, { item })} options={options} value={placed[index] ?? null}
      onValueChange={(value) => setPlaced((current) => ({ ...current, [index]: value }))} />)}
  </div>;
}

function FillBoard({ board, copy, locale }: { board: Extract<TutorWhiteboardWire, { kind: 'fill' }>; copy: MentorBoardCopy; locale: Locale }) {
  const [filled, setFilled] = useState(0);
  const number = new Intl.NumberFormat(locale);
  const text = fill(copy.filled, { n: number.format(filled), total: number.format(board.capacity) });
  return <div className="lf-mentor-board-controls">
    <ProgressBar label={copy.fillLabel} labelHidden value={filled} max={board.capacity} valueText={text} tone="primary" />
    <Stepper label={copy.fillLabel} value={filled} valueText={text} min={0} max={board.capacity}
      onValueChange={setFilled} labels={{ decrease: copy.less, increase: copy.more }} />
  </div>;
}

function WhatifBoard({ board, model, copy }: { board: Extract<TutorWhiteboardWire, { kind: 'whatif' }>; model: BoardModel; copy: MentorBoardCopy }) {
  const [chosen, setChosen] = useState('0');
  const row = model.rows[Number(chosen)];
  return <div className="lf-mentor-board-controls">
    <SegmentedControl name="whatif" legend={copy.pick} value={chosen} onValueChange={setChosen}
      options={board.branches.map((branch, index) => ({ value: String(index), label: branch.label }))} />
    {row ? <Bars rows={[{ ...row, tone: 'primary' }]} /> : null}
  </div>;
}

function YourTurnBoard({ board, model, copy }: { board: Extract<TutorWhiteboardWire, { kind: 'your_turn' }>; model: BoardModel; copy: MentorBoardCopy }) {
  const [shown, setShown] = useState(board.givenCount);
  // The start row and the values up to what the learner has shown; a value the learner has not reached stays unwritten.
  const rows = model.rows.slice(0, 1 + shown);
  const done = shown >= board.values.length;
  // The learner's action comes first: on a phone the board is a short sheet over the stage and the bars scroll under it.
  return <div className="lf-mentor-board-controls">
    {!done ? <p className="lf-mentor-board-note" data-copy-role="body">{copy.yourTurn}</p> : null}
    <div className="lf-mentor-board-actions">
      <Button size="sm" variant="sky" disabled={done} onClick={() => setShown((n) => Math.min(n + 1, board.values.length))}>{copy.showNext}</Button>
      {shown > board.givenCount
        ? <Button size="sm" onClick={() => setShown((n) => Math.max(n - 1, board.givenCount))}>{copy.takeBack}</Button>
        : null}
    </div>
    <Bars rows={rows} />
  </div>;
}

export function MentorBoard({ board, copy, locale, title, readOnly = false, headingLevel = 2 }: {
  board: TutorWhiteboardWire; copy: MentorBoardCopy; locale: Locale;
  /** A title in place of the board's own, where several boards share a view and two would carry the same name. */
  title?: string;
  /**
   * Someone reading the board, not the learner acting on it (the verified
   * Tutor's transcript): a class II shape is drawn as its rows, with every
   * value written and no control to press.
   */
  readOnly?: boolean;
  /** The title's heading level inside the surrounding page (default 2). */
  headingLevel?: 2 | 3 | 4;
}) {
  const computed = useMemo(() => boardModel(board, copy.words, boardFormat(locale)), [board, copy.words, locale]);
  const model = title ? { ...computed, title } : computed;
  const Heading = `h${headingLevel}` as const;
  if (model.interactive && !readOnly) {
    return <section className="lf-learning-board lf-mentor-board-frame" aria-label={model.title} data-board-kind={model.kind}>
      <div className="lf-learning-board-heading"><Heading data-copy-role="heading">{model.title}</Heading></div>
      {board.kind === 'grab' ? <GrabBoard board={board} copy={copy} />
        : board.kind === 'fill' ? <FillBoard board={board} copy={copy} locale={locale} />
          : board.kind === 'whatif' ? <WhatifBoard board={board} model={model} copy={copy} />
            : board.kind === 'your_turn' ? <YourTurnBoard board={board} model={model} copy={copy} /> : null}
    </section>;
  }
  return <div className="lf-mentor-board-frame" data-board-kind={model.kind} data-board-read-only={readOnly && model.interactive ? 'true' : undefined}>
    <TeachingChartBoard title={model.title} headingLevel={headingLevel} showTableLabel={copy.showTable} showChartLabel={copy.showPicture}
      columns={[copy.item, copy.value]} rows={model.rows.map((row) => ({ id: row.id, label: row.label, value: row.value }))}
      chart={model.picture === 'bars' ? <Bars rows={model.rows} /> : <Rows rows={model.rows} />} />
  </div>;
}
