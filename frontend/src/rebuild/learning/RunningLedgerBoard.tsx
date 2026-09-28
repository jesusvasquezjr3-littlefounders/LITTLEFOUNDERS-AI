import { useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, ProgressBar } from '../design/controls';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import { runningLedger, type LedgerEntry } from './runningLedgerModel';
import { TeachingChartBoard } from './TeachingChartBoard';
import { StepReplay } from './StepReplay';
import { BalanceMeterVisual } from './pizarron';
import './learning.css';
import './runningLedger.css';
import './stepReplay.css';
import { LessonStageSlot } from './lessonStage';

type LedgerSegment = Extract<LessonClientSegment, { type: 'money.running-ledger.v2' }>;
type Labels = { back: string; explore: string; progress: string; title: string; prompt: string; board: string;
  showTable: string; showChart: string; movement: string; balance: string; start: string; sale: string;
  supplies: string; undo: string; reset: string; above: string; below: string; zero: string; coin: string;
  coins: string; step: string; continue: string; replay: string; edit: string; previous: string; next: string;
  play: string; pause: string };
const copy: Record<Locale, Labels> = {
  'en-US': { back: 'Back', explore: 'Explore', progress: 'Lesson progress', title: 'Follow the balance',
    prompt: 'Add sales and supply costs. What happens to the balance?', board: 'Running balance',
    showTable: 'Show as table', showChart: 'Show meter', movement: 'Movement', balance: 'Balance',
    start: 'Start', sale: 'Sale', supplies: 'Supplies', undo: 'Undo', reset: 'Reset', above: 'Above zero',
    below: 'Below zero', zero: 'Zero', coin: 'coin', coins: 'coins', step: 'Moves', continue: 'Continue',
    replay: 'Replay moves', edit: 'Edit moves', previous: 'Previous', next: 'Next', play: 'Play', pause: 'Pause' },
  'es-MX': { back: 'Volver', explore: 'Explorar', progress: 'Progreso de lección', title: 'Sigue el saldo',
    prompt: 'Agrega ventas y costos. ¿Qué pasa con el saldo?', board: 'Saldo en movimiento',
    showTable: 'Ver tabla', showChart: 'Ver medidor', movement: 'Movimiento', balance: 'Saldo',
    start: 'Inicio', sale: 'Venta', supplies: 'Insumos', undo: 'Deshacer', reset: 'Reiniciar',
    above: 'Sobre cero', below: 'Bajo cero', zero: 'Cero', coin: 'moneda', coins: 'monedas',
    step: 'Movimientos', continue: 'Continuar', replay: 'Repetir movimientos', edit: 'Editar movimientos',
    previous: 'Anterior', next: 'Siguiente', play: 'Reproducir', pause: 'Pausar' },
  'pt-BR': { back: 'Voltar', explore: 'Explorar', progress: 'Progresso da lição', title: 'Acompanhe o saldo',
    prompt: 'Some vendas e custos. O que acontece com o saldo?', board: 'Saldo em movimento',
    showTable: 'Ver tabela', showChart: 'Ver medidor', movement: 'Movimento', balance: 'Saldo',
    start: 'Início', sale: 'Venda', supplies: 'Insumos', undo: 'Desfazer', reset: 'Reiniciar',
    above: 'Acima de zero', below: 'Abaixo de zero', zero: 'Zero', coin: 'moeda', coins: 'moedas',
    step: 'Movimentos', continue: 'Continuar', replay: 'Rever movimentos', edit: 'Editar movimentos',
    previous: 'Anterior', next: 'Próximo', play: 'Reproduzir', pause: 'Pausar' },
};

/** Answerless Appendix A operation 13 candidate; no credit or wallet mutation. */
export function runningLedgerPilotDocument(locale: Locale): unknown {
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'entrepreneurship', pathway_id: 'entrepreneurship-13-17',
    chapter_id: 'unit-economics', lesson_id: 'pilot-running-ledger', version_id: 'rev-1',
    locale, age_band: '13-17', eligibility: ageEligibilityForBand('13-17'), knowledge_component_ids: ['kc-running-balance'], adventure_scene_id: 'diorama-a',
    title: t.title, required_capabilities: ['visual.balance-meter.v1', 'operation.running-ledger.v1', 'operation.step-replay.v1'],
    segments: [{ id: 'ledger-01', type: 'money.running-ledger.v2', prompt: t.prompt, grading: 'none',
      visual: { type: 'balance-meter' }, payload: { initial: 3, sale: 4, cost: 5, maxEntries: 4 } }],
  };
}

