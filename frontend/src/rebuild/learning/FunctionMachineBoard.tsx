import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, SegmentedControl } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import './learning.css';
import { LessonStageSlot } from './lessonStage';
import { NumberAnswer, readNumberAnswer, SegmentPrompt, verdictBannerText } from './segmentKit';
import { namedFeedback } from './namedFeedback';
import { FunctionMachineVisual, MathExpression } from './pizarron';

type Segment = Extract<LessonClientSegment, { type: 'math.function-machine.v2' }>;
type Verdict = 'invalid' | 'met' | 'review';

type Copy = Record<'reset' | 'back' | 'board' | 'try' | 'run' | 'input' | 'output' | 'rule' | 'multiplier' | 'offset' | 'check' | 'continue' | 'unavailable', string> & { spoken: (a: string, b: string) => string };
const copy: Record<Locale, Copy> = {
  'en-US': { reset: 'Reset', back: 'Back', board: 'Function machine', try: 'Try an input', run: 'Run', input: 'Input', output: 'Output', rule: 'What is the rule?', multiplier: 'Multiply by', offset: 'Then add', check: 'Check rule', continue: 'Continue', unavailable: 'We could not check that. Try again.', spoken: (a, b) => `f of x equals ${a} times x plus ${b}` },
  'es-MX': { reset: 'Restablecer', back: 'Volver', board: 'Máquina de funciones', try: 'Prueba una entrada', run: 'Ejecutar', input: 'Entrada', output: 'Salida', rule: '¿Cuál es la regla?', multiplier: 'Multiplica por', offset: 'Luego suma', check: 'Comprobar regla', continue: 'Continuar', unavailable: 'No pudimos comprobarlo. Intenta otra vez.', spoken: (a, b) => `f de x es igual a ${a} por x más ${b}` },
  'pt-BR': { reset: 'Recomeçar', back: 'Voltar', board: 'Máquina de funções', try: 'Teste uma entrada', run: 'Executar', input: 'Entrada', output: 'Saída', rule: 'Qual é a regra?', multiplier: 'Multiplique por', offset: 'Depois some', check: 'Conferir regra', continue: 'Continuar', unavailable: 'Não foi possível conferir. Tente de novo.', spoken: (a, b) => `f de x é igual a ${a} vezes x mais ${b}` },
};

