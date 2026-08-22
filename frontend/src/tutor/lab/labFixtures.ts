import { useEffect, useRef, useState } from 'react';
import type { Adaptation, StartedSession, TutorCatalog, TutorOffers, TutorPreferences } from '../types';
import type { LiveSegmentState, TutorSocket, TutorTurnState } from '../useTutorSocket';
import type { StagePhase } from '../stage/phases';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  EVERY FAKE THING IN `/dev/tutor-lab` IS IN THIS FILE, AND NOTHING ELSE IS.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The lab mounts the REAL `StageShell`, the REAL `TutorScene`, the REAL
 * `OfferChips`, `PersonalizeInWorld` and `ConversationView`. A lab that renders
 * a copy of a screen is a lab that lies: it agrees with itself forever while the
 * product drifts away underneath it, and the one bug it would have caught — the
 * HUD sitting on top of the character at 375 px — is a bug about how the real
 * components compose, which a copy cannot have.
 *
 * So the seam is drawn at the NETWORK, and only at the network. Two edges cross
 * it, and both are stubbed here:
 *
 *   1. THE SOCKET. `useTutorSocket` dials Oracle with a Core-minted, single-use,
 *      sixty-second token (/AGENTS.md §1.5, the Oracle exception). Nothing in a
 *      lab can mint one. `useLabSocket` returns the same `TutorSocket` SHAPE
 *      filled with fixtures, and reproduces exactly the state transitions the
 *      real hook performs LOCALLY — the learner's own line echoed into the
 *      transcript, the activity clearing when it is graded, the offer clearing
 *      when it is answered. It invents no tutor turns: a fabricated model reply
 *      on a QA surface is how somebody comes to review copy that no model ever
 *      produced.
 *
 *   2. CORE. `SessionHistory`, `LiveSegmentPanel` and `VoiceConsentControl` all
 *      fetch. `useStubbedCoreApi` installs a scoped `window.fetch` shim while
 *      this dev-only page is mounted, answers `/api/v1/tutor/*` from fixtures,
 *      restores the real `fetch` on unmount, and passes everything else —
 *      notably the `.glb` island and the sound bed — straight through. An
 *      unrecognised tutor path is answered with a NOT_FOUND envelope and a
 *      named console warning, so a new network edge shows up as a message
 *      rather than as a mystery request to a backend nobody is running.
 *
 * Anything the lab needs that is NOT a network edge uses the real thing:
 * `useMicrophone` is a browser API, so the lab calls it exactly the way
 * `TutorExperience` does.
 */

// ── The scene switcher's vocabulary ─────────────────────────────────────────

/**
 * What a human can drive the lab to, which is ONE MORE THING than a phase.
 *
 * `adapting` is not a `StagePhase` and must not become one: in the product it
 * is `conversing` with a pending adaptation offer, and the shot mapping already
 * treats it as such (`shotForPhase` swings to the two-shot on
 * `adaptationOffered`). It is a separate entry HERE because it is a separate
 * thing to LOOK at — the tallest the microphone dock ever gets, stacked over a
 * sheet, which is the arrangement that runs out of room first at 375 px.
 */
export const LAB_SCENES = [
  'arriving',
  'personalizing',
  'introducing',
  'conversing',
  'adapting',
  'closing',
  'unavailable',
] as const;

export type LabScene = (typeof LAB_SCENES)[number];

/** The phase the shell is actually in, for a scene the lab is showing. */
export function phaseForScene(scene: LabScene): StagePhase {
  return scene === 'adapting' ? 'conversing' : scene;
}

// ── Fixtures ────────────────────────────────────────────────────────────────

/**
 * A returning learner who has already made the place theirs.
 *
 * `rho` articulates (/TUTOR_3D.md §3.1), so the introduction and the
 * conversation are framed in the TIGHT close-up — the framing under which the
 * offer chips were found sitting across the character's face. Switching the
 * fixture to `liruf` widens the shot and hides that, which is exactly why the
 * default is the strict case.
 */
