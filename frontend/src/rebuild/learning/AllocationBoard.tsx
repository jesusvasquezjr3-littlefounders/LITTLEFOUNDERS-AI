import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Button, Slider, ProgressBar } from '../design/controls';
import { PocketSplit } from '../family/PocketSplit';
import { LessonFeedback } from './LessonFeedback';
import { changeAllocation, inspectAllocation, reallocateBoundary, remaining, type Allocation, type Pocket } from './allocationModel';
import { decodeAllocationCheckpoint, encodeAllocationCheckpoint } from './allocationCheckpoint';
import { learningFixtures } from './allocationFixtures';
import { ageEligibilityForBand, lessonVersionKey, type LessonClientDocument, type LessonClientSegment, type LessonMentorStage } from './lessonDocument';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import { TeachingChartBoard } from './TeachingChartBoard';
import { AllocationDonutVisual, AllocationStackVisual, AllocationWaffleVisual } from './pizarron';
import { CompactMentorStage } from './CompactMentorStage';
import { LessonStageSlot, useLessonStagePresent } from './lessonStage';
import { SegmentPrompt } from './segmentKit';
import './learning.css';

type CopySet = {
  back: string; title: Record<'young' | 'tween' | 'teen' | 'adult', string>; lesson: string; progress: string; question: Record<'young' | 'tween' | 'teen' | 'adult', string>;
  board: string; balance: string; save: string; spend: string; share: string; left: string;
  add: string; remove: string; reset: string; check: string; checking: string; again: string; continue: string;
  invalid: string; incomplete: string; review: string; met: string; unavailable: string; coin: string; coinSingular: string;
  showTable: string; showChart: string; category: string; amount: string; stackedBar: string; scaleFromZero: string;
  moveSaveSpend: string; moveSpendShare: string;
  waffleQuestion: string; waffle: string; waffleKey: string;
  donut: string; donutQuestion: string;
};

