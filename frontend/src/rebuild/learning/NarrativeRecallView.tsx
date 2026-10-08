import { useId } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import { ResultMentor } from '../mentor/ResultMentor';
import type { LessonMentorStage } from './lessonDocument';
import '../design/tokens.css';
import '../design/system.css';
import './narrative.css';
import { localizedText } from './coursePath';
import type { NarrativeRecall } from './narrative';

/*
 * B.9 / S05.3c — "Remember this?" A decision the learner made earlier in the
 * story comes back as a later, relevant lesson opens: the situation, what
 * they chose and what happened next. It is a single-state moment, so the
 * whole screen is one hue (Bible 02 rule 15), shown before the lesson.
 *
 * It carries no score and no judgement: the quality an author gave the
 * choice never reaches the client. It asks one reflective question and
 * moves on; nothing is graded or stored from it. No celebration, no lives.
 * The whole memory is in view (the situation, the choice, what happened next and, if they changed
 * their mind, the first choice struck through), with the learner's own Mentor thinking beside it: a
 * deviation from the Bible 06 layering that put what happened behind a tap (OD-42).
 * Presentation only: the host decides when to show it and what Continue does.
 */

type Copy = { heading: string; chose: string; happened: string; changed: string; first: string; reflect: string; next: string };

export const narrativeRecallCopy: Record<Locale, Copy> = {
  'en-US': { heading: 'Remember this?', chose: 'You chose', happened: 'What happened', changed: 'You changed your mind', first: 'The first time', reflect: 'Same choice today?', next: 'Continue' },
  'es-MX': { heading: '¿Lo recuerdas?', chose: 'Elegiste', happened: 'Qué pasó', changed: 'Cambiaste de idea', first: 'La primera vez', reflect: '¿Lo mismo hoy?', next: 'Continuar' },
  'pt-BR': { heading: 'Lembra disso?', chose: 'Você escolheu', happened: 'O que aconteceu', changed: 'Você mudou de ideia', first: 'Na primeira vez', reflect: 'O mesmo hoje?', next: 'Continuar' },
};

export function NarrativeRecallView({ recall, locale, dark, onContinue, fixture = false, mentor = null }: {
  recall: NarrativeRecall;
  locale: Locale;
  dark: boolean;
  onContinue: () => void;
  fixture?: boolean;
  /** The learner's own Mentor, thinking beside the memory. Absent: the memory stands alone. */
  mentor?: LessonMentorStage | null;
}) {
  const t = narrativeRecallCopy[locale];
  const headingId = useId();
  return <main className="lf-rebuild lf-recall" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'narrative-recall-preview' : 'narrative-recall'} aria-labelledby={headingId} data-mentor={mentor ? 'true' : undefined}>
    <div className="lf-recall-inner">
      {mentor ? <ResultMentor character={mentor.character} calm={false} mood="ponder" fallback={null} /> : null}
      <div className="lf-recall-body">
        <p className="lf-recall-source" data-copy-role="data">{localizedText(recall.lesson_title, locale)}</p>
        <h1 id={headingId} data-copy-role="heading">{t.heading}</h1>
        <section className="lf-recall-card" aria-label={t.chose}>
          <p className="lf-recall-situation" data-copy-role="narrative">{recall.situation}</p>
          <p className="lf-recall-label" data-copy-role="body">{t.chose}</p>
          <p className="lf-recall-choice" data-copy-role="narrative">{recall.choice}</p>
          {recall.outcome ? <div className="lf-recall-outcome"><p className="lf-recall-label" data-copy-role="body">{t.happened}</p><p data-copy-role="narrative">{recall.outcome}</p></div> : null}
          {recall.first_choice ? <p className="lf-recall-first"><span data-copy-role="body">{t.changed}</span><span data-copy-role="body">{t.first}: <del className="ugc">{recall.first_choice}</del></span></p> : null}
        </section>
        <p className="lf-recall-reflect" data-copy-role="prompt">{t.reflect}</p>
        <div className="lf-actions">
          <Button variant="accent" onClick={onContinue}>{t.next}</Button>
        </div>
      </div>
    </div>
  </main>;
}