export const LAB_PREFERENCES: TutorPreferences = {
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  backdrop: 'day',
  nickname: 'Robi',
  adaptations: ['more_examples'],
};

export const LAB_CATALOG: TutorCatalog = {
  characters: ['dina', 'liruf', 'rho', 'zara'],
  dioramas: ['diorama-a', 'diorama-b'],
  backdrops: ['auto', 'dawn', 'day', 'dusk', 'night'],
  adaptations: ['slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing'],
  articulates: ['rho', 'zara'],
};

/**
 * The fullest offer set Core can serve, deliberately.
 *
 * Four chips is the maximum `OfferChips` ever builds (a course topic, one
 * flagged skill, one FAQ, the open question), and the count is what decides how
 * many rows the cluster wraps to over the tutor's chest. A fixture with two
 * would make the lab report a composition the product does not have.
 */
export const LAB_OFFERS: TutorOffers = {
  locale: 'es-MX',
  intelDegraded: false,
  canStart: true,
  startBlockedBy: null,
  voiceAvailable: true,
  microphoneBlockedBy: null,
  weakSkills: [
    {
      skillKey: 'financial-education/ahorro-con-meta',
      courseId: null,
      topicId: null,
      recommendedAction: 'practice',
      reasonCode: 'low_recent_accuracy',
    },
  ],
  faqIds: ['what_is_saving', 'why_prices_change', 'what_is_a_budget', 'how_does_a_loan_work'],
  canAskOpen: true,
};

/**
 * A started session.
 *
 * The ids are mathematically valid UUIDv4s because §1.14 says a fixture for a
 * strict format is itself in that format, and `socketUrl` points at the
 * RFC 2606 `.invalid` TLD so that a bug which DID dial it fails loudly and
 * locally instead of quietly reaching a real host. Nothing in the lab reads it:
 * `useLabSocket` replaces the hook that would.
 */
export const LAB_SESSION: StartedSession = {
  sessionId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  socketUrl: 'wss://tutor-lab.invalid/never-dialled',
  socketExpiresAt: '2026-08-21T12:01:00.000Z',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  backdrop: 'day',
  locale: 'es-MX',
  voiceAvailable: true,
  microphoneAvailable: true,
  microphoneBlockedBy: null,
};

/** The tutor's current line, as the socket would report it. */
export const LAB_TURN: TutorTurnState = {
  seq: 3,
  text: 'Muy bien. Si guardas la misma cantidad cada semana, ¿cuánto crees que juntas en un mes?',
  emotion: 'happy',
  action: 'nod',
  audioUrl: null,
  next: 'segment',
};

/** One live activity, on the plate. */
export const LAB_SEGMENT: LiveSegmentState = {
  segmentId: 'b1d5f8a2-6c14-4f0e-9a3b-0d2e5c7f4a18',
  seq: 3,
  origin: 'live',
  scoresXp: true,
  framing: 'Vamos a probar esto juntos.',
  segment: {
    id: 'b1d5f8a2-6c14-4f0e-9a3b-0d2e5c7f4a18',
    type: 'quiz_mcq',
    prompt_md: 'Si ahorras **25 pesos** cada semana, ¿cuánto juntas en 4 semanas?',
    difficulty: 2,
    xp: 20,
    payload: {
      options: [
        { id: 'a', text_md: '100 pesos' },
        { id: 'b', text_md: '75 pesos', rationale_md: 'Eso serían solo tres semanas.' },
        { id: 'c', text_md: '29 pesos', rationale_md: 'Ahí sumaste en vez de multiplicar.' },
      ],
    },
  },
};

/**
 * A conversation already under way.
 *
 * Long enough to wrap: a one-line transcript makes every plate look shorter
 * than it is, and the plate's height is the measurement this lab exists for.
 */