const copy: Record<Locale, CopySet> = {
  'en-US': {
    back: 'Back', title: { young: 'Split your money', tween: 'Make a money plan', teen: 'Set your allocation', adult: 'Plan your budget' }, lesson: 'Practice', progress: 'Lesson progress',
    question: {
      young: 'Split 12 coins. Save at least 4.',
      tween: 'You have 60 coins and must save at least 20. How will you split them?',
      teen: 'You have 300 coins and must save at least 100. What is your plan?',
      adult: 'Set aside at least USD 400 of your USD 1,200. How will you allocate it?',
    },
    board: 'Board', balance: 'Your split', save: 'Save', spend: 'Spend', share: 'Share', left: 'Left',
    add: 'Add', remove: 'Remove', reset: 'Reset', check: 'Check', checking: 'Checking…', again: 'Try again', continue: 'Continue',
    invalid: 'Review this plan.', incomplete: 'Allocate the rest first.', review: 'Try saving a little more.', met: 'Your plan meets the goal.', unavailable: 'Could not check. Try again.', coin: 'coins', coinSingular: 'coin',
    showTable: 'Show as table', showChart: 'Show chart', category: 'Category', amount: 'Amount',
    stackedBar: 'Stacked bar', scaleFromZero: 'scale from zero to',
    moveSaveSpend: 'Move between Save and Spend', moveSpendShare: 'Move between Spend and Share',
    waffleQuestion: 'Split 10 coins. Save at least 3.', waffle: 'Waffle chart', waffleKey: '1 row = 1 coin',
    donut: 'Budget donut chart', donutQuestion: 'Split 60 coins. Save 20 or more.',
  },
  'es-MX': {
    back: 'Volver', title: { young: 'Divide tu dinero', tween: 'Planea tu dinero', teen: 'Define tu reparto', adult: 'Planea tu presupuesto' }, lesson: 'Práctica', progress: 'Progreso de lección',
    question: {
      young: 'Tienes 12 monedas y debes guardar al menos 4. ¿Dónde irán?',
      tween: 'Tienes 60 monedas y debes guardar al menos 20. ¿Cómo las repartirás?',
      teen: 'Tienes 300 monedas y debes guardar al menos 100. ¿Cuál es tu plan?',
      adult: 'Reserva al menos 400 MXN de tus 1,200 MXN. ¿Cómo los distribuirás?',
    },
    board: 'Pizarrón', balance: 'Tu reparto', save: 'Guardar', spend: 'Gastar', share: 'Compartir', left: 'Restan',
    add: 'Añadir', remove: 'Quitar', reset: 'Restablecer', check: 'Comprobar', checking: 'Comprobando…', again: 'Reintentar', continue: 'Continuar',
    invalid: 'Revisa este plan.', incomplete: 'Reparte el resto primero.', review: 'Prueba guardar un poco más.', met: 'Tu plan cumple la meta.', unavailable: 'No se pudo comprobar. Reintenta.', coin: 'monedas', coinSingular: 'moneda',
    showTable: 'Ver tabla', showChart: 'Ver gráfico', category: 'Categoría', amount: 'Cantidad',
    stackedBar: 'Barra apilada', scaleFromZero: 'escala de cero a',
    moveSaveSpend: 'Mover entre Guardar y Gastar', moveSpendShare: 'Mover entre Gastar y Compartir',
    waffleQuestion: 'Reparte 10 monedas. Guarda al menos 3.', waffle: 'Cuadrícula de 100', waffleKey: '1 fila = 1 moneda',
    donut: 'Gráfico de anillo', donutQuestion: 'Reparte 60 monedas. Guarda 20 o más.',
  },
  'pt-BR': {
    back: 'Voltar', title: { young: 'Divida seu dinheiro', tween: 'Planeje seu dinheiro', teen: 'Defina sua divisão', adult: 'Planeje seu orçamento' }, lesson: 'Prática', progress: 'Progresso da lição',
    question: {
      young: 'Você tem 12 moedas e precisa guardar pelo menos 4. Para onde elas vão?',
      tween: 'Você tem 60 moedas e precisa guardar pelo menos 20. Como vai dividi-las?',
      teen: 'Você tem 300 moedas e precisa guardar pelo menos 100. Qual é seu plano?',
      adult: 'Reserve pelo menos BRL 400 dos seus BRL 1.200. Como vai distribuir?',
    },
    board: 'Quadro', balance: 'Sua divisão', save: 'Guardar', spend: 'Gastar', share: 'Compartilhar', left: 'Restam',
    add: 'Adicionar', remove: 'Retirar', reset: 'Recomeçar', check: 'Conferir', checking: 'Conferindo…', again: 'Tentar de novo', continue: 'Continuar',
    invalid: 'Revise este plano.', incomplete: 'Distribua o restante primeiro.', review: 'Tente guardar um pouco mais.', met: 'Seu plano alcança a meta.', unavailable: 'Não foi possível conferir. Tente de novo.', coin: 'moedas', coinSingular: 'moeda',
    showTable: 'Ver tabela', showChart: 'Ver gráfico', category: 'Categoria', amount: 'Valor',
    stackedBar: 'Barra empilhada', scaleFromZero: 'escala de zero até',
    moveSaveSpend: 'Mover entre Guardar e Gastar', moveSpendShare: 'Mover entre Gastar e Compartilhar',
    waffleQuestion: 'Divida 10 moedas. Guarde pelo menos 3.', waffle: 'Grade de 100', waffleKey: '1 linha = 1 moeda',
    donut: 'Gráfico de rosca', donutQuestion: 'Divida 60 moedas. Guarde 20 ou mais.',
  },
};

const pockets: Pocket[] = ['save', 'spend', 'share'];
const empty: Allocation = { save: 0, spend: 0, share: 0 };
const localCurrency: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };
type AllocationSegment = Extract<LessonClientSegment, { type: 'money.allocation.v2' }>;
type CheckResult = 'invalid' | 'incomplete' | 'review' | 'met';

