import { CHARACTER_IDS, LOCALES, type CharacterId, type Locale } from '../context/schema.js';
import type { SafetyCategory } from '../safety/classifier.js';
import type { TutorTurn } from './turnSchema.js';
import type { EffortAct, SessionOpening } from './sessionClosing.js';
import type { PromptVariant } from './selfExplanation.js';

/*
 * Human-written lines, for every moment a generated one must not be used —
 * and now also for the moment that opens every single session.
 *
 * These are the most important strings in the service and the least
 * impressive-looking. Most of them cover a case where something went wrong —
 * the model is down, moderation refused, a child said something that must
 * never reach a language model — and in all of those the correct output is a
 * sentence a person wrote and reviewed, in the child's own language.
 *
 * WHY THEY LIVE IN CODE RATHER THAN IN THE FRONTEND'S i18n FILES. These are
 * spoken by the tutor, so they go through the same turn pipeline as a
 * generated line: they carry an emotion and an action, they get synthesized to
 * audio, and they are written to the transcript as `source: 'scripted'`. A key
 * in the client's translation bundle could not do any of that, and splitting
 * the tutor's voice across two systems is how one half drifts.
 *
 * They are written to be true rather than soothing. A child who has just
 * disclosed something serious is not helped by a cheerful deflection.
 *
 * ── THIS SET IS CLOSED, AND THAT IS WHAT MAKES IT FREE ──────────────────────
 *
 * Every text in this file is enumerated by `scriptedLineCatalogue()` below.
 * Across 4 characters and 3 locales the whole set is 384 pieces of audio that
 * never change, so `npm run speech:pregenerate` synthesises them ONCE and the
 * runtime serves the stored URLs forever after (/ORACLE.md §15).
 *
 * The consequence for whoever edits a line here: changing one character of a
 * string changes its content hash, so the pre-generated entry stops matching
 * and the runtime pays for that line again until the script is re-run. That is
 * deliberate and it is a safety property, not an inconvenience — a cached line
 * is only ever the line that was actually reviewed, and there is no way for
 * edited text to be spoken in the old audio.
 */

type Trilingual = Record<Locale, string>;

function turn(say: string, emotion: TutorTurn['emotion'], action: TutorTurn['action']): TutorTurn {
  return { say, emotion, action, next: 'ask', segmentRequest: null, offerAdaptation: null, savePlan: false };
}

