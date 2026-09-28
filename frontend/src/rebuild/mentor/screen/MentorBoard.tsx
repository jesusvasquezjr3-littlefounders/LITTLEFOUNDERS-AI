import { useMemo, useState } from 'react';
import type { Locale } from '../../design/copyBudget';
import { Button, SegmentedControl, Stepper } from '../../design/controls';
import { TeachingChartBoard } from '../../learning/TeachingChartBoard';
import type { TutorWhiteboardWire } from '../session/types';
import { boardFormat, boardModel, type BoardFormat, type BoardModel, type BoardWords } from './boardModel';
import { BOARD_RENDERERS, BoardVisual } from './boardVisuals';
import '../../learning/learning.css';
import './mentorScreen.css';

/*
 * The board on demand (Frontend Bible 08 §2 layer 4; 05): what the Mentor is
 * demonstrating, drawn in the shared Pizarrón board frame the lesson player
 * uses (`learning/TeachingChartBoard`: the title, the picture, and the same
 * data as a table one press away), with the picture drawn by the shared
 * Pizarrón visual for that concept (`boardVisuals.tsx`, product B.7). The board holds the visual; the character
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

function GrabBoard({ board, model, copy, format }: { board: Extract<TutorWhiteboardWire, { kind: 'grab' }>; model: BoardModel; copy: MentorBoardCopy; format: BoardFormat }) {
  const [placed, setPlaced] = useState<Record<number, string>>({});
  const options = board.binLabels.map((label, index) => ({ value: String(index), label }));
  return <div className="lf-mentor-board-controls">
    {board.items.map((item, index) => <SegmentedControl key={`${item}-${index}`} name={`grab-${index}`}
      legend={fill(copy.grabLegend, { item })} options={options} value={placed[index] ?? null}
      onValueChange={(value) => setPlaced((current) => ({ ...current, [index]: value }))} />)}
    <BoardVisual board={board} model={model} words={copy.words} format={format} state={{ placed }} />
  </div>;
}

function FillBoard({ board, model, copy, locale, format }: { board: Extract<TutorWhiteboardWire, { kind: 'fill' }>; model: BoardModel; copy: MentorBoardCopy; locale: Locale; format: BoardFormat }) {
  const [filled, setFilled] = useState(0);
  const number = new Intl.NumberFormat(locale);
  const text = fill(copy.filled, { n: number.format(filled), total: number.format(board.capacity) });
  return <div className="lf-mentor-board-controls">
    <BoardVisual board={board} model={model} words={copy.words} format={format} state={{ filled }} />
    <Stepper label={copy.fillLabel} value={filled} valueText={text} min={0} max={board.capacity}
      onValueChange={setFilled} labels={{ decrease: copy.less, increase: copy.more }} />
  </div>;
}

function WhatifBoard({ board, model, copy, format }: { board: Extract<TutorWhiteboardWire, { kind: 'whatif' }>; model: BoardModel; copy: MentorBoardCopy; format: BoardFormat }) {
  const [chosen, setChosen] = useState('0');
  return <div className="lf-mentor-board-controls">
    <SegmentedControl name="whatif" legend={copy.pick} value={chosen} onValueChange={setChosen}
      options={board.branches.map((branch, index) => ({ value: String(index), label: branch.label }))} />
    <BoardVisual board={board} model={model} words={copy.words} format={format} state={{ chosen: Number(chosen) }} />
  </div>;
}

function YourTurnBoard({ board, model, copy, format }: { board: Extract<TutorWhiteboardWire, { kind: 'your_turn' }>; model: BoardModel; copy: MentorBoardCopy; format: BoardFormat }) {
  const [shown, setShown] = useState(board.givenCount);
  const done = shown >= board.values.length;
  // The learner's action comes first: on a phone the board is a short sheet over the stage and the picture scrolls under it.
  return <div className="lf-mentor-board-controls">
    {!done ? <p className="lf-mentor-board-note" data-copy-role="body">{copy.yourTurn}</p> : null}
    <div className="lf-mentor-board-actions">
      <Button size="sm" variant="sky" disabled={done} onClick={() => setShown((n) => Math.min(n + 1, board.values.length))}>{copy.showNext}</Button>
      {shown > board.givenCount
        ? <Button size="sm" onClick={() => setShown((n) => Math.max(n - 1, board.givenCount))}>{copy.takeBack}</Button>
        : null}
    </div>
    <BoardVisual board={board} model={model} words={copy.words} format={format} state={{ shown }} />
  </div>;
}

export function MentorBoard({ board, copy, locale, title }: {
  board: TutorWhiteboardWire; copy: MentorBoardCopy; locale: Locale;
  /** A title in place of the board's own, where several boards share a view and two would carry the same name. */
  title?: string;
}) {
  const format = useMemo(() => boardFormat(locale), [locale]);
  const computed = useMemo(() => boardModel(board, copy.words, format), [board, copy.words, format]);
  const model = title ? { ...computed, title } : computed;
  if (model.interactive) {
    return <section className="lf-learning-board lf-mentor-board-frame" aria-label={model.title} data-board-kind={model.kind}
      data-board-visual={BOARD_RENDERERS[model.kind]}>
      <div className="lf-learning-board-heading"><h2 data-copy-role="heading">{model.title}</h2></div>
      {board.kind === 'grab' ? <GrabBoard board={board} model={model} copy={copy} format={format} />
        : board.kind === 'fill' ? <FillBoard board={board} model={model} copy={copy} locale={locale} format={format} />
          : board.kind === 'whatif' ? <WhatifBoard board={board} model={model} copy={copy} format={format} />
            : board.kind === 'your_turn' ? <YourTurnBoard board={board} model={model} copy={copy} format={format} /> : null}
    </section>;
  }
  // The picture is the shared Pizarrón visual for this concept; the table (Oracle's own values, row by row) is one press away.
  return <div className="lf-mentor-board-frame" data-board-kind={model.kind} data-board-visual={BOARD_RENDERERS[model.kind]}>
    <TeachingChartBoard title={model.title} showTableLabel={copy.showTable} showChartLabel={copy.showPicture}
      columns={[copy.item, copy.value]} rows={model.rows.map((row) => ({ id: row.id, label: row.label, value: row.value }))}
      chart={<BoardVisual board={board} model={model} words={copy.words} format={format} />} />
  </div>;
}
