import { useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { AnswerChoice, Button, InlineNotice } from '../design/controls';
import { LessonFeedback } from './LessonFeedback';
import type { LessonClientDocument, LessonClientSegment } from './lessonDocument';
import type { LessonSequenceControl } from './lessonSequence';
import { useSingleActiveGrade } from './useSingleActiveGrade';
import './learning.css';
import './decisionReasons.css';
import { LessonStageSlot } from './lessonStage';

/*
 * B.12 (Law 4, S05.3d): decide, then say why. The learner picks a decision
 * and the reason behind it; Core grades both from one signed attempt. The
 * decision decides completion. The reason becomes a separate judgment quality
 * that never changes the score. The browser never sees which choice is
 * acceptable or how a reason is judged: both live in Core's private answer
 * key, so this board only renders what Core returns.
 */

type Segment = Extract<LessonClientSegment, { type: 'reasoning.decide-justify.v2' }>;
export type JudgmentQuality = 'sound' | 'partial' | 'unsupported';
export type ReasoningGrade = { verdict: 'invalid' | 'met' | 'review'; judgment?: JudgmentQuality };

export const decisionReasonsCopy: Record<Locale, {
  back: string; board: string; choice: string; check: string; continue: string; met: string; review: string;
  sound: string; partial: string; unsupported: string; unavailable: string;
}> = {
  'en-US': { back: 'Back', board: 'Decide and explain', choice: 'Your choice', check: 'Check', continue: 'Continue',
    met: 'That choice works.', review: 'Look again at what matters most.',
    sound: 'Your reason explains it well.', partial: 'Your reason explains part of it.',
    unsupported: 'Try a reason that explains your choice.', unavailable: 'We could not check that. Try again.' },
  'es-MX': { back: 'Volver', board: 'Decide y explica', choice: 'Tu decisión', check: 'Comprobar', continue: 'Continuar',
    met: 'Esa decisión funciona.', review: 'Mira otra vez qué importa más.',
    sound: 'Tu razón lo explica bien.', partial: 'Tu razón explica una parte.',
    unsupported: 'Prueba una razón que explique tu decisión.', unavailable: 'No pudimos comprobarlo. Intenta otra vez.' },
  'pt-BR': { back: 'Voltar', board: 'Decida e explique', choice: 'Sua escolha', check: 'Conferir', continue: 'Continuar',
    met: 'Essa escolha funciona.', review: 'Veja de novo o que importa mais.',
    sound: 'Seu motivo explica bem.', partial: 'Seu motivo explica uma parte.',
    unsupported: 'Tente um motivo que explique sua escolha.', unavailable: 'Não foi possível conferir. Tente de novo.' },
};

export function DecisionReasonsBoard({ document, segment, onBack, onGrade, sequence }: {
  document: LessonClientDocument; segment: Segment; onBack: () => void;
  onGrade: (answer: { choice: string; reason: string }, segmentId: string) => ReasoningGrade | Promise<ReasoningGrade>;
  sequence?: LessonSequenceControl;
}) {
  const t = decisionReasonsCopy[document.locale];
  const [choice, setChoice] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<{ verdict: 'met' | 'review'; judgment?: JudgmentQuality } | 'unavailable' | null>(null);
  const { pending, grade } = useSingleActiveGrade();
  const met = result !== null && result !== 'unavailable' && result.verdict === 'met';
  const locked = pending || met;

  const submit = () => {
    if (met) { sequence?.onAdvance(); return; }
    if (!choice || !reason) return;
    grade(() => onGrade({ choice, reason }, segment.id), (graded) => {
      if (graded.verdict === 'invalid') { setResult('unavailable'); return; }
      setResult({ verdict: graded.verdict, ...(graded.judgment ? { judgment: graded.judgment } : {}) });
    }, () => setResult('unavailable'));
  };
  const pick = (setter: (id: string) => void, id: string) => { setter(id); setResult(null); };

  return <main className="lf-learning lf-learning--reasoning" data-surface="app" data-screen="decision-reasons"><div className="lf-learning-inner">
    <header className="lf-learning-top"><Button onClick={onBack}>{t.back}</Button><span data-copy-role="data">{t.board}</span></header><LessonStageSlot />
    <div className="lf-learning-content">
      <div className="lf-learning-intro"><h1 data-copy-role="heading">{document.title}</h1><p data-copy-role="prompt">{segment.prompt}</p></div>
      <section className="lf-learning-board lf-reasoning-board" aria-labelledby="reasoning-choice-title">
        <h2 id="reasoning-choice-title" data-copy-role="heading">{t.choice}</h2>
        <div className="lf-reasoning-options" role="group" aria-labelledby="reasoning-choice-title">
          {segment.payload.choices.map((option) => <AnswerChoice key={option.id} label={option.label} selected={choice === option.id} disabled={locked}
            verdict={choice === option.id && result !== null && result !== 'unavailable' ? (result.verdict === 'met' ? 'correct' : 'retry') : null}
            onSelect={() => pick(setChoice, option.id)} />)}
        </div>
      </section>
      {/* Decide first, then say why: the reasons appear once a decision is picked (also keeps the youngest first view short). */}
      {choice === null ? null : <section className="lf-learning-control-strip lf-reasoning-board" aria-labelledby="reasoning-reason-title">
        <h2 id="reasoning-reason-title" data-copy-role="prompt">{segment.payload.reasonPrompt}</h2>
        <div className="lf-reasoning-options" role="group" aria-labelledby="reasoning-reason-title">
          {/* The reason is judged apart from the decision and never marked right or wrong on the option itself (B.12). */}
          {segment.payload.reasons.map((option) => <AnswerChoice key={option.id} label={option.label} selected={reason === option.id} disabled={locked}
            onSelect={() => pick(setReason, option.id)} />)}
        </div>
      </section>}
      <footer className="lf-learning-foot">
        {/* Two lines: the decision's verdict on the shared feedback row, then the reason's quality, which never changes the score. */}
        <LessonFeedback verdict={result === null ? null : result === 'unavailable' ? 'unavailable' : result.verdict}>
          {result === null ? null : result === 'unavailable' ? t.unavailable : result.verdict === 'met' ? t.met : t.review}</LessonFeedback>
        {result !== null && result !== 'unavailable' && result.judgment ? <div className="lf-reasoning-judgment" data-judgment={result.judgment}>
          <InlineNotice tone={result.judgment === 'sound' ? 'success' : 'info'} live>{t[result.judgment]}</InlineNotice></div> : null}
        <div className="lf-learning-actions"><Button variant="accent" disabled={pending || (!met && (!choice || !reason))} onClick={submit}>
          {met && sequence ? t.continue : t.check}</Button></div>
      </footer>
    </div>
  </div></main>;
}

/** Preview-only pilot. The private rubric for it lives in the preview grader, never in the document. */
export function decideJustifyPilotDocument(locale: Locale, ageBand: AgeBand): unknown {
  const text = {
    'en-US': { title: 'Decide and say why', prompt: 'You have 12 coins. A kite costs 20.', choices: ['Save 4 coins', 'Spend all now'],
      reasonPrompt: 'Why is that a good choice?', reasons: ['It gets me closer', 'It feels good now', 'I just picked one'] },
    'es-MX': { title: 'Decide y di por qué', prompt: 'Tienes 12 monedas. Un papalote cuesta 20.', choices: ['Guardar 4 monedas', 'Gastar todo ahora'],
      reasonPrompt: '¿Por qué es buena decisión?', reasons: ['Me acerca a la meta', 'Se siente bien ahora', 'Solo elegí una'] },
    'pt-BR': { title: 'Decida e diga por quê', prompt: 'Você tem 12 moedas. Uma pipa custa 20.', choices: ['Guardar 4 moedas', 'Gastar tudo agora'],
      reasonPrompt: 'Por que é uma boa escolha?', reasons: ['Me deixa mais perto', 'É bom agora', 'Só escolhi uma'] },
  }[locale];
  const eligibility = ageBand === '6-9' ? { minimum_age: 6, maximum_age: 9 } : ageBand === '10-12' ? { minimum_age: 10, maximum_age: 12 }
    : ageBand === '13-17' ? { minimum_age: 13, maximum_age: 17 } : { minimum_age: 18, maximum_age: 119 };
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `financial-${ageBand}`, chapter_id: 'saving-choices',
    lesson_id: 'pilot-decide-justify', version_id: 'rev-001', locale, age_band: ageBand, eligibility,
    knowledge_component_ids: ['kc-saving-plan'], adventure_scene_id: 'diorama-a', title: text.title,
    required_capabilities: ['visual.decision-card.v1', 'operation.choose-option.v1', 'operation.justify-choice.v1'],
    segments: [{ id: 'decide-01', type: 'reasoning.decide-justify.v2', grading: 'server', prompt: text.prompt, visual: { type: 'decision-reasons' },
      payload: {
        choices: [{ id: 'save-first', label: text.choices[0] }, { id: 'spend-all', label: text.choices[1] }],
        reasonPrompt: text.reasonPrompt,
        reasons: [{ id: 'reason-goal', label: text.reasons[0] }, { id: 'reason-feel', label: text.reasons[1] }, { id: 'reason-lucky', label: text.reasons[2] }],
      } }],
  };
}

/** The preview's private rubric (Core keeps the real one in the answer key). */
export const DECIDE_JUSTIFY_PILOT_RUBRIC = {
  acceptableChoiceIds: ['save-first'],
  reasonQuality: { 'reason-goal': 'sound', 'reason-feel': 'partial', 'reason-lucky': 'unsupported' },
} as const;
