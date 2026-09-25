import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import './learning.css';
import './lessonTransportState.css';

export type LessonTransportState = 'opening' | 'offline' | 'load-error' | 'placement';

const copy: Record<Locale, Record<LessonTransportState, {
  heading: string; body: string; retry?: string; back: string;
}>> = {
  'en-US': {
    opening: { heading: 'Opening lesson', body: 'Getting your lesson ready.', back: 'Go back' },
    offline: { heading: 'Connection lost', body: 'Reconnect, then try again.', retry: 'Try again', back: 'Go back' },
    'load-error': { heading: 'Lesson unavailable', body: 'We could not open it. Try again.', retry: 'Try again', back: 'Go back' },
    placement: { heading: 'Placement comes first', body: 'Open this course from your learning path.', back: 'Go back' },
  },
  'es-MX': {
    opening: { heading: 'Abriendo la lección', body: 'Preparamos tu lección.', back: 'Volver' },
    offline: { heading: 'Sin conexión', body: 'Conéctate e intenta de nuevo.', retry: 'Reintentar', back: 'Volver' },
    'load-error': { heading: 'Lección no disponible', body: 'No pudimos abrirla. Inténtalo de nuevo.', retry: 'Reintentar', back: 'Volver' },
    placement: { heading: 'Primero va la ubicación', body: 'Abre este curso desde tu ruta de aprendizaje.', back: 'Volver' },
  },
  'pt-BR': {
    opening: { heading: 'Abrindo a lição', body: 'Preparando sua lição.', back: 'Voltar' },
    offline: { heading: 'Sem conexão', body: 'Conecte-se e tente de novo.', retry: 'Tentar de novo', back: 'Voltar' },
    'load-error': { heading: 'Lição indisponível', body: 'Não foi possível abrir. Tente de novo.', retry: 'Tentar de novo', back: 'Voltar' },
    placement: { heading: 'A avaliação vem primeiro', body: 'Abra este curso pela sua trilha de aprendizagem.', back: 'Voltar' },
  },
};

/** Reusable presentation only; the host owns network state and retry policy. */
export function LessonTransportStateView({ state, locale, onBack, onRetry }: {
  state: LessonTransportState; locale: Locale; onBack: () => void; onRetry?: () => void;
}) {
  const t = copy[locale][state];
  return <main className="lf-learning" data-surface="app" data-screen={`lesson-${state}`}
    aria-busy={state === 'opening'}>
    <div className="lf-learning-inner lf-transport-state-inner">
      <div className="lf-transport-state-content">
        <h1 data-copy-role="heading">{t.heading}</h1>
        <p data-copy-role="body">{t.body}</p>
        {/* Indeterminate and still: a loading state is not one of the three idle loops (02 §9.4). */}
        {state === 'opening' ? <div className="lf-transport-state-progress" role="progressbar"
          aria-label={t.heading} /> : null}
      </div>
      <div className="lf-transport-state-actions">
        {t.retry && onRetry ? <Button variant="accent" onClick={onRetry}>{t.retry}</Button> : null}
        <Button onClick={onBack}>{t.back}</Button>
      </div>
    </div>
  </main>;
}