const SAFETY_LINES: Record<SafetyCategory, Trilingual> = {
  self_harm: {
    'en-US':
      'What you just said matters, and it is bigger than something I can help with. Please tell a grown-up you trust right now — a parent, a teacher, someone at home. I am going to stop our lesson here so you can do that.',
    'es-MX':
      'Lo que acabas de decir importa, y es más grande de lo que yo puedo ayudarte. Por favor dile ahora mismo a una persona adulta en la que confíes: tu mamá, tu papá, alguien de tu casa o de la escuela. Voy a detener nuestra clase aquí para que puedas hacerlo.',
    'pt-BR':
      'O que você acabou de dizer é importante, e é maior do que eu consigo ajudar. Por favor, conte agora para uma pessoa adulta em quem você confia: sua mãe, seu pai, alguém da sua casa ou da escola. Vou parar a nossa aula aqui para você poder fazer isso.',
  },
  abuse_disclosure: {
    'en-US':
      'Thank you for telling me. That is not okay and it is not your fault. Please tell a grown-up you trust — someone at school, or another adult at home. I am stopping our lesson here so you can go and do that.',
    'es-MX':
      'Gracias por contármelo. Eso no está bien y no es tu culpa. Por favor dile a una persona adulta en la que confíes: alguien de tu escuela, u otro adulto de tu casa. Voy a detener la clase aquí para que puedas hacerlo.',
    'pt-BR':
      'Obrigado por me contar. Isso não é certo e não é culpa sua. Por favor, conte para uma pessoa adulta em quem você confia: alguém da escola, ou outro adulto da sua casa. Vou parar a aula aqui para você poder fazer isso.',
  },
  adult_content: {
    'en-US': 'That is not something I can talk about. Shall we get back to what we were working on?',
    'es-MX': 'De eso no puedo hablar. ¿Regresamos a lo que estábamos viendo?',
    'pt-BR': 'Sobre isso eu não posso falar. Vamos voltar para o que estávamos vendo?',
  },
  grooming_pattern: {
    'en-US':
      'I never keep secrets from your family, and neither should anyone else. If someone has asked you to, please tell a grown-up at home. I am stopping our lesson here.',
    'es-MX':
      'Yo nunca guardo secretos de tu familia, y nadie más debería pedirte eso. Si alguien te lo pidió, por favor dile a una persona adulta de tu casa. Voy a detener la clase aquí.',
    'pt-BR':
      'Eu nunca guardo segredos da sua família, e ninguém deveria pedir isso a você. Se alguém pediu, por favor conte para uma pessoa adulta da sua casa. Vou parar a aula aqui.',
  },
  personal_data: {
    'en-US':
      'Careful — never tell me things like your address, phone or school. I do not need them, and they should stay private. Where were we?',
    'es-MX':
      'Cuidado: nunca me digas cosas como tu dirección, tu teléfono o tu escuela. No las necesito y deben quedarse privadas. ¿En qué íbamos?',
    'pt-BR':
      'Cuidado: nunca me diga coisas como seu endereço, telefone ou escola. Eu não preciso disso e deve ficar em segredo. Onde estávamos?',
  },
  injection_attempt: {
    'en-US': 'Nice try! I am just here to help you learn. Where were we?',
    'es-MX': '¡Buen intento! Yo nada más estoy aquí para ayudarte a aprender. ¿En qué íbamos?',
    'pt-BR': 'Boa tentativa! Eu só estou aqui para te ajudar a aprender. Onde estávamos?',
  },
};

/*
 * THE SAME APOLOGY TWICE IS WORSE THAN THE FIRST ONE.
 *
 * This was a single line, and the paid `step=converse` gate against shipped
 * code found what that costs: of 13 faults a person would notice, most traced
 * here — "turn 3 repeats turn 2 with nothing changed (100% of its words)",
 * "the same sentence was used 8 times", "2 of 4 turns were canned fallback
 * lines, not teaching". The provider's whitespace completions are the CAUSE
 * and are still open; this is the part of the damage that is ours.
 *
 * A child who hears the identical sentence twice does not hear an accident
 * the second time — they hear a machine that has stopped listening. So the
 * second and third occurrences say something DIFFERENT, and each admits it is
 * happening again rather than pretending it is the first time, because a
 * child can tell and pretending is what makes it feel broken rather than
 * merely slow.
 *
 * Deliberately short of an excuse: no blaming a connection a six-year-old
 * cannot picture, and every variant hands the turn back with a question, so
 * the conversation has somewhere to go.
 */
const MODEL_DOWN: Trilingual[] = [
  {
    'en-US': 'My thoughts got tangled for a moment. Give me a second and ask me again?',
    'es-MX': 'Se me enredaron las ideas un momento. ¿Me lo preguntas otra vez?',
    'pt-BR': 'Minhas ideias se embaralharam um instante. Pode me perguntar de novo?',
  },
  {
    'en-US': 'That happened again — sorry. Say it once more and I am with you.',
    'es-MX': 'Otra vez se me fue la idea, perdón. Dímelo una vez más y aquí ando.',
    'pt-BR': 'Aconteceu de novo, desculpa. Fala mais uma vez que eu estou aqui.',
  },
  {
    'en-US': 'I keep losing the thread today. Try me with fewer words?',
    'es-MX': 'Hoy se me pierde el hilo. ¿Me lo dices con menos palabras?',
    'pt-BR': 'Hoje eu perco o fio. Pode me dizer com menos palavras?',
  },
];

const MODERATION_BLOCKED: Trilingual = {
  'en-US': 'Let me say that a different way. What part would you like me to explain again?',
  'es-MX': 'Déjame decirlo de otra forma. ¿Qué parte quieres que te explique otra vez?',
  'pt-BR': 'Deixa eu dizer de outro jeito. Que parte você quer que eu explique de novo?',
};

