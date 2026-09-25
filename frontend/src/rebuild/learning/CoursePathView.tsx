import { useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, StatusMark } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './coursePath.css';
import { localizedText, type CoursePath, type CoursePathItem, type CoursePathState } from './coursePath';

/*
 * B.6 / S05.3b — the rebuilt course path. One learner's frontier on the
 * shared knowledge graph, as Core computed it: the recommended next lesson,
 * every other lesson open now (real choices, B.24), the skills this path
 * teaches and how each is shown, and the chapters with their access. It is a
 * dashboard-style screen (neutral page, coloured cards; Bible 02 rule 15).
 *
 * Presentation only: the host (routes/app/learn/CoursePathRoute.tsx, or the
 * preview) owns transport and navigation. Nothing here decides a lock, and no
 * age or birth date ever reaches it. No lives, no celebration (a finished
 * path is stated, not celebrated: the milestone effects belong to the lesson
 * and badge moments, D7). Copy lives here in three locales and is checked
 * against the youngest Copy Budget in CoursePathView.test.tsx.
 */

type Copy = {
  preview: string; progress: (passed: number, total: number) => string; startHere: string; start: string; minutes: (n: number) => string;
  placementTitle: string; placementBody: string; placementAction: string;
  completeTitle: string; completeBody: string; badgeEarned: string; contentGap: string;
  moreTitle: string; showMore: string; showLess: string; waiting: (n: number) => string;
  reasons: Record<CoursePathItem['reason'], string>; extra: string;
  skillsTitle: string; shown: Record<'course' | 'mentor' | 'none', string>;
  chaptersTitle: string; access: Record<'pathway' | 'optional', string>; closedChapters: (n: number) => string;
  back: string; retry: string; loading: string;
  ageTitle: string; ageBody: string; prereqTitle: string; prereqBody: string;
  disabledTitle: string; disabledBody: string; errorTitle: string; errorBody: string;
};

