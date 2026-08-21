import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@/components/ui';
import { TutorStage } from '@/tutor-scene/TutorStage';
import { SCENE_ASSETS } from '@/tutor-scene/assets';
import type { CharacterId } from '@/components/characters/control/types';
import { cn } from '@/lib/utils';
import { SpeechCaption } from './SpeechCaption';
import { TutorBubble } from './TutorBubble';
import { LiveSegmentPanel } from './LiveSegmentPanel';
import { useMicrophone } from './useMicrophone';
import type { TutorSocket } from './useTutorSocket';
import type { StartedSession } from './types';

/*
 * The session itself: character on the left, lesson on the right.
 *
 * THE SPLIT INVERTS ON MOBILE rather than shrinking (§1.11, non-negotiable).
 * At 375px the stage sits ABOVE the activity, both full width, because a
 * side-by-side split at phone width gives each half something like 170px and
 * neither is usable. At 1280px the two columns are deliberate: the stage takes
 * the space a character needs to read as present, the panel takes the space a
 * question needs to be answered in.
 *
 * WHY THE SAME LINE APPEARS THREE TIMES. The caption above the head, the
 * bubble transcript, and the audio are not redundancy — they are three
 * channels for three different learners, and every one of them is somebody's
 * only channel. A deaf learner has the first two; a pre-reader has the third;
 * a learner on a phone on a bus with no headphones has the first two again.
 */

export interface ConversationViewProps {
  session: StartedSession;
  socket: TutorSocket;
  token: string;
  onExit: () => void;
}

/** Characters with a working mouth card earn the tight framing (/TUTOR_3D.md §3.1). */
const ARTICULATES: readonly CharacterId[] = ['rho', 'zara'];

/**
 * The server's diorama id, narrowed to a scene this BUILD actually ships.
 *
 * The two can genuinely disagree: the catalog is server-driven so a new island
 * can be added without a frontend release (/ORACLE.md §0 assumption 1), which
 * means a client from before that release will be handed an id it has no
 * asset for. Falling back to the default island keeps the session running;
 * the warning is what makes the skew findable instead of mysterious.
 */
function narrowScene(id: string): keyof typeof SCENE_ASSETS {
  if (id in SCENE_ASSETS) return id as keyof typeof SCENE_ASSETS;
  console.warn(`[tutor] unknown diorama "${id}" — this build has no asset for it, using the default`);
  return 'diorama-a';
}

