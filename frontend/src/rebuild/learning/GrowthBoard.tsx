import { useMemo, useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Button, Slider, ProgressBar } from '../design/controls';
import { growthTimeline, type GrowthItem } from './growthModel';
import { TeachingChartBoard } from './TeachingChartBoard';
import { SavingsLineVisual } from './pizarron';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import './learning.css';
import './growth.css';
import { LessonStageSlot } from './lessonStage';
import { SegmentPrompt } from './segmentKit';

type CopySet = {
  back: string; practice: string; board: string; showTable: string; showChart: string;
  titles: Record<AgeBand, string>; prompts: Record<AgeBand, string>;
  weekly: string; monthly: string; period: string; balance: string; after: string; reset: string;
  week: string; weeks: string; month: string; months: string; coin: string; coins: string;
  lineChart: string; horizontalScale: string; verticalScale: string;
  progress: string; continue: string;
};

const copy: Record<Locale, CopySet> = {
  'en-US': {
    back: 'Back', practice: 'Explore', board: 'Board', showTable: 'Show as table', showChart: 'Show chart',
    titles: { '6-9': 'Watch coins grow', '10-12': 'Build a savings plan', '13-17': 'Track your savings', adult: 'Project your savings' },
    prompts: { '6-9': 'Save coins each week. Move the amount.', '10-12': 'Change your weekly amount. What grows over six weeks?', '13-17': 'Adjust weekly savings and watch the total change.', adult: 'Adjust your monthly amount. Compare the year-end total.' },
    weekly: 'Each week', monthly: 'Each month', period: 'Period', balance: 'Saved', after: 'After', reset: 'Reset',
    week: 'week', weeks: 'weeks', month: 'month', months: 'months', coin: 'coin', coins: 'coins',
    lineChart: 'Line chart', horizontalScale: 'horizontal axis', verticalScale: 'vertical axis', progress: 'Lesson progress', continue: 'Continue',
  },
  'es-MX': {
    back: 'Volver', practice: 'Explorar', board: 'Pizarrón', showTable: 'Ver tabla', showChart: 'Ver gráfico',
    titles: { '6-9': 'Mira crecer tus monedas', '10-12': 'Crea un plan de ahorro', '13-17': 'Sigue tus ahorros', adult: 'Proyecta tus ahorros' },
    prompts: { '6-9': 'Guarda monedas cada semana. Cambia la cantidad.', '10-12': 'Cambia tu ahorro semanal. ¿Cuánto juntas en seis semanas?', '13-17': 'Ajusta tu ahorro semanal y observa cómo cambia el total.', adult: 'Ajusta tu ahorro mensual. Compara el total al final del año.' },
    weekly: 'Cada semana', monthly: 'Cada mes', period: 'Periodo', balance: 'Guardado', after: 'Después de', reset: 'Restablecer',
    week: 'semana', weeks: 'semanas', month: 'mes', months: 'meses', coin: 'moneda', coins: 'monedas',
    lineChart: 'Gráfica de líneas', horizontalScale: 'eje horizontal', verticalScale: 'eje vertical', progress: 'Progreso de lección', continue: 'Continuar',
  },
  'pt-BR': {
    back: 'Voltar', practice: 'Explorar', board: 'Quadro', showTable: 'Ver tabela', showChart: 'Ver gráfico',
    titles: { '6-9': 'Veja suas moedas crescerem', '10-12': 'Crie um plano de poupança', '13-17': 'Acompanhe sua poupança', adult: 'Projete sua poupança' },
    prompts: { '6-9': 'Guarde moedas toda semana. Mude o valor.', '10-12': 'Mude o valor semanal. Quanto terá em seis semanas?', '13-17': 'Ajuste o valor semanal e veja o total mudar.', adult: 'Ajuste o valor mensal. Compare o total no fim do ano.' },
    weekly: 'Por semana', monthly: 'Por mês', period: 'Período', balance: 'Guardado', after: 'Depois de', reset: 'Recomeçar',
    week: 'semana', weeks: 'semanas', month: 'mês', months: 'meses', coin: 'moeda', coins: 'moedas',
    lineChart: 'Gráfico de linhas', horizontalScale: 'eixo horizontal', verticalScale: 'eixo vertical', progress: 'Progresso da lição', continue: 'Continuar',
  },
};

type GrowthFixture = { item: GrowthItem; unit: 'week' | 'month'; currency: 'coins' | 'local' };
const fixtures: Record<AgeBand, GrowthFixture> = {
  '6-9': { item: { periods: 4, minimum: 1, maximum: 4, step: 1, initial: 2 }, unit: 'week', currency: 'coins' },
  '10-12': { item: { periods: 6, minimum: 5, maximum: 20, step: 5, initial: 10 }, unit: 'week', currency: 'coins' },
  '13-17': { item: { periods: 8, minimum: 25, maximum: 100, step: 25, initial: 50 }, unit: 'week', currency: 'coins' },
  adult: { item: { periods: 12, minimum: 100, maximum: 500, step: 100, initial: 200 }, unit: 'month', currency: 'local' },
};
const localCurrency: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };
type TimelineSegment = Extract<LessonClientSegment, { type: 'visual.savings-line.v2' }>;

