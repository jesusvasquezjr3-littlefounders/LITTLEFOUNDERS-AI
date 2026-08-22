import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { SCENE_ASSETS } from '@/tutor-scene/assets';
import { isSceneBackdropId } from '@/tutor-scene/backdrops';
import { HudPlate } from '../hud/HudPlate';
import { ConversationView } from '../ConversationView';
import { OfferChips } from '../OfferChips';
import { PersonalizeInWorld } from '../PersonalizeInWorld';
import { SessionHistory } from '../SessionHistory';
import { VoiceConsentControl } from '../VoiceConsentControl';
import { micBlockedForOffers, narrowBlockedReason } from '../mic';
import { auditionFor } from '../stage/phases';
import { micForPhase } from '../stage/micForPhase';
import {
  shotForPhase,
  StageLayer,
  StageShell,
  type ConversationLayerProps,
  type OfferLayerProps,
  type PersonalizeLayerProps,
  type StageMicProps,
} from '../stage/StageShell';
import { useMicrophone } from '../useMicrophone';
import type { TutorPreferences } from '../types';
import {
  LAB_CATALOG,
  LAB_OFFERS,
  LAB_PREFERENCES,
  LAB_SCENES,
  LAB_SESSION,
  LAB_TOKEN,
  phaseForScene,
  useLabSocket,
  useStubbedCoreApi,
  type LabScene,
} from './labFixtures';

/*
 * `/dev/tutor-lab` — the Tutor's immersive stage, drivable without a session.
 *
 * WHY IT EXISTS, restated, because the reason changed. It used to render three
 * Tutor panels against fixtures on an ordinary scrolling page, and it said in
 * its own comments that the anchored chrome "needs a camera to hang off and is
 * looked at on `/tutor` itself". That sentence was the bug. `/tutor` is behind
 * `RequireAuth` and `RequireOnboarded`, and it needs Core, a running Oracle, a
 * model key and a live websocket before it draws a single pixel — so "looked at
 * on /tutor" meant, in practice, looked at by nobody. The owner found the phone
 * layout before we did, which is the only outcome that arrangement could ever
 * have produced.
 *
 * So this page now mounts THE REAL `StageShell`: one full-bleed canvas, the real
 * island, the real camera, the real anchored HUD, the real microphone dock, the
 * real lesson sheet, driven through every phase by a switcher. What is faked is
 * the network and only the network, and all of it is in `./labFixtures.ts`
 * behind one banner.
 *
 * IT IS NOT A COPY OF THE ROUTE. Every prop below is built the same way
 * `TutorExperience` builds it — `shotForPhase` from the same inputs,
 * `micForPhase` from the same narrowing, `auditionFor` from the same catalog —
 * so a change to any of those mappings shows up here on the same commit. Where
 * the two genuinely differ, the difference is named in a comment rather than
 * smoothed over.
 *
 * DEV-ONLY. The route is mounted behind `import.meta.env.DEV` in `App.tsx`, so
 * none of this reaches a production bundle. Its own chrome is therefore written
 * in plain English rather than through i18n, exactly as `/dev/scene-lab` and
 * `/dev/lesson-lab` are: these are instrument labels for the person driving the
 * instrument, and three deliberate translations of the word "speaking" would be
 * noise in the locale files that §1.8 exists to keep honest. Every string the
 * LEARNER sees on this page comes from the real components and therefore from
 * the real locale files.
 */

/** The lab's own surfaces. The stage is the point; consent has no stage. */
type LabSurface = LabScene | 'consent';

const LAB_SURFACES: readonly LabSurface[] = [...LAB_SCENES, 'consent'];

/** A `kid` whose guardian is being asked, for the consent fixture. */
const LAB_KID_ID = '9f1c2e44-3a58-4d7b-8b21-6c0e9d4f5a33';

// ── The instrument panel ────────────────────────────────────────────────────

/**
 * The viewport, live.
 *
 * A readout rather than a guess, because the whole reason this page exists is
 * that "it looks fine" at an unrecorded width is not a measurement. It reports
 * the band as well as the number: 1023 and 1024 px are one pixel and two
 * different layouts (`useDesktopPlate` switches the lesson plate from a sheet to
 * a floating corner plate at exactly that line).
 */
