import { ApplicationArt } from '../design/ApplicationArt';
import { useId, useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Art, Button, InlineNotice } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './learnerPage.css';
import './narrative.css';
import { localizedText } from './coursePath';
import type { JournalEntry, JournalState } from './narrative';

/*
 * B.9 / S05.3c — the learner's decision journal: the story choices they made
 * across lessons, what happened next, and where they changed their mind. It
 * is the learner's own record and they can clear it; their progress, scores
 * and coins are untouched by that. Core shows it to nobody else.
 *
 * Layering (Bible 06): each entry shows the choice first; the situation, what
 * happened and a changed mind open with one tap on the entry.
 *
 * Presentation only: the host (routes/app/learn/DecisionJournalRoute.tsx, or
 * the preview) owns transport. No lives, no celebration, no score.
 */

type Copy = {
  title: string; back: string; loading: string; retry: string; errorTitle: string; errorBody: string;
  emptyTitle: string; emptyBody: string; chose: string; happened: string; first: string; more: string; lead: string; echoOne: string; echoMany: string; emptyAction: string;
  changed: string; clear: string; clearBody: string; clearYes: string; clearNo: string; cleared: string; clearFailed: string;
};

export const decisionJournalCopy: Record<Locale, Copy> = {
  'en-US': {
    title: 'My decisions', back: 'Go back', loading: 'Loading your decisions', retry: 'Try again', errorTitle: 'Journal unavailable', errorBody: 'We could not load it. Try again.',
    emptyTitle: 'No decisions yet', emptyBody: 'Story choices you make show up here.', chose: 'You chose', happened: 'What happened', first: 'The first time', more: 'Show more',
    changed: 'You changed your mind', lead: 'What you chose in the stories, and what happened next.', echoOne: 'It came back in the story', echoMany: 'It came back {n} times', emptyAction: 'Go and learn',
    clear: 'Clear journal', clearBody: 'This removes your saved choices. Your progress stays.', clearYes: 'Yes, clear', clearNo: 'Keep it', cleared: 'Your journal is empty now.', clearFailed: 'Could not clear it. Try again.',
  },
  'es-MX': {
    title: 'Mis decisiones', back: 'Volver', loading: 'Cargando tus decisiones', retry: 'Reintentar', errorTitle: 'Diario no disponible', errorBody: 'No pudimos cargarlo. Inténtalo de nuevo.',
    emptyTitle: 'Aún no hay decisiones', emptyBody: 'Aquí aparecen tus elecciones en las historias.', chose: 'Elegiste', happened: 'Qué pasó', first: 'La primera vez', more: 'Ver más',
    changed: 'Cambiaste de idea', lead: 'Lo que elegiste en las historias y lo que pasó después.', echoOne: 'Volvió a aparecer en la historia', echoMany: 'Volvió a aparecer {n} veces', emptyAction: 'Ir a aprender',
    clear: 'Borrar diario', clearBody: 'Esto borra tus elecciones guardadas. Tu progreso se queda.', clearYes: 'Sí, borrar', clearNo: 'Conservarlo', cleared: 'Tu diario está vacío.', clearFailed: 'No se pudo borrar. Inténtalo de nuevo.',
  },
  'pt-BR': {
    title: 'Minhas decisões', back: 'Voltar', loading: 'Carregando suas decisões', retry: 'Tentar de novo', errorTitle: 'Diário indisponível', errorBody: 'Não foi possível carregar. Tente de novo.',
    emptyTitle: 'Nenhuma decisão ainda', emptyBody: 'Suas escolhas nas histórias aparecem aqui.', chose: 'Você escolheu', happened: 'O que aconteceu', first: 'Na primeira vez', more: 'Ver mais',
    changed: 'Você mudou de ideia', lead: 'O que você escolheu nas histórias e o que aconteceu depois.', echoOne: 'Voltou a aparecer na história', echoMany: 'Voltou a aparecer {n} vezes', emptyAction: 'Ir aprender',
    clear: 'Apagar diário', clearBody: 'Isso apaga suas escolhas salvas. Seu progresso fica.', clearYes: 'Sim, apagar', clearNo: 'Manter', cleared: 'Seu diário está vazio.', clearFailed: 'Não foi possível apagar. Tente de novo.',
  },
};

