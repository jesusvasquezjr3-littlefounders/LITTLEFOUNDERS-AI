import { useEffect, useRef, useState } from 'react';
import { LOCALES, type Locale } from '@/i18n';
import { allFixtures } from '@/lesson-engine/lab/fixtureSets';
import type { SegmentBase } from '@/lesson-engine/core/types';
import type {
  Adaptation,
  SessionSummary,
  SessionTranscript,
  StartedSession,
  TutorCatalog,
  TutorOffers,
  TutorPreferences,
} from '../types';
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
  'replaying',
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

// ── The one thing that is written three times ───────────────────────────────

/**
 * THE LAB SPEAKS THE LEARNER'S LANGUAGE, AND IT USED NOT TO.
 *
 * Every fixture below was pinned to `es-MX` while the browser ran the lab's own
 * UI in whatever `i18next-browser-languagedetector` picked — en-US on this
 * machine. So every screenshot showed English chrome wrapped around Spanish
 * content, and the owner read that, entirely reasonably, as hardcoded strings in
 * the product. IT IS NOT: production drives the whole session off
 * `session.locale`, Oracle's prompt ends with "Language: ${context.locale}.
 * Answer entirely in this language", and `npm run i18n:check` passes. The LAB
 * was the thing that lied, and a QA surface that lies about the one thing the
 * owner is checking is worse than no QA surface.
 *
 * So the simulated product is a function of the locale, and the switcher on the
 * panel moves the UI language and this script together — there is no way to
 * reach a state where they disagree, which is the only property that makes a
 * screenshot of this page evidence about anything.
 *
 * THE THREE SCRIPTS ARE WRITTEN, NOT TRANSLATED. Same lesson, same shape, three
 * learners: a bike costed in pesos, in dollars and in reais, with the arithmetic
 * that follows from each. Running one set of Spanish sentences through a
 * translator would reproduce the exact defect this fixes one layer down — it
 * would look plausible and read as nobody's actual language, and the plate
 * widths it produces would be wrong too (§1.8, and /AGENTS.md's rule that a
 * translation is written per locale).
 *
 * The lab's OWN chrome stays in plain English. See the banner on
 * `TutorLabPage`: those are instrument labels for the person driving the
 * instrument. Everything a LEARNER would see — the caption, the transcript, the
 * activity, the offer chips, the verdict — is either a real locale file or this
 * script.
 */
interface LabScript {
  /**
   * The flagged skill, as the key Core would hold for a learner studying in this
   * language. `OfferChips.readableSkill` turns the slug into the chip's visible
   * topic, so a Spanish slug in an English session puts "Ahorro con meta" on an
   * English chip — which is precisely the mismatch that started this.
   */
  weakSkillKey: string;
  /** The tutor's opening line. */
  greeting: string;
  /** What the learner says they want. */
  learnerGoal: string;
  /** The tutor asking for the number it needs. */
  askPrice: string;
  /** The learner's number. */
  learnerPrice: string;
  /** The tutor gathering up what has been said so far before moving on. */
  recap: string;
  /** The tutor's current line — the question the activity then puts. */
  turn: string;
  /** How the tutor hands the activity over. */
  framing: string;
  /** The activity itself. */
  prompt: string;
  /** The right answer, and the two wrong ones with the reason each is wrong. */
  right: string;
  nearMiss: { text: string; why: string };
  wrongOperation: { text: string; why: string };
  /** What the grader says back. */
  verdict: string;
}