export const coursePathCopy: Record<Locale, Copy> = {
  'en-US': {
    preview: 'Sample path', progress: (p, t) => `${p} of ${t} lessons done`, startHere: 'Start here', start: 'Start', minutes: (n) => `${n} min`,
    placementTitle: 'Find your start', placementBody: 'A few questions show where you begin.', placementAction: 'Find my start',
    completeTitle: 'Path complete', completeBody: 'You finished your path.', badgeEarned: 'Badge earned', contentGap: 'More lessons for your age are coming.',
    moreTitle: 'More to open', showMore: 'Show more', showLess: 'Show less', waiting: (n) => `${n} more open as you learn.`,
    reasons: { next: 'Next step', review: 'Review', 'review-due': 'Time to review', bridge: 'Extra help', known: 'You know this' }, extra: 'Extra',
    skillsTitle: 'Skills on this path', shown: { course: 'Shown', mentor: 'Shown with your Mentor', none: 'Not yet' },
    chaptersTitle: 'Chapters', access: { pathway: 'Your path', optional: 'Extra' }, closedChapters: (n) => `${n} ${n === 1 ? 'chapter' : 'chapters'} for older learners`,
    back: 'Go back', retry: 'Try again', loading: 'Loading your path',
    ageTitle: 'Not open yet', ageBody: 'This course opens when you are older.', prereqTitle: 'One step first', prereqBody: 'Finish these courses first.',
    disabledTitle: 'Coming soon', disabledBody: 'This path is not ready yet.', errorTitle: 'Path unavailable', errorBody: 'We could not load it. Try again.',
  },
  'es-MX': {
    preview: 'Ruta de ejemplo', progress: (p, t) => `${p} de ${t} lecciones hechas`, startHere: 'Empieza aquí', start: 'Empezar', minutes: (n) => `${n} min`,
    placementTitle: 'Encuentra tu inicio', placementBody: 'Unas preguntas muestran dónde empiezas.', placementAction: 'Buscar mi inicio',
    completeTitle: 'Ruta completa', completeBody: 'Terminaste tu ruta.', badgeEarned: 'Insignia ganada', contentGap: 'Pronto habrá más lecciones para tu edad.',
    moreTitle: 'Más para abrir', showMore: 'Ver más', showLess: 'Ver menos', waiting: (n) => `${n} más se abren mientras aprendes.`,
    reasons: { next: 'Siguiente paso', review: 'Repaso', 'review-due': 'Hora de repasar', bridge: 'Ayuda extra', known: 'Ya lo sabes' }, extra: 'Extra',
    skillsTitle: 'Habilidades de esta ruta', shown: { course: 'Demostrada', mentor: 'Demostrada con tu Mentor', none: 'Aún no' },
    chaptersTitle: 'Capítulos', access: { pathway: 'Tu ruta', optional: 'Extra' }, closedChapters: (n) => `${n} ${n === 1 ? 'capítulo' : 'capítulos'} para más grandes`,
    back: 'Volver', retry: 'Reintentar', loading: 'Cargando tu ruta',
    ageTitle: 'Aún no se abre', ageBody: 'Este curso se abre cuando seas mayor.', prereqTitle: 'Un paso antes', prereqBody: 'Termina primero estos cursos.',
    disabledTitle: 'Muy pronto', disabledBody: 'Esta ruta aún no está lista.', errorTitle: 'Ruta no disponible', errorBody: 'No pudimos cargarla. Inténtalo de nuevo.',
  },
  'pt-BR': {
    preview: 'Trilha de exemplo', progress: (p, t) => `${p} de ${t} lições feitas`, startHere: 'Comece aqui', start: 'Começar', minutes: (n) => `${n} min`,
    placementTitle: 'Encontre seu início', placementBody: 'Algumas perguntas mostram onde você começa.', placementAction: 'Achar meu início',
    completeTitle: 'Trilha completa', completeBody: 'Você terminou sua trilha.', badgeEarned: 'Insígnia ganha', contentGap: 'Em breve, mais lições para sua idade.',
    moreTitle: 'Mais para abrir', showMore: 'Ver mais', showLess: 'Ver menos', waiting: (n) => `Mais ${n} abrem enquanto você aprende.`,
    reasons: { next: 'Próximo passo', review: 'Revisão', 'review-due': 'Hora de revisar', bridge: 'Ajuda extra', known: 'Você já sabe' }, extra: 'Extra',
    skillsTitle: 'Habilidades desta trilha', shown: { course: 'Mostrada', mentor: 'Mostrada com seu Mentor', none: 'Ainda não' },
    chaptersTitle: 'Capítulos', access: { pathway: 'Sua trilha', optional: 'Extra' }, closedChapters: (n) => `${n} ${n === 1 ? 'capítulo' : 'capítulos'} para quem é mais velho`,
    back: 'Voltar', retry: 'Tentar de novo', loading: 'Carregando sua trilha',
    ageTitle: 'Ainda não abriu', ageBody: 'Este curso abre quando você for mais velho.', prereqTitle: 'Um passo antes', prereqBody: 'Termine estes cursos primeiro.',
    disabledTitle: 'Em breve', disabledBody: 'Esta trilha ainda não está pronta.', errorTitle: 'Trilha indisponível', errorBody: 'Não foi possível carregar. Tente de novo.',
  },
};

/*
 * Layering (Bible 06): the first view carries the course, the progress and
 * the one recommended step; further choices are one tap away. Density follows
 * the learner's stage by composition only (D8): a child sees two further
 * choices before "Show more", an older learner four.
 */
const firstItems = (stage: CoursePath['pathway']['learnerStage']) => (stage === 'child' ? 2 : 4);
const FIRST_SKILLS = 6;