export function RunningLedgerBoard({ document, segment, onBack, sequence }: {
  document: LessonClientDocument; segment: LedgerSegment; onBack: () => void; sequence?: LessonSequenceControl;
}) {
  const t = copy[document.locale];
  const { initial, sale, cost, maxEntries } = segment.payload;
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const shownEntries = replayIndex === null ? entries : entries.slice(0, replayIndex);
  const snapshot = runningLedger(initial, shownEntries, maxEntries);
  if (!snapshot) return null;
  const formatter = new Intl.NumberFormat(document.locale, { maximumFractionDigits: 0 });
  const amount = (value: number) => `${formatter.format(value)} ${Math.abs(value) === 1 ? t.coin : t.coins}`;
  const signed = (value: number) => `${value > 0 ? '+' : '−'}${amount(Math.abs(value))}`;
  const balanceText = (value: number) => `${value < 0 ? '−' : ''}${amount(Math.abs(value))}`;
  const position = snapshot.balance > 0 ? t.above : snapshot.balance < 0 ? t.below : t.zero;
  const scale = Math.max(initial + maxEntries * sale, maxEntries * cost - initial, 1);
  const append = (amountValue: number) => {
    if (replayIndex !== null || entries.length >= maxEntries) return;
    const next = [...entries, { id: `entry-${entries.length + 1}`, amount: amountValue }];
    if (runningLedger(initial, next, maxEntries)) setEntries(next);
  };
  const rows = [{ id: 'start', label: t.start, value: balanceText(initial) }, ...snapshot.rows.map((row) => ({
    id: row.id, label: `${row.amount > 0 ? t.sale : t.supplies} ${signed(row.amount)}`,
    value: balanceText(row.balance),
  }))];

  return <main className="lf-learning" data-surface="app" data-screen="running-ledger">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        {sequence ? <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={sequenceProgress(sequence, entries.length > 0)} max={100} valueText={`${sequenceProgress(sequence, entries.length > 0)}%`} /> : null}
        <span data-copy-role={sequence ? 'data' : 'body'}>{sequence ? `${sequence.index + 1}/${sequence.total}` : t.explore}</span></header><LessonStageSlot />
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1>
          <p data-copy-role="prompt">{segment.prompt}</p></div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart}
          columns={[t.movement, t.balance]} rows={rows}
          controlLeading={<Button disabled={!entries.length} onClick={() => { setEntries([]); setReplayIndex(null); }}>{t.reset}</Button>}
          chart={<BalanceMeterVisual label={`${t.balance}: ${balanceText(snapshot.balance)}. ${position}. ${t.step}: ${shownEntries.length}/${maxEntries}.`}
            balance={snapshot.balance} scale={scale} aboveLabel={t.above} zeroLabel={t.zero} belowLabel={t.below} />}>
          {() => replayIndex === null ? <div className="lf-ledger-controls" role="group" aria-label={t.movement}>
            <Button disabled={entries.length >= maxEntries} onClick={() => append(sale)}>{t.sale} {signed(sale)}</Button>
            <Button disabled={entries.length >= maxEntries} onClick={() => append(-cost)}>{t.supplies} {signed(-cost)}</Button>
            <Button disabled={!entries.length} onClick={() => setEntries((value) => value.slice(0, -1))}>{t.undo}</Button>
          </div> : null}
        </TeachingChartBoard>
        {entries.length >= 2 ? <div className="lf-ledger-replay">
          <Button onClick={() => setReplayIndex(replayIndex === null ? 0 : null)}>{replayIndex === null ? t.replay : t.edit}</Button>
          {replayIndex !== null ? <StepReplay steps={entries.length} index={replayIndex} onChange={setReplayIndex}
            labels={{ step: t.step, previous: t.previous, next: t.next, play: t.play, pause: t.pause }} /> : null}
        </div> : null}
        <footer className="lf-ledger-foot"><p role="status" aria-live="polite" data-copy-role="body">
          {t.balance}: <strong data-copy-role="data">{balanceText(snapshot.balance)}</strong> · {position}
        </p><span data-copy-role="data">{t.step}: {shownEntries.length}/{replayIndex === null ? maxEntries : entries.length}</span>
          {sequence ? <Button variant="accent" disabled={!entries.length || replayIndex !== null} onClick={sequence.onAdvance}>{t.continue}</Button> : null}</footer>
      </div>
    </div>
  </main>;
}
