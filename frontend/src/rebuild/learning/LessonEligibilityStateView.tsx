import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import './learning.css';

export type LessonEligibilityState = 'required' | 'restricted' | 'unavailable';

const copy: Record<Locale, Record<LessonEligibilityState, { heading: string; body: string; back: string }>> = {
  'en-US': {
    required: { heading: 'We need your age details', body: 'Review your account, then try this lesson again.', back: 'Go back' },
    restricted: { heading: 'This lesson is for later', body: 'Choose another lesson for now.', back: 'Go back' },
    unavailable: { heading: 'This lesson is not ready', body: 'Choose another lesson for now.', back: 'Go back' },
  },
  'es-MX': {
    required: { heading: 'Necesitamos tus datos de edad', body: 'Revisa tu cuenta e intenta esta lección de nuevo.', back: 'Volver' },
    restricted: { heading: 'Esta lección aún no es para ti', body: 'Elige otra lección por ahora.', back: 'Volver' },
    unavailable: { heading: 'Esta lección aún no está lista', body: 'Elige otra lección por ahora.', back: 'Volver' },
  },
  'pt-BR': {
    required: { heading: 'Precisamos da sua informação de idade', body: 'Revise sua conta e tente esta lição de novo.', back: 'Voltar' },
    restricted: { heading: 'Esta lição ainda não é para você', body: 'Escolha outra lição por enquanto.', back: 'Voltar' },
    unavailable: { heading: 'Esta lição ainda não está pronta', body: 'Escolha outra lição por enquanto.', back: 'Voltar' },
  },
};

/** A task-scoped refusal with no age value, date, blame or legacy UI. */
export function LessonEligibilityStateView({ state, locale, onBack }: {
  state: LessonEligibilityState;
  locale: Locale;
  onBack: () => void;
}) {
  const t = copy[locale][state];
  return <main className="lf-learning" data-surface="app" data-screen={`lesson-eligibility-${state}`}>
    <div className="lf-learning-inner lf-learning-state">
      <h1 className="lf-learning-unavailable" data-copy-role="heading">{t.heading}</h1>
      <p data-copy-role="body">{t.body}</p>
      <Button onClick={onBack}>{t.back}</Button>
    </div>
  </main>;
}