export function DecisionJournalView({ state, locale, dark, ageBand, onBack, onRetry, onMore, onClear, loadingMore = false, fixture = false }: {
  state: JournalState;
  locale: Locale;
  dark: boolean;
  /** Bible 06 §7 (GAP-FIX-R4): the learner's Copy Budget band, as Core's register gives it. */
  ageBand?: AgeBand;
  onBack: () => void;
  onRetry?: () => void;
  onMore?: () => void;
  /** Resolves true when Core cleared the journal. */
  onClear: () => Promise<boolean>;
  loadingMore?: boolean;
  fixture?: boolean;
}) {
  const t = decisionJournalCopy[locale];
  const theme = dark ? 'dark' : 'light';
  /*
   * W2L.1: one root, top row and <h1> in every state. On the learner shell the
   * page's <h1> takes focus on arrival while the journal is still loading;
   * that heading must survive the answer instead of being replaced under it.
   */
  return <div className="lf-rebuild lf-learner-page lf-journal" data-theme={theme} lang={locale} data-surface="app" data-age-band={ageBand}
    data-screen={state.status === 'ready' ? (fixture ? 'journal-preview' : 'journal') : `journal-${state.status}`} aria-busy={state.status === 'loading'}>
    <div className={`lf-journal-inner${state.status === 'ready' ? '' : ' lf-journal-state'}`}>
      <div className="lf-journal-top">
        <Button onClick={onBack}>{t.back}</Button>
      </div>
      <header className="lf-illustrated-header"><div className="lf-illustrated-heading"><h1 data-copy-role="heading">{state.status === 'loading' ? t.loading : state.status === 'error' ? t.errorTitle : t.title}</h1>
        {state.status === 'ready' ? <p className="lf-journal-lead" data-copy-role="body">{t.lead}</p> : null}</div><ApplicationArt scene="learning" /></header>
      {state.status === 'ready'
        ? <ReadyJournal key={state.entries.length === 0 ? 'empty' : 'list'} state={state} locale={locale} t={t}
          onBack={onBack} onMore={onMore} onClear={onClear} loadingMore={loadingMore} />
        : state.status === 'error' ? <>
          <p data-copy-role="body">{t.errorBody}</p>
          {onRetry ? <div className="lf-actions"><Button variant="accent" onClick={onRetry}>{t.retry}</Button></div> : null}
        </> : null}
    </div>
  </div>;
}

