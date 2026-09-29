import { useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, ProgressBar } from '../design/controls';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { placeValueReplay, placeValueStart, type PlaceTrade } from './placeValueModel';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import { TeachingChartBoard } from './TeachingChartBoard';
import { BaseTenVisual } from './pizarron';
import { StepReplay } from './StepReplay';
import './learning.css';
import './placeValue.css';
import './stepReplay.css';
import { LessonStageSlot } from './lessonStage';
import { GradedFoot, NumberAnswer, SegmentPrompt, useSegmentGrade, type OnGradeSegment, gradeStageVerdict } from './segmentKit';
import { namedFeedback } from './namedFeedback';


type PlaceValueSegment = Extract<LessonClientSegment, { type: 'math.place-value.v2' }>;
type Labels = { reset: string; back: string; explore: string; progress: string; board: string; showTable: string; showChart: string;
  tens: string; ones: string; total: string; pieces: string; count: string; trade: string; undo: string;
  continue: string; title: string; prompt: string; equivalent: string; replay: string; edit: string;
  previous: string; next: string; play: string; pause: string; step: string;
  hundreds: string; tradeHundred: string; borrowTen: string; borrowHundred: string; take: string; result: string; tenTens: string };
const copy: Record<Locale, Labels> = {
  'en-US': { reset: 'Reset', back: 'Back', explore: 'Explore', progress: 'Lesson progress', board: 'Place value', showTable: 'Show as table',
    showChart: 'Show blocks', tens: 'Tens', ones: 'Ones', total: 'Total', pieces: 'Pieces', count: 'Count', trade: 'Trade 10',
    undo: 'Undo trade', continue: 'Continue', title: 'Trade ten ones', prompt: 'Trade 10 ones for 1 ten. What changed?',
    equivalent: '10 ones = 1 ten', replay: 'Replay trades', edit: 'Edit trades', previous: 'Previous',
    next: 'Next', play: 'Play', pause: 'Pause', step: 'Trades',
    hundreds: 'Hundreds', tradeHundred: 'Trade 10 tens', borrowTen: 'Break a ten', borrowHundred: 'Break a hundred',
    take: 'Take away', result: 'Result', tenTens: '10 tens = 1 hundred' },
  'es-MX': { reset: 'Restablecer', back: 'Volver', explore: 'Explorar', progress: 'Progreso de lección', board: 'Valor posicional',
    showTable: 'Ver tabla', showChart: 'Ver bloques', tens: 'Decenas', ones: 'Unidades', total: 'Total',
    pieces: 'Piezas', count: 'Cantidad', trade: 'Cambia 10', undo: 'Deshacer', continue: 'Continuar',
    title: 'Cambia diez unidades', prompt: 'Cambia 10 unidades por 1 decena. ¿Qué cambió?', equivalent: '10 unidades = 1 decena',
    replay: 'Repetir cambios', edit: 'Editar cambios', previous: 'Anterior', next: 'Siguiente',
    play: 'Reproducir', pause: 'Pausar', step: 'Cambios',
    hundreds: 'Centenas', tradeHundred: 'Cambia 10 decenas', borrowTen: 'Desarma una decena', borrowHundred: 'Desarma una centena',
    take: 'Quita', result: 'Resultado', tenTens: '10 decenas = 1 centena' },
  'pt-BR': { reset: 'Recomeçar', back: 'Voltar', explore: 'Explorar', progress: 'Progresso da lição', board: 'Valor posicional',
    showTable: 'Ver tabela', showChart: 'Ver blocos', tens: 'Dezenas', ones: 'Unidades', total: 'Total',
    pieces: 'Peças', count: 'Quantidade', trade: 'Trocar 10', undo: 'Desfazer', continue: 'Continuar',
    title: 'Troque dez unidades', prompt: 'Troque 10 unidades por 1 dezena. O que mudou?', equivalent: '10 unidades = 1 dezena',
    replay: 'Rever trocas', edit: 'Editar trocas', previous: 'Anterior', next: 'Próximo',
    play: 'Reproduzir', pause: 'Pausar', step: 'Trocas',
    hundreds: 'Centenas', tradeHundred: 'Trocar 10 dezenas', borrowTen: 'Desfazer uma dezena', borrowHundred: 'Desfazer uma centena',
    take: 'Tire', result: 'Resultado', tenTens: '10 dezenas = 1 centena' },
};