/** A client-safe authored fixture; the scoring rule remains outside this document. */
export function allocationPilotDocument(locale: Locale, ageBand: AgeBand): unknown {
  const fixture = learningFixtures[ageBand];
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `financial-${ageBand}`, chapter_id: 'money-plans',
    lesson_id: fixture.id, version_id: `rev-${fixture.contentVersion}`, locale, age_band: ageBand, eligibility: ageEligibilityForBand(ageBand),
    knowledge_component_ids: ['kc-saving-allocation'], adventure_scene_id: 'diorama-a', title: t.title[fixture.titleKey],
    required_capabilities: ['visual.stacked-bar.v1', 'operation.reallocate.v1'],
    segments: [{ id: 'allocate-01', type: 'money.allocation.v2', prompt: t.question[fixture.titleKey], grading: 'server',
      visual: { type: 'stacked-bar' }, payload: { total: fixture.item.total, step: fixture.item.step, currency: fixture.currency } }],
  };
}

/** One controlled ten-coin waffle fixture; the scorer remains the allocation scorer. */
export function wafflePilotDocument(locale: Locale): unknown {
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-6-9',
    chapter_id: 'money-plans', lesson_id: 'pilot-waffle', version_id: 'rev-1', locale, age_band: '6-9', eligibility: ageEligibilityForBand('6-9'),
    knowledge_component_ids: ['kc-saving-allocation'], adventure_scene_id: 'diorama-a', title: t.title.young,
    required_capabilities: ['visual.waffle.v1', 'operation.reallocate.v1'],
    segments: [{ id: 'allocate-waffle-01', type: 'money.allocation.v2', prompt: t.waffleQuestion,
      grading: 'server', visual: { type: 'waffle' }, payload: { total: 10, step: 1, currency: 'coins' } }],
  };
}

/** A composition view of the same allocation response for the 10–12 pathway. */
export function donutPilotDocument(locale: Locale): unknown {
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12',
    chapter_id: 'money-plans', lesson_id: 'pilot-donut', version_id: 'rev-1', locale, age_band: '10-12', eligibility: ageEligibilityForBand('10-12'),
    knowledge_component_ids: ['kc-saving-allocation'], adventure_scene_id: 'diorama-a', title: t.title.tween,
    required_capabilities: ['visual.donut.v1', 'operation.reallocate.v1'],
    segments: [{ id: 'allocate-donut-01', type: 'money.allocation.v2', prompt: t.donutQuestion,
      grading: 'server', visual: { type: 'donut' }, payload: { total: 60, step: 5, currency: 'coins' } }],
  };
}