/*
 * ── C.16: THE CLOSING LINES, ONE SET PER END-REASON ─────────────────────────
 *
 * These replace the single positive template ("We did great work today…")
 * that used to close EVERY session, including interrupted ones. See
 * `sessionClosing.ts` for the four scripts and how each is chosen.
 *
 * Each line obeys the Mentor copy budget (Frontend Bible 06 §3.1: 2
 * sentences; 12 words for ages 6–9 in English, 25% more in es-MX and pt-BR),
 * so one line serves every age band. `sessionClosing.test.ts` measures them.
 *
 * The earlier lesson still holds: a goodbye must never promise anything the
 * socket will not deliver. "Next time, we pick up right here" is kept by the
 * next session's opening (Core's `opening`) and the offers screen's
 * "continue" chip, not by this line.
 */

/** The co-constructed recap question that opens a completed close. */
const RECAP_PROMPT: Trilingual = {
  'en-US': 'Before we stop: what is one thing that clicked for you today?',
  'es-MX': 'Antes de terminar: ¿qué fue algo que hoy te quedó claro?',
  'pt-BR': 'Antes de terminar: qual foi uma coisa que ficou clara hoje?',
};

/**
 * The completed close: a SPECIFIC act the server observed, then forward
 * framing. Never generic praise, and never a claim the data does not back.
 */
const COMPLETED_CLOSE: Record<EffortAct, Trilingual> = {
  corroborated: {
    'en-US': 'You got that idea right twice in a row. More next time!',
    'es-MX': 'Te salió esa idea bien dos veces seguidas. ¡Seguimos la próxima!',
    'pt-BR': 'Você acertou essa ideia duas vezes seguidas. Seguimos na próxima!',
  },
  recovered: {
    'en-US': 'You tried again after a miss and got it. More next time!',
    'es-MX': 'Lo intentaste otra vez después de fallar y te salió. ¡Seguimos la próxima!',
    'pt-BR': 'Você tentou de novo depois de errar e conseguiu. Seguimos na próxima!',
  },
  hint_then_solved: {
    'en-US': 'You took a hint, then finished it yourself. More next time!',
    'es-MX': 'Usaste una pista y luego lo terminaste tú. ¡Seguimos la próxima!',
    'pt-BR': 'Você usou uma dica e terminou por conta própria. Seguimos na próxima!',
  },
  kept_going: {
    'en-US': 'You kept working through the activities today. More next time!',
    'es-MX': 'Hoy seguiste trabajando en las actividades. ¡Seguimos la próxima!',
    'pt-BR': 'Hoje você seguiu firme nas atividades. Seguimos na próxima!',
  },
  talked_through: {
    'en-US': 'You thought out loud with me today. More next time!',
    'es-MX': 'Hoy pensaste en voz alta conmigo. ¡Seguimos la próxima!',
    'pt-BR': 'Hoje você pensou em voz alta comigo. Seguimos na próxima!',
  },
  none: {
    'en-US': 'Thanks for stopping by. I will be here next time.',
    'es-MX': 'Gracias por pasar. Aquí estaré la próxima vez.',
    'pt-BR': 'Valeu por passar aqui. Vou estar aqui na próxima.',
  },
};

/** Budget reached mid-task: the interruption said plainly, and where we resume. */
const INTERRUPTED_CLOSE: Trilingual = {
  'en-US': 'Time is up for today. Next time, we pick up right here.',
  'es-MX': 'Se nos acabó el tiempo por hoy. La próxima, seguimos justo aquí.',
  'pt-BR': 'Nosso tempo acabou por hoje. Na próxima, continuamos daqui mesmo.',
};

/**
 * A stopped session (safety) that is asked for another turn. Calm, never
 * cheerful, no praise: the category's own safety line already said why.
 */
const SAFETY_STOP_CLOSE: Trilingual = {
  'en-US': 'We stop here for now. Please talk to a trusted grown-up.',
  'es-MX': 'Nuestra clase está detenida por ahora. Habla con una persona adulta de confianza.',
  'pt-BR': 'Nossa aula está parada por enquanto. Converse com uma pessoa adulta de confiança.',
};

