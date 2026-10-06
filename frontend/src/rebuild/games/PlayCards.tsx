import { useRef } from 'react';
import { Button, ButtonGroup, Dialog, EmptyState, MentorAvatar, ReplyChip, Sheet, Switch } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { findMentorAvatar } from '../design/assets';
import { fillName, gamesCopy } from './gamesCopy';
import { LENSES, MENTOR_NAMES, REPLIES, type ClosedKind, type ErrorKind, type Lens, type Mentor, type PitOutcome, type Reply } from './vocabulary';
import './games.css';

/*
 * The cards of one visit that are not the Garage: the pause menu, the pit
 * stop, the soft break, the closed and error states, the rotate card and the
 * "tap the game" hint. Every word the learner reads here is the SPA's; the
 * game renders only the 3D scene, the race HUD and touch controls (design §1.2).
 *
 * WHAT THESE CARDS NEVER SHOW (DP-01, D7, B.20, B.22): a session timer or a
 * countdown (the break card is calm: it has no clock, and the limits live in
 * Core), a podium or rank between people, XP, coins or a streak, confetti. A
 * personal best would be quiet text compared with the learner's own past; the
 * pit stop below has no such line in this release.
 */

function Mentored({ mentor, dark, size = 'lg' }: { mentor: Mentor; dark: boolean; size?: 'md' | 'lg' }) {
  const render = findMentorAvatar(mentor, dark ? 'dark' : 'light');
  return render ? <MentorAvatar renderId={render} label={MENTOR_NAMES[mentor]} size={size} /> : null;
}

/* ------------------------------------------------------------------ pause */

export function PausedDialog({ open, locale, muted, onMuted, onResume, onRestart, onLeave }: {
  open: boolean; locale: Locale; muted: boolean; onMuted: (muted: boolean) => void; onResume: () => void; onRestart: () => void; onLeave: () => void;
}) {
  const t = gamesCopy[locale];
  const resume = useRef<HTMLButtonElement>(null);
  // Escape resumes: the game is paused, the learner asked for nothing else, and the iframe never keeps the keys while this is open.
  return <Dialog open={open} heading={t.gamePaused.heading} description={t.gamePaused.body} onClose={onResume} initialFocus={resume}
    actions={<>
      <Button ref={resume} variant="accent" onClick={onResume}>{t.gamePaused.resume}</Button>
      <Button onClick={onRestart}>{t.gamePaused.restart}</Button>
      <Button onClick={onLeave}>{t.gamePaused.leave}</Button>
    </>}>
    <Switch label={t.gamePlay.sound} checked={!muted} onCheckedChange={(on) => onMuted(!on)} stateLabels={{ on: t.gamePlay.soundOn, off: t.gamePlay.soundOff }} />
  </Dialog>;
}

/* ------------------------------------------------------------------ soft break */

/**
 * A calm offer to stop, never a countdown and never a lock: Core said the visit has run a while, the learner's
 * Mentor says so in their own voice, and "keep racing" stays one press away (Core's hard stop is the only wall).
 * Stopping is the first and the accent choice.
 */
export function SoftBreakDialog({ open, locale, dark, mentor, onStop, onKeep }: {
  open: boolean; locale: Locale; dark: boolean; mentor: Mentor; onStop: () => void; onKeep: () => void;
}) {
  const t = gamesCopy[locale];
  return <Dialog open={open} heading={t.gameSoft.heading} description={t.gameSoft.line[mentor]}
    actions={<>
      <Button variant="accent" onClick={onStop}>{t.gameSoft.stop}</Button>
      <Button onClick={onKeep}>{t.gameSoft.keep}</Button>
    </>}>
    <div className="lf-play-card-mentor" data-character={mentor}><Mentored mentor={mentor} dark={dark} /></div>
  </Dialog>;
}

/* ------------------------------------------------------------------ pit stop */

export interface PitStopProps {
  open: boolean;
  locale: Locale;
  dark: boolean;
  mentor: Mentor;
  outcome: PitOutcome;
  /** The learner's reply, once given. Self-report, never shown as right or wrong. */
  reply: Reply | null;
  /** A generated line that arrived in time; replaces the authored observation. */
  aiText: string | null;
  onReply: (reply: Reply) => void;
  onAgain: () => void;
  onChange: () => void;
  onAsk: () => void;
  /** Closing the card (the close button, Escape, a press on the scrim) is "not now": the Garage. */
  onClose: () => void;
}

/** The lens the observation reads from: Core's when it answered, otherwise the neutral line (a practice lap, a run Core did not take). */
export function observationLens(outcome: PitOutcome): Lens {
  return outcome.status === 'ready' && LENSES.includes(outcome.lens) ? outcome.lens : 'neutral';
}

