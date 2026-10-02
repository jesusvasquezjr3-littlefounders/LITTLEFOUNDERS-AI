import { useState } from 'react';
import { Button, ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { GOLDEN_COPY } from './copy';
import { TEN_FRAME_CELLS, emptyCells, sameCounts, tenFrameTotal } from './model.generated';
import '../horizonte.css';
import './TenFrameBoard.css';

type TenFrameSegment = Extract<HorizonteSegment, { type: 'math.ten-frame.v2' }>;

/*
 * A03/A04: one or two ten frames. The learner adds counters (one frame) or moves them between frames (two frames,
 * total unchanged) by dragging a chip, tapping a chip then a frame, or tapping cells; "Move to" is the keyboard path.
 * The answer is the integer count per frame; Core holds the target.
 */
function TenFrame({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: TenFrameSegment }) {
  const t = copyText(GOLDEN_COPY, document.locale);
  const start = segment.payload.start;
  const double = start.length === 2;
  const [counts, setCounts] = useState<number[]>(() => [...start]);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = !sameCounts(counts, start);
  const frameName = (frame: number) => fillSlot(t.frame, frame + 1);

  const change = (next: number[]) => { grading.reset(); setCounts(next); };
  const move = (from: number, to: number) => {
    if (from === to || counts[from]! < 1 || counts[to]! >= TEN_FRAME_CELLS) return;
    change(counts.map((count, index) => (index === from ? count - 1 : index === to ? count + 1 : count)));
  };
  const add = (frame: number) => { if (double) move(1 - frame, frame); else if (counts[0]! < TEN_FRAME_CELLS) change([counts[0]! + 1]); };
  const removable = (frame: number) => (double ? counts[1 - frame]! < TEN_FRAME_CELLS && counts[frame]! > 0 : counts[0]! > start[0]!);
  const remove = (frame: number) => { if (double) move(frame, 1 - frame); else if (removable(0)) change([counts[0]! - 1]); };

  const place = (item: string, target: string) => {
    const to = Number(target.slice('frame-'.length));
    if (item.startsWith('tray-')) add(to);
    else move(Number(item.slice('from-'.length)), to);
  };
  const drag = useDragPlace<string>(place, locked);

  const sourceFrame = drag.carried?.startsWith('from-') ? Number(drag.carried.slice('from-'.length)) : null;
  const frameOptions = counts.map((_, frame) => ({ value: `frame-${frame}`, label: frameName(frame) })).filter((_, frame) => frame !== sourceFrame);
  const carriedLabel = drag.carried === null ? null : { label: sourceFrame === null ? t.addCounter : fillSlot(t.moveFrom, sourceFrame + 1) };
  const reset = () => { grading.reset(); drag.clear(); setCounts([...start]); };

  const handle = (id: string, label: string, disabled: boolean) => (
    <span key={id} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
      <ChoiceChip {...drag.chip(id)} disabled={disabled || locked}>{label}</ChoiceChip>
    </span>
  );
  const trayChips = double
    ? counts.map((count, frame) => handle(`from-${frame}`, fillSlot(t.moveFrom, frame + 1), count < 1))
    : Array.from({ length: TEN_FRAME_CELLS - counts[0]! }, (_, index) => handle(`tray-${index + 1}`, t.addCounter, false));

  return <BoardShell screen="ten-frame" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={double ? { met: t.metDouble, hint: t.hintDouble } : { met: t.metSingle, hint: t.hintSingle }} onCheck={() => grading.check({ counts })} />}>
    <section className="lf-learning-board lf-tenframe" aria-labelledby={`${segment.id}-frames`}>
      <div className="lf-tenframe-frames" id={`${segment.id}-frames`}>
        {counts.map((count, frame) => <div key={frame} className={`lf-tenframe-frame lf-tenframe-frame--${frame === 0 ? 'sky' : 'mint'}`}>
          <h3 data-copy-role="data">{frameName(frame)}</h3>
          <div className="lf-tenframe-grid" role="group" aria-label={frameName(frame)} {...drag.target(`frame-${frame}`)}>
            {Array.from({ length: TEN_FRAME_CELLS }, (_, index) => {
              const filled = index < count;
              const actionable = !locked && (filled ? index === count - 1 && removable(frame) : double ? counts[1 - frame]! > 0 && count < TEN_FRAME_CELLS : count < TEN_FRAME_CELLS);
              const added = !double && filled && index >= start[0]!;
              return <button key={index} type="button" className="lf-tenframe-cell" aria-disabled={!actionable} data-copy-role="data"
                aria-label={`${frameName(frame)}, ${fillSlot(t.cell, index + 1)}: ${filled ? t.filled : t.empty}`}
                onClick={() => { if (drag.carried || !actionable) return; if (filled) remove(frame); else add(frame); }}>
                {filled ? <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="20" fill="currentColor" />{added ? <circle className="lf-tenframe-added" cx="32" cy="32" r="26" /> : null}</svg> : null}
              </button>;
            })}
          </div>
        </div>)}
      </div>
      <p className="lf-tenframe-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {t.total}: {tenFrameTotal(counts)}. {t.emptyCells}: {emptyCells(counts)}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colFrame}</th><th scope="col" data-copy-role="data">{t.colFilled}</th><th scope="col" data-copy-role="data">{t.colEmpty}</th></tr></thead>
        <tbody>{counts.map((count, frame) => <tr key={frame}><th scope="row" data-copy-role="data">{frame + 1}</th><td data-copy-role="data">{count}</td><td data-copy-role="data">{TEN_FRAME_CELLS - count}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" data-copy-role="data">{t.total}</th><td data-copy-role="data">{tenFrameTotal(counts)}</td><td data-copy-role="data">{emptyCells(counts)}</td></tr></tfoot>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.tray}>
      <h2 data-copy-role="heading">{t.tray}</h2>
      <div className="lf-tenframe-tray">{trayChips}</div>
      <MoveToChoice locale={document.locale} item={carriedLabel} options={frameOptions} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function TenFrameBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.ten-frame.v2' ? <TenFrame segment={segment} {...rest} /> : null;
}