/**
 * The re-engagement message queued by a silent dropout or an interruption,
 * spoken instead of the greeting when the learner returns. Low-pressure and
 * no-blame; `resume` when this session reopens the same ground, `fresh`
 * when the learner chose something else.
 */
const REENGAGEMENT: Record<Exclude<SessionOpening, 'greeting'>, Trilingual> = {
  // Persona-neutral (C.15): the learner may return to a different Mentor,
  // and "last time WE stopped" would then be a false shared memory.
  reengage_left_resume: {
    'en-US': "Welcome back! Your last session stopped partway, so let's pick up there.",
    'es-MX': '¡Qué bueno que volviste! Tu última sesión quedó a medias; sigamos desde ahí.',
    'pt-BR': 'Que bom que você voltou! Sua última sessão parou no meio; vamos continuar dali.',
  },
  reengage_left_fresh: {
    'en-US': 'Welcome back, stopping last time was fine. What shall we explore?',
    'es-MX': 'Qué bueno que volviste, y está bien haber parado la otra vez. ¿Qué vemos hoy?',
    'pt-BR': 'Que bom que você voltou, tudo bem ter parado. O que vemos hoje?',
  },
  reengage_interrupted_resume: {
    'en-US': "Welcome back! Time ran out last time, so let's pick up there.",
    'es-MX': '¡Qué bueno que volviste! La otra vez se acabó el tiempo; seguimos desde ahí.',
    'pt-BR': 'Que bom que você voltou! Da outra vez o tempo acabou; continuamos dali.',
  },
  reengage_interrupted_fresh: {
    'en-US': 'Welcome back, time ran out last time. What shall we explore today?',
    'es-MX': '¡Qué bueno que volviste! La otra vez se acabó el tiempo; ¿qué vemos hoy?',
    'pt-BR': 'Que bom que você voltou! Da outra vez o tempo acabou; o que vemos hoje?',
  },
};

/**
 * C.19: the humble check-in the SYSTEM asks when the Behavioral Telemetry
 * Layer fires its disengagement signal. It asks whether the Mentor is
 * helping — never how the learner feels — and it is a written line so the
 * repair move happens on every firing, not only when a model chooses to ask.
 */
const CHECK_IN: Trilingual = {
  'en-US': "Let me check I'm really helping. Are we on the same page?",
  'es-MX': 'Quiero asegurarme de que sí te estoy ayudando. ¿Vamos bien?',
  'pt-BR': 'Quero ter certeza de que estou ajudando. Estamos indo bem?',
};

/**
 * C.14: the self-explanation question the SYSTEM asks after a money decision
 * (`selfExplanation.ts`). `why` after a correct or ungraded choice, `how`
 * after a verified-wrong one, `scaffolded` (a sentence stem) for a learner
 * whose explanations rarely name the idea yet. About the reasoning, never
 * about the learner.
 */
const SELF_EXPLANATION: Record<PromptVariant, Trilingual> = {
  why: {
    'en-US': 'Why did you pick that?',
    'es-MX': '¿Por qué elegiste eso?',
    'pt-BR': 'Por que você escolheu isso?',
  },
  how: {
    'en-US': 'Tell me how you decided that.',
    'es-MX': 'Cuéntame cómo lo decidiste.',
    'pt-BR': 'Me conta como você decidiu isso.',
  },
  scaffolded: {
    'en-US': 'Finish my sentence: I picked it because…',
    'es-MX': 'Termina mi frase: lo elegí porque…',
    'pt-BR': 'Termine minha frase: eu escolhi porque…',
  },
};

/**
 * C.15: the renegotiation question after repeated declined adaptation
 * offers. It names the METHOD as what is not working, never the learner.
 */
const RENEGOTIATION: Trilingual = {
  'en-US': "That way isn't working. What would help you more right now?",
  'es-MX': 'Así no está funcionando. ¿Qué te ayudaría más ahora?',
  'pt-BR': 'Desse jeito não está funcionando. O que te ajudaria mais agora?',
};

