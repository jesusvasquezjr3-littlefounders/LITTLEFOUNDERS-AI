import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, SegmentedControl, TextField } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import { type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { type LessonSequenceControl } from './lessonSequence';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import './learning.css';
import { LessonStageSlot } from './lessonStage';
import { SegmentPrompt } from './segmentKit';

type Segment = Extract<LessonClientSegment, { type: 'math.schema-diagram.structure.v2' | 'math.schema-diagram.slots.v2' | 'math.schema-diagram.answer.v2' }>;
type Verdict = 'invalid' | 'met' | 'review';

const copy: Record<Locale, { reset: string; back: string; choose: string; fill: string; solve: string; change: string; compare: string; income: string; spending: string; remaining: string; check: string; continue: string; correct: string; retry: string; unavailable: string; answer: string; diagram: string }> = {
  'en-US': { reset: 'Reset', back: 'Back', choose: 'Choose the schema', fill: 'Fill the schema', solve: 'Solve the schema', change: 'Change', compare: 'Compare', income: 'Income', spending: 'Spending', remaining: 'Left over', check: 'Check', continue: 'Continue', correct: 'Correct', retry: 'Try a different answer.', unavailable: 'We could not check that. Try again.', answer: 'How many coins are left?', diagram: 'Income minus spending leaves the remaining coins.' },
  'es-MX': { reset: 'Restablecer', back: 'Volver', choose: 'Elige el esquema', fill: 'Llena el esquema', solve: 'Resuelve el esquema', change: 'Cambio', compare: 'Comparación', income: 'Ingreso', spending: 'Gasto', remaining: 'Queda', check: 'Comprobar', continue: 'Continuar', correct: 'Correcto', retry: 'Prueba otra respuesta.', unavailable: 'No pudimos comprobarlo. Intenta otra vez.', answer: '¿Cuántas monedas quedan?', diagram: 'El ingreso menos el gasto deja las monedas restantes.' },
  'pt-BR': { reset: 'Recomeçar', back: 'Voltar', choose: 'Escolha o esquema', fill: 'Preencha o esquema', solve: 'Resolva o esquema', change: 'Mudança', compare: 'Comparação', income: 'Entrada', spending: 'Gasto', remaining: 'Sobra', check: 'Conferir', continue: 'Continuar', correct: 'Correto', retry: 'Tente outra resposta.', unavailable: 'Não foi possível conferir. Tente de novo.', answer: 'Quantas moedas sobraram?', diagram: 'A entrada menos o gasto deixa as moedas restantes.' },
};

export function schemaDiagramPilotDocument(locale: Locale): unknown {
  const content = {
    'en-US': { title: 'Name the money change', structure: 'Mia earned 24 coins and spent 9. Choose the problem schema.', slots: 'Put the story numbers in the matching slots.', answer: 'Use your filled schema. How many coins are left?', income: 'Earned', spending: 'Spent', remaining: 'Left over', spoken: 'twenty-four minus nine equals fifteen' },
    'es-MX': { title: 'Nombra el cambio de dinero', structure: 'Mía ganó 24 monedas y gastó 9. Elige el esquema del problema.', slots: 'Coloca los números de la historia en los espacios correctos.', answer: 'Usa tu esquema. ¿Cuántas monedas quedan?', income: 'Ganó', spending: 'Gastó', remaining: 'Queda', spoken: 'veinticuatro menos nueve es igual a quince' },
    'pt-BR': { title: 'Nomeie a mudança de dinheiro', structure: 'Mia ganhou 24 moedas e gastou 9. Escolha o esquema do problema.', slots: 'Coloque os números da história nos espaços correspondentes.', answer: 'Use seu esquema. Quantas moedas sobraram?', income: 'Ganhou', spending: 'Gastou', remaining: 'Sobra', spoken: 'vinte e quatro menos nove é igual a quinze' },
  }[locale];
  const payload = { income: 24, spending: 9, incomeLabel: content.income, spendingLabel: content.spending, remainingLabel: content.remaining, spokenText: content.spoken };
  return { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'money-change', lesson_id: 'pilot-schema-diagram', version_id: 'rev-1', locale, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-money-change-schema'], adventure_scene_id: 'diorama-a', title: content.title, required_capabilities: ['visual.schema-diagram.v1', 'operation.build-slots.v1', 'operation.structure-check.v1', 'operation.number-input.v1'], segments: [{ id: 'schema-structure-01', type: 'math.schema-diagram.structure.v2', grading: 'server', prompt: content.structure, visual: { type: 'schema-diagram' }, payload }, { id: 'schema-slots-01', type: 'math.schema-diagram.slots.v2', grading: 'server', prompt: content.slots, visual: { type: 'schema-diagram' }, payload }, { id: 'schema-answer-01', type: 'math.schema-diagram.answer.v2', grading: 'server', prompt: content.answer, visual: { type: 'schema-diagram' }, payload }] };
}

export function SchemaDiagramBoard({ document, segment, onBack, onGrade, sequence }: { document: LessonClientDocument; segment: Segment; onBack: () => void; onGrade: (answer: Record<string, unknown>, segmentId: string) => Verdict | Promise<Verdict>; sequence?: LessonSequenceControl }) {
  const t = copy[document.locale], p = segment.payload;
  const schemaName = useId();
  const [schema, setSchema] = useState<'change' | 'compare' | null>(null);
  const [income, setIncome] = useState(''); const [spending, setSpending] = useState(''); const [answer, setAnswer] = useState('');
  const [verdict, setVerdict] = useState<'met' | 'review' | 'unavailable' | null>(null);
  const { pending, grade } = useSingleActiveGrade();
  const phase = segment.type === 'math.schema-diagram.structure.v2' ? 'structure' : segment.type === 'math.schema-diagram.slots.v2' ? 'slots' : 'answer';
  const phaseTitle = phase === 'structure' ? t.choose : phase === 'slots' ? t.fill : t.solve;
  const response = phase === 'structure' ? schema === null ? null : { schema } : phase === 'slots' ? { income, spending } : { value: answer };
  const ready = response !== null && (phase !== 'slots' || /^(0|[1-9]\d*)$/.test(income) && /^(0|[1-9]\d*)$/.test(spending)) && (phase !== 'answer' || /^(0|[1-9]\d*)$/.test(answer));
  // Bible 05 §3: Reset restores the authored start (no schema chosen, empty slots and answer) and clears the verdict.
  const pristine = schema === null && income === '' && spending === '' && answer === '' && verdict === null;
  const reset = () => { setSchema(null); setIncome(''); setSpending(''); setAnswer(''); setVerdict(null); };
  const submit = () => { if (verdict === 'met') { sequence?.onAdvance(); return; } if (!response) return; grade(() => onGrade(response, segment.id), (value) => setVerdict(value === 'met' ? 'met' : 'review'), () => setVerdict('unavailable')); };
  const slot = (label: string, value: string, setValue: (value: string) => void, editable: boolean) => <div className={editable ? 'lf-schema-slot lf-schema-slot--editable' : 'lf-schema-slot'}>{editable ? <TextField label={label} inputMode="numeric" pattern="[0-9]*" autoComplete="off" disabled={pending} value={value} onChange={(event) => { setValue(event.target.value); setVerdict(null); }} /> : <><span data-copy-role="label">{label}</span><strong data-copy-role="data">{value || '?'}</strong></>}</div>;
  return <main className="lf-learning" data-surface="app" data-screen="schema-diagram"><div className="lf-learning-inner"><header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="data">{sequence ? `${sequence.index + 1}/${sequence.total}` : ''}</span></header><LessonStageSlot verdict={verdict} /><div className="lf-learning-content"><div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div><section className="lf-learning-board"><h2 data-copy-role="heading">{phaseTitle}</h2><div className="lf-schema-diagram" role={phase === 'slots' ? undefined : 'img'} aria-label={phase === 'slots' ? undefined : t.diagram}>{slot(p.incomeLabel, phase === 'slots' ? income : String(p.income), setIncome, phase === 'slots')}{slot(p.spendingLabel, phase === 'slots' ? spending : String(p.spending), setSpending, phase === 'slots')}<div className="lf-schema-operator" aria-hidden="true">−</div><div className="lf-schema-arrow" aria-hidden="true">↓</div>{slot(p.remainingLabel, phase === 'answer' ? answer : '?', setAnswer, false)}</div></section><div className="lf-learning-control-strip"><div className="lf-learning-control-bar"><Button size="sm" onClick={reset} disabled={pending || pristine}>{t.reset}</Button></div>{phase === 'structure' ? <SegmentedControl legend={t.choose} legendHidden name={`${schemaName}-schema`} disabled={pending} value={schema}
          onValueChange={(value) => { setSchema(value); setVerdict(null); }} options={[{ value: 'change', label: t.change }, { value: 'compare', label: t.compare }]} /> : phase === 'answer' ? <TextField label={t.answer} inputMode="numeric" pattern="[0-9]*" autoComplete="off" disabled={pending} value={answer} onChange={(event) => { setAnswer(event.target.value); setVerdict(null); }} /> : null}</div><footer className="lf-learning-foot"><LessonFeedback verdict={verdict}>{verdict === 'met' ? t.correct : verdict === 'review' ? t.retry : verdict === 'unavailable' ? t.unavailable : null}</LessonFeedback><div className="lf-learning-actions"><Button variant="accent" onClick={submit} disabled={pending || !ready}>{verdict === 'met' ? t.continue : t.check}</Button></div></footer></div></div></main>;
}
