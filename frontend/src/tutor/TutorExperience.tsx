import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { MentorCalibration } from '@/rebuild/identity/MentorCalibration';
import calibrationEn from '@/i18n/en-US/rebuild.json';
import calibrationEs from '@/i18n/es-MX/rebuild.json';
import calibrationPt from '@/i18n/pt-BR/rebuild.json';
import { duckTutorAmbient, playPlatformSound } from '@/lib/sound';
import { trackInsight } from '@/lib/insights';
import { SCENE_ASSETS } from '@/tutor-scene/assets';
import { isSceneBackdropId, type SceneBackdropId } from '@/tutor-scene/backdrops';
import {
  getMap,
  getAgeCalibration,
  saveAgeCalibration,
  type AgeCalibration,
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
import { useTutorLearningStats } from './useTutorLearningStats';
import { MapOverlay } from './MapOverlay';
import { ClosingInWorld } from './ClosingInWorld';
import { ReplayInWorld } from './replay/ReplayInWorld';
import { buildReplayScript, type ReplayScript } from './replay/replayScript';
import { useReplayDirector } from './replay/useReplayDirector';
import { useRoleplayDirector } from './roleplay/useRoleplayDirector';
import { RoleplayCaption } from './roleplay/RoleplayCaption';
import { RoleplayAudio } from './roleplay/RoleplayAudio';
import { isRoleplaySceneId } from './roleplay/scenes';
import { avatarDataUri } from '@/lib/avatarOptions';
import { isLocale } from '@/i18n';
import { resolvePointBearing, type PointBearing } from '@/tutor-scene/pointTarget';
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
import type { CharacterCue } from '@/lesson-engine/core/types';
import { guidedReviewSkillFrom } from '@/routes/app/learn/paths';

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

/*
 * THE ACTIVE SESSION, PERSISTED SO A PAGE RELOAD RESUMES IT INSTEAD OF
 * ABANDONING IT.
 *
 * The server already parks a dropped conversation and replays its whole
 * history over a fresh socket — that is exactly what the in-page
 * CONNECTION_LOST resume below relies on. The one gap was a full PAGE RELOAD:
 * it wipes `session` from React state, so on remount the client had no id to
 * resume from and silently started a brand-new conversation. The child's
 * turns, the board, and the tutor's read of where they were stuck were all
 * abandoned, leaving a "0-line" ghost in the history. Found live driving the
 * tutor as a real user who pressed F5 mid-conversation (2026-09-10).
 *
 * `sessionStorage`, NOT `localStorage`: the scope is precisely one tab across
 * a reload. Closing the tab is a deliberate leave and must not resurrect a
 * conversation later — and the server's park grace window would have expired
 * anyway, so a stale id would only ever resolve to a refused resume.
 *
 * The WHOLE `StartedSession` is stored, not just the id: the scene and the
 * voice/mic-consent flags were computed by the server at session start and
 * have to survive the reload unchanged. Only the single-use `socketUrl` is
 * discarded and replaced, by a fresh one from `resumeSession`, on the way
 * back in — and the server still re-checks voice consent per turn regardless,
 * so a resumed flag can never open a microphone the guardian has since closed.
 */
const ACTIVE_SESSION_KEY_PREFIX = 'lf.tutor.activeSession.';

function readActiveSession(userId: string | undefined): StartedSession | null {
  if (!userId) return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_SESSION_KEY_PREFIX + userId);
    return raw ? (JSON.parse(raw) as StartedSession) : null;
  } catch {
    // Private browsing, a blocked origin, malformed JSON. A missed resume
    // costs one fresh start, never a throw on the way into the route.
    return null;
  }
}

function rememberActiveSession(userId: string | undefined, session: StartedSession): void {
  if (!userId) return;
  try {
    window.sessionStorage.setItem(ACTIVE_SESSION_KEY_PREFIX + userId, JSON.stringify(session));
  } catch {
    /* See PERSONALIZED_KEY_PREFIX: never worth failing a session over. */
  }
}

function clearActiveSession(userId: string | undefined): void {
  if (!userId) return;
  try {
    window.sessionStorage.removeItem(ACTIVE_SESSION_KEY_PREFIX + userId);
  } catch {
    /* ignore — see above. */
  }
}

/**
 * The daily session cap's own boundary, mirrored from the server.
 *
 * `backend/src/routes/tutor.ts`'s `startOfLocalDayIso` is the actual source of
 * truth — the calendar day, IN THE LEARNER's OWN TIMEZONE, a session counts
 * against (round 34, 2026-08-30: a UTC-midnight or browser-local-midnight
 * boundary disagrees with it for the large majority of real users). There is
 * no shared package (§1.2), so this is duplicated rather than imported — the
 * algorithms are mirrored across independent services: the algorithm travels,
 * the function itself does not. `SESSION_CAP_TIMEZONE`
 * and the default fallback ('es-MX') are copied byte-for-byte from the same
 * source, including `normalizeLocale`'s own default, so a value this client
 * has never seen degrades exactly the way the server's own default does.
 */
const SESSION_CAP_TIMEZONE: Record<string, string> = {
  'es-MX': 'America/Mexico_City',
  'pt-BR': 'America/Sao_Paulo',
  'en-US': 'America/New_York',
};

function startOfLocalDayIso(locale: string, now: Date = new Date()): string {
  const timeZone = SESSION_CAP_TIMEZONE[locale] ?? SESSION_CAP_TIMEZONE['es-MX'];
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // Same derivation as the server: the clock reading `now` HAS in `timeZone`,
  // reinterpreted as UTC, reveals that zone's current offset — correct across
  // a DST transition because it is derived from `now` rather than a fixed
  // table. `% 24` guards `Intl`'s documented midnight-as-"24" quirk.
  const asIfUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  /*
   * FLOORED TO THE WHOLE SECOND, which the server's own version is not —
   * caught here because THIS caller, unlike the server's, compares the
   * result for exact equality (`refusedToday`) rather than using it as a
   * `>=` range boundary. `Intl.formatToParts` only resolves to the second,
   * so subtracting `now.getTime()` (which carries real milliseconds) from a
   * millisecond-less `asIfUtcMs` leaks `now`'s own arbitrary millisecond
   * into the result — two calls a few hundred ms apart on the SAME
   * calendar day then disagree at the millisecond digit and never compare
   * equal. Harmless for a range filter's `sinceIso`; fatal for a stored key
   * this file re-derives on every mount and expects to match byte-for-byte.
   */
  const offsetMs = asIfUtcMs - Math.floor(now.getTime() / 1000) * 1000;
  const localMidnightUtcMs =
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 0, 0, 0) - offsetMs;
  return new Date(localMidnightUtcMs).toISOString();
}

