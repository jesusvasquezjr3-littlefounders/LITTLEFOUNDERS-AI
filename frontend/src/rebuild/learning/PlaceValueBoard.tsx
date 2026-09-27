import { useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, ProgressBar } from '../design/controls';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { placeValueState } from './placeValueModel';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import { TeachingChartBoard } from './TeachingChartBoard';
import { StepReplay } from './StepReplay';
import './learning.css';
import './placeValue.css';
import './stepReplay.css';
import { LessonStageSlot } from './lessonStage';

type PlaceValueSegment = Extract<LessonClientSegment, { type: 'math.place-value.v2' }>;
type Labels = { back: string; explore: string; progress: string; board: string; showTable: string; showChart: string;
  tens: string; ones: string; total: string; pieces: string; count: string; trade: string; undo: string;
  continue: string; title: string; prompt: string; equivalent: string; replay: string; edit: string;
  previous: string; next: string; play: string; pause: string; step: string };
const copy: Record<Locale, Labels> = {
  'en-US': { back: 'Back', explore: 'Explore', progress: 'Lesson progress', board: 'Place value', showTable: 'Show as table',
    showChart: 'Show blocks', tens: 'Tens', ones: 'Ones', total: 'Total', pieces: 'Pieces', count: 'Count', trade: 'Trade 10',
    undo: 'Undo trade', continue: 'Continue', title: 'Trade ten ones', prompt: 'Trade 10 ones for 1 ten. What changed?',
    equivalent: '10 ones = 1 ten', replay: 'Replay trades', edit: 'Edit trades', previous: 'Previous',
    next: 'Next', play: 'Play', pause: 'Pause', step: 'Trades' },
  'es-MX': { back: 'Volver', explore: 'Explorar', progress: 'Progreso de lección', board: 'Valor posicional',
    showTable: 'Ver tabla', showChart: 'Ver bloques', tens: 'Decenas', ones: 'Unidades', total: 'Total',
    pieces: 'Piezas', count: 'Cantidad', trade: 'Cambia 10', undo: 'Deshacer', continue: 'Continuar',
    title: 'Cambia diez unidades', prompt: 'Cambia 10 unidades por 1 decena. ¿Qué cambió?', equivalent: '10 unidades = 1 decena',
    replay: 'Repetir cambios', edit: 'Editar cambios', previous: 'Anterior', next: 'Siguiente',
    play: 'Reproducir', pause: 'Pausar', step: 'Cambios' },
  'pt-BR': { back: 'Voltar', explore: 'Explorar', progress: 'Progresso da lição', board: 'Valor posicional',
    showTable: 'Ver tabela', showChart: 'Ver blocos', tens: 'Dezenas', ones: 'Unidades', total: 'Total',
    pieces: 'Peças', count: 'Quantidade', trade: 'Trocar 10', undo: 'Desfazer', continue: 'Continuar',
    title: 'Troque dez unidades', prompt: 'Troque 10 unidades por 1 dezena. O que mudou?', equivalent: '10 unidades = 1 dezena',
    replay: 'Rever trocas', edit: 'Editar trocas', previous: 'Anterior', next: 'Próximo',
    play: 'Reproduzir', pause: 'Pausar', step: 'Trocas' },
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

export function PlaceValueBoard({ document, segment, onBack, sequence }: {
  document: LessonClientDocument; segment: PlaceValueSegment; onBack: () => void; sequence?: LessonSequenceControl;
}) {
  const t = copy[document.locale];
  const [trades, setTrades] = useState(0);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const shownTrades = replayIndex ?? trades;
  const state = placeValueState(segment.payload.total, shownTrades);
  if (!state) return null;
  const progress = sequenceProgress(sequence, trades > 0);
  return <main className="lf-learning" data-surface="app" data-screen="place-value">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        {sequence ? <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={progress} max={100} valueText={`${progress}%`} /> : null}
        <span data-copy-role={sequence ? 'data' : 'body'}>{sequence ? `${sequence.index + 1}/${sequence.total}` : t.explore}</span></header><LessonStageSlot />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1>
          <p data-copy-role="prompt">{segment.prompt}</p></div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart}
          columns={[t.pieces, t.count]} rows={[
            { id: 'tens', label: t.tens, value: String(state.tens) },
            { id: 'ones', label: t.ones, value: String(state.ones) },
            { id: 'total', label: t.total, value: String(state.total) },
          ]} chart={<div className="lf-place-value-plot" role="img"
            aria-label={`${state.tens} ${t.tens}, ${state.ones} ${t.ones}. ${t.total}: ${state.total}.`}>
            <div className="lf-place-value-group"><span data-copy-role="data">{t.tens}: {state.tens}</span>
              <div className="lf-place-value-rods" aria-hidden="true">{Array.from({ length: state.tens }, (_, index) =>
                <span className="lf-place-value-rod" key={index}>{Array.from({ length: 10 }, (_, cell) => <i key={cell} />)}</span>)}</div>
            </div>
            <div className="lf-place-value-group"><span data-copy-role="data">{t.ones}: {state.ones}</span>
              <div className="lf-place-value-ones" aria-hidden="true">{Array.from({ length: state.ones }, (_, index) =>
                <i key={index} />)}</div>
            </div>
          </div>}>
          {() => replayIndex === null ? <div className="lf-place-value-controls">
            <Button disabled={!state.canTrade} onClick={() => setTrades((value) => value + 1)}>{t.trade}</Button>
            <Button disabled={!state.canUndo} onClick={() => setTrades((value) => value - 1)}>{t.undo}</Button>
          </div> : null}
        </TeachingChartBoard>
        {trades >= 2 ? <div className="lf-place-value-replay">
          <Button onClick={() => setReplayIndex(replayIndex === null ? 0 : null)}>{replayIndex === null ? t.replay : t.edit}</Button>
          {replayIndex !== null ? <StepReplay steps={trades} index={replayIndex} onChange={setReplayIndex}
            labels={{ step: t.step, previous: t.previous, next: t.next, play: t.play, pause: t.pause }} /> : null}
        </div> : null}
        <footer className="lf-place-value-foot"><p className="lf-place-value-equivalence" role="status" aria-live="polite"
          data-copy-role="data">{shownTrades > 0 ? t.equivalent : `${t.total}: ${state.total}`}</p>
          {sequence ? <Button variant="accent" disabled={trades === 0 || replayIndex !== null} onClick={sequence.onAdvance}>{t.continue}</Button> : null}
        </footer>
      </div>
    </div>
  </main>;
}