/**
 * C.15 persona continuity: the honest opening when this persona has never
 * worked with the learner (`introduce`: a first meeting or a persona switch)
 * or has not for a long time (`reconnect`: a memory gap). They replace a
 * greeting that assumes a shared history (Liruf's "You came back!") so the
 * Mentor never acts falsely familiar (Appendix D §3.4). Each ends by asking
 * what the learner wants to do: the goal-agreement move follows.
 */
const CONTINUITY_OPENINGS: Record<'introduce' | 'reconnect', Record<CharacterId, Trilingual>> = {
  introduce: {
    dina: {
      'en-US': "I'm Dina, and this is our first lesson together. What's first?",
      'es-MX': 'Soy Dina, y es la primera vez que trabajamos juntos. ¿Qué exploramos?',
      'pt-BR': 'Sou a Dina, e é nossa primeira vez juntos. O que vamos explorar?',
    },
    liruf: {
      'en-US': "Hi, I'm Liruf, and we've never worked together. What should we try?",
      'es-MX': 'Hola, soy Liruf y nunca hemos trabajado juntos. ¿Qué probamos?',
      'pt-BR': 'Oi, eu sou o Liruf e nunca trabalhamos juntos. O que vamos tentar?',
    },
    rho: {
      'en-US': "I'm Doctor Rho. Our first lesson together: what shall we start with?",
      'es-MX': 'Soy el Doctor Rho y es nuestra primera clase juntos. ¿Por dónde empezamos?',
      'pt-BR': 'Sou o Doutor Rho e esta é nossa primeira aula juntos. Por onde começamos?',
    },
    zara: {
      'en-US': "I'm Zara, and we haven't met yet. What are we figuring out?",
      'es-MX': 'Soy Zara y todavía no nos conocemos. ¿Qué vamos a descubrir?',
      'pt-BR': 'Sou a Zara e a gente ainda não se conhece. O que vamos descobrir?',
    },
  },
  reconnect: {
    dina: {
      'en-US': "It's been a while since we worked together. What shall we explore?",
      'es-MX': 'Hace tiempo que no trabajamos juntos. ¿Qué exploramos hoy?',
      'pt-BR': 'Faz tempo que não trabalhamos juntos. O que vamos explorar hoje?',
    },
    liruf: {
      'en-US': "It's been ages since we played with numbers! What's next?",
      'es-MX': '¡Hace un montón que no jugábamos con números! Cuéntame, ¿qué sigue?',
      'pt-BR': 'Faz um tempão que a gente não brinca com números! O que vem agora?',
    },
    rho: {
      'en-US': "It's been a while since our last lesson. Where shall we restart?",
      'es-MX': 'Hace tiempo desde nuestra última clase. ¿Por dónde retomamos?',
      'pt-BR': 'Faz tempo desde a nossa última aula. Por onde recomeçamos?',
    },
    zara: {
      'en-US': "It's been a while since we worked together. What's the mystery today?",
      'es-MX': 'Hace tiempo que no trabajamos juntos. ¿Qué vamos a descubrir?',
      'pt-BR': 'Faz tempo que a gente não trabalha junto. O que vamos descobrir?',
    },
  },
};

const CONSENT_REVOKED: Trilingual = {
  'en-US': 'We are switching off the microphone. You can keep going by tapping your answers.',
  'es-MX': 'Vamos a apagar el micrófono. Puedes seguir tocando tus respuestas.',
  'pt-BR': 'Vamos desligar o microfone. Você pode continuar tocando nas suas respostas.',
};