/**
 * Where we remember that the daily session cap already refused this learner
 * TODAY (/AGENTS.md §1.14's "a surface that opts out of a system must be told
 * what the system decided", applied to the client rather than a 3D rig — but
 * the same shape: `startError` alone lives in `useState` and a refresh, or
 * navigating away and back, forgets a refusal that is still true, repainting
 * the exact same fully-enabled, inviting offer chips as if nothing had
 * happened).
 *
 * THIS IS NOT CAP ENFORCEMENT — that stays entirely server-authoritative
 * (`start_tutor_session_checked`, atomic, in Postgres). This is the client
 * remembering a FACT it was already told, so a reload shows the same refused
 * state immediately instead of a falsely cheerful screen while the real
 * `GET /offers` round trip is still in flight. Keyed on `startOfLocalDayIso`
 * above rather than on a fixed TTL: a stale flag from a PREVIOUS day must never
 * suppress a fresh day's offer, and comparing against a freshly computed
 * boundary on every read (mount, and again at the next refusal) is what makes
 * that true without a clock-watching timer — the boundary "rolling over" is
 * simply the next comparison finding a different string.
 *
 * Local rather than a server field, for the same reason `PERSONALIZED_KEY_PREFIX`
 * above is: the failure mode of losing it is one extra tap that gets refused
 * again by the real, still-authoritative server check — never a false refusal,
 * since nothing here ever BLOCKS a start on its own, it only pre-fills the
 * screen that would otherwise flash cheerful and then correct itself.
 */
const SESSION_LIMIT_KEY_PREFIX = 'lf.tutor.sessionLimitDay.';

function refusedToday(userId: string | undefined, todayIso: string): boolean {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(SESSION_LIMIT_KEY_PREFIX + userId) === todayIso;
  } catch {
    return false;
  }
}

function rememberSessionLimit(userId: string | undefined, todayIso: string): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(SESSION_LIMIT_KEY_PREFIX + userId, todayIso);
  } catch {
    /* See PERSONALIZED_KEY_PREFIX above: never worth failing a session over. */
  }
}

function clearSessionLimit(userId: string | undefined): void {
  if (!userId) return;
  try {
    window.localStorage.removeItem(SESSION_LIMIT_KEY_PREFIX + userId);
  } catch {
    /* ditto */
  }
}

/** How long to wait for the voice before calling a turn silent — the `turn`
 * frame always arrives with a null URL and the audio follows separately. */
const SILENCE_REPORT_DELAY_MS = 6_000;

