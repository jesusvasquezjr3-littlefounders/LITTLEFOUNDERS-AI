import { useMemo, useState } from 'react';
import { Button, ChoiceChip, SegmentedControl, Slider } from '../../../design/controls';
import { BoardShell, GradedFoot, useSegmentGrade } from '../../segmentKit';
import type { HorizonteBoardProps } from '../boardTypes';
import type { HorizonteSegment } from '../contract';
import { copyText } from '../copyText';
import { FIN1_COPY } from './copy';
import { CHART, fill, money, percent, plot, polyline, spokenMoney, spokenPercent, tenths, thin, yearsText as yearsOf } from './format';
import {
  COMPOUND_RATE, COMPOUND_YEARS, compoundCents, doublingYearsTenths, growthRows, meetsChallenge, predictionHint, simpleCents, tableYears,
  type CompoundExplanation,
} from './model.generated';
import '../horizonte.css';
import './Fin1Boards.css';

type CompoundSegment = Extract<HorizonteSegment, { type: 'money.compound-interest.v2' }>;

/*
 * F1.10: predict, slide, reveal. The learner picks the value they expect for a fixed case, then Reveal opens the real figure
 * and moves the two sliders onto the case; the sliders also answer the public challenge. The curve draws compound growth
 * (solid) against simple growth (dashed), with a text line and a table as equivalents. The answer is the prediction, the two
 * slider positions and the reason; Core holds the key.
 */
