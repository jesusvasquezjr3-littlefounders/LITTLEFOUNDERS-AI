import { useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, Menu } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import { lessonVersionKey, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { type LessonSequenceControl } from './lessonSequence';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import './learning.css';
import { LessonStageSlot } from './lessonStage';
import { NumberAnswer, readNumberAnswer, SegmentPrompt, verdictBannerText } from './segmentKit';
import { namedFeedback } from './namedFeedback';
import { BarModelVisual, type TapeRow, type TapeSegment } from './pizarron';
import { solveBarModel } from './v2VisualScorer.generated';

/*
 * M7 bar model (Appendix P Part 1 M7, Part 4.1 and 4.5; Bible 05 §4 Build and
 * §7 "Bar and schema models"; GAP-FIX-R3). The learner builds the bars from
 * the text: the board starts empty, the learner adds one bar in parts
 * (part-whole) or two bars to compare (comparison), adds a part or the total
 * bracket, and fills each slot from a slot-by-slot picker (Tab through the
 * slots; Enter opens the picker) with one of the text's quantities or the
 * unknown, which the board draws as a dashed segment labelled "?". The
 * lengths come from the quantities the learner placed (the canonical
 * scorer's `solveBarModel`), so a build that contradicts the text looks
 * wrong. Structure is graded before the arithmetic: the answer step opens
 * only after Core recorded the structure, and shows the bars the learner built.
 */

type Segment = Extract<LessonClientSegment, { type: 'math.bar-model.structure.v2' | 'math.bar-model.answer.v2' }>;
type Verdict = 'invalid' | 'met' | 'review';
type Model = 'part-whole' | 'comparison';
type SlotName = 'part-a' | 'part-b' | 'part-c' | 'whole' | 'smaller' | 'larger' | 'difference' | 'total';
export interface BarBuild { model: Model | null; slots: Partial<Record<SlotName, string | null>> }

const REQUIRED: Record<Model, SlotName[]> = { 'part-whole': ['part-a', 'part-b', 'whole'], comparison: ['smaller', 'larger', 'difference'] };
const OPTIONAL: Record<Model, SlotName> = { 'part-whole': 'part-c', comparison: 'total' };
const ORDER: Record<Model, SlotName[]> = { 'part-whole': ['part-a', 'part-b', 'part-c', 'whole'], comparison: ['smaller', 'larger', 'difference', 'total'] };
const EMPTY: BarBuild = { model: null, slots: {} };

type Copy = {
  reset: string; back: string; model: string; answer: string; check: string; continue: string; unavailable: string;
  input: string; showTable: string; showVisual: string; start: string; partsBar: string; compareBars: string; addPart: string; addTotal: string;
  piece: string; holds: string; empty: string; noNumber: string; remove: string; unknown: string; pick: (slot: string) => string; slot: Record<SlotName, string>;
};
const copy: Record<Locale, Copy> = {
  'en-US': { reset: 'Reset', back: 'Back', model: 'Build the model', answer: 'Solve the model', check: 'Check', continue: 'Continue',
    unavailable: 'We could not check that. Try again.', input: 'Your answer',
    showTable: 'Show as table', showVisual: 'Show model', start: 'Add bars to start.', partsBar: 'One bar in parts', compareBars: 'Two bars to compare',
    addPart: 'Add a part', addTotal: 'Add the total', piece: 'Piece', holds: 'Holds', empty: 'Empty', noNumber: 'No number', remove: 'Remove', unknown: 'Unknown',
    pick: (slot) => `${slot}: choose`,
    slot: { 'part-a': 'Part 1', 'part-b': 'Part 2', 'part-c': 'Part 3', whole: 'Whole', smaller: 'Shorter bar', larger: 'Longer bar', difference: 'Difference', total: 'Both together' } },
  'es-MX': { reset: 'Restablecer', back: 'Volver', model: 'Construye el modelo', answer: 'Resuelve el modelo', check: 'Comprobar', continue: 'Continuar',
    unavailable: 'No pudimos comprobarlo. Intenta otra vez.', input: 'Tu respuesta',
    showTable: 'Ver tabla', showVisual: 'Ver modelo', start: 'Agrega barras para empezar.', partsBar: 'Una barra en partes', compareBars: 'Dos barras para comparar',
    addPart: 'Agregar una parte', addTotal: 'Agregar el total', piece: 'Pieza', holds: 'Contiene', empty: 'Vacía', noNumber: 'Sin número', remove: 'Quitar', unknown: 'Incógnita',
    pick: (slot) => `${slot}: elegir`,
    slot: { 'part-a': 'Parte 1', 'part-b': 'Parte 2', 'part-c': 'Parte 3', whole: 'Total', smaller: 'Barra corta', larger: 'Barra larga', difference: 'Diferencia', total: 'Las dos juntas' } },
  'pt-BR': { reset: 'Recomeçar', back: 'Voltar', model: 'Monte o modelo', answer: 'Resolva o modelo', check: 'Conferir', continue: 'Continue',
    unavailable: 'Não foi possível conferir. Tente de novo.', input: 'Sua resposta',
    showTable: 'Ver tabela', showVisual: 'Ver modelo', start: 'Adicione barras para começar.', partsBar: 'Uma barra em partes', compareBars: 'Duas barras para comparar',
    addPart: 'Adicionar uma parte', addTotal: 'Adicionar o total', piece: 'Peça', holds: 'Contém', empty: 'Vazia', noNumber: 'Sem número', remove: 'Tirar', unknown: 'Incógnita',
    pick: (slot) => `${slot}: escolher`,
    slot: { 'part-a': 'Parte 1', 'part-b': 'Parte 2', 'part-c': 'Parte 3', whole: 'Todo', smaller: 'Barra curta', larger: 'Barra longa', difference: 'Diferença', total: 'As duas juntas' } },
};

/** The structure the learner's graded build stood on, per lesson version, so the arithmetic step draws the same bars. */
const builtStructures = new Map<string, BarBuild>();

export function barModelPilotDocument(locale: Locale): unknown {
  const title = { 'en-US': 'Compare two savings', 'es-MX': 'Compara dos ahorros', 'pt-BR': 'Compare duas economias' }[locale];
  const structurePrompt = { 'en-US': 'Ana has 12 more coins than Leo, and together they have 50. Build the bars.', 'es-MX': 'Ana tiene 12 monedas más que Leo y juntos tienen 50. Arma las barras.', 'pt-BR': 'Ana tem 12 moedas a mais que Leo e, juntos, têm 50. Monte as barras.' }[locale];
  const answerPrompt = { 'en-US': 'How many coins does Leo have?', 'es-MX': '¿Cuántas monedas tiene Leo?', 'pt-BR': 'Quantas moedas Leo tem?' }[locale];
  const more = { 'en-US': '12 more', 'es-MX': '12 más', 'pt-BR': '12 a mais' }[locale];
  const together = { 'en-US': 'Together', 'es-MX': 'Juntos', 'pt-BR': 'Juntos' }[locale];
  const p = { quantities: [{ id: 'together', value: 50, label: together }, { id: 'ana-more', value: 12, label: more }], unknownLabel: 'Leo', spokenText: 'fifty minus twelve, halved' };
  return { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'compare-savings', lesson_id: 'pilot-bar-model', version_id: 'rev-2', locale, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-compare-quantities'], adventure_scene_id: 'diorama-a', title, required_capabilities: ['visual.bar-model.v1', 'operation.build-slots.v1', 'operation.structure-check.v1', 'operation.number-input.v1'], segments: [{ id: 'bar-structure-01', type: 'math.bar-model.structure.v2', grading: 'server', prompt: structurePrompt, visual: { type: 'bar-model' }, payload: p }, { id: 'bar-answer-01', type: 'math.bar-model.answer.v2', grading: 'server', prompt: answerPrompt, visual: { type: 'bar-model' }, payload: p }] };
}

/** Every quantity placed once and the unknown once; a part-whole slot or an added total is never left without a number. */
export function barBuildComplete(build: BarBuild, quantityIds: readonly string[]): boolean {
  if (!build.model) return false;
  const values = Object.entries(build.slots);
  if (build.model === 'part-whole' || build.slots.total !== undefined) {
    if (values.some(([slot, value]) => value === null && (build.model === 'part-whole' || slot === 'total'))) return false;
  }
  const placed = values.map(([, value]) => value);
  return placed.filter((value) => value === 'unknown').length === 1 && quantityIds.every((id) => placed.filter((value) => value === id).length === 1);
}

export function BarModelBoard({ document, segment, onBack, onGrade, sequence }: { document: LessonClientDocument; segment: Segment; onBack: () => void; onGrade: (answer: Record<string, unknown>, segmentId: string) => Verdict | Promise<Verdict>; sequence?: LessonSequenceControl }) {
  const t = copy[document.locale]; const p = segment.payload; const structure = segment.type === 'math.bar-model.structure.v2';
  const quantityIds = p.quantities.map((item) => item.id);
  const index = document.segments.findIndex((item) => item.id === segment.id);
  const previous = document.segments[index - 1];
  const saved = !structure && previous ? builtStructures.get(`${lessonVersionKey(document)}:${previous.id}`) ?? null : null;
  // Bible 05 §4 / §7: the board starts empty; the learner builds every bar.
  const [build, setBuild] = useState<BarBuild>(EMPTY);
  const [value, setValue] = useState(''); const [showTable, setShowTable] = useState(false); const [verdict, setVerdict] = useState<'met' | 'review' | 'unavailable' | null>(null);
  const { pending, grade } = useSingleActiveGrade();
  const pristine = build.model === null && value === '' && verdict === null;
  const reset = () => { setBuild(EMPTY); setValue(''); setVerdict(null); };
  const change = (next: BarBuild) => { setBuild(next); setVerdict(null); };
  const addBars = (model: Model) => change({ model, slots: Object.fromEntries(REQUIRED[model].map((slot) => [slot, null])) });
  const addOptional = () => { if (build.model) change({ ...build, slots: { ...build.slots, [OPTIONAL[build.model]]: null } }); };
  const assign = (slot: SlotName, next: string | null | undefined) => {
    const slots = { ...build.slots };
    // A quantity or the unknown sits in one slot at a time: placing it again moves it.
    if (typeof next === 'string') for (const key of Object.keys(slots) as SlotName[]) if (slots[key] === next) slots[key] = null;
    if (next === undefined) delete slots[slot]; else slots[slot] = next;
    change({ ...build, slots });
  };
  // Bible 05 §5 / Appendix P Part 5 (GAP-FIX-R7): the typed answer is read for the lesson's locale and sent as its canonical
  // whole number; the bound is the canonical scorer's (every unknown a bar model can hold is at most twice the quantities' sum).
  const domain = { whole: true, max: 2 * p.quantities.reduce((sum, item) => sum + item.value, 0) };
  const typed = readNumberAnswer(value, document.locale, domain).canonical;
  const complete = structure ? barBuildComplete(build, quantityIds) : typed !== null;
  const submit = () => {
    if (verdict === 'met') { sequence?.onAdvance(); return; }
    if (!structure && typed === null) return;
    const answer = structure ? { model: build.model, slots: build.slots } : { value: typed };
    grade(() => onGrade(answer, segment.id), (result) => {
      setVerdict(result === 'met' ? 'met' : 'review');
      if (structure && result === 'met') builtStructures.set(`${lessonVersionKey(document)}:${segment.id}`, build);
    }, () => setVerdict('unavailable'));
  };
  const shown = structure ? build : saved ?? EMPTY;
  const describe = (slotValue: string | null | undefined) => {
    if (slotValue === 'unknown') return `${p.unknownLabel}: ?`;
    const quantity = p.quantities.find((item) => item.id === slotValue);
    return quantity ? `${quantity.label}: ${quantity.value}` : slotValue === null && shown.model === 'comparison' ? t.noNumber : t.empty;
  };
  const slotsOf = (current: BarBuild) => current.model ? ORDER[current.model].filter((slot) => current.slots[slot] !== undefined) : [];
  const table = <table className="lf-learning-table" aria-label={structure ? t.model : t.answer}>
    <thead><tr><th scope="col" data-copy-role="data">{t.piece}</th><th scope="col" data-copy-role="data">{t.holds}</th></tr></thead>
    <tbody>{shown.model ? slotsOf(shown).map((slot) => <tr key={slot}><th scope="row" data-label={t.piece} data-copy-role="data">{t.slot[slot]}</th>
      <td data-label={t.holds} data-copy-role="data">{describe(shown.slots[slot])}</td></tr>)
      : [...p.quantities.map((item) => <tr key={item.id}><th scope="row" data-label={t.piece} data-copy-role="data">{item.label}</th><td data-label={t.holds} data-copy-role="data">{item.value}</td></tr>),
        <tr key="unknown"><th scope="row" data-label={t.piece} data-copy-role="data">{p.unknownLabel}</th><td data-label={t.holds} data-copy-role="data">?</td></tr>]}</tbody>
  </table>;
  const visual = shown.model ? <BarModelVisual label={slotsOf(shown).map((slot) => `${t.slot[slot]} ${describe(shown.slots[slot])}`).join('; ')}
    rows={barRows(shown, p, t)} note={shown.model === 'comparison' && shown.slots.total !== undefined ? `${t.slot.total}: ${valueText(shown.slots.total, p)}` : undefined} />
    : <p className="lf-bar-model-start" data-copy-role="body">{structure ? t.start : p.quantities.map((item) => `${item.label}: ${item.value}`).concat(`${p.unknownLabel}: ?`).join('; ')}</p>;
  const pieces = structure ? <div className="lf-bar-model-build">
    {build.model === null ? <div className="lf-bar-model-add">
      <Button disabled={pending} onClick={() => addBars('part-whole')}>{t.partsBar}</Button>
      <Button disabled={pending} onClick={() => addBars('comparison')}>{t.compareBars}</Button>
    </div> : <>
      {build.slots[OPTIONAL[build.model]] === undefined ? <div className="lf-bar-model-add"><Button disabled={pending} onClick={addOptional}>
        {build.model === 'part-whole' ? t.addPart : t.addTotal}</Button></div> : null}
      <ul className="lf-bar-model-slots">{slotsOf(build).map((slot) => <li key={slot}>
        <Menu label={t.slot[slot]} items={[
          ...p.quantities.map((item) => ({ id: item.id, label: `${item.label}: ${item.value}`, onSelect: () => assign(slot, item.id) })),
          { id: 'unknown', label: `? ${p.unknownLabel}`, onSelect: () => assign(slot, 'unknown') },
          { id: 'clear', label: build.model === 'comparison' ? t.noNumber : t.empty, onSelect: () => assign(slot, null) },
          ...(slot === OPTIONAL[build.model!] ? [{ id: 'remove', label: t.remove, onSelect: () => assign(slot, undefined) }] : []),
        ]} trigger={(props) => <Button {...props} disabled={pending} className="lf-bar-model-slot" data-slot={slot}
          data-filled={build.slots[slot] ? 'true' : undefined}>{`${t.slot[slot]}: ${describe(build.slots[slot])}`}</Button>} />
      </li>)}</ul>
    </>}
  </div> : <NumberAnswer label={t.input} locale={document.locale} {...domain} disabled={pending} value={value} onTextChange={(text) => { setValue(text); setVerdict(null); }} />;
  return <main className="lf-learning" data-surface="app" data-screen="bar-model"><div className="lf-learning-inner">
    <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="data">{sequence ? `${sequence.index + 1}/${sequence.total}` : ''}</span></header>
    <LessonStageSlot verdict={verdict} />
    <div className="lf-learning-content">
      <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div>
      <section className="lf-learning-board" data-bar-model={shown.model ?? 'empty'}><h2 data-copy-role="heading">{structure ? t.model : t.answer}</h2>{showTable ? table : visual}</section>
      <div className="lf-learning-control-strip">
        <div className="lf-learning-control-bar"><Button size="sm" onClick={reset} disabled={pending || pristine}>{t.reset}</Button>
          <Button variant="sky" size="sm" className="lf-learning-view-toggle" onClick={() => setShowTable((current) => !current)}>{showTable ? t.showVisual : t.showTable}</Button></div>
        {pieces}
      </div>
      <footer className="lf-learning-foot"><LessonFeedback verdict={verdict}>{verdict === null ? null : verdictBannerText(document.locale, verdict, namedFeedback(document.locale, structure ? 'bar-model-structure' : 'bar-model-answer'), segment.feedback)}</LessonFeedback>
        <div className="lf-learning-actions"><Button variant="accent" onClick={submit} disabled={pending || verdict !== 'met' && !complete}>{verdict === 'met' ? t.continue : t.check}</Button></div></footer>
    </div>
  </div></main>;
}

function valueText(slotValue: string | null | undefined, p: Segment['payload']): string {
  if (slotValue === 'unknown') return '?';
  return String(p.quantities.find((item) => item.id === slotValue)?.value ?? '');
}

/**
 * The bars a build draws. Lengths come from the quantities the learner placed
 * (solved by the canonical scorer); a slot the build cannot size yet takes an
 * even share, so an unfinished build still reads as bars.
 */
function barRows(build: BarBuild, p: Segment['payload'], t: Copy): TapeRow[] {
  const slots = Object.fromEntries(Object.entries(build.slots).filter(([, value]) => value !== undefined)) as Record<string, string | null>;
  const solved = build.model ? solveBarModel(build.model, slots, { ids: p.quantities.map((item) => item.id), values: p.quantities.map((item) => item.value) }) ?? {} : {};
  const labelOf = (slot: SlotName) => {
    const slotValue = build.slots[slot];
    return slotValue === 'unknown' ? p.unknownLabel : p.quantities.find((item) => item.id === slotValue)?.label ?? t.slot[slot];
  };
  const segmentOf = (slot: SlotName, id: string, share: number, series: TapeSegment['series']): TapeSegment => {
    const slotValue = build.slots[slot];
    return { id, label: labelOf(slot), value: slotValue && slotValue !== 'unknown' ? valueText(slotValue, p) : '', share, series,
      unknown: slotValue === 'unknown', empty: slotValue === null || slotValue === undefined };
  };
  if (build.model === 'part-whole') {
    const parts = (['part-a', 'part-b', 'part-c'] as const).filter((slot) => build.slots[slot] !== undefined);
    const lengths = parts.map((slot) => solved[slot] ?? 0);
    const even = lengths.some((length) => length <= 0);
    const sum = even ? parts.length : lengths.reduce((total, length) => total + length, 0);
    const series: TapeSegment['series'][] = ['sky', 'mint', 'berry'];
    return [{ id: 'whole', label: labelOf('whole'), total: build.slots.whole && build.slots.whole !== 'unknown' ? valueText(build.slots.whole, p) : build.slots.whole === 'unknown' ? '?' : undefined,
      segments: parts.map((slot, i) => segmentOf(slot, slot, (even ? 1 : lengths[i]!) / sum, series[i]!)) }];
  }
  // Comparison: the shorter bar, and the longer bar as the same length plus the difference.
  const smaller = solved.smaller ?? 0; const difference = solved.difference ?? 0;
  const [s, d] = smaller > 0 && difference > 0 ? [smaller, difference] : [2, 1];
  const longest = s + d;
  return [
    { id: 'smaller', label: labelOf('smaller'), segments: [segmentOf('smaller', 'smaller', s / longest, 'sky')] },
    { id: 'larger', label: labelOf('larger'), total: build.slots.larger && build.slots.larger !== 'unknown' ? valueText(build.slots.larger, p) : build.slots.larger === 'unknown' ? '?' : undefined,
      segments: [{ id: 'larger-base', label: labelOf('smaller'), value: '', share: s / longest, series: 'sky' }, segmentOf('difference', 'difference', d / longest, 'mint')] },
  ];
}
