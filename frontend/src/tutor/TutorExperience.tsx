import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { duckTutorAmbient, playPlatformSound } from '@/lib/sound';
import { SCENE_ASSETS } from '@/tutor-scene/assets';
import { isSceneBackdropId, type SceneBackdropId } from '@/tutor-scene/backdrops';
import {
  getMap,
  getOffers,
  getPreferences,
  getTranscript,
  resumeSession,
  savePreferences,
  startSession,
  type StartSessionInput,
  type TutorMapResponse,
} from './tutorApi';
import { micBlockedForOffers, micBlockedReason, narrowBlockedReason, primaryOpening } from './mic';
import { PersonalizeInWorld } from './PersonalizeInWorld';
import { OfferChips } from './OfferChips';
import { ConversationView } from './ConversationView';
import { ClosingInWorld } from './ClosingInWorld';
import { ReplayInWorld } from './replay/ReplayInWorld';
import { buildReplayScript, type ReplayScript } from './replay/replayScript';
import { useReplayDirector } from './replay/useReplayDirector';
import { auditionFor } from './stage/phases';
import { micForPhase } from './stage/micForPhase';
import {
  shotForPhase,
  StageLayer,
  StageShell,
  type ConversationLayerProps,
  type OfferLayerProps,
  type PersonalizeLayerProps,
  type ReplayLayerProps,
  type StageMicProps,
  type StagePhase,
} from './stage/StageShell';
import { useHandsFreeTurn } from './useHandsFreeTurn';
import { useMicrophone, type Microphone } from './useMicrophone';
import { useTutorSocket } from './useTutorSocket';
import type { SessionSummary, StartedSession, TutorCatalog, TutorOffers, TutorPreferences } from './types';

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
  /** The learning map (Tutor v3). Null = the v2 openings — graceful. */
  const [map, setMap] = useState<TutorMapResponse | null>(null);
  const [session, setSession] = useState<StartedSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [stageReady, setStageReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /*
   * The wait between a learner's turn and the tutor's answer.
   *
   * It lives HERE rather than inside the conversation, because the microphone
   * shows it and there is only one microphone now — mounted by the shell, for
   * the whole route. Two copies of "am I waiting" is how the spinner on the
   * lesson plate and the ring on the orb come to disagree.
   */
  const [awaitingReply, setAwaitingReply] = useState(false);

  /*
   * THE SAVED CONVERSATION BEING PERFORMED, in three pieces (/ORACLE.md §12).
   *
   * The SUMMARY arrives from the archive and lands first, because it carries
   * the character and the island: the camera can start on the right world
   * while the transcript is still in flight, instead of opening on the default
   * one and correcting itself in front of the learner. The SCRIPT is the
   * transcript compiled into beats (`replay/replayScript.ts`). The two flags
   * are the ordinary shape of one fetch, kept separate from the script so that
   * "nothing loaded yet", "it failed" and "it loaded and has no lines in it"
   * are three states the layer can say three different things about.
   */
  const [replaySummary, setReplaySummary] = useState<SessionSummary | null>(null);
  const [replayScript, setReplayScript] = useState<ReplayScript | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  /**
   * Which transcript we are actually waiting for.
   *
   * A learner who opens one conversation, changes their mind and opens another
   * has two requests in flight, and PostgREST is under no obligation to answer
   * them in order. Without this the slower one wins and performs the wrong
   * session. Cleared on leaving, so a response that lands after the learner has
   * gone cannot resurrect the phase.
   */
  const wantedReplayRef = useRef<string | null>(null);

  const socket = useTutorSocket(phase === 'conversing' ? (session?.socketUrl ?? null) : null);

  const director = useReplayDirector(phase === 'replaying' ? replayScript : null);

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

      const [prefsResult, offersResult, mapResult] = await Promise.all([
        getPreferences(authToken),
        getOffers(authToken),
        // Best-effort: a failed map read falls back to the v2 openings and
        // never blocks the phase — the offers are the load-bearing read.
        getMap(authToken),
      ]);
      if (cancelled) return;

      if (!prefsResult.data || !offersResult.data) {
        // Refuse rather than improvising defaults: a learner whose chosen
        // character silently reverted to Rho because a read failed would
        // reasonably conclude the product forgot them (§1.14).
        setPhase('unavailable');
        return;
      }

      const { catalog: served, personalized, ...prefs } = prefsResult.data;
      setPreferences(prefs);
      setCatalog(served);
      setOffers(offersResult.data);
      setMap(mapResult.data ?? null);
      /*
       * The picker opens on the first visit and never again — and the SERVER
       * remembers now (`personalized`: a preferences row exists, which the
       * picker's Done guarantees). The nickname and the localStorage marker
       * stay as belt-and-braces: the local one covers the beat before the
       * first save lands, and costs at worst one extra visit to a screen that
       * is an invitation.
       */
      setPhase(
        prefs.nickname !== null || personalized || hasSeenPicker(userIdRef.current)
          ? 'introducing'
          : 'personalizing',
      );
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

  /*
   * OPEN A SAVED CONVERSATION, ON THE ISLAND IT HAPPENED ON.
   *
   * The phase changes FIRST and the fetch follows, which is the opposite of
   * what a list-shaped replay would do. The canvas never unmounts, so moving to
   * `replaying` immediately puts the camera on the right character in the right
   * world and the transcript arrives into a stage that is already standing —
   * rather than the learner staring at the archive for a round trip and then
   * being dropped into a scene.
   */
  const openReplay = useCallback(
    (summary: SessionSummary) => {
      if (!token) return;
      wantedReplayRef.current = summary.id;
      setReplaySummary(summary);
      setReplayScript(null);
      setReplayError(null);
      setReplayLoading(true);
      setPhase('replaying');

      void getTranscript(token, summary.id).then((result) => {
        // Somebody else's answer, or an answer to a learner who has already
        // left. Either way it is not the performance on screen.
        if (wantedReplayRef.current !== summary.id) return;
        setReplayLoading(false);
        if (result.error || !result.data) {
          setReplayError(result.error?.code ?? 'INTERNAL');
          return;
        }
        setReplayScript(buildReplayScript(result.data));
      });
    },
    [token],
  );

  const closeReplay = useCallback(() => {
    wantedReplayRef.current = null;
    setReplayScript(null);
    setReplaySummary(null);
    setReplayError(null);
    setReplayLoading(false);
    /*
     * The live session goes with it. A replay reached from the GOODBYE leaves a
     * finished `StartedSession` in state, and returning to the introduction
     * with it still set would keep deriving the island and the cast from a
     * conversation that is over — so the learner's own preferences, which is
     * what the introduction is supposed to show, would be ignored until they
     * started another one.
     */
    setSession(null);
    setPhase('introducing');
  }, []);

  /*
   * THE SESSION ENDED — BUT WHICH ENDING?
   *
   * These are three different events and they were all rendered as the same
   * warm goodbye: the server said farewell, the socket opened and dropped, and
   * the socket NEVER OPENED. The last one is a total outage, and the learner
   * was shown Dr. Rho waving and the words "saved — you can listen to it
   * whenever you want", about a conversation that had not happened.
   *
   * That is why this fault was invisible for so long: the product's failure
   * mode was a convincing success. §1.14 — a failure must be distinguishable
   * from a completion, and it must be distinguishable BY THE PERSON LOOKING AT
   * IT, not only in a console nobody has open.
   *
   * A socket that never carried a single turn did not hold a conversation, so
   * it goes to `unavailable` — the honest "the tutor cannot be reached" state
   * that already exists for a failed preferences read.
   */
  /*
   * A DROPPED CONNECTION GETS ONE QUIET REPAIR before any of that (owner
   * sign-off 2026-08-28). Oracle parks the conversation for a grace window and
   * Core mints a fresh single-use token, so a sleeping phone or a flaky café
   * network costs a beat, not the session. Auto-resumed at most ONCE per
   * session: a link that keeps dropping deserves the honest ending, not a
   * reconnect loop. Only a genuine CONNECTION_LOST qualifies — a server that
   * said goodbye (`closedReason`), refused the token, or exhausted the budget
   * has already told us what happened, and re-dialling would argue with it.
   */
  const [resuming, setResuming] = useState(false);
  const resumeAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== 'conversing') return;
    const ended =
      socket.closedReason !== null || socket.connection === 'closed' || socket.connection === 'failed';
    if (!ended || resuming) return;

    const droppedNotRefused =
      socket.closedReason === null &&
      (socket.error === null || socket.error.code === 'CONNECTION_LOST');
    if (
      droppedNotRefused &&
      session &&
      token &&
      socket.history.length > 0 &&
      resumeAttemptedRef.current !== session.sessionId
    ) {
      resumeAttemptedRef.current = session.sessionId;
      setResuming(true);
      void resumeSession(token, session.sessionId).then((result) => {
        setResuming(false);
        if (result.data) {
          const fresh = result.data;
          // A new socketUrl is all it takes: the hook resets and re-dials, and
          // the server replays the transcript into the fresh connection.
          setSession((prev) =>
            prev && prev.sessionId === fresh.sessionId
              ? { ...prev, socketUrl: fresh.socketUrl, socketExpiresAt: fresh.socketExpiresAt }
              : prev,
          );
          return;
        }
        // The park expired or the resume was refused. The conversation that
        // did happen still gets its goodbye.
        setPhase('closing');
      });
      return;
    }

    const heldAConversation = socket.history.length > 0;
    setPhase(heldAConversation ? 'closing' : 'unavailable');
  }, [phase, socket.closedReason, socket.connection, socket.history.length, socket.error, resuming, session, token]);

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
  /*
   * A REPLAY OUTRANKS BOTH, and only while it is the phase.
   *
   * A saved session recorded the island and the cast it happened with, so those
   * are what it is performed on — not whatever the learner has chosen since. A
   * conversation with Dina on diorama-b does not become a conversation with
   * Zara Vex because the learner repainted the place last Tuesday.
   *
   * Written as a narrowed local rather than a boolean so TypeScript follows it:
   * a `const replaying = phase === 'replaying' && summary !== null` cannot
   * narrow `summary` at the use site, and every read below would need its own
   * non-null assertion.
   */
  const replay = phase === 'replaying' ? replaySummary : null;

  const scene = narrowScene(replay ? replay.diorama : (session?.diorama ?? preferences?.diorama));
  /*
   * THE LIGHT IS THE LEARNER'S, AND THAT IS HONEST RATHER THAN A SHORTCUT.
   *
   * `tutor_sessions` has no backdrop column — migration 0047 records the
   * character, the companion and the diorama, and the light travels with the
   * PREFERENCE (`tutor_preferences.backdrop`), which is why `StartedSession`
   * carries it from prefs at start time and the transcript's summary does not
   * carry it at all. So a replay runs under the light the learner has chosen,
   * which is the same light every other phase of their route is under. The
   * alternative would be to guess a dusk from a timestamp, and a confidently
   * wrong sunset is worse than the learner's own sky (/AGENTS.md §1.14).
   */
  const backdrop = narrowBackdrop(session?.backdrop ?? preferences?.backdrop);
  const character = replay
    ? replay.character
    : (session?.character ?? preferences?.character ?? 'rho');
  // `null` is a real answer here ("just us"), so the nullish chain has to be
  // written out: `session?.companion ?? preferences?.companion` would treat a
  // deliberately empty companion slot as "unset" and re-fill it.
  const companion = replay
    ? replay.companion
    : session
      ? session.companion
      : (preferences?.companion ?? null);

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
  const liveSpeechUrl =
    phase === 'conversing' && stageReady && !interrupted ? (turn?.audioUrl ?? null) : null;

  /*
   * WHY THE TUTOR IS SILENT, SAID OUT LOUD.
   *
   * A null `speechUrl` has four completely different causes and nothing
   * distinguished them, so "the tutor has no voice" was one symptom for four
   * bugs — and every one of them looks identical to a learner, because the
   * line is captioned either way.
   *
   * On 2026-08-29 that cost a full debugging pass: the server side was proved
   * healthy end to end (all twelve enrolled voices synthesize, Depot stores and
   * serves them, CORS is open, and every tutor row in the owner's own sessions
   * carries an `audio_path`), and the browser still played nothing, with no way
   * to tell which gate had closed.
   *
   * Diagnostic only — it changes no behaviour and runs once per turn.
   */
  useEffect(() => {
    if (phase !== 'conversing' || turn == null) return;
    if (liveSpeechUrl !== null) return;
    const because = !stageReady
      ? 'the 3D stage has not reported a first frame (speech gate still closed)'
      : interrupted
        ? 'this turn was interrupted by the learner'
        : turn.audioUrl == null
          ? 'the server sent no audio URL for this turn (turn_audio missing, dropped, or null)'
          : 'unknown — the gate is open and a URL exists, so playback is the suspect';
    console.warn(`[tutor] turn ${turn.seq} is silent: ${because}`);
  }, [phase, turn, liveSpeechUrl, stageReady, interrupted]);

  /*
   * ONE AUDIO ELEMENT, TWO THINGS THAT CAN FILL IT.
   *
   * The stage owns exactly one `<audio>` and everything about it is driven by
   * these three props. A live session fills them from the socket; a replay
   * fills them from the director. They are combined HERE, at the one place that
   * knows which phase is on, rather than by letting a layer reach the element —
   * two owners of one clip is a tutor talking over its own recording.
   *
   * The KEY is the director's beat key rather than an index, so pressing play
   * on the line that is already on screen genuinely replays it: the URL has not
   * changed, and `TutorStage` restarts on either prop moving.
   */
  const replayKey = director?.beatKey ?? 0;
  const speechUrl = phase === 'replaying' ? (director?.speechUrl ?? null) : liveSpeechUrl;
  const audioKey = phase === 'replaying' ? replayKey : turnSeq;

  /*
   * Mirrored into state rather than read as `Boolean(speechUrl)` because the
   * bubble's 2D head must stop moving when the CLIP ends, which is a moment
   * only the audio element knows about — the URL is still set for the whole
   * time the tutor is silent afterwards, waiting for the learner.
   */
  useEffect(() => {
    setSpeaking(speechUrl !== null);
  }, [speechUrl, audioKey]);

  /*
   * MUTE MUST NOT ALSO MEAN DEAF.
   *
   * `speaking` above is derived from the URL, not from playback, because the
   * caption and the microphone both want to know a turn is in flight before a
   * single byte has decoded. The cost is that a turn whose audio never plays
   * would leave it stuck true — and `useHandsFreeTurn` waits for the tutor to
   * STOP speaking, so the learner's microphone would never open again for the
   * rest of the session.
   *
   * A browser blocking autoplay until the page is tapped is the ordinary way
   * into that, and it is common on a first load. The stage already handles its
   * own half honestly — the mouth stops and a chip explains — but the signal
   * never reached here, so the tutor was silent AND deaf at the same time, and
   * the learner had no way to tell which.
   *
   * Blocked means not speaking. That is all this says.
   */
  const handleSpeechBlocked = useCallback((blocked: boolean) => {
    if (blocked) setSpeaking(false);
  }, []);

  /*
   * The tutor answering is what ends the wait, whatever the learner sent. ANY
   * turn clears it, including one the server volunteers, because a spinner that
   * outlives the thing it was spinning for is worse than no spinner.
   */
  useEffect(() => {
    setAwaitingReply(false);
    setReplyTimedOut(false);
  }, [turnSeq]);

  /*
   * The server's own word ends the wait too, in both directions. `thinking`
   * arriving confirms the optimistic spinner; an error frame (a failed
   * transcription, a refused turn) clears `socket.thinking`, and without this
   * mirror the local flag would keep the orb spinning at a turn the server has
   * already given up on — the stuck state the owner reported.
   */
  useEffect(() => {
    if (!socket.thinking && socket.error !== null) setAwaitingReply(false);
  }, [socket.thinking, socket.error]);

  /*
   * AND THE WAIT HAS A CEILING. `awaitingReply` had no timeout at all: a
   * server that never answered left the orb spinning for the rest of the
   * session, which is the exact "stuck forever" the owner reported. 25 s is
   * past every upstream timeout Oracle enforces (model 20 s), so a wait that
   * reaches it is not slow — something is wrong, and the honest move is to
   * stop spinning and say what to do. If the reply lands late anyway, the
   * arriving turn clears the notice like any other.
   */
  const [replyTimedOut, setReplyTimedOut] = useState(false);
  useEffect(() => {
    if (!awaitingReply) return;
    setReplyTimedOut(false);
    const timer = window.setTimeout(() => {
      setAwaitingReply(false);
      setReplyTimedOut(true);
    }, 25_000);
    return () => window.clearTimeout(timer);
  }, [awaitingReply]);

  const handleClip = useCallback(
    (clip: Blob | null) => {
      // Null is a mis-tap the hook already dropped. Marking that as "waiting"
      // would leave the orb thinking about a turn that was never sent — and
      // whatever chunks streamed ahead are walked away from, uncommitted.
      if (!clip) {
        socket.abandonAudioStream();
        return;
      }
      setAwaitingReply(true);
      // The clip usually finished uploading DURING the hold (the chunk
      // stream); the commit is then one tiny frame and transcription starts
      // immediately. The whole-clip send is the fallback for a hold the
      // stream never opened for (a recorder with no timeslices, say).
      if (!socket.commitAudioStream()) void socket.sendAudio(clip);
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
   *
   * `onChunk` feeds the streamed upload: each quarter-second of audio leaves
   * for the server while the learner is still talking, so releasing the button
   * costs a commit frame instead of a whole-clip upload.
   */
  const microphone = useMicrophone(phase === 'conversing' && socket.microphone, {
    onAutoRelease: handleClip,
    onChunk: socket.streamAudioChunk,
  });

  /*
   * HANDS-FREE LISTENING — the blueprint's differentiator #1.
   *
   * The tutor asks, the microphone opens on its own, and the turn ends when the
   * child stops talking rather than when they remember to let go of a button.
   * The silence budget is the one the pedagogical strategy chose, so thinking
   * time is protected exactly where thinking is the point.
   *
   * It rides the SAME gate push-to-talk does (`socket.microphone`, which is
   * downstream of consent and of Core's answer), opens only in the gap after a
   * tutor turn, and closes itself when nobody speaks. Holding the orb still
   * works and is untouched — this adds a way to answer, it does not remove one.
   */
  useHandsFreeTurn({
    enabled: phase === 'conversing' && socket.microphone,
    speaking,
    awaitingReply,
    policy: turn?.policy ?? null,
    turnSeq: turn?.seq ?? 0,
    microphone,
    onTurn: handleClip,
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
  // A live segment is deliberately NOT an input here: the plate is composed
  // around, never cut away from (/ORACLE.md §9.3, and the note in `phases.ts`).
  const shot = shotForPhase({
    phase,
    articulates,
    adaptationOffered: socket.adaptationOffer !== null,
    // The map pulls the introduction back to the island (phases.ts).
    mapOpen: phase === 'introducing' && (map?.nodes.length ?? 0) > 0,
    // The pull back to the island at the end of a replay is the same goodbye
    // the session itself ended on (/ORACLE.md §9.5, and the note in `phases.ts`).
    replayEnded: director?.finished ?? false,
  });

  const handleReady = useCallback(() => setStageReady(true), []);

  /*
   * THE CLIP ENDED — and in a replay that is also the beat ending.
   *
   * Held in a ref rather than closed over, because the director is a new object
   * on every beat and this callback is a prop of the ONE canvas: rebuilding it
   * sixty times a conversation would hand `TutorStage` a new `onEnded` for every
   * pose change. The ref is written during render, the same pattern the plate's
   * detent and the lab's socket use, so it can never be a commit behind.
   */
  const speechEndRef = useRef<(() => void) | null>(null);
  speechEndRef.current = phase === 'replaying' ? (director?.handleSpeechEnd ?? null) : null;
  const handleSpeechEnd = useCallback(() => {
    setSpeaking(false);
    speechEndRef.current?.();
  }, []);

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
            // screen" rather than "I changed one thing". The empty save is the
            // SERVER-SIDE half of the marker: it guarantees a preferences row
            // exists, which is what `personalized` reads on the next visit —
            // so a cleared browser no longer re-opens the picker forever.
            persistPreferences({});
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
          onReplay: openReplay,
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
          resuming,
          replyTimedOut,
          onRestart: () => {
            /*
             * Start over: the tutor still gets its goodbye turn server-side
             * (`end_session` produces a farewell into the closing session),
             * but the learner is heading for a fresh start, so the phase goes
             * straight to the openings. The offers are re-read because the
             * daily session count just moved — a start button that has
             * quietly stopped being available must say so, not fail.
             */
            socket.endSession();
            setSession(null);
            setPhase('introducing');
            if (token) {
              void getOffers(token).then((result) => {
                if (result.data) setOffers(result.data);
              });
              // The map moved too: the session that just ended changed mastery.
              void getMap(token).then((result) => {
                if (result.data) setMap(result.data);
              });
            }
          },
          onExit: () => {
            socket.endSession();
            setPhase('closing');
          },
        }
      : null;

  const replayLayer: ReplayLayerProps = {
    ...common,
    director,
    loading: replayLoading,
    error: replayError,
    onDone: closeReplay,
  };

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
    present: micPlan.present,
    state: micPlan.state,
    // The introduction's orb cannot record, so it holds the stand-in above; every
    // other phase holds the real hook, whose `enabled` gate already says no.
    microphone: phase === 'introducing' ? openingMicrophone : microphone,
    blockedReason: micPlan.blockedReason,
    blockedCopy: micPlan.blockedKey ? t(micPlan.blockedKey) : null,
    idleCopy: micPlan.idleKey ? t(micPlan.idleKey) : undefined,
    denied: microphone.permission === 'denied',
    onClip: handleClip,
    onInterrupt: () => {
      // Local squelch AND a server-side abort: the clip stops here, and the
      // production in flight (model call, synthesis) stops costing money for
      // a reply the learner has already talked past.
      setInterruptedSeq(turnSeq);
      setAwaitingReply(false);
      socket.interrupt();
    },
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
      mic={mic}
      /*
       * THE DOCK IS NAMED FOR WHAT IT IS IN THIS PHASE.
       *
       * It is the bottom cluster whether or not the microphone is standing in
       * it (/DESIGN.md → Screen Recipes → Tutor), and its landmark name was the
       * constant "Talk to your tutor" — correct in the four phases with an orb,
       * and a flat contradiction in the two without one, where it wraps a
       * goodbye or a transport.
       */
      dockLabel={
        phase === 'replaying'
          ? t('tutor.stage.replayControls')
          : phase === 'closing'
            ? t('tutor.stage.closeControls')
            : undefined
      }
      audition={audition}
      scene={scene}
      character={character}
      companion={companion}
      backdrop={backdrop}
      /*
       * THE POSE COMES FROM WHICHEVER IS PERFORMING. Live, it is the turn the
       * socket just delivered; in a replay it is the emotion and the action the
       * character ORIGINALLY carried, read straight off the stored row. That is
       * the sentence /ORACLE.md §12 has been promising since the schema was
       * written, and it needed no contract change to keep.
       */
      emotion={director?.beat?.emotion ?? turn?.emotion ?? 'neutral'}
      action={director?.beat?.action ?? turn?.action ?? 'idle'}
      actionKey={phase === 'replaying' ? replayKey : turnSeq}
      speechUrl={speechUrl}
      audioKey={audioKey}
      shot={shot}
      onReady={handleReady}
      onSpeechEnd={handleSpeechEnd}
      onSpeechBlocked={handleSpeechBlocked}
    >
      {/*
        Exactly one layer is on top at a time, and the island is underneath all
        of them. `arriving` deliberately has none: the shell's own veil is the
        only thing between the learner and the island, and it lifts as soon as
        the first frame is drawn.
      */}

      {/*
        `unavailable` HAS NO LAYER, and the absence is the fix.

        DEGRADE TO THE ISLAND, not to an error card — that part was right and has
        not changed. `/tutor` has shown the 3D stage in production since August;
        if the Tutor API is unreachable, replacing a working scene with a grey
        apology is strictly worse than what was already there. What was wrong was
        saying so TWICE: this layer's plate measured (26, 714, 322, 82) and the
        orb's own blocked line (26, 736, 322, 64), at both widths, one on top of
        the other. Two explanations for one situation is a bug even when they
        clear each other, and the one to keep is the one attached to the control
        it is about. `micForPhase` hands the orb `tutor.page.tutorUnavailable` — the
        same sentence, in the only place a learner is already looking.
      */}

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
          <OfferChips {...offerLayer} character={character} nickname={preferences?.nickname ?? null} map={map} />
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
          `world`, and the goodbye itself rides the SHELL'S DOCK.

          It used to be a `bottom` layer, which puts three surfaces against the
          bottom of the viewport in a place the camera does not know about: the
          only channel a bottom layer has is `keepClearOf`, and that moves the
          microphone dock — which is deliberately absent here
          (`stage/micForPhase.ts` → `present: false`). So nothing told the
          composition solver the goodbye existed, and at 1280x800 the
          establishing shot centred the island with the tutor in the middle of
          it and "See you soon!" landed across their chin. The dock is measured
          on the `mic` safe-area slot, so the same three surfaces portalled into
          it are a rectangle the camera aims around
          (`tutor/ClosingInWorld.tsx`).

          The full close performance — the wave, the bow, the recap chips
          anchored to the island — is increment 3; this is the silhouette it has
          to grow out of, not a page it has to replace (/ORACLE.md §9.5).
        */
        <StageLayer label={t('tutor.stage.closeLayer')} placement="world">
          <ClosingInWorld
            token={token}
            onStartAnother={() => {
              setSession(null);
              setPhase('introducing');
            }}
            onReplay={openReplay}
          />
        </StageLayer>
      )}

      {phase === 'replaying' && (
        /*
          `world`, like every other layer, and here the placement is load
          bearing rather than invisible: the replay's caption is anchored to the
          performing character's own crown, exactly as a live one is, and a
          `fill` column would sit over the island catching the taps the scene is
          entitled to. Everything else this layer renders is either the lesson
          plate or a row portalled into the shell's dock.

          THE PERFORMANCE IS DRIVEN FROM HERE, not from inside the layer. The
          pose, the clip and the shot above are read off the director and handed
          to the one canvas, so a replay is the same four scene props a live
          session fills — which is the entire reason a saved conversation can be
          re-enacted at all without a second stage (/ORACLE.md §12).
        */
        <StageLayer label={t('tutor.stage.replayLayer')} placement="world">
          <ReplayInWorld {...replayLayer} />
        </StageLayer>
      )}
    </StageShell>
  );
}
