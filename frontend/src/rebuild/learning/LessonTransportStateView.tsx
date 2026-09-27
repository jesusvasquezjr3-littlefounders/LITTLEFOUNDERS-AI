import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import './learning.css';
import './lessonTransportState.css';

/*
 * W2L.3 adds Core's lesson refusals that no retry can change, each said
 * plainly with the way back (B.26: task-scoped, no blame): a lesson the path
 * has not reached (`LESSON_LOCKED`), a course whose prerequisite is not done
 * (`COURSE_PREREQUISITE_REQUIRED`, B.2) and a lesson that does not exist.
 */
export type LessonTransportState = 'opening' | 'offline' | 'load-error' | 'placement' | 'locked' | 'prerequisite' | 'not-found';

const copy: Record<Locale, Record<LessonTransportState, {
  heading: string; body: string; retry?: string; back: string;
}>> = {
  'en-US': {
    opening: { heading: 'Opening lesson', body: 'Getting your lesson ready.', back: 'Go back' },
    offline: { heading: 'Connection lost', body: 'Reconnect, then try again.', retry: 'Try again', back: 'Go back' },
    'load-error': { heading: 'Lesson unavailable', body: 'We could not open it. Try again.', retry: 'Try again', back: 'Go back' },
    placement: { heading: 'Placement comes first', body: 'Open this course from your learning path.', back: 'Go back' },
    locked: { heading: 'Opens later', body: 'Finish the lessons before this one.', back: 'Go back' },
    prerequisite: { heading: 'One step first', body: 'Finish the course that comes before this one.', back: 'Go back' },
    'not-found': { heading: 'Lesson not found', body: 'It may have moved. Pick another lesson.', back: 'Go back' },
  },
  'es-MX': {
    opening: { heading: 'Abriendo la lección', body: 'Preparamos tu lección.', back: 'Volver' },
    offline: { heading: 'Sin conexión', body: 'Conéctate e intenta de nuevo.', retry: 'Reintentar', back: 'Volver' },
    'load-error': { heading: 'Lección no disponible', body: 'No pudimos abrirla. Inténtalo de nuevo.', retry: 'Reintentar', back: 'Volver' },
    placement: { heading: 'Primero va la ubicación', body: 'Abre este curso desde tu ruta de aprendizaje.', back: 'Volver' },
    locked: { heading: 'Se abre después', body: 'Termina primero las lecciones anteriores.', back: 'Volver' },
    prerequisite: { heading: 'Un paso antes', body: 'Termina primero el curso anterior.', back: 'Volver' },
    'not-found': { heading: 'Lección no encontrada', body: 'Puede que se haya movido. Elige otra lección.', back: 'Volver' },
  },
  'pt-BR': {
    opening: { heading: 'Abrindo a lição', body: 'Preparando sua lição.', back: 'Voltar' },
    offline: { heading: 'Sem conexão', body: 'Conecte-se e tente de novo.', retry: 'Tentar de novo', back: 'Voltar' },
    'load-error': { heading: 'Lição indisponível', body: 'Não foi possível abrir. Tente de novo.', retry: 'Tentar de novo', back: 'Voltar' },
    placement: { heading: 'A avaliação vem primeiro', body: 'Abra este curso pela sua trilha de aprendizagem.', back: 'Voltar' },
    locked: { heading: 'Abre depois', body: 'Termine antes as lições anteriores.', back: 'Voltar' },
    prerequisite: { heading: 'Um passo antes', body: 'Termine antes o curso anterior.', back: 'Voltar' },
    'not-found': { heading: 'Lição não encontrada', body: 'Ela pode ter mudado. Escolha outra lição.', back: 'Voltar' },
  },
};

/** Exported for the Copy Budget test. */
export const lessonTransportCopy = copy;

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
