import { useMemo, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, SegmentedControl, Slider } from '../design/controls';
import { taxBracketModel } from './taxBracketModel.generated';
import { TeachingChartBoard } from './TeachingChartBoard';
import { TeachingChart } from './charts/TeachingChart';
import type { ChartData } from './charts/chartModel.generated';
import { StackedSlicesVisual } from './pizarron';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import './learning.css';
import './taxBracket.css';
import { LessonStageSlot } from './lessonStage';
import type { LessonSequenceControl } from './lessonSequence';
import { GradedFoot, NumberAnswer, SegmentPrompt, useSegmentGrade, type OnGradeSegment, gradeStageVerdict } from './segmentKit';
import { playerCopy, SegmentProgress } from './segmentKit';
const playerContinue = (locale: Locale) => playerCopy(locale).continue;


type TaxSegment = Extract<LessonClientSegment, { type: 'visual.tax-bracket.v2' }>;
const copy: Record<Locale, { back: string; explore: string; board: string; chart: string; showTable: string; showChart: string; income: string; tax: string; takeHome: string; marginal: string; average: string; bracket: string; taxable: string; reset: string; title: string; prompt: string }> = {
  'en-US': { back: 'Back', explore: 'Explore', board: 'Tax board', chart: 'Tax bracket stacked bar', showTable: 'Show as table', showChart: 'Show chart', income: 'Income', tax: 'Tax', takeHome: 'Take home', marginal: 'Marginal rate', average: 'Average rate', bracket: 'Bracket', taxable: 'Taxed here', reset: 'Reset', title: 'How brackets fill', prompt: 'Move income. A higher bracket changes only the part that reaches it.' },
  'es-MX': { back: 'Volver', explore: 'Explorar', board: 'Pizarrón fiscal', chart: 'Barra apilada de tramos fiscales', showTable: 'Ver tabla', showChart: 'Ver gráfico', income: 'Ingreso', tax: 'Impuesto', takeHome: 'Te queda', marginal: 'Tasa marginal', average: 'Tasa promedio', bracket: 'Tramo', taxable: 'Gravado aquí', reset: 'Restablecer', title: 'Cómo se llenan los tramos', prompt: 'Cambia el ingreso. Una tasa mayor afecta solo la parte que llega a ese tramo.' },
  'pt-BR': { back: 'Voltar', explore: 'Explorar', board: 'Quadro fiscal', chart: 'Barra empilhada de faixas fiscais', showTable: 'Ver tabela', showChart: 'Ver gráfico', income: 'Renda', tax: 'Imposto', takeHome: 'Você recebe', marginal: 'Alíquota marginal', average: 'Alíquota média', bracket: 'Faixa', taxable: 'Tributado aqui', reset: 'Recomeçar', title: 'Como as faixas se preenchem', prompt: 'Mude a renda. Uma alíquota maior afeta só a parte que chega àquela faixa.' },
};
const currencies: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };

export function taxBracketPilotDocument(locale: Locale): unknown {
  const t = copy[locale];
  return { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-13-17', chapter_id: 'tax-basics', lesson_id: 'pilot-tax-brackets', version_id: 'rev-1', locale, age_band: '13-17', eligibility: { minimum_age: 14, maximum_age: 17 }, knowledge_component_ids: ['kc-marginal-tax'], adventure_scene_id: 'diorama-a', title: t.title,
    required_capabilities: ['visual.stacked-bar.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'], segments: [{ id: 'tax-01', type: 'visual.tax-bracket.v2', grading: 'none', prompt: t.prompt, visual: { type: 'stacked-bar' }, payload: { minimumIncomeMinor: 0, maximumIncomeMinor: 60_000, incomeStepMinor: 5_000, initialIncomeMinor: 30_000, brackets: [{ upToMinor: 10_000, rateBasisPoints: 1_000 }, { upToMinor: 30_000, rateBasisPoints: 2_000 }, { upToMinor: null, rateBasisPoints: 3_000 }] } }] };
}

