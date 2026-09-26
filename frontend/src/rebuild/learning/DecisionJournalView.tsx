import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, IconButton, InlineNotice } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './learnerPage.css';
import './narrative.css';
import { localizedText } from './coursePath';
import type { BridgeOutcome, JournalEntry, JournalState, SelfBridge } from './narrative';

/*
 * B.9 / S05.3c — the learner's decision journal: the story choices they made
 * across lessons, what happened next, and where they changed their mind. It
 * is the learner's own record (Core shows it to nobody else) and they can
 * clear it; their progress, scores and coins are untouched by that.
 *
 * B.13, Option B — an independent teen also sees "Try it for real": a
 * self-directed prompt after a topic that teaches a real-world money skill.
 * Answering it records their own plan and creates nothing. Core sends these
 * only to an independent teen, so any other learner never sees the section.
 *
 * Layering (Bible 06): each entry shows the choice first; the situation, what
 * happened and a changed mind open with one tap on the entry.
 *
 * Presentation only: the host (routes/app/learn/DecisionJournalRoute.tsx, or
 * the preview) owns transport. No lives, no celebration, no score.
 */

type Copy = {
  title: string; back: string; loading: string; retry: string; errorTitle: string; errorBody: string;
  emptyTitle: string; emptyBody: string; chose: string; happened: string; hide: string; first: string; more: string;
  clear: string; clearBody: string; clearYes: string; clearNo: string; cleared: string; clearFailed: string;
  bridgeTitle: string; learned: string; bridge: Record<SelfBridge['action'], string>; tryIt: string; notNow: string;
  planned: string; bridgeClosed: string; bridgeFailed: string;
};

export const decisionJournalCopy: Record<Locale, Copy> = {
  'en-US': {
    title: 'My decisions', back: 'Go back', loading: 'Loading your decisions', retry: 'Try again', errorTitle: 'Journal unavailable', errorBody: 'We could not load it. Try again.',
    emptyTitle: 'No decisions yet', emptyBody: 'Story choices you make show up here.', chose: 'You chose', happened: 'What happened', hide: 'Hide it', first: 'The first time', more: 'Show more',
    clear: 'Clear journal', clearBody: 'This removes your saved choices. Your progress stays.', clearYes: 'Yes, clear', clearNo: 'Keep it', cleared: 'Your journal is empty now.', clearFailed: 'Could not clear it. Try again.',
    bridgeTitle: 'Try it for real', learned: 'You learned', bridge: { savings_goal: 'Pick something real to save for this month.', earning_task: 'Keep track of what you earn this week.' },
    tryIt: 'I will try', notNow: 'Not now', planned: 'Saved as your plan.', bridgeClosed: 'This idea has closed.', bridgeFailed: 'Could not save it. Try again.',
  },
  'es-MX': {
    title: 'Mis decisiones', back: 'Volver', loading: 'Cargando tus decisiones', retry: 'Reintentar', errorTitle: 'Diario no disponible', errorBody: 'No pudimos cargarlo. Inténtalo de nuevo.',
    emptyTitle: 'Aún no hay decisiones', emptyBody: 'Aquí aparecen tus elecciones en las historias.', chose: 'Elegiste', happened: 'Qué pasó', hide: 'Ocultar', first: 'La primera vez', more: 'Ver más',
    clear: 'Borrar diario', clearBody: 'Esto borra tus elecciones guardadas. Tu progreso se queda.', clearYes: 'Sí, borrar', clearNo: 'Conservarlo', cleared: 'Tu diario está vacío.', clearFailed: 'No se pudo borrar. Inténtalo de nuevo.',
    bridgeTitle: 'Pruébalo de verdad', learned: 'Aprendiste', bridge: { savings_goal: 'Elige algo real para ahorrar este mes.', earning_task: 'Anota lo que ganes esta semana.' },
    tryIt: 'Lo intentaré', notNow: 'Ahora no', planned: 'Guardado como tu plan.', bridgeClosed: 'Esta idea ya cerró.', bridgeFailed: 'No se pudo guardar. Inténtalo de nuevo.',
  },
  'pt-BR': {
    title: 'Minhas decisões', back: 'Voltar', loading: 'Carregando suas decisões', retry: 'Tentar de novo', errorTitle: 'Diário indisponível', errorBody: 'Não foi possível carregar. Tente de novo.',
    emptyTitle: 'Nenhuma decisão ainda', emptyBody: 'Suas escolhas nas histórias aparecem aqui.', chose: 'Você escolheu', happened: 'O que aconteceu', hide: 'Ocultar', first: 'Na primeira vez', more: 'Ver mais',
    clear: 'Apagar diário', clearBody: 'Isso apaga suas escolhas salvas. Seu progresso fica.', clearYes: 'Sim, apagar', clearNo: 'Manter', cleared: 'Seu diário está vazio.', clearFailed: 'Não foi possível apagar. Tente de novo.',
    bridgeTitle: 'Tente de verdade', learned: 'Você aprendeu', bridge: { savings_goal: 'Escolha algo real para poupar este mês.', earning_task: 'Anote o que você ganhar nesta semana.' },
    tryIt: 'Vou tentar', notNow: 'Agora não', planned: 'Salvo como seu plano.', bridgeClosed: 'Esta ideia já fechou.', bridgeFailed: 'Não foi possível salvar. Tente de novo.',
  },
};

