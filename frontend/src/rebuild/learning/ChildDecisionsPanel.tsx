import { useCallback, useEffect, useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, ErrorState, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './narrative.css';
import { fetchChildDecisions, type ChildDecision, type ChildDecisionsState, type ChildDecisionsTransport } from './childDecisions';

/*
 * OD-27 (3), owner review item L-13 — the verified Tutor sees which option a
 * parent-created child under 13 chose in each story decision, with the
 * situation it answered. Nothing else of the journal: no first choice, no
 * outcome, no score. A teen's journal stays private, and then this panel
 * renders nothing at all (Core answers JOURNAL_PRIVATE; the host needs no age
 * logic of its own). The child's own journal says that the Tutor can see the
 * choices.
 *
 * Owned by the learner lane (the journal's data) and mounted by the Family
 * Hub's child learning panels (Lane 4), beside the B.10 narrative. Adult
 * register (B.23): direct, the choices first, one press to open.
 */

type Copy = { title: string; open: string; close: string; loading: string; retry: string; error: string; empty: string; chose: string; more: string };

export const childDecisionsCopy: Record<Locale, Copy> = {
  'en-US': { title: 'Story choices', open: 'See choices', close: 'Hide choices', loading: 'Loading choices', retry: 'Try again',
    error: 'Could not load the choices.', empty: 'No story choices yet.', chose: 'Chose', more: 'Show more' },
  'es-MX': { title: 'Elecciones en historias', open: 'Ver elecciones', close: 'Ocultar elecciones', loading: 'Cargando elecciones', retry: 'Reintentar',
    error: 'No se pudieron cargar las elecciones.', empty: 'Aún no hay elecciones.', chose: 'Eligió', more: 'Ver más' },
  'pt-BR': { title: 'Escolhas nas histórias', open: 'Ver escolhas', close: 'Ocultar escolhas', loading: 'Carregando escolhas', retry: 'Tentar de novo',
    error: 'Não foi possível carregar as escolhas.', empty: 'Nenhuma escolha ainda.', chose: 'Escolheu', more: 'Ver mais' },
};

/** Presentation only, for the host and the preview. */
export function ChildDecisionsView({ state, locale, dark, open, onToggle, onRetry, onMore, loadingMore = false, fixture = false }: {
  state: ChildDecisionsState; locale: Locale; dark: boolean; open: boolean; onToggle: () => void; onRetry: () => void;
  onMore?: () => void; loadingMore?: boolean; fixture?: boolean;
}) {
  const t = childDecisionsCopy[locale];
  const titleId = useId();
  if (state.status === 'private') return null;
  return <section className="lf-rebuild lf-child-decisions" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'child-decisions-preview' : 'child-decisions'} aria-labelledby={titleId}>
    <div className="lf-child-decisions-head">
      <h2 id={titleId} data-copy-role="heading">{t.title}</h2>
      <Button aria-expanded={open} onClick={onToggle}>{open ? t.close : t.open}</Button>
    </div>
    {!open ? null : state.status === 'loading' ? <LoadingState label={t.loading} lines={2} />
      : state.status === 'error' ? <ErrorState heading={t.error} retryLabel={t.retry} retryingLabel={t.loading} onRetry={onRetry} />
        : state.entries.length === 0 ? <p data-copy-role="body">{t.empty}</p>
          : <>
            <ol className="lf-journal-list">
              {state.entries.map((entry) => <ChildDecisionItem key={entry.id} entry={entry} locale={locale} chose={t.chose} />)}
            </ol>
            {state.hasMore && onMore ? <Button pending={loadingMore} onClick={onMore}>{t.more}</Button> : null}
          </>}
  </section>;
}

function ChildDecisionItem({ entry, locale, chose }: { entry: ChildDecision; locale: Locale; chose: string }) {
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(entry.recordedAt));
  return <li className="lf-journal-entry">
    <p className="lf-journal-meta"><span data-copy-role="data">{entry.courseTitle}</span><span data-copy-role="data">{entry.lessonTitle}</span>
      <span data-copy-role="data">{date}</span></p>
    <p className="lf-journal-situation" data-copy-role="narrative">{entry.situation}</p>
    <p className="lf-journal-choice"><span data-copy-role="body">{chose}</span><span data-copy-role="narrative">{entry.choice}</span></p>
  </li>;
}

/**
 * The mountable panel: owns its transport calls for one child. The first page
 * loads on mount, so a teen's private journal never shows even a heading; the
 * choices themselves open with one press.
 */
export function ChildDecisionsPanel({ kidId, locale, dark, transport }: { kidId: string; locale: Locale; dark: boolean; transport: ChildDecisionsTransport }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ChildDecisionsState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const load = useCallback(() => fetchChildDecisions(transport, kidId), [transport, kidId]);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void load().then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [load, revision]);

  async function more() {
    if (state.status !== 'ready' || loadingMore) return;
    setLoadingMore(true);
    const next = await fetchChildDecisions(transport, kidId, state.entries.length);
    setLoadingMore(false);
    if (next.status === 'ready') setState({ status: 'ready', entries: [...state.entries, ...next.entries], hasMore: next.hasMore });
  }

  return <ChildDecisionsView state={state} locale={locale} dark={dark} open={open} onToggle={() => setOpen((value) => !value)}
    onRetry={() => setRevision((n) => n + 1)} onMore={() => void more()} loadingMore={loadingMore} />;
}
