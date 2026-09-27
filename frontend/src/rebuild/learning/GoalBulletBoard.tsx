import { useMemo, useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Button, Slider, ProgressBar } from '../design/controls';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { TeachingChartBoard } from './TeachingChartBoard';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import './learning.css';
import './goalBullet.css';
import { LessonStageSlot } from './lessonStage';

type GoalBulletSegment = Extract<LessonClientSegment, { type: 'visual.goal-bullet.v2' }>;
type Labels = { back: string; explore: string; progress: string; board: string; showTable: string; showChart: string; reset: string; category: string; value: string;
  saved: string; target: string; remaining: string; reached: string; amount: string; bullet: string; scale: string; coin: string; coins: string;
  less: string; more: string; continue: string };
const copy: Record<Locale, Labels> = {
  'en-US': { back: 'Back', explore: 'Explore', progress: 'Lesson progress', board: 'Board', showTable: 'Show as table', showChart: 'Show chart',
    reset: 'Reset', category: 'Measure', value: 'Amount', saved: 'Saved', target: 'Goal', remaining: 'To go', reached: 'Goal met', amount: 'Change savings', bullet: 'Goal chart',
    scale: 'scale from zero to', coin: 'coin', coins: 'coins', less: 'Save less', more: 'Save more', continue: 'Continue' },
  'es-MX': { back: 'Volver', explore: 'Explorar', progress: 'Progreso de lección', board: 'Pizarrón', showTable: 'Ver tabla', showChart: 'Ver gráfico',
    reset: 'Restablecer', category: 'Medida', value: 'Cantidad', saved: 'Guardado', target: 'Meta', remaining: 'Faltan', reached: 'Meta alcanzada', amount: 'Cambia el ahorro', bullet: 'Gráfica de meta',
    scale: 'escala de cero a', coin: 'moneda', coins: 'monedas', less: 'Guardar menos', more: 'Guardar más', continue: 'Continuar' },
  'pt-BR': { back: 'Voltar', explore: 'Explorar', progress: 'Progresso da lição', board: 'Quadro', showTable: 'Ver tabela', showChart: 'Ver gráfico',
    reset: 'Recomeçar', category: 'Medida', value: 'Valor', saved: 'Guardado', target: 'Meta', remaining: 'Faltam', reached: 'Meta alcançada', amount: 'Mude a poupança', bullet: 'Gráfico de meta',
    scale: 'escala de zero até', coin: 'moeda', coins: 'moedas', less: 'Guardar menos', more: 'Guardar mais', continue: 'Continuar' },
};
const localCurrency: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };
const fixtures: Record<AgeBand, { maximum: number; target: number; step: number; initial: number; currency: 'coins' | 'local' }> = {
  '6-9': { maximum: 20, target: 12, step: 2, initial: 4, currency: 'coins' },
  '10-12': { maximum: 100, target: 60, step: 10, initial: 20, currency: 'coins' },
  '13-17': { maximum: 500, target: 300, step: 25, initial: 100, currency: 'coins' },
  adult: { maximum: 5000, target: 3000, step: 250, initial: 1000, currency: 'local' },
};

/** Controlled bullet-chart fixture. Its target is visible teaching data, not a hidden answer. */
export function goalBulletPilotDocument(locale: Locale, ageBand: AgeBand): unknown {
  const titles: Record<Locale, string> = { 'en-US': 'Reach a savings goal', 'es-MX': 'Alcanza una meta', 'pt-BR': 'Alcance uma meta' };
  const prompts: Record<Locale, string> = { 'en-US': 'Move your savings toward the goal.', 'es-MX': 'Acerca tus ahorros a la meta.',
    'pt-BR': 'Aproxime suas economias da meta.' };
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `financial-${ageBand}`, chapter_id: 'savings-goals',
    lesson_id: `pilot-goal-bullet-${ageBand}`, version_id: 'rev-1', locale, age_band: ageBand, eligibility: ageEligibilityForBand(ageBand),
    knowledge_component_ids: ['kc-savings-goals'], adventure_scene_id: 'diorama-a', title: titles[locale],
    required_capabilities: ['visual.bullet.v1', 'operation.parameter-slider.v1'],
    segments: [{ id: 'goal-01', type: 'visual.goal-bullet.v2', prompt: prompts[locale], grading: 'none', visual: { type: 'bullet' },
      payload: { minimum: 0, ...fixtures[ageBand] } }],
  };
}