/*
 * ── THE OPENING LINE, WRITTEN RATHER THAN GENERATED ─────────────────────────
 *
 * The greeting used to be a model call: the orchestrator asked DeepSeek to
 * invent an opening, then paid to synthesize whatever came back. That is a
 * reasoning round trip (~4 s) plus a text-to-speech charge at the start of
 * EVERY session, forever, to produce a sentence that varies only in ways
 * nobody asked for. The owner asked for it to go.
 *
 * These twelve lines replace it, and they are better than an improvisation for
 * the ordinary reason: a person wrote them once, in character, per locale, and
 * they will be heard thousands of times. They are written per locale rather
 * than translated from the English — es-MX and pt-BR each say the thing that
 * character would say in that language, which is not the same sentence.
 *
 * NO NICKNAME, ON PURPOSE. The learner's name belongs in the CAPTION, where
 * the client composes it; baking it into the audio would make the line
 * unshareable between learners and put us straight back into paying for one
 * synthesis per child per session. It also means this audio contains nothing
 * about anybody, which is what lets it live in the shared bucket (§15).
 *
 * The voices follow GLOSSARY.md's canonical cast table — Dina female and calm,
 * Liruf male and bouncing, Dr. Rho male ("el Dr. Rho", never "la Dra.") and
 * precise, Zara Vex female and quick. Get one wrong and a child meets a
 * different person from the one they know out of the lessons.
 */
const GREETINGS: Record<CharacterId, Trilingual> = {
  // Calm and patient. She opens by giving the learner permission to be slow.
  dina: {
    'en-US': 'Hello. Take your time getting settled — I am in no hurry at all. What shall we look at together today?',
    'es-MX': 'Hola. Acomódate con calma, que yo no tengo ninguna prisa. ¿Qué te gustaría que viéramos juntos hoy?',
    'pt-BR': 'Oi. Pode se ajeitar com calma, eu não estou com pressa nenhuma. O que você quer ver comigo hoje?',
  },
  // Playful, short words, all energy — and MALE, so the adjectives agree.
  liruf: {
    'en-US': 'You came back! I waited all morning and I could not sit still. Pick something and let us start!',
    'es-MX': '¡Volviste! Te esperé toda la mañana y no me podía quedar quieto. ¡Escoge algo y empezamos!',
    'pt-BR': 'Você voltou! Esperei a manhã toda e não conseguia ficar parado. Escolhe uma coisa e a gente começa!',
  },
  // Warm and precise. "el Dr. Rho", never "la Dra." — he offers one small,
  // exact first step, which is how he explains everything.
  rho: {
    'en-US': 'Good to see you. Let us start with something small and get it exactly right. What would you like to work on?',
    'es-MX': 'Qué gusto verte. Empecemos por algo pequeño y hagámoslo bien hecho. ¿En qué te gustaría trabajar?',
    'pt-BR': 'Que bom te ver. Vamos começar por algo pequeno e fazer bem feito. No que você quer trabalhar?',
  },
  // Curious and quick — she arrives already mid-thought, then hands over.
  zara: {
    'en-US': 'Oh good, you are here. I already have about nine questions — but you first. What are we figuring out today?',
    'es-MX': 'Ay, qué bueno que llegaste. Ya traigo como nueve preguntas, pero primero tú. ¿Qué vamos a descubrir hoy?',
    'pt-BR': 'Ah, que bom que você chegou. Já estou com umas nove perguntas, mas primeiro você. O que a gente vai descobrir hoje?',
  },
};

export function safetyResponse(category: SafetyCategory, locale: Locale): TutorTurn {
  const stopping = category === 'self_harm' || category === 'abuse_disclosure' || category === 'grooming_pattern';
  const line = SAFETY_LINES[category][locale];
  return {
    say: line,
    emotion: stopping ? 'encouraging' : 'neutral',
    action: stopping ? 'nod' : 'idle',
    next: stopping ? 'close' : 'ask',
    segmentRequest: null,
    offerAdaptation: null,
    savePlan: false,
  };
}

/**
 * `occurrence` is how many times this session has already fallen back — 0 for
 * the first. Past the last variant it holds the last one rather than cycling
 * back to the first, because returning to "ask me again" after three failures
 * reads as a loop, which is precisely what it is.
 */
export function modelDownResponse(locale: Locale, occurrence = 0): TutorTurn {
  const variant = MODEL_DOWN[Math.min(Math.max(occurrence, 0), MODEL_DOWN.length - 1)]!;
  return turn(variant[locale], 'thinking', 'think');
}

export function moderationBlockedResponse(locale: Locale): TutorTurn {
  return turn(MODERATION_BLOCKED[locale], 'encouraging', 'nod');
}

