import { ApplicationArt } from '../design/ApplicationArt';
import { useId, useState } from 'react';
import type { AgeBand, Locale } from '../design/copyBudget';
import { Art, Button, InlineNotice } from '../design/controls';
import { TextField } from '../design/fields';
import '../design/tokens.css';
import '../design/system.css';
import './learnerPage.css';
import './narrative.css';
import { localizedText } from './coursePath';
import type { BridgeAnswer, JournalEntry, JournalState, SelfBridge } from './narrative';

/*
 * B.9 / S05.3c — the learner's decision journal: the story choices they made
 * across lessons, what happened next, and where they changed their mind. It
 * is the learner's own record and they can clear it; their progress, scores
 * and coins are untouched by that. Core shows it to nobody else, with one
 * exception the page says out loud: the verified Tutor of a parent-created
 * child under 13 sees which option the child chose (OD-27 (3)).
 *
 * B.13, Option B — an independent teen also sees "Try it for real": a
 * self-directed prompt after a topic that teaches a real-world money skill.
 * Answering it records their own plan; on a savings prompt the teen may name a
 * goal, which Core creates in their own Wallet (OD-28, L-12). Core sends these
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
  emptyTitle: string; emptyBody: string; chose: string; happened: string; first: string; more: string; lead: string; echoOne: string; echoMany: string; emptyAction: string;
  changed: string; clear: string; clearBody: string; clearYes: string; clearNo: string; cleared: string; clearFailed: string;
  bridgeTitle: string; learned: string; bridge: Record<SelfBridge['action'], string>; tryIt: string; notNow: string;
  planned: string; bridgeClosed: string; bridgeFailed: string;
  /** OD-28 (L-12): the teen's own savings goal from a savings prompt. */
  goalName: string; goalTarget: string; createGoal: string; planOnly: string; goalCreated: string; noWallet: string;
  /** W3L.1 (L-12): the created goal named back, and the way to it. `{n}` is the coins. */
  goalCoins: string; openWallet: string;
  /** OD-27 (3): said on the journal of a parent-created child under 13, whose Tutor sees the chosen options. */
  tutorSees: string;
};

