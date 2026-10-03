import { useState } from 'react';
import { ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { TableToggle, hitSpan, pressable } from './boardKit';
import { REKENREK_BEADS, REKENREK_BLOCK, beadTotal, blocksOf, sameBeads, tapBead } from './beads-model.generated';
import { NUM_A_COPY } from './copy';
import '../horizonte.css';
import './NumShared.css';
import './Rekenrek.css';

type RekenrekSegment = Extract<HorizonteSegment, { type: 'math.rekenrek.v2' }>;

const SLOT = 38;
const TRAVEL = 3;
const BLOCK_GAP = 8;
const PAD = 20;
const ROW_Y = [36, 100] as const;
const WIDTH = PAD * 2 + (REKENREK_BEADS + TRAVEL) * SLOT + BLOCK_GAP;
const beadX = (index: number, slid: boolean) => PAD + SLOT / 2 + (slid ? index : index + TRAVEL) * SLOT + (index >= REKENREK_BLOCK ? BLOCK_GAP : 0);

const MOVES = { 'add-1': 1, 'add-5': REKENREK_BLOCK, 'back-1': -1, 'back-5': -REKENREK_BLOCK } as const;
type Move = keyof typeof MOVES;
const MOVE_ORDER: readonly Move[] = ['add-1', 'add-5', 'back-1', 'back-5'];
const slide = (count: number, move: Move): number | null => { const next = count + MOVES[move]; return next >= 0 && next <= REKENREK_BEADS ? next : null; };

/*
 * A05: two rows of ten beads, five to a block. The learner slides beads by tapping one, or by dragging a one or five chip
 * onto a row; "Move to" is the keyboard path. The answer is the count slid in each row; Core holds the target.
 */
function Rekenrek({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: RekenrekSegment }) {
  const t = copyText(NUM_A_COPY, document.locale);
  const start = segment.payload.start;
  const [counts, setCounts] = useState<number[]>(() => [...start]);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = !sameBeads(counts, start);
  const rowName = (row: number) => fillSlot(t.row, row + 1);
  const moveLabel: Record<Move, string> = { 'add-1': t.slideOne, 'add-5': t.slideFive, 'back-1': t.backOne, 'back-5': t.backFive };

  const change = (next: number[]) => { grading.reset(); setCounts(next); };
  const set = (row: number, count: number) => { if (count !== counts[row]) change(counts.map((current, index) => (index === row ? count : current))); };
  const place = (item: string, target: string) => {
    const row = Number(target.slice('row-'.length));
    const next = slide(counts[row]!, item as Move);
    if (next !== null) set(row, next);
  };
  const drag = useDragPlace<string>(place, locked);
  const usable = (move: Move) => counts.some((count) => slide(count, move) !== null);
  const reset = () => { grading.reset(); drag.clear(); setCounts([...start]); };
  const rowOptions = counts.map((_, row) => ({ value: `row-${row}`, label: rowName(row) }));
  const rowText = (count: number) => { const { fives, ones } = blocksOf(count); return fives > 0 ? `${count} (${fives * REKENREK_BLOCK} + ${ones})` : String(count); };

  return <BoardShell screen="rekenrek" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metRekenrek, hint: t.hintRekenrek }} onCheck={() => grading.check({ beads: counts })} />}>
    <section className="lf-learning-board lf-num-board" aria-label={t.rekenrek}>
      <div className="lf-num-scroll">
        <svg className="lf-rek lf-hz-hit-sized" style={hitSpan(WIDTH, SLOT)} viewBox={`0 0 ${WIDTH} 136`} role="group" aria-label={t.rekenrek} focusable="false">
          {counts.map((count, row) => <g key={row} className={`lf-rek-row lf-rek-row--${row === 0 ? 'sky' : 'mint'}`} {...drag.target(`row-${row}`)}>
            <rect className="lf-rek-lane" x={0} y={ROW_Y[row]! - 30} width={WIDTH} height={60} rx={10} />
            <line className="lf-rek-wire" x1={PAD} x2={WIDTH - PAD} y1={ROW_Y[row]} y2={ROW_Y[row]} />
            {Array.from({ length: REKENREK_BEADS }, (_, index) => {
              const slid = index < count;
              const cx = beadX(index, slid);
              return <g key={index} className={`lf-rek-bead${slid ? ' lf-rek-bead--slid' : ''}${index >= REKENREK_BLOCK ? ' lf-rek-bead--b' : ''}`}
                aria-label={`${rowName(row)}, ${fillSlot(t.bead, index + 1)}: ${slid ? t.counted : t.notCounted}`} aria-pressed={slid}
                {...pressable(() => { if (!drag.carried) set(row, tapBead(count, index)); }, locked)}>
                <rect className="lf-rek-hit" x={cx - SLOT / 2} y={ROW_Y[row]! - 28} width={SLOT} height={56} />
                <circle className="lf-rek-disc" cx={cx} cy={ROW_Y[row]} r={SLOT / 2 - 3} />
              </g>;
            })}
          </g>)}
        </svg>
      </div>
      <p className="lf-num-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {counts.map((count, row) => `${rowName(row)}: ${rowText(count)}`).join('. ')}. {t.total}: {beadTotal(counts)}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.rekenrekCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colRow}</th><th scope="col" data-copy-role="data">{t.colBeads}</th><th scope="col" data-copy-role="data">{t.colFives}</th><th scope="col" data-copy-role="data">{t.colOnes}</th></tr></thead>
        <tbody>{counts.map((count, row) => <tr key={row}><th scope="row" data-copy-role="data">{row + 1}</th><td data-copy-role="data">{count}</td><td data-copy-role="data">{blocksOf(count).fives}</td><td data-copy-role="data">{blocksOf(count).ones}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" data-copy-role="data">{t.total}</th><td data-copy-role="data">{beadTotal(counts)}</td><td data-copy-role="data">{counts.reduce((sum, count) => sum + blocksOf(count).fives, 0)}</td><td data-copy-role="data">{counts.reduce((sum, count) => sum + blocksOf(count).ones, 0)}</td></tr></tfoot>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.rekenrekTray}>
      <h2 data-copy-role="heading">{t.rekenrekTray}</h2>
      <div className="lf-num-tray">
        {MOVE_ORDER.map((move) => <span key={move} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip(move)} disabled={locked || !usable(move)}>{moveLabel[move]}</ChoiceChip>
        </span>)}
      </div>
      <MoveToChoice locale={document.locale} item={drag.carried === null ? null : { label: moveLabel[drag.carried as Move] }} options={rowOptions} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function RekenrekBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.rekenrek.v2' ? <Rekenrek segment={segment} {...rest} /> : null;
}
