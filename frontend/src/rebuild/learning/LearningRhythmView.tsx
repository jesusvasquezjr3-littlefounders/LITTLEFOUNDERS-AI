import { useId, useState, type KeyboardEvent } from 'react';
import { StreakStrip } from './StreakStrip';
import type { Locale } from '../design/copyBudget';
import { Button, ErrorState, InlineNotice, LoadingState } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './learnerPage.css';
import './rhythm.css';
import { MENTOR_NAMES, type Pace, type RhythmState, type StreakView } from './motivation';

/*
 * B.21 / B.24 (S05.3e) — the learner's rhythm: their habit streak and their
 * own choices.
 *
 * The streak (Frontend Bible 02 §9.6): the live run, the best streak and the
 * days practised, the rest days left this week and the rule in one line. A
 * broken run reads "Streak resting" with the best still visible, never "lost";
 * a guardian's holiday pause reads as paused. No loss or guilt copy, no
 * reminder, no counter of missed days, and nothing here celebrates (OD-7: the
 * 7-, 30- and 100-day marks celebrate on the lesson result, once).
 *
 * The choices (B.24): pace (how many lessons a day is the learner's plan,
 * saved at once), the next lesson (the course path's frontier) and the Mentor.
 * Layering (Bible 06): two tabs, the streak first, so the youngest learner's
 * first view stays within the Copy Budget.
 * Avatar customization is deliberately absent: it is not an autonomy lever.
 *
 * A dashboard of independent cards: a neutral page with coloured cards
 * (rule 15). Presentation only: the host owns transport and navigation.
 */

type Copy = {
  title: string; back: string; loading: string; errorTitle: string; errorBody: string; retry: string;
  streak: string; days: (n: number) => string; resting: string; restingBody: string; none: string; today: string; tabs: string;
  paused: (date: string) => string; best: string; practiced: string; restLeft: string; rule: string;
  pace: string; paceToday: (done: number, goal: number) => string; paceDone: string; saved: string; saveFailed: string;
  choices: string; path: string; mentor: (name: string) => string; changeMentor: string;
};

export const learningRhythmCopy: Record<Locale, Copy> = {
  'en-US': {
    title: 'Your rhythm', back: 'Go back', loading: 'Loading your rhythm', errorTitle: 'Rhythm unavailable', errorBody: 'We could not load it. Try again.', retry: 'Try again',
    streak: 'Streak', days: (n) => (n === 1 ? 'day' : 'days'), resting: 'Streak resting', restingBody: 'Your best stays.', tabs: 'Your rhythm',
    none: 'Pass a lesson to start.', today: 'You practiced today.', paused: (date) => `Paused until ${date}.`,
    best: 'Best', practiced: 'Days practiced', restLeft: 'Rest days left', rule: 'Every week has 2 rest days.',
    pace: 'Lessons a day', paceToday: (done, goal) => `Today: ${done} of ${goal}.`, paceDone: 'Today\'s plan is done.',
    saved: 'Saved.', saveFailed: 'Could not save. Try again.',
    choices: 'Choices', path: 'Pick a lesson', mentor: (name) => `Your Mentor: ${name}`, changeMentor: 'Change Mentor',
  },
  'es-MX': {
    title: 'Tu ritmo', back: 'Volver', loading: 'Cargando tu ritmo', errorTitle: 'Ritmo no disponible', errorBody: 'No pudimos cargarlo. Inténtalo de nuevo.', retry: 'Reintentar',
    streak: 'Racha', days: (n) => (n === 1 ? 'día' : 'días'), resting: 'Racha en descanso', restingBody: 'Tu mejor marca se queda.', tabs: 'Tu ritmo',
    none: 'Termina una lección para empezar.', today: 'Hoy ya practicaste.', paused: (date) => `En pausa hasta el ${date}.`,
    best: 'Mejor', practiced: 'Días practicados', restLeft: 'Días de descanso libres', rule: 'Cada semana tiene 2 días de descanso.',
    pace: 'Lecciones al día', paceToday: (done, goal) => `Hoy: ${done} de ${goal}.`, paceDone: 'Tu plan de hoy está listo.',
    saved: 'Guardado.', saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
    choices: 'Elecciones', path: 'Elige lección', mentor: (name) => `Tu Mentor: ${name}`, changeMentor: 'Cambiar Mentor',
  },
  'pt-BR': {
    title: 'Seu ritmo', back: 'Voltar', loading: 'Carregando seu ritmo', errorTitle: 'Ritmo indisponível', errorBody: 'Não foi possível carregar. Tente de novo.', retry: 'Tentar de novo',
    streak: 'Sequência', days: (n) => (n === 1 ? 'dia' : 'dias'), resting: 'Sequência em descanso', restingBody: 'Seu recorde fica.', tabs: 'Seu ritmo',
    none: 'Conclua uma lição para começar.', today: 'Você praticou hoje.', paused: (date) => `Pausada até ${date}.`,
    best: 'Recorde', practiced: 'Dias praticados', restLeft: 'Dias de descanso livres', rule: 'Toda semana tem 2 dias de descanso.',
    pace: 'Lições por dia', paceToday: (done, goal) => `Hoje: ${done} de ${goal}.`, paceDone: 'Seu plano de hoje está feito.',
    saved: 'Salvo.', saveFailed: 'Não foi possível salvar. Tente de novo.',
    choices: 'Escolhas', path: 'Escolher lição', mentor: (name) => `Seu Mentor: ${name}`, changeMentor: 'Trocar Mentor',
  },
};

function formatDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

export function StreakCard({ streak, locale }: { streak: StreakView; locale: Locale }) {
  const t = learningRhythmCopy[locale];
  const n = new Intl.NumberFormat(locale);
  const status = streak.status === 'resting' ? t.restingBody
    : streak.status === 'none' ? t.none
      : streak.status === 'practiced_today' ? t.today
        : streak.status === 'paused' && streak.pause ? t.paused(formatDay(streak.pause.endsOn, locale)) : null;
  return <section className="lf-rhythm-streak" data-status={streak.status} aria-label={t.streak}>
    {streak.status === 'resting' ? <h2 data-copy-role="heading">{t.resting}</h2> : null}
    {streak.status === 'resting' || streak.status === 'none' ? null
      : <p className="lf-rhythm-count"><img src="/rebuild/art/streak-flame.svg" alt="" className="lf-rhythm-flame" />
        <strong data-copy-role="data">{n.format(streak.current)}</strong><span data-copy-role="body">{t.days(streak.current)}</span></p>}
    {status ? <p className="lf-rhythm-status" data-copy-role="body">{status}</p> : null}
    {streak.week ? <StreakStrip week={streak.week} locale={locale} /> : null}
    <dl className="lf-rhythm-facts">
      <div><dt data-copy-role="body">{t.best}</dt><dd data-copy-role="data">{n.format(streak.best)}</dd></div>
      <div><dt data-copy-role="body">{t.practiced}</dt><dd data-copy-role="data">{n.format(streak.daysPracticed)}</dd></div>
      <div><dt data-copy-role="body">{t.restLeft}</dt><dd data-copy-role="data">{n.format(streak.restDaysLeft)}</dd></div>
    </dl>
    <p className="lf-rhythm-rule" data-copy-role="body">{t.rule}</p>
  </section>;
}