function ReadyJournal({ state, locale, t, onBack, onMore, onClear, loadingMore }: {
  state: Extract<JournalState, { status: 'ready' }>; locale: Locale; t: Copy; onBack: () => void; onMore?: () => void; onClear: () => Promise<boolean>; loadingMore: boolean;
}) {
  const emptyId = useId();
  const [confirming, setConfirming] = useState(false);
  const [clearNotice, setClearNotice] = useState<'cleared' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const entries = clearNotice === 'cleared' ? [] : state.entries;

  async function clear() {
    if (busy) return;
    setBusy(true);
    const ok = await onClear();
    setBusy(false);
    setConfirming(false);
    setClearNotice(ok ? 'cleared' : 'failed');
  }

  return <>
      {entries.length === 0 ? <section className="lf-journal-section lf-journal-empty" aria-labelledby={emptyId}>
        <Art assetId="badge.journal.choice" size="lg" />
        <h2 id={emptyId} data-copy-role="heading">{t.emptyTitle}</h2>
        <p data-copy-role="body">{clearNotice === 'cleared' ? t.cleared : t.emptyBody}</p>
        <Button variant="accent" onClick={onBack}>{t.emptyAction}</Button>
      </section> : <section className="lf-journal-section" aria-label={t.title}>
        <div className="lf-journal-days">
          {dayGroups(entries, locale).map((group) => <section key={group.key} className="lf-journal-day">
            <h2 className="lf-journal-day-label" data-copy-role="body">{group.label}</h2>
            <ol className="lf-journal-list">
              {group.entries.map((entry) => <JournalCard key={entry.id} entry={entry} locale={locale} t={t} />)}
            </ol>
          </section>)}
        </div>
        {state.hasMore && onMore ? <Button pending={loadingMore} onClick={onMore}>{t.more}</Button> : null}
      </section>}

      {entries.length > 0 ? <section className="lf-journal-clear" aria-label={t.clear}>
        {clearNotice === 'failed' ? <InlineNotice tone="error" live>{t.clearFailed}</InlineNotice> : null}
        {confirming ? <>
          <p data-copy-role="body">{t.clearBody}</p>
          <div className="lf-actions">
            <Button disabled={busy} onClick={() => void clear()}>{t.clearYes}</Button>
            <Button variant="accent" disabled={busy} onClick={() => setConfirming(false)}>{t.clearNo}</Button>
          </div>
        </> : <div className="lf-actions"><Button onClick={() => { setClearNotice(null); setConfirming(true); }}>{t.clear}</Button></div>}
      </section> : null}
  </>;
}

/** Entries grouped by the day they were decided, newest first as Core serves them; the day reads "Today", "Yesterday" or the date (from `Intl`). */
function dayGroups(entries: JournalEntry[], locale: Locale): { key: string; label: string; entries: JournalEntry[] }[] {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const dated = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const midnight = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const groups: { key: string; label: string; entries: JournalEntry[] }[] = [];
  for (const entry of entries) {
    const date = new Date(entry.recordedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) { last.entries.push(entry); continue; }
    const days = Math.round((midnight(new Date()) - midnight(date)) / 86_400_000);
    const label = days >= 0 && days <= 1 ? relative.format(-days, 'day') : dated.format(date);
    groups.push({ key, label: label.charAt(0).toLocaleUpperCase(locale) + label.slice(1), entries: [entry] });
  }
  return groups;
}

/**
 * One decision told as a short story, all of it in view: the question the story asked, what the learner chose, what happened
 * next, and, when the story gave a second chance, what they chose the first time. A mark at the foot says when the story
 * brought the choice back in a later lesson, which is what the journal is for.
 */
function JournalCard({ entry, locale, t }: { entry: JournalEntry; locale: Locale; t: Copy }) {
  const echo = entry.resurfaced > 0 ? (entry.resurfaced === 1 ? t.echoOne : t.echoMany.replace('{n}', new Intl.NumberFormat(locale).format(entry.resurfaced))) : null;
  return <li className="lf-journal-entry">
    <p className="lf-journal-meta"><Art assetId="badge.journal.choice" /><span data-copy-role="data">{localizedText(entry.course.title, locale)}</span><span data-copy-role="data">{localizedText(entry.lesson.title, locale)}</span></p>
    <p className="lf-journal-situation" data-copy-role="narrative">{entry.situation}</p>
    <p className="lf-journal-choice">
      <span data-copy-role="body">{t.chose}</span>
      <span data-copy-role="narrative">{entry.choice}</span>
    </p>
    {entry.outcome ? <p className="lf-journal-outcome"><span data-copy-role="body">{t.happened}</span><span data-copy-role="narrative">{entry.outcome}</span></p> : null}
    {entry.firstChoice ? <p className="lf-journal-changed"><span data-copy-role="body">{t.changed}</span><span data-copy-role="body">{t.first}: <del className="ugc">{entry.firstChoice}</del></span></p> : null}
    {echo ? <p className="lf-journal-echo"><Art assetId="badge.journal.echo" /><span data-copy-role="body">{echo}</span></p> : null}
  </li>;
}
