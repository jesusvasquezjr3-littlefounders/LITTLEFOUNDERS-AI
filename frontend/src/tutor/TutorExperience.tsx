import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui';
import { duckTutorAmbient, playPlatformSound } from '@/lib/sound';
import { SCENE_ASSETS } from '@/tutor-scene/assets';
import { isSceneBackdropId, type SceneBackdropId } from '@/tutor-scene/backdrops';
import { HudPlate } from '@/tutor/hud/HudPlate';
import { getOffers, getPreferences, savePreferences, startSession, type StartSessionInput } from './tutorApi';
import { micBlockedForOffers, micBlockedReason, narrowBlockedReason, primaryOpening } from './mic';
import { PersonalizeInWorld } from './PersonalizeInWorld';
import { OfferChips } from './OfferChips';
import { ConversationView } from './ConversationView';
import { SessionHistory } from './SessionHistory';
import { auditionFor } from './stage/phases';
import { micForPhase } from './stage/micForPhase';
import {
  shotForPhase,
  StageLayer,
  StageShell,
  type ConversationLayerProps,
  type OfferLayerProps,
  type PersonalizeLayerProps,
  type StageMicProps,
  type StagePhase,
} from './stage/StageShell';
import { useMicrophone, type Microphone } from './useMicrophone';
import { useTutorSocket } from './useTutorSocket';
import type { StartedSession, TutorCatalog, TutorOffers, TutorPreferences } from './types';

/*
 * The Tutor, as the learner meets it (/ORACLE.md §1).
 *
 *   arrive → personalize → introduce → converse → close → replay
 *
 * ONE CANVAS FOR ALL OF IT. This component used to return a DIFFERENT TREE per
 * phase, which meant the 3D stage unmounted and remounted at every boundary:
 * the island refetched through a Suspense fallback and the learner watched
 * their own world blink on the way into a conversation. It is now a single
 * `StageShell` holding a single `TutorStage`, and a phase changes exactly two
 * things — the shot the camera travels to, and which HUD layer is on top.
 *
 * THIS COMPONENT DRIVES THE SCENE; THE LAYERS DO NOT. Emotion, action, speech
 * and the shot are derived here from the socket and handed to the one canvas,
 * so a layer can be rebuilt, replaced or thrown by an error without the island
 * going with it. What each layer receives is fixed in `stage/StageShell.tsx`.
 *
 * PERSONALIZATION IS AN INVITATION, NOT A TOLL GATE. The picker opens on the
 * first visit and never again; the defaults are good enough that skipping it
 * entirely produces a good session. A learner who wants to start should be one
 * tap from starting.
 *
 * The socket is opened by the HOOK when a URL exists, so this component holds
 * a phase and not a connection. That split is what keeps a re-render from
 * dropping a live session.
 */

/**
 * The server's diorama id, narrowed to a scene this BUILD actually ships.
 *
 * The two can genuinely disagree: the catalog is server-driven so a new island
 * can be added without a frontend release (/ORACLE.md §0 assumption 1), which
 * means a client from before that release will be handed an id it has no asset
 * for. Falling back to the default island keeps the session running; the
 * warning is what makes the skew findable instead of mysterious.
 */
function narrowScene(id: string | undefined): keyof typeof SCENE_ASSETS {
  if (!id) return 'diorama-a';
  if (id in SCENE_ASSETS) return id as keyof typeof SCENE_ASSETS;
  console.warn(`[tutor] unknown diorama "${id}" - this build has no asset for it, using the default`);
  return 'diorama-a';
}

/**
 * The same narrowing for the light.
 *
 * `auto` is the honest fallback rather than a guess at a time of day: it
 * follows the app's own theme, so an unrecognised value degrades to the
 * learner's light or dark preference instead of to somebody's favourite dusk.
 */
function narrowBackdrop(id: string | undefined): SceneBackdropId {
  if (!id) return 'auto';
  if (isSceneBackdropId(id)) return id;
  console.warn(`[tutor] unknown backdrop "${id}" - this build has no lighting for it, following the theme`);
  return 'auto';
}