export const decisionJournalCopy: Record<Locale, Copy> = {
  'en-US': {
    title: 'My decisions', back: 'Go back', loading: 'Loading your decisions', retry: 'Try again', errorTitle: 'Journal unavailable', errorBody: 'We could not load it. Try again.',
    emptyTitle: 'No decisions yet', emptyBody: 'Story choices you make show up here.', chose: 'You chose', happened: 'What happened', first: 'The first time', more: 'Show more',
    changed: 'You changed your mind', lead: 'What you chose in the stories, and what happened next.', echoOne: 'It came back in the story', echoMany: 'It came back {n} times', emptyAction: 'Go and learn',
    clear: 'Clear journal', clearBody: 'This removes your saved choices. Your progress stays.', clearYes: 'Yes, clear', clearNo: 'Keep it', cleared: 'Your journal is empty now.', clearFailed: 'Could not clear it. Try again.',
    bridgeTitle: 'Try it for real', learned: 'You learned', bridge: { savings_goal: 'Pick something real to save for this month.', earning_task: 'Keep track of what you earn this week.' },
    tryIt: 'I will try', notNow: 'Not now', planned: 'Saved as your plan.', bridgeClosed: 'This idea has closed.', bridgeFailed: 'Could not save it. Try again.',
    goalName: 'What will you save for?', goalTarget: 'Seeds to save', createGoal: 'Create goal', planOnly: 'Just a plan',
    goalCreated: 'Goal added to your Wallet.', noWallet: 'Your Wallet is not open.', goalCoins: '{n} seeds to save', openWallet: 'See my Wallet',
    tutorSees: 'Your Tutor sees your choices.',
  },
  'es-MX': {
    title: 'Mis decisiones', back: 'Volver', loading: 'Cargando tus decisiones', retry: 'Reintentar', errorTitle: 'Diario no disponible', errorBody: 'No pudimos cargarlo. Inténtalo de nuevo.',
    emptyTitle: 'Aún no hay decisiones', emptyBody: 'Aquí aparecen tus elecciones en las historias.', chose: 'Elegiste', happened: 'Qué pasó', first: 'La primera vez', more: 'Ver más',
    changed: 'Cambiaste de idea', lead: 'Lo que elegiste en las historias y lo que pasó después.', echoOne: 'Volvió a aparecer en la historia', echoMany: 'Volvió a aparecer {n} veces', emptyAction: 'Ir a aprender',
    clear: 'Borrar diario', clearBody: 'Esto borra tus elecciones guardadas. Tu progreso se queda.', clearYes: 'Sí, borrar', clearNo: 'Conservarlo', cleared: 'Tu diario está vacío.', clearFailed: 'No se pudo borrar. Inténtalo de nuevo.',
    bridgeTitle: 'Pruébalo de verdad', learned: 'Aprendiste', bridge: { savings_goal: 'Elige algo real para ahorrar este mes.', earning_task: 'Anota lo que ganes esta semana.' },
    tryIt: 'Lo intentaré', notNow: 'Ahora no', planned: 'Guardado como tu plan.', bridgeClosed: 'Esta idea ya cerró.', bridgeFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    goalName: '¿Para qué vas a ahorrar?', goalTarget: 'Semillas por ahorrar', createGoal: 'Crear meta', planOnly: 'Solo un plan',
    goalCreated: 'Meta agregada a tu Cartera.', noWallet: 'Tu Cartera no está abierta.', goalCoins: '{n} semillas por ahorrar', openWallet: 'Ver mi Cartera',
    tutorSees: 'Tu Tutor ve tus elecciones.',
  },
  'pt-BR': {
    title: 'Minhas decisões', back: 'Voltar', loading: 'Carregando suas decisões', retry: 'Tentar de novo', errorTitle: 'Diário indisponível', errorBody: 'Não foi possível carregar. Tente de novo.',
    emptyTitle: 'Nenhuma decisão ainda', emptyBody: 'Suas escolhas nas histórias aparecem aqui.', chose: 'Você escolheu', happened: 'O que aconteceu', first: 'Na primeira vez', more: 'Ver mais',
    changed: 'Você mudou de ideia', lead: 'O que você escolheu nas histórias e o que aconteceu depois.', echoOne: 'Voltou a aparecer na história', echoMany: 'Voltou a aparecer {n} vezes', emptyAction: 'Ir aprender',
    clear: 'Apagar diário', clearBody: 'Isso apaga suas escolhas salvas. Seu progresso fica.', clearYes: 'Sim, apagar', clearNo: 'Manter', cleared: 'Seu diário está vazio.', clearFailed: 'Não foi possível apagar. Tente de novo.',
    bridgeTitle: 'Tente de verdade', learned: 'Você aprendeu', bridge: { savings_goal: 'Escolha algo real para poupar este mês.', earning_task: 'Anote o que você ganhar nesta semana.' },
    tryIt: 'Vou tentar', notNow: 'Agora não', planned: 'Salvo como seu plano.', bridgeClosed: 'Esta ideia já fechou.', bridgeFailed: 'Não foi possível salvar. Tente de novo.',
    goalName: 'Para que você vai poupar?', goalTarget: 'Sementes para poupar', createGoal: 'Criar meta', planOnly: 'Só um plano',
    goalCreated: 'Meta adicionada à sua Carteira.', noWallet: 'Sua Carteira não está aberta.', goalCoins: '{n} sementes para poupar', openWallet: 'Ver minha Carteira',
    tutorSees: 'Seu Tutor vê suas escolhas.',
  },
};

type BridgeState = 'planned' | 'goal' | 'dismissed' | 'closed' | 'failed' | 'no_wallet';

/** The goal limits Core and the database enforce (a 1 to 80 character title, 1 to 100,000 coins). */
export function selfGoalFrom(title: string, target: string): { title: string; target: number } | null {
  const name = title.trim();
  const coins = Number(target);
  return name.length >= 1 && name.length <= 80 && Number.isInteger(coins) && coins >= 1 && coins <= 100000 ? { title: name, target: coins } : null;
}

/**
 * B.13, Option B: an independent teen's "try it for real" prompts. Shared by
 * the journal, the learning home and the learner shortcut. Renders nothing
 * when there are none (Core sends none to any other learner). On a savings
 * prompt, "I will try" opens the teen's own goal (a name and the coins to
 * save), created in their Wallet (OD-28, L-12), or kept as a plan alone; on an
 * earning prompt it records the plan (tasks stay guardian-only, OD-3).
 *
 * W3L.1 (L-12): "Goal added" is said only when Core answered the goal it
 * created (a replayed plan reads as the plan), with the goal named back and,
 * when the host gives one, the way to the Wallet where it now lives.
 */