const LAB_SCRIPTS: Readonly<Record<Locale, LabScript>> = {
  'en-US': {
    weakSkillKey: 'financial-education/saving-with-a-goal',
    greeting: 'Hi Robi! What would you like to work on today?',
    learnerGoal: 'i want to save up for a bike',
    askPrice: 'Good one. Do you know roughly what the bike costs? We can split it into weeks.',
    learnerPrice: 'about a hundred and twenty dollars',
    recap:
      'So: a hundred and twenty dollars, and you get some money every week. That is the whole problem — how many weeks it takes.',
    turn: 'Nice. If you put away the same amount every week, how much do you think you would have after a month?',
    framing: "Let's try one together.",
    prompt: 'If you save **$5** every week, how much have you saved after 4 weeks?',
    right: '$20',
    nearMiss: { text: '$15', why: 'That would only be three weeks.' },
    wrongOperation: { text: '$9', why: 'That one adds the 5 and the 4 instead of multiplying them.' },
    verdict: 'Exactly: 5 × 4 = $20.',
  },
  'es-MX': {
    weakSkillKey: 'financial-education/ahorro-con-meta',
    greeting: '¡Hola Robi! ¿En qué quieres trabajar hoy?',
    learnerGoal: 'quiero ahorrar para una bici',
    askPrice: 'Buenísimo. ¿Sabes más o menos cuánto cuesta la bici? Podemos partirla en semanas.',
    learnerPrice: 'como dos mil pesos',
    recap:
      'Va: dos mil pesos, y cada semana te entra algo. Ese es todo el problema — cuántas semanas te toma.',
    turn: 'Muy bien. Si guardas la misma cantidad cada semana, ¿cuánto crees que juntas en un mes?',
    framing: 'Vamos a probar una juntos.',
    prompt: 'Si ahorras **25 pesos** cada semana, ¿cuánto llevas ahorrado en 4 semanas?',
    right: '100 pesos',
    nearMiss: { text: '75 pesos', why: 'Eso serían nada más tres semanas.' },
    wrongOperation: { text: '29 pesos', why: 'Ahí sumaste el 25 y el 4 en vez de multiplicarlos.' },
    verdict: 'Exacto: 25 × 4 = 100 pesos.',
  },
  'pt-BR': {
    weakSkillKey: 'educacao-financeira/poupar-com-meta',
    greeting: 'Oi, Robi! No que você quer trabalhar hoje?',
    learnerGoal: 'quero juntar dinheiro pra uma bicicleta',
    askPrice: 'Que legal. Você sabe mais ou menos quanto custa a bicicleta? Dá pra dividir em semanas.',
    learnerPrice: 'uns quinhentos reais',
    recap:
      'Então: quinhentos reais, e toda semana entra um pouco. O problema é esse — quantas semanas isso leva.',
    turn: 'Boa. Se você guardar a mesma quantia toda semana, quanto acha que junta em um mês?',
    framing: 'Vamos tentar uma juntos.',
    prompt: 'Se você guardar **25 reais** por semana, quanto já juntou em 4 semanas?',
    right: '100 reais',
    nearMiss: { text: '75 reais', why: 'Isso daria só três semanas.' },
    wrongOperation: { text: '29 reais', why: 'Aí você somou o 25 com o 4 em vez de multiplicar.' },
    verdict: 'Isso mesmo: 25 × 4 = 100 reais.',
  },
};

/** The locales the switcher offers, which is every locale the product has. */
export const LAB_LOCALES = LOCALES;

/** The locale a lab session runs in when nothing has been chosen yet. */
export const DEFAULT_LAB_LOCALE: Locale = 'en-US';

/** Narrows whatever i18next reports to a locale this lab can drive. */
export function labLocaleOf(raw: string): Locale {
  const exact = LOCALES.find((id) => id === raw);
  if (exact) return exact;
  const base = raw.slice(0, 2).toLowerCase();
  return LOCALES.find((id) => id.slice(0, 2) === base) ?? DEFAULT_LAB_LOCALE;
}

/**
 * The fullest offer set Core can serve, deliberately.
 *
 * Four chips is the maximum `OfferChips` ever builds (a course topic, one
 * flagged skill, one FAQ, the open question), and the count is what decides how
 * many rows the cluster wraps to over the tutor's chest. A fixture with two
 * would make the lab report a composition the product does not have.
 */
export function labOffers(locale: Locale): TutorOffers {
  return {
    locale,
    intelDegraded: false,
    canStart: true,
    startBlockedBy: null,
    voiceAvailable: true,
    microphoneBlockedBy: null,
    weakSkills: [
      {
        skillKey: LAB_SCRIPTS[locale].weakSkillKey,
        courseId: null,
        topicId: null,
        recommendedAction: 'practice',
        reasonCode: 'low_recent_accuracy',
      },
    ],
    faqIds: ['what_is_saving', 'why_prices_change', 'what_is_a_budget', 'how_does_a_loan_work'],
    canAskOpen: true,
  };
}

/**
 * A started session.
 *
 * The ids are mathematically valid UUIDv4s because §1.14 says a fixture for a
 * strict format is itself in that format, and `socketUrl` points at the
 * RFC 2606 `.invalid` TLD so that a bug which DID dial it fails loudly and
 * locally instead of quietly reaching a real host. Nothing in the lab reads it:
 * `useLabSocket` replaces the hook that would.
 */