/**
 * Where we remember that this learner has already been shown the picker.
 *
 * THE NICKNAME IS NOT THAT MARKER, and using it as one was a real bug: every
 * other axis has a good default, so a learner who presses "I'm ready" without
 * typing a nickname leaves with `nickname === null` and is handed the picker
 * again on every single visit. That is precisely the toll gate the picker is
 * not supposed to be, and the fault predates the rebuild.
 *
 * It is local rather than a server field on purpose. The question is "have I
 * offered this to you", which is about this browser and this moment, not about
 * the account; and the failure mode of losing it is one extra visit to a screen
 * that is an invitation, which is the cheapest failure available here. A server
 * field would be better and is a Core change, not a layout one.
 */
const PERSONALIZED_KEY_PREFIX = 'lf.tutor.personalized.';

function hasSeenPicker(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(PERSONALIZED_KEY_PREFIX + userId) !== null;
  } catch {
    // Private browsing, a blocked origin, a full quota. Showing the picker one
    // more time is a far better answer than throwing on the way into the route.
    return false;
  }
}

function rememberPicker(userId: string | undefined): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(PERSONALIZED_KEY_PREFIX + userId, '1');
  } catch {
    /* See above: never worth failing a session over. */
  }
}

export function TutorExperience() {
  const { t } = useTranslation();
  const { getToken, session: authSession } = useAuth();
  /*
   * Held in a ref, and read rather than depended on.
   *
   * `session` is `undefined` while it is still being restored from storage, so
   * it changes identity once on a cold load. As a dependency of the bootstrap
   * effect below that would re-run the whole thing — refetching preferences and
   * calling `setPhase` a second time, which can yank a learner who is already
   * talking back to the introduction. The bootstrap awaits `getToken()` anyway,
   * so by the time this is read the session has resolved.
   */
  const userIdRef = useRef(authSession?.user.id);
  userIdRef.current = authSession?.user.id;

  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<StagePhase>('arriving');
  const [preferences, setPreferences] = useState<TutorPreferences | null>(null);
  const [catalog, setCatalog] = useState<TutorCatalog | null>(null);
  const [offers, setOffers] = useState<TutorOffers | null>(null);
  const [session, setSession] = useState<StartedSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [stageReady, setStageReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /*
   * The wait between a learner's turn and the tutor's answer.
   *
   * It lives HERE rather than inside the conversation, because the microphone
   * shows it and there is only one microphone now — mounted by the shell, for
   * the whole route. Two copies of "am I waiting" is how the spinner on the
   * lesson plate and the ring on the orb come to disagree.
   */
  const [awaitingReply, setAwaitingReply] = useState(false);

  const socket = useTutorSocket(phase === 'conversing' ? (session?.socketUrl ?? null) : null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const authToken = await getToken();
      if (cancelled) return;
      if (!authToken) {
        setPhase('unavailable');
        return;
      }
      setToken(authToken);

      const [prefsResult, offersResult] = await Promise.all([
        getPreferences(authToken),
        getOffers(authToken),
      ]);
      if (cancelled) return;

      if (!prefsResult.data || !offersResult.data) {
        // Refuse rather than improvising defaults: a learner whose chosen
        // character silently reverted to Rho because a read failed would
        // reasonably conclude the product forgot them (§1.14).
        setPhase('unavailable');
        return;
      }

      const { catalog: served, ...prefs } = prefsResult.data;
      setPreferences(prefs);
      setCatalog(served);
      setOffers(offersResult.data);
      /*
       * The picker opens on the first visit and never again. A nickname counts
       * as proof they have been here, because they can only have typed one on
       * this screen; the local marker covers the learner who skipped it, who
       * used to be asked again forever.
       */
      setPhase(prefs.nickname !== null || hasSeenPicker(userIdRef.current) ? 'introducing' : 'personalizing');
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const persistPreferences = useCallback(
    (patch: Partial<TutorPreferences>) => {
      if (!token) return;
      setSaving(true);
      // Applied OPTIMISTICALLY, which is what makes the picker a picker: the
      // island, the cast and the light are props of the one live canvas, so a
      // choice reaches the scene on this tick rather than after a round trip.
      setPreferences((prev) => (prev ? { ...prev, ...patch } : prev));
      void savePreferences(token, patch).then((result) => {
        setSaving(false);
        if (result.data) setPreferences(result.data);
      });
    },
    [token],
  );

  const begin = useCallback(
    (input: StartSessionInput) => {
      if (!token) return;
      setStarting(true);
      setStartError(null);
      void startSession(token, input).then((result) => {
        setStarting(false);
        if (result.error || !result.data) {
          setStartError(result.error?.code ?? 'INTERNAL');
          return;
        }
        setSession(result.data);
        setPhase('conversing');
      });
    },
    [token],
  );

  // The session ended on the server side. Move the UI with it rather than
  // leaving a dead socket behind a live-looking screen.
  useEffect(() => {
    if (phase !== 'conversing') return;
    if (socket.closedReason !== null || socket.connection === 'closed' || socket.connection === 'failed') {
      setPhase('closing');
    }
  }, [phase, socket.closedReason, socket.connection]);

  /*
   * What the cast and the place actually are, right now.
   *
   * The session is authoritative once one exists, because the server echoes
   * back what it opened with and a mid-session preference edit must not swap
   * the island out from under a live conversation. Before that, preferences
   * are — which is why the returning learner's remembered island and light are
   * on the very first frame instead of a default that morphs into theirs
   * (/ORACLE.md §9.1).
   */
  const scene = narrowScene(session?.diorama ?? preferences?.diorama);
  const backdrop = narrowBackdrop(session?.backdrop ?? preferences?.backdrop);
  const character = session?.character ?? preferences?.character ?? 'rho';
  // `null` is a real answer here ("just us"), so the nullish chain has to be
  // written out: `session?.companion ?? preferences?.companion` would treat a
  // deliberately empty companion slot as "unset" and re-fill it.
  const companion = session ? session.companion : (preferences?.companion ?? null);

  const turn = socket.turn;
  const turnSeq = turn?.seq ?? 0;

  /*
   * Speech waits for the stage, and stops when the learner cuts in.
   *
   * `onReady` fires once, when the island AND the cast are on screen. Handing
   * over a URL while the .glb files are still resolving plays audio at a blank
   * canvas — the tutor talking to an empty island.
   *
   * `interruptedSeq` is per TURN rather than a boolean, so the next line the
   * tutor says plays normally: a flag would have to be cleared by somebody, and
   * whoever forgot would leave a permanently mute tutor behind one impatient
   * press. The URL going null is what `TutorStage` already treats as stop, so
   * nothing new drives the audio element and it keeps its single owner.
   */
  const [interruptedSeq, setInterruptedSeq] = useState<number | null>(null);
  const interrupted = interruptedSeq !== null && interruptedSeq === turnSeq;
  const speechUrl = phase === 'conversing' && stageReady && !interrupted ? (turn?.audioUrl ?? null) : null;

  /*
   * Mirrored into state rather than read as `Boolean(speechUrl)` because the
   * bubble's 2D head must stop moving when the CLIP ends, which is a moment
   * only the audio element knows about — the URL is still set for the whole
   * time the tutor is silent afterwards, waiting for the learner.
   */
  useEffect(() => {
    setSpeaking(speechUrl !== null);
  }, [speechUrl, turnSeq]);

  /*
   * The tutor answering is what ends the wait, whatever the learner sent. ANY
   * turn clears it, including one the server volunteers, because a spinner that
   * outlives the thing it was spinning for is worse than no spinner.
   */
  useEffect(() => {
    setAwaitingReply(false);
  }, [turnSeq]);

  const handleClip = useCallback(
    (clip: Blob | null) => {
      // Null is a mis-tap the hook already dropped. Marking that as "waiting"
      // would leave the orb thinking about a turn that was never sent.
      if (!clip) return;
      setAwaitingReply(true);
      void socket.sendAudio(clip);
    },
    [socket],
  );

  /*
   * THE ONE REAL MICROPHONE, owned here and handed to the shell.
   *
   * It used to be created inside `ConversationView`, which is also where one of
   * the two orbs lived. One hook and one orb is not tidiness: `useMicrophone`
   * holds a MediaStream and a MediaRecorder, and a second instance is a second
   * live recording indicator with no owner. Enabled only while a conversation
   * can actually carry audio, so no other phase can open a stream.
   */
  const microphone = useMicrophone(phase === 'conversing' && socket.microphone, {
    onAutoRelease: handleClip,
  });

  /*
   * THE MICROPHONE THE ORB HOLDS BEFORE A SESSION EXISTS.
   *
   * On the introduction there is no socket, so audio captured by a hold would
   * have nowhere to go and no protocol change was permitted to invent one. This
   * is the honest shape of a `Microphone` on that screen: nothing is ever
   * captured, no meter ever moves, no permission is ever requested, and
   * `start()` OPENS the conversation instead. Handing the orb the real hook
   * with `enabled: false` was the alternative and is strictly worse — the press
   * would do nothing at all, which is the dead hero control this rebuild exists
   * to remove.
   */
  const pressRef = useRef<() => void>(() => {});
  const idleLevelRef = useRef(0);
  const idleBytesRef = useRef(0);
  const idleMsRef = useRef(0);
  const idleFractionRef = useRef(0);
  const openingMicrophone = useMemo<Microphone>(
    () => ({
      permission: 'idle',
      recording: false,
      levelRef: idleLevelRef,
      holdBytesRef: idleBytesRef,
      holdMsRef: idleMsRef,
      holdFractionRef: idleFractionRef,
      subscribe: () => () => {},
      start: async () => {
        pressRef.current();
      },
      stop: async () => null,
      release: () => {},
    }),
    [],
  );

  const articulates = catalog?.articulates.includes(character) ?? false;
  const shot = shotForPhase({
    phase,
    articulates,
    segmentLive: socket.segment !== null,
    adaptationOffered: socket.adaptationOffer !== null,
  });

  const handleReady = useCallback(() => setStageReady(true), []);
  const handleSpeechEnd = useCallback(() => setSpeaking(false), []);

  /*
   * The layer props are built as whole, typed objects rather than spread inline
   * so the seam is visible in one place. Three surfaces are being built against
   * these shapes in parallel; a prop quietly added at a call site is a contract
   * change nobody else sees.
   */
  const common = useMemo(() => ({ phase, ready: stageReady }), [phase, stageReady]);

  const personalizeLayer: PersonalizeLayerProps | null =
    preferences && catalog
      ? {
          ...common,
          preferences,
          catalog,
          saving,
          onSave: persistPreferences,
          onDone: () => {
            // Recorded HERE rather than inside the picker, because this is the
            // only place that knows the press means "I have finished with this
            // screen" rather than "I changed one thing".
            rememberPicker(userIdRef.current);
            setPhase('introducing');
          },
        }
      : null;

  const offerLayer: OfferLayerProps | null =
    offers && token
      ? {
          ...common,
          offers,
          starting: starting || !offers.canStart,
          startError,
          onStart: begin,
          onPersonalize: () => setPhase('personalizing'),
          token,
        }
      : null;

  const conversationLayer: ConversationLayerProps | null =
    session && token
      ? {
          ...common,
          session,
          socket,
          token,
          speaking,
          awaitingReply,
          onAwaitReply: () => setAwaitingReply(true),
          onExit: () => {
            socket.endSession();
            setPhase('closing');
          },
        }
      : null;

  /*
   * WHAT THE ORB IS DOING, in whichever phase this is.
   *
   * Core's answer arrives from two different places depending on whether a
   * session exists yet — the offers before one, the session itself after — and
   * both are narrowed to the same three values here so the orb never has to
   * know which. `micForPhase` then decides the rest, and it is a total function
   * over the phase vocabulary: a new phase cannot be added without deciding
   * what the microphone does in it, which is exactly how four phases came to
   * have no microphone at all.
   */
  const blockedBy =
    phase === 'conversing' && session
      ? narrowBlockedReason(session.microphoneBlockedBy)
      : offers
        ? micBlockedForOffers(offers)
        : 'VOICE_UNAVAILABLE';

  const micPlan = micForPhase({
    phase,
    blockedBy,
    live: socket.microphone,
    recording: microphone.recording,
    awaitingReply,
    speaking,
    starting,
  });

  /*
   * Pressing the orb on the introduction opens a spoken conversation.
   *
   * This is the "one button" of /ORACLE.md §9.1, and it is the microphone
   * because the microphone is the thing the owner could not find. The press
   * creates the place the microphone lives; the first held turn happens a
   * moment later, against a tutor that is listening.
   */
  const voiceBlocked = offers ? micBlockedReason(offers.voiceAvailable, offers.microphoneBlockedBy) : null;
  pressRef.current = () => {
    /*
     * The orb ducks the ambient bed for the length of a hold and un-ducks it
     * when the hold ends. There is no hold here, so there is no end, and the
     * bed would stay quiet for the rest of the session.
     */
    duckTutorAmbient(false);
    if (!offers || starting || micPlan.state !== 'idle') return;
    playPlatformSound('tutor_chip');
    begin({ ...primaryOpening(offers), wantsVoice: voiceBlocked === null });
  };

  const mic: StageMicProps = {
    state: micPlan.state,
    // The introduction's orb cannot record, so it holds the stand-in above; every
    // other phase holds the real hook, whose `enabled` gate already says no.
    microphone: phase === 'introducing' ? openingMicrophone : microphone,
    blockedReason: micPlan.blockedReason,
    blockedCopy: micPlan.blockedKey ? t(micPlan.blockedKey) : null,
    idleCopy: micPlan.idleKey ? t(micPlan.idleKey) : undefined,
    denied: microphone.permission === 'denied',
    onClip: handleClip,
    onInterrupt: () => setInterruptedSeq(turnSeq),
  };

  /*
   * THE WHOLE CAST STANDS ON THE ISLAND WHILE IT IS BEING CHOSEN FROM.
   *
   * Without this the picker hung a name plate at each stage mark while the
   * scene rendered only the tutor and their companion, so two of the four
   * plates floated over empty grass and "choose your tutor by looking at them"
   * was a menu with a 3D background. The list is the catalog's own order, so
   * the HUD and the scene agree about which mark belongs to whom
   * (`anchors.ts` → `castMarks`).
   */
  const audition = useMemo(() => auditionFor(phase, catalog?.characters), [phase, catalog]);

  return (
    <StageShell
      phase={phase}
      mic={mic}
      audition={audition}
      scene={scene}
      character={character}
      companion={companion}
      backdrop={backdrop}
      emotion={turn?.emotion ?? 'neutral'}
      action={turn?.action ?? 'idle'}
      actionKey={turnSeq}
      speechUrl={speechUrl}
      audioKey={turnSeq}
      shot={shot}
      onReady={handleReady}
      onSpeechEnd={handleSpeechEnd}
    >
      {/*
        Exactly one layer is on top at a time, and the island is underneath all
        of them. `arriving` deliberately has none: the shell's own veil is the
        only thing between the learner and the island, and it lifts as soon as
        the first frame is drawn.
      */}

      {phase === 'unavailable' && (
        <StageLayer label={t('tutor.stage.unavailableLayer')} placement="bottom">
          {/*
            DEGRADE TO THE ISLAND, not to an error card. `/tutor` has shown the
            3D stage in production since August; if the Tutor API is
            unreachable — a bad deploy order, a Core outage, a migration not yet
            applied — replacing a working scene with a grey apology is strictly
            worse than what was already there. The learner still gets their
            characters, and the line says plainly that the talking part is
            resting rather than pretending the page is broken.
          */}
          <HudPlate shape="plate" className="mx-auto">
            <span className="lf-body text-content" role="status">
              {t('tutor.page.unavailable')}
            </span>
          </HudPlate>
        </StageLayer>
      )}

      {phase === 'personalizing' && personalizeLayer && (
        /*
          `world`, not `fill`. The picker's controls are anchored to the places
          they change, so this layer must hand every pixel it is not occupying
          back to the island: a `fill` column would sit over the middle of the
          scene catching the taps that ARE the personalization.
        */
        <StageLayer label={t('tutor.stage.personalizeLayer')} placement="world">
          <PersonalizeInWorld {...personalizeLayer} />
        </StageLayer>
      )}

      {phase === 'introducing' && offerLayer && (
        /*
          `world`, like the picker, and for the same reason. The tutor greets in
          a caption over its own head and the openings hang in the air in front
          of it; the only thing pinned to the viewport is the microphone. A
          `fill` column here is exactly what the rejected card grid was, and the
          two status plates and the two secondary controls that used to sit
          under it now belong to the layer, beside the chip they refer to.

          `character` and `nickname` travel alongside the seam rather than
          inside it: a tutor introducing itself needs its own name and the
          learner's, and no other layer does.
        */
        <StageLayer label={t('tutor.stage.introduceLayer')} placement="world">
          <OfferChips {...offerLayer} character={character} nickname={preferences?.nickname ?? null} />
        </StageLayer>
      )}

      {phase === 'conversing' && conversationLayer && (
        /*
          `world`, like the two before it. Everything the conversation renders
          is already `position: fixed` and escapes this wrapper either way, so
          the placement is invisible in a screenshot and decisive to a finger:
          `fill` mounts a `pointer-events-auto min-h-full` centred column, which
          silently swallows every tap down the middle of the island. Nothing in
          a conversation needs those taps today and the island's pick proxies
          will.
        */
        <StageLayer label={t('tutor.stage.conversationLayer')} placement="world">
          <ConversationView {...conversationLayer} />
        </StageLayer>
      )}

      {phase === 'closing' && (
        /*
          `bottom`, so the goodbye hangs low over an island the camera has
          already pulled back to see whole. It used to be `fill`, which is a
          `min-h-full` centred column: the plate landed in the middle of the
          screen, over the character, and the saved-conversation list unrolled
          under it as a page. A session that ends by replacing the world with a
          summary box takes away the place the learner was just in, at the exact
          moment the product is trying to give them a reason to come back
          (/ORACLE.md §9.5). The full close performance — the wave, the bow, the
          recap chips anchored to the island — is increment 3; this is the
          silhouette it has to grow out of, not a page it has to replace.
        */
        <StageLayer label={t('tutor.stage.closeLayer')} placement="bottom">
          <HudPlate shape="plate" floor="surface" className="mx-auto">
            <span className="flex flex-col gap-2 text-center">
              <span className="lf-headline text-content">{t('tutor.page.seeYouSoon')}</span>
              <span className="lf-body text-content-muted">{t('tutor.page.sessionSaved')}</span>
            </span>
          </HudPlate>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {/*
              The ONE indigo action of this phase (/DESIGN.md → Screen Recipes
              → Tutor: one indigo action per phase). Starting again is what the
              close is for; looking at the archive is a quieter second thought,
              so it is a chip beside it rather than a rival button.
            */}
            <Button
              onClick={() => {
                setSession(null);
                setPhase('introducing');
              }}
            >
              {t('tutor.page.startAnother')}
            </Button>

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

          {/*
            Opened deliberately, closed again, exactly as it is on the
            introduction. A list of past conversations is a list, and a list
            over the island is the silhouette this rebuild removes; it is
            acceptable only because a learner asked for it by name. It becomes
            stones on the island's shore in increment 4 (/ORACLE.md §12).
          */}
          {historyOpen && token && (
            <HudPlate shape="sheet" floor="surface" className="mx-auto">
              <div className="flex w-full flex-col gap-3 text-left">
                <span className="lf-title text-content">{t('tutor.history.title')}</span>
                <SessionHistory token={token} />
              </div>
            </HudPlate>
          )}
        </StageLayer>
      )}
    </StageShell>
  );
}