export function TutorExperience() {
  const { t, i18n } = useTranslation();
  const { getToken, session: authSession, avatarOptions } = useAuth();
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
  const { isDark } = useTheme();
  const [calibration, setCalibration] = useState<AgeCalibration | null>(null);
  const [calibrationError, setCalibrationError] = useState(false);
  const [calibrationSaving, setCalibrationSaving] = useState(false);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const calibrationGeneration = useRef(0);

  /*
   * The learner's real racha/XP (`/profile`, the same numbers
   * ProfilePage.tsx shows) — resolved here, once, alongside `token` and
   * `userIdRef` above, and handed down through `conversationLayer` rather
   * than fetched again inside `ConversationView`. See the hook's own doc for
   * why it takes these two rather than calling `useAuth()` itself.
   */
  const learningStats = useTutorLearningStats(token, authSession?.user.id);

  const [phase, setPhase] = useState<StagePhase>('arriving');
  /*
   * WHO A LIVE `story` FAMILY SEGMENT IS PORTRAYING, RIGHT NOW.
   *
   * THIS COMPONENT DRIVES THE SCENE; `ConversationView` DOES NOT (see its own
   * file header). `LiveSegmentPanel` has no `CharacterLayerProvider` of its
   * own to draw a `story_dialogue`/`story_scene`/`eavesdrop` segment's
   * character into — a second one would either need a second WebGL context
   * (TUTOR_3D.md §6.2's one-canvas invariant) or render blurred behind the
   * activity plate's own Lumen glass. So the cue bubbles up, unread, through
   * `ConversationView`, and lands here: the one place already computing
   * `character`/`emotion`/`action` for the single canvas below. While a cue
   * is set it OVERRIDES those three for the stage, so the segment's speaker
   * is the SAME 3D model the Tutor's own turns already use, not a flat rig.
   */
  const [segmentCue, setSegmentCue] = useState<CharacterCue | null>(null);
  // Defensive, alongside `LiveSegmentPanel`'s own unmount/segment-change
  // clears: leaving the conversation any other way (a restart, the session
  // ending) must not leave a stale cue pinned to the next phase's cast.
  useEffect(() => {
    if (phase !== 'conversing') setSegmentCue(null);
  }, [phase]);
  const [preferences, setPreferences] = useState<TutorPreferences | null>(null);
  const [catalog, setCatalog] = useState<TutorCatalog | null>(null);
  const [offers, setOffers] = useState<TutorOffers | null>(null);
  // H.3: `tutor_open` was catalogued but emitted nowhere — the event exists
  // so the acquisition/funnel pipeline can see the Mentor actually opened.
  // Fired once per mount (the route IS the session entry), consent-gated by
  // the beacon like every other first-party event.
  const tutorOpenEmitted = useRef(false);
  useEffect(() => {
    if (tutorOpenEmitted.current) return;
    tutorOpenEmitted.current = true;
    trackInsight('tutor_open', { routeClass: 'tutor' });
  }, []);
  /** The learning map (Tutor v3). Null = the v2 openings — graceful. */
  const [map, setMap] = useState<TutorMapResponse | null>(null);
  /**
   * The map, opened as a temporary OVERLAY during `conversing` (Sprint 3,
   * /TUTOR_INSTRUMENTS.md) — the SAME `MapGraph` `introducing` already draws,
   * reused rather than re-implemented, but NOT sharing `introducing`'s
   * "ride the dock's above slot" coexistence layout: `phases.ts`'s own
   * `shotForPhase` deliberately never reads `mapOpen` for `conversing` (its
   * comment: "Ignored outside `introducing`"), and three documents
   * (/ORACLE.md §9.3, §16, /DESIGN.md) make the character's on-screen framing
   * during a conversation a shipping invariant no piece of chrome may move.
   * So this portals over everything instead (`document.body`, the same
   * escape-every-stacking-context tool `ConversationView.tsx`'s dock-`above`
   * portal already uses) — the plate, caption and dock are UNCHANGED
   * underneath it, not squeezed beside it, which is what makes "does not
   * disturb them" true by construction rather than by hand-tuned measurement.
   * Nodes render `disabled` (read-only): tapping one in `introducing` STARTS a
   * session, and starting a second one over an already-live conversation is a
   * new interaction this sprint does not open — "make the map openable", not
   * "make the map navigable mid-conversation".
   */
  const [mapOpen, setMapOpen] = useState(false);
  useEffect(() => {
    if (phase !== 'conversing') setMapOpen(false);
  }, [phase]);
  const [session, setSession] = useState<StartedSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  /**
   * The SESSION_LIMIT refusal's own reset instant (§1.9 clarity — see
   * `OfferChips`'s use of it). Null for every other error, and for
   * SESSION_LIMIT itself if the server ever omits it (an older deploy, a
   * degraded response) — `OfferChips` falls back to the plain, timeless copy
   * rather than rendering a broken interpolation.
   */
  const [startErrorResetAt, setStartErrorResetAt] = useState<string | null>(null);
  const [stageReady, setStageReady] = useState(false);
  /**
   * True when `stageReady` above came from the veil's deadline rather than a
   * real rendered frame — see `StageShellProps.onTimedOut`'s own comment.
   * Threaded into `common` below so any layer that positions something via
   * the anchor projector (`ScreenAnchor.tsx`) knows not to trust it.
   */
  const [stageTimedOut, setStageTimedOut] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /**
   * The stage's own `<audio>` element, handed up once by `TutorStage` (see
   * `TutorStageProps.onAudioElementReady`) so the conversation layer's
   * caption can read live playback position for word-highlighting.
   *
   * State, not a ref: it is set once (the stage mounts exactly once for the
   * whole route — `StageShell`'s own "ONE MOUNT, NEVER A REMOUNT" rule), so
   * one extra render here is the same one-time cost `stageReady` already
   * pays, never a per-frame one. `SpeechCaption` does its OWN frame-rate
   * polling of `.currentTime` internally; nothing here re-renders while
   * audio plays.
   */
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
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
   * TRUE WHILE THE COMPOSER HOLDS UNSENT TEXT — found live: hands-free
   * listening opens the microphone the instant the tutor's turn ends,
   * with no awareness of whether the learner is typing instead of
   * speaking. Ambient noise crossing the silence detector's threshold
   * mid-sentence submitted a garbled voice transcript in place of what
   * had actually been typed, and the tutor reacted to it as a real
   * answer. `useHandsFreeTurn` below is disabled while this is true —
   * cheaper and safer than letting a clip get captured and then
   * discarding it, which would still cost the recording and, if it ever
   * escaped to the socket first, the STT call.
   */
  const [hasComposerDraft, setHasComposerDraft] = useState(false);

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
    calibrationGeneration.current += 1;
    setCalibration(null);
    setPhase('arriving');

    void (async () => {
      const authToken = await getToken();
      if (cancelled) return;
      if (!authToken) {
        setPhase('unavailable');
        return;
      }
      setToken(authToken);

      const [prefsResult, offersResult, mapResult, calibrationResult] = await Promise.all([
        getPreferences(authToken),
        getOffers(authToken),
        // Best-effort: a failed map read falls back to the v2 openings and
        // never blocks the phase — the offers are the load-bearing read.
        getMap(authToken),
        getAgeCalibration(authToken),
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
      setCalibration(calibrationResult.data);
      setCalibrationError(!!calibrationResult.error);
      setCalibrationSaving(false);
      if (!calibrationResult.data || calibrationResult.data.required) {
        setPhase('introducing');
        return;
      }
      /*
       * THE OPTIMISTIC LOCAL ECHO OF A REFUSAL ALREADY GIVEN — found by
       * adversarial review, tutor-review-sweep-92 (MEDIUM). `startError`
       * (below, `useState`) held the SESSION_LIMIT refusal only in memory, so
       * a refresh or a navigate-away-and-back forgot it completely and
       * repainted the exact same fully-enabled, inviting offer chips as if
       * the cap had never been hit — a child with weak object permanence for
       * "this already happened" could tap right back in and be refused
       * again. This runs in the SAME tick `setOffers` does, before
       * `OfferChips` ever gets a phase to render into, so there is no flash
       * of a cheerful screen to correct later. It is still only an echo: the
       * cap itself stays entirely server-authoritative, and a genuinely new
       * day (`startOfLocalDayIso` disagreeing with what was stored) clears
       * the stale flag rather than trusting it.
       */
      const todayIso = startOfLocalDayIso(offersResult.data.locale);
      if (refusedToday(userIdRef.current, todayIso)) {
        setStartError('SESSION_LIMIT');
        /*
         * Seeds the SAME duration message a live refusal shows (round 95),
         * not just the disabled chips — otherwise a restored refusal would
         * silently fall back to the generic "tomorrow" wording the moment a
         * page reload is what surfaced it, even though the live path right
         * below always has a real server-computed `resetAt`. `todayIso` is
         * already this locale's local midnight; stepping it by exactly 24h
         * in UTC is tomorrow's for all but a DST-transition day, an
         * estimate that only feeds an optimistic ECHO (never enforcement)
         * and is superseded the moment any real `resetAt` arrives.
         */
        setStartErrorResetAt(new Date(new Date(todayIso).getTime() + 24 * 60 * 60 * 1000).toISOString());
      } else {
        clearSessionLimit(userIdRef.current);
      }
      /*
       * A RELOAD MID-CONVERSATION RESUMES IT, before deciding on the home
       * screen. If this tab has a persisted active session, ask the server to
       * re-open it: a live park hands back a fresh single-use socket and the
       * socket replays the entire conversation, so the learner lands back
       * exactly where they were — same turns, same open board. A refused
       * resume (the park expired, or the session already closed) clears the
       * record and falls through to the normal openings; it is never an error
       * the learner sees, just a fresh start. This sits BEFORE the phase
       * decision below so a resumable conversation never flashes the home
       * screen on its way back in.
       */
      const storedSession = readActiveSession(userIdRef.current);
      if (storedSession) {
        const resumed = await resumeSession(authToken, storedSession.sessionId);
        if (cancelled) return;
        if (resumed.data) {
          setSession({
            ...storedSession,
            socketUrl: resumed.data.socketUrl,
            socketExpiresAt: resumed.data.socketExpiresAt,
          });
          setPhase('conversing');
          return;
        }
        clearActiveSession(userIdRef.current);
      }

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
      calibrationGeneration.current += 1;
    };
  }, [getToken, bootstrapAttempt, authSession?.user.id]);

  /**
   * THE LATEST CALL'S OWN ID — not a boolean, because "is a save in flight"
   * cannot tell an OLD in-flight call from a NEW one that superseded it.
   *
   * Found by adversarial review, round 83 (2026-08-31, MEDIUM):
   * `PersonalizeInWorld.tsx` fires `persistPreferences` from five
   * independent axes with no ordering at all — `chooseTutor`,
   * `toggleCompanion`, `goToIsland`, `setLight`, `toggleAdaptation` — each an
   * unguarded `void onSave({...})`, and this function had no request
   * ordering, cancellation, or "is this the latest call" tracking of its
   * own. `savePreferences` is a bare `fetch` (`frontend/src/lib/api.ts`'s
   * `api()` takes no `signal`), and the backend does its own independent
   * read-merge-validate-write-reread per request, so two concurrent calls'
   * responses can resolve OUT OF ORDER on ordinary network/server jitter.
   *
   * Whichever response resolved LAST used to win outright, silently: a late
   * SUCCESS could full-object-overwrite (`setPreferences(result.data)`) a
   * newer, already-confirmed choice with a stale one (tap Zara, then Dina —
   * if Zara's response lands after Dina's, the learner ends up on Zara
   * despite having last tapped and seen Dina selected); a late FAILURE's
   * rollback (`setPreferences(previous)`, a snapshot of the WHOLE object
   * from before THAT call started) could discard a DIFFERENT axis's
   * already-confirmed change that happened to land in between (an island
   * choice a concurrent call already confirmed, wiped out by an unrelated,
   * later-resolving companion-toggle's rollback). `saving` had the same
   * defect in miniature — cleared by whichever call resolved FIRST,
   * regardless of whether others were still outstanding.
   *
   * This class of bug — a stale response overwriting newer state — is
   * already fixed elsewhere in this file for sockets and transcripts
   * (`resumeAttemptedRef`/`sessionRef` above, `wantedReplayRef` below); this
   * is the same fix applied to preference saves.
   */
  const preferencesCallIdRef = useRef(0);

  const persistPreferences = useCallback(
    (patch: Partial<TutorPreferences>): Promise<boolean> => {
      if (!token) return Promise.resolve(false);
      const callId = ++preferencesCallIdRef.current;
      setSaving(true);
      /*
       * Applied OPTIMISTICALLY, which is what makes the picker a picker: the
       * island, the cast and the light are props of the one live canvas, so a
       * choice reaches the scene on this tick rather than after a round trip.
       * `previous` is captured INSIDE the updater — the only place the prior
       * value is actually available — so a rejected save can roll back to
       * exactly what was there before, not to whatever `preferences` happens
       * to be by the time the network call resolves.
       */
      let previous: TutorPreferences | null = null;
      setPreferences((prev) => {
        previous = prev;
        return prev ? { ...prev, ...patch } : prev;
      });
      return savePreferences(token, patch).then((result) => {
        /*
         * A NEWER call has been issued since this one started — this
         * response is STALE. Applying it now, success or rollback, would
         * overwrite whatever the newer call has already applied or is still
         * applying, so it is discarded here: neither `setPreferences` call
         * below runs, and `saving` is left exactly as the newer call wants
         * it (only the LATEST call gets to decide when the picker stops
         * showing "Saving…"). The caller of THIS call still learns the true
         * server-side outcome of its own request.
         */
        if (preferencesCallIdRef.current !== callId) return result.data !== null;

        setSaving(false);
        if (result.data) {
          setPreferences(result.data);
          return true;
        }
        /*
         * ROLLS BACK THE OPTIMISTIC PATCH — it was never actually saved.
         * Found by adversarial review, round 38 (2026-08-30, HIGH): a
         * rejected save (e.g. a nickname the backend correctly refuses as
         * the learner's own real name) used to leave the optimistic,
         * never-persisted value sitting in state forever, with nothing
         * anywhere telling the caller the save had failed at all.
         */
        setPreferences(previous);
        return false;
      });
    },
    [token],
  );

  const begin = useCallback(
    (input: StartSessionInput) => {
      if (!token || !calibration || calibration.required) return;
      setStarting(true);
      setStartError(null);
      setStartErrorResetAt(null);
      void startSession(token, input).then((result) => {
        setStarting(false);
        if (result.error || !result.data) {
          const code = result.error?.code ?? 'INTERNAL';
          setStartError(code);
          setStartErrorResetAt(result.error?.resetAt ?? null);
          /*
           * PERSISTED, not merely held in `startError` — the write side of
           * the fix above. Keyed on the SAME boundary the server enforces
           * (`startOfLocalDayIso`) rather than on this instant, so a mount
           * hours from now on a genuinely NEW day never mistakes itself for
           * the one that was capped.
           */
          if (code === 'SESSION_LIMIT') {
            rememberSessionLimit(userIdRef.current, startOfLocalDayIso(offers?.locale ?? 'es-MX'));
          }
          return;
        }
        /*
         * A session just started — unambiguous proof today is not (or is no
         * longer) capped, whatever a persisted refusal from earlier today
         * might still claim. Cleared unconditionally: a no-op when there was
         * nothing to clear, the same "the real outcome wins" rule the read
         * side above applies.
         */
        clearSessionLimit(userIdRef.current);
        setSession(result.data);
        // Persist it so a reload resumes this exact conversation rather than
        // silently starting over — see ACTIVE_SESSION_KEY_PREFIX.
        rememberActiveSession(userIdRef.current, result.data);
        setPhase('conversing');
        /*
         * A FRESH SESSION STARTS A FRESH TURN-SEQ COUNTER, AND SOME STATE HERE
         * DID NOT KNOW THAT. Found by adversarial review, 2026-08-30 (HIGH +
         * MEDIUM): every new session's orchestrator starts its own `seq` at 0,
         * so a brand-new session's first turn is `seq: 1` — the SAME number
         * as any earlier session's first turn. `interruptedSeq` (below) is
         * compared directly against `turnSeq` and is only ever SET, never
         * reset, so a learner who ever interrupted an earlier session's
         * opening line left the tutor permanently muted on the first turn of
         * every session after it, for as long as the tab stayed open — no
         * error, no warning, just silence. `awaitingReply`/`replyTimedOut`'s
         * own reset effect is keyed on `[turnSeq]`, which has this exact
         * problem in miniature: restarting before either session ever
         * receives a first turn leaves `turnSeq` unchanged (0 → 0), so a
         * stale "reply timed out" timer from the abandoned session could
         * still fire into the new one. All three are reset explicitly here,
         * at the one place a genuinely new session (and its own fresh seq
         * counter) is established — first start, restart, or "Start Another"
         * all funnel through this same success branch.
         */
        setInterruptedSeq(null);
        setAwaitingReply(false);
        setReplyTimedOut(false);
      });
    },
    // `offers` only for its `.locale` (read at the moment of a SESSION_LIMIT
    // refusal, above) — a rare, harmless identity change for callers of this
    // memoized function, not a dependency that could ever loop back into it.
    [token, offers, calibration],
  );

  /*
   * B.26 / OD-1 (S05.3f): THE GUIDED REVIEW THE LEARNER ACCEPTED. After
   * consecutive misses on one skill, the lesson offered a review with this
   * Mentor and the learner said yes; the link carries that skill's key. The
   * weak-skill session starts once, as soon as the offers are in and the day
   * allows a session, exactly as if the learner had picked that chip. A link
   * that is not a skill key does nothing; a refusal (the day's limit) shows
   * the usual state and never retries on its own.
   */
  const guidedReviewSkill = useMemo(() => guidedReviewSkillFrom(window.location.search), []);
  const guidedReviewStarted = useRef(false);
  useEffect(() => {
    if (!guidedReviewSkill || guidedReviewStarted.current || session) return;
    if (phase !== 'introducing' || !offers?.canStart || starting || !token || !calibration || calibration.required) return;
    guidedReviewStarted.current = true;
    begin({ intent: 'weak_skill', skillKey: guidedReviewSkill, wantsVoice: false });
  }, [guidedReviewSkill, phase, offers, starting, token, calibration, session, begin]);

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
    clearActiveSession(userIdRef.current);
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
  /**
   * Mirrors `session` for reading its CURRENT value from inside an async
   * callback whose closure captured an OLDER one — see the resume-failure
   * branch below.
   */
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
      const resumeTargetId = session.sessionId;
      setResuming(true);
      void resumeSession(token, session.sessionId).then((result) => {
        if (result.data) {
          const fresh = result.data;
          /*
           * `resuming` STAYS true here — found by an adversarial review,
           * 2026-08-30 (CRITICAL). Clearing it in this same tick raced this
           * very effect: `setSession` below changes `socketUrl`, which only
           * makes `useTutorSocket` reset its OWN state (`connection`,
           * `history`, `closedReason`) on ITS NEXT effect pass — so the
           * render this `setResuming(false)` would have produced still read
           * the OLD, already-ended socket state. With `resuming` now false,
           * this effect's own `if (!ended || resuming) return` guard no
           * longer held, so it re-evaluated "has this ended?" against stale
           * data, concluded yes, and called `setPhase('closing')` — tearing
           * the brand-new socket down (via the `phase !== 'conversing'`
           * cleanup) before it could ever say `ready`. The resume feature
           * defeated itself on every SUCCESS. The effect below clears
           * `resuming` only once the FRESH socket has actually opened, by
           * which point the reset has genuinely happened.
           */
          setSession((prev) =>
            prev && prev.sessionId === fresh.sessionId
              ? { ...prev, socketUrl: fresh.socketUrl, socketExpiresAt: fresh.socketExpiresAt }
              : prev,
          );
          return;
        }
        // The park expired or the resume was refused — resuming is genuinely
        // over. The conversation that did happen still gets its goodbye —
        // but ONLY if the learner is still on the session this call was
        // for. Found by adversarial review, 2026-08-30 (CRITICAL): unlike
        // the success branch just above (which already guards with this
        // same comparison), this branch closed the phase unconditionally.
        // A learner who restarted or started another session while this
        // stale resume was still in flight had their brand-new, healthy,
        // currently-conversing session torn down the moment the abandoned
        // resume for the OLD session finally came back refused —
        // `sessionRef` is read here specifically because the closure over
        // `session` captured at effect-run time is the OLD one.
        setResuming(false);
        if (sessionRef.current?.sessionId === resumeTargetId) {
          clearActiveSession(userIdRef.current);
          setPhase('closing');
        }
      });
      return;
    }

    // The conversing session has genuinely ended (goodbye, a drop that could
    // not be resumed, or a socket that never opened) — the persisted record
    // must not outlive it and resume a dead session on the next reload. This
    // is a socket-driven end, distinct from the offers-read failure above
    // which reaches 'unavailable' without ever having a session to clear.
    clearActiveSession(userIdRef.current);
    const heldAConversation = socket.history.length > 0;
    setPhase(heldAConversation ? 'closing' : 'unavailable');
  }, [phase, socket.closedReason, socket.connection, socket.history.length, socket.error, resuming, session, token]);

  // Clears `resuming` once the freshly re-dialled socket has actually opened —
  // see the comment on the successful-resume branch above for why this is
  // NOT done inside that `.then()` directly.
  useEffect(() => {
    if (resuming && socket.connection === 'open') setResuming(false);
  }, [resuming, socket.connection]);

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
    /*
     * WAIT BEFORE CRYING WOLF. The `turn` frame carries `audioUrl: null` BY
     * DESIGN — the voice follows in a separate `turn_audio` frame — so checking
     * immediately reports every healthy turn as silent. The first version of
     * this diagnostic did exactly that and sent the owner hunting a delivery
     * bug that was not there.
     */
    const timer = window.setTimeout(() => {
      const because = !stageReady
        ? 'the 3D stage has not reported a first frame (speech gate still closed)'
        : interrupted
          ? 'this turn was interrupted by the learner'
          : turn.audioUrl == null
            ? 'no audio URL arrived for this turn within the grace period'
            : 'unknown — the gate is open and a URL exists, so playback is the suspect';
      console.warn(`[tutor] turn ${turn.seq} is silent: ${because}`);
    }, SILENCE_REPORT_DELAY_MS);
    return () => window.clearTimeout(timer);
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
    enabled: phase === 'conversing' && socket.microphone && !hasComposerDraft,
    speaking,
    awaitingReply,
    /*
     * Found by adversarial review, 2026-08-30 (HIGH): the current turn's text
     * arrives, clearing `awaitingReply`, before its `turn_audio` frame sets
     * `speaking` — a real gap, not one render. Without this, the microphone
     * opened in that gap and silently discarded whatever the learner said.
     * `interrupted` overrides it the same way it already overrides `speaking`
     * above (`liveSpeechUrl`): a learner who explicitly cut the tutor off
     * must not then wait on audio nobody is going to hear.
     */
    audioPending: !interrupted && (turn?.audioPending ?? false),
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
  const handleStageTimedOut = useCallback(() => setStageTimedOut(true), []);

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
  const common = useMemo(
    () => ({ phase, ready: stageReady, timedOut: stageTimedOut }),
    [phase, stageReady, stageTimedOut],
  );

  /*
   * Re-reads what a just-ended session could have moved: the daily offer
   * count, and the learning map's mastery/lock state.
   *
   * Found by adversarial review, 2026-08-30 (HIGH): this refetch existed
   * only inside `onRestart` (the mid-conversation "start over" button) —
   * the ORDINARY end of a session (Finish → the closing screen → "Start
   * Another", or the socket simply closing on its own) never called it at
   * all. `mapOpen` gates the whole map view on `phase === 'introducing'`,
   * so a learner who just finished a session that graded activities —
   * moving a KC's mastery, resolving a due review, unlocking a dependent
   * node — returned to a map still drawn from BEFORE the session: a
   * just-mastered node still shown as merely in-progress, a just-unlocked
   * node still drawn locked with a prerequisite that no longer applies, a
   * stale review count. No error, no warning — confidently wrong state
   * shown to a child relying on the map to know what to do next.
   *
   * Declared here (rather than beside its other two call sites, below) so it
   * exists before `offerLayer` needs it as `onRetryOffers` — see that prop's
   * own comment for the THIRD caller this gained.
   */
  const refreshOffersAndMap = useCallback(() => {
    if (!token) return;
    void getOffers(token).then((result) => {
      if (result.data) setOffers(result.data);
    });
    void getMap(token).then((result) => {
      if (result.data) setMap(result.data);
    });
  }, [token]);

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
            void persistPreferences({});
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
          /*
           * `startError === 'SESSION_LIMIT'` folded in here — the OTHER half
           * of the tutor-review-sweep-92 fix. Before this, a SESSION_LIMIT
           * refusal only ever added a status LINE (`OfferChips`'s own
           * `{startError && ...}` block); the chips themselves stayed fully
           * tappable, live tab or fresh reload alike, so a learner who had
           * just been told no could tap right back in and be told no again.
           * Every OTHER `startError` (a transient network failure, say)
           * deliberately keeps the chips enabled — retrying THOSE is exactly
           * what a learner should be able to do — so this checks the one
           * code that means "the day is over" rather than gating on
           * `startError` being merely truthy.
           */
          starting: starting || !offers.canStart || startError === 'SESSION_LIMIT',
          startError,
          startErrorResetAt,
          onRetryOffers: refreshOffersAndMap,
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
          audioElement,
          awaitingReply,
          onAwaitReply: () => setAwaitingReply(true),
          onDraftChange: setHasComposerDraft,
          onCharacterCue: setSegmentCue,
          resuming,
          replyTimedOut,
          mapAvailable: (map?.nodes.length ?? 0) > 0,
          onOpenMap: () => setMapOpen(true),
          streakDays: learningStats.streakDays,
          xpPoints: learningStats.xpPoints,
          streakJustAdvanced: learningStats.streakJustAdvanced,
          dismissStreakCelebration: learningStats.dismissStreakCelebration,
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
            clearActiveSession(userIdRef.current);
            setSession(null);
            setPhase('introducing');
            refreshOffersAndMap();
          },
          onExit: () => {
            socket.endSession();
            clearActiveSession(userIdRef.current);
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
  /*
   * `session.microphoneBlockedBy` IS FIXED AT SESSION CREATION and never
   * updated afterward — a live guardian revocation mid-session used to fall
   * through to the generic `VOICE_UNAVAILABLE` fallback below instead,
   * because nothing here ever learns a revocation happened. Found by
   * adversarial review, round 30 (2026-08-30, LOW-MEDIUM): the transient
   * `CONSENT_REVOKED` error banner is cleared by the tutor's own very next
   * turn (`useTutorSocket.ts`'s `error` reset on `'turn'`), so for the rest
   * of the session the child saw "Talking out loud isn't available" instead
   * of "A grown-up needs to turn the microphone on for you" — the exact
   * "unfalsifiable absent control" shape /ORACLE.md §14.1 exists to
   * prevent. `socket.micRevoked` is the persistent signal (unlike `error`,
   * it survives past the next turn) and takes priority once observed.
   */
  const blockedBy =
    phase === 'conversing' && session
      ? socket.micRevoked
        ? 'CONSENT_REQUIRED'
        : narrowBlockedReason(session.microphoneBlockedBy)
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

  /*
   * Class III / S17 `roleplay` + `presence` (TUTOR_INSTRUMENTS.md §3.4).
   * `roleplayScene` only ever arrives on a LIVE turn — replay has no
   * director for it (see `scenes.ts`'s own header on why voice, and
   * therefore full replay support, is a later increment) — so this reads
   * `turn` directly rather than the `segmentCue`-first precedence the pose
   * below uses. `isRoleplaySceneId` guards a value this session's own
   * frontend catalog does not (yet) recognise, the same "unknown id renders
   * nothing" posture an out-of-date client already has for every id-keyed
   * field on this page.
   */
  const roleplaySceneId =
    turn?.roleplayScene && isRoleplaySceneId(turn.roleplayScene) ? turn.roleplayScene : null;
  const roleplayLocale = isLocale(i18n.language) ? i18n.language : 'en-US';
  const roleplay = useRoleplayDirector(
    roleplaySceneId,
    turnSeq,
    segmentCue?.character ?? character,
    companion,
    roleplayLocale,
  );
  /**
   * Class III `point_at` (2026-09-04): resolved in an EFFECT, deliberately
   * not inline during render — `resolvePointBearing` reads
   * `getBoundingClientRect()` on the whiteboard's own bars
   * (`tutor-scene/pointTarget.ts`), a forced layout that must run AFTER the
   * whiteboard this same turn drew has actually committed and painted, not
   * during this component's own render pass while that DOM may not exist
   * yet. `null` (the S16 coarse pose) whenever the effective action is not
   * `point`, `pointAt` is absent, or no matching element resolves — see
   * that module's own header on why a miss costs nothing.
   */
  const effectiveAction = segmentCue?.action ?? director?.beat?.action ?? turn?.action ?? 'idle';
  const [pointBearing, setPointBearing] = useState<PointBearing | null>(null);
  useEffect(() => {
    if (effectiveAction !== 'point' || turn?.pointAt == null) {
      setPointBearing(null);
      return;
    }
    const pointAt = turn.pointAt;
    setPointBearing(resolvePointBearing(pointAt));
    // Second pass one frame later, same shape as `TutorFace.tsx`'s own
    // `fit()` re-run: on a cold mount the whiteboard this turn drew can
    // still be pre-layout on this effect's first commit, which
    // `getBoundingClientRect()` reads back as a zero-size board — confirmed
    // live in the lab. A settled board makes the second call redundant.
    const raf = requestAnimationFrame(() => setPointBearing(resolvePointBearing(pointAt)));
    return () => cancelAnimationFrame(raf);
    /*
     * KEYED ON `turnSeq`, NOT `turn?.whiteboard` — found live in the lab
     * (`TutorLabPage.tsx`'s own comment on this exact effect shape has the
     * full account: an unstable mock turn object there turned this into an
     * infinite render loop). `turn` itself is real `useState` here, so
     * `turn.whiteboard` IS reference-stable across unrelated re-renders in
     * production — but keying on `turnSeq`, the SAME "a genuinely new turn
     * arrived" identity `useRoleplayDirector` above already uses, is the
     * more honest signal regardless of which caller renders this, and
     * costs nothing to be consistent about.
     */
  }, [effectiveAction, turnSeq]);
  /**
   * Only while a scene is actually running ("during a transaction") — see
   * `presence`'s own catalog line — and null for a guest/still-restoring
   * session, which has no avatar of its own to show.
   *
   * MEMOIZED as a deliberate safeguard, not merely an optimization: the live
   * headless-Chrome run that caught `AvatarBillboard`'s GPU-pinning bug (its
   * own file header has the full account — a texture property mutated in a
   * render body, fixed there by moving all texture setup into a properly
   * dependency-gated effect) surfaced it in a component fed an UNMEMOIZED
   * URL here first. DiceBear's `toDataUri()` builds and re-encodes a fresh
   * SVG string on every call even for identical options, so leaving this
   * unmemoized would hand `AvatarBillboard` a freshly-allocated string every
   * one of this component's own frequent re-renders (mic state, captions,
   * the socket) — content-equal and therefore harmless to ITS effect
   * dependency check today, but needless rebuilding this call avoids for
   * free, and a cheap guard against the same failure mode if that file's own
   * loading strategy ever changes again. Keyed on the SAME three inputs the
   * condition above already reads, so it only recomputes when one of them
   * genuinely changes.
   */
  const presenceAvatarUri = useMemo(
    () => (roleplay.active && authSession ? avatarDataUri(avatarOptions, authSession.user.id) : null),
    [roleplay.active, authSession, avatarOptions],
  );

  return (
    <StageShell
      mic={{ ...mic, present: mic.present && !(phase === 'introducing' && (!calibration || calibration.required)) }}
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
      /*
       * A LIVE `story` SEGMENT'S SPEAKER STEPS INTO THE LEAD SPOT. `segmentCue`
       * is set only during `conversing` (see its own declaration above), so it
       * can never fire mid-replay or collide with the personalization
       * audition. Swapping `character` here — rather than adding the speaker
       * as a THIRD standee — is deliberate: the persistent island has one lead
       * stand-in, and portraying the segment's speaker there is what makes
       * this the SAME 3D character machinery the Tutor's own turns use,
       * instead of a second, independent one.
       */
      character={segmentCue?.character ?? character}
      companion={companion}
      backdrop={backdrop}
      /*
       * THE POSE COMES FROM WHICHEVER IS PERFORMING. Live, it is the turn the
       * socket just delivered; in a replay it is the emotion and the action the
       * character ORIGINALLY carried, read straight off the stored row. That is
       * the sentence /ORACLE.md §12 has been promising since the schema was
       * written, and it needed no contract change to keep. A live `story`
       * segment's cue outranks both — it is a THIRD performer, momentarily.
       */
      emotion={segmentCue?.emotion ?? director?.beat?.emotion ?? turn?.emotion ?? 'neutral'}
      action={effectiveAction}
      actionKey={segmentCue ? segmentCue.actionKey : phase === 'replaying' ? replayKey : turnSeq}
      pointBearing={pointBearing}
      perCharacter={roleplay.perCharacter}
      presenceAvatarUri={presenceAvatarUri}
      /*
       * Class III / S18 `props`: the stall shows "during a transaction," the
       * catalog's own words — the SAME condition `presence` already reads,
       * so the two ship and disappear together rather than needing a second
       * trigger of their own. See `TutorSceneProps.props`'s own comment for
       * why this is safe to gate so simply: an empty list reproduces the
       * cast solve byte-for-byte, exactly like every other roleplay-only
       * prop. On the new, generalized `props` API rather than the deprecated
       * `showStall` boolean — still just the one stall here, deliberately:
       * dressing beyond it stays an honest, unclaimed scope (see
       * TUTOR_INSTRUMENTS.md), and the Lab is where the mechanism's actual
       * multi-prop capability gets exercised live.
       */
      props={roleplay.active ? (['stall'] as const) : []}
      /*
       * THE ARTICULATION HEURISTIC, not real lip-sync — exactly `speaking` on
       * `CharacterActor3D` elsewhere in the Lesson Engine (`applySpeaking`):
       * a syllabic head/chest cadence, never a mouth shape. A live segment's
       * own lines narrate through Echo's separate, pre-rendered pipeline
       * (`useNarration`), not through this stage's audio-driven viseme —
       * exactly the same non-lip-synced treatment the course player's own
       * `CharacterLayerCanvas` gives every `story` family character
       * (`mouth={false}` there; `viseme` here is untouched and already
       * resolves to closed whenever this stage's own audio is not playing).
       */
      characterSpeaking={segmentCue?.speaking ?? false}
      speechUrl={speechUrl}
      audioKey={audioKey}
      shot={shot}
      onReady={handleReady}
      onTimedOut={handleStageTimedOut}
      onSpeechEnd={handleSpeechEnd}
      onSpeechBlocked={handleSpeechBlocked}
      onAudioElementReady={setAudioElement}
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

      {phase === 'introducing' && (!calibration || calibration.required) && <StageLayer label={t('tutor.stage.introduceLayer')} placement="world">
        <MentorCalibration locale={i18n.resolvedLanguage ?? 'en-US'} dark={isDark}
          copy={(i18n.resolvedLanguage === 'es-MX' ? calibrationEs : i18n.resolvedLanguage === 'pt-BR' ? calibrationPt : calibrationEn).mentorCalibration}
          state={!calibration ? 'error' : calibrationSaving ? 'saving' : 'form'} error={calibrationError}
          onRetry={() => setBootstrapAttempt(n => n + 1)}
          onChoose={tier => {
            const generation = calibrationGeneration.current;
            const userId = userIdRef.current;
            setCalibrationSaving(true); setCalibrationError(false);
            void (async () => {
              const currentToken = await getToken();
              if (generation !== calibrationGeneration.current || userId !== userIdRef.current) return;
              const result = currentToken ? await saveAgeCalibration(currentToken, tier) : null;
              if (generation !== calibrationGeneration.current || userId !== userIdRef.current) return;
              setCalibrationSaving(false);
              if (!result?.data || result.data.required) { setCalibrationError(true); return; }
              setCalibration(result.data);
              setBootstrapAttempt(n => n + 1);
            })();
          }} />
      </StageLayer>}

      {phase === 'introducing' && calibration && !calibration.required && offerLayer && (
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

      {/*
        Class III / S17 `roleplay`: its own small caption, ADDITIVE to
        `conversationLayer` above rather than replacing it — the turn that
        started the scene still says its own brief framing line through the
        ordinary caption, and this shows the scene's own beat underneath it,
        the same "two things on screen for two different reasons" shape the
        lesson plate and the caption already are.
      */}
      {phase === 'conversing' && roleplay.active && roleplay.beat && roleplay.titleKey && (
        <StageLayer label={t('tutor.stage.roleplayLayer')} placement="world">
          <RoleplayCaption
            titleKey={roleplay.titleKey}
            beat={roleplay.beat}
            speakerId={roleplay.beat.speaker === 'lead' ? (segmentCue?.character ?? character) : companion}
          />
        </StageLayer>
      )}
      {phase === 'conversing' && roleplay.active && (
        <RoleplayAudio url={roleplay.audioUrl} onEnded={roleplay.onAudioEnded} />
      )}

      {/*
        THE MAP, OPENED MID-CONVERSATION (Sprint 3, /TUTOR_INSTRUMENTS.md).
        A portal (see `MapOverlay`'s own comment), not a `StageLayer` — it
        does not compose against the camera and must survive exactly where
        `mapOpen`'s own reset effect above already guarantees it cannot leak:
        the `phase !== 'conversing'` check there means this can never render
        outside `conversing` even if `mapOpen` were somehow still true.
      */}
      {phase === 'conversing' && mapOpen && map && (
        <MapOverlay map={map} onClose={() => setMapOpen(false)} />
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
              // The session that just ended may have moved the map and the
              // daily offer count — see `refreshOffersAndMap`'s own comment.
              refreshOffersAndMap();
            }}
            onReplay={openReplay}
            closedReason={socket.closedReason}
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