function Compound({ document, segment, onBack, sequence, onGrade }: Omit<HorizonteBoardProps, 'segment'> & { segment: CompoundSegment }) {
  const locale = document.locale;
  const t = copyText(FIN1_COPY, locale);
  const p = segment.payload;
  const [predict, setPredict] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [rate, setRate] = useState<number>(COMPOUND_RATE.min);
  const [years, setYears] = useState<number>(COMPOUND_YEARS.min);
  const [explain, setExplain] = useState<CompoundExplanation | null>(null);
  const [table, setTable] = useState(false);
  const grading = useSegmentGrade(segment.id, onGrade);
  const locked = grading.pending || grading.met;
  const changed = predict !== null || revealed || explain !== null || rate !== COMPOUND_RATE.min || years !== COMPOUND_YEARS.min;

  const rows = useMemo(() => growthRows(p.principalCents, rate, years) ?? [], [p.principalCents, rate, years]);
  const end = rows.at(-1) ?? { year: 0, compoundCents: p.principalCents, simpleCents: p.principalCents };
  const yearsText = (n: number) => yearsOf(t, n, locale);
  const met = meetsChallenge(p.principalCents, p.challenge, rate, years);

  const truth = compoundCents(p.principalCents, p.scenario.rate, p.scenario.years) ?? 0;
  const simpleTruth = simpleCents(p.principalCents, p.scenario.rate, p.scenario.years) ?? 0;
  const hint = revealed && predict !== null ? predictionHint(p.options, predict, truth, simpleTruth) : null;
  const hintText = { right: t.cmpHintRight, simple: t.cmpHintSimple, short: t.cmpHintShort, over: t.cmpHintOver } as const;

  const maxY = Math.max(end.compoundCents, end.simpleCents, p.challenge.minimumCents);
  const line = (pick: (row: (typeof rows)[number]) => number) => polyline(thin(rows, 60).map((row) => plot(CHART, row.year, pick(row), years, maxY)));
  const marker = plot(CHART, years, end.compoundCents, years, maxY);
  const goalY = plot(CHART, 0, p.challenge.minimumCents, years, maxY).y;
  const floorY = CHART.height - CHART.bottom;

  const pick = (id: string) => { grading.reset(); setPredict((current) => (current === id ? null : id)); };
  const reveal = () => { grading.reset(); setRevealed(true); setRate(p.scenario.rate); setYears(p.scenario.years); };
  const reset = () => { grading.reset(); setPredict(null); setRevealed(false); setRate(COMPOUND_RATE.min); setYears(COMPOUND_YEARS.min); setExplain(null); };
  const stepLabels = { decrease: t.less, increase: t.more };
  const status = fill(t.cmpStatus, { years: yearsText(years), rate: percent(rate * 100, locale), compound: money(end.compoundCents, locale), simple: money(end.simpleCents, locale) });

  return <BoardShell screen="compound-interest" locale={locale} title={document.title} segment={segment} onBack={onBack} sequence={sequence}
    finished={grading.met} verdict={grading.result && grading.result !== 'unavailable' ? grading.result.verdict : null}
    onReset={reset} resetDisabled={!changed || locked}
    controls={<Button size="sm" aria-expanded={table} onClick={() => setTable((open) => !open)} data-hz-table-toggle="">{table ? t.hideTable : t.showTable}</Button>}
    foot={<GradedFoot locale={locale} grading={grading} canCheck={predict !== null && explain !== null && !locked} sequence={sequence} feedback={segment.feedback}
      named={{ met: t.cmpMet, hint: t.cmpNot }} onCheck={() => grading.check({ predict, rate, years, explain })} />}>
    <section className="lf-learning-control-strip" aria-label={t.cmpPredictHeading}>
      <h2 data-copy-role="heading">{t.cmpPredictHeading}</h2>
      <p className="lf-fin-strip-help" data-copy-role="body">{t.cmpPredictHelp}</p>
      <div className="lf-fin-chips" role="group" aria-label={t.cmpPredictHeading}>
        {p.options.map((option) => <ChoiceChip key={option.id} selected={predict === option.id} disabled={revealed || locked} onToggle={() => pick(option.id)}>
          {money(option.cents, locale, true)}
        </ChoiceChip>)}
      </div>
      <Button size="sm" variant="secondary" disabled={predict === null || revealed || locked} onClick={reveal}>{t.cmpReveal}</Button>
    </section>
    <section className="lf-learning-board lf-fin" aria-labelledby={`${segment.id}-chart`}>
      <h2 id={`${segment.id}-chart`} data-copy-role="heading">{t.cmpChartHeading}</h2>
      <svg className="lf-fin-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img"
        aria-label={fill(t.cmpChartLabel, { years: yearsText(years), rate: spokenPercent(rate * 100, locale), compound: spokenMoney(end.compoundCents, locale), simple: spokenMoney(end.simpleCents, locale) })}>
        <line className="lf-fin-axis" x1={CHART.left} y1={floorY} x2={CHART.width - CHART.right} y2={floorY} />
        <line className="lf-fin-goal" x1={CHART.left} y1={goalY} x2={CHART.width - CHART.right} y2={goalY} />
        <polyline className="lf-fin-line lf-fin-line--second" points={line((row) => row.simpleCents)} />
        <polyline className="lf-fin-line lf-fin-line--main" points={line((row) => row.compoundCents)} />
        <circle className="lf-fin-marker" cx={marker.x} cy={marker.y} r="5" />
      </svg>
      <div className="lf-fin-legend" data-copy-role="data">
        <span><i className="lf-fin-swatch" aria-hidden="true" />{t.cmpLegendCompound}</span>
        <span><i className="lf-fin-swatch lf-fin-swatch--second" aria-hidden="true" />{t.cmpLegendSimple}</span>
      </div>
      <p className="lf-fin-status" role="status" data-copy-role="data" data-hz-text-equivalent="">{status}</p>
      <div className="lf-fin-challenge" data-met={met}>
        <p data-copy-role="data">{fill(t.cmpChallenge, { amount: money(p.challenge.minimumCents, locale, true), years: yearsText(p.challenge.maximumYears) })}</p>
        <p data-copy-role="body" role="status">{met ? t.cmpChallengeMet : t.cmpChallengeOpen}</p>
      </div>
      {revealed ? <div className="lf-fin-reveal" role="status">
        <p data-copy-role="data">{fill(t.cmpOutcome, { rate: percent(p.scenario.rate * 100, locale), years: yearsText(p.scenario.years), deposit: money(p.principalCents, locale, true), amount: money(truth, locale) })}</p>
        {hint ? <p data-copy-role="body">{hintText[hint]}</p> : null}
        <p data-copy-role="data">{fill(t.cmpDoubling, { rate: percent(rate * 100, locale), years: tenths(doublingYearsTenths(rate), locale) })}</p>
      </div> : null}
      {table ? <div className="lf-fin-table-wrap"><table className="lf-hz-table" data-hz-table="">
        <caption data-copy-role="heading">{t.cmpTableCaption}</caption>
        <thead><tr>
          <th scope="col" data-copy-role="data">{t.cmpColYear}</th><th scope="col" data-copy-role="data">{t.cmpColCompound}</th><th scope="col" data-copy-role="data">{t.cmpColSimple}</th>
        </tr></thead>
        <tbody>{tableYears(years).map((year) => {
          const row = rows[year];
          return row ? <tr key={year}>
            <th scope="row" data-copy-role="data">{year}</th><td data-copy-role="data">{money(row.compoundCents, locale)}</td><td data-copy-role="data">{money(row.simpleCents, locale)}</td>
          </tr> : null;
        })}</tbody>
      </table></div> : null}
    </section>
    <section className="lf-learning-control-strip" aria-label={t.cmpTryHeading}>
      <h2 data-copy-role="heading">{t.cmpTryHeading}</h2>
      <div className="lf-fin-sliders">
        <Slider label={t.cmpRate} valueText={percent(rate * 100, locale)} min={COMPOUND_RATE.min} max={COMPOUND_RATE.max} value={rate}
          onValueChange={(value) => { grading.reset(); setRate(value); }} disabled={predict === null || locked} stepLabels={stepLabels} />
        <Slider label={t.cmpYears} valueText={yearsText(years)} min={COMPOUND_YEARS.min} max={COMPOUND_YEARS.max} value={years}
          onValueChange={(value) => { grading.reset(); setYears(value); }} disabled={predict === null || locked} stepLabels={stepLabels} />
      </div>
    </section>
    <section className="lf-learning-control-strip" aria-label={t.cmpExplainLegend}>
      <SegmentedControl legend={t.cmpExplainLegend} name={`${segment.id}-explain`} value={explain} disabled={locked}
        options={p.explain.map((id) => ({ value: id, label: t[`cmpExplain.${id}`] }))}
        onValueChange={(id) => { grading.reset(); setExplain(id); }} />
    </section>
  </BoardShell>;
}

export default function CompoundBoard({ segment, ...rest }: HorizonteBoardProps) {
  return segment.type === 'money.compound-interest.v2' ? <Compound segment={segment} {...rest} /> : null;
}