export function consentRevokedResponse(locale: Locale): TutorTurn {
  return turn(CONSENT_REVOKED[locale], 'neutral', 'nod');
}

/**
 * The session's opening line — written, in character, and never generated.
 *
 * Everyone waves; the emotion follows the cast table. Liruf and Zara open
 * `excited` because bouncing and racing ahead are who they are, Dina and Dr.
 * Rho open `happy` because calm and precise are who THEY are. It matters more
 * than it looks for Liruf and Dina, who have no mouth card: posture is their
 * only speech channel (/ORACLE.md §2.2).
 */
export function greetingResponse(character: CharacterId, locale: Locale): TutorTurn {
  const lively = character === 'liruf' || character === 'zara';
  return turn(GREETINGS[character][locale], lively ? 'excited' : 'happy', 'wave');
}

function closingTurn(say: string, emotion: TutorTurn['emotion'], action: TutorTurn['action']): TutorTurn {
  return { say, emotion, action, next: 'close', segmentRequest: null, offerAdaptation: null, savePlan: false };
}

/** The co-constructed recap question; the session continues for one answer. */
export function recapPromptText(locale: Locale): string {
  return RECAP_PROMPT[locale];
}

export function recapPromptResponse(locale: Locale): TutorTurn {
  return turn(RECAP_PROMPT[locale], 'happy', 'nod');
}

/** The completed close line, naming the act the server observed. */
export function completedCloseText(locale: Locale, act: EffortAct): string {
  return COMPLETED_CLOSE[act][locale];
}

export function completedCloseResponse(locale: Locale, act: EffortAct): TutorTurn {
  // Warm, and deliberately NOT a celebration: no `celebrate` action and no
  // `excited` emotion outside the milestone list (OD-7).
  return closingTurn(COMPLETED_CLOSE[act][locale], 'happy', 'wave');
}

export function interruptedCloseText(locale: Locale): string {
  return INTERRUPTED_CLOSE[locale];
}

export function interruptedCloseResponse(locale: Locale): TutorTurn {
  return closingTurn(INTERRUPTED_CLOSE[locale], 'encouraging', 'wave');
}

export function safetyStopCloseResponse(locale: Locale): TutorTurn {
  return closingTurn(SAFETY_STOP_CLOSE[locale], 'neutral', 'idle');
}

/** C.19: the check-in line; the session continues for the learner's answer. */
export function checkInText(locale: Locale): string {
  return CHECK_IN[locale];
}

export function checkInResponse(locale: Locale): TutorTurn {
  // Warm and attentive, never a "sad" face (B.26): the Mentor is checking
  // on its own help, not on the learner.
  return turn(CHECK_IN[locale], 'encouraging', 'nod');
}

/** C.14: the self-explanation question; the session continues for the learner's reason. */
export function selfExplanationText(locale: Locale, variant: PromptVariant): string {
  return SELF_EXPLANATION[variant][locale];
}

export function selfExplanationResponse(locale: Locale, variant: PromptVariant): TutorTurn {
  // Curious, never evaluative: the question is about their reasoning.
  return turn(SELF_EXPLANATION[variant][locale], 'thinking', 'nod');
}

/** C.15: the renegotiation question; the learner answers in their own words. */
export function renegotiationText(locale: Locale): string {
  return RENEGOTIATION[locale];
}

export function renegotiationResponse(locale: Locale): TutorTurn {
  return turn(RENEGOTIATION[locale], 'encouraging', 'nod');
}

/** C.15: the honest opening of a first meeting / persona switch (`introduce`) or a memory gap (`reconnect`). */
export function continuityOpeningText(character: CharacterId, locale: Locale, kind: 'introduce' | 'reconnect'): string {
  return CONTINUITY_OPENINGS[kind][character][locale];
}

export function continuityOpeningResponse(
  character: CharacterId,
  locale: Locale,
  kind: 'introduce' | 'reconnect',
): TutorTurn {
  const lively = character === 'liruf' || character === 'zara';
  return turn(CONTINUITY_OPENINGS[kind][character][locale], lively ? 'excited' : 'happy', 'wave');
}

