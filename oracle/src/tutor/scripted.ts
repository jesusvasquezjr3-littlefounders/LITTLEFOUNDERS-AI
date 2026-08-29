import { CHARACTER_IDS, LOCALES, type CharacterId, type Locale } from '../context/schema.js';
import type { SafetyCategory } from '../safety/classifier.js';
import type { TutorTurn } from './turnSchema.js';

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
 * Across 4 characters and 3 locales the whole set is 144 pieces of audio that
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
  return { say, emotion, action, next: 'ask', segmentRequest: null, offerAdaptation: null };
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

const MODEL_DOWN: Trilingual = {
  'en-US': 'My thoughts got tangled for a moment. Give me a second and ask me again?',
  'es-MX': 'Se me enredaron las ideas un momento. ¿Me lo preguntas otra vez?',
  'pt-BR': 'Minhas ideias se embaralharam um instante. Pode me perguntar de novo?',
};

const MODERATION_BLOCKED: Trilingual = {
  'en-US': 'Let me say that a different way. What part would you like me to explain again?',
  'es-MX': 'Déjame decirlo de otra forma. ¿Qué parte quieres que te explique otra vez?',
  'pt-BR': 'Deixa eu dizer de outro jeito. Que parte você quer que eu explique de novo?',
};

/*
 * The line must not promise anything. The previous wording said "terminamos
 * esta última parte y te dejo ir" — and there IS no last part: the socket
 * calls finish() the moment this is delivered. Both of the owner's sessions
 * on 2026-08-29 ended on that promise. A goodbye that announces one more
 * thing and then leaves is, to a child, a small broken promise on the way
 * out the door — the worst possible last impression.
 *
 * Changing scripted text orphans its pregenerated clips: the first delivery
 * per character/locale synthesizes fresh and lands in the shared speech
 * cache, so the cost is one paid synthesis per slot, once, not a regression.
 */
const SOFT_CLOSE: Trilingual = {
  'en-US':
    'We did great work today. Thank you for coming — I will be right here whenever you want to keep going.',
  'es-MX':
    'Hoy trabajamos muy bien. Gracias por venir; aquí te espero para seguir cuando tú quieras.',
  'pt-BR':
    'Hoje a gente trabalhou muito bem. Obrigado por vir; vou estar aqui esperando quando você quiser continuar.',
};

const HARD_CLOSE: Trilingual = {
  'en-US': 'That is our time for today. You worked hard — I will be here when you come back.',
  'es-MX': 'Hasta aquí llegamos por hoy. Te esforzaste mucho; aquí voy a estar cuando regreses.',
  'pt-BR': 'Por hoje é isso. Você se esforçou bastante; vou estar aqui quando você voltar.',
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
  };
}

export function modelDownResponse(locale: Locale): TutorTurn {
  return turn(MODEL_DOWN[locale], 'thinking', 'think');
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

export function closingResponse(locale: Locale, kind: 'soft' | 'hard'): TutorTurn {
  return {
    say: kind === 'soft' ? SOFT_CLOSE[locale] : HARD_CLOSE[locale],
    emotion: 'proud',
    action: kind === 'soft' ? 'nod' : 'wave',
    next: 'close',
    segmentRequest: null,
    offerAdaptation: null,
  };
}

/*
 * ── THE CATALOGUE ───────────────────────────────────────────────────────────
 *
 * Every fixed line this service can speak, enumerated once so that the
 * pre-generation script and the runtime cannot disagree about what the set is.
 *
 * They are enumerated PER CHARACTER even though most of the texts are
 * character-independent, because the audio is not: each of the four has their
 * own cloned voice per locale (/ORACLE.md §3.3), so "That is our time for
 * today" is four different recordings, not one.
 *
 * 12 texts × 4 characters × 3 locales = 144 clips, and that number is the
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
      lines.push({ key: 'model_down', character, locale, text: MODEL_DOWN[locale] });
      lines.push({ key: 'moderation_blocked', character, locale, text: MODERATION_BLOCKED[locale] });
      lines.push({ key: 'soft_close', character, locale, text: SOFT_CLOSE[locale] });
      lines.push({ key: 'hard_close', character, locale, text: HARD_CLOSE[locale] });
      lines.push({ key: 'consent_revoked', character, locale, text: CONSENT_REVOKED[locale] });
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
