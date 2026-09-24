import { useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import './learning.css';

type Segment = Extract<LessonClientSegment, { type: 'math.function-machine.v2' }>;
type Verdict = 'invalid' | 'met' | 'review';

const copy: Record<Locale, Record<string, string>> = {
  'en-US': { back: 'Back', board: 'Function machine', try: 'Try an input', run: 'Run', input: 'Input', output: 'Output', rule: 'What is the rule?', multiplier: 'Multiply by', offset: 'Then add', check: 'Check rule', continue: 'Continue', correct: 'Correct', retry: 'Try another rule.', unavailable: 'We could not check that. Try again.' },
  'es-MX': { back: 'Volver', board: 'Máquina de funciones', try: 'Prueba una entrada', run: 'Ejecutar', input: 'Entrada', output: 'Salida', rule: '¿Cuál es la regla?', multiplier: 'Multiplica por', offset: 'Luego suma', check: 'Comprobar regla', continue: 'Continuar', correct: 'Correcto', retry: 'Prueba otra regla.', unavailable: 'No pudimos comprobarlo. Intenta otra vez.' },
  'pt-BR': { back: 'Voltar', board: 'Máquina de funções', try: 'Teste uma entrada', run: 'Executar', input: 'Entrada', output: 'Saída', rule: 'Qual é a regra?', multiplier: 'Multiplique por', offset: 'Depois some', check: 'Conferir regra', continue: 'Continuar', correct: 'Correto', retry: 'Tente outra regra.', unavailable: 'Não foi possível conferir. Tente de novo.' },
};

export function FunctionMachineBoard({ document, segment, onBack, onGrade, sequence }: { document: LessonClientDocument; segment: Segment; onBack: () => void; onGrade: (answer: { multiplier: string; offset: string }, segmentId: string) => Verdict | Promise<Verdict>; sequence?: LessonSequenceControl }) {
  const t = copy[document.locale];
  const [selected, setSelected] = useState(segment.payload.examples[0]?.input ?? 0);
  const [ran, setRan] = useState(false);
  const [multiplier, setMultiplier] = useState('');
  const [offset, setOffset] = useState('');
  const [verdict, setVerdict] = useState<'met' | 'review' | 'unavailable' | null>(null);
  const { pending, grade } = useSingleActiveGrade();
  const example = segment.payload.examples.find((item) => item.input === selected);
  // A rule follows an observed result: learners cannot skip the public trial step.
  const valid = ran && /^(0|[1-9]\d*)$/.test(multiplier) && /^(0|[1-9]\d*)$/.test(offset);
  const submit = () => { if (verdict === 'met') { sequence?.onAdvance(); return; } if (!valid) return; grade(() => onGrade({ multiplier, offset }, segment.id), (result) => setVerdict(result === 'met' ? 'met' : 'review'), () => setVerdict('unavailable')); };

  return <main className="lf-learning" data-surface="app" data-screen="function-machine"><div className="lf-learning-inner">
    <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="data">{t.board}</span></header>
    <div className="lf-learning-content"><div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><p data-copy-role="prompt">{segment.prompt}</p></div>
      <section className="lf-learning-board" aria-labelledby="function-machine-title"><h2 id="function-machine-title" data-copy-role="heading">{t.board}</h2>
        <div className="lf-function-machine" role="img" aria-label={`${t.input}: ${selected}. ${t.output}: ${ran ? example?.output ?? '' : '—'}`}>
          <span className="lf-function-machine-value" data-copy-role="data">{selected}</span><span className="lf-function-machine-arrow" aria-hidden="true">→</span><span className="lf-function-machine-core" data-copy-role="label">f</span><span className="lf-function-machine-arrow" aria-hidden="true">→</span><span className="lf-function-machine-value" data-copy-role="data">{ran ? example?.output : '—'}</span>
        </div>
        <table className="lf-learning-table lf-function-machine-table" aria-label={t.board}><thead><tr><th scope="col" data-copy-role="label">{t.input}</th><th scope="col" data-copy-role="label">{t.output}</th></tr></thead><tbody>{segment.payload.examples.map((item) => <tr key={item.input}><th scope="row" data-copy-role="data" data-label={t.input}>{item.input}</th><td data-copy-role="data" data-label={t.output}>{ran && selected === item.input ? item.output : '—'}</td></tr>)}</tbody></table>
      </section>
      <div className="lf-learning-control-strip"><div className="lf-function-machine-try" role="group" aria-label={t.try}>{segment.payload.examples.map((item) => <button type="button" key={item.input} disabled={pending} aria-pressed={selected === item.input} onClick={() => { setSelected(item.input); setRan(false); }}>{item.input}</button>)}<Button variant="accent" disabled={pending} onClick={() => setRan(true)}>{t.run}</Button></div>
        <div className="lf-function-machine-rule"><h2 data-copy-role="heading">{t.rule}</h2><label data-copy-role="label">{t.multiplier}<input inputMode="numeric" disabled={pending} value={multiplier} onChange={(event) => { setMultiplier(event.target.value); setVerdict(null); }} /></label><label data-copy-role="label">{t.offset}<input inputMode="numeric" disabled={pending} value={offset} onChange={(event) => { setOffset(event.target.value); setVerdict(null); }} /></label></div>
      </div>
      <footer className="lf-learning-foot"><div role="status" className={verdict ? `lf-learning-feedback lf-learning-feedback--${verdict}` : 'lf-learning-feedback'} data-copy-role="feedback">{verdict === 'met' ? t.correct : verdict === 'review' ? t.retry : verdict === 'unavailable' ? t.unavailable : null}</div><div className="lf-learning-actions"><Button variant="accent" disabled={pending || !valid} onClick={submit}>{verdict === 'met' && sequence ? t.continue : t.check}</Button></div></footer>
    </div>
  </div></main>;
}

export function functionMachinePilotDocument(locale: Locale): unknown {
  const title = { 'en-US': 'Find the savings rule', 'es-MX': 'Encuentra la regla de ahorro', 'pt-BR': 'Encontre a regra de poupança' }[locale];
  const prompt = { 'en-US': 'Try each week, then describe the rule.', 'es-MX': 'Prueba cada semana y describe la regla.', 'pt-BR': 'Teste cada semana e descreva a regra.' }[locale];
  return { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'savings-rules', lesson_id: 'pilot-function-machine', version_id: 'rev-001', locale, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-savings-function'], adventure_scene_id: 'diorama-a', title, required_capabilities: ['visual.function-machine.v1', 'operation.try-input.v1', 'operation.guess-rule.v1', 'operation.held-out-check.v1'], segments: [{ id: 'function-machine-01', type: 'math.function-machine.v2', grading: 'server', prompt, visual: { type: 'function-machine' }, payload: { examples: [{ input: 1, output: 15 }, { input: 2, output: 20 }, { input: 3, output: 25 }], multiplierMaximum: 9, offsetMaximum: 50 } }] };
}