export function LearningRhythmView({ state, locale, dark, onBack, onRetry, onSavePace, onOpenPath, onOpenMentor, fixture = false }: {
  state: RhythmState;
  locale: Locale;
  dark: boolean;
  onBack: () => void;
  onRetry: () => void;
  onSavePace: (goal: 1 | 2 | 3) => Promise<Pace | null>;
  onOpenPath: () => void;
  onOpenMentor: () => void;
  fixture?: boolean;
}) {
  const t = learningRhythmCopy[locale];
  const ids = useId();
  const [tab, setTab] = useState<'streak' | 'choices'>('streak');
  const [pace, setPace] = useState<Pace | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'failed' | null>(null);
  const shownPace = pace ?? (state.status === 'ready' ? state.rhythm.pace : null);
  const tabs = [{ key: 'streak' as const, label: t.streak }, { key: 'choices' as const, label: t.choices }];

  async function choose(goal: 1 | 2 | 3) {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    const next = await onSavePace(goal);
    setSaving(false);
    if (next) setPace(next);
    setNotice(next ? 'saved' : 'failed');
  }

  /* WAI-ARIA tabs: arrows move between the two tabs; Tab enters the panel. */
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'streak' : event.key === 'End' ? 'choices' : tab === 'streak' ? 'choices' : 'streak';
    setTab(next);
    document.getElementById(`${ids}-tab-${next}`)?.focus();
  }

  return <div className="lf-rebuild lf-learner-page lf-rhythm" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'rhythm-preview' : 'rhythm'}>
    <div className="lf-rhythm-inner">
      <div className="lf-rhythm-top">
        <Button onClick={onBack}>{t.back}</Button>
        <h1 data-copy-role="heading">{t.title}</h1>
      </div>
      {state.status === 'loading' ? <div className="lf-rhythm-state"><LoadingState label={t.loading} lines={2} /></div>
        : state.status === 'error' ? <div className="lf-rhythm-state">
          <ErrorState heading={t.errorTitle} body={t.errorBody} retryLabel={t.retry} retryingLabel={t.loading} onRetry={onRetry} /></div>
          : <>
            <div className="lf-rhythm-tabs" role="tablist" aria-label={t.tabs}>
              {tabs.map(({ key, label }) => <Button key={key} role="tab" id={`${ids}-tab-${key}`} className="lf-rhythm-tab"
                variant={tab === key ? 'brand' : 'secondary'} aria-selected={tab === key} aria-controls={`${ids}-panel-${key}`} tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)} onKeyDown={onTabKey}>{label}</Button>)}
            </div>
            <div role="tabpanel" id={`${ids}-panel-streak`} aria-labelledby={`${ids}-tab-streak`} hidden={tab !== 'streak'}>
              <StreakCard streak={state.rhythm.streak} locale={locale} />
            </div>
            <div role="tabpanel" id={`${ids}-panel-choices`} aria-labelledby={`${ids}-tab-choices`} hidden={tab !== 'choices'} className="lf-rhythm-panel">
              <section className="lf-rhythm-pace" aria-labelledby={`${ids}-pace`}>
                <h2 id={`${ids}-pace`} data-copy-role="heading">{t.pace}</h2>
                <div className="lf-rhythm-options" role="radiogroup" aria-labelledby={`${ids}-pace`}>
                  {([1, 2, 3] as const).map((goal) => <Button key={goal} role="radio" aria-checked={shownPace?.goal === goal}
                    variant={shownPace?.goal === goal ? 'accent' : 'secondary'} disabled={saving} onClick={() => void choose(goal)}>
                    {new Intl.NumberFormat(locale).format(goal)}</Button>)}
                </div>
                {shownPace ? <p className="lf-rhythm-today" data-copy-role="body">
                  {shownPace.goalMet ? t.paceDone : t.paceToday(shownPace.passedToday, shownPace.goal)}</p> : null}
                {notice ? <div className="lf-rhythm-notice"><InlineNotice tone={notice === 'saved' ? 'success' : 'error'} live>
                  {notice === 'saved' ? t.saved : t.saveFailed}</InlineNotice></div> : null}
              </section>
              <section className="lf-rhythm-choices" aria-label={t.choices}>
                <p data-copy-role="body">{t.mentor(MENTOR_NAMES[state.rhythm.mentor.character])}</p>
                <div className="lf-actions">
                  <Button onClick={onOpenPath}>{t.path}</Button>
                  <Button onClick={onOpenMentor}>{t.changeMentor}</Button>
                </div>
              </section>
            </div>
          </>}
    </div>
  </div>;
}