export function CoursePathView({ state, locale, dark, onOpenLesson, onPlacement, onBack, onRetry, missingTitles, fixture = false }: {
  state: CoursePathState;
  locale: Locale;
  dark: boolean;
  onOpenLesson: (lessonId: string) => void;
  onPlacement: () => void;
  onBack: () => void;
  onRetry?: () => void;
  /** Titles of the missing prerequisite courses, resolved by the host from the shelf; slugs otherwise. */
  missingTitles?: string[];
  fixture?: boolean;
}) {
  const t = coursePathCopy[locale];
  const theme = dark ? 'dark' : 'light';
  if (state.status !== 'ready') {
    const s = state.status === 'loading' ? { title: t.loading, body: null }
      : state.status === 'age-restricted' ? { title: t.ageTitle, body: t.ageBody }
        : state.status === 'prerequisite' ? { title: t.prereqTitle, body: t.prereqBody }
          : state.status === 'disabled' ? { title: t.disabledTitle, body: t.disabledBody }
            : { title: t.errorTitle, body: t.errorBody };
    const missing = state.status === 'prerequisite' ? (missingTitles?.length ? missingTitles : state.missing) : [];
    return <main className="lf-rebuild lf-course-path lf-course-path--state" data-theme={theme} lang={locale} data-surface="app"
      data-screen={`course-path-${state.status}`} aria-busy={state.status === 'loading'}>
      <div className="lf-course-path-inner lf-course-path-state">
        <h1 data-copy-role="heading">{s.title}</h1>
        {s.body ? <p data-copy-role="body">{s.body}</p> : null}
        {missing.length ? <ul className="lf-course-path-missing">{missing.map((name) => <li key={name} data-copy-role="data">{name}</li>)}</ul> : null}
        {state.status === 'loading' ? <div className="lf-course-path-bar lf-course-path-bar--busy" role="progressbar" aria-label={t.loading}><span /></div> : null}
        <div className="lf-actions">
          {state.status === 'error' && onRetry ? <Button variant="accent" onClick={onRetry}>{t.retry}</Button> : null}
          <Button onClick={onBack}>{t.back}</Button>
        </div>
      </div>
    </main>;
  }
  return <ReadyPath path={state.path} locale={locale} theme={theme} t={t} onOpenLesson={onOpenLesson} onPlacement={onPlacement} onBack={onBack} fixture={fixture} />;
}

