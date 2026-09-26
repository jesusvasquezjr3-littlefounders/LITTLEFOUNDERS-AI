import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
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
 * Layering (Bible 06): the first view is the situation, the choice and the
 * question; what happened next, and a changed mind, are one tap away.
 * Presentation only: the host decides when to show it and what Continue does.
 */

type Copy = { heading: string; chose: string; happened: string; hide: string; first: string; reflect: string; next: string };

export const narrativeRecallCopy: Record<Locale, Copy> = {
  'en-US': { heading: 'Remember this?', chose: 'You chose', happened: 'What happened', hide: 'Hide it', first: 'The first time', reflect: 'Same choice today?', next: 'Continue' },
  'es-MX': { heading: '¿Lo recuerdas?', chose: 'Elegiste', happened: 'Qué pasó', hide: 'Ocultar', first: 'La primera vez', reflect: '¿Lo mismo hoy?', next: 'Continuar' },
  'pt-BR': { heading: 'Lembra disso?', chose: 'Você escolheu', happened: 'O que aconteceu', hide: 'Ocultar', first: 'Na primeira vez', reflect: 'O mesmo hoje?', next: 'Continuar' },
};

export function NarrativeRecallView({ recall, locale, dark, onContinue, fixture = false }: {
  recall: NarrativeRecall;
  locale: Locale;
  dark: boolean;
  onContinue: () => void;
  fixture?: boolean;
}) {
  const t = narrativeRecallCopy[locale];
  const [more, setMore] = useState(false);
  const headingId = useId();
  const moreId = useId();
  const hasMore = Boolean(recall.outcome || recall.first_choice);
  return <main className="lf-rebuild lf-recall" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'narrative-recall-preview' : 'narrative-recall'} aria-labelledby={headingId}>
    <div className="lf-recall-inner">
      <p className="lf-recall-source" data-copy-role="data">{localizedText(recall.lesson_title, locale)}</p>
      <h1 id={headingId} data-copy-role="heading">{t.heading}</h1>
      <p className="lf-recall-situation" data-copy-role="narrative">{recall.situation}</p>
      <section className="lf-recall-card" aria-label={t.chose}>
        <p className="lf-recall-label" data-copy-role="body">{t.chose}</p>
        <p className="lf-recall-choice" data-copy-role="narrative">{recall.choice}</p>
      </section>
      {hasMore ? <Button aria-expanded={more} aria-controls={moreId} onClick={() => setMore(!more)}>{more ? t.hide : t.happened}</Button> : null}
      {hasMore && more ? <section id={moreId} className="lf-recall-card lf-recall-card--quiet" aria-label={t.happened}>
        {recall.outcome ? <p data-copy-role="narrative">{recall.outcome}</p> : null}
        {recall.first_choice ? <p className="lf-recall-first"><span data-copy-role="body">{t.first}</span>{' '}<span data-copy-role="narrative">{recall.first_choice}</span></p> : null}
      </section> : null}
      <p className="lf-recall-reflect" data-copy-role="prompt">{t.reflect}</p>
      <div className="lf-actions">
        <Button variant="accent" onClick={onContinue}>{t.next}</Button>
      </div>
    </div>
  </main>;
}