export function labSession(locale: Locale): StartedSession {
  return {
    sessionId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    socketUrl: 'wss://tutor-lab.invalid/never-dialled',
    socketExpiresAt: '2026-08-21T12:01:00.000Z',
    character: 'rho',
    companion: 'liruf',
    diorama: 'diorama-a',
    backdrop: 'day',
    locale,
    voiceAvailable: true,
    microphoneAvailable: true,
    microphoneBlockedBy: null,
  };
}

/** The tutor's current line, as the socket would report it. */
export function labTurn(locale: Locale): TutorTurnState {
  return {
    seq: 4,
    text: LAB_SCRIPTS[locale].turn,
    emotion: 'happy',
    action: 'nod',
    audioUrl: null,
    next: 'segment',
  };
}

/*
 * -- THE ACTIVITY SWITCH ----------------------------------------------------
 *
 * WHY THE LAB NEEDS ONE. The scripted activity is a `quiz_mcq` with three
 * two-character options, which is very close to the SHORTEST thing the plate
 * ever holds. The plate's height is the measurement this page exists for, so a
 * lab that can only show the short case answers the easy question: the fold is
 * decided by `arrange`'s two banks, `money`'s till, `maker`'s builder and
 * `analyze`'s tables, and none of those could be put on the plate here at all.
 * The switch draws its segments from the engine's own fixtures - the same ones
 * `/dev/lesson-lab` renders - so there is nothing new to keep in sync.
 *
 * THE FIXTURES FOLLOW THE LOCALE SWITCH NOW (2026-08-22). They used to be
 * pinned to es-MX, and this comment used to explain that away as a property of
 * the lesson engine: a lesson DOCUMENT is single-locale (LESSON_ENGINE.md §3),
 * so a Spanish exercise inside an English session was not a product bug. True,
 * and beside the point — a page whose whole job is to rule out a language
 * defect may not itself show two languages at once. `lesson-engine/lab/
 * fixtureCopy.ts` now writes every fixture in all three, so EVERY activity on
 * this switch is safe to photograph the language from, not just `script`.
 */
const fixtureByType = (locale: Locale): Readonly<Record<string, SegmentBase>> =>
  Object.fromEntries(allFixtures(locale).map((fixture) => [fixture.type, fixture]));

/** `script` (the scripted turn), `none`, then every engine fixture. */
export const LAB_ACTIVITIES: readonly string[] = [
  'script',
  'none',
  // The TYPE LIST is locale-independent by construction (registry.test.tsx
  // proves it), so building it from one locale is not a choice with a
  // consequence — it is the same list in all three.
  ...Object.keys(fixtureByType(DEFAULT_LAB_LOCALE)).sort(),
];

export const DEFAULT_LAB_ACTIVITY = 'script';

/** The activity the plate should hold, for whatever the switch is on. */
export function labActivity(locale: Locale, activity: string): LiveSegmentState | null {
  if (activity === 'none') return null;
  if (activity === 'script') return labSegment(locale);
  const fixture = fixtureByType(locale)[activity];
  if (!fixture) return labSegment(locale);
  // `LiveSegmentState.segment` is the wire shape Oracle sends; `SegmentBase` is
  // the engine's own. They describe the same object from two sides of the
  // socket and the renderers already cast between them (`LiveSegmentPanel`),
  // so a fixture standing in for a served segment goes through `unknown` here
  // rather than pretending the two declarations are one.
  return { ...labSegment(locale), segment: fixture as unknown as LiveSegmentState['segment'] };
}

/** One live activity, on the plate. */
export function labSegment(locale: Locale): LiveSegmentState {
  const script = LAB_SCRIPTS[locale];
  return {
    segmentId: 'b1d5f8a2-6c14-4f0e-9a3b-0d2e5c7f4a18',
    seq: 4,
    origin: 'live',
    scoresXp: true,
    framing: script.framing,
    segment: {
      id: 'b1d5f8a2-6c14-4f0e-9a3b-0d2e5c7f4a18',
      type: 'quiz_mcq',
      prompt_md: script.prompt,
      difficulty: 2,
      xp: 20,
      payload: {
        options: [
          { id: 'a', text_md: script.right },
          { id: 'b', text_md: script.nearMiss.text, rationale_md: script.nearMiss.why },
          { id: 'c', text_md: script.wrongOperation.text, rationale_md: script.wrongOperation.why },
        ],
      },
    },
  };
}

