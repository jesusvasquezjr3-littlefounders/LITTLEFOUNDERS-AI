import { useMemo, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import { growthComparison } from './growthComparisonModel.generated';
import { TeachingChartBoard } from './TeachingChartBoard';
import { ParameterSlider } from './ParameterSlider';
import { ScaleToggle } from './ScaleToggle';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import './learning.css';
import './growthComparison.css';

type ComparisonSegment = Extract<LessonClientSegment, { type: 'visual.growth-comparison.v2' }>;

const copy: Record<Locale, {
  back: string; explore: string; board: string; showTable: string; showChart: string; title: string; prompt: string;
  rate: string; years: string; prediction: string; simple: string; compound: string; year: string;
  hidden: string; reveal: string; tryAgain: string; continue: string; reset: string; start: string; difference: string;
  chart: string; chartHidden: string; chartShown: string; perYear: string; horizontalAxis: string; verticalAxis: string;
  aboveScale: string; scale: string; nearScale: string; longScale: string;
}> = {
  'en-US': {
    back: 'Back', explore: 'Explore', board: 'Board', showTable: 'Show as table', showChart: 'Show chart',
    title: 'Two ways to grow', prompt: 'Same starting amount and rate. Predict the total with compound interest.',
    rate: 'Annual rate', years: 'Years', prediction: 'Your prediction', simple: 'Simple', compound: 'Compound',
    year: 'Year', hidden: 'Hidden', reveal: 'Reveal', tryAgain: 'Try another', continue: 'Continue', reset: 'Reset', start: 'Start',
    difference: 'Difference', chart: 'Two-line growth chart', chartHidden: 'Compound line hidden until reveal',
    chartShown: 'Both lines shown', perYear: 'per year', horizontalAxis: 'years', verticalAxis: 'amount',
    aboveScale: 'above chart scale', scale: 'Time scale', nearScale: '5 years', longScale: '30 years',
  },
  'es-MX': {
    back: 'Volver', explore: 'Explorar', board: 'Pizarrón', showTable: 'Ver tabla', showChart: 'Ver gráfico',
    title: 'Dos formas de crecer', prompt: 'Mismo monto y tasa. Predice el total con interés compuesto.',
    rate: 'Tasa anual', years: 'Años', prediction: 'Tu predicción', simple: 'Simple', compound: 'Compuesto',
    year: 'Año', hidden: 'Oculto', reveal: 'Revelar', tryAgain: 'Probar otra', continue: 'Continuar', reset: 'Restablecer', start: 'Inicio',
    difference: 'Diferencia', chart: 'Gráfica de dos líneas', chartHidden: 'La línea compuesta se revela después',
    chartShown: 'Ambas líneas visibles', perYear: 'al año', horizontalAxis: 'años', verticalAxis: 'cantidad',
    aboveScale: 'sobre la escala', scale: 'Escala de tiempo', nearScale: '5 años', longScale: '30 años',
  },
  'pt-BR': {
    back: 'Voltar', explore: 'Explorar', board: 'Quadro', showTable: 'Ver tabela', showChart: 'Ver gráfico',
    title: 'Duas formas de crescer', prompt: 'Mesmo valor e taxa. Preveja o total com juros compostos.',
    rate: 'Taxa anual', years: 'Anos', prediction: 'Sua previsão', simple: 'Simples', compound: 'Composto',
    year: 'Ano', hidden: 'Oculto', reveal: 'Revelar', tryAgain: 'Tentar outra', continue: 'Continuar', reset: 'Recomeçar', start: 'Início',
    difference: 'Diferença', chart: 'Gráfico de duas linhas', chartHidden: 'Linha composta oculta até revelar',
    chartShown: 'Ambas as linhas visíveis', perYear: 'ao ano', horizontalAxis: 'anos', verticalAxis: 'valor',
    aboveScale: 'acima da escala', scale: 'Escala de tempo', nearScale: '5 anos', longScale: '30 anos',
  },
};
const localCurrency: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };

/** A controlled teen fixture; publication still requires a versioned server contract. */
export function growthComparisonPilotDocument(locale: Locale): unknown {
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-13-17',
    chapter_id: 'growth-comparison', lesson_id: 'pilot-simple-compound', version_id: 'rev-1',
    locale, age_band: '13-17', eligibility: ageEligibilityForBand('13-17'), knowledge_component_ids: ['kc-simple-compound-growth'],
    adventure_scene_id: 'diorama-a', title: t.title,
    required_capabilities: ['visual.multi-line.v1', 'operation.parameter-slider.v1', 'operation.predict-reveal.v1', 'operation.scale-toggle.v1'],
    segments: [{ id: 'compare-01', type: 'visual.growth-comparison.v2', grading: 'none',
      prompt: t.prompt, visual: { type: 'multi-line' }, payload: {
        principalMinor: 10_000, minimumRateBps: 200, maximumRateBps: 1_200, rateStepBps: 200,
        initialRateBps: 800, minimumYears: 5, maximumYears: 30, yearStep: 5, initialYears: 10,
        predictionStepMinor: 1_000, predictionMaximumMinor: 1_000_000,
      } }],
  };
}

export function GrowthComparisonBoard({ document, segment, onBack, sequence }: {
  document: LessonClientDocument; segment: ComparisonSegment; onBack: () => void; sequence?: LessonSequenceControl;
}) {
  const locale = document.locale;
  const t = copy[locale];
  const p = segment.payload;
  const initialPrediction = p.principalMinor;
  const [rate, setRate] = useState(p.initialRateBps);
  const [years, setYears] = useState(p.initialYears);
  const [prediction, setPrediction] = useState(initialPrediction);
  const [committed, setCommitted] = useState<number | null>(null);
  const points = growthComparison({ principalMinor: p.principalMinor, rateBasisPoints: rate, years }) ?? [];
  const final = points.at(-1);
  // The prediction changes only its mark, never the meaning of the chart's axis.
  const axisMaximum = Math.ceil(Math.max(final?.simpleMinor ?? p.principalMinor,
    final?.compoundMinor ?? p.principalMinor) * 1.2 / p.predictionStepMinor) * p.predictionStepMinor;
  const predictionAboveScale = (committed ?? prediction) > axisMaximum;
  const number = useMemo(() => new Intl.NumberFormat(locale, { style: 'currency',
    currency: localCurrency[locale], currencyDisplay: 'code' }), [locale]);
  const percent = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const money = (minor: number) => number.format(minor / 100);
  const changeRate = (next: number) => { setRate(next); setCommitted(null); };
  const changeYears = (next: number) => { setYears(next); setCommitted(null); };
  const changePrediction = (next: number) => { setPrediction(next); setCommitted(null); };
  const reset = () => { setRate(p.initialRateBps); setYears(p.initialYears); setPrediction(initialPrediction); setCommitted(null); };
  const x = (year: number) => 24 + year * 252 / years;
  const y = (minor: number) => 144 - minor * 120 / axisMaximum;
  const simplePoints = points.map((point) => `${x(point.year)},${y(point.simpleMinor)}`).join(' ');
  const compoundPoints = points.map((point) => `${x(point.year)},${y(point.compoundMinor)}`).join(' ');
  const difference = final ? final.compoundMinor - final.simpleMinor : 0;
  const threeColumnTable = <table className="lf-learning-table" aria-label={t.board}>
    <thead><tr><th scope="col" data-copy-role="data">{t.year}</th><th scope="col" data-copy-role="data">{t.simple}</th>
      <th scope="col" data-copy-role="data">{t.compound}</th></tr></thead>
    <tbody>{points.map((point) => <tr key={point.year}>
      <th scope="row" data-label={t.year} data-copy-role="data">{point.year}</th>
      <td data-label={t.simple} data-copy-role="data">{money(point.simpleMinor)}</td>
      <td data-label={t.compound} data-copy-role="data">{committed === null ? t.hidden : money(point.compoundMinor)}</td>
    </tr>)}</tbody>
  </table>;

  return <main className="lf-learning lf-learning--sticky-foot" data-surface="app" data-screen="growth-comparison">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        {sequence ? <div className="lf-learning-progress" role="progressbar" aria-label={t.explore} aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={sequenceProgress(sequence, committed !== null)} data-copy-role="data">
          <span style={{ inlineSize: `${sequenceProgress(sequence, committed !== null)}%` }} />
        </div> : null}<span data-copy-role={sequence ? 'data' : 'body'}>{sequence ? `${sequence.index + 1}/${sequence.total}` : t.explore}</span>
      </header>
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1>
          <p data-copy-role="prompt">{segment.prompt}</p></div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart}
          table={threeColumnTable}
          controlLeading={<Button onClick={reset} disabled={rate === p.initialRateBps && years === p.initialYears
            && prediction === initialPrediction && committed === null}>{t.reset}</Button>}
          chart={<>
            <div className="lf-growth-compare-meta" data-copy-role="data">{t.start}: {money(p.principalMinor)} · {percent.format(rate / 100)}% {t.perYear}</div>
            <div className="lf-growth-compare-chart" role="img" aria-label={`${t.chart}. ${t.horizontalAxis}: 0–${years}. ${t.verticalAxis}: 0–${money(axisMaximum)}. ${t.simple}: ${final ? money(final.simpleMinor) : ''}. ${committed === null ? t.chartHidden : `${t.chartShown}. ${t.compound}: ${final ? money(final.compoundMinor) : ''}.`}`}>
              <svg viewBox="0 0 300 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <line x1="24" y1="24" x2="24" y2="144" className="lf-growth-compare-axis" />
                <line x1="24" y1="144" x2="276" y2="144" className="lf-growth-compare-axis" />
                <polyline points={simplePoints} className="lf-growth-compare-simple" />
                {committed !== null ? <polyline points={compoundPoints} className="lf-growth-compare-compound" /> : null}
                {predictionAboveScale
                  ? <path d="M 269 32 L 276 20 L 283 32 Z" className="lf-growth-compare-prediction" />
                  : <circle cx="276" cy={y(committed ?? prediction)} r="6" className="lf-growth-compare-prediction" />}
              </svg>
              <span className="lf-growth-compare-scale-max" aria-hidden="true" data-copy-role="data">{money(axisMaximum)}</span>
            </div>
            <div className="lf-growth-compare-legend" data-copy-role="data"><span className="lf-growth-compare-legend-simple">{t.simple}</span>
              {committed !== null ? <span className="lf-growth-compare-legend-compound">{t.compound}</span> : null}
              <span className="lf-growth-compare-legend-prediction">{t.prediction}: {money(committed ?? prediction)}
                {predictionAboveScale ? ` (${t.aboveScale})` : null}</span></div>
            <div className="lf-growth-compare-axis-labels" data-copy-role="data"><span>0</span><span>{years} {t.years.toLowerCase()}</span></div>
          </>}>
          {() => <div className="lf-growth-compare-controls">
            <ScaleToggle label={t.scale} value={years} onValueChange={changeYears} options={[
              { value: p.minimumYears, label: t.nearScale }, { value: p.maximumYears, label: t.longScale },
            ]} />
            <ParameterSlider label={t.prediction} valueText={money(prediction)} minimum={p.principalMinor}
              maximum={p.predictionMaximumMinor} step={p.predictionStepMinor} value={prediction} onValueChange={changePrediction} />
            <ParameterSlider label={t.rate} valueText={`${percent.format(rate / 100)}%`} minimum={p.minimumRateBps}
              maximum={p.maximumRateBps} step={p.rateStepBps} value={rate} onValueChange={changeRate} />
            <ParameterSlider label={t.years} valueText={percent.format(years)} minimum={p.minimumYears}
              maximum={p.maximumYears} step={p.yearStep} value={years} onValueChange={changeYears} />
          </div>}
        </TeachingChartBoard>
        {committed !== null && final ? <div className="lf-growth-compare-outcome" role="status" aria-live="polite">
          <span data-copy-role="data">{t.compound}: {money(final.compoundMinor)}</span>
          <span data-copy-role="data">{t.difference}: {money(difference)}</span>
        </div> : null}
        <footer className="lf-learning-foot">
          <div className="lf-learning-actions"><Button variant={committed === null || sequence ? 'accent' : undefined}
            disabled={committed === null && prediction === p.principalMinor}
            onClick={() => committed === null ? setCommitted(prediction) : sequence ? sequence.onAdvance() : reset()}>
            {committed === null ? t.reveal : sequence ? t.continue : t.tryAgain}</Button></div>
        </footer>
      </div>
    </div>
  </main>;
}