export function ConversationView({ session, socket, token, onExit }: ConversationViewProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [stageReady, setStageReady] = useState(false);
  const microphone = useMicrophone(socket.microphone);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { turn, sendAudio } = socket;

  /*
   * Speech waits for the stage.
   *
   * TutorStage fires `onReady` once, when the cast is actually on screen.
   * Handing it a speech URL while the .glb files are still resolving plays
   * audio at a blank canvas — the tutor talking to an empty island
   * (/TUTOR_3D.md §7b).
   */
  const speechUrl = stageReady ? (turn?.audioUrl ?? null) : null;

  const pushToTalk = useCallback(async () => {
    const clip = await microphone.stop();
    if (clip) await sendAudio(clip);
  }, [microphone, sendAudio]);

  // Space-bar push-to-talk, but never while the learner is typing. A hotkey
  // that hijacks the space bar inside a text field is the kind of thing that
  // ships and then takes a week to diagnose from "my keyboard is broken".
  useEffect(() => {
    if (!socket.microphone) return;
    const isTyping = () => document.activeElement === inputRef.current;

    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isTyping()) return;
      event.preventDefault();
      void microphone.start();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTyping()) return;
      event.preventDefault();
      void pushToTalk();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [socket.microphone, microphone, pushToTalk]);

  const submitTyped = () => {
    if (typed.trim() === '') return;
    socket.sendText(typed);
    setTyped('');
  };

  const ended = socket.closedReason !== null || socket.connection === 'closed';

  return (
    <div className="flex flex-col gap-4">
      <SessionHeader socket={socket} onExit={onExit} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        {/* Left: the stage, its caption, and the 2D rail beneath. */}
        <div className="flex flex-col gap-4">
          <div className="relative">
            <TutorStage
              className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-sunken sm:aspect-video"
              character={session.character}
              companion={session.companion}
              scene={narrowScene(session.diorama)}
              emotion={turn?.emotion ?? 'neutral'}
              action={turn?.action ?? 'idle'}
              actionKey={turn?.seq ?? 0}
              speechUrl={speechUrl}
              onReady={() => setStageReady(true)}
              /*
               * Liruf and Dina have no mouth card, so closing the camera on
               * them frames a still mouth at full size. They stay at the
               * island shot; Rho and Zara close in (/ORACLE.md §2.2).
               */
              speakingFraming={ARTICULATES.includes(session.character) ? 'conversation' : 'vignette'}
            />
            <SpeechCaption text={turn?.text ?? null} turnSeq={turn?.seq ?? 0} />
          </div>

          <TutorBubble
            character={session.character}
            emotion={turn?.emotion ?? 'neutral'}
            action={turn?.action ?? 'idle'}
            actionKey={turn?.seq ?? 0}
            speaking={Boolean(speechUrl)}
            history={socket.history}
            className="max-h-64 lg:max-h-80"
          />
        </div>

        {/* Right: the live lesson. */}
        <div className="flex min-h-[12rem] flex-col gap-4">
          {socket.segment ? (
            <LiveSegmentPanel live={socket.segment} token={token} onGraded={socket.reportGrade} />
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-outline p-6 text-center">
              <p className="lf-body text-content-muted">
                {ended ? t('tutor.conversation.ended') : t('tutor.conversation.listening')}
              </p>
            </div>
          )}

          {socket.adaptationOffer && (
            <div className="rounded-lg border border-primary bg-accent-soft p-4" role="status">
              <p className="lf-body mb-3 text-content">
                {t(`tutor.adaptationOffer.${socket.adaptationOffer}`)}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => socket.answerAdaptation(socket.adaptationOffer!, true)}
                  className="flex-1"
                >
                  {t('tutor.conversation.yesPlease')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => socket.answerAdaptation(socket.adaptationOffer!, false)}
                  className="flex-1"
                >
                  {t('tutor.conversation.noThanks')}
                </Button>
              </div>
            </div>
          )}

          {socket.error && (
            <p className="lf-body rounded-md bg-warning-soft px-3 py-2 text-content" role="status">
              {socket.error.message}
            </p>
          )}
        </div>
      </div>

      {/* The composer stays at the bottom on every breakpoint: thumb-reachable. */}
      {!ended && (
        <div className="sticky bottom-0 flex items-center gap-2 rounded-lg border border-outline bg-surface p-3">
          {socket.microphone && (
            <button
              type="button"
              aria-label={t('tutor.conversation.holdToTalk')}
              aria-pressed={microphone.recording}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
                microphone.recording ? 'bg-error text-on-error' : 'bg-accent text-on-accent',
              )}
              // Pointer events, not mouse: this must work on a touchscreen,
              // and `onMouseDown` does not fire reliably on one.
              onPointerDown={() => void microphone.start()}
              onPointerUp={() => void pushToTalk()}
              onPointerLeave={() => microphone.recording && void pushToTalk()}
            >
              <Icon name={microphone.recording ? 'stop' : 'mic'} />
            </button>
          )}

          <input
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submitTyped()}
            maxLength={2000}
            placeholder={t('tutor.conversation.typePlaceholder')}
            aria-label={t('tutor.conversation.typePlaceholder')}
            className="lf-body h-11 min-w-0 flex-1 rounded-full border border-outline bg-surface px-4 text-content placeholder:text-content-muted focus:border-primary focus:outline-none"
          />

          <Button onClick={submitTyped} disabled={typed.trim() === ''} className="shrink-0">
            {t('tutor.conversation.send')}
          </Button>
        </div>
      )}

      {microphone.permission === 'denied' && (
        <p className="lf-body text-content-muted" role="status">
          {t('tutor.conversation.micDenied')}
        </p>
      )}
    </div>
  );
}

function SessionHeader({ socket, onExit }: { socket: TutorSocket; onExit: () => void }) {
  const { t } = useTranslation();
  const minutes = Math.max(0, Math.ceil(socket.remainingMs / 60_000));

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {/*
          The wrap-up state is SHOWN, not sprung. A session that starts winding
          down with no warning reads as being cut off; a minutes-left chip lets
          the learner choose what to spend the rest on (/ORACLE.md §9.5).
        */}
        {socket.budget === 'wrapping' && (
          <span className="lf-caption rounded-full bg-warning-soft px-3 py-1 text-content">
            {t('tutor.conversation.wrappingUp')}
          </span>
        )}
        {socket.budget === 'running' && socket.remainingMs > 0 && (
          <span className="lf-caption rounded-full bg-surface-sunken px-3 py-1 text-content-muted">
            {t('tutor.conversation.minutesLeft', { count: minutes })}
          </span>
        )}
        {socket.intelDegraded && (
          <span className="lf-caption rounded-full bg-surface-sunken px-3 py-1 text-content-muted">
            {t('tutor.conversation.gettingToKnowYou')}
          </span>
        )}
      </div>

      <Button variant="secondary" onClick={onExit}>
        {t('tutor.conversation.finish')}
      </Button>
    </header>
  );
}