export function GoalBulletBoard({ document, segment, onBack, sequence }: {
  document: LessonClientDocument; segment: GoalBulletSegment; onBack: () => void; sequence?: LessonSequenceControl;
}) {
  const t = copy[document.locale];
  const { minimum, maximum, target, step, initial, currency } = segment.payload;
  const [saved, setSaved] = useState(initial);
  const formatter = useMemo(() => new Intl.NumberFormat(document.locale, currency === 'local'
    ? { style: 'currency', currency: localCurrency[document.locale], currencyDisplay: 'code', maximumFractionDigits: 0 }
    : { maximumFractionDigits: 0 }), [document.locale, currency]);
  const amount = (n: number) => currency === 'coins' ? `${formatter.format(n)} ${n === 1 ? t.coin : t.coins}` : formatter.format(n);
  const left = Math.max(0, target - saved);
  const progress = 100 * (saved - minimum) / (maximum - minimum);
  const goal = 100 * (target - minimum) / (maximum - minimum);
  const setAmount = (value: number) => { if (Number.isSafeInteger(value) && value >= minimum && value <= maximum && (value - minimum) % step === 0) setSaved(value); };

  return <main className="lf-learning" data-surface="app" data-screen="goal">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        {sequence ? <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={sequenceProgress(sequence, saved !== initial)} max={100} valueText={`${sequenceProgress(sequence, saved !== initial)}%`} /> : null}
        <span data-copy-role={sequence ? 'data' : 'body'}>{sequence ? `${sequence.index + 1}/${sequence.total}` : t.explore}</span></header><LessonStageSlot />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><p data-copy-role="prompt">{segment.prompt}</p></div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart} columns={[t.category, t.value]}
          controlLeading={<Button onClick={() => setSaved(initial)} disabled={saved === initial}>{t.reset}</Button>}
          rows={[{ id: 'saved', label: t.saved, value: amount(saved) }, { id: 'target', label: t.target, value: amount(target) },
            { id: 'remaining', label: t.remaining, value: amount(left) }]}
          chart={<>
            <div className="lf-goal-visual" role="img" aria-label={`${t.bullet}, ${t.scale} ${amount(maximum)}. ${t.saved}: ${amount(saved)}. ${t.target}: ${amount(target)}. ${t.remaining}: ${amount(left)}.`}>
              <svg viewBox="0 0 300 84" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <rect x="0" y="24" width="300" height="36" rx="12" className="lf-goal-track" />
                <rect x="0" y="24" width={300 * goal / 100} height="36" rx="12" className="lf-goal-band" />
                <rect x="0" y="30" width={300 * progress / 100} height="24" rx="8" className="lf-goal-fill" />
                <line x1={300 * goal / 100} x2={300 * goal / 100} y1="14" y2="70" className="lf-goal-target" />
              </svg>
            </div>
            <div className="lf-goal-axis"><span data-copy-role="data">{amount(minimum)}</span><span data-copy-role="data">{amount(maximum)}</span></div>
            <div className="lf-goal-legend" data-copy-role="data">{t.target}: {amount(target)}</div>
          </>}>
          {() => <Slider label={t.amount} valueText={amount(saved)} min={minimum}
            max={maximum} step={step} value={saved} onValueChange={setAmount}
            stepLabels={{ decrease: t.less, increase: t.more }} />}
        </TeachingChartBoard>
        <footer className="lf-goal-foot"><div role="status" className="lf-goal-outcome">
          <span data-copy-role="body">{left === 0 ? t.reached : t.remaining}</span><strong data-copy-role="data">{left === 0 ? amount(saved) : amount(left)}</strong>
        </div>{sequence ? <Button variant="accent" disabled={saved === initial} onClick={sequence.onAdvance}>{t.continue}</Button> : null}</footer>
      </div>
    </div>
  </main>;
}