export function FunctionMachineBoard({ document, segment, onBack, onGrade, sequence }: { document: LessonClientDocument; segment: Segment; onBack: () => void; onGrade: (answer: { multiplier: string; offset: string }, segmentId: string) => Verdict | Promise<Verdict>; sequence?: LessonSequenceControl }) {
  const t = copy[document.locale];
  const tryName = useId();
  const initialInput = segment.payload.examples[0]?.input ?? 0;
  const [selected, setSelected] = useState(initialInput);
  const [ran, setRan] = useState(false);
  const [multiplier, setMultiplier] = useState('');
  const [offset, setOffset] = useState('');
  const [verdict, setVerdict] = useState<'met' | 'review' | 'unavailable' | null>(null);
  const { pending, grade } = useSingleActiveGrade();
  const example = segment.payload.examples.find((item) => item.input === selected);
  // A rule follows an observed result: learners cannot skip the public trial step.
  // Bible 05 §5 / Appendix P Part 5 (GAP-FIX-R7): each part of the rule is read for the lesson's locale and sent as its
  // canonical whole number, within the payload's public bounds (the canonical scorer refuses past them).
  const multiplierDomain = { whole: true, min: 1, max: segment.payload.multiplierMaximum };
  const offsetDomain = { whole: true, max: segment.payload.offsetMaximum };
  const typedMultiplier = readNumberAnswer(multiplier, document.locale, multiplierDomain).canonical;
  const typedOffset = readNumberAnswer(offset, document.locale, offsetDomain).canonical;
  const valid = ran && typedMultiplier !== null && typedOffset !== null;
  // Bible 05 §3: Reset restores the authored start (the first input, not yet run, an empty rule) and clears the verdict.
  const pristine = selected === initialInput && !ran && multiplier === '' && offset === '' && verdict === null;
  const reset = () => { setSelected(initialInput); setRan(false); setMultiplier(''); setOffset(''); setVerdict(null); };
  const submit = () => { if (verdict === 'met') { sequence?.onAdvance(); return; } if (!valid || typedMultiplier === null || typedOffset === null) return; grade(() => onGrade({ multiplier: typedMultiplier, offset: typedOffset }, segment.id), (result) => setVerdict(result === 'met' ? 'met' : 'review'), () => setVerdict('unavailable')); };

  return <main className="lf-learning" data-surface="app" data-screen="function-machine"><div className="lf-learning-inner">
    <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="data">{t.board}</span></header><LessonStageSlot verdict={verdict} />
    <div className="lf-learning-content"><div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><SegmentPrompt segment={segment} locale={document.locale} /></div>
      <section className="lf-learning-board" aria-labelledby="function-machine-title"><h2 id="function-machine-title" data-copy-role="heading">{t.board}</h2>
        <FunctionMachineVisual label={`${t.input}: ${selected}. ${t.output}: ${ran ? example?.output ?? '' : '?'}`}
          inputText={String(selected)} ruleText="f" outputText={ran ? String(example?.output ?? '') : '?'} />
        <table className="lf-learning-table lf-function-machine-table" aria-label={t.board}><thead><tr><th scope="col" data-copy-role="label">{t.input}</th><th scope="col" data-copy-role="label">{t.output}</th></tr></thead><tbody>{segment.payload.examples.map((item) => <tr key={item.input}><th scope="row" data-copy-role="data" data-label={t.input}>{item.input}</th><td data-copy-role="data" data-label={t.output}>{ran && selected === item.input ? item.output : '?'}</td></tr>)}</tbody></table>
      </section>
      <div className="lf-learning-control-strip"><div className="lf-learning-control-bar"><Button size="sm" onClick={reset} disabled={pending || pristine}>{t.reset}</Button></div><div className="lf-function-machine-try"><SegmentedControl size="compact" legend={t.try} legendHidden name={`${tryName}-input`} disabled={pending} value={String(selected)}
          onValueChange={(value) => { setSelected(Number(value)); setRan(false); }} options={segment.payload.examples.map((item) => ({ value: String(item.input), label: String(item.input) }))} />
          <Button variant="accent" disabled={pending} onClick={() => setRan(true)}>{t.run}</Button></div>
        <div className="lf-function-machine-rule"><h2 data-copy-role="heading">{t.rule}</h2><NumberAnswer label={t.multiplier} locale={document.locale} {...multiplierDomain} disabled={pending} value={multiplier} onTextChange={(text) => { setMultiplier(text); setVerdict(null); }} /><NumberAnswer label={t.offset} locale={document.locale} {...offsetDomain} disabled={pending} value={offset} onTextChange={(text) => { setOffset(text); setVerdict(null); }} />
          {/* Bible 05 §5 (GAP-FIX-R2): a document that declares notation writes the learner's rule with KaTeX, digits only. */}
          {segment.payload.notation && typedMultiplier !== null && typedOffset !== null
            ? <MathExpression tex={`f(x) = ${typedMultiplier} \\times x + ${typedOffset}`} spokenText={t.spoken(typedMultiplier, typedOffset)} fallback={`f(x) = ${typedMultiplier} × x + ${typedOffset}`} locale={document.locale} block /> : null}</div>
      </div>
      <footer className="lf-learning-foot"><LessonFeedback verdict={verdict}>{verdict === null ? null : verdictBannerText(document.locale, verdict, namedFeedback(document.locale, 'function-machine'), segment.feedback)}</LessonFeedback><div className="lf-learning-actions"><Button variant="accent" disabled={pending || !valid} onClick={submit}>{verdict === 'met' && sequence ? t.continue : t.check}</Button></div></footer>
    </div>
  </div></main>;
}

export function functionMachinePilotDocument(locale: Locale): unknown {
  const title = { 'en-US': 'Find the savings rule', 'es-MX': 'Encuentra la regla de ahorro', 'pt-BR': 'Encontre a regra de poupança' }[locale];
  const prompt = { 'en-US': 'Try each week, then describe the rule.', 'es-MX': 'Prueba cada semana y describe la regla.', 'pt-BR': 'Teste cada semana e descreva a regra.' }[locale];
  return { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'savings-rules', lesson_id: 'pilot-function-machine', version_id: 'rev-001', locale, age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-savings-function'], adventure_scene_id: 'diorama-a', title, required_capabilities: ['visual.function-machine.v1', 'operation.try-input.v1', 'operation.guess-rule.v1', 'operation.held-out-check.v1'], segments: [{ id: 'function-machine-01', type: 'math.function-machine.v2', grading: 'server', prompt, visual: { type: 'function-machine' }, payload: { examples: [{ input: 1, output: 15 }, { input: 2, output: 20 }, { input: 3, output: 25 }], multiplierMaximum: 9, offsetMaximum: 50 } }] };
}