export function AllocationBoard({ document, segment, onBack, onCheck, mentorStage = null, theme = 'light', sequence }: {
  document: LessonClientDocument; segment: AllocationSegment; onBack: () => void;
  onCheck: (answer: Allocation, segmentId: string, versionKey: string) => CheckResult | Promise<CheckResult>;
  mentorStage?: LessonMentorStage | null; theme?: 'light' | 'dark'; sequence?: LessonSequenceControl;
}) {
  const locale = document.locale;
  const ageBand = document.age_band;
  const item = useMemo(() => ({ total: segment.payload.total, step: segment.payload.step, minimumSave: 0 }), [segment.payload.total, segment.payload.step]);
  const storageKey = `lf:allocation:${lessonVersionKey(document)}`;
  const [allocation, setAllocation] = useState<Allocation>(() => {
    try { return decodeAllocationCheckpoint(window.sessionStorage.getItem(storageKey), document.lesson_id, document.version_id, item) ?? empty; }
    catch { return empty; }
  });
  const [tableMode, setTableMode] = useState(false);
  const [verdict, setVerdict] = useState<CheckResult | 'unavailable' | null>(null);
  const stagePresent = useLessonStagePresent();
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    try { window.sessionStorage.setItem(storageKey, encodeAllocationCheckpoint(document.lesson_id, document.version_id, allocation)); }
    catch { return; }
  }, [allocation, document.lesson_id, document.version_id, storageKey]);
  useEffect(() => () => { requestId.current++; }, []);
  const t = copy[locale];
  const left = remaining(item, allocation);
  const pocketAmounts = pockets.map((pocket) => ({ id: pocket, amount: allocation[pocket] }));
  const formatter = useMemo(() => new Intl.NumberFormat(locale, segment.payload.currency === 'local'
    ? { style: 'currency', currency: localCurrency[locale], currencyDisplay: 'code', maximumFractionDigits: 0 }
    : { maximumFractionDigits: 0 }), [locale, segment.payload.currency]);
  const amount = (n: number) => segment.payload.currency === 'coins' ? `${formatter.format(n)} ${n === 1 ? t.coinSingular : t.coin}` : formatter.format(n);
  const invalidate = () => { requestId.current++; setPending(false); setVerdict(null); };
  const reset = () => { invalidate(); setAllocation(empty); };
  const change = (pocket: Pocket, direction: -1 | 1) => {
    setAllocation((current) => changeAllocation(item, current, pocket, direction));
    invalidate();
  };
  const reallocate = (boundary: 'save-spend' | 'spend-share', cumulative: number) => {
    setAllocation((current) => reallocateBoundary(item, current, boundary, cumulative));
    invalidate();
  };
  const check = () => {
    if (verdict === 'met') { if (sequence) sequence.onAdvance(); else reset(); return; }
    const local = inspectAllocation(item, allocation);
    if (local === 'invalid' || local === 'incomplete') { setVerdict(local); return; }
    const currentRequest = ++requestId.current;
    setPending(true);
    try {
      Promise.resolve(onCheck(allocation, segment.id, lessonVersionKey(document))).then((result) => {
        if (requestId.current !== currentRequest) return;
        setVerdict(['invalid', 'incomplete', 'review', 'met'].includes(result) ? result : 'unavailable');
      }).catch(() => { if (requestId.current === currentRequest) setVerdict('unavailable'); })
        .finally(() => { if (requestId.current === currentRequest) setPending(false); });
    } catch { if (requestId.current === currentRequest) { setPending(false); setVerdict('unavailable'); } }
  };

  return <main className={`lf-learning${mentorStage || stagePresent ? ' lf-learning--with-stage' : ''}${tableMode ? ' lf-learning--table' : ''}`}
    data-surface="app" data-screen="lesson">
    <div className="lf-learning-inner">
      <header className="lf-learning-top">
        <Button onClick={onBack}>{t.back}</Button>
        <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={sequenceProgress(sequence, verdict === 'met')} max={100} valueText={`${sequenceProgress(sequence, verdict === 'met')}%`} />
        <span data-copy-role="data">{sequence ? `${sequence.index + 1}/${sequence.total}` : t.lesson}</span>
      </header>
      {/* Inside a lesson the one slot draws the band (with the adventure scene as its backdrop); a standalone board keeps its own. */}
      {stagePresent ? <LessonStageSlot verdict={verdict === 'unavailable' ? null : verdict} />
        : mentorStage ? <CompactMentorStage ageBand={ageBand} theme={theme} verdict={verdict === 'unavailable' ? null : verdict} character={mentorStage.character} scene={mentorStage.scene} /> : null}
      <div className="lf-learning-content">
        <div className="lf-learning-intro">
          <h1 data-copy-role="heading">{document.title}</h1>
          <SegmentPrompt segment={segment} locale={document.locale} />
        </div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart} onViewChange={setTableMode}
          columns={[t.category, t.amount]}
          controlLeading={<Button onClick={reset} disabled={allocation.save + allocation.spend + allocation.share === 0}>{t.reset}</Button>}
          rows={[...pockets.map((pocket) => ({ id: pocket, label: t[pocket], value: amount(allocation[pocket]) })), { id: 'left', label: t.left, value: amount(left) }]}
          chart={<>
            {segment.visual.type === 'waffle' ? <AllocationWaffleVisual
              label={`${t.waffle}. ${t.waffleKey}. ${t.balance}: ${pockets.map((pocket) => `${t[pocket]} ${amount(allocation[pocket])}`).join(', ')}, ${t.left} ${amount(left)}`}
              pockets={pocketAmounts} keyText={t.waffleKey} />
              : segment.visual.type === 'donut' ? <AllocationDonutVisual
                label={`${t.donut}. ${t.balance}: ${pockets.map((pocket) => `${t[pocket]} ${amount(allocation[pocket])}`).join(', ')}, ${t.left} ${amount(left)}.`}
                pockets={pocketAmounts} total={item.total} totalText={amount(item.total)} />
                : <AllocationStackVisual
                  label={`${t.stackedBar}, ${t.scaleFromZero} ${amount(item.total)}. ${t.balance}: ${pockets.map((pocket) => `${t[pocket]} ${amount(allocation[pocket])}`).join(', ')}, ${t.left} ${amount(left)}`}
                  pockets={pocketAmounts} total={item.total} />}
            <div className={`lf-learning-legend${segment.visual.type === 'donut' ? ' lf-learning-legend--donut' : ''}`}
              aria-hidden={segment.visual.type === 'donut' ? undefined : true}>
              {pockets.map((pocket) => <span key={pocket} className={`lf-learning-legend-${pocket}`} data-copy-role="data">
                {t[pocket]}{segment.visual.type === 'donut' ? ` ${amount(allocation[pocket])}` : ''}</span>)}
            </div>
          </>}>
          {(showTable) => <>
          <div className={showTable ? 'lf-learning-left lf-learning-left--visually-hidden' : 'lf-learning-left'} aria-live="polite" aria-atomic="true"><span data-copy-role="body">{t.left}</span> <strong data-copy-role="data">{amount(left)}</strong></div>
          {/* Bible 05 §7 Money row (GAP-FIX-R1): the Wallet's own pocket rows, so the lesson and the Wallet teach one interaction. */}
          <div className="lf-learning-controls" role="group" aria-label={t.balance}>
            <PocketSplit mode="stepper" bar={false} labels={{ save: t.save, spend: t.spend, share: t.share }} values={allocation} step={item.step}
              max={(pocket) => allocation[pocket] + left} valueText={(_, value) => amount(value)} stepLabels={() => ({ decrease: t.remove, increase: t.add })}
              onChange={(pocket, next) => change(pocket, next > allocation[pocket] ? 1 : -1)} />
          </div>
          {left === 0 && !showTable ? <div className="lf-learning-sliders" role="group" aria-label={t.balance}>
            <Slider label={t.moveSaveSpend} valueText={amount(allocation.save)} min={0} max={allocation.save + allocation.spend} step={item.step}
              value={allocation.save} disabled={allocation.save + allocation.spend === 0} onValueChange={(next) => reallocate('save-spend', next)} />
            <Slider label={t.moveSpendShare} valueText={amount(allocation.spend)} min={allocation.save} max={item.total} step={item.step}
              value={allocation.save + allocation.spend} disabled={allocation.spend + allocation.share === 0} onValueChange={(next) => reallocate('spend-share', next)} />
          </div> : null}
          </>}
        </TeachingChartBoard>
        <footer className="lf-learning-foot">
          <LessonFeedback verdict={verdict}>{verdict ? t[verdict] : null}</LessonFeedback>
          <div className="lf-learning-actions">
            <Button variant="accent" disabled={pending} onClick={check}>{pending ? t.checking : verdict === 'met' ? sequence ? t.continue : t.again : t.check}</Button>
          </div>
        </footer>
      </div>
    </div>
  </main>;
}