/** Answerless format candidate for M5. Only the 6–9 pilot pathway enables it. */
export function placeValuePilotDocument(locale: Locale): unknown {
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-6-9', chapter_id: 'counting-coins',
    lesson_id: 'pilot-place-value', version_id: 'rev-1', locale, age_band: '6-9', eligibility: ageEligibilityForBand('6-9'),
    knowledge_component_ids: ['kc-place-value'], adventure_scene_id: 'diorama-a', title: t.title,
    required_capabilities: ['visual.base-ten.v1', 'operation.trade-ten.v1', 'operation.linked-representations.v1',
      'operation.step-replay.v1'],
    segments: [{ id: 'place-value-01', type: 'math.place-value.v2', prompt: t.prompt, grading: 'none',
      visual: { type: 'base-ten' }, payload: { total: 20 } }],
  };
}

export function PlaceValueBoard({ document, segment, onBack, sequence, onGrade }: {
  document: LessonClientDocument; segment: PlaceValueSegment; onBack: () => void; sequence?: LessonSequenceControl; onGrade?: OnGradeSegment;
}) {
  const t = copy[document.locale];
  const grading = useSegmentGrade(segment.id, onGrade);
  const graded = segment.grading === 'server' && !!onGrade;
  const [tensTyped, setTensTyped] = useState<string | null>(null);
  const [onesTyped, setOnesTyped] = useState<string | null>(null);
  const [hundredsTyped, setHundredsTyped] = useState<string | null>(null);
  const [trades, setTrades] = useState<PlaceTrade[]>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const shown = replayIndex === null ? trades : trades.slice(0, replayIndex);
  const state = placeValueReplay(segment.payload, shown);
  if (!state) return null;
  const { start } = placeValueStart(segment.payload);
  // Three columns whenever hundreds can appear (Bible 05 §7 flats); the 10-29 pilot keeps two.
  const threePlaces = state.mode === 'subtract' || start.hundreds > 0 || start.tens >= 10 || start.ones + start.tens * 10 >= 100;
  const total = state.hundreds * 100 + state.tens * 10 + state.ones;
  const push = (trade: PlaceTrade) => { grading.reset(); setTrades((value) => [...value, trade]); };
  const offered: PlaceTrade[] = state.mode === 'compose' ? (threePlaces ? ['ten', 'hundred'] : ['ten']) : ['borrow-ten', 'borrow-hundred'];
  const tradeLabel: Record<PlaceTrade, string> = { ten: t.trade, hundred: t.tradeHundred, 'borrow-ten': t.borrowTen, 'borrow-hundred': t.borrowHundred };
  const takeAmount = state.take.hundreds * 100 + state.take.tens * 10 + state.take.ones;
  const takeText = state.mode === 'subtract' ? `${t.take}: ${takeAmount}` : null;
  const last = shown.at(-1);
  const progress = sequenceProgress(sequence, trades.length > 0);
  return <main className="lf-learning" data-surface="app" data-screen="place-value">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        {sequence ? <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={progress} max={100} valueText={`${progress}%`} /> : null}
        <span data-copy-role={sequence ? 'data' : 'body'}>{sequence ? `${sequence.index + 1}/${sequence.total}` : t.explore}</span></header><LessonStageSlot verdict={gradeStageVerdict(grading.result)} />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1>
          <SegmentPrompt segment={segment} locale={document.locale} /></div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart}
          columns={[t.pieces, t.count]} rows={[
            ...(threePlaces ? [{ id: 'hundreds', label: t.hundreds, value: String(state.hundreds) }] : []),
            { id: 'tens', label: t.tens, value: String(state.tens) },
            { id: 'ones', label: t.ones, value: String(state.ones) },
            { id: 'total', label: t.total, value: String(total) },
            ...(takeText ? [{ id: 'take', label: t.take, value: String(takeAmount) }] : []),
          ]} chart={<BaseTenVisual label={`${threePlaces ? `${state.hundreds} ${t.hundreds}, ` : ''}${state.tens} ${t.tens}, ${state.ones} ${t.ones}. ${t.total}: ${total}.${takeText ? ` ${takeText}.` : ''}`}
            hundreds={state.hundreds} tens={state.tens} ones={state.ones} {...(threePlaces ? { hundredsText: `${t.hundreds}: ${state.hundreds}` } : {})}
            tensText={`${t.tens}: ${state.tens}`} onesText={`${t.ones}: ${state.ones}`} />}>
          {() => replayIndex === null ? <div className="lf-place-value-controls">
            {/* Bible 05 §3: Reset restores the authored start (no trades), leaves any replay and clears the verdict. */}
            <Button onClick={() => { grading.reset(); setTrades([]); setReplayIndex(null); }} disabled={trades.length === 0 || grading.met}>{t.reset}</Button>
            {offered.map((trade) => <Button key={trade} disabled={!state.can[trade] || grading.met} onClick={() => push(trade)}>{tradeLabel[trade]}</Button>)}
            <Button disabled={trades.length === 0 || grading.met} onClick={() => { grading.reset(); setTrades((value) => value.slice(0, -1)); }}>{t.undo}</Button>
          </div> : null}
        </TeachingChartBoard>
        {takeText ? <p className="lf-place-value-take" data-copy-role="data">{takeText}</p> : null}
        {trades.length >= 2 ? <div className="lf-place-value-replay">
          <Button onClick={() => setReplayIndex(replayIndex === null ? 0 : null)}>{replayIndex === null ? t.replay : t.edit}</Button>
          {replayIndex !== null ? <StepReplay steps={trades.length} index={replayIndex} onChange={setReplayIndex}
            labels={{ step: t.step, previous: t.previous, next: t.next, play: t.play, pause: t.pause }} /> : null}
        </div> : null}
        {graded ? <div className="lf-learning-control-strip">{threePlaces ? <NumberAnswer label={t.hundreds} locale={document.locale} onChange={setHundredsTyped} disabled={grading.pending || grading.met} /> : null}
          <NumberAnswer label={t.tens} locale={document.locale} onChange={setTensTyped} disabled={grading.pending || grading.met} />
          <NumberAnswer label={t.ones} locale={document.locale} onChange={setOnesTyped} disabled={grading.pending || grading.met} /></div> : null}
        {graded ? <GradedFoot locale={document.locale} grading={grading} named={namedFeedback(document.locale, 'place-value')} feedback={segment.feedback} canCheck={tensTyped !== null && onesTyped !== null && (!threePlaces || hundredsTyped !== null) && replayIndex === null} sequence={sequence}
          onCheck={() => grading.check({ trades, hundreds: threePlaces ? hundredsTyped : '0', tens: tensTyped, ones: onesTyped })} /> : null}
        <footer className="lf-place-value-foot"><p className="lf-place-value-equivalence" role="status" aria-live="polite"
          data-copy-role="data">{state.result && state.mode === 'subtract' ? `${t.result}: ${state.result.hundreds * 100 + state.result.tens * 10 + state.result.ones}`
            : last === 'hundred' || last === 'borrow-hundred' ? t.tenTens : last ? t.equivalent : `${t.total}: ${total}`}</p>
          {sequence && !graded ? <Button variant="accent" disabled={trades.length === 0 || replayIndex !== null} onClick={sequence.onAdvance}>{t.continue}</Button> : null}
        </footer>
      </div>
    </div>
  </main>;
}