export function TaxBracketBoard({ document, segment, onBack, sequence, onGrade }: { document: LessonClientDocument; segment: TaxSegment; onBack: () => void; sequence?: LessonSequenceControl; onGrade?: OnGradeSegment }) {
  const t = copy[document.locale]; const p = segment.payload; const [income, setIncomeValue] = useState(p.initialIncomeMinor);
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server' && !!onGrade;
  const hide = graded && !grading.met;
  const [typed, setTyped] = useState<string | null>(null);
  const [marginal, setMarginal] = useState<string | null>(null);
  const setIncome = (value: number) => { grading.reset(); setIncomeValue(value); };
  const model = taxBracketModel(income, p.brackets); if (!model) return null;
  // The typed tax is in major units; Core compares minor units, so only amounts with at most two decimals are sent.
  const typedMinor = typed === null ? null : (() => { const [whole, fraction = ''] = typed.split('.'); return fraction.length <= 2 ? String(Number(whole) * 100 + Number(fraction.padEnd(2, '0')) * (typed.startsWith('-') ? -1 : 1)) : null; })();
  const money = useMemo(() => new Intl.NumberFormat(document.locale, { style: 'currency', currency: currencies[document.locale], currencyDisplay: 'code' }), [document.locale]);
  const percent = useMemo(() => new Intl.NumberFormat(document.locale, { style: 'percent', maximumFractionDigits: 0 }), [document.locale]);
  const amount = (value: number) => money.format(value / 100); const rate = (value: number) => percent.format(value / 10_000);
  // Appendix A Part 3 (pattern 9): the same income as a Sankey, bracket by bracket, into tax and take-home.
  const sankey = taxSankey(model.slices, { income: t.income, tax: t.tax, takeHome: t.takeHome }, rate);
  const table = <table className="lf-learning-table" aria-label={t.board}><thead><tr><th scope="col" data-copy-role="data">{t.bracket}</th><th scope="col" data-copy-role="data">{t.taxable}</th><th scope="col" data-copy-role="data">{t.tax}</th></tr></thead><tbody>{model.slices.map((slice, index) => <tr key={index}><th scope="row" data-label={t.bracket} data-copy-role="data">{rate(slice.rateBasisPoints)}</th><td data-label={t.taxable} data-copy-role="data">{amount(slice.taxableMinor)}</td><td data-label={t.tax} data-copy-role="data">{hide ? '?' : amount(slice.taxMinor)}</td></tr>)}</tbody></table>;
  return <main className="lf-learning" data-surface="app" data-screen="tax-bracket"><div className="lf-learning-inner"><header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>{sequence ? <SegmentProgress sequence={sequence} locale={document.locale} finished={grading.met || !graded} /> : <span data-copy-role="body">{t.explore}</span>}</header><LessonStageSlot verdict={gradeStageVerdict(grading.result)} /><div className="lf-learning-content"><div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div><TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart} table={table} controlLeading={<Button onClick={() => setIncome(p.initialIncomeMinor)} disabled={income === p.initialIncomeMinor}>{t.reset}</Button>} chart={<><StackedSlicesVisual label={hide ? `${t.chart}. ${t.income}: ${amount(income)}.` : `${t.chart}. ${t.income}: ${amount(income)}. ${t.tax}: ${amount(model.totalTaxMinor)}. ${t.takeHome}: ${amount(model.takeHomeMinor)}. ${t.marginal}: ${rate(model.marginalRateBasisPoints)}. ${t.average}: ${rate(model.averageRateBasisPoints)}.`} slices={model.slices.map((slice, index) => ({ id: `bracket-${index}`, amount: slice.taxableMinor, keyText: rate(slice.rateBasisPoints) }))} />{hide || !sankey ? null : <TeachingChart kind="sankey" title={`${t.income}, ${t.tax}, ${t.takeHome}`} locale={document.locale} data={sankey} embedded />}{hide ? null : <div className="lf-tax-summary" role="status" aria-live="polite"><span data-copy-role="data">{t.tax}: {amount(model.totalTaxMinor)}</span><span data-copy-role="data">{t.takeHome}: {amount(model.takeHomeMinor)}</span><span data-copy-role="data">{t.marginal}: {rate(model.marginalRateBasisPoints)}</span><span data-copy-role="data">{t.average}: {rate(model.averageRateBasisPoints)}</span></div>}</>}>{() => <Slider label={t.income} valueText={amount(income)} min={p.minimumIncomeMinor} max={p.maximumIncomeMinor} step={p.incomeStepMinor} value={income} onValueChange={setIncome} />}</TeachingChartBoard>
    {graded ? <div className="lf-learning-control-strip"><NumberAnswer label={t.tax} locale={document.locale} onChange={setTyped} disabled={grading.pending || grading.met} />
      <SegmentedControl legend={t.marginal} name={`${segment.id}-marginal`} value={marginal} onValueChange={(value) => { grading.reset(); setMarginal(value); }}
        options={p.brackets.map((bracket) => ({ value: String(bracket.rateBasisPoints), label: rate(bracket.rateBasisPoints) }))} /></div> : null}
    {graded ? <GradedFoot locale={document.locale} grading={grading} canCheck={typedMinor !== null && marginal !== null} sequence={sequence}
      onCheck={() => grading.check({ incomeMinor: income, taxMinor: typedMinor, marginalBps: Number(marginal) })} />
      : sequence ? <footer className="lf-learning-foot"><div className="lf-learning-actions"><Button variant="accent" onClick={sequence.onAdvance}>{playerContinue(document.locale)}</Button></div></footer> : null}
    </div></div></main>;
}

/** The tax model as Sankey data (major units): income into each taxed slice, each slice into tax and take-home; null when there is nothing to draw. */
export function taxSankey(slices: ReadonlyArray<{ taxableMinor: number; taxMinor: number; rateBasisPoints: number }>, labels: { income: string; tax: string; takeHome: string },
  rate: (bps: number) => string): ChartData | null {
  const used = slices.map((slice, index) => ({ ...slice, id: `node-bracket-${index}` })).filter((slice) => slice.taxableMinor > 0);
  if (used.length === 0) return null;
  const links = used.flatMap((slice) => [
    { from: 'node-income', to: slice.id, value: slice.taxableMinor / 100 },
    ...(slice.taxMinor > 0 ? [{ from: slice.id, to: 'node-tax', value: slice.taxMinor / 100 }] : []),
    ...(slice.taxableMinor - slice.taxMinor > 0 ? [{ from: slice.id, to: 'node-keep', value: (slice.taxableMinor - slice.taxMinor) / 100 }] : []),
  ]);
  const ends = [...(links.some((l) => l.to === 'node-tax') ? [{ id: 'node-tax', label: labels.tax }] : []), ...(links.some((l) => l.to === 'node-keep') ? [{ id: 'node-keep', label: labels.takeHome }] : [])];
  return { unit: 'local', categories: [], series: [], nodes: [{ id: 'node-income', label: labels.income }, ...used.map((slice) => ({ id: slice.id, label: rate(slice.rateBasisPoints) })), ...ends], links };
}