/** Controlled authoring fixture for an exploratory visual, without answer data. */
export function growthPilotDocument(locale: Locale, ageBand: AgeBand): unknown {
  const fixture = fixtures[ageBand];
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `financial-${ageBand}`, chapter_id: 'saving-basics',
    lesson_id: `pilot-growth-${ageBand}`, version_id: 'rev-1', locale, age_band: ageBand, eligibility: ageEligibilityForBand(ageBand),
    knowledge_component_ids: ['kc-savings-growth'], adventure_scene_id: 'diorama-a', title: t.titles[ageBand],
    required_capabilities: ['visual.line.v1', 'operation.parameter-slider.v1'],
    segments: [{ id: 'growth-01', type: 'visual.savings-line.v2', prompt: t.prompts[ageBand], grading: 'none',
      visual: { type: 'line' }, payload: { ...fixture.item, unit: fixture.unit, currency: fixture.currency } }],
  };
}

export function GrowthBoard({ document, segment, onBack, sequence }: { document: LessonClientDocument; segment: TimelineSegment; onBack: () => void; sequence?: LessonSequenceControl }) {
  const locale = document.locale;
  const fixture = { item: segment.payload, unit: segment.payload.unit, currency: segment.payload.currency };
  const t = copy[locale];
  const [contribution, setContribution] = useState(fixture.item.initial);
  const points = growthTimeline(fixture.item, contribution) ?? [];
  const number = useMemo(() => new Intl.NumberFormat(locale, fixture.currency === 'local'
    ? { style: 'currency', currency: localCurrency[locale], currencyDisplay: 'code', maximumFractionDigits: 0 }
    : { maximumFractionDigits: 0 }), [locale, fixture.currency]);
  const amount = (value: number) => fixture.currency === 'coins' ? `${number.format(value)} ${value === 1 ? t.coin : t.coins}` : number.format(value);
  const unit = (count: number) => fixture.unit === 'week' ? count === 1 ? t.week : t.weeks : count === 1 ? t.month : t.months;
  const total = points.at(-1)?.balance ?? 0;
  const maximum = fixture.item.maximum * fixture.item.periods;

  return <main className="lf-learning" data-surface="app" data-screen="timeline">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        {sequence ? <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={sequenceProgress(sequence, contribution !== fixture.item.initial)} max={100} valueText={`${sequenceProgress(sequence, contribution !== fixture.item.initial)}%`} /> : null}<span data-copy-role={sequence ? 'data' : 'body'}>{sequence ? `${sequence.index + 1}/${sequence.total}` : t.practice}</span></header><LessonStageSlot />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart}
          controlLeading={<Button onClick={() => setContribution(fixture.item.initial)} disabled={contribution === fixture.item.initial}>{t.reset}</Button>}
          columns={[t.period, t.balance]} rows={points.map((point) => ({ id: point.period, label: point.period, value: amount(point.balance) }))}
          chart={<SavingsLineVisual label={`${t.lineChart}. ${t.horizontalScale}: 0–${fixture.item.periods} ${unit(fixture.item.periods)}. ${t.verticalScale}: 0–${amount(maximum)}. ${t.after} ${fixture.item.periods} ${unit(fixture.item.periods)}: ${amount(total)}.`}
            points={points.map((point) => ({ x: point.period, y: point.balance }))} xMax={fixture.item.periods} yMax={maximum}
            yMaxText={amount(maximum)} startText="0" endText={`${fixture.item.periods} ${unit(fixture.item.periods)}`} />}>
          {() => <Slider className="lf-growth-control" label={fixture.unit === 'week' ? t.weekly : t.monthly}
            valueText={amount(contribution)} min={fixture.item.minimum} max={fixture.item.maximum} step={fixture.item.step}
            value={contribution} onValueChange={setContribution} />}
        </TeachingChartBoard>
        <footer className="lf-growth-foot">
          <div className="lf-growth-outcome" role="status" aria-live="polite"><span data-copy-role="body">{t.after} {fixture.item.periods} {unit(fixture.item.periods)}</span><strong data-copy-role="data">{amount(total)}</strong></div>
          {sequence ? <Button variant="accent" disabled={contribution === fixture.item.initial} onClick={sequence.onAdvance}>{t.continue}</Button> : null}
        </footer>
      </div>
    </div>
  </main>;
}
