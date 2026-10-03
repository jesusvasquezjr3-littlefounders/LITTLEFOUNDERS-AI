import { useMemo, useState } from 'react';
import { ChoiceChip } from '../../../design/controls';
import { BoardShell, GradedFoot, MoveToChoice, useDragPlace, useSegmentGrade } from '../../segmentKit';
import { BoardLabel, LabelledDrawing } from '../BoardLabel';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText, fillSlot } from '../copyText';
import { TableToggle } from './boardKit';
import { PAN_LEFT, PAN_RIGHT, PAN_TRAY, balanceSetup, panDifference, panTotals, untouchedPans } from './measure-model.generated';
import { NUM_A_COPY } from './copy';
import '../horizonte.css';
import './NumShared.css';
import './Measure.css';

type BalanceSegment = Extract<HorizonteSegment, { type: 'math.pan-balance.v2' }>;

const BOX = { width: 560, height: 250 };
const PIVOT = { x: 280, y: 56 };
const HALF = 190;
const HANG = 96;
const BOWL = 85;
const CELL = 34;
const PER_ROW = 5;
const MAX_TILT = 14;
const REGIONS = [PAN_LEFT, PAN_TRAY, PAN_RIGHT] as const;

/*
 * A16: a pan balance with fixed weights on each pan and loose weights in a tray. The learner moves a weight to a pan by tapping it
 * and then the pan, by dragging it, or with its "Move to" menu; the beam tilts with the difference. Core holds the target difference.
 */