/**
 * A conversation already under way.
 *
 * Long enough to wrap: a one-line transcript makes every plate look shorter
 * than it is, and the plate's height is the measurement this lab exists for.
 * It carries the four beats a real session has — the tutor opening, the learner
 * answering in their own unpunctuated words, the tutor gathering up what has
 * been said, and the question the activity then puts — so that a reviewer is
 * looking at a session rather than at five sentences of filler.
 */
export function labHistory(locale: Locale): TutorSocket['history'] {
  const script = LAB_SCRIPTS[locale];
  return [
    { speaker: 'tutor', text: script.greeting, seq: 1 },
    { speaker: 'learner', text: script.learnerGoal, seq: -1 },
    { speaker: 'tutor', text: script.askPrice, seq: 2 },
    { speaker: 'learner', text: script.learnerPrice, seq: -1 },
    { speaker: 'tutor', text: script.recap, seq: 3 },
    { speaker: 'tutor', text: script.turn, seq: 4 },
  ];
}

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
/**
 * The saved conversation the `replaying` scene performs.
 *
 * IT IS THE SAME SCRIPT THE LIVE SCENES USE, in the past tense — the same six
 * turns and the same activity, now carrying the two columns a replay actually
 * reads: `emotion` and `action`. That is deliberate rather than convenient. The
 * one thing a reviewer has to be able to see on this page is that a replay and
 * a session look like the same conversation, and a different fixture would make
 * that comparison meaningless.
 *
 * EVERY `audio_path` IS NULL, and that is the harder case on purpose. There is
 * no synthesized clip anywhere in this repo and there must not be one — a
 * committed voice fixture is a voice nobody consented to. So the lab drives the
 * arrangement that has to work when retention has swept the bucket: the beats
 * are TIMED rather than listened to, the captions carry the whole conversation,
 * and the plate says once that this recording was saved without sound. A replay
 * whose only reviewed state was the one WITH audio would ship the silent one
 * untested, and the silent one is what every conversation becomes after ninety
 * days (/ORACLE.md §12).
 *
 * The `created_at` values ascend, because the running order is `seq` and THEN
 * the wall clock (`replay/replayScript.ts`) — Oracle writes a learner turn and
 * the tutor's reply against the same `seq`, so a fixture that left the
 * timestamps equal would exercise a comparator branch the product never takes
 * and hide the one it does.
 */
const LAB_REPLAY_ID = '2f8b1c34-5d67-4e89-a0b1-c2d3e4f5a6b7';

export function labSessionSummary(locale: Locale): SessionSummary {
  return {
    id: LAB_REPLAY_ID,
    locale,
    character: 'rho',
    companion: 'liruf',
    diorama: 'diorama-a',
    intent: 'weak_skill',
    startedAt: '2026-08-14T16:20:00.000Z',
    endedAt: '2026-08-14T16:38:00.000Z',
    closeReason: 'completed',
    turnCount: 6,
    segmentCount: 1,
    xpAwarded: 20,
  };
}

