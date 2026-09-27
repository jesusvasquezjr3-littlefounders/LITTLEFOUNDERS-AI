import { useId } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, ErrorState, InlineNotice, LoadingState, StatusMark } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './familyLearning.css';
import type { NarrativeEntry, NarrativeState } from './familyLearning';

/*
 * B.10 / S05.3c — what the child learned in their courses, told to the
 * verified parent (the Tutor) in a few short, true sentences per lesson: the
 * skill practised, whether it came easily or took a second try, and one
 * conversation starter. "The lesson does the explaining, you do the talking"
 * (the Plan, step 2). Deterministic from Core's data, like the Mentor's
 * session narrative; nothing here is generated.
 *
 * The child's story choices are counted, never shown: the guardian asks, the
 * child tells. Adult register (B.23): direct, no decoration, respects time,
 * so the first view carries the week in two numbers and the latest lessons.
 *
 * Presentation only: the host panel owns transport. Core already checked the
 * verified parent and the verified link to this child.
 */

type Copy = {
  title: string; open: string; close: string; loading: string; retry: string; error: string; noAccess: string; empty: string; more: string;
  week: (lessons: number, topics: number) => string; practiced: string;
  struggle: Record<'none' | 'resolved' | 'open', string>; hint: string; decisions: (n: number) => string;
  talk: Record<NarrativeEntry['conversation'], string>; topicDone: string;
};

export const learningNarrativeCopy: Record<Locale, Copy> = {
  'en-US': {
    title: 'Course learning', open: 'See learning', close: 'Hide learning', loading: 'Loading learning', retry: 'Try again', error: 'Could not load learning.', noAccess: 'This child is no longer linked to you.',
    empty: 'No lessons finished yet.', more: 'Show more',
    week: (l, t) => `This week: ${l} ${l === 1 ? 'lesson' : 'lessons'}, ${t} ${t === 1 ? 'topic' : 'topics'} finished.`, practiced: 'Practiced',
    struggle: { none: 'Got it right away.', resolved: 'Found it tricky, then got it.', open: 'Still working on it.' }, hint: 'Used a hint.',
    decisions: (n) => `Made ${n} story ${n === 1 ? 'choice' : 'choices'}.`,
    talk: { decision: 'Ask what they chose, and why.', explain: 'Ask them to explain it in their own words.' }, topicDone: 'Topic finished',
  },
  'es-MX': {
    title: 'Aprendizaje en cursos', open: 'Ver aprendizaje', close: 'Ocultar aprendizaje', loading: 'Cargando aprendizaje', retry: 'Reintentar', error: 'No se pudo cargar el aprendizaje.', noAccess: 'Este niño ya no está vinculado contigo.',
    empty: 'Aún no terminó ninguna lección.', more: 'Ver más',
    week: (l, t) => `Esta semana: ${l} ${l === 1 ? 'lección' : 'lecciones'}, ${t} ${t === 1 ? 'tema terminado' : 'temas terminados'}.`, practiced: 'Practicó',
    struggle: { none: 'Lo entendió a la primera.', resolved: 'Le costó, y luego lo logró.', open: 'Todavía lo está practicando.' }, hint: 'Usó una pista.',
    decisions: (n) => `Tomó ${n} ${n === 1 ? 'decisión' : 'decisiones'} en la historia.`,
    talk: { decision: 'Pregúntale qué eligió y por qué.', explain: 'Pídele que te lo explique con sus palabras.' }, topicDone: 'Tema terminado',
  },
  'pt-BR': {
    title: 'Aprendizado nos cursos', open: 'Ver aprendizado', close: 'Ocultar aprendizado', loading: 'Carregando aprendizado', retry: 'Tentar de novo', error: 'Não foi possível carregar o aprendizado.', noAccess: 'Esta criança não está mais vinculada a você.',
    empty: 'Nenhuma lição terminada ainda.', more: 'Ver mais',
    week: (l, t) => `Nesta semana: ${l} ${l === 1 ? 'lição' : 'lições'}, ${t} ${t === 1 ? 'tema terminado' : 'temas terminados'}.`, practiced: 'Praticou',
    struggle: { none: 'Entendeu de primeira.', resolved: 'Achou difícil, depois conseguiu.', open: 'Ainda está praticando.' }, hint: 'Usou uma dica.',
    decisions: (n) => `Tomou ${n} ${n === 1 ? 'decisão' : 'decisões'} na história.`,
    talk: { decision: 'Pergunte o que escolheu e por quê.', explain: 'Peça que explique com as próprias palavras.' }, topicDone: 'Tema terminado',
  },
};

export function LearningNarrative({ state, locale, dark, open, onToggle, onRetry, onMore, loadingMore = false, fixture = false }: {
  state: NarrativeState;
  locale: Locale;
  dark: boolean;
  open: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onMore?: () => void;
  loadingMore?: boolean;
  fixture?: boolean;
}) {
  const t = learningNarrativeCopy[locale];
  const titleId = useId();
  return <section className="lf-rebuild lf-family-learning" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'family-narrative-preview' : 'family-narrative'} aria-labelledby={titleId}>
    <div className="lf-family-learning-head">
      <h2 id={titleId} data-copy-role="heading">{t.title}</h2>
      <Button aria-expanded={open} onClick={onToggle}>{open ? t.close : t.open}</Button>
    </div>
    {!open ? null : state.status === 'loading' ? <LoadingState label={t.loading} lines={2} />
      : state.status === 'no-access' ? <InlineNotice tone="error" live>{t.noAccess}</InlineNotice>
        : state.status === 'error' ? <ErrorState heading={t.error} retryLabel={t.retry} retryingLabel={t.loading} onRetry={onRetry} />
          : <>
            <p className="lf-family-learning-week" data-copy-role="body">{t.week(state.week.lessons, state.week.topicsCompleted)}</p>
            {state.entries.length === 0 ? <p data-copy-role="body">{t.empty}</p> : <ol className="lf-family-learning-list">
              {state.entries.map((entry) => <NarrativeCard key={entry.lessonId} entry={entry} t={t} />)}
            </ol>}
            {state.hasMore && onMore ? <Button pending={loadingMore} onClick={onMore}>{t.more}</Button> : null}
          </>}
  </section>;
}

function NarrativeCard({ entry, t }: { entry: NarrativeEntry; t: Copy }) {
  return <li className="lf-family-learning-entry">
    <div className="lf-family-learning-entry-head">
      <h3 data-copy-role="data">{entry.lessonTitle}</h3>
      {entry.topicComplete ? <span className="lf-family-learning-tag" data-copy-role="body"><StatusMark correct />{t.topicDone}</span> : null}
    </div>
    <p className="lf-family-learning-meta" data-copy-role="data">{entry.courseTitle}</p>
    <p><span className="lf-family-learning-label" data-copy-role="body">{t.practiced}</span>{' '}<span data-copy-role="data">{entry.skills.join(', ')}</span></p>
    {entry.struggle ? <p data-copy-role="body">{t.struggle[entry.struggle]}</p> : null}
    {entry.usedHint ? <p data-copy-role="body">{t.hint}</p> : null}
    {entry.decisions > 0 ? <p data-copy-role="body">{t.decisions(entry.decisions)}</p> : null}
    <p className="lf-family-learning-talk" data-copy-role="body">{t.talk[entry.conversation]}</p>
  </li>;
}
