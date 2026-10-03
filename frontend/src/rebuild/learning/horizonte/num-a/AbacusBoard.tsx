import { useState } from 'react';
import { ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { TableToggle, pressable } from './boardKit';
import { ABACUS_MAX_DIGIT, REKENREK_BLOCK, abacusValue, rodBeads, sameBeads, tapFive, tapOne } from './beads-model.generated';
import { NUM_A_COPY } from './copy';
import '../horizonte.css';
import './NumShared.css';
import './Rekenrek.css';

type AbacusSegment = Extract<HorizonteSegment, { type: 'math.abacus.v2' }>;

const ROD_W = 104;
const PAD = 16;
const BEAM = 92;
const HEIGHT = 300;
const ONES = REKENREK_BLOCK - 1;
const fiveY = (active: boolean) => (active ? BEAM - 26 : BEAM - 56);
const oneY = (index: number, active: boolean) => BEAM + 26 + index * 36 + (active ? 0 : 22);

const MOVES = { 'add-1': 1, 'take-1': -1, 'add-5': REKENREK_BLOCK, 'take-5': -REKENREK_BLOCK } as const;
type Move = keyof typeof MOVES;
const MOVE_ORDER: readonly Move[] = ['add-1', 'take-1', 'add-5', 'take-5'];
const shift = (digit: number, move: Move): number | null => { const next = digit + MOVES[move]; return next >= 0 && next <= ABACUS_MAX_DIGIT ? next : null; };

/*
 * A06: one to four rods, each with a five bead and four one beads. The learner taps a bead, or drags an add or take chip onto
 * a rod; "Move to" is the keyboard path. The answer is one digit per rod; Core holds the target.
 */
function Abacus({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: AbacusSegment }) {
  const t = copyText(NUM_A_COPY, document.locale);
  const start = segment.payload.start;
  const [digits, setDigits] = useState<number[]>(() => [...start]);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = !sameBeads(digits, start);
  const places = [t.placeOnes, t.placeTens, t.placeHundreds, t.placeThousands];
  const placeName = (rod: number) => places[digits.length - 1 - rod]!;
  const moveLabel: Record<Move, string> = { 'add-1': t.addOne, 'take-1': t.takeOne, 'add-5': t.addFive, 'take-5': t.takeFive };

  const change = (next: number[]) => { grading.reset(); setDigits(next); };
  const set = (rod: number, digit: number) => { if (digit !== digits[rod]) change(digits.map((current, index) => (index === rod ? digit : current))); };
  const place = (item: string, target: string) => {
    const rod = Number(target.slice('rod-'.length));
    const next = shift(digits[rod]!, item as Move);
    if (next !== null) set(rod, next);
  };
  const drag = useDragPlace<string>(place, locked);
  const usable = (move: Move) => digits.some((digit) => shift(digit, move) !== null);
  const reset = () => { grading.reset(); drag.clear(); setDigits([...start]); };
  const width = digits.length * ROD_W + PAD * 2;
  const rodOptions = digits.map((_, rod) => ({ value: `rod-${rod}`, label: placeName(rod) }));

  return <BoardShell screen="abacus" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metAbacus, hint: t.hintAbacus }} onCheck={() => grading.check({ digits })} />}>
    <section className="lf-learning-board lf-num-board" aria-label={t.abacus}>
      <div className="lf-num-scroll">
        <svg className="lf-aba" viewBox={`0 0 ${width} ${HEIGHT}`} role="group" aria-label={t.abacus} focusable="false">
          <rect className="lf-aba-frame" x={2} y={2} width={width - 4} height={HEIGHT - 36} rx={12} />
          <line className="lf-aba-beam" x1={PAD / 2} x2={width - PAD / 2} y1={BEAM} y2={BEAM} />
          {digits.map((digit, rod) => {
            const cx = PAD + ROD_W / 2 + rod * ROD_W;
            const { five, ones } = rodBeads(digit);
            return <g key={rod} className={`lf-aba-rod lf-aba-rod--${rod % 2 === 0 ? 'sky' : 'mint'}`} {...drag.target(`rod-${rod}`)}>
              <rect className="lf-aba-lane" x={cx - ROD_W / 2 + 4} y={8} width={ROD_W - 8} height={HEIGHT - 48} rx={8} />
              <line className="lf-aba-wire" x1={cx} x2={cx} y1={10} y2={HEIGHT - 42} />
              <g className={`lf-aba-bead lf-aba-bead--five${five ? ' lf-aba-bead--on' : ''}`} aria-label={`${placeName(rod)}, ${t.fiveBead}: ${five ? t.counted : t.notCounted}`} aria-pressed={five}
                {...pressable(() => { if (!drag.carried) set(rod, tapFive(digit)); }, locked)}>
                <rect className="lf-aba-hit" x={cx - ROD_W / 2 + 8} y={fiveY(five) - 20} width={ROD_W - 16} height={40} />
                <ellipse className="lf-aba-disc" cx={cx} cy={fiveY(five)} rx={30} ry={16} />
              </g>
              {Array.from({ length: ONES }, (_, index) => {
                const on = index < ones;
                return <g key={index} className={`lf-aba-bead${on ? ' lf-aba-bead--on' : ''}`} aria-label={`${placeName(rod)}, ${fillSlot(t.oneBead, index + 1)}: ${on ? t.counted : t.notCounted}`} aria-pressed={on}
                  {...pressable(() => { if (!drag.carried) set(rod, tapOne(digit, index)); }, locked)}>
                  <rect className="lf-aba-hit" x={cx - ROD_W / 2 + 8} y={oneY(index, on) - 18} width={ROD_W - 16} height={36} />
                  <ellipse className="lf-aba-disc" cx={cx} cy={oneY(index, on)} rx={26} ry={15} />
                </g>;
              })}
              <text className="lf-aba-place" x={cx} y={HEIGHT - 10} textAnchor="middle" data-copy-role="data">{placeName(rod)}</text>
            </g>;
          })}
        </svg>
      </div>
      <p className="lf-num-status" role="status" data-copy-role="data" data-hz-text-equivalent="">
        {digits.map((digit, rod) => `${placeName(rod)}: ${digit}`).join('. ')}. {t.number}: {abacusValue(digits)}
      </p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.abacusCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colPlace}</th><th scope="col" data-copy-role="data">{t.colFive}</th><th scope="col" data-copy-role="data">{t.colOneBeads}</th><th scope="col" data-copy-role="data">{t.colDigit}</th></tr></thead>
        <tbody>{digits.map((digit, rod) => <tr key={rod}><th scope="row" data-copy-role="data">{placeName(rod)}</th><td data-copy-role="data">{rodBeads(digit).five ? 1 : 0}</td><td data-copy-role="data">{rodBeads(digit).ones}</td><td data-copy-role="data">{digit}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" data-copy-role="data">{t.number}</th><td data-copy-role="data" colSpan={3}>{abacusValue(digits)}</td></tr></tfoot>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.abacusTray}>
      <h2 data-copy-role="heading">{t.abacusTray}</h2>
      <div className="lf-num-tray">
        {MOVE_ORDER.map((move) => <span key={move} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
          <ChoiceChip {...drag.chip(move)} disabled={locked || !usable(move)}>{moveLabel[move]}</ChoiceChip>
        </span>)}
      </div>
      <MoveToChoice locale={document.locale} item={drag.carried === null ? null : { label: moveLabel[drag.carried as Move] }} options={rodOptions} disabled={locked}
        onChange={(target) => { if (drag.carried) { place(drag.carried, target); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function AbacusBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.abacus.v2' ? <Abacus segment={segment} {...rest} /> : null;
}