export function labTranscript(locale: Locale): SessionTranscript {
  const script = LAB_SCRIPTS[locale];
  const at = (minute: number) => `2026-08-14T16:${String(20 + minute).padStart(2, '0')}:00.000Z`;

  return {
    session: labSessionSummary(locale),
    turns: [
      {
        id: 'a1000000-0000-4000-8000-000000000001',
        seq: 1,
        speaker: 'tutor',
        text: script.greeting,
        emotion: 'happy',
        action: 'wave',
        audio_path: null,
        source: 'scripted',
        created_at: at(0),
      },
      {
        id: 'a1000000-0000-4000-8000-000000000002',
        seq: 1,
        speaker: 'learner',
        text: script.learnerGoal,
        emotion: null,
        action: null,
        audio_path: null,
        source: 'stt',
        created_at: at(1),
      },
      {
        id: 'a1000000-0000-4000-8000-000000000003',
        seq: 2,
        speaker: 'tutor',
        text: script.askPrice,
        emotion: 'encouraging',
        action: 'nod',
        audio_path: null,
        source: 'model',
        created_at: at(2),
      },
      {
        id: 'a1000000-0000-4000-8000-000000000004',
        seq: 3,
        speaker: 'learner',
        text: script.learnerPrice,
        emotion: null,
        action: null,
        audio_path: null,
        source: 'stt',
        created_at: at(3),
      },
      {
        id: 'a1000000-0000-4000-8000-000000000005',
        seq: 3,
        speaker: 'tutor',
        text: script.recap,
        emotion: 'thinking',
        action: 'think',
        audio_path: null,
        source: 'model',
        created_at: at(4),
      },
      {
        id: 'a1000000-0000-4000-8000-000000000006',
        seq: 4,
        speaker: 'tutor',
        text: script.turn,
        emotion: 'excited',
        action: 'point',
        audio_path: null,
        source: 'model',
        created_at: at(5),
      },
    ],
    segments: [
      {
        segmentId: 'b1d5f8a2-6c14-4f0e-9a3b-0d2e5c7f4a18',
        // The same number as the turn that handed it over, exactly as Oracle
        // writes it — which is the case the running order has to get right.
        seq: 4,
        origin: 'live',
        segment: {
          id: 'b1d5f8a2-6c14-4f0e-9a3b-0d2e5c7f4a18',
          type: 'quiz_mcq',
          prompt_md: script.prompt,
          difficulty: 2,
          xp: 20,
        },
        score: 100,
        xpAwarded: 20,
      },
    ],
  };
}

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
export function useLabSocket(
  scene: LabScene,
  locale: Locale,
  activity: string = DEFAULT_LAB_ACTIVITY,
): TutorSocket {
  const conversing = scene === 'conversing' || scene === 'adapting';

  const [history, setHistory] = useState<TutorSocket['history']>(() => labHistory(locale));
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
   *
   * THE LOCALE IS PART OF THE IDENTITY, for the same reason and with a sharper
   * consequence: switching language mid-scene must not leave the previous
   * language's transcript sitting under the new language's caption. In
   * production that is a new session; here it is the same trigger.
   */
  const identity = [scene, locale, activity].join('|');
  const [shown, setShown] = useState(identity);
  if (shown !== identity) {
    setShown(identity);
    setHistory(labHistory(locale));
    setSegment(scene === 'conversing' ? labActivity(locale, activity) : null);
    setAdaptationOffer(scene === 'adapting' ? LAB_ADAPTATION : null);
    setClosedReason(null);
  }

  return {
    connection: conversing ? 'open' : 'connecting',
    turn: conversing ? labTurn(locale) : null,
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
function answerTutorPath(path: string, method: string, granted: boolean, locale: Locale): Response {
  if (path.includes('/tutor/consent/')) {
    return envelope({ active: granted, grantedAt: granted ? '2026-08-01T10:00:00Z' : null, locale });
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
        feedback_md: LAB_SCRIPTS[locale].verdict,
        allowRetry: false,
      },
      xpAwarded: 0,
      scoresXp: false,
      dailyXpCap: 200,
    });
  }

  if (path.includes('/tutor/sessions/') && method === 'GET') {
    /*
     * The transcript, for the replay, and it used to be unreachable. The list
     * below answered `{ sessions: [] }` "on purpose", so the archive on this
     * page could only ever render its own empty state and the replay itself was
     * reviewable nowhere at all — which is exactly the arrangement that let a
     * list of rows ship as a "replay" and be found by the owner rather than
     * here.
     */
    return envelope(labTranscript(locale));
  }

  if (path.endsWith('/tutor/sessions') && method === 'GET') {
    return envelope({ sessions: [labSessionSummary(locale)] });
  }

  if (path.endsWith('/tutor/preferences')) {
    return envelope({ ...LAB_PREFERENCES, catalog: LAB_CATALOG });
  }

  if (path.endsWith('/tutor/offers')) {
    return envelope(labOffers(locale));
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
export function useStubbedCoreApi(consentGranted: boolean, locale: Locale): void {
  /*
   * REFS, and installed ONCE. Keying the effect on the value reinstalled the
   * shim, and React runs child effects before parent ones — so a remounting
   * consent control fetched against the real API in the gap and rendered an
   * error. The locale rides the same mechanism for the same reason: switching
   * language must not tear the shim down and let one fetch through.
   */
  const granted = useRef(consentGranted);
  granted.current = consentGranted;
  const language = useRef(locale);
  language.current = locale;

  useEffect(() => {
    const real = window.fetch;

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      // Everything that is not a Tutor data call — the island's `.glb`, the
      // sound bed, Vite's own HMR — goes to the real network untouched.
      if (!url.includes('/api/v1/tutor')) return real(input, init);

      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      return answerTutorPath(url, method, granted.current, language.current);
    }) as typeof window.fetch;

    return () => {
      window.fetch = real;
    };
  }, []);
}