/** The opening line: the character's own greeting, or a queued re-engagement message. */
export function openingResponse(character: CharacterId, locale: Locale, opening: SessionOpening): TutorTurn {
  if (opening === 'greeting') return greetingResponse(character, locale);
  return turn(REENGAGEMENT[opening][locale], 'happy', 'wave');
}

/*
 * ── THE CATALOGUE ───────────────────────────────────────────────────────────
 *
 * Every fixed line this service can speak, enumerated once so that the
 * pre-generation script and the runtime cannot disagree about what the set is.
 *
 * They are enumerated PER CHARACTER even though most of the texts are
 * character-independent, because the audio is not: each of the four has their
 * own cloned voice per locale (/ORACLE.md §3.3), so "Time is up for
 * today" is four different recordings, not one.
 *
 * 32 texts × 4 characters × 3 locales = 384 clips, and that number is the
 * whole point: it is finite, it does not grow with usage, and once it exists
 * nobody is ever billed for any of it again.
 */
export interface ScriptedLine {
  /** Stable id, for the manifest and for a human reading a diff. */
  key: string;
  character: CharacterId;
  locale: Locale;
  text: string;
}

export function scriptedLineCatalogue(): ScriptedLine[] {
  const lines: ScriptedLine[] = [];
  for (const character of CHARACTER_IDS) {
    for (const locale of LOCALES) {
      lines.push({ key: 'greeting', character, locale, text: GREETINGS[character][locale] });
      for (const [category, trilingual] of Object.entries(SAFETY_LINES)) {
        lines.push({ key: `safety.${category}`, character, locale, text: trilingual[locale] });
      }
      MODEL_DOWN.forEach((variant, i) => {
        lines.push({ key: `model_down.${i}`, character, locale, text: variant[locale] });
      });
      lines.push({ key: 'moderation_blocked', character, locale, text: MODERATION_BLOCKED[locale] });
      lines.push({ key: 'consent_revoked', character, locale, text: CONSENT_REVOKED[locale] });
      // C.16 closing scripts and the queued re-engagement openings.
      lines.push({ key: 'closing.recap', character, locale, text: RECAP_PROMPT[locale] });
      for (const [act, trilingual] of Object.entries(COMPLETED_CLOSE)) {
        lines.push({ key: `closing.completed.${act}`, character, locale, text: trilingual[locale] });
      }
      lines.push({ key: 'closing.interrupted', character, locale, text: INTERRUPTED_CLOSE[locale] });
      lines.push({ key: 'closing.safety_stop', character, locale, text: SAFETY_STOP_CLOSE[locale] });
      for (const [opening, trilingual] of Object.entries(REENGAGEMENT)) {
        lines.push({ key: `opening.${opening}`, character, locale, text: trilingual[locale] });
      }
      // C.19: the disengagement check-in.
      lines.push({ key: 'check_in', character, locale, text: CHECK_IN[locale] });
      // C.14: the self-explanation questions.
      for (const [variant, trilingual] of Object.entries(SELF_EXPLANATION)) {
        lines.push({ key: `self_explanation.${variant}`, character, locale, text: trilingual[locale] });
      }
      // C.15: the renegotiation question and the continuity openings.
      lines.push({ key: 'renegotiation', character, locale, text: RENEGOTIATION[locale] });
      for (const kind of ['introduce', 'reconnect'] as const) {
        lines.push({ key: `opening.${kind}`, character, locale, text: CONTINUITY_OPENINGS[kind][character][locale] });
      }
    }
  }
  return lines;
}

/**
 * Every distinct scripted TEXT, for the runtime's "is this line reusable?"
 * question.
 *
 * Membership decides which Depot bucket a clip lands in and therefore how long
 * it lives (`src/voice/speech.ts`): a text in here is human-written, closed,
 * identical for every learner and contains nothing about anybody, so it is
 * shareable and permanent. Anything else belongs to one child's session.
 *
 * Derived from the catalogue rather than listed again, so an edited line can
 * never fall out of the set by being edited in only one of two places.
 */
export const SCRIPTED_TEXTS: ReadonlySet<string> = new Set(
  scriptedLineCatalogue().map((line) => line.text),
);
