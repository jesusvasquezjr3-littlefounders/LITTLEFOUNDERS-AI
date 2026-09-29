import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, SegmentedControl, TextField } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import { type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { type LessonSequenceControl } from './lessonSequence';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import { SCHEMA_KINDS, SCHEMA_SLOTS, type SchemaKind } from './v2SegmentFamilies.generated';
import { SchemaSlotsVisual } from './pizarron';
import './learning.css';
import { LessonStageSlot } from './lessonStage';
import { SegmentPrompt, verdictBannerText } from './segmentKit';
import { namedFeedback } from './namedFeedback';

type Segment = Extract<LessonClientSegment, { type: 'math.schema-diagram.structure.v2' | 'math.schema-diagram.slots.v2' | 'math.schema-diagram.answer.v2' }>;
type Verdict = 'invalid' | 'met' | 'review';
type SlotName = 'start' | 'change' | 'result' | 'part' | 'other' | 'total' | 'larger' | 'smaller' | 'difference' | 'rate' | 'count';

type Labels = {
  reset: string; back: string; choose: string; fill: string; solve: string; check: string; continue: string;
  unavailable: string; answer: string; story: string; unknown: string; schemas: Record<SchemaKind, string>; slots: Record<SlotName, string>;
  shapes: Record<SchemaKind, string>;
};
const copy: Record<Locale, Labels> = {
  'en-US': { reset: 'Reset', back: 'Back', choose: 'Choose the schema', fill: 'Fill the schema', solve: 'Solve the schema', check: 'Check',
    continue: 'Continue', unavailable: 'We could not check that. Try again.',
    answer: 'Your answer', story: 'Story numbers', unknown: '?',
    schemas: { change: 'Change', group: 'Group', compare: 'Compare', ratio: 'Ratio' },
    slots: { start: 'Start', change: 'Change', result: 'Result', part: 'Part', other: 'Other part', total: 'Total', larger: 'Larger',
      smaller: 'Smaller', difference: 'Difference', rate: 'Per one', count: 'How many' },
    shapes: { change: 'A start, then a change, gives the result.', group: 'Two parts make one total.',
      compare: 'The larger minus the smaller is the difference.', ratio: 'The amount per one, times how many, is the total.' } },
  'es-MX': { reset: 'Restablecer', back: 'Volver', choose: 'Elige el esquema', fill: 'Llena el esquema', solve: 'Resuelve el esquema', check: 'Comprobar',
    continue: 'Continuar', unavailable: 'No pudimos comprobarlo. Intenta otra vez.',
    answer: 'Tu respuesta', story: 'Números de la historia', unknown: '?',
    schemas: { change: 'Cambio', group: 'Grupo', compare: 'Comparación', ratio: 'Razón' },
    slots: { start: 'Inicio', change: 'Cambio', result: 'Resultado', part: 'Parte', other: 'Otra parte', total: 'Total', larger: 'Mayor',
      smaller: 'Menor', difference: 'Diferencia', rate: 'Por uno', count: 'Cuántos' },
    shapes: { change: 'Un inicio y un cambio dan el resultado.', group: 'Dos partes forman un total.',
      compare: 'El mayor menos el menor es la diferencia.', ratio: 'Lo que vale uno, por cuántos, es el total.' } },
  'pt-BR': { reset: 'Recomeçar', back: 'Voltar', choose: 'Escolha o esquema', fill: 'Preencha o esquema', solve: 'Resolva o esquema', check: 'Conferir',
    continue: 'Continuar', unavailable: 'Não foi possível conferir. Tente de novo.',
    answer: 'Sua resposta', story: 'Números da história', unknown: '?',
    schemas: { change: 'Mudança', group: 'Grupo', compare: 'Comparação', ratio: 'Razão' },
    slots: { start: 'Início', change: 'Mudança', result: 'Resultado', part: 'Parte', other: 'Outra parte', total: 'Total', larger: 'Maior',
      smaller: 'Menor', difference: 'Diferença', rate: 'Por um', count: 'Quantos' },
    shapes: { change: 'Um início e uma mudança dão o resultado.', group: 'Duas partes formam um total.',
      compare: 'O maior menos o menor é a diferença.', ratio: 'O valor de um, vezes quantos, é o total.' } },
};

/** The M8 operator between slots, drawn only (the accessible name is the schema's shape sentence). */
const OPERATOR: Record<SchemaKind, readonly [string, string]> = { change: ['→', '='], group: ['+', '='], compare: ['−', '='], ratio: ['×', '='] };

export function schemaDiagramPilotDocument(locale: Locale): unknown {
  const content = {
    'en-US': { title: 'Name the money change', structure: 'Mia earned 24 coins and spent 9. Choose the problem schema.', slots: 'Put the story numbers in the matching slots.', answer: 'Use your filled schema. How many coins are left?', earned: 'Earned', spent: 'Spent', left: 'Left over', spoken: 'twenty-four minus nine equals fifteen' },
    'es-MX': { title: 'Nombra el cambio de dinero', structure: 'Mía ganó 24 monedas y gastó 9. Elige el esquema del problema.', slots: 'Coloca los números de la historia en los espacios correctos.', answer: 'Usa tu esquema. ¿Cuántas monedas quedan?', earned: 'Ganó', spent: 'Gastó', left: 'Queda', spoken: 'veinticuatro menos nueve es igual a quince' },
    'pt-BR': { title: 'Nomeie a mudança de dinheiro', structure: 'Mia ganhou 24 moedas e gastou 9. Escolha o esquema do problema.', slots: 'Coloque os números da história nos espaços correspondentes.', answer: 'Use seu esquema. Quantas moedas sobraram?', earned: 'Ganhou', spent: 'Gastou', left: 'Sobra', spoken: 'vinte e quatro menos nove é igual a quinze' },
  }[locale];
  const payload = { quantities: [{ id: 'earned', value: 24, label: content.earned }, { id: 'spent', value: 9, label: content.spent }], unknownLabel: content.left, spokenText: content.spoken };
  return { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'money-change', lesson_id: 'pilot-schema-diagram', version_id: 'rev-1', locale, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-money-change-schema'], adventure_scene_id: 'diorama-a', title: content.title, required_capabilities: ['visual.schema-diagram.v1', 'operation.build-slots.v1', 'operation.structure-check.v1', 'operation.number-input.v1'], segments: [{ id: 'schema-structure-01', type: 'math.schema-diagram.structure.v2', grading: 'server', prompt: content.structure, visual: { type: 'schema-diagram' }, payload }, { id: 'schema-slots-01', type: 'math.schema-diagram.slots.v2', grading: 'server', prompt: content.slots, visual: { type: 'schema-diagram' }, payload }, { id: 'schema-answer-01', type: 'math.schema-diagram.answer.v2', grading: 'server', prompt: content.answer, visual: { type: 'schema-diagram' }, payload }] };
}

export function SchemaDiagramBoard({ document, segment, onBack, onGrade, sequence }: { document: LessonClientDocument; segment: Segment; onBack: () => void; onGrade: (answer: Record<string, unknown>, segmentId: string) => Verdict | Promise<Verdict>; sequence?: LessonSequenceControl }) {
  const t = copy[document.locale], p = segment.payload;
  const name = useId();
  const [schema, setSchema] = useState<SchemaKind | null>(null);
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState('');
  const [verdict, setVerdict] = useState<'met' | 'review' | 'unavailable' | null>(null);
  const { pending, grade } = useSingleActiveGrade();
  const phase = segment.type === 'math.schema-diagram.structure.v2' ? 'structure' : segment.type === 'math.schema-diagram.slots.v2' ? 'slots' : 'answer';
  const phaseTitle = phase === 'structure' ? t.choose : phase === 'slots' ? t.fill : t.solve;
  const slotNames = schema ? SCHEMA_SLOTS[schema] as readonly SlotName[] : [];
  const slotsComplete = schema !== null && slotNames.every((slot) => typeof slots[slot] === 'string');
  const response = phase === 'structure' ? schema === null ? null : { schema }
    : phase === 'slots' ? slotsComplete ? { schema, slots: Object.fromEntries(slotNames.map((slot) => [slot, slots[slot]])) } : null
      : /^(0|[1-9]\d*)$/.test(answer) ? { value: answer } : null;
  // Bible 05 §3: Reset restores the authored start (no schema chosen, empty slots and answer) and clears the verdict.
  const pristine = schema === null && Object.keys(slots).length === 0 && answer === '' && verdict === null;
  const reset = () => { setSchema(null); setSlots({}); setAnswer(''); setVerdict(null); };
  const submit = () => { if (verdict === 'met') { sequence?.onAdvance(); return; } if (!response) return; grade(() => onGrade(response, segment.id), (value) => setVerdict(value === 'met' ? 'met' : 'review'), () => setVerdict('unavailable')); };
  const quantityText = (value: string | undefined) => value === 'unknown' ? p.unknownLabel : p.quantities.find((item) => item.id === value)?.label ?? t.unknown;
  const quantityValue = (value: string | undefined) => value === 'unknown' ? t.unknown : String(p.quantities.find((item) => item.id === value)?.value ?? t.unknown);
  const slotOf = (slot: SlotName) => ({ id: slot, label: t.slots[slot], value: phase === 'slots' ? quantityValue(slots[slot]) : t.unknown,
    ...(phase === 'slots' && slots[slot] ? { detail: quantityText(slots[slot]) } : {}) });
  // The shared Pizarrón slot row (B.7 one component set); the name states the schema's shape.
  const diagram = schema ? <SchemaSlotsVisual label={`${t.schemas[schema]}. ${t.shapes[schema]}`} schema={schema}
    slots={[slotOf(slotNames[0]!), slotOf(slotNames[1]!), slotOf(slotNames[2]!)]} operators={OPERATOR[schema]} /> : null;
  const change = (update: () => void) => { update(); setVerdict(null); };
  return <main className="lf-learning" data-surface="app" data-screen="schema-diagram"><div className="lf-learning-inner">
    <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="data">{sequence ? `${sequence.index + 1}/${sequence.total}` : ''}</span></header>
    <LessonStageSlot verdict={verdict} />
    <div className="lf-learning-content">
      <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div>
      <section className="lf-learning-board"><h2 data-copy-role="heading">{phaseTitle}</h2>
        <dl className="lf-schema-story" aria-label={t.story}>
          {p.quantities.map((item) => <div key={item.id}><dt data-copy-role="label">{item.label}</dt><dd data-copy-role="data">{item.value}</dd></div>)}
          <div><dt data-copy-role="label">{p.unknownLabel}</dt><dd data-copy-role="data">{phase === 'answer' && answer ? answer : t.unknown}</dd></div>
        </dl>
        {phase !== 'answer' ? diagram : null}
      </section>
      <div className="lf-learning-control-strip">
        <div className="lf-learning-control-bar"><Button size="sm" onClick={reset} disabled={pending || pristine}>{t.reset}</Button></div>
        {phase !== 'answer' ? <SegmentedControl legend={t.choose} legendHidden={phase === 'structure'} name={`${name}-schema`} disabled={pending} value={schema}
          onValueChange={(value) => change(() => { setSchema(value); setSlots({}); })} options={SCHEMA_KINDS.map((kind) => ({ value: kind, label: t.schemas[kind] }))} /> : null}
        {phase === 'slots' && schema ? slotNames.map((slot) => <SegmentedControl key={`${schema}-${slot}`} legend={t.slots[slot]} name={`${name}-${slot}`} disabled={pending}
          value={slots[slot] ?? null} onValueChange={(value) => change(() => setSlots((current) => ({ ...current, [slot]: value })))}
          options={[...p.quantities.map((item) => ({ value: item.id, label: `${item.label} ${item.value}` })), { value: 'unknown', label: p.unknownLabel }]} />) : null}
        {phase === 'answer' ? <TextField label={t.answer} inputMode="numeric" pattern="[0-9]*" autoComplete="off" disabled={pending} value={answer}
          onChange={(event) => change(() => setAnswer(event.target.value))} /> : null}
      </div>
      <footer className="lf-learning-foot"><LessonFeedback verdict={verdict}>{verdict === null ? null : verdictBannerText(document.locale, verdict, namedFeedback(document.locale, phase === 'structure' ? 'schema-structure' : phase === 'slots' ? 'schema-slots' : 'schema-answer'), segment.feedback)}</LessonFeedback>
        <div className="lf-learning-actions"><Button variant="accent" onClick={submit} disabled={pending || (verdict !== 'met' && response === null)}>{verdict === 'met' ? t.continue : t.check}</Button></div></footer>
    </div>
  </div></main>;
}