function ReadyPath({ path, locale, theme, t, onOpenLesson, onPlacement, onBack, fixture }: {
  path: CoursePath; locale: Locale; theme: 'light' | 'dark'; t: Copy;
  onOpenLesson: (lessonId: string) => void; onPlacement: () => void; onBack: () => void; fixture: boolean;
}) {
  const [allItems, setAllItems] = useState(false);
  const [allSkills, setAllSkills] = useState(false);
  const text = (value: Record<string, unknown>) => localizedText(value, locale);
  const { pathway } = path;
  const recommended = path.items.find((item) => item.recommended) ?? null;
  const others = path.items.filter((item) => item !== recommended);
  const FIRST_ITEMS = firstItems(pathway.learnerStage);
  const visibleItems = allItems ? others : others.slice(0, FIRST_ITEMS);
  const visibleSkills = allSkills ? path.skills : path.skills.slice(0, FIRST_SKILLS);
  const openChapters = path.chapters.filter((chapter): chapter is typeof chapter & { access: 'pathway' | 'optional' } => chapter.access !== 'closed');
  const closedCount = path.chapters.length - openChapters.length;
  const earned = pathway.badge.stage !== null && pathway.badge.earnedStages.includes(pathway.badge.stage);
  // A plain next step needs no tag; only a different reason is named (review, extra help, already known, extra chapter).
  const reasonLabel = (item: CoursePathItem) => item.access === 'optional' && item.reason === 'next' ? t.extra : item.reason === 'next' ? null : t.reasons[item.reason];

  return <main className="lf-rebuild lf-course-path" data-theme={theme} lang={locale} data-surface="app" data-screen={fixture ? 'course-path-preview' : 'course-path'}>
    <div className="lf-course-path-inner">
      <div className="lf-course-path-top">
        <Button onClick={onBack}>{t.back}</Button>
      </div>
      <header className="lf-course-path-header">
        <h1 data-copy-role="heading">{text(path.course.title)}</h1>
        <div className="lf-course-path-progress">
          <div className="lf-course-path-bar" role="progressbar" aria-label={t.progress(pathway.progress.passed, pathway.progress.total)}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={pathway.progress.pct}>
            <span style={{ inlineSize: `${pathway.progress.pct}%` }} />
          </div>
          <span data-copy-role="data">{pathway.progress.passed}/{pathway.progress.total}</span>
        </div>
      </header>

      {pathway.placementRequired ? <section className="lf-course-path-hero" aria-labelledby="lf-course-path-hero">
        <h2 id="lf-course-path-hero" data-copy-role="heading">{t.placementTitle}</h2>
        <p data-copy-role="body">{t.placementBody}</p>
        <Button variant="accent" onClick={onPlacement}>{t.placementAction}</Button>
      </section> : pathway.progress.complete ? <section className="lf-course-path-done" aria-labelledby="lf-course-path-done">
        <h2 id="lf-course-path-done" data-copy-role="heading">{t.completeTitle}</h2>
        <p data-copy-role="body">{t.completeBody}</p>
        {earned ? <p className="lf-course-path-earned" data-copy-role="body"><StatusMark correct />{t.badgeEarned}</p> : null}
      </section> : recommended ? <section className="lf-course-path-hero" aria-labelledby="lf-course-path-hero">
        <p className="lf-course-path-kicker" data-copy-role="body">{t.startHere}</p>
        <h2 id="lf-course-path-hero" data-copy-role="heading">{text(recommended.topicTitle)}</h2>
        <div className="lf-course-path-hero-action">
          <Button variant="accent" onClick={() => onOpenLesson(recommended.lessonId)}>{t.start}</Button>
          <span data-copy-role="data">{t.minutes(recommended.estimatedMinutes)}</span>
        </div>
      </section> : null}

      {pathway.badge.contentGap && pathway.basis !== 'unavailable' ? <p className="lf-course-path-note" data-copy-role="body">{t.contentGap}</p> : null}

      {!pathway.placementRequired && others.length > 0 ? <section className="lf-course-path-section" aria-labelledby="lf-course-path-more">
        <h2 id="lf-course-path-more" data-copy-role="heading">{t.moreTitle}</h2>
        <ul className="lf-course-path-items">
          {visibleItems.map((item) => <li key={item.lessonId}>
            <button type="button" className={`lf-course-path-item lf-course-path-item--${item.access}`} onClick={() => onOpenLesson(item.lessonId)}>
              <span className="lf-course-path-item-title" data-copy-role="option">{text(item.topicTitle)}</span>
              {reasonLabel(item) ? <span className={`lf-course-path-tag lf-course-path-tag--${item.access === 'optional' && item.reason === 'next' ? 'optional' : item.reason}`} data-copy-role="body">{reasonLabel(item)}</span> : null}
            </button>
          </li>)}
        </ul>
        {others.length > FIRST_ITEMS ? <Button aria-expanded={allItems} onClick={() => setAllItems(!allItems)}>{allItems ? t.showLess : t.showMore}</Button> : null}
      </section> : null}

      <section className="lf-course-path-section" aria-labelledby="lf-course-path-chapters">
        <h2 id="lf-course-path-chapters" data-copy-role="heading">{t.chaptersTitle}</h2>
        <ol className="lf-course-path-chapters">
          {openChapters.map((chapter) => <li key={chapter.id} className={`lf-course-path-chapter lf-course-path-chapter--${chapter.access}`}>
            <span className="lf-course-path-chapter-title" data-copy-role="option">{text(chapter.title)}</span>
            <span className={`lf-course-path-tag lf-course-path-tag--${chapter.access}`} data-copy-role="body">{t.access[chapter.access]}</span>
            <span className="lf-course-path-chapter-count" data-copy-role="data">{chapter.progress.passed}/{chapter.progress.total}</span>
          </li>)}
        </ol>
        {/* Chapters the age safeguard closes are counted, never offered and never listed as lessons (OD-16). */}
        {closedCount > 0 ? <p className="lf-course-path-note" data-copy-role="body">{t.closedChapters(closedCount)}</p> : null}
        {!pathway.placementRequired && path.blocked.length > 0 ? <p className="lf-course-path-note" data-copy-role="body">{t.waiting(path.blocked.length)}</p> : null}
      </section>

      {path.skills.length > 0 ? <section className="lf-course-path-section" aria-labelledby="lf-course-path-skills">
        <h2 id="lf-course-path-skills" data-copy-role="heading">{t.skillsTitle}</h2>
        <ul className="lf-course-path-skills">
          {visibleSkills.map((skill) => <li key={skill.key} className={`lf-course-path-skill lf-course-path-skill--${skill.shown}`}>
            <span data-copy-role="option">{text(skill.title) || skill.key}</span>
            <span className="lf-course-path-skill-state" data-copy-role="body">{skill.shown !== 'none' ? <StatusMark correct /> : null}{t.shown[skill.shown]}</span>
          </li>)}
        </ul>
        {path.skills.length > FIRST_SKILLS ? <Button aria-expanded={allSkills} onClick={() => setAllSkills(!allSkills)}>{allSkills ? t.showLess : t.showMore}</Button> : null}
      </section> : null}
      {fixture ? <p className="lf-course-path-chip" data-copy-role="body">{t.preview}</p> : null}
    </div>
  </main>;
}
