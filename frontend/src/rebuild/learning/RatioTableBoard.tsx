import { useMemo, useState, type PointerEvent } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, Slider, ProgressBar } from '../design/controls';
import { ageEligibilityForBand, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { ratioTableRows } from './ratioTableModel';
import { sequenceProgress, type LessonSequenceControl } from './lessonSequence';
import { TeachingChartBoard } from './TeachingChartBoard';
import './learning.css';

type CopySet = {
  back: string; practice: string; board: string; showTable: string; showChart: string; packs: string; pack: string;
  items: string; coins: string; total: string; unit: string; unitPrice: string; ratioLines: string; dragPair: string; reset: string;
  progress: string; continue: string; title: string; prompt: string;
};

const copy: Record<Locale, CopySet> = {
  'en-US': { back: 'Back', practice: 'Explore', board: 'Price table', showTable: 'Show as table', showChart: 'Show diagram',
    packs: 'Packs', pack: 'pack', items: 'items', coins: 'coins', total: 'Total price', unit: 'Each item', unitPrice: 'Unit price',
    ratioLines: 'Linked number lines', dragPair: 'Drag the linked pair', reset: 'Reset', progress: 'Lesson progress', continue: 'Continue',
    title: 'Compare unit prices', prompt: 'Three cups cost 15 coins. Extend the pair.' },
  'es-MX': { back: 'Volver', practice: 'Explorar', board: 'Tabla de precio', showTable: 'Ver tabla', showChart: 'Ver diagrama',
    packs: 'Paquetes', pack: 'paquete', items: 'artículos', coins: 'monedas', total: 'Precio total', unit: 'Cada artículo', unitPrice: 'Precio unitario',
    ratioLines: 'Rectas vinculadas', dragPair: 'Arrastra la pareja vinculada', reset: 'Restablecer', progress: 'Progreso de lección', continue: 'Continuar',
    title: 'Compara precios unitarios', prompt: 'Tres vasos cuestan 15 monedas. Extiende la pareja.' },
  'pt-BR': { back: 'Voltar', practice: 'Explorar', board: 'Tabela de preço', showTable: 'Ver tabela', showChart: 'Ver diagrama',
    packs: 'Pacotes', pack: 'pacote', items: 'itens', coins: 'moedas', total: 'Preço total', unit: 'Cada item', unitPrice: 'Preço unitário',
    ratioLines: 'Retas vinculadas', dragPair: 'Arraste o par vinculado', reset: 'Recomeçar', progress: 'Progresso da lição', continue: 'Continuar',
    title: 'Compare preços por item', prompt: 'Três copos custam 15 moedas. Estenda o par.' },
};

type RatioTableSegment = Extract<LessonClientSegment, { type: 'math.ratio-table.v2' }>;

/** Controlled M14 candidate with direct pairs and a native range fallback. */
export function ratioTablePilotDocument(locale: Locale): unknown {
  const t = copy[locale];
  return {
    schema_version: 2, course_id: 'entrepreneurship', pathway_id: 'entrepreneurship-10-12', chapter_id: 'costs-and-prices',
    lesson_id: 'pilot-ratio-table', version_id: 'rev-1', locale, age_band: '10-12', eligibility: ageEligibilityForBand('10-12'),
    knowledge_component_ids: ['kc-unit-price'], adventure_scene_id: 'diorama-a', title: t.title,
    required_capabilities: ['visual.ratio-table.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
    segments: [{ id: 'ratio-table-01', type: 'math.ratio-table.v2', prompt: t.prompt, grading: 'none',
      visual: { type: 'ratio-table' }, payload: { itemsPerPack: 3, pricePerPack: 15, minimumPacks: 1, maximumPacks: 4, initialPacks: 2, currency: 'coins' } }],
  };
}

export function RatioTableBoard({ document, segment, onBack, sequence }: {
  document: LessonClientDocument; segment: RatioTableSegment; onBack: () => void; sequence?: LessonSequenceControl;
}) {
  const t = copy[document.locale];
  const [packs, setPacks] = useState(segment.payload.initialPacks);
  const allRows = useMemo(() => ratioTableRows(segment.payload, segment.payload.maximumPacks) ?? [], [segment.payload]);
  const rows = allRows.slice(0, packs);
  const current = rows.at(-1);
  const amount = (value: number) => `${value} ${t.coins}`;
  const changed = packs !== segment.payload.initialPacks;
  const pairPosition = `${(packs - segment.payload.minimumPacks) / (segment.payload.maximumPacks - segment.payload.minimumPacks) * 100}%`;
  const movePair = (event: PointerEvent<HTMLButtonElement>) => {
    const track = event.currentTarget.parentElement;
    if (!track) return;
    const bounds = track.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setPacks(Math.round(segment.payload.minimumPacks + fraction * (segment.payload.maximumPacks - segment.payload.minimumPacks)));
  };
  const startPair = (event: PointerEvent<HTMLButtonElement>) => { event.currentTarget.setPointerCapture(event.pointerId); movePair(event); };
  return <main className="lf-learning" data-surface="app" data-screen="ratio-table">
    <div className="lf-learning-inner">
      <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button>
        {sequence ? <ProgressBar className="lf-learning-progress" labelHidden label={t.progress} value={sequenceProgress(sequence, changed)} max={100} valueText={`${sequenceProgress(sequence, changed)}%`} /> : null}
        <span data-copy-role={sequence ? 'data' : 'body'}>{sequence ? `${sequence.index + 1}/${sequence.total}` : t.practice}</span>
      </header>
      <div className="lf-learning-content">
        <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><p data-copy-role="prompt">{segment.prompt}</p></div>
        <TeachingChartBoard title={t.board} showTableLabel={t.showTable} showChartLabel={t.showChart}
          controlLeading={<Button onClick={() => setPacks(segment.payload.initialPacks)} disabled={!changed}>{t.reset}</Button>}
          table={<table className="lf-learning-table lf-ratio-table" aria-label={t.board}><thead><tr>
            <th scope="col" data-copy-role="data">{t.packs}</th><th scope="col" data-copy-role="data">{t.items}</th>
            <th scope="col" data-copy-role="data">{t.total}</th><th scope="col" data-copy-role="data">{t.unitPrice}</th>
          </tr></thead><tbody>{rows.map((row) => <tr key={row.packs}>
            <th scope="row" data-label={t.packs} data-copy-role="data">{row.packs}</th><td data-label={t.items} data-copy-role="data">{row.items}</td>
            <td data-label={t.total} data-copy-role="data">{amount(row.price)}</td><td data-label={t.unitPrice} data-copy-role="data">{amount(row.unitPrice)}</td>
          </tr>)}</tbody></table>}
          chart={<div className="lf-ratio-diagram" role="group" aria-label={`${t.ratioLines}. ${packs} ${t.packs}: ${current?.items} ${t.items}; ${amount(current?.price ?? 0)}. ${t.unit}: ${amount(segment.payload.pricePerPack / segment.payload.itemsPerPack)}.`}>
            <div className="lf-ratio-line"><span data-copy-role="data">{t.items}</span><div className="lf-ratio-ticks" style={{ gridTemplateColumns: `repeat(${allRows.length}, minmax(0, 1fr))` }}>{allRows.map((row) => <span key={row.packs} aria-hidden="true" className={row.packs <= packs ? undefined : 'lf-ratio-tick--future'}>{row.items}</span>)}<button className="lf-ratio-pair" type="button" aria-label={t.dragPair} style={{ insetInlineStart: pairPosition }} onPointerDown={startPair} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) movePair(event); }} /></div></div>
            <div className="lf-ratio-line"><span data-copy-role="data">{t.total}</span><div className="lf-ratio-ticks" style={{ gridTemplateColumns: `repeat(${allRows.length}, minmax(0, 1fr))` }}>{allRows.map((row) => <span key={row.packs} aria-hidden="true" className={row.packs <= packs ? undefined : 'lf-ratio-tick--future'}>{amount(row.price)}</span>)}<button className="lf-ratio-pair" type="button" aria-label={t.dragPair} style={{ insetInlineStart: pairPosition }} onPointerDown={startPair} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) movePair(event); }} /></div></div>
            <p className="lf-ratio-unit" data-copy-role="data">{t.unit}: <strong data-copy-role="data">{amount(segment.payload.pricePerPack / segment.payload.itemsPerPack)}</strong></p>
          </div>}>
          {() => <Slider className="lf-ratio-control" label={t.packs} valueText={`${packs} ${packs === 1 ? t.pack : t.packs}`}
            min={segment.payload.minimumPacks} max={segment.payload.maximumPacks} step={1} value={packs} onValueChange={setPacks}
            stepLabels={{ decrease: '−', increase: '+' }} />}
        </TeachingChartBoard>
        {sequence ? <footer className="lf-ratio-foot"><Button variant="accent" disabled={!changed} onClick={sequence.onAdvance}>{t.continue}</Button></footer> : null}
      </div>
    </div>
  </main>;
}
