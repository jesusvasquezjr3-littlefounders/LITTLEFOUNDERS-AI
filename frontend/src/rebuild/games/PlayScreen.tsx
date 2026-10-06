import { useId, type ReactNode } from 'react';
import enCore from '../../i18n/en-US/rebuild-core.json';
import esCore from '../../i18n/es-MX/rebuild-core.json';
import ptCore from '../../i18n/pt-BR/rebuild-core.json';
import { Button, LoadingState, RebuildRoot, SkipLink, useDocumentMeta } from '../design/controls';
import type { AgeBand, Locale } from '../design/copyBudget';
import { GarageView } from './GarageView';
import { ClosedCard, ErrorCard, GateHint, PausedDialog, PitStopSheet, RotateCard, SoftBreakDialog } from './PlayCards';
import { gamesCopy } from './gamesCopy';
import type { ClosedKind, ErrorKind, GarageSelection, Mentor, PitOutcome, PlayPhase, Reply } from './vocabulary';
import './games.css';

const skipLabel: Record<Locale, string> = { 'en-US': enCore.appShell.skip, 'es-MX': esCore.appShell.skip, 'pt-BR': ptCore.appShell.skip };

/*
 * /learn/play/:gameId, the whole screen of one visit (KRV1-CONTRACT §6): a
 * full-screen layer with no app navigation around it (like the lesson player),
 * a slim bar with the learner's way out, and the stage.
 *
 * THE EXIT IS ALWAYS VISIBLE, and so is the page's one heading. Escape leaves
 * from the Garage and the closed cards and pauses a race; it never gets stuck
 * inside the game's frame, because a game that holds the keys handles Escape as
 * its own pause (the host hears it as `kr.pauseRequested`). The route owns the
 * keys; this screen only draws.
 *
 * The iframe arrives as `frame` (the route builds it, because the bridge needs
 * the element), is hidden rather than removed while the learner is back in the
 * Garage between races, and is absent whenever the visit is closed or failed,
 * so no game keeps drawing behind a card that says it is over.
 *
 * Presentation only. Nothing here reads a clock, a score or a rank.
 */

export interface PlayScreenProps {
  locale: Locale;
  dark: boolean;
  /** The learner's Copy Budget band (the youngest while unknown). */
  ageBand: AgeBand;
  phase: PlayPhase;
  /** Who speaks: the learner's own Mentor. */
  mentor: Mentor;
  selection: GarageSelection;
  muted: boolean;
  closed: ClosedKind | null;
  error: ErrorKind | null;
  /** The pit stop's facts: Core's answer to the finished race, the learner's reply, a generated line. */
  pit: { outcome: PitOutcome; reply: Reply | null; aiText: string | null };
  /** The game's iframe, or null when none should exist. */
  frame: ReactNode;
  /** The frame is kept (the session is open) but hidden behind the Garage. */
  frameHidden: boolean;
  /** A phone held upright: the host asks for sideways instead of showing a race it cannot play. */
  rotate: boolean;
  onSelect: (patch: Partial<GarageSelection>) => void;
  onMuted: (muted: boolean) => void;
  onGo: () => void;
  onExit: () => void;
  onResume: () => void;
  onRestart: () => void;
  onRaceAgain: () => void;
  onChangeKart: () => void;
  onAskMentor: () => void;
  onReply: (reply: Reply) => void;
  onSoftStop: () => void;
  onSoftKeep: () => void;
  onRetry: () => void;
  /** Marks a development preview so its audit state is told apart from the real route. */
  fixture?: boolean;
}

export function PlayScreen(props: PlayScreenProps) {
  const { locale, dark, ageBand, phase, mentor, selection, muted, closed, error, pit, frame, frameHidden, rotate, fixture = false } = props;
  const t = gamesCopy[locale];
  const mainId = `lf-play-main-${useId().replace(/:/g, '')}`;
  const title = phase === 'garage' ? t.gameGarage.heading : t.gamePlay.pageTitle;
  useDocumentMeta(title, 'LittleFounders', locale);
  const racing = phase === 'loading' || phase === 'gate' || phase === 'racing' || phase === 'paused';
  return <RebuildRoot theme={dark ? 'dark' : 'light'} locale={locale} ageBand={ageBand}>
    <div className="lf-play" data-shell="play" data-surface="app" data-age-band={ageBand} lang={locale}
      data-screen={fixture ? `play-preview-${phase}` : `play-${phase}`} data-play-phase={phase}>
      <SkipLink label={skipLabel[locale]} target={mainId} />
      <header className="lf-play-bar">
        <Button size="sm" data-play-exit onClick={props.onExit}>{t.gamePlay.exit}</Button>
        <h1 id="lf-play-title" data-copy-role="heading">{title}</h1>
      </header>
      <main id={mainId} tabIndex={-1} className="lf-play-stage" aria-busy={phase === 'loading'}>
        {frame ? <div className="lf-play-frame" data-hidden={frameHidden ? 'true' : undefined}>{frame}</div> : null}
        {phase === 'garage' ? <GarageView locale={locale} dark={dark} mentor={mentor} selection={selection} muted={muted}
          onSelect={props.onSelect} onMuted={props.onMuted} onGo={props.onGo} /> : null}
        {phase === 'loading' ? <div className="lf-play-center" data-screen="play-loading"><LoadingState label={t.gamePlay.loading} lines={2} /></div> : null}
        {phase === 'gate' && !rotate ? <GateHint locale={locale} /> : null}
        {/* The race is the game's alone; this is the one line a keyboard or screen-reader learner gets about it, announced as it starts. */}
        {phase === 'racing' ? <p className="lf-visually-hidden" role="status" data-copy-role="body">{t.gamePlay.racingHint}</p> : null}
        {phase === 'closed' && closed ? <ClosedCard kind={closed} locale={locale} onHome={props.onExit} /> : null}
        {phase === 'error' && error ? <ErrorCard kind={error} locale={locale} onRetry={props.onRetry} onHome={props.onExit} /> : null}
        {rotate && racing ? <RotateCard locale={locale} /> : null}
      </main>
      <PausedDialog open={phase === 'paused' && !rotate} locale={locale} muted={muted} onMuted={props.onMuted}
        onResume={props.onResume} onRestart={props.onRestart} onLeave={props.onExit} />
      <PitStopSheet open={phase === 'pitstop'} locale={locale} dark={dark} mentor={mentor} outcome={pit.outcome} reply={pit.reply} aiText={pit.aiText}
        onReply={props.onReply} onAgain={props.onRaceAgain} onChange={props.onChangeKart} onAsk={props.onAskMentor} onClose={props.onChangeKart} />
      <SoftBreakDialog open={phase === 'soft'} locale={locale} dark={dark} mentor={mentor} onStop={props.onSoftStop} onKeep={props.onSoftKeep} />
    </div>
  </RebuildRoot>;
}
