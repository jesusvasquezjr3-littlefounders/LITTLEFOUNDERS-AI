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
import type { TutorMapNode, TutorMapResponse } from '../tutorApi';
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

/**
 * The parental approval gate's fixtures (/ORACLE.md §20, migration 0068).
 *
 * Written at REAL length, in the voice the review model actually produces —
 * several sentences of plain prose about a child. A one-line fixture would
 * make the panel look tidy and hide the only layout question worth asking
 * here: whether a paragraph and the paragraph it replaces both stay readable
 * side by side on a 375 px phone.
 */
const LAB_MEMORY_NOTES: Readonly<
  Record<Locale, { current: string; fresh: string; stale: string; older: string }>
> = {
  'en-US': {
    current:
      'Robi is curious about money and counts confidently in fives and tens. They lose the thread past two steps and do best when a problem is restated in full. Praise after a correct answer visibly lifts their confidence.',
    fresh:
      'Robi is saving for a bike and brings it up unprompted, which makes goal-shaped problems land far better than abstract ones. They count confidently in fives and tens and still lose the thread past two steps. Restating the whole problem before asking is what keeps them with you.',
    stale:
      'Robi enjoys number games and is starting to ask what things cost.',
    older: 'Robi is curious about money and likes counting coins out loud.',
  },
  'es-MX': {
    current:
      'Robi tiene curiosidad por el dinero y cuenta con seguridad de cinco en cinco y de diez en diez. Pierde el hilo después de dos pasos y le va mejor cuando se le repite el problema completo. El elogio después de una respuesta correcta le sube visiblemente la confianza.',
    fresh:
      'Robi está ahorrando para una bici y lo menciona por su cuenta, así que los problemas con una meta le funcionan mucho mejor que los abstractos. Cuenta con seguridad de cinco en cinco y de diez en diez, y todavía pierde el hilo después de dos pasos. Repetirle el problema completo antes de preguntar es lo que lo mantiene contigo.',
    stale: 'A Robi le gustan los juegos con números y empieza a preguntar cuánto cuestan las cosas.',
    older: 'Robi tiene curiosidad por el dinero y le gusta contar monedas en voz alta.',
  },
  'pt-BR': {
    current:
      'Robi tem curiosidade sobre dinheiro e conta com segurança de cinco em cinco e de dez em dez. Perde o fio depois de dois passos e vai melhor quando o problema é repetido por inteiro. O elogio depois de uma resposta certa levanta visivelmente a confiança dele.',
    fresh:
      'Robi está juntando dinheiro para uma bicicleta e fala disso por conta própria, então problemas com uma meta funcionam muito melhor do que os abstratos. Conta com segurança de cinco em cinco e de dez em dez, e ainda perde o fio depois de dois passos. Repetir o problema inteiro antes de perguntar é o que o mantém junto com você.',
    stale: 'Robi gosta de jogos com números e começa a perguntar quanto as coisas custam.',
    older: 'Robi tem curiosidade sobre dinheiro e gosta de contar moedas em voz alta.',
  },
};

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
    // Null on purpose: the continuity chip REPLACES the FAQ chip when it
    // exists, so the fullest four-chip set the comment above describes is the
    // one without a digest. The chip itself is exercised by offerChips tests.
    lastSession: null,
    intelDegraded: false,
    canStart: true,
    startBlockedBy: null,
    sessionCapResetAt: null,
    voiceAvailable: true,
    microphoneBlockedBy: null,
    weakSkills: [
      {
        skillKey: LAB_SCRIPTS[locale].weakSkillKey,
        title: null,
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
 * The learning map (Tutor v3), small but showing all five node states and a
 * cross-strand edge — what the introducing phase renders when the KC graph
 * exists. Localized by hand: the real titles come from Vault's own catalog.
 */
export function labMap(locale: Locale): TutorMapResponse {
  const titles: Record<Locale, Record<string, string>> = {
    'en-US': {
      count: 'Count mixed money',
      change: 'Give change by counting up',
      compare: 'Compare amounts',
      needs: 'Needs and wants',
      price: 'What a price is',
      profit: 'What is left: profit',
    },
    'es-MX': {
      count: 'Contar dinero mezclado',
      change: 'Dar cambio contando hacia arriba',
      compare: 'Comparar cantidades',
      needs: 'Necesidades y deseos',
      price: 'Qué es un precio',
      profit: 'Lo que queda: la ganancia',
    },
    'pt-BR': {
      count: 'Contar dinheiro misturado',
      change: 'Dar troco contando para cima',
      compare: 'Comparar quantias',
      needs: 'Necessidades e desejos',
      price: 'O que é um preço',
      profit: 'O que sobra: o lucro',
    },
  };
  const tt = titles[locale];
  const node = (
    kcKey: string,
    title: string,
    state: TutorMapNode['state'],
    strand: TutorMapNode['strand'],
    attempts = 0,
  ): TutorMapNode => ({
    kcId: `f47ac10b-58cc-4372-a567-0e02b2c3d${(kcKey.length + 470).toString().padStart(3, '0')}`,
    kcKey,
    strand,
    title,
    state,
    mastery: attempts > 0 ? 0.72 : null,
    attempts,
    skillKey: null,
  });
  return {
    nodes: [
      node('money.count-mixed-coins', tt.count!, 'in_progress', 'money_math', 3),
      node('money.compare-amounts', tt.compare!, 'needs_review', 'money_math', 5),
      node('money.make-change-counting-up', tt.change!, 'locked', 'money_math'),
      node('biz.needs-vs-wants', tt.needs!, 'mastered', 'entrepreneurship', 6),
      node('biz.what-is-price', tt.price!, 'available', 'entrepreneurship'),
      node('biz.profit', tt.profit!, 'locked', 'entrepreneurship'),
    ],
    edges: [
      { from: 'money.count-mixed-coins', to: 'money.make-change-counting-up' },
      { from: 'money.count-mixed-coins', to: 'money.compare-amounts' },
      { from: 'biz.needs-vs-wants', to: 'biz.what-is-price' },
      { from: 'biz.what-is-price', to: 'biz.profit' },
      { from: 'money.count-mixed-coins', to: 'biz.profit' },
    ],
    continueTarget: { kcKey: 'money.compare-amounts', title: tt.compare!, reason: 'review_due', skillKey: null },
    review: { count: 1 },
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
/** A live-growth story, for the `whiteboard` lab activity (V4). */
const LAB_WHITEBOARD_TEXT: Readonly<Record<Locale, { say: string; label: string }>> = {
  'en-US': {
    say: 'Imagine you save $10, and every week you add $2 more.',
    label: 'You add $2 every week',
  },
  'es-MX': {
    say: 'Imagina que guardas 10 pesos, y cada semana agregas 2 más.',
    label: 'Agregas 2 pesos cada semana',
  },
  'pt-BR': {
    say: 'Imagine que você guarda 10 reais, e a cada semana adiciona mais 2.',
    label: 'Você adiciona 2 reais por semana',
  },
};

/** A category-comparison story, for the `whiteboard-categories` lab activity (V4 backlog slice). */
const LAB_CATEGORIES_TEXT: Readonly<Record<Locale, { say: string; label: string; categories: [string, string, string] }>> = {
  'en-US': {
    say: 'Imagine you got $100. You spend $40 on something you need, $35 on something you want, and save the rest.',
    label: 'How you split your $100',
    categories: ['Need', 'Want', 'Saved'],
  },
  'es-MX': {
    say: 'Imagina que te dieron 100 pesos. Gastas 40 en algo que necesitas, 35 en algo que quieres, y guardas el resto.',
    label: 'Cómo repartiste tus 100 pesos',
    categories: ['Necesito', 'Quiero', 'Ahorré'],
  },
  'pt-BR': {
    say: 'Imagine que você ganhou 100 reais. Gasta 40 em algo que precisa, 35 em algo que quer, e guarda o resto.',
    label: 'Como você dividiu seus 100 reais',
    categories: ['Preciso', 'Quero', 'Guardei'],
  },
};

/**
 * `activity === 'compare'` (V4 backlog: "same schema family, straightforward
 * once sequence is proven live") — the lab's own fixture for the SECOND
 * whiteboard kind, same reason `LAB_WHITEBOARD_TEXT` exists for the first:
 * `verify-tutor-ui.mjs` needs a real board on screen to audit, without a
 * live model turn.
 */
const LAB_COMPARE_TEXT: Readonly<Record<Locale, { say: string; label: string; left: string; right: string }>> = {
  'en-US': {
    say: 'A shirt at Store A costs $45, and the same shirt at Store B costs $28.',
    label: 'Which shirt is cheaper?',
    left: 'Store A',
    right: 'Store B',
  },
  'es-MX': {
    say: 'Una playera en la Tienda A cuesta 45 pesos, y en la Tienda B cuesta 28 pesos.',
    label: '¿Cuál playera es más barata?',
    left: 'Tienda A',
    right: 'Tienda B',
  },
  'pt-BR': {
    say: 'Uma camiseta na Loja A custa 45 reais, e na Loja B custa 28 reais.',
    label: 'Qual camiseta é mais barata?',
    left: 'Loja A',
    right: 'Loja B',
  },
};

/** `activity === 'marked-line'` (V4 backlog) — the lab's own fixture for the THIRD whiteboard kind. */
const LAB_MARKED_LINE_TEXT: Readonly<Record<Locale, { say: string; label: string; have: string; goal: string }>> = {
  'en-US': {
    say: 'You have $22 saved, and headphones cost $35.',
    label: 'How much more do you need for the headphones?',
    have: 'What you have',
    goal: 'The headphones',
  },
  'es-MX': {
    say: 'Tienes 22 pesos ahorrados, y unos audífonos cuestan 35 pesos.',
    label: '¿Cuánto te falta para los audífonos?',
    have: 'Lo que tienes',
    goal: 'Los audífonos',
  },
  'pt-BR': {
    say: 'Você tem 22 reais guardados, e um fone de ouvido custa 35 reais.',
    label: 'Quanto falta para o fone de ouvido?',
    have: 'O que você tem',
    goal: 'O fone de ouvido',
  },
};

/**
 * `activity === 'tokens'` — the first NON-CHART instrument
 * (/TUTOR_INSTRUMENTS.md, Sprint 6). Denominations here are real ones for each
 * currency, because `computeTokens` verifies them against the real
 * denominations of the board's currency and a fixture that used a coin nobody
 * mints would be testing a board the server refuses to serve.
 */
const LAB_TOKENS_TEXT: Readonly<Record<Locale, { say: string; label: string }>> = {
  'en-US': {
    say: 'Look at the table: three ten-dollar bills and four one-dollar coins. How much is there?',
    label: 'Count what is on the table',
  },
  'es-MX': {
    say: 'Mira la mesa: tres billetes de diez pesos y cuatro monedas de un peso. ¿Cuánto hay?',
    label: 'Cuenta lo que hay en la mesa',
  },
  'pt-BR': {
    say: 'Olha a mesa: três notas de dez reais e quatro moedas de um real. Quanto tem?',
    label: 'Conte o que está na mesa',
  },
};

/*
 * WAVE 1 INSTRUMENTS (/TUTOR_INSTRUMENTS.md Sprints 7-8). Written per locale,
 * never translated — the same rule the scripts above obey, and for the same
 * reason: a plate width measured against machine-translated Spanish is measured
 * against nobody's actual language.
 *
 * Every SERVER-COMPUTED field below is hand-set because the lab has no server.
 * They are the values `computeBarModel` / `computeFlow` / `computeGoalBar` /
 * `computeWorked` would produce for these inputs, which is what makes a
 * screenshot of this page evidence about the real thing.
 */
const LAB_WAVE1_TEXT: Readonly<
  Record<
    Locale,
    {
      barModel: { say: string; label: string; whole: string; parts: [string, string] };
      partWhole: { say: string; label: string; whole: string; left: string; right: string };
      flow: { say: string; label: string; income: string; spent: string; kept: string };
      goalBar: { say: string; label: string; goal: string; saved: string };
      worked: { say: string; label: string };
    }
  >
> = {
  'en-US': {
    barModel: {
      say: 'You had 60 pesos and spent some on a snack. This bar shows the whole, and the piece we do not know yet.',
      label: 'What is the missing piece?',
      whole: 'What you had',
      parts: ['The snack', 'What is left'],
    },
    partWhole: {
      say: 'Eighteen is nine and nine — and that works backwards too.',
      label: 'How the parts make the whole',
      whole: 'Altogether',
      left: 'Saturday',
      right: 'Sunday',
    },
    flow: {
      say: 'You sold lemonade and paid for the lemons. Look at the three places before we name them.',
      label: 'In, out, and what is left',
      income: 'What came in',
      spent: 'What it cost',
      kept: 'What is left',
    },
    goalBar: {
      say: 'The whole bar is the skateboard. The shaded part is what you have already.',
      label: 'How far along are you?',
      goal: 'The skateboard',
      saved: 'Saved so far',
    },
    worked: { say: 'Let me work it out, and then check it by undoing the last step.', label: 'Working it out' },
  },
  'es-MX': {
    barModel: {
      say: 'Tenías 60 pesos y gastaste algo en un antojito. La barra muestra el total, y el pedazo que todavía no sabemos.',
      label: '¿Cuál es el pedazo que falta?',
      whole: 'Lo que tenías',
      parts: ['El antojito', 'Lo que queda'],
    },
    partWhole: {
      say: 'Dieciocho es nueve y nueve — y también funciona al revés.',
      label: 'Cómo las partes hacen el total',
      whole: 'En total',
      left: 'Sábado',
      right: 'Domingo',
    },
    flow: {
      say: 'Vendiste agua de limón y pagaste los limones. Mira los tres lugares antes de ponerles nombre.',
      label: 'Entra, sale, y lo que queda',
      income: 'Lo que entró',
      spent: 'Lo que costó',
      kept: 'Lo que queda',
    },
    goalBar: {
      say: 'La barra entera es la patineta. La parte sombreada es lo que ya llevas.',
      label: '¿Qué tanto llevas?',
      goal: 'La patineta',
      saved: 'Lo ahorrado',
    },
    worked: { say: 'Déjame sacar la cuenta, y luego la compruebo deshaciendo el último paso.', label: 'Sacando la cuenta' },
  },
  'pt-BR': {
    barModel: {
      say: 'Você tinha 60 reais e gastou um pouco num lanche. A barra mostra o total, e o pedaço que ainda não sabemos.',
      label: 'Qual é o pedaço que falta?',
      whole: 'O que você tinha',
      parts: ['O lanche', 'O que sobra'],
    },
    partWhole: {
      say: 'Dezoito é nove e nove — e funciona ao contrário também.',
      label: 'Como as partes formam o total',
      whole: 'No total',
      left: 'Sábado',
      right: 'Domingo',
    },
    flow: {
      say: 'Você vendeu limonada e pagou os limões. Olha os três lugares antes de dar nome a eles.',
      label: 'Entra, sai, e o que sobra',
      income: 'O que entrou',
      spent: 'O que custou',
      kept: 'O que sobra',
    },
    goalBar: {
      say: 'A barra inteira é o skate. A parte sombreada é o que você já tem.',
      label: 'Quanto você já tem?',
      goal: 'O skate',
      saved: 'Já guardado',
    },
    worked: { say: 'Deixa eu fazer a conta, e depois conferir desfazendo o último passo.', label: 'Fazendo a conta' },
  },
};

/*
 * THE CANONICAL PRIMARY-MATHS VOCABULARY (/TUTOR_INSTRUMENTS.md §3.1 source 3).
 * Written per locale, never translated — same rule as everything above.
 */
const LAB_CANON_TEXT: Readonly<
  Record<
    Locale,
    {
      tenFrame: { say: string; label: string };
      numberLine: { say: string; label: string };
      array: { say: string; label: string };
      fractionStrip: { say: string; label: string };
      partition: { say: string; label: string; splits: [string, string] };
    }
  >
> = {
  'en-US': {
    tenFrame: { say: 'Look at the frame. How many more would fill it?', label: 'Seven in the frame' },
    numberLine: { say: 'The candy costs 7 and you paid with 10. Let us count up.', label: 'Counting up to the change' },
    array: { say: 'Four rows of three stickers. How many stickers?', label: 'Four rows of three' },
    fractionStrip: { say: 'Same bar, cut two ways. Which piece is bigger?', label: 'One half and one quarter' },
    partition: {
      say: 'Sixty pesos shared between two, and then between four.',
      label: 'The same money, shared two ways',
      splits: ['Between two', 'Between four'],
    },
  },
  'es-MX': {
    tenFrame: { say: 'Mira el marco. ¿Cuántas más lo llenarían?', label: 'Siete en el marco' },
    numberLine: { say: 'El dulce cuesta 7 y pagaste con 10. Vamos contando hacia arriba.', label: 'Contando el cambio' },
    array: { say: 'Cuatro filas de tres calcomanías. ¿Cuántas calcomanías hay?', label: 'Cuatro filas de tres' },
    fractionStrip: { say: 'La misma barra, cortada de dos maneras. ¿Cuál pedazo es más grande?', label: 'Un medio y un cuarto' },
    partition: {
      say: 'Sesenta pesos repartidos entre dos, y luego entre cuatro.',
      label: 'El mismo dinero, repartido de dos maneras',
      splits: ['Entre dos', 'Entre cuatro'],
    },
  },
  'pt-BR': {
    tenFrame: { say: 'Olha o quadro. Quantas mais encheriam ele?', label: 'Sete no quadro' },
    numberLine: { say: 'O doce custa 7 e você pagou com 10. Vamos contando para cima.', label: 'Contando o troco' },
    array: { say: 'Quatro fileiras de três adesivos. Quantos adesivos?', label: 'Quatro fileiras de três' },
    fractionStrip: { say: 'A mesma barra, cortada de dois jeitos. Qual pedaço é maior?', label: 'Um meio e um quarto' },
    partition: {
      say: 'Sessenta reais divididos entre dois, e depois entre quatro.',
      label: 'O mesmo dinheiro, dividido de dois jeitos',
      splits: ['Entre dois', 'Entre quatro'],
    },
  },
};

/* Decision and comparison (/TUTOR_INSTRUMENTS.md §3.2 families D and F). */
const LAB_DECIDE_TEXT: Readonly<
  Record<
    Locale,
    {
      table: { say: string; label: string; options: [string, string] };
      scale: { say: string; label: string; left: string; right: string };
      twoBins: { say: string; label: string; bins: [string, string]; items: [string, string, string, string] };
      venn: { say: string; label: string; left: string; right: string; items: [string, string, string] };
      ranking: { say: string; label: string; items: [string, string, string] };
      outcomes: { say: string; label: string; good: [string, string]; bad: [string, string] };
      trade: { say: string; label: string; who: [string, string]; gives: [string, string]; gets: [string, string] };
      chance: { say: string; label: string; outcomes: [string, string] };
    }
  >
> = {
  'en-US': {
    table: { say: 'Two bags of the same sweets. Which one really costs less?', label: 'Which bag is the better deal?', options: ['Small bag', 'Big bag'] },
    scale: { say: 'What it cost you to make, against what you charged.', label: 'Is that fair?', left: 'What it cost', right: 'What you charged' },
    twoBins: { say: 'Let us put each one where it belongs.', label: 'Need or want?', bins: ['Need', 'Want'], items: ['Shoes', 'A game', 'Lunch', 'Stickers'] },
    venn: { say: 'Some things are both — you need them AND you want them.', label: 'What lands in both?', left: 'Need', right: 'Want', items: ['Medicine', 'A new phone', 'Warm coat'] },
    ranking: { say: 'Let us put them in order, cheapest first.', label: 'Cheapest first', items: ['Notebook', 'Backpack', 'Pencil'] },
    outcomes: {
      say: 'If it sells, and if it does not. Both are worth looking at.',
      label: 'How it could end',
      good: ['It sells out', 'You get your money back and a little more, and you buy more lemons.'],
      bad: ['Nobody buys', 'The lemons are already paid for, so you are short until next time.'],
    },
    trade: { say: 'Look at what each of them gave and got.', label: 'Did both of them win?', who: ['You', 'Ana'], gives: ['Your stickers', 'Her marbles'], gets: ['Her marbles', 'Your stickers'] },
    chance: { say: 'Most days it sells. Some days it rains.', label: 'How often does it work?', outcomes: ['It sells', 'It rains'] },
  },
  'es-MX': {
    table: { say: 'Dos bolsas de los mismos dulces. ¿Cuál cuesta menos de verdad?', label: '¿Cuál bolsa conviene?', options: ['Bolsa chica', 'Bolsa grande'] },
    scale: { say: 'Lo que te costó hacerlo, contra lo que cobraste.', label: '¿Está parejo?', left: 'Lo que costó', right: 'Lo que cobraste' },
    twoBins: { say: 'Vamos poniendo cada cosa donde va.', label: '¿Necesito o quiero?', bins: ['Necesito', 'Quiero'], items: ['Zapatos', 'Un juego', 'La comida', 'Calcomanías'] },
    venn: { say: 'Hay cosas que son las dos — las necesitas Y las quieres.', label: '¿Qué cae en las dos?', left: 'Necesito', right: 'Quiero', items: ['Medicina', 'Un celular nuevo', 'Chamarra'] },
    ranking: { say: 'Vamos a ordenarlos, del más barato al más caro.', label: 'Del más barato', items: ['Cuaderno', 'Mochila', 'Lápiz'] },
    outcomes: {
      say: 'Si se vende, y si no. Vale la pena ver las dos.',
      label: 'Cómo podría terminar',
      good: ['Se vende todo', 'Recuperas tu dinero y algo más, y compras más limones.'],
      bad: ['Nadie compra', 'Los limones ya los pagaste, así que te quedas corto hasta la próxima.'],
    },
    trade: { say: 'Mira lo que dio y lo que recibió cada quien.', label: '¿Ganaron los dos?', who: ['Tú', 'Ana'], gives: ['Tus calcomanías', 'Sus canicas'], gets: ['Sus canicas', 'Tus calcomanías'] },
    chance: { say: 'Casi siempre se vende. A veces llueve.', label: '¿Qué tan seguido funciona?', outcomes: ['Se vende', 'Llueve'] },
  },
  'pt-BR': {
    table: { say: 'Dois pacotes das mesmas balas. Qual custa menos de verdade?', label: 'Qual pacote vale mais a pena?', options: ['Pacote pequeno', 'Pacote grande'] },
    scale: { say: 'O que custou fazer, contra o que você cobrou.', label: 'Está justo?', left: 'O que custou', right: 'O que você cobrou' },
    twoBins: { say: 'Vamos colocar cada coisa no lugar dela.', label: 'Preciso ou quero?', bins: ['Preciso', 'Quero'], items: ['Sapatos', 'Um jogo', 'O almoço', 'Adesivos'] },
    venn: { say: 'Tem coisas que são as duas — você precisa E quer.', label: 'O que cai nas duas?', left: 'Preciso', right: 'Quero', items: ['Remédio', 'Celular novo', 'Casaco'] },
    ranking: { say: 'Vamos colocar em ordem, do mais barato.', label: 'Do mais barato', items: ['Caderno', 'Mochila', 'Lápis'] },
    outcomes: {
      say: 'Se vender, e se não vender. Vale olhar as duas.',
      label: 'Como pode terminar',
      good: ['Vende tudo', 'Você recupera seu dinheiro e um pouco mais, e compra mais limões.'],
      bad: ['Ninguém compra', 'Os limões já foram pagos, então você fica no aperto até a próxima.'],
    },
    trade: { say: 'Olha o que cada um deu e recebeu.', label: 'Os dois ganharam?', who: ['Você', 'Ana'], gives: ['Seus adesivos', 'As bolinhas dela'], gets: ['As bolinhas dela', 'Seus adesivos'] },
    chance: { say: 'Quase sempre vende. Às vezes chove.', label: 'Funciona com que frequência?', outcomes: ['Vende', 'Chove'] },
  },
};

/* Operations and real-money artefacts (/TUTOR_INSTRUMENTS.md §3.2 C and F). */
const LAB_MONEY_TEXT: Readonly<
  Record<
    Locale,
    {
      deal: { say: string; label: string; bins: [string, string, string] };
      change: { say: string; label: string };
      regroup: { say: string; label: string };
      equation: { say: string; label: string; left: [string, string]; right: [string] };
      receipt: { say: string; label: string; lines: [string, string, string] };
      ledger: { say: string; label: string; entries: [string, string, string] };
      priceTag: { say: string; label: string; item: string };
      inventory: { say: string; label: string; item: string };
      budget: { say: string; label: string; items: [string, string, string] };
    }
  >
> = {
  'en-US': {
    deal: { say: 'Fourteen marbles between three friends. How many each?', label: 'Sharing them out', bins: ['Ana', 'Beto', 'Caro'] },
    change: { say: 'It costs 7 and you paid with 20.', label: 'What comes back?' },
    regroup: { say: 'One ten, traded for coins you can actually count out.', label: 'Breaking a ten' },
    equation: { say: 'Both sides have to be the same length.', label: 'Keeping it balanced', left: ['Saved', 'Still to save'], right: ['The goal'] },
    receipt: { say: 'Three things in the basket. What does the till say?', label: 'The receipt', lines: ['Bread', 'Milk', 'Apples'] },
    ledger: { say: 'Money in, money out, and where you stand after each one.', label: 'The little account book', entries: ['Sold lemonade', 'Bought cups', 'Sold more'] },
    priceTag: { say: 'Read the tag. What does one really cost?', label: 'Reading the tag', item: 'Pack of 6 pencils' },
    inventory: { say: 'You started with twelve and sold five.', label: 'What is left on the shelf', item: 'Cookies' },
    budget: { say: 'You have 100 for the whole week. Watch the line.', label: 'The week\'s budget', items: ['Lunch', 'Bus', 'A game'] },
  },
  'es-MX': {
    deal: { say: 'Catorce canicas entre tres amigos. ¿Cuántas a cada quien?', label: 'Repartiéndolas', bins: ['Ana', 'Beto', 'Caro'] },
    change: { say: 'Cuesta 7 y pagaste con 20.', label: '¿Qué regresa?' },
    regroup: { say: 'Un billete de diez, cambiado por monedas que sí puedes contar.', label: 'Cambiando el de diez' },
    equation: { say: 'Los dos lados tienen que medir lo mismo.', label: 'Manteniéndolo parejo', left: ['Ahorrado', 'Lo que falta'], right: ['La meta'] },
    receipt: { say: 'Tres cosas en la canasta. ¿Qué dice la caja?', label: 'El ticket', lines: ['Pan', 'Leche', 'Manzanas'] },
    ledger: { say: 'Lo que entra, lo que sale, y cómo vas después de cada uno.', label: 'La libretita de cuentas', entries: ['Vendí agua', 'Compré vasos', 'Vendí más'] },
    priceTag: { say: 'Lee la etiqueta. ¿Cuánto cuesta uno de verdad?', label: 'Leyendo la etiqueta', item: 'Paquete de 6 lápices' },
    inventory: { say: 'Empezaste con doce y vendiste cinco.', label: 'Lo que queda en el estante', item: 'Galletas' },
    budget: { say: 'Tienes 100 para toda la semana. Mira la raya.', label: 'El presupuesto de la semana', items: ['Comida', 'Camión', 'Un juego'] },
  },
  'pt-BR': {
    deal: { say: 'Quatorze bolinhas entre três amigos. Quantas para cada um?', label: 'Dividindo entre eles', bins: ['Ana', 'Beto', 'Caro'] },
    change: { say: 'Custa 7 e você pagou com 20.', label: 'O que volta?' },
    regroup: { say: 'Uma nota de dez, trocada por moedas que dá para contar.', label: 'Trocando a de dez' },
    equation: { say: 'Os dois lados têm que ter o mesmo tamanho.', label: 'Mantendo equilibrado', left: ['Guardado', 'O que falta'], right: ['A meta'] },
    receipt: { say: 'Três coisas na cesta. O que diz o caixa?', label: 'O cupom', lines: ['Pão', 'Leite', 'Maçãs'] },
    ledger: { say: 'O que entra, o que sai, e como você fica depois de cada um.', label: 'O caderninho de contas', entries: ['Vendi limonada', 'Comprei copos', 'Vendi mais'] },
    priceTag: { say: 'Lê a etiqueta. Quanto custa um de verdade?', label: 'Lendo a etiqueta', item: 'Pacote de 6 lápis' },
    inventory: { say: 'Você começou com doze e vendeu cinco.', label: 'O que sobra na prateleira', item: 'Biscoitos' },
    budget: { say: 'Você tem 100 para a semana toda. Olha a linha.', label: 'O orçamento da semana', items: ['Almoço', 'Ônibus', 'Um jogo'] },
  },
};

const LAB_CURRENCY: Readonly<Record<Locale, 'USD' | 'MXN' | 'BRL'>> = {
  'en-US': 'USD',
  'es-MX': 'MXN',
  'pt-BR': 'BRL',
};

/**
 * `activity === 'whiteboard'` (V4) swaps the scripted "here is an exercise"
 * turn for one that draws a live sequence board instead — the surface added
 * to close the owner's reported defect: a growth story narrated in pure text
 * beside an unrelated activity. `verify-tutor-ui.mjs` opens this scenario to
 * audit the board for overlaps the same way it already does for a segment.
 * `'compare'`/`'marked-line'`/`'categories'` are the same idea for the three
 * ADDITIONAL whiteboard kinds — `categories` is the first bounded slice of
 * "UI generativa acotada" (blueprint §10.4, ORACLE.md §20.5), a comparison
 * across 2-6 named things at one moment rather than one quantity over time.
 */
export function labTurn(locale: Locale, activity: string = DEFAULT_LAB_ACTIVITY): TutorTurnState {
  if (activity === 'whiteboard') {
    const text = LAB_WHITEBOARD_TEXT[locale];
    return {
      seq: 4,
      text: text.say,
      emotion: 'happy',
      action: 'nod',
      audioUrl: null,
      audioPending: false,
      wordTimings: null,
      next: 'ask',
      policy: null,
      demonstrate: null,
      whiteboard: {
        kind: 'sequence',
        start: 10,
        steps: [
          { op: 'add', value: 2 },
          { op: 'add', value: 2 },
        ],
        // The fixture's own text says "cada semana" — this MUST agree, or
        // the lab reproduces the exact defect it exists to catch.
        unit: 'week',
        values: [10, 12, 14],
        label: text.label,
        currency: locale === 'en-US' ? 'USD' : locale === 'pt-BR' ? 'BRL' : 'MXN',
      },
    };
  }
  if (activity === 'compare') {
    const text = LAB_COMPARE_TEXT[locale];
    return {
      seq: 4,
      text: text.say,
      emotion: 'happy',
      action: 'nod',
      audioUrl: null,
      audioPending: false,
      wordTimings: null,
      next: 'ask',
      policy: null,
      demonstrate: null,
      whiteboard: {
        kind: 'compare',
        left: { label: text.left, value: 45 },
        right: { label: text.right, value: 28 },
        // Server-computed on the real wire (`whiteboard.ts`'s
        // `computeComparison`) — hand-set here since the lab has no server.
        difference: 17,
        greater: 'left',
        label: text.label,
        currency: LAB_CURRENCY[locale],
      },
    };
  }
  if (activity === 'marked-line') {
    const text = LAB_MARKED_LINE_TEXT[locale];
    return {
      seq: 4,
      text: text.say,
      emotion: 'happy',
      action: 'nod',
      audioUrl: null,
      audioPending: false,
      wordTimings: null,
      next: 'ask',
      policy: null,
      demonstrate: null,
      whiteboard: {
        kind: 'marked_line',
        min: 0,
        max: 40,
        marks: [
          // Server-computed `position` on the real wire
          // (`whiteboard.ts`'s `computeMarkedLine`) — hand-set here.
          { value: 22, label: text.have, position: 0.55 },
          { value: 35, label: text.goal, position: 0.875 },
        ],
        label: text.label,
        currency: LAB_CURRENCY[locale],
      },
    };
  }
  if (activity === 'tokens') {
    const text = LAB_TOKENS_TEXT[locale];
    return {
      seq: 4,
      text: text.say,
      emotion: 'happy',
      action: 'nod',
      audioUrl: null,
      audioPending: false,
      wordTimings: null,
      next: 'ask',
      policy: null,
      demonstrate: null,
      whiteboard: {
        kind: 'tokens',
        groups: [
          { denomination: 10, count: 3 },
          { denomination: 1, count: 4 },
        ],
        // Server-computed on the real wire (`whiteboard.ts`'s `computeTokens`)
        // — hand-set here since the lab has no server.
        subtotals: [30, 4],
        total: 34,
        label: text.label,
        currency: LAB_CURRENCY[locale],
      },
    };
  }
  if (activity === 'bar-model' || activity === 'part-whole' || activity === 'flow' || activity === 'goal-bar' || activity === 'worked') {
    const text = LAB_WAVE1_TEXT[locale];
    const currency = LAB_CURRENCY[locale];
    const base = {
      seq: 4,
      emotion: 'happy' as const,
      action: 'nod' as const,
      audioUrl: null,
      audioPending: false,
      wordTimings: null,
      next: 'ask' as const,
      policy: null,
      demonstrate: null,
    };
    if (activity === 'bar-model') {
      return {
        ...base,
        text: text.barModel.say,
        whiteboard: {
          kind: 'bar_model',
          whole: { label: text.barModel.whole, value: 60 },
          parts: [
            { label: text.barModel.parts[0], value: 25 },
            { label: text.barModel.parts[1], value: null },
          ],
          widths: [25 / 60, 35 / 60],
          unknownIndex: 1,
          label: text.barModel.label,
          currency,
        },
      };
    }
    if (activity === 'part-whole') {
      return {
        ...base,
        text: text.partWhole.say,
        whiteboard: {
          kind: 'part_whole',
          whole: { label: text.partWhole.whole, value: 18 },
          left: { label: text.partWhole.left, value: 9 },
          right: { label: text.partWhole.right, value: 9 },
          label: text.partWhole.label,
          currency,
        },
      };
    }
    if (activity === 'flow') {
      return {
        ...base,
        text: text.flow.say,
        whiteboard: {
          kind: 'flow',
          income: { label: text.flow.income, value: 48 },
          spent: { label: text.flow.spent, value: 19 },
          keptLabel: text.flow.kept,
          kept: 29,
          label: text.flow.label,
          currency,
        },
      };
    }
    if (activity === 'goal-bar') {
      return {
        ...base,
        text: text.goalBar.say,
        whiteboard: {
          kind: 'goal_bar',
          goal: { label: text.goalBar.goal, value: 90 },
          saved: { label: text.goalBar.saved, value: 34 },
          remaining: 56,
          savedFraction: 34 / 90,
          label: text.goalBar.label,
          currency,
        },
      };
    }
    return {
      ...base,
      text: text.worked.say,
      whiteboard: {
        kind: 'worked',
        start: 72,
        steps: [
          { op: 'subtract', value: 15 },
          { op: 'add', value: 8 },
        ],
        values: [72, 57, 65],
        checkValue: 57,
        label: text.worked.label,
        currency,
      },
    };
  }
  if (
    activity === 'ten-frame' ||
    activity === 'number-jumps' ||
    activity === 'array' ||
    activity === 'fraction-strip' ||
    activity === 'partition'
  ) {
    const text = LAB_CANON_TEXT[locale];
    const currency = LAB_CURRENCY[locale];
    const base = {
      seq: 4,
      emotion: 'happy' as const,
      action: 'nod' as const,
      audioUrl: null,
      audioPending: false,
      wordTimings: null,
      next: 'ask' as const,
      policy: null,
      demonstrate: null,
    };
    if (activity === 'ten-frame') {
      return {
        ...base,
        text: text.tenFrame.say,
        whiteboard: { kind: 'ten_frame', count: 7, frames: [7], label: text.tenFrame.label },
      };
    }
    if (activity === 'number-jumps') {
      return {
        ...base,
        text: text.numberLine.say,
        whiteboard: {
          kind: 'open_number_line',
          from: 7,
          to: 10,
          jumps: [{ value: 1 }, { value: 2 }],
          stops: [7, 8, 10],
          positions: [0, 1 / 3, 1],
          label: text.numberLine.label,
          currency,
        },
      };
    }
    if (activity === 'array') {
      return {
        ...base,
        text: text.array.say,
        whiteboard: {
          kind: 'array',
          rows: 4,
          columns: 3,
          unitValue: 1,
          total: 12,
          cells: 12,
          label: text.array.label,
          currency: null,
        },
      };
    }
    if (activity === 'fraction-strip') {
      return {
        ...base,
        text: text.fractionStrip.say,
        whiteboard: {
          kind: 'fraction_strip',
          rows: [
            { denominator: 2, highlighted: 1 },
            { denominator: 4, highlighted: 1 },
          ],
          shares: [0.5, 0.25],
          label: text.fractionStrip.label,
        },
      };
    }
    return {
      ...base,
      text: text.partition.say,
      whiteboard: {
        kind: 'partition',
        whole: 60,
        splits: [
          { label: text.partition.splits[0], denominator: 2 },
          { label: text.partition.splits[1], denominator: 4 },
        ],
        pieceValues: [30, 15],
        label: text.partition.label,
        currency,
      },
    };
  }
  if (
    activity === 'table' ||
    activity === 'scale' ||
    activity === 'two-bins' ||
    activity === 'venn' ||
    activity === 'ranking' ||
    activity === 'outcomes' ||
    activity === 'trade' ||
    activity === 'chance'
  ) {
    const text = LAB_DECIDE_TEXT[locale];
    const currency = LAB_CURRENCY[locale];
    const base = {
      seq: 4,
      emotion: 'happy' as const,
      action: 'nod' as const,
      audioUrl: null,
      audioPending: false,
      wordTimings: null,
      next: 'ask' as const,
      policy: null,
      demonstrate: null,
    };
    if (activity === 'table') {
      return {
        ...base,
        text: text.table.say,
        whiteboard: {
          kind: 'table',
          options: [
            { label: text.table.options[0], price: 12, units: 4 },
            { label: text.table.options[1], price: 20, units: 10 },
          ],
          unitPrices: [3, 2],
          bestIndex: 1,
          label: text.table.label,
          currency,
        },
      };
    }
    if (activity === 'scale') {
      return {
        ...base,
        text: text.scale.say,
        whiteboard: {
          kind: 'scale',
          left: { label: text.scale.left, value: 18 },
          right: { label: text.scale.right, value: 25 },
          tilt: 'right',
          difference: 7,
          label: text.scale.label,
          currency,
        },
      };
    }
    if (activity === 'two-bins') {
      return {
        ...base,
        text: text.twoBins.say,
        whiteboard: {
          kind: 'two_bins',
          binLabels: text.twoBins.bins,
          items: [
            { label: text.twoBins.items[0], bin: 0 },
            { label: text.twoBins.items[1], bin: 1 },
            { label: text.twoBins.items[2], bin: 0 },
            { label: text.twoBins.items[3], bin: 1 },
          ],
          counts: [2, 2],
          label: text.twoBins.label,
        },
      };
    }
    if (activity === 'venn') {
      return {
        ...base,
        text: text.venn.say,
        whiteboard: {
          kind: 'venn',
          leftLabel: text.venn.left,
          rightLabel: text.venn.right,
          items: [
            { label: text.venn.items[0], side: 'left' },
            { label: text.venn.items[1], side: 'right' },
            { label: text.venn.items[2], side: 'both' },
          ],
          left: 1,
          right: 1,
          both: 1,
          label: text.venn.label,
        },
      };
    }
    if (activity === 'ranking') {
      return {
        ...base,
        text: text.ranking.say,
        whiteboard: {
          kind: 'ranking',
          items: [
            { label: text.ranking.items[0], value: 25 },
            { label: text.ranking.items[1], value: 180 },
            { label: text.ranking.items[2], value: 6 },
          ],
          direction: 'asc',
          order: [2, 0, 1],
          label: text.ranking.label,
          currency,
        },
      };
    }
    if (activity === 'outcomes') {
      return {
        ...base,
        text: text.outcomes.say,
        whiteboard: {
          kind: 'outcomes',
          good: { label: text.outcomes.good[0], detail: text.outcomes.good[1] },
          bad: { label: text.outcomes.bad[0], detail: text.outcomes.bad[1] },
          label: text.outcomes.label,
        },
      };
    }
    if (activity === 'trade') {
      return {
        ...base,
        text: text.trade.say,
        whiteboard: {
          kind: 'trade',
          left: { who: text.trade.who[0], gives: text.trade.gives[0], gets: text.trade.gets[0] },
          right: { who: text.trade.who[1], gives: text.trade.gives[1], gets: text.trade.gets[1] },
          label: text.trade.label,
        },
      };
    }
    return {
      ...base,
      text: text.chance.say,
      whiteboard: {
        kind: 'chance',
        outcomes: [
          { label: text.chance.outcomes[0], weight: 4 },
          { label: text.chance.outcomes[1], weight: 1 },
        ],
        shares: [0.8, 0.2],
        label: text.chance.label,
      },
    };
  }
  if (
    activity === 'deal' ||
    activity === 'change' ||
    activity === 'regroup' ||
    activity === 'equation' ||
    activity === 'receipt' ||
    activity === 'ledger' ||
    activity === 'price-tag' ||
    activity === 'inventory' ||
    activity === 'budget'
  ) {
    const text = LAB_MONEY_TEXT[locale];
    const currency = LAB_CURRENCY[locale];
    const base = {
      seq: 4,
      emotion: 'happy' as const,
      action: 'nod' as const,
      audioUrl: null,
      audioPending: false,
      wordTimings: null,
      next: 'ask' as const,
      policy: null,
      demonstrate: null,
    };
    if (activity === 'deal') {
      return {
        ...base,
        text: text.deal.say,
        whiteboard: { kind: 'deal', total: 14, bins: text.deal.bins, perBin: 4, remainder: 2, label: text.deal.label },
      };
    }
    if (activity === 'change') {
      return {
        ...base,
        text: text.change.say,
        whiteboard: { kind: 'change', price: 7, paid: 20, change: 13, label: text.change.label, currency },
      };
    }
    if (activity === 'regroup') {
      return {
        ...base,
        text: text.regroup.say,
        whiteboard: {
          kind: 'regroup',
          fromDenomination: 10,
          fromCount: 1,
          intoDenomination: 1,
          intoCount: 10,
          label: text.regroup.label,
          currency,
        },
      };
    }
    if (activity === 'equation') {
      return {
        ...base,
        text: text.equation.say,
        whiteboard: {
          kind: 'equation_bar',
          left: [
            { label: text.equation.left[0], value: 34 },
            { label: text.equation.left[1], value: 56 },
          ],
          right: [{ label: text.equation.right[0], value: 90 }],
          total: 90,
          label: text.equation.label,
          currency,
        },
      };
    }
    if (activity === 'receipt') {
      return {
        ...base,
        text: text.receipt.say,
        whiteboard: {
          kind: 'receipt',
          lines: [
            { label: text.receipt.lines[0], value: 18 },
            { label: text.receipt.lines[1], value: 24 },
            { label: text.receipt.lines[2], value: 31 },
          ],
          total: 73,
          label: text.receipt.label,
          currency,
        },
      };
    }
    if (activity === 'ledger') {
      return {
        ...base,
        text: text.ledger.say,
        whiteboard: {
          kind: 'ledger',
          entries: [
            { label: text.ledger.entries[0], amount: 48, direction: 'in' },
            { label: text.ledger.entries[1], amount: 19, direction: 'out' },
            { label: text.ledger.entries[2], amount: 26, direction: 'in' },
          ],
          balances: [48, 29, 55],
          final: 55,
          label: text.ledger.label,
          currency,
        },
      };
    }
    if (activity === 'price-tag') {
      return {
        ...base,
        text: text.priceTag.say,
        whiteboard: {
          kind: 'price_tag',
          item: text.priceTag.item,
          price: 60,
          units: 6,
          discountPercent: 25,
          unitPrice: 7.5,
          finalPrice: 45,
          label: text.priceTag.label,
          currency,
        },
      };
    }
    if (activity === 'inventory') {
      return {
        ...base,
        text: text.inventory.say,
        whiteboard: { kind: 'inventory', item: text.inventory.item, start: 12, sold: 5, left: 7, label: text.inventory.label },
      };
    }
    return {
      ...base,
      text: text.budget.say,
      whiteboard: {
        kind: 'budget_plate',
        budget: 100,
        items: [
          { label: text.budget.items[0], value: 45 },
          { label: text.budget.items[1], value: 30 },
          { label: text.budget.items[2], value: 40 },
        ],
        spent: 115,
        remaining: 0,
        overBy: 15,
        label: text.budget.label,
        currency,
      },
    };
  }
  if (activity === 'categories') {
    const text = LAB_CATEGORIES_TEXT[locale];
    return {
      seq: 4,
      text: text.say,
      emotion: 'happy',
      action: 'nod',
      audioUrl: null,
      audioPending: false,
      wordTimings: null,
      next: 'ask',
      policy: null,
      demonstrate: null,
      whiteboard: {
        kind: 'categories',
        categories: [
          { label: text.categories[0], value: 40 },
          { label: text.categories[1], value: 35 },
          { label: text.categories[2], value: 25 },
        ],
        // Server-computed, one-to-one with `categories` (`whiteboard.ts`'s
        // `computeCategories`) — hand-set here since the lab has no server.
        values: [40, 35, 25],
        label: text.label,
        currency: LAB_CURRENCY[locale],
      },
    };
  }
  return {
    seq: 4,
    text: LAB_SCRIPTS[locale].turn,
    emotion: 'happy',
    action: 'nod',
    audioUrl: null,
    audioPending: false,
    wordTimings: null,
    next: 'segment',
    policy: null,
    demonstrate: null,
    whiteboard: null,
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
/**
 * THE ACTIVITIES THAT ARE A WHITEBOARD RATHER THAN A GRADED SEGMENT, in ONE
 * place. `LAB_ACTIVITIES` (the switch's vocabulary) and `labActivity` (which
 * decides whether the plate holds a segment) both read this.
 *
 * They used to be two hand-maintained lists, and adding `tokens` to only one of
 * them cost a red `verify:tutor-ui` run: the switch offered the activity, the
 * plate served a graded segment instead — and a segment always wins the plate —
 * so the board never mounted and the gate reported "timed out waiting for the
 * tokens whiteboard". Exactly the "add a kind, forget a copy" class
 * `instruments:check` exists for, one layer below where that gate can see.
 */
const WHITEBOARD_ACTIVITIES = [
  'whiteboard',
  'compare',
  'marked-line',
  'categories',
  'tokens',
  'bar-model',
  'part-whole',
  'flow',
  'goal-bar',
  'worked',
  'ten-frame',
  'number-jumps',
  'array',
  'fraction-strip',
  'partition',
  'table',
  'scale',
  'two-bins',
  'venn',
  'ranking',
  'outcomes',
  'trade',
  'chance',
  'deal',
  'change',
  'regroup',
  'equation',
  'receipt',
  'ledger',
  'price-tag',
  'inventory',
  'budget',
] as const;

export const LAB_ACTIVITIES: readonly string[] = [
  'script',
  'none',
  ...WHITEBOARD_ACTIVITIES,
  // The TYPE LIST is locale-independent by construction (registry.test.tsx
  // proves it), so building it from one locale is not a choice with a
  // consequence — it is the same list in all three.
  ...Object.keys(fixtureByType(DEFAULT_LAB_LOCALE)).sort(),
];

export const DEFAULT_LAB_ACTIVITY = 'script';

/** The activity the plate should hold, for whatever the switch is on. */
export function labActivity(locale: Locale, activity: string): LiveSegmentState | null {
  if (activity === 'none' || (WHITEBOARD_ACTIVITIES as readonly string[]).includes(activity)) {
    return null;
  }
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
        whiteboard: null,
        demonstrate: null,
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
        whiteboard: null,
        demonstrate: null,
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
        whiteboard: null,
        demonstrate: null,
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
        whiteboard: null,
        demonstrate: null,
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
        whiteboard: null,
        demonstrate: null,
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
        whiteboard: null,
        demonstrate: null,
        source: 'model',
        created_at: at(5),
      },
    ],
    segments: [
      {
        segmentId: 'b1d5f8a2-6c14-4f0e-9a3b-0d2e5c7f4a18',
        // This segment's own per-session ordinal, unrelated to any turn's
        // seq — `createdAt` below, not this, is what places it after the
        // turn that handed it over.
        seq: 0,
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
        createdAt: at(6),
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
    turn: conversing ? labTurn(locale, activity) : null,
    history,
    segment,
    lesson: { topic: 'Ahorrar para una meta', step: 2, of: 4 },
    budget: 'running',
    remainingMs: LAB_REMAINING_MS,
    // True so the orb is LIVE during a conversation, which is the state the
    // product has whenever a voice provider is configured, and the only state
    // in which the hero control's full silhouette is on screen.
    microphone: true,
    micRevoked: false,
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
    // The streamed upload and the interrupt are wire concerns, and there is no
    // wire. `commitAudioStream` answers false so a caller falls back to
    // `sendAudio`, which is equally nothing here.
    streamAudioChunk: () => {},
    commitAudioStream: () => false,
    abandonAudioStream: () => {},
    interrupt: () => {},
    // The same local rewind the real hook performs; there is no wire to tell.
    editLast: (text: string) => {
      const trimmed = text.trim();
      if (trimmed === '') return;
      setHistory((prev) => {
        const next = [...prev];
        if (next.at(-1)?.speaker === 'tutor') next.pop();
        if (next.at(-1)?.speaker === 'learner') next.pop();
        return [...next, { speaker: 'learner', text: trimmed, seq: -1 }];
      });
    },
    thinking: false,
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
 * Split out of the hook so the routing table reads as a table. `granted` and
 * `policy` are the only things a human drives from the page, and both belong
 * to the guardian consent surface rather than to the stage.
 */
function answerTutorPath(
  path: string,
  method: string,
  granted: boolean,
  locale: Locale,
  policy: 'allowed' | 'blocked',
): Response {
  if (path.includes('/tutor/consent/')) {
    /*
     * TWO independent axes, because they produce four different screens and
     * one of them is the state we ship in: policy blocked and no consent, where
     * the control must show the reason and offer nothing. Folding them into one
     * switch would make that screen unreachable in the harness — and it is the
     * only one a real family sees today.
     */
    return envelope({
      active: granted,
      grantedAt: granted ? '2026-08-01T10:00:00Z' : null,
      locale,
      policy,
    });
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

  /*
   * THE PARENTAL APPROVAL GATE (/ORACLE.md §20, migration 0068). Two notes on
   * purpose, and they are not interchangeable: the first is written against
   * the note the tutor holds today and can simply be approved; the second was
   * written against something older, so the panel must mark it out of date
   * BEFORE anyone taps approve. A fixture with only the easy one would leave
   * the state a real family actually hits unviewable here.
   */
  if (path.includes('/memory-proposals') && method === 'GET') {
    return envelope({
      proposals: [
        {
          id: '11111111-1111-4111-8111-aaaaaaaaaaaa',
          proposed: LAB_MEMORY_NOTES[locale].fresh,
          expectedBefore: LAB_MEMORY_NOTES[locale].current,
          sessionId: '22222222-2222-4222-8222-222222222222',
          createdAt: '2026-09-01T10:00:00Z',
        },
        {
          id: '11111111-1111-4111-8111-bbbbbbbbbbbb',
          proposed: LAB_MEMORY_NOTES[locale].stale,
          expectedBefore: LAB_MEMORY_NOTES[locale].older,
          sessionId: null,
          createdAt: '2026-08-30T09:00:00Z',
        },
      ],
      current: LAB_MEMORY_NOTES[locale].current,
    });
  }

  if (path.includes('/memory-proposals/') && method === 'POST') {
    // Always lands, and pays nothing. The REFUSAL paths (a stale note, a note
    // somebody else already decided) are exercised by the panel's own unit
    // tests; what this page is for is looking at the screen.
    return envelope({ outcome: 'written', applied: true });
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
export function useStubbedCoreApi(
  consentGranted: boolean,
  locale: Locale,
  voicePolicy: 'allowed' | 'blocked' = 'blocked',
): void {
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
  // Same ref treatment as the other two, and for the same reason: flipping the
  // policy must repaint the control, never tear the shim down mid-fetch.
  const policy = useRef(voicePolicy);
  policy.current = voicePolicy;

  useEffect(() => {
    const real = window.fetch;

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      // Everything that is not a Tutor data call — the island's `.glb`, the
      // sound bed, Vite's own HMR — goes to the real network untouched.
      if (!url.includes('/api/v1/tutor')) return real(input, init);

      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      return answerTutorPath(url, method, granted.current, language.current, policy.current);
    }) as typeof window.fetch;

    return () => {
      window.fetch = real;
    };
  }, []);
}