/**
 * The pit stop (design §3.3): the learner's Mentor, one observation of what the learner did (never a verdict),
 * one reflection question with three taps, and two or three ways on. A bottom sheet over the scene the race
 * left, always dismissible. Without Core's answer there is no question to ask (a reply would have nowhere to go),
 * so the card is only the neutral line and the actions.
 */
export function PitStopSheet({ open, locale, dark, mentor, outcome, reply, aiText, onReply, onAgain, onChange, onAsk, onClose }: PitStopProps) {
  const t = gamesCopy[locale];
  const lens = observationLens(outcome);
  const name = MENTOR_NAMES[mentor];
  const asks = outcome.status === 'ready';
  const line = outcome.status === 'pending' ? t.gamePitstop.pending : aiText ?? t.gamePitstop.observation[lens][mentor];
  return <Sheet open={open} onClose={onClose} heading={t.gamePitstop.heading} closeLabel={t.gamePitstop.close}
    footer={<ButtonGroup>
      <Button variant="accent" onClick={onAgain}>{t.gamePitstop.again}</Button>
      <Button onClick={onChange}>{t.gamePitstop.change}</Button>
      <Button onClick={onAsk}>{fillName(t.gamePitstop.ask, name)}</Button>
    </ButtonGroup>}>
    <div className="lf-play-pit" data-screen="play-pitstop" data-lens={lens} data-outcome={outcome.status} data-character={mentor}>
      <div className="lf-play-pit-mentor">
        <Mentored mentor={mentor} dark={dark} />
        <p data-copy-role="mentor" aria-live="polite">{line}</p>
      </div>
      {asks && reply === null ? <div className="lf-play-pit-question" role="group" aria-labelledby="lf-play-question">
        <p id="lf-play-question" data-copy-role="prompt">{t.gamePitstop.question[outcome.lens]}</p>
        <div className="lf-play-replies">
          {REPLIES.map((choice) => <ReplyChip key={choice} data-reply={choice} onPress={() => onReply(choice)}>{t.gamePitstop.replies[outcome.lens][choice]}</ReplyChip>)}
        </div>
      </div> : null}
      {asks && reply !== null ? <p className="lf-play-replied" data-copy-role="body" role="status">{t.gamePitstop.replied}</p> : null}
    </div>
  </Sheet>;
}

/* ------------------------------------------------------------------ closed and error */

/** The visit is over for now: today's sessions are used, the session ended, or a grown-up turned games off. No clock, no "try later at". */
export function ClosedCard({ kind, locale, onHome }: { kind: ClosedKind; locale: Locale; onHome: () => void }) {
  const t = gamesCopy[locale].gameClosed;
  return <div className="lf-play-center" data-screen="play-closed" data-closed={kind}>
    <EmptyState heading={t[kind].heading} body={t[kind].body} action={<Button variant="accent" onClick={onHome}>{t.home}</Button>} />
  </div>;
}

/** The game did not start (or stopped): what happened in words, a retry when one can help, and the way back. */
export function ErrorCard({ kind, locale, onRetry, onHome }: { kind: ErrorKind; locale: Locale; onRetry: () => void; onHome: () => void }) {
  const t = gamesCopy[locale].gameError;
  return <div className="lf-play-center" data-screen="play-error" data-error={kind}>
    <EmptyState heading={t[kind].heading} body={t[kind].body} action={<ButtonGroup>
      {/* A device that cannot draw the game will not draw it on a second try. */}
      {kind === 'webgl' ? null : <Button variant="accent" onClick={onRetry}>{t.retry}</Button>}
      <Button onClick={onHome}>{t.home}</Button>
    </ButtonGroup>} />
  </div>;
}

/** A phone held upright cannot race: ask for sideways, in the design system. The game has its own overlay too, as a fallback. */
export function RotateCard({ locale }: { locale: Locale }) {
  const t = gamesCopy[locale].gameRotate;
  return <section className="lf-play-rotate" data-screen="play-rotate" role="status" aria-labelledby="lf-play-rotate-heading">
    <h2 id="lf-play-rotate-heading" data-copy-role="heading">{t.heading}</h2>
    <p data-copy-role="body">{t.body}</p>
  </section>;
}

/** The game's own Start gate is the first tap; the host says so once, small, over the scene. */
export function GateHint({ locale }: { locale: Locale }) {
  return <p className="lf-play-hint" data-copy-role="body" role="status">{gamesCopy[locale].gamePlay.gateHint}</p>;
}