/**
 * B.13, Option B: an independent teen's "try it for real" prompts. Shared by
 * the journal and the learner shortcut. Renders nothing when there are none
 * (Core sends none to any other learner). Answering "I will try" records the
 * teen's own plan and creates nothing.
 */
export function SelfBridgeList({ bridges, locale, onBridge }: {
  bridges: SelfBridge[];
  locale: Locale;
  onBridge: (id: string, answer: 'act' | 'dismiss') => Promise<BridgeOutcome>;
}) {
  const t = decisionJournalCopy[locale];
  const headingId = useId();
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<Record<string, 'planned' | 'dismissed' | 'closed' | 'failed'>>({});

  async function answer(id: string, choice: 'act' | 'dismiss') {
    if (busy) return;
    setBusy(true);
    const outcome = await onBridge(id, choice);
    setBusy(false);
    setAnswered((prev) => ({ ...prev, [id]: outcome === 'done' ? (choice === 'act' ? 'planned' : 'dismissed') : outcome === 'closed' ? 'closed' : 'failed' }));
  }

  const visible = bridges.filter((b) => answered[b.id] !== 'dismissed');
  if (visible.length === 0) return null;
  return <section className="lf-journal-section" aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{t.bridgeTitle}</h2>
    {visible.map((b) => {
      const state = answered[b.id];
      return <article key={b.id} className="lf-bridge-self" aria-label={t.bridgeTitle}>
        <p data-copy-role="body">{t.learned}</p>
        <span className="lf-bridge-self-skill" data-copy-role="data">{localizedText(b.skill, locale)}</span>
        <p data-copy-role="body">{t.bridge[b.action]}</p>
        {state === 'planned' ? <InlineNotice tone="success" live>{t.planned}</InlineNotice>
          : state === 'closed' ? <InlineNotice tone="info" live>{t.bridgeClosed}</InlineNotice>
            : <>
              {state === 'failed' ? <InlineNotice tone="error" live>{t.bridgeFailed}</InlineNotice> : null}
              <div className="lf-actions">
                <Button variant="accent" disabled={busy} onClick={() => void answer(b.id, 'act')}>{t.tryIt}</Button>
                <Button disabled={busy} onClick={() => void answer(b.id, 'dismiss')}>{t.notNow}</Button>
              </div>
            </>}
      </article>;
    })}
  </section>;
}