function PanBalance({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: BalanceSegment }) {
  const t = copyText(NUM_A_COPY, document.locale);
  const setup = useMemo(() => balanceSetup(segment.payload)!, [segment.payload]);
  const [pans, setPans] = useState<number[]>(() => untouchedPans(setup));
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = pans.some((pan) => pan !== PAN_TRAY);
  const totals = panTotals(setup, pans);
  const difference = panDifference(setup, pans);
  const regionName = (pan: number) => (pan === PAN_LEFT ? t.leftPan : pan === PAN_RIGHT ? t.rightPan : t.trayName);
  const loose = (pan: number) => setup.weights.flatMap((weight, index) => (pans[index] === pan ? [{ weight, index }] : []));
  const fixed = (pan: number) => (pan === PAN_LEFT ? setup.left : pan === PAN_RIGHT ? setup.right : []);
  const weightLabel = (index: number) => fillSlot(t.weight, setup.weights[index]!);
  const verdictText = difference === 0 ? t.balanced : fillSlot(difference > 0 ? t.heavierLeft : t.heavierRight, Math.abs(difference));
  const summary = `${t.leftPan}: ${totals.left}. ${t.rightPan}: ${totals.right}. ${verdictText}`;

  const change = (next: number[]) => { grading.reset(); setPans(next); };
  const place = (item: string, target: string) => {
    const index = Number(item.slice('w-'.length));
    const pan = Number(target.slice('pan-'.length));
    if (pans[index] !== pan) change(pans.map((current, at) => (at === index ? pan : current)));
  };
  const drag = useDragPlace<string>(place, locked);
  const reset = () => { grading.reset(); drag.clear(); setPans(untouchedPans(setup)); };
  const options = REGIONS.map((pan) => ({ value: `pan-${pan}`, label: regionName(pan) }));

  const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, difference * 3));
  const radians = (tilt * Math.PI) / 180;
  const end = (side: -1 | 1) => ({ x: PIVOT.x + side * HALF * Math.cos(radians), y: PIVOT.y - side * HALF * Math.sin(radians) });
  const panAt = (side: -1 | 1, region: number) => {
    const hook = end(side);
    const cy = hook.y + HANG;
    const blocks = [...fixed(region).map((weight) => ({ weight, loose: false })), ...loose(region).map(({ weight }) => ({ weight, loose: true }))];
    const cell = (index: number) => ({ x: hook.x - (PER_ROW * CELL) / 2 + (index % PER_ROW) * CELL, y: cy - 4 - (Math.floor(index / PER_ROW) + 1) * 30 });
    return { side, region, hook, cy, blocks, cell };
  };
  const sides = [panAt(-1, PAN_LEFT), panAt(1, PAN_RIGHT)];
  const drawPan = ({ side, region, hook, cy, blocks, cell }: (typeof sides)[number]) => {
    return <g key={region} className={`lf-pan-side lf-pan-side--${side < 0 ? 'sky' : 'mint'}`}>
      <line className="lf-pan-string" x1={hook.x} y1={hook.y} x2={hook.x - BOWL} y2={cy} />
      <line className="lf-pan-string" x1={hook.x} y1={hook.y} x2={hook.x + BOWL} y2={cy} />
      <path className="lf-pan-bowl" d={`M ${hook.x - BOWL} ${cy} Q ${hook.x} ${cy + 40} ${hook.x + BOWL} ${cy} Z`} />
      {blocks.map((block, index) => <g key={index} className={`lf-pan-weight${block.loose ? '' : ' lf-pan-weight--fixed'}`}>
        <rect x={cell(index).x + 2} y={cell(index).y} width={CELL - 4} height={26} rx={5} />
      </g>)}
    </g>;
  };

  return <BoardShell screen="pan-balance" locale={document.locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={document.locale} grading={grading} canCheck={changed && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metPan, hint: t.hintPan }} onCheck={() => grading.check({ pans })} />}>
    <section className="lf-learning-board lf-num-board" aria-label={t.panBalance}>
      <div className="lf-num-scroll"><LabelledDrawing className="lf-num-drawing lf-num-drawing--pan">
        <svg className="lf-pan" viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={`${t.panBalance}: ${summary}`} focusable="false">
          <polygon className="lf-pan-fulcrum" points={`${PIVOT.x},${PIVOT.y} ${PIVOT.x - 34},232 ${PIVOT.x + 34},232`} />
          <line className="lf-pan-beam" x1={end(-1).x} y1={end(-1).y} x2={end(1).x} y2={end(1).y} />
          {sides.map(drawPan)}
          <circle className="lf-pan-pivot" cx={PIVOT.x} cy={PIVOT.y} r={9} />
        </svg>
        {sides.flatMap(({ region, blocks, cell }) => blocks.map((block, index) => <BoardLabel key={`${region}-${index}`} box={BOX} x={cell(index).x + CELL / 2} y={cell(index).y + 13} room={CELL - 4}>{block.weight}</BoardLabel>))}
      </LabelledDrawing></div>
      <p className="lf-num-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{summary}</p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.panCaption}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colPan}</th><th scope="col" data-copy-role="data">{t.colWeights}</th><th scope="col" data-copy-role="data">{t.total}</th></tr></thead>
        <tbody>{REGIONS.map((region) => <tr key={region}>
          <th scope="row" data-copy-role="data">{regionName(region)}</th>
          <td data-copy-role="data">{[...fixed(region), ...loose(region).map(({ weight }) => weight)].join(', ')}</td>
          <td data-copy-role="data">{region === PAN_LEFT ? totals.left : region === PAN_RIGHT ? totals.right : ''}</td>
        </tr>)}</tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.trayHeading}>
      <h2 data-copy-role="heading">{t.trayHeading}</h2>
      <div className="lf-pan-regions">
        {REGIONS.map((region) => {
          const target = drag.target(`pan-${region}`);
          return <div key={region} className="lf-pan-region" {...target}
            onClick={(event) => { if (!(event.target as Element).closest('.lf-hz-handle')) (target as { onClick?: () => void }).onClick?.(); }}>
            <h3 data-copy-role="data">{regionName(region)}</h3>
            <ul className="lf-pan-fixed">
              {fixed(region).map((weight, index) => <li key={index} aria-label={fillSlot(t.fixedWeight, weight)} data-copy-role="data">{weight}</li>)}
            </ul>
            <div className="lf-num-tray">
              {loose(region).map(({ index }) => <span key={index} className="lf-hz-handle" data-hz-handle="" data-hz-hit="64">
                <ChoiceChip {...drag.chip(`w-${index}`)} disabled={locked}>{weightLabel(index)}</ChoiceChip>
              </span>)}
            </div>
          </div>;
        })}
      </div>
      <MoveToChoice locale={document.locale} item={drag.carried === null ? null : { label: weightLabel(Number(drag.carried.slice('w-'.length))) }} options={options} disabled={locked}
        onChange={(value) => { if (drag.carried) { place(drag.carried, value); drag.clear(); } }} />
    </section>
  </BoardShell>;
}

export default function PanBalanceBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'math.pan-balance.v2' ? <PanBalance segment={segment} {...rest} /> : null;
}