export const LAB_HISTORY: TutorSocket['history'] = [
  { speaker: 'tutor', text: '¡Hola Robi! ¿En qué quieres trabajar hoy?', seq: 1 },
  { speaker: 'learner', text: 'quiero ahorrar para una bici', seq: -1 },
  {
    speaker: 'tutor',
    text: 'Buenísimo. ¿Sabes más o menos cuánto cuesta la bici que quieres? Podemos partirla en semanas.',
    seq: 2,
  },
  { speaker: 'learner', text: 'como dos mil pesos', seq: -1 },
  { speaker: 'tutor', text: LAB_TURN.text, seq: 3 },
];

/**
 * The access token every surface here is handed.
 *
 * NOT A CREDENTIAL, and it never reaches a network: the shim below answers
 * every `/api/v1/tutor/*` call before `fetch` leaves the page. It is a
 * non-empty string rather than `''` because several of these components treat
 * a falsy token as "no session yet" and render NOTHING — `VoiceConsentControl`
 * returns null while its own state is loading, and with `''` that load never
 * starts. An empty string reads like the safer fixture and is actually the one
 * that silently blanks the screen under review.
 */
export const LAB_TOKEN = 'lab';

/** The adaptation the tutor offers on the `adapting` scene. */
const LAB_ADAPTATION: Adaptation = 'more_examples';

/** How much of the session budget is left, so the sky rune has something to say. */
const LAB_REMAINING_MS = 12 * 60_000;

// ── Stub 1: the socket ──────────────────────────────────────────────────────

/**
 * The live session, without a live session.
 *
 * Returns the same `TutorSocket` the real hook does. Every method here mirrors
 * a transition the REAL hook performs locally, and nothing else:
 *
 *   - `sendText` echoes the learner's own words into the transcript, because
 *     `useTutorSocket` does exactly that before the wire has confirmed anything.
 *   - `reportGrade` clears the activity, because the real hook clears it the
 *     moment a result is reported.
 *   - `answerAdaptation` clears the offer, for the same reason.
 *   - `endSession` sets a close reason, which is what a learner pressing
 *     "finish" eventually sees come back.
 *   - `sendAudio` does NOTHING and resolves. There is no wire.
 *
 * It never fabricates a `turn`. A tutor line nobody's model produced, reviewed
 * on a QA surface, is worse than no line at all.
 */
export function useLabSocket(scene: LabScene): TutorSocket {
  const conversing = scene === 'conversing' || scene === 'adapting';

  const [history, setHistory] = useState<TutorSocket['history']>(LAB_HISTORY);
  const [segment, setSegment] = useState<LiveSegmentState | null>(null);
  const [adaptationOffer, setAdaptationOffer] = useState<Adaptation | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);

  /*
   * Reset DURING RENDER, not in an effect, and the difference is visible.
   *
   * The real hook clears every field belonging to the previous session when the
   * session identity changes. An effect would do that one commit late, so the
   * first frame after switching to `adapting` would render the previous scene's
   * state — an offer that is not there yet, or an activity that should already
   * be gone. On a surface whose whole purpose is to be looked at and measured,
   * one wrong frame is one wrong screenshot.
   */
  const [shown, setShown] = useState<LabScene>(scene);
  if (shown !== scene) {
    setShown(scene);
    setHistory(LAB_HISTORY);
    setSegment(scene === 'conversing' ? LAB_SEGMENT : null);
    setAdaptationOffer(scene === 'adapting' ? LAB_ADAPTATION : null);
    setClosedReason(null);
  }

  return {
    connection: conversing ? 'open' : 'connecting',
    turn: conversing ? LAB_TURN : null,
    history,
    segment,
    budget: 'running',
    remainingMs: LAB_REMAINING_MS,
    // True so the orb is LIVE during a conversation, which is the state the
    // product has whenever a voice provider is configured, and the only state
    // in which the hero control's full silhouette is on screen.
    microphone: true,
    intelDegraded: false,
    adaptationOffer,
    closedReason,
    error: null,
    sendText: (text: string) => {
      const trimmed = text.trim();
      if (trimmed === '') return;
      setHistory((prev) => [...prev, { speaker: 'learner', text: trimmed, seq: -1 }]);
    },
    sendAudio: async () => {},
    reportGrade: () => setSegment(null),
    answerAdaptation: () => setAdaptationOffer(null),
    endSession: () => setClosedReason('learner_ended'),
  };
}

