import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, ErrorState, InlineNotice, LoadingState, TextField } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './streakPause.css';
import { pauseRangeValid, type KidStreakState, type PauseOutcome } from './streakPause';

/*
 * B.21 / S05.3e — the verified parent (Tutor) pauses a child's learning streak
 * for a holiday or an illness (Frontend Bible 02 §9.6 rule 3). Up to 21 days,
 * starting within the last week or the next 60 days; the paused days are
 * neither practised nor missed, so a family trip never reads as a lapse.
 * Ending a pause keeps the days already paused.
 *
 * Adult register: plain, short, no pressure. It is a family control, not a
 * reward: no celebration, no counter of missed days. The child's pace stays
 * the child's own choice (B.24), so there is no pace control here.
 * Presentation only: the host panel owns transport.
 */

type Copy = {
  title: string; intro: string; rule: string; from: string; to: string; save: string; end: string;
  active: (from: string, to: string) => string; summary: (current: number, best: number, resting: boolean) => string;
  saved: string; ended: string; invalid: string; failed: string; noAccess: string; loadFailed: string; retry: string; loading: string;
};

export const streakPauseCopy: Record<Locale, Copy> = {
  'en-US': {
    title: 'Holiday pause', intro: 'Pause the streak for a trip or an illness.', rule: 'Up to 21 days. Paused days never count as missed.',
    from: 'First day', to: 'Last day', save: 'Pause streak', end: 'End pause',
    active: (a, b) => `Paused from ${a} to ${b}.`,
    summary: (c, b, resting) => (resting ? `Streak resting. Best: ${b}.` : `Streak: ${c} days. Best: ${b}.`),
    saved: 'Pause saved.', ended: 'Pause ended.', invalid: 'Pick up to 21 days, starting within the last week.',
    failed: 'Could not save. Try again.', noAccess: 'This child is no longer linked to you.', loadFailed: 'Could not load the streak.', retry: 'Try again', loading: 'Loading the streak',
  },
  'es-MX': {
    title: 'Pausa por vacaciones', intro: 'Pausa la racha por un viaje o una enfermedad.', rule: 'Hasta 21 días. Los días en pausa nunca cuentan como faltas.',
    from: 'Primer día', to: 'Último día', save: 'Pausar racha', end: 'Terminar pausa',
    active: (a, b) => `En pausa del ${a} al ${b}.`,
    summary: (c, b, resting) => (resting ? `Racha en descanso. Mejor: ${b}.` : `Racha: ${c} días. Mejor: ${b}.`),
    saved: 'Pausa guardada.', ended: 'Pausa terminada.', invalid: 'Elige hasta 21 días, empezando en la última semana.',
    failed: 'No se pudo guardar. Inténtalo de nuevo.', noAccess: 'Este niño ya no está vinculado contigo.', loadFailed: 'No se pudo cargar la racha.', retry: 'Reintentar', loading: 'Cargando la racha',
  },
  'pt-BR': {
    title: 'Pausa para férias', intro: 'Pause a sequência para uma viagem ou doença.', rule: 'Até 21 dias. Dias em pausa nunca contam como falta.',
    from: 'Primeiro dia', to: 'Último dia', save: 'Pausar sequência', end: 'Encerrar pausa',
    active: (a, b) => `Pausada de ${a} a ${b}.`,
    summary: (c, b, resting) => (resting ? `Sequência em descanso. Recorde: ${b}.` : `Sequência: ${c} dias. Recorde: ${b}.`),
    saved: 'Pausa salva.', ended: 'Pausa encerrada.', invalid: 'Escolha até 21 dias, começando na última semana.',
    failed: 'Não foi possível salvar. Tente de novo.', noAccess: 'Esta criança não está mais vinculada a você.', loadFailed: 'Não foi possível carregar a sequência.', retry: 'Tentar de novo', loading: 'Carregando a sequência',
  },
};

function formatDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

export function StreakPauseControl({ state, locale, dark, today, onPause, onEnd, onRetry, fixture = false }: {
  state: KidStreakState;
  locale: Locale;
  dark: boolean;
  today: string;
  onPause: (startsOn: string, endsOn: string) => Promise<PauseOutcome>;
  onEnd: () => Promise<PauseOutcome>;
  onRetry: () => void;
  fixture?: boolean;
}) {
  const t = streakPauseCopy[locale];
  // One panel per child on the Family Hub: every id is unique to its panel.
  const titleId = useId();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'ended' | 'invalid' | 'failed' | 'no-access' | null>(null);
  const [streak, setStreak] = useState(state.status === 'ready' ? state.streak : null);
  const shown = streak ?? (state.status === 'ready' ? state.streak : null);

  async function run(action: () => Promise<PauseOutcome>) {
    setBusy(true);
    setNotice(null);
    const outcome = await action();
    setBusy(false);
    setNotice(outcome.status);
    if (outcome.status === 'saved' || outcome.status === 'ended') setStreak(outcome.streak);
  }

  function pause() {
    if (!pauseRangeValid(from, to, today)) { setNotice('invalid'); return; }
    void run(() => onPause(from, to));
  }

  return <section className="lf-rebuild lf-streak-pause" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'streak-pause-preview' : 'streak-pause'} aria-labelledby={titleId}>
    <h2 id={titleId} data-copy-role="heading">{t.title}</h2>
    {state.status === 'loading' ? <LoadingState label={t.loading} lines={2} />
      : state.status === 'no-access' || notice === 'no-access' ? <InlineNotice tone="error" live>{t.noAccess}</InlineNotice>
        : state.status === 'error' || !shown ? <ErrorState heading={t.loadFailed} retryLabel={t.retry} retryingLabel={t.loading} onRetry={onRetry} />
          : <>
            <p className="lf-streak-pause-summary" data-copy-role="body">{t.summary(shown.current, shown.best, shown.status === 'resting')}</p>
            {shown.pause ? <div className="lf-streak-pause-active">
              <p data-copy-role="body">{t.active(formatDay(shown.pause.startsOn, locale), formatDay(shown.pause.endsOn, locale))}</p>
              <Button disabled={busy} onClick={() => void run(onEnd)}>{t.end}</Button>
            </div> : <div className="lf-streak-pause-form">
              <p data-copy-role="body">{t.intro}</p>
              <p className="lf-streak-pause-rule" data-copy-role="body">{t.rule}</p>
              <div className="lf-streak-pause-dates">
                <TextField label={t.from} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                <TextField label={t.to} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
              <Button variant="accent" disabled={busy} onClick={pause}>{t.save}</Button>
            </div>}
            {notice ? <div className="lf-streak-pause-notice"><InlineNotice tone={notice === 'invalid' || notice === 'failed' ? 'error' : 'success'} live>
              {notice === 'saved' ? t.saved : notice === 'ended' ? t.ended : notice === 'invalid' ? t.invalid : t.failed}</InlineNotice></div> : null}
          </>}
  </section>;
}
