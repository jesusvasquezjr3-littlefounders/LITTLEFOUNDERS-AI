import { useId, useState, type CSSProperties } from 'react';
import { TextField } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { BoardShell, GradedFoot, playerCopy, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { PROB_COPY } from './copy';
import { readChance, treeBasis, treeCounts, type TreeCounts } from './model.generated';
import { GRID_PAD, GRID_VIEW_W, planGrid } from './bayesGrid';
import { TableToggle, fmt, people, slots } from './shared';
import '../horizonte.css';
import './prob.css';

type BayesSegment = Extract<HorizonteSegment, { type: 'prob.bayes.v2' }>;
type Group = 'hasPos' | 'hasNeg' | 'lacksPos' | 'lacksNeg';

const GROUPS: readonly Group[] = ['hasPos', 'hasNeg', 'lacksPos', 'lacksNeg'];
const GROUP_NAME = { hasPos: 'slotHasPos', hasNeg: 'slotHasNeg', lacksPos: 'slotLacksPos', lacksNeg: 'slotLacksNeg' } as const satisfies Record<Group, keyof typeof PROB_COPY>;
const ASKED = { positive: ['hasPos', 'lacksPos'], negative: ['hasNeg', 'lacksNeg'] } as const satisfies Record<'positive' | 'negative', readonly Group[]>;

type Outline = ReadonlyArray<readonly [number, number]>;

const rectangle = (left: number, top: number, right: number, bottom: number): Outline => [[left, top], [right, top], [right, bottom], [left, bottom]];

/** The outline, in cell units, of the people a run covers when the grid fills column by column. */
function runOutlines(start: number, end: number, rows: number): Outline[] {
  if (end <= start) return [];
  const first = Math.floor(start / rows);
  const top = start % rows;
  const last = Math.floor((end - 1) / rows);
  const bottom = (end - 1) % rows;
  if (first === last) return [rectangle(first, top, first + 1, bottom + 1)];
  if (last === first + 1 && top > bottom + 1) return [rectangle(first, top, first + 1, rows), rectangle(last, 0, last + 1, bottom + 1)];
  return [[[first, top], [first + 1, top], [first + 1, 0], [last, 0], [last + 1, 0], [last + 1, bottom + 1], [last, bottom + 1], [last, rows], [first, rows]]];
}

const chanceEcho = (reading: string, locale: Locale): string => (reading.includes('/') ? reading : new Intl.NumberFormat(locale, { maximumFractionDigits: 12 }).format(Number(reading)));

/*
 * H29: the same population as the tree, drawn person by person in four groups (have it or not, positive or not) with the
 * four head counts written out. The learner reads the chance of having it among the people with one result and types it
 * as a percent, a decimal or a fraction. Core holds the exact share and the allowance.
 */
function Bayes({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: BayesSegment }) {
  const locale = document.locale;
  const t = copyText(PROB_COPY, locale);
  const player = playerCopy(locale);
  const { population, ask } = segment.payload;
  const counts: TreeCounts = treeCounts(treeBasis(segment.payload)!)!;
  const [text, setText] = useState('');
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const reading = readChance(text);
  const pattern = `lf-prob-cells-${useId().replace(/:/g, '')}`;

  const amount: Readonly<Record<Group, number>> = { hasPos: counts.hasPos, hasNeg: counts.hasNeg, lacksPos: counts.lacksPos, lacksNeg: counts.lacksNeg };
  const { rows, cell, tile, perSquare, height, heavy } = planGrid(population);
  const asked: readonly Group[] = ASKED[ask];
  let cursor = 0;
  const layout = GROUPS.map((group) => {
    const from = cursor;
    cursor += amount[group];
    return { group, shapes: runOutlines(from, cursor, rows) };
  });
  const outline = ask === 'positive' ? t.outlinePos : t.outlineNeg;
  const error = text.trim() !== '' && reading === null ? t.chanceError : undefined;
  const echo = reading === null ? ' ' : slots(player.readsAs, { value: chanceEcho(reading, locale) });

  return <BoardShell screen="natural-frequencies" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={() => { grading.reset(); setText(''); }} resetDisabled={text === '' || locked}
    controls={<TableToggle open={table} onToggle={() => setTable((open) => !open)} show={t.showTable} hide={t.hideTable} />}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={reading !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.metBayes, hint: t.hintBayes }} onCheck={() => { if (reading !== null) grading.check({ value: reading }); }} />}>
    <section className="lf-learning-board lf-prob" aria-label={t.bayesName}>
      <svg className="lf-prob-chart" viewBox={`0 0 ${GRID_VIEW_W} ${height}`} role="img" aria-label={t.bayesName} focusable="false" data-copy-role="data" style={{ '--lf-prob-heavy': `${heavy.toFixed(2)}px` } as CSSProperties}>
        <defs>
          <pattern id={pattern} x={GRID_PAD} y={GRID_PAD} width={tile} height={tile} patternUnits="userSpaceOnUse"><path className="lf-prob-gridline" d={`M${tile} 0V${tile}M0 ${tile}H${tile}`} /></pattern>
        </defs>
        {layout.map(({ group, shapes }) => <g key={group} className={`lf-prob-group lf-prob-group--${group}${asked.includes(group) ? ' lf-prob-group--asked' : ''}`}>
          {shapes.map((shape, index) => {
            const path = `${shape.map(([x, y], at) => `${at === 0 ? 'M' : 'L'}${(GRID_PAD + x * cell).toFixed(2)} ${(GRID_PAD + y * cell).toFixed(2)}`).join('')}Z`;
            return <g key={index}>
              <path className="lf-prob-block" d={path} />
              <path className="lf-prob-cells" d={path} fill={`url(#${pattern})`} />
            </g>;
          })}
        </g>)}
      </svg>
      <p className="lf-prob-total" data-copy-role="data">{slots(t.inAll, { n: people(locale, population, t) })}</p>
      {perSquare > 1 ? <p className="lf-prob-scale" data-copy-role="data">{slots(t.gridScale, { n: people(locale, perSquare, t) })}</p> : null}
      <ul className="lf-prob-legend" data-hz-text-equivalent="">
        {GROUPS.map((group) => <li key={group} className={asked.includes(group) ? 'lf-prob-legend-item lf-prob-legend-item--asked' : 'lf-prob-legend-item'} data-copy-role="data">
          <span className={`lf-prob-swatch lf-prob-swatch--${group}`} aria-hidden="true" />
          {t[GROUP_NAME[group]]}: {people(locale, amount[group], t)}
        </li>)}
      </ul>
      <p className="lf-prob-outline" data-copy-role="data">{outline}</p>
      {table ? <table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.tableCaptionBayes}</caption>
        <thead><tr><th scope="col" data-copy-role="data">{t.colGroup}</th><th scope="col" data-copy-role="data">{t.resultPos}</th><th scope="col" data-copy-role="data">{t.resultNeg}</th></tr></thead>
        <tbody>
          <tr><th scope="row" data-copy-role="data">{t.slotHas}</th><td data-copy-role="data">{fmt(locale, counts.hasPos, 0)}</td><td data-copy-role="data">{fmt(locale, counts.hasNeg, 0)}</td></tr>
          <tr><th scope="row" data-copy-role="data">{t.slotLacks}</th><td data-copy-role="data">{fmt(locale, counts.lacksPos, 0)}</td><td data-copy-role="data">{fmt(locale, counts.lacksNeg, 0)}</td></tr>
        </tbody>
      </table> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.chanceLabel}>
      <div className="lf-number-answer">
        <TextField label={t.chanceLabel} help={t.chanceHelp} inputMode="decimal" autoComplete="off" value={text} disabled={locked} error={error}
          onChange={(event) => { grading.reset(); setText(event.target.value); }} />
        <p className="lf-number-echo" data-copy-role="body" aria-live="polite">{echo}</p>
      </div>
    </section>
  </BoardShell>;
}

export default function BayesBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'prob.bayes.v2' ? <Bayes segment={segment} {...rest} /> : null;
}