// ── Stub 2: Core ────────────────────────────────────────────────────────────

/** `{ data, error }` — the envelope every Core route uses (/AGENTS.md §1.6). */
function envelope(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, error: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function refusal(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ data: null, error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Everything the lab answers on Core's behalf.
 *
 * Split out of the hook so the routing table reads as a table. `granted` is the
 * only thing a human drives from the page, and it belongs to the guardian
 * consent surface rather than to the stage.
 */
function answerTutorPath(path: string, method: string, granted: boolean): Response {
  if (path.includes('/tutor/consent/')) {
    return envelope({ active: granted, grantedAt: granted ? '2026-08-01T10:00:00Z' : null, locale: 'es-MX' });
  }

  if (path.includes('/grade') && method === 'POST') {
    /*
     * ALWAYS THE SAME VERDICT, and it pays nothing.
     *
     * Grading is server-authoritative (/ORACLE.md §8) — the answer key is not
     * in the browser and must never be. This exists so that pressing "Check"
     * produces the verdict SURFACE to look at, and it says `scoresXp: false`
     * so that nobody reads a lab screenshot as evidence that grading works.
     */
    return envelope({
      verdict: {
        correct: true,
        score: 100,
        tier: 'great',
        feedback_md: 'Exacto: 25 × 4 = 100 pesos.',
        allowRetry: false,
      },
      xpAwarded: 0,
      scoresXp: false,
      dailyXpCap: 200,
    });
  }

  if (path.endsWith('/tutor/sessions') && method === 'GET') {
    // Empty on purpose: the replay list's real job on this route is to show
    // its own empty state, and a fixture session would need a fixture
    // transcript with fixture audio to be worth opening.
    return envelope({ sessions: [] });
  }

  if (path.endsWith('/tutor/preferences')) {
    return envelope({ ...LAB_PREFERENCES, catalog: LAB_CATALOG });
  }

  if (path.endsWith('/tutor/offers')) {
    return envelope(LAB_OFFERS);
  }

  console.warn(`[tutor-lab] no fixture for ${method} ${path} — add one to labFixtures.ts`);
  return refusal('NOT_FOUND', 'No lab fixture for this path.', 404);
}

/**
 * A scoped `fetch` shim, installed only while this dev-only page is mounted.
 *
 * WHY A SHIM AND NOT A PROP. The alternative is a test-only door on
 * `SessionHistory`, `LiveSegmentPanel` and `VoiceConsentControl`, and a
 * production component should not carry a door that exists for a harness — a
 * door that exists is a door that ships.
 */
export function useStubbedCoreApi(consentGranted: boolean): void {
  /*
   * A REF, and installed ONCE. Keying the effect on the value reinstalled the
   * shim, and React runs child effects before parent ones — so a remounting
   * consent control fetched against the real API in the gap and rendered an
   * error.
   */
  const granted = useRef(consentGranted);
  granted.current = consentGranted;

  useEffect(() => {
    const real = window.fetch;

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      // Everything that is not a Tutor data call — the island's `.glb`, the
      // sound bed, Vite's own HMR — goes to the real network untouched.
      if (!url.includes('/api/v1/tutor')) return real(input, init);

      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      return answerTutorPath(url, method, granted.current);
    }) as typeof window.fetch;

    return () => {
      window.fetch = real;
    };
  }, []);
}