function readViewport(): { width: number; height: number; band: string } {
  const width = window.innerWidth;
  return {
    width,
    height: window.innerHeight,
    band: width >= 1024 ? 'desktop' : width >= 768 ? 'tablet' : 'mobile',
  };
}

function useViewport(): { width: number; height: number; band: string } {
  const [size, setSize] = useState(readViewport);

  useEffect(() => {
    const onResize = () => setSize(readViewport());
    // Once on mount as well: a window resized between the lazy initializer and
    // this effect would otherwise leave the readout claiming a width that is no
    // longer true, which is the one thing this component may never do.
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

/**
 * One switch on the panel.
 *
 * Deliberately NOT the design system's `Button`: that control is 44 px tall
 * because a child taps it, and eleven of them across the top of a 375 px stage
 * would cover more of the thing under review than the HUD does. This is a dev
 * instrument, sized like one, and it is the only place on the route where that
 * argument holds.
 */
function LabSwitch({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'lf-caption shrink-0 whitespace-nowrap rounded-sm px-2 py-1 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        on ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-content-muted hover:text-content',
      )}
    >
      {children}
    </button>
  );
}

// ── The page ────────────────────────────────────────────────────────────────

export default function TutorLabPage() {
  const { t } = useTranslation();
  const viewport = useViewport();

  const [surface, setSurface] = useState<LabSurface>('introducing');
  /*
   * Open on desktop, collapsed to one chip on a phone.
   *
   * Not a nicety: expanded, the panel is about 120 px tall at 375 px, which is
   * a seventh of the viewport whose crowding is the thing under review. A lab
   * that hides the symptom behind its own instrument reports the wrong answer,
   * so at the width where the argument is tightest the instrument gets out of
   * the way until it is asked for.
   */
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 768);
  const [consentGranted, setConsentGranted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  /*
   * The three flags `TutorExperience` DERIVES and the lab has to be TOLD.
   *
   * Upstream, `speaking` comes from the audio element, `awaitingReply` from a
   * turn arriving, and `stageReady` from the first frame. There is no audio and
   * no model here, so the first two are switches on the panel — otherwise the
   * orb's `speaking` and `thinking` states, and the plate's "thinking" line, are
   * unreachable and therefore unreviewed. `stageReady` stays REAL: it is the
   * canvas's own `onReady`, so a device that cannot draw the island falls
   * through to the guaranteed no-WebGL arrangements exactly as it would in
   * production, and that arrangement is worth looking at too.
   */
  const [speaking, setSpeaking] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [stageReady, setStageReady] = useState(false);

  // Held in state, and patched optimistically, because that is what makes the
  // picker a picker: a choice has to reach the live island on the same tick.
  const [preferences, setPreferences] = useState<TutorPreferences>(LAB_PREFERENCES);

  useStubbedCoreApi(consentGranted);

  const scene: LabScene = surface === 'consent' ? 'introducing' : surface;
  const phase = phaseForScene(scene);
  const socket = useLabSocket(scene);

  // Switching surface resets what a previous surface was in the middle of. The
  // panel is a time machine, not a session, and a stale "thinking" ring carried
  // into the next screenshot is a lie about that screenshot.
  useEffect(() => {
    setAwaitingReply(false);
    setSpeaking(false);
    setHistoryOpen(false);
  }, [surface]);

  const handleClip = useCallback(
    (clip: Blob | null) => {
      if (!clip) return;
      setAwaitingReply(true);
      void socket.sendAudio(clip);
    },
    [socket],
  );

  /*
   * THE REAL MICROPHONE HOOK, enabled by the same condition upstream uses.
   *
   * It is a browser API, not a network edge, so the lab does not stub it: a
   * held orb really opens a MediaStream and really lights the browser's
   * recording indicator, which is a thing worth being able to look at.
   *
   * ONE difference from `/tutor`, named rather than hidden: on `introducing`,
   * `TutorExperience` hands the orb an inert stand-in whose `start()` OPENS a
   * session instead of recording. The lab has no session to open, so it passes
   * the real hook (disabled, because the phase is not `conversing`). The orb
   * RENDERS identically — `MicOrb` reads `state`, the copy keys and
   * `permission`, and all three match — so nothing about the composition this
   * page measures is affected. Pressing it simply does nothing; the switcher is
   * how you move to a conversation here.
   */
  const microphone = useMicrophone(phase === 'conversing' && socket.microphone, {
    onAutoRelease: handleClip,
  });

  const character = phase === 'conversing' ? LAB_SESSION.character : preferences.character;
  const companion = phase === 'conversing' ? LAB_SESSION.companion : preferences.companion;
  const diorama =
    preferences.diorama in SCENE_ASSETS
      ? (preferences.diorama as keyof typeof SCENE_ASSETS)
      : 'diorama-a';
  const backdrop = isSceneBackdropId(preferences.backdrop) ? preferences.backdrop : 'auto';

  const articulates = LAB_CATALOG.articulates.includes(character);
  const shot = shotForPhase({
    phase,
    articulates,
    segmentLive: socket.segment !== null,
    adaptationOffered: socket.adaptationOffer !== null,
  });

  const audition = useMemo(() => auditionFor(phase, LAB_CATALOG.characters), [phase]);

  const blockedBy =
    phase === 'conversing'
      ? narrowBlockedReason(LAB_SESSION.microphoneBlockedBy)
      : micBlockedForOffers(LAB_OFFERS);

  const micPlan = micForPhase({
    phase,
    blockedBy,
    live: socket.microphone,
    recording: microphone.recording,
    awaitingReply,
    speaking,
    starting: false,
  });

  const mic: StageMicProps = {
    state: micPlan.state,
    microphone,
    blockedReason: micPlan.blockedReason,
    blockedCopy: micPlan.blockedKey ? t(micPlan.blockedKey) : null,
    idleCopy: micPlan.idleKey ? t(micPlan.idleKey) : undefined,
    denied: microphone.permission === 'denied',
    onClip: handleClip,
    // Upstream this nulls the speech URL for the current turn, which stops the
    // clip. There is no clip here, so the visible half of it is all there is.
    onInterrupt: () => setSpeaking(false),
  };

  const common = { phase, ready: stageReady };

  const personalizeLayer: PersonalizeLayerProps = {
    ...common,
    preferences,
    catalog: LAB_CATALOG,
    saving: false,
    onSave: (patch) => setPreferences((prev) => ({ ...prev, ...patch })),
    onDone: () => setSurface('introducing'),
  };

  const offerLayer: OfferLayerProps = {
    ...common,
    offers: LAB_OFFERS,
    starting: false,
    startError: null,
    onStart: () => setSurface('conversing'),
    onPersonalize: () => setSurface('personalizing'),
    // The lab's stand-in token. It never leaves the page — the shim in
    // `labFixtures` answers the replay list before `fetch` does.
    token: LAB_TOKEN,
  };

  const conversationLayer: ConversationLayerProps = {
    ...common,
    session: LAB_SESSION,
    socket,
    token: LAB_TOKEN,
    speaking,
    awaitingReply,
    onAwaitReply: () => setAwaitingReply(true),
    onExit: () => {
      socket.endSession();
      setSurface('closing');
    },
  };

  const panel = (
    <div
      // `data-lab-chrome` is the hook a measurement script uses to subtract this
      // panel from anything it is measuring. The instrument must never be
      // counted as part of the thing under measurement.
      data-lab-chrome=""
      className="pointer-events-auto fixed right-2 top-2 z-[60] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-1"
    >
      {panelOpen ? (
        <div className="flex max-w-full flex-col gap-1.5 rounded-md border border-outline bg-surface p-2 shadow-pop">
          <div className="flex items-center justify-between gap-3">
            <span className="lf-caption text-content">
              {viewport.width} × {viewport.height} · {viewport.band}
            </span>
            <LabSwitch on={false} onClick={() => setPanelOpen(false)}>
              hide
            </LabSwitch>
          </div>

          <div className="flex max-w-full gap-1 overflow-x-auto">
            {LAB_SURFACES.map((id) => (
              <LabSwitch key={id} on={surface === id} onClick={() => setSurface(id)}>
                {id}
              </LabSwitch>
            ))}
          </div>

          <div className="flex max-w-full gap-1 overflow-x-auto">
            <LabSwitch on={speaking} onClick={() => setSpeaking((on) => !on)}>
              speaking
            </LabSwitch>
            <LabSwitch on={awaitingReply} onClick={() => setAwaitingReply((on) => !on)}>
              thinking
            </LabSwitch>
            {surface === 'consent' && (
              <LabSwitch on={consentGranted} onClick={() => setConsentGranted((on) => !on)}>
                consent granted
              </LabSwitch>
            )}
            <span className="lf-caption self-center whitespace-nowrap px-1 text-content-muted">
              {stageReady ? 'stage ready' : 'no first frame'}
            </span>
          </div>
        </div>
      ) : (
        <LabSwitch on onClick={() => setPanelOpen(true)}>
          lab
        </LabSwitch>
      )}
    </div>
  );

  if (surface === 'consent') {
    /*
     * The ONE surface here that has no stage.
     *
     * The guardian's microphone gate lives on `/family`, not on the Tutor
     * route, and its exact wording is what a consent dispute is resolved
     * against (/ORACLE.md §4.3). It kept its place on this page when the rest
     * of it became a stage, because the alternative was that the one legally
     * significant screen in the feature went back to being unviewable.
     */
    return (
      <div className="min-h-screen bg-surface-sunken">
        {panel}
        <div className="mx-auto flex max-w-container flex-col gap-4 px-5 py-6 md:px-8 md:py-10">
          <p className="lf-body max-w-prose text-content-muted">
            The guardian&rsquo;s microphone gate, as it appears on /family. Toggle the fixture on the
            panel to see both states; the wording below is what Core stores verbatim.
          </p>
          <div className="rounded-lg border border-outline bg-surface">
            <VoiceConsentControl
              key={String(consentGranted)}
              kidUserId={LAB_KID_ID}
              token={LAB_TOKEN}
              kidName="Ana"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <StageShell
        phase={phase}
        mic={mic}
        audition={audition}
        scene={diorama}
        character={character}
        companion={companion}
        backdrop={backdrop}
        emotion={socket.turn?.emotion ?? 'neutral'}
        action={socket.turn?.action ?? 'idle'}
        actionKey={socket.turn?.seq ?? 0}
        // Null always. Audio is a network edge and the lab has no clip; the
        // `speaking` switch drives everything the clip would have driven.
        speechUrl={null}
        audioKey={socket.turn?.seq ?? 0}
        shot={shot}
        onReady={() => setStageReady(true)}
        onSpeechEnd={() => setSpeaking(false)}
      >
        {phase === 'unavailable' && (
          <StageLayer label={t('tutor.stage.unavailableLayer')} placement="bottom">
            <HudPlate shape="plate" className="mx-auto">
              <span className="lf-body text-content" role="status">
                {t('tutor.page.unavailable')}
              </span>
            </HudPlate>
          </StageLayer>
        )}

        {phase === 'personalizing' && (
          <StageLayer label={t('tutor.stage.personalizeLayer')} placement="world">
            <PersonalizeInWorld {...personalizeLayer} />
          </StageLayer>
        )}

        {phase === 'introducing' && (
          <StageLayer label={t('tutor.stage.introduceLayer')} placement="world">
            <OfferChips {...offerLayer} character={character} nickname={preferences.nickname} />
          </StageLayer>
        )}

        {phase === 'conversing' && (
          <StageLayer label={t('tutor.stage.conversationLayer')} placement="world">
            <ConversationView {...conversationLayer} />
          </StageLayer>
        )}

        {phase === 'closing' && (
          <StageLayer label={t('tutor.stage.closeLayer')} placement="bottom">
            <HudPlate shape="plate" floor="surface" className="mx-auto">
              <span className="flex flex-col gap-2 text-center">
                <span className="lf-headline text-content">{t('tutor.page.seeYouSoon')}</span>
                <span className="lf-body text-content-muted">{t('tutor.page.sessionSaved')}</span>
              </span>
            </HudPlate>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => setSurface('introducing')}>{t('tutor.page.startAnother')}</Button>

              <HudPlate
                as="button"
                shape="chip"
                floor="sunken"
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen((open) => !open)}
              >
                <span className="lf-caption">
                  {historyOpen ? t('tutor.introduce.hideReplays') : t('tutor.introduce.replays')}
                </span>
              </HudPlate>
            </div>

            {historyOpen && (
              <HudPlate shape="sheet" floor="surface" className="mx-auto">
                <div className="flex w-full flex-col gap-3 text-left">
                  <span className="lf-title text-content">{t('tutor.history.title')}</span>
                  <SessionHistory token={LAB_TOKEN} />
                </div>
              </HudPlate>
            )}
          </StageLayer>
        )}
      </StageShell>

      {panel}
    </>
  );
}