export function SelfBridgeList({ bridges, locale, onBridge, onOpenWallet }: {
  bridges: SelfBridge[];
  locale: Locale;
  onBridge: BridgeAnswer;
  /** Opens the teen's Wallet (the host knows the route). */
  onOpenWallet?: () => void;
}) {
  const t = decisionJournalCopy[locale];
  const headingId = useId();
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<Record<string, BridgeState>>({});
  const [composing, setComposing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', target: '' });
  const [created, setCreated] = useState<Record<string, { title: string; target: number }>>({});

  async function answer(id: string, choice: 'act' | 'dismiss', goal?: { title: string; target: number }) {
    if (busy) return;
    setBusy(true);
    const outcome = await onBridge(id, choice, goal);
    setBusy(false);
    const next: BridgeState = outcome === 'goal' ? 'goal' : outcome === 'done' ? (choice === 'dismiss' ? 'dismissed' : 'planned')
      : outcome === 'closed' ? 'closed' : outcome === 'no_wallet' ? 'no_wallet' : 'failed';
    if (outcome === 'goal' && goal) setCreated((prev) => ({ ...prev, [id]: goal }));
    if (outcome === 'done' || outcome === 'goal' || outcome === 'closed') setComposing(null);
    setAnswered((prev) => ({ ...prev, [id]: next }));
  }

  function tryIt(b: SelfBridge) {
    if (b.action !== 'savings_goal') return void answer(b.id, 'act');
    setDraft({ title: '', target: '' });
    setComposing(b.id);
  }

  const goal = selfGoalFrom(draft.title, draft.target);
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
          : state === 'goal' ? <div className="lf-bridge-self-created">
            <InlineNotice tone="success" live>{t.goalCreated}</InlineNotice>
            {created[b.id] ? <p className="lf-bridge-self-goal-named"><span data-copy-role="data">{created[b.id]!.title}</span>{' '}
              <span data-copy-role="body">{t.goalCoins.replace('{n}', new Intl.NumberFormat(locale).format(created[b.id]!.target))}</span></p> : null}
            {onOpenWallet ? <div className="lf-actions"><Button onClick={onOpenWallet}>{t.openWallet}</Button></div> : null}
          </div>
            : state === 'closed' ? <InlineNotice tone="info" live>{t.bridgeClosed}</InlineNotice>
              : composing === b.id ? <form className="lf-bridge-self-goal" onSubmit={(event) => { event.preventDefault(); if (goal) void answer(b.id, 'act', goal); }}>
                {state === 'failed' ? <InlineNotice tone="error" live>{t.bridgeFailed}</InlineNotice> : null}
                {state === 'no_wallet' ? <InlineNotice tone="info" live>{t.noWallet}</InlineNotice> : null}
                <TextField label={t.goalName} value={draft.title} maxLength={80} autoComplete="off" disabled={busy}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} />
                <TextField label={t.goalTarget} type="number" inputMode="numeric" min={1} max={100000} step={1} value={draft.target} disabled={busy}
                  onChange={(event) => setDraft((prev) => ({ ...prev, target: event.target.value }))} />
                <div className="lf-actions">
                  <Button type="submit" variant="accent" disabled={busy || !goal}>{t.createGoal}</Button>
                  <Button type="button" disabled={busy} onClick={() => void answer(b.id, 'act')}>{t.planOnly}</Button>
                </div>
              </form>
                : <>
                  {state === 'failed' ? <InlineNotice tone="error" live>{t.bridgeFailed}</InlineNotice> : null}
                  <div className="lf-actions">
                    <Button variant="accent" disabled={busy} onClick={() => tryIt(b)}>{t.tryIt}</Button>
                    <Button disabled={busy} onClick={() => void answer(b.id, 'dismiss')}>{t.notNow}</Button>
                  </div>
                </>}
      </article>;
    })}
  </section>;
}

export function DecisionJournalView({ state, locale, dark, ageBand, onBack, onRetry, onMore, onClear, onBridge, onOpenWallet, loadingMore = false, fixture = false }: {
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
  onBridge: BridgeAnswer;
  /** W3L.1 (L-12): opens the teen's Wallet after a goal was created there. */
  onOpenWallet?: () => void;
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
          onBack={onBack} onMore={onMore} onClear={onClear} onBridge={onBridge} onOpenWallet={onOpenWallet} loadingMore={loadingMore} />
        : state.status === 'error' ? <>
          <p data-copy-role="body">{t.errorBody}</p>
          {onRetry ? <div className="lf-actions"><Button variant="accent" onClick={onRetry}>{t.retry}</Button></div> : null}
        </> : null}
    </div>
  </div>;
}

function ReadyJournal({ state, locale, t, onBack, onMore, onClear, onBridge, onOpenWallet, loadingMore }: {
  state: Extract<JournalState, { status: 'ready' }>; locale: Locale; t: Copy; onBack: () => void; onMore?: () => void; onClear: () => Promise<boolean>;
  onBridge: BridgeAnswer; onOpenWallet?: () => void; loadingMore: boolean;
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
      {/* OD-27 (3): the child knows who else sees their choices, before the list. */}
      {state.sharedWithTutor ? <p className="lf-journal-shared" data-copy-role="body">{t.tutorSees}</p> : null}
      <SelfBridgeList bridges={state.bridges} locale={locale} onBridge={onBridge} onOpenWallet={onOpenWallet} />

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