export function DecisionJournalView({ state, locale, dark, onBack, onRetry, onMore, onClear, onBridge, loadingMore = false, fixture = false }: {
  state: JournalState;
  locale: Locale;
  dark: boolean;
  onBack: () => void;
  onRetry?: () => void;
  onMore?: () => void;
  /** Resolves true when Core cleared the journal. */
  onClear: () => Promise<boolean>;
  onBridge: (id: string, answer: 'act' | 'dismiss') => Promise<BridgeOutcome>;
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
  return <div className="lf-rebuild lf-learner-page lf-journal" data-theme={theme} lang={locale} data-surface="app"
    data-screen={state.status === 'ready' ? (fixture ? 'journal-preview' : 'journal') : `journal-${state.status}`} aria-busy={state.status === 'loading'}>
    <div className={`lf-journal-inner${state.status === 'ready' ? '' : ' lf-journal-state'}`}>
      <div className="lf-journal-top">
        <Button onClick={onBack}>{t.back}</Button>
      </div>
      <h1 data-copy-role="heading">{state.status === 'loading' ? t.loading : state.status === 'error' ? t.errorTitle : t.title}</h1>
      {state.status === 'ready'
        ? <ReadyJournal key={state.entries.length === 0 ? 'empty' : 'list'} state={state} locale={locale} t={t}
          onMore={onMore} onClear={onClear} onBridge={onBridge} loadingMore={loadingMore} />
        : state.status === 'error' ? <>
          <p data-copy-role="body">{t.errorBody}</p>
          {onRetry ? <div className="lf-actions"><Button variant="accent" onClick={onRetry}>{t.retry}</Button></div> : null}
        </> : null}
    </div>
  </div>;
}

function ReadyJournal({ state, locale, t, onMore, onClear, onBridge, loadingMore }: {
  state: Extract<JournalState, { status: 'ready' }>; locale: Locale; t: Copy; onMore?: () => void; onClear: () => Promise<boolean>;
  onBridge: (id: string, answer: 'act' | 'dismiss') => Promise<BridgeOutcome>; loadingMore: boolean;
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
      <SelfBridgeList bridges={state.bridges} locale={locale} onBridge={onBridge} />

      {entries.length === 0 ? <section className="lf-journal-section" aria-labelledby={emptyId}>
        <h2 id={emptyId} data-copy-role="heading">{t.emptyTitle}</h2>
        <p data-copy-role="body">{clearNotice === 'cleared' ? t.cleared : t.emptyBody}</p>
      </section> : <section className="lf-journal-section" aria-label={t.title}>
        <ol className="lf-journal-list">
          {entries.map((entry) => <JournalCard key={entry.id} entry={entry} locale={locale} t={t} />)}
        </ol>
        {state.hasMore && onMore ? <Button aria-busy={loadingMore} disabled={loadingMore} onClick={onMore}>{t.more}</Button> : null}
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

function JournalCard({ entry, locale, t }: { entry: JournalEntry; locale: Locale; t: Copy }) {
  const [open, setOpen] = useState(false);
  const detailsId = `lf-journal-details-${entry.id}`;
  return <li className="lf-journal-entry">
    <p className="lf-journal-meta"><span data-copy-role="data">{localizedText(entry.course.title, locale)}</span><span data-copy-role="data">{localizedText(entry.lesson.title, locale)}</span></p>
    <p className="lf-journal-choice">
      <span data-copy-role="body">{t.chose}</span>
      <span data-copy-role="narrative">{entry.choice}</span>
    </p>
    {/* Layering (Bible 06): the situation, what happened and a changed mind open with one tap. A named icon
        button, so the first view carries no extra words per entry. */}
    <IconButton glyph="chevron" label={open ? t.hide : t.happened} className="lf-journal-toggle" aria-expanded={open} aria-controls={detailsId}
      onClick={() => setOpen(!open)} />
    {open ? <div id={detailsId} className="lf-journal-details">
      <p className="lf-journal-situation" data-copy-role="narrative">{entry.situation}</p>
      {entry.outcome ? <p className="lf-journal-outcome"><span data-copy-role="body">{t.happened}</span>{' '}<span data-copy-role="narrative">{entry.outcome}</span></p> : null}
      {entry.firstChoice ? <p className="lf-journal-first"><span data-copy-role="body">{t.first}</span>{' '}<span data-copy-role="narrative">{entry.firstChoice}</span></p> : null}
    </div> : null}
  </li>;
}
